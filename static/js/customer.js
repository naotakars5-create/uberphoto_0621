let selectedPlan = null;
let plans = {};
let requestId = null;
let galleryToken = null;
let photoSocket = null;
let customerPos = null;
let nearbyList = [];
let selectedPeople = '';
let selectedScenes = [];
let selectedSpot = '';
let matchedName = '';
let matchedPhotographer = null;

const $ = (id) => document.getElementById(id);

let etaTimer = null;

// Popular spots in the Asakusa trial area: best-light hint + position on the map (viewBox 0..400 / 0..230).
const SPOTS = [
  { name: '雷門', hint: '午前は順光で顔が明るく写ります', x: 195, y: 204 },
  { name: '仲見世通り', hint: '夕方は提灯に灯りが入って雰囲気◎', x: 195, y: 150 },
  { name: '浅草寺 本堂', hint: '朝いちばんは人が少なく撮りやすい', x: 212, y: 84 },
  { name: '五重塔', hint: '晴れた日中、青空と一緒に', x: 150, y: 92 },
  { name: '隅田川テラス', hint: '夕暮れ〜夜景がいちばん映えます', x: 294, y: 182 },
  { name: 'スカイツリー前', hint: '日没前後のマジックアワーが絶景', x: 368, y: 116 },
];
const PEOPLE_OPTS = ['1人', '2人', '3〜4人', '5人以上'];
const SCENE_OPTS = ['記念', 'カップル', '家族', '友達', 'ソロ活', 'プロフィール'];

function initDetails() {
  // spot picker: dropdown + tappable map pins, kept in sync
  const sel = $('spotSelect');
  SPOTS.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.name;
    o.textContent = s.name;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { if (sel.value) selectSpot(sel.value); });

  const pins = $('spotPins');
  pins.innerHTML = SPOTS.map((s) => `
    <g class="spot-pin" data-name="${escapeHtml(s.name)}" transform="translate(${s.x},${s.y})">
      <circle class="sp-hit" r="18" fill="transparent"/>
      <circle class="sp-ring" r="12"/>
      <circle class="sp-dot" r="7"/>
    </g>`).join('');
  pins.querySelectorAll('.spot-pin').forEach((g) => {
    g.addEventListener('click', () => selectSpot(g.dataset.name));
  });

  // people (single-select)
  const pc = $('peopleChips');
  PEOPLE_OPTS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt-chip';
    b.textContent = p;
    b.onclick = () => {
      const on = selectedPeople === p;
      selectedPeople = on ? '' : p;
      pc.querySelectorAll('.opt-chip').forEach((x) => x.classList.remove('on'));
      if (!on) b.classList.add('on');
    };
    pc.appendChild(b);
  });

  // scene (multi-select)
  const cc = $('sceneChips');
  SCENE_OPTS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt-chip';
    b.textContent = s;
    b.onclick = () => {
      if (selectedScenes.includes(s)) {
        selectedScenes = selectedScenes.filter((x) => x !== s);
        b.classList.remove('on');
      } else {
        selectedScenes.push(s);
        b.classList.add('on');
      }
    };
    cc.appendChild(b);
  });

  hydrateIcons($('step-plan'));
}

// Choose a shooting spot from either the map or the dropdown; keep both in sync.
function selectSpot(name) {
  selectedSpot = name;
  const s = SPOTS.find((x) => x.name === name);
  $('spotSelect').value = name;
  document.querySelectorAll('#spotPins .spot-pin').forEach((g) => {
    g.classList.toggle('on', g.dataset.name === name);
  });
  $('mapCap').innerHTML = `${icon('pin', 13)}<span>${escapeHtml(name)}</span>`;
  if (s) $('spotHint').querySelector('span').textContent = s.hint;
  validate();
}

function show(step) {
  ['step-plan', 'step-confirm', 'step-select', 'step-arriving', 'step-matched'].forEach((s) => $(s).classList.add('hidden'));
  $(step).classList.remove('hidden');
  window.scrollTo(0, 0);
}

// progress stepper: n=1 マッチ, 2 向かう, 3 撮影, 4 お届け, 5 完了(all done)
function setStage(n) {
  document.querySelectorAll('.stepper').forEach((st) => {
    st.querySelectorAll('.st-node').forEach((node, i) => {
      node.classList.remove('done', 'active');
      if (i < n - 1) node.classList.add('done');
      else if (i === n - 1) node.classList.add('active');
    });
  });
}

const PLAN_THUMBS = { light: 'strip2', standard: 'strip3', premium: 'strip4' };
const PLAN_TAGS = { standard: '人気 No.1', premium: 'いちばん多く撮れる' };

async function loadPlans() {
  plans = await api('/api/plans');
  const wrap = $('plans');
  wrap.innerHTML = '';
  Object.entries(plans).forEach(([key, p]) => {
    const div = document.createElement('div');
    div.className = 'plan';
    div.dataset.key = key;
    div.innerHTML = `
      <div class="plan-row">
        <img class="plan-thumb" src="/static/img/${PLAN_THUMBS[key] || 'strip1'}.jpg" alt="">
        <div class="plan-info">
          <span class="plan-name">${p.label.split(' ')[0]}</span>
          <span class="plan-sub">${p.minutes}分 / ${p.shots}枚 · 撮ってすぐ共有</span>
          ${PLAN_TAGS[key] ? `<span class="plan-tag">${PLAN_TAGS[key]}</span>` : ''}
        </div>
        <div class="plan-price"><span class="yen">¥</span>${p.price.toLocaleString('ja-JP')}<span class="tax">税込</span></div>
      </div>`;
    div.onclick = () => selectPlan(key, div);
    wrap.appendChild(div);
  });
}

function selectPlan(key, el) {
  selectedPlan = key;
  document.querySelectorAll('.plan').forEach((p) => p.classList.remove('selected'));
  el.classList.add('selected');
  validate();
}

// updates the sticky CTA summary + enabled state
function validate() {
  if (!selectedPlan) {
    $('ctaPlan').textContent = 'プランを選択してください';
    $('ctaPrice').textContent = '—';
    $('toPay').disabled = true;
    return;
  }
  const p = plans[selectedPlan];
  $('ctaPrice').innerHTML = `¥${p.price.toLocaleString('ja-JP')}<span class="tax">税込</span>`;
  if (!$('name').value.trim()) {
    $('ctaPlan').textContent = 'お名前を入力してください';
    $('toPay').disabled = true;
  } else {
    $('ctaPlan').textContent = `${p.label.split(' ')[0]} · ${p.minutes}分/${p.shots}枚`;
    $('toPay').disabled = false;
  }
}
$('name').addEventListener('input', validate);

$('toPay').addEventListener('click', () => showConfirm());

function showConfirm() {
  const p = plans[selectedPlan];
  const base = Math.round(p.price / 1.1);
  const tax = p.price - base;
  $('cf-plan').textContent = p.label.split(' ')[0];
  $('cf-shots').textContent = p.shots + '枚';
  $('cf-min').textContent = p.minutes + '分';
  $('cf-loc').textContent = selectedSpot || '浅草エリア';
  // optional details: hide the row when empty
  const note = $('note').value.trim();
  $('cf-people-row').style.display = selectedPeople ? '' : 'none';
  $('cf-people').textContent = selectedPeople;
  $('cf-scene-row').style.display = selectedScenes.length ? '' : 'none';
  $('cf-scene').textContent = selectedScenes.join('・');
  $('cf-note-row').style.display = note ? '' : 'none';
  $('cf-note').textContent = note;
  $('cf-name').textContent = $('name').value.trim();
  $('cf-base').textContent = '¥' + base.toLocaleString('ja-JP');
  $('cf-tax').textContent = '¥' + tax.toLocaleString('ja-JP');
  $('cf-total').textContent = '¥' + p.price.toLocaleString('ja-JP');
  show('step-confirm');
}

$('confirmBack').addEventListener('click', () => show('step-plan'));

$('confirmPay').addEventListener('click', async () => {
  $('confirmPay').disabled = true;
  $('confirmPay').innerHTML = '決済処理中…';
  try {
    customerPos = await getPosition(); // captured before any Stripe redirect
    const order = await api('/api/orders', 'POST', {
      plan: selectedPlan,
      customer_name: $('name').value.trim(),
      location: selectedSpot || '浅草エリア',
      lat: customerPos ? customerPos.lat : null,
      lng: customerPos ? customerPos.lng : null,
      people: selectedPeople || null,
      scene: selectedScenes.join(',') || null,
      note: $('note').value.trim() || null,
    });
    requestId = order.request_id;
    store('lastRequestId', requestId);
    if (order.mode === 'stripe' && order.checkout_url) {
      window.location = order.checkout_url; // → Stripe Checkout, returns to /customer?session_id=...
      return;
    }
    // stub mode (no Stripe key): already paid
    requestNotifyPermission();
    await showSelect();
  } catch (e) {
    toast('エラー: ' + e.message);
    $('confirmPay').disabled = false;
    $('confirmPay').innerHTML = 'この内容で決済して依頼 ' + icon('arrow', 19);
  }
});

// resume after returning from Stripe Checkout
async function handlePaymentReturn() {
  const params = new URLSearchParams(location.search);
  if (params.get('canceled')) {
    history.replaceState({}, '', '/customer');
    toast('決済をキャンセルしました');
    return;
  }
  const sid = params.get('session_id');
  if (!sid) return;
  try {
    const r = await api('/api/payments/verify', 'POST', { session_id: sid });
    history.replaceState({}, '', '/customer');
    if (r.paid) {
      requestId = r.request_id;
      requestNotifyPermission();
      customerPos = await getPosition();
      await showSelect();
    } else {
      toast('決済が確認できませんでした');
    }
  } catch (e) {
    toast('決済確認エラー: ' + e.message);
  }
}

const SKELETON = Array(3).fill(
  '<div class="skel-card"><div class="skel-top"><div class="skel skel-thumb"></div>' +
  '<div style="flex:1"><div class="skel skel-line" style="width:45%"></div>' +
  '<div class="skel skel-line" style="width:72%"></div>' +
  '<div class="skel skel-line" style="width:38%"></div></div></div></div>'
).join('');

async function showSelect() {
  show('step-select');
  const wrap = $('photographers');
  wrap.innerHTML = SKELETON;
  let q = '';
  if (customerPos) q = `?lat=${customerPos.lat}&lng=${customerPos.lng}`;
  let errored = false;
  try { nearbyList = await api('/api/photographers/nearby' + q); } catch (e) { errored = true; nearbyList = []; }
  $('nearCount').textContent = errored ? '通信エラー' : `近くに${nearbyList.length}人`;

  const omakaseBtn = $('omakaseBtn');
  const hasList = nearbyList.length > 0;
  // toggle omakase + "または指名" divider with availability
  omakaseBtn.style.display = hasList ? '' : 'none';
  $('orRow').style.display = hasList ? '' : 'none';

  if (hasList) {
    const best = nearbyList[0];
    $('omakaseDesc').textContent = `最短 ${best.name} さん・約${best.eta_min}分でお迎え`;
    omakaseBtn.onclick = () => choosePhotographer(best);
  }

  if (errored) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="es-ic">${icon('zap', 30)}</div>
        <div class="es-title">通信エラーが発生しました</div>
        <div class="es-desc">ネットワーク環境をご確認のうえ、もう一度お試しください。</div>
        <button class="btn brand" id="retryNearby">${icon('refresh', 18)} 再読み込み</button>
      </div>`;
    $('retryNearby').onclick = showSelect;
    return;
  }
  if (!hasList) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="es-ic">${icon('map', 30)}</div>
        <div class="es-title">いま近くに待機中のカメラマンがいません</div>
        <div class="es-desc">土日 14:00–18:00 の混雑時間は見つかりやすくなります。少し時間をおいて再検索してください。</div>
        <button class="btn brand" id="retryNearby">${icon('refresh', 18)} もう一度さがす</button>
        <button class="btn secondary" id="notifyNearby">空き次第、通知を受け取る</button>
      </div>`;
    $('retryNearby').onclick = showSelect;
    $('notifyNearby').onclick = () => { requestNotifyPermission(); toast('カメラマンが見つかったら通知します'); };
    return;
  }
  wrap.innerHTML = '';
  nearbyList.forEach((p) => {
    const tags = (p.tags || []).filter(Boolean).map((t) => `<span class="tag">${t}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'pick-card';
    div.innerHTML = `
      <div class="pick-top">
        <img class="pick-thumb" src="${p.thumb}" alt="">
        <div style="flex:1">
          <div class="pick-name">${p.name} <span class="verified" title="本人確認済み">${icon('shield', 15)}</span></div>
          <div class="pick-rt">${icon('star', 14)}${p.rating} · ${p.shots}件</div>
          <div class="pick-tags">${tags}</div>
        </div>
        <span class="pick-chevron">${icon('chevron', 18)}</span>
      </div>
      <div class="pick-foot">
        <div class="pick-meta">${icon('pin', 14)}${p.distance_km}km · 約${p.eta_min}分でお迎え</div>
        <button class="btn brand pick-btn">選ぶ</button>
      </div>`;
    // tap card → profile; tap 選ぶ → select directly
    div.querySelector('.pick-top').onclick = () => openProfile(p);
    div.querySelector('.pick-btn').onclick = (e) => { e.stopPropagation(); choosePhotographer(p); };
    wrap.appendChild(div);
  });
}

function openProfile(p) {
  const tags = (p.tags || []).filter(Boolean).map((t) => `<span class="tag">${t}</span>`).join('');
  const portfolio = (p.portfolio || []).map((src) => `<img src="${src}" loading="lazy" alt="">`).join('');
  $('sheetBody').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-head">
      <img class="sheet-avatar" src="${p.thumb}" alt="">
      <div style="flex:1">
        <div class="sheet-name">${p.name} <span class="verified">${icon('shield', 16)}</span></div>
        <div class="pick-rt">${icon('star', 14)}${p.rating} · ${p.shots}件の撮影</div>
        <div class="pick-meta" style="margin-top:4px">${icon('pin', 14)}${p.distance_km}km · 約${p.eta_min}分でお迎え</div>
      </div>
    </div>
    <div class="pick-tags" style="margin:14px 0">${tags}</div>
    <p class="sheet-bio">${p.bio || ''}</p>
    <div class="section-head" style="margin:18px 0 10px"><h2>作例</h2><span class="more">${(p.portfolio || []).length}枚</span></div>
    <div class="portfolio">${portfolio}</div>
    <div class="section-head" style="margin:22px 0 10px"><h2>レビュー</h2><span class="more">${icon('star', 13)}${p.rating}</span></div>
    <div class="reviews">${(p.reviews || []).map(reviewHtml).join('')}</div>
    <button class="btn brand" id="sheetSelect" style="margin-top:18px">${p.name} さんで撮影する ${icon('arrow', 19)}</button>
    <button class="btn secondary" id="sheetClose2">閉じる</button>`;
  $('sheetSelect').onclick = () => { closeProfile(); choosePhotographer(p); };
  $('sheetClose2').onclick = closeProfile;
  const sheet = $('profileSheet');
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => sheet.classList.add('open'));
}

function reviewHtml(r) {
  const stars = '★'.repeat(r.rating) + `<span class="dim">${'★'.repeat(5 - r.rating)}</span>`;
  return `
    <div class="review">
      <div class="review-head">
        <span class="review-author">${r.author}</span>
        <span class="review-stars">${stars}</span>
        <span class="review-ago">${r.ago}</span>
      </div>
      <div class="review-text">${r.text}</div>
    </div>`;
}

function closeProfile() {
  const sheet = $('profileSheet');
  sheet.classList.remove('open');
  setTimeout(() => sheet.classList.add('hidden'), 250);
}
$('sheetBackdrop').addEventListener('click', closeProfile);

async function choosePhotographer(p) {
  try {
    const res = await api(`/api/requests/${requestId}/select`, 'POST', { photographer_id: p.id });
    onMatched(res.photographer, res.gallery_token);
  } catch (e) {
    toast(e.message === 'already matched' ? 'このカメラマンは他の依頼に対応中です' : 'エラー: ' + e.message);
    showSelect();
  }
}

function onMatched(p, token) {
  galleryToken = token;
  matchedName = p.name || '';
  matchedPhotographer = p;
  // chat becomes available the moment we match
  setupChat(p);
  // arrival screen
  $('aName').textContent = p.name + ' さん';
  $('aAvatar').textContent = (p.name || '?').charAt(0);
  $('aMeta').innerHTML = `${icon('star', 14)}${p.rating} · ${p.distance_km}km 先から`;
  const mi = document.getElementById('markerInit');
  if (mi) mi.textContent = (p.name || 'P').charAt(0);
  // photos screen (prepared)
  $('pName').textContent = p.name + ' さん';
  $('pAvatar').textContent = (p.name || '?').charAt(0);
  $('pMeta').innerHTML = `${icon('star', 14)}${p.rating} · 撮影中`;
  $('toGallery').href = `/gallery?token=${galleryToken}`;
  notify('UberPHOTO', `${p.name}さんが向かっています`);
  startEta(p.eta_min || 3);
  show('step-arriving');
  setStage(2);
  listenForPhotos();
}

function startEta(min) {
  clearInterval(etaTimer);
  let sec = Math.max(60, Math.round(min * 60));
  const tick = () => {
    if (sec <= 0) {
      $('etaCount').textContent = '到着';
      $('arriveTitle').textContent = 'まもなく到着';
      clearInterval(etaTimer);
      return;
    }
    const m = Math.floor(sec / 60), s = sec % 60;
    $('etaCount').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    sec--;
  };
  tick();
  etaTimer = setInterval(tick, 1000);
}

function listenForPhotos() {
  if (photoSocket) photoSocket.close();
  photoSocket = openSocket(`/ws/customer/${requestId}`, (msg) => {
    if (msg.type === 'photos_uploaded') {
      clearInterval(etaTimer);
      show('step-matched');
      setStage(3);
      setTimeout(() => setStage(4), 900);
      $('matchedTitle').textContent = '写真が届きました';
      $('shotStatus').textContent = `📸 ${msg.count}枚 届きました`;
      galleryToken = msg.gallery_token;
      $('toGallery').href = `/gallery?token=${galleryToken}`;
      $('toGallery').classList.remove('hidden');
      notify('UberPHOTO', `写真が${msg.count}枚届きました`);
    } else if (msg.type === 'session_complete') {
      show('step-matched');
      setStage(5);
      $('matchedTitle').textContent = '撮影完了';
      $('shotStatus').textContent = '✅ 撮影完了';
      notify('UberPHOTO', '撮影が完了しました。写真を確認しましょう。');
      openReview();
    } else if (msg.type === 'message') {
      addChatMsg(msg.sender, msg.text, msg.created_at);
    }
  });
}

// ---------- chat with the photographer ----------
let chatLog = [];
let chatUnread = 0;

function setupChat(p) {
  chatLog = [];
  chatUnread = 0;
  $('chatAvatar').src = p.thumb || '/static/img/work1.jpg';
  $('chatName').textContent = (p.name || 'カメラマン') + ' さん';
  $('chatBadge').classList.add('hidden');
  $('chatFab').classList.remove('hidden');
  renderChat();
  loadChatHistory();
}

function hideChat() {
  $('chatFab').classList.add('hidden');
  closeChat();
}

async function loadChatHistory() {
  try {
    const msgs = await api(`/api/requests/${requestId}/messages`);
    chatLog = msgs.map((m) => ({ sender: m.sender, text: m.text, ts: m.created_at }));
  } catch (e) { /* keep what we have */ }
  if (chatIsOpen()) { renderChat(); scrollChat(); }
}

function chatIsOpen() {
  const s = $('chatSheet');
  return !s.classList.contains('hidden') && s.classList.contains('open');
}

function renderChat() {
  $('chatLog').innerHTML = chatLog.length
    ? chatLog.map((m) => chatBubble(m.text, m.sender === 'customer', m.ts)).join('')
    : '<p class="chat-empty muted">メッセージはまだありません。<br>「赤い服で雷門前にいます」など、合流のやりとりにどうぞ。</p>';
}

function scrollChat() { const l = $('chatLog'); l.scrollTop = l.scrollHeight; }

function addChatMsg(sender, text, ts) {
  chatLog.push({ sender, text, ts: ts || new Date().toISOString() });
  if (chatIsOpen()) {
    renderChat();
    scrollChat();
  } else if (sender !== 'customer') {
    chatUnread += 1;
    const b = $('chatBadge');
    b.textContent = chatUnread;
    b.classList.remove('hidden');
    const fab = $('chatFab');
    fab.classList.remove('ping'); void fab.offsetWidth; fab.classList.add('ping');
    notify(matchedName || 'カメラマン', text);
  }
}

function openChat() {
  chatUnread = 0;
  $('chatBadge').classList.add('hidden');
  renderChat();
  const sheet = $('chatSheet');
  sheet.classList.remove('hidden');
  requestAnimationFrame(() => { sheet.classList.add('open'); scrollChat(); });
  setTimeout(() => $('chatText').focus(), 280);
  loadChatHistory();
}

function closeChat() {
  const sheet = $('chatSheet');
  sheet.classList.remove('open');
  setTimeout(() => sheet.classList.add('hidden'), 250);
}

$('chatFab').addEventListener('click', openChat);
$('chatClose').addEventListener('click', closeChat);
$('chatBackdrop').addEventListener('click', closeChat);
$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('chatText').value.trim();
  if (!v || !requestId) return;
  $('chatText').value = '';
  addChatMsg('customer', v, new Date().toISOString());
  try {
    await api(`/api/requests/${requestId}/messages`, 'POST', { sender: 'customer', text: v });
  } catch (err) { toast('送信できませんでした'); }
});

async function cancelMatch() {
  clearInterval(etaTimer);
  if (photoSocket) photoSocket.close();
  try { await api(`/api/requests/${requestId}/cancel`, 'POST', {}); } catch (e) {}
}

$('reselectBtn').addEventListener('click', async () => {
  hideChat();
  await cancelMatch();
  toast('別のカメラマンを選べます');
  await showSelect();
});

$('cancelReqBtn').addEventListener('click', async () => {
  if (!confirm('この依頼をキャンセルしますか？')) return;
  hideChat();
  await cancelMatch();
  toast('依頼をキャンセルしました');
  show('step-plan');
  validate();
});

$('backToPlan').addEventListener('click', () => {
  hideChat();
  if (photoSocket) photoSocket.close();
  show('step-plan');
  validate();
});

// ---------- post-shoot review ----------
let reviewStars = 0;
function paintStars() {
  document.querySelectorAll('#starPick .star').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.v) <= reviewStars);
  });
}
function openReview() {
  const card = $('reviewCard');
  if (!card || card.dataset.done) return;
  $('rvWho').textContent = matchedName ? `${matchedName} さんはいかがでしたか？` : 'カメラマンを評価しましょう';
  card.classList.remove('hidden');
}
document.querySelectorAll('#starPick .star').forEach((b) => {
  b.addEventListener('click', () => {
    reviewStars = Number(b.dataset.v);
    paintStars();
    $('rvSubmit').disabled = false;
  });
});
$('rvSubmit').addEventListener('click', async () => {
  if (!reviewStars) return;
  $('rvSubmit').disabled = true;
  try {
    await api(`/api/requests/${requestId}/review`, 'POST', { rating: reviewStars, text: $('rvText').value.trim() });
    $('starPick').style.display = 'none';
    $('rvText').style.display = 'none';
    $('rvSubmit').style.display = 'none';
    $('rvThanks').classList.remove('hidden');
    $('reviewCard').dataset.done = '1';
  } catch (e) {
    toast('送信エラー: ' + e.message);
    $('rvSubmit').disabled = false;
  }
});

initDetails();
loadPlans();
handlePaymentReturn();

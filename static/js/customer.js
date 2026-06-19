let selectedPlan = null;
let plans = {};
let requestId = null;
let galleryToken = null;
let photoSocket = null;
let customerPos = null;
let nearbyList = [];

const $ = (id) => document.getElementById(id);

let etaTimer = null;

function show(step) {
  ['step-plan', 'step-select', 'step-arriving', 'step-matched'].forEach((s) => $(s).classList.add('hidden'));
  $(step).classList.remove('hidden');
  window.scrollTo(0, 0);
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

function validate() {
  $('toPay').disabled = !(selectedPlan && $('name').value.trim());
}
$('name').addEventListener('input', validate);

$('toPay').addEventListener('click', async () => {
  $('toPay').disabled = true;
  $('toPay').innerHTML = '決済処理中…';
  try {
    const pay = await api('/api/checkout', 'POST', { plan: selectedPlan });
    if (pay.mode === 'stripe' && pay.checkout_url) {
      window.location = pay.checkout_url;
      return;
    }
    await createRequest(pay.stripe_id);
  } catch (e) {
    toast('エラー: ' + e.message);
    $('toPay').disabled = false;
    $('toPay').innerHTML = '決済して撮影を依頼 ' + icon('arrow', 19);
  }
});

async function createRequest(paymentId) {
  // best-effort location (used to rank/measure nearby photographers)
  customerPos = await getPosition();
  const req = await api('/api/requests', 'POST', {
    customer_name: $('name').value.trim(),
    plan: selectedPlan,
    location: $('location').value.trim() || '浅草エリア',
    lat: customerPos ? customerPos.lat : null,
    lng: customerPos ? customerPos.lng : null,
    payment_id: paymentId,
  });
  requestId = req.id;
  store('lastRequestId', requestId);
  requestNotifyPermission();
  await showSelect();
}

async function showSelect() {
  show('step-select');
  const wrap = $('photographers');
  wrap.innerHTML = '<p class="muted">近くのカメラマンを探しています…</p>';
  let q = '';
  if (customerPos) q = `?lat=${customerPos.lat}&lng=${customerPos.lng}`;
  try { nearbyList = await api('/api/photographers/nearby' + q); } catch (e) { nearbyList = []; }
  $('nearCount').textContent = `近くに${nearbyList.length}人`;

  // omakase = closest (list is sorted by distance)
  const omakaseBtn = $('omakaseBtn');
  if (nearbyList.length) {
    const best = nearbyList[0];
    $('omakaseDesc').textContent = `最短 ${best.name} さん・約${best.eta_min}分でお迎え`;
    omakaseBtn.style.display = '';
    omakaseBtn.onclick = () => choosePhotographer(best);
  } else {
    omakaseBtn.style.display = 'none';
  }

  if (!nearbyList.length) {
    wrap.innerHTML = '<p class="muted">いま近くに待機中のカメラマンがいません。少し待って再度お試しください。</p>';
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
      $('shotStatus').textContent = `📸 ${msg.count}枚 届きました`;
      galleryToken = msg.gallery_token;
      $('toGallery').href = `/gallery?token=${galleryToken}`;
      $('toGallery').classList.remove('hidden');
      notify('UberPHOTO', `写真が${msg.count}枚届きました`);
    } else if (msg.type === 'session_complete') {
      show('step-matched');
      $('shotStatus').textContent = '✅ 撮影完了';
      notify('UberPHOTO', '撮影が完了しました。写真を確認しましょう。');
    }
  });
}

async function cancelMatch() {
  clearInterval(etaTimer);
  if (photoSocket) photoSocket.close();
  try { await api(`/api/requests/${requestId}/cancel`, 'POST', {}); } catch (e) {}
}

$('reselectBtn').addEventListener('click', async () => {
  await cancelMatch();
  toast('別のカメラマンを選べます');
  await showSelect();
});

$('cancelReqBtn').addEventListener('click', async () => {
  await cancelMatch();
  toast('依頼をキャンセルしました');
  show('step-plan');
  $('toPay').disabled = false;
  $('toPay').innerHTML = '決済して撮影を依頼 ' + icon('arrow', 19);
});

$('backToPlan').addEventListener('click', () => {
  if (photoSocket) photoSocket.close();
  show('step-plan');
  $('toPay').disabled = false;
  $('toPay').innerHTML = '決済して撮影を依頼 ' + icon('arrow', 19);
});

loadPlans();

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

// Shooting areas (都道府県→spots) loaded from the backend. Each spot has a
// lat/lng that drives the mini-map pin layout and the shoot location.
let areas = [];
let currentArea = null;   // the selected area object
let spots = [];           // currentArea.spots with computed map x/y
let spotLatLng = null;    // { lat, lng } of the chosen spot

// Place an area's spots on the 400×230 map by normalising their lat/lng into
// the viewBox (higher latitude = further up). A single/degenerate spread
// falls back to the centre.
function layoutSpots(list) {
  const W = 400, H = 230, pad = 40;
  const lats = list.map((s) => s.lat), lngs = list.map((s) => s.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat, spanLng = maxLng - minLng;
  return list.map((s) => {
    const fx = spanLng > 1e-4 ? (s.lng - minLng) / spanLng : 0.5;
    const fy = spanLat > 1e-4 ? (maxLat - s.lat) / spanLat : 0.5;
    return { ...s, x: pad + fx * (W - 2 * pad), y: pad + fy * (H - 2 * pad) };
  });
}

// Canonical values stored/sent to the backend stay Japanese (the photographer
// reads them); only the chip labels are localized, index-aligned with these.
const PEOPLE_JA = ['1人', '2人', '3〜4人', '5人以上'];
const SCENE_JA = ['記念', 'カップル', '家族', '友達', 'ソロ活', 'プロフィール'];

function initDetails() {
  // area picker drives the spot picker
  $('areaSelect').addEventListener('change', (e) => selectArea(e.target.value));
  $('spotSelect').addEventListener('change', (e) => { if (e.target.value) selectSpot(e.target.value); });
  renderPeopleChips();
  renderSceneChips();
  hydrateIcons($('step-plan'));
}

// people (single-select)
function renderPeopleChips() {
  const pc = $('peopleChips');
  const labels = tRaw('people_opts');
  pc.innerHTML = '';
  PEOPLE_JA.forEach((val, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt-chip' + (selectedPeople === val ? ' on' : '');
    b.textContent = (labels && labels[i]) || val;
    b.onclick = () => {
      const on = selectedPeople === val;
      selectedPeople = on ? '' : val;
      pc.querySelectorAll('.opt-chip').forEach((x) => x.classList.remove('on'));
      if (!on) b.classList.add('on');
    };
    pc.appendChild(b);
  });
}

// scene (multi-select)
function renderSceneChips() {
  const cc = $('sceneChips');
  const labels = tRaw('scene_opts');
  cc.innerHTML = '';
  SCENE_JA.forEach((val, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt-chip' + (selectedScenes.includes(val) ? ' on' : '');
    b.textContent = (labels && labels[i]) || val;
    b.onclick = () => {
      if (selectedScenes.includes(val)) {
        selectedScenes = selectedScenes.filter((x) => x !== val);
        b.classList.remove('on');
      } else {
        selectedScenes.push(val);
        b.classList.add('on');
      }
    };
    cc.appendChild(b);
  });
}

// Load selectable areas (都道府県) and populate the area dropdown.
async function loadAreas() {
  try {
    areas = await api('/api/areas');
  } catch (e) { areas = []; }
  const sel = $('areaSelect');
  sel.innerHTML = '';
  if (!areas.length) { sel.innerHTML = '<option>読み込みエラー</option>'; return; }
  areas.forEach((a, i) => {
    const o = document.createElement('option');
    o.value = a.id;
    o.textContent = `${a.emoji || ''} ${areaLabel(a)}`.trim();
    if (i === 0) o.selected = true;
    sel.appendChild(o);
  });
  selectArea(areas[0].id);
}

// refresh the area dropdown labels in place (keeps current selection)
function relabelAreas() {
  const sel = $('areaSelect');
  if (!sel || !areas.length) return;
  Array.from(sel.options).forEach((o) => {
    const a = areas.find((x) => x.id === o.value);
    if (a) o.textContent = `${a.emoji || ''} ${areaLabel(a)}`.trim();
  });
}

// Switch the active area: rebuild the spot dropdown + map pins, reset selection.
function selectArea(areaId) {
  currentArea = areas.find((a) => a.id === areaId) || areas[0];
  if (!currentArea) return;
  $('areaSelect').value = currentArea.id;
  spots = layoutSpots(currentArea.spots);
  selectedSpot = '';
  spotLatLng = null;

  const sel = $('spotSelect');
  sel.innerHTML = `<option value="" disabled selected>${t('spot_select_default', { area: areaLabel(currentArea) })}</option>`;
  spots.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.name;
    o.textContent = s.name;
    sel.appendChild(o);
  });

  const pins = $('spotPins');
  pins.innerHTML = spots.map((s) => `
    <g class="spot-pin" data-name="${escapeHtml(s.name)}" transform="translate(${s.x.toFixed(1)},${s.y.toFixed(1)})">
      <circle class="sp-hit" r="18" fill="transparent"/>
      <circle class="sp-ring" r="12"/>
      <circle class="sp-dot" r="7"/>
    </g>`).join('');
  pins.querySelectorAll('.spot-pin').forEach((g) => {
    g.addEventListener('click', () => selectSpot(g.dataset.name));
  });

  $('mapCap').innerHTML = `${icon('map', 13)}<span>${escapeHtml(t('map_cap_area', { area: areaLabel(currentArea) }))}</span>`;
  $('spotHint').querySelector('span').textContent = t('spot_hint_default');
  validate();
}

// Choose a shooting spot from either the map or the dropdown; keep both in sync.
function selectSpot(name) {
  selectedSpot = name;
  const s = spots.find((x) => x.name === name);
  spotLatLng = s ? { lat: s.lat, lng: s.lng } : null;
  $('spotSelect').value = name;
  document.querySelectorAll('#spotPins .spot-pin').forEach((g) => {
    g.classList.toggle('on', g.dataset.name === name);
  });
  $('mapCap').innerHTML = `${icon('pin', 13)}<span>${escapeHtml(name)}</span>`;
  if (s) $('spotHint').querySelector('span').textContent = s.hint;
  validate();
}

// Name with the Japanese honorific "さん" (omitted in English).
function nm(name) { return getLang() === 'ja' ? `${name} さん` : (name || ''); }
// EN label for a JP area name (falls back to the JP name).
function areaLabelByName(jp) { const a = areas.find((x) => x.name === jp); return a ? areaLabel(a) : jp; }

// Human-readable shoot location, e.g. "京都・清水寺" or "東京エリア".
function locationLabel() {
  const area = currentArea ? currentArea.name : '';
  if (selectedSpot) return area ? `${area}・${selectedSpot}` : selectedSpot;
  return area ? `${area}エリア` : 'エリア未選択';
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

// localized helpers (canonical values stay JP for the backend)
function planName(key) {
  const m = tRaw('plan_names');
  return (m && m[key]) || (plans[key] && plans[key].label.split(' ')[0]) || key;
}
function planTag(key) { const m = tRaw('plan_tags'); return m && m[key]; }
function peopleDisplay(val) {
  const i = PEOPLE_JA.indexOf(val);
  const labels = tRaw('people_opts');
  return (i >= 0 && labels && labels[i]) || val;
}
function sceneDisplay(arr) {
  const labels = tRaw('scene_opts');
  return arr.map((v) => { const i = SCENE_JA.indexOf(v); return (i >= 0 && labels && labels[i]) || v; });
}

async function loadPlans() {
  plans = await api('/api/plans');
  renderPlans();
}

function renderPlans() {
  const wrap = $('plans');
  if (!wrap) return;
  wrap.innerHTML = '';
  Object.entries(plans).forEach(([key, p]) => {
    const div = document.createElement('div');
    div.className = 'plan' + (selectedPlan === key ? ' selected' : '');
    div.dataset.key = key;
    const tag = planTag(key);
    div.innerHTML = `
      <div class="plan-row">
        <img class="plan-thumb" src="/static/img/${PLAN_THUMBS[key] || 'strip1'}.jpg" alt="">
        <div class="plan-info">
          <span class="plan-name">${planName(key)}</span>
          <span class="plan-sub">${t('plan_blurb', { min: p.minutes, shots: p.shots })}</span>
          ${tag ? `<span class="plan-tag">${tag}</span>` : ''}
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
    $('ctaPlan').textContent = t('cta_pick_plan');
    $('ctaPrice').textContent = '—';
    $('toPay').disabled = true;
    return;
  }
  const p = plans[selectedPlan];
  $('ctaPrice').innerHTML = `¥${p.price.toLocaleString('ja-JP')}<span class="tax">税込</span>`;
  if (!$('name').value.trim()) {
    $('ctaPlan').textContent = t('cta_enter_name');
    $('toPay').disabled = true;
  } else {
    $('ctaPlan').textContent = `${planName(selectedPlan)} · ${t('plan_min_shots', { min: p.minutes, shots: p.shots })}`;
    $('toPay').disabled = false;
  }
}
$('name').addEventListener('input', validate);

$('toPay').addEventListener('click', () => showConfirm());

function showConfirm() {
  const p = plans[selectedPlan];
  const base = Math.round(p.price / 1.1);
  const tax = p.price - base;
  $('cf-plan').textContent = planName(selectedPlan);
  $('cf-shots').textContent = p.shots + t('unit_shots');
  $('cf-min').textContent = p.minutes + t('unit_min');
  $('cf-loc').textContent = locationLabel();
  // optional details: hide the row when empty
  const note = $('note').value.trim();
  $('cf-people-row').style.display = selectedPeople ? '' : 'none';
  $('cf-people').textContent = peopleDisplay(selectedPeople);
  $('cf-scene-row').style.display = selectedScenes.length ? '' : 'none';
  $('cf-scene').textContent = sceneDisplay(selectedScenes).join('・');
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
  $('confirmPay').innerHTML = t('paying');
  try {
    // shoot happens at the chosen spot; use its coordinates, falling back to GPS
    customerPos = spotLatLng || (await getPosition()); // captured before any Stripe redirect
    const order = await api('/api/orders', 'POST', {
      plan: selectedPlan,
      customer_name: $('name').value.trim(),
      location: locationLabel(),
      lat: customerPos ? customerPos.lat : null,
      lng: customerPos ? customerPos.lng : null,
      people: selectedPeople || null,
      scene: selectedScenes.join(',') || null,
      note: $('note').value.trim() || null,
    });
    requestId = order.request_id;
    store('lastRequestId', requestId);
    store('lastArea', (currentArea && currentArea.name) || '');
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
    $('confirmPay').innerHTML = t('btn_confirm_pay') + ' ' + icon('arrow', 19);
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
  const params = new URLSearchParams();
  if (customerPos) { params.set('lat', customerPos.lat); params.set('lng', customerPos.lng); }
  const areaName = (currentArea && currentArea.name) || store('lastArea') || '';
  if (areaName) params.set('area', areaName);
  const q = params.toString() ? `?${params}` : '';
  let errored = false;
  try { nearbyList = await api('/api/photographers/nearby' + q); } catch (e) { errored = true; nearbyList = []; }
  $('nearCount').textContent = errored ? t('comm_error') : t('near_count', { n: nearbyList.length });

  const omakaseBtn = $('omakaseBtn');
  const hasList = nearbyList.length > 0;
  // toggle omakase + "または指名" divider with availability
  omakaseBtn.style.display = hasList ? '' : 'none';
  $('orRow').style.display = hasList ? '' : 'none';

  if (hasList) {
    const best = nearbyList[0];
    $('omakaseDesc').textContent = t('omakase_desc', { name: best.name, eta: best.eta_min });
    omakaseBtn.onclick = () => choosePhotographer(best);
  }

  if (errored) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="es-ic">${icon('zap', 30)}</div>
        <div class="es-title">${t('err_title')}</div>
        <div class="es-desc">${t('err_desc')}</div>
        <button class="btn brand" id="retryNearby">${icon('refresh', 18)} ${t('retry')}</button>
      </div>`;
    $('retryNearby').onclick = showSelect;
    return;
  }
  if (!hasList) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="es-ic">${icon('map', 30)}</div>
        <div class="es-title">${t('none_title')}</div>
        <div class="es-desc">${t('none_desc')}</div>
        <button class="btn brand" id="retryNearby">${icon('refresh', 18)} ${t('research')}</button>
        <button class="btn secondary" id="notifyNearby">${t('notify_when')}</button>
      </div>`;
    $('retryNearby').onclick = showSelect;
    $('notifyNearby').onclick = () => { requestNotifyPermission(); toast(t('notify_set')); };
    return;
  }
  wrap.innerHTML = '';
  nearbyList.forEach((p) => {
    const tags = (p.tags || []).filter(Boolean).map((tag) => `<span class="tag">${tag}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'pick-card';
    div.innerHTML = `
      <div class="pick-top">
        <img class="pick-thumb" src="${p.thumb}" alt="">
        <div style="flex:1">
          <div class="pick-name">${p.name} <span class="verified" title="${t('verified_title')}">${icon('shield', 15)}</span></div>
          <div class="pick-rt">${icon('star', 14)}${p.rating} · ${p.shots}${t('unit_shoots')}</div>
          <div class="pick-tags">${tags}</div>
        </div>
        <span class="pick-chevron">${icon('chevron', 18)}</span>
      </div>
      <div class="pick-foot">
        <div class="pick-meta">${icon('pin', 14)}${t('pick_eta', { km: p.distance_km, eta: p.eta_min })}${p.area_match ? ` <span class="area-tag">${escapeHtml(t('area_match', { area: areaLabelByName(p.area || '') }))}</span>` : ''}</div>
        <button class="btn brand pick-btn">${t('btn_choose')}</button>
      </div>`;
    // tap card → profile; tap 選ぶ → select directly
    div.querySelector('.pick-top').onclick = () => openProfile(p);
    div.querySelector('.pick-btn').onclick = (e) => { e.stopPropagation(); choosePhotographer(p); };
    wrap.appendChild(div);
  });
}

function openProfile(p) {
  const tags = (p.tags || []).filter(Boolean).map((tag) => `<span class="tag">${tag}</span>`).join('');
  const portfolio = (p.portfolio || []).map((src) => `<img src="${src}" loading="lazy" alt="">`).join('');
  $('sheetBody').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-head">
      <img class="sheet-avatar" src="${p.thumb}" alt="">
      <div style="flex:1">
        <div class="sheet-name">${p.name} <span class="verified">${icon('shield', 16)}</span></div>
        <div class="pick-rt">${icon('star', 14)}${p.rating} · ${t('sheet_shoots', { n: p.shots })}</div>
        <div class="pick-meta" style="margin-top:4px">${icon('pin', 14)}${t('pick_eta', { km: p.distance_km, eta: p.eta_min })}</div>
      </div>
    </div>
    <div class="pick-tags" style="margin:14px 0">${tags}</div>
    <p class="sheet-bio">${p.bio || ''}</p>
    <div class="section-head" style="margin:18px 0 10px"><h2>${t('portfolio_head')}</h2><span class="more">${(p.portfolio || []).length}${t('unit_photos')}</span></div>
    <div class="portfolio">${portfolio}</div>
    <div class="section-head" style="margin:22px 0 10px"><h2>${t('reviews_head')}</h2><span class="more">${icon('star', 13)}${p.rating}</span></div>
    <div class="reviews">${(p.reviews || []).map(reviewHtml).join('')}</div>
    <button class="btn brand" id="sheetSelect" style="margin-top:18px">${t('sheet_select', { name: p.name })} ${icon('arrow', 19)}</button>
    <button class="btn secondary" id="sheetClose2">${t('btn_close')}</button>`;
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
    toast(e.message === 'already matched' ? t('err_busy') : 'エラー: ' + e.message);
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
  $('aName').textContent = nm(p.name);
  $('aAvatar').textContent = (p.name || '?').charAt(0);
  $('aMeta').innerHTML = `${icon('star', 14)}${p.rating} · ${t('meta_from', { km: p.distance_km })}`;
  const mi = document.getElementById('markerInit');
  if (mi) mi.textContent = (p.name || 'P').charAt(0);
  // photos screen (prepared)
  $('pName').textContent = nm(p.name);
  $('pAvatar').textContent = (p.name || '?').charAt(0);
  $('pMeta').innerHTML = `${icon('star', 14)}${p.rating} · ${t('status_shooting')}`;
  $('toGallery').href = `/gallery?token=${galleryToken}`;
  notify('UberPHOTO', t('notif_otw', { name: p.name }));
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
      $('etaCount').textContent = t('eta_arrived');
      $('arriveTitle').textContent = t('arr_soon');
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
      $('matchedTitle').textContent = t('photos_arrived_title');
      $('shotStatus').textContent = t('photos_arrived_status', { n: msg.count });
      galleryToken = msg.gallery_token;
      $('toGallery').href = `/gallery?token=${galleryToken}`;
      $('toGallery').classList.remove('hidden');
      notify('UberPHOTO', t('notif_photos', { n: msg.count }));
    } else if (msg.type === 'session_complete') {
      show('step-matched');
      setStage(5);
      $('matchedTitle').textContent = t('complete_title');
      $('shotStatus').textContent = t('complete_status');
      notify('UberPHOTO', t('notif_complete'));
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
  $('chatName').textContent = p.name ? nm(p.name) : t('chat_default_name');
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
  if (card && !card.dataset.done) {
    $('rvWho').textContent = matchedName ? t('rv_who_named', { name: matchedName }) : t('rv_who');
    card.classList.remove('hidden');
  }
  const tip = $('tipCard');
  if (tip && !tip.dataset.done) {
    $('tipWho').textContent = matchedName ? t('tip_who_named', { name: matchedName }) : t('tip_who');
    tip.classList.remove('hidden');
  }
}

// ---------- tip ----------
let tipAmount = 0;
document.querySelectorAll('#tipOpts .tip-opt').forEach((b) => {
  b.addEventListener('click', () => {
    tipAmount = Number(b.dataset.v);
    document.querySelectorAll('#tipOpts .tip-opt').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    $('tipSubmit').disabled = false;
  });
});
$('tipSubmit').addEventListener('click', async () => {
  if (!tipAmount || !requestId) return;
  $('tipSubmit').disabled = true;
  try {
    await api(`/api/requests/${requestId}/tip`, 'POST', { amount: tipAmount });
    $('tipOpts').style.display = 'none';
    $('tipSubmit').style.display = 'none';
    $('tipThanksText').textContent = `${yen(tipAmount)} のチップをありがとうございました！`;
    $('tipThanks').classList.remove('hidden');
    $('tipCard').dataset.done = '1';
  } catch (e) {
    toast('送信エラー: ' + e.message);
    $('tipSubmit').disabled = false;
  }
});
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
loadAreas();
loadPlans();
handlePaymentReturn();

// re-render JS-built content when the language changes (state preserved)
document.addEventListener('langchange', () => {
  renderPlans();
  renderPeopleChips();
  renderSceneChips();
  relabelAreas();
  validate();
  // refresh spot picker labels for the current area without losing selection
  if (currentArea) {
    const sel = $('spotSelect');
    if (sel && sel.options[0]) sel.options[0].textContent = t('spot_select_default', { area: areaLabel(currentArea) });
    if (!selectedSpot) {
      $('mapCap').innerHTML = `${icon('map', 13)}<span>${escapeHtml(t('map_cap_area', { area: areaLabel(currentArea) }))}</span>`;
      $('spotHint').querySelector('span').textContent = t('spot_hint_default');
    }
  }
});

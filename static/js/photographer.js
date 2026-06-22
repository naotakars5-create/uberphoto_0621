let me = null;          // {id, name}
let online = false;
let sock = null;
let activeRequests = {}; // id -> request data
let session = null;      // {gallery_token, ...}
let uploadedTotal = 0;
let earnings = 0;
let sessionsDone = 0;

const $ = (id) => document.getElementById(id);

function show(step) {
  ['step-register', 'step-standby', 'step-session', 'step-profile'].forEach((s) => $(s).classList.add('hidden'));
  $(step).classList.remove('hidden');
  window.scrollTo(0, 0);
}

// resume saved identity
const saved = store('photographer');
if (saved && saved.id) {
  me = saved;
  enterStandby();
}

$('registerBtn').addEventListener('click', async () => {
  const name = $('pname').value.trim();
  if (!name) { toast('お名前を入力してください'); return; }
  try {
    const res = await api('/api/photographers', 'POST', {
      name, phone: $('pphone').value.trim(), area: $('pareaReg').value || null,
    });
    me = { id: res.id, name: res.name };
    store('photographer', me);
    enterStandby();
  } catch (e) { toast('エラー: ' + e.message); }
});

// populate the registration area dropdown (mirrors the profile editor list)
(async function fillRegisterAreas() {
  const sel = $('pareaReg');
  if (!sel) return;
  try {
    const list = await api('/api/areas');
    sel.innerHTML = '<option value="">未設定</option>';
    list.forEach((a) => {
      const o = document.createElement('option');
      o.value = a.name;
      o.textContent = `${a.emoji || ''} ${a.name}`.trim();
      sel.appendChild(o);
    });
  } catch (e) { sel.innerHTML = '<option value="">未設定</option>'; }
})();

function enterStandby() {
  show('step-standby');
  $('hello').textContent = `こんにちは、${me.name}さん`;
  requestNotifyPermission();
  loadAreaOptions();
  loadMyProfile();
}

// ---------- profile ----------
let myProfile = null;
let editTags = [];
let editPortfolio = [];
let areaOpts = [];      // [{id, name, emoji}] from /api/areas
const TAG_OPTS = ['ポートレート', '自然光', 'スナップ', '家族', 'カップル', '映え', '風景', '旅', '夜景', 'イルミ', 'プロフィール'];

// Populate the service-area dropdown from the shared area list (once).
async function loadAreaOptions() {
  if (areaOpts.length) return;
  try { areaOpts = await api('/api/areas'); } catch (e) { return; }
  const sel = $('epArea');
  sel.innerHTML = '<option value="">未設定</option>';
  areaOpts.forEach((a) => {
    const o = document.createElement('option');
    o.value = a.name;
    o.textContent = `${a.emoji || ''} ${a.name}`.trim();
    sel.appendChild(o);
  });
}

async function loadMyProfile() {
  try {
    myProfile = await api(`/api/photographers/${me.id}`);
  } catch (e) { return; }
  const statTxt = `${icon('star', 14)}${myProfile.rating ?? '—'} · ${myProfile.review_count}件のレビュー`;
  $('pcStat').innerHTML = statTxt;
  $('pcStatTop').innerHTML = statTxt;
  $('pcName').textContent = myProfile.name || me.name;
  $('hello').textContent = `こんにちは、${myProfile.name || me.name}さん`;
  $('pcBio').textContent = myProfile.bio || '自己紹介がまだありません。「プロフィールを編集」から追加しましょう。';
  if (myProfile.thumb) { $('pcAvatar').src = myProfile.thumb; $('aeAvatar').src = myProfile.thumb; }
  const pcArea = $('pcArea');
  if (myProfile.area) { pcArea.innerHTML = `${icon('pin', 13)} ${myProfile.area}`; pcArea.style.display = ''; }
  else { pcArea.style.display = 'none'; }
  $('pcTags').innerHTML = (myProfile.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  // received reviews
  const rv = $('pReviews');
  if (myProfile.reviews && myProfile.reviews.length) {
    rv.innerHTML = myProfile.reviews.map(reviewHtml).join('');
  } else {
    rv.innerHTML = '<p class="muted">まだレビューはありません。撮影が完了すると、お客様の評価がここに表示されます。</p>';
  }
}

function reviewHtml(r) {
  const stars = '★'.repeat(r.rating) + `<span class="dim">${'★'.repeat(5 - r.rating)}</span>`;
  return `
    <div class="review">
      <div class="review-head">
        <span class="review-author">${r.author}</span>
        <span class="review-stars">${stars}</span>
        <span class="review-ago">${r.ago || ''}</span>
      </div>
      <div class="review-text">${r.text}</div>
    </div>`;
}

async function enterProfile() {
  show('step-profile');
  editTags = [...(myProfile.tags || [])];
  editPortfolio = [...(myProfile.portfolio || [])];
  $('epName').value = myProfile.name || '';
  $('epBio').value = myProfile.bio || '';
  await loadAreaOptions();
  $('epArea').value = myProfile.area || '';
  if (myProfile.thumb) $('aeAvatar').src = myProfile.thumb;
  renderTagChips();
  renderPortfolio();
  hydrateIcons($('step-profile'));
}

function renderTagChips() {
  const wrap = $('epTags');
  wrap.innerHTML = '';
  TAG_OPTS.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt-chip' + (editTags.includes(t) ? ' on' : '');
    b.textContent = t;
    b.onclick = () => {
      if (editTags.includes(t)) { editTags = editTags.filter((x) => x !== t); b.classList.remove('on'); }
      else { editTags.push(t); b.classList.add('on'); }
    };
    wrap.appendChild(b);
  });
}

function renderPortfolio() {
  const grid = $('pfGrid');
  grid.innerHTML = '';
  editPortfolio.forEach((src, i) => {
    const item = document.createElement('div');
    item.className = 'pf-item';
    item.innerHTML = `<img src="${src}" alt=""><button type="button" class="pf-remove" aria-label="削除">×</button>`;
    item.querySelector('.pf-remove').onclick = () => { editPortfolio.splice(i, 1); renderPortfolio(); };
    grid.appendChild(item);
  });
  $('pfCount').textContent = `${editPortfolio.length}枚`;
}

// avatar upload (immediate)
document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'avatarInput' && e.target.files.length) {
    const fd = new FormData();
    fd.append('file', e.target.files[0]);
    try {
      const res = await fetch(`/api/photographers/${me.id}/avatar`, { method: 'POST', body: fd });
      const data = await res.json();
      $('aeAvatar').src = data.thumb;
      if (myProfile) myProfile.thumb = data.thumb;
      $('pcAvatar').src = data.thumb;
      toast('プロフィール写真を更新しました');
    } catch (err) { toast('アップロード失敗'); }
    e.target.value = '';
  }
  if (e.target && e.target.id === 'pfInput' && e.target.files.length) {
    const fd = new FormData();
    for (const f of e.target.files) fd.append('files', f);
    $('pfAddBtn').classList.add('busy');
    try {
      const res = await fetch(`/api/photographers/${me.id}/portfolio`, { method: 'POST', body: fd });
      const data = await res.json();
      editPortfolio = data.portfolio;
      renderPortfolio();
      toast(`${data.added.length}枚を追加しました`);
    } catch (err) { toast('アップロード失敗'); }
    $('pfAddBtn').classList.remove('busy');
    e.target.value = '';
  }
});

$('editProfileBtn').addEventListener('click', () => {
  if (!myProfile) { toast('プロフィールを読み込み中です'); return; }
  enterProfile();
});

$('profileBackBtn').addEventListener('click', () => { loadMyProfile(); show('step-standby'); });

$('saveProfileBtn').addEventListener('click', async () => {
  $('saveProfileBtn').disabled = true;
  $('saveProfileBtn').innerHTML = '保存中…';
  try {
    await api(`/api/photographers/${me.id}/profile`, 'POST', {
      name: $('epName').value.trim(),
      bio: $('epBio').value.trim(),
      area: $('epArea').value,
      specialty: editTags.join(','),
      portfolio: editPortfolio,
    });
    if ($('epName').value.trim()) { me.name = $('epName').value.trim(); store('photographer', me); }
    await loadMyProfile();
    toast('プロフィールを保存しました');
    show('step-standby');
  } catch (e) {
    toast('保存エラー: ' + e.message);
  }
  $('saveProfileBtn').disabled = false;
  $('saveProfileBtn').innerHTML = `${icon('check', 18)} 保存する`;
});

$('toggleBtn').addEventListener('click', async () => {
  online = !online;
  await api(`/api/photographers/${me.id}/status`, 'POST', { status: online ? 'online' : 'offline' });
  if (online) {
    $('statusText').textContent = '🟢 待機中';
    $('toggleBtn').textContent = '待機をオフにする';
    $('toggleBtn').classList.add('secondary');
    if (sessionsDone === 0) $('earnSub').textContent = '待機中・リクエストを待っています';
    // share location so customers see real distance
    getPosition().then((pos) => {
      if (pos) api(`/api/photographers/${me.id}/location`, 'POST', pos).catch(() => {});
    });
    connect();
  } else {
    $('statusText').textContent = 'オフライン';
    $('toggleBtn').textContent = '待機をオンにする';
    $('toggleBtn').classList.remove('secondary');
    if (sock) sock.close();
    renderRequests();
  }
});

function connect() {
  sock = openSocket(`/ws/photographer/${me.id}`, (msg) => {
    if (msg.type === 'assigned') {
      // a customer chose you — go straight into the shoot
      session = {
        request_id: msg.request_id,
        gallery_token: msg.gallery_token,
        customer: msg.customer,
        plan: msg.plan,
        price: msg.price,
        location: msg.location,
        people: msg.people,
        scene: msg.scene,
        note: msg.note,
      };
      activeRequests = {};
      enterSession();
      notify('撮影リクエスト', `${msg.customer}さんに選ばれました！`);
    } else if (msg.type === 'message') {
      if (session && msg.request_id === session.request_id) {
        addPMsg(msg.sender, msg.text, msg.created_at);
        if (msg.sender === 'customer') notify(`${session.customer}さん`, msg.text);
      }
    } else if (msg.type === 'tip') {
      earnings += msg.amount;
      $('todayEarn').textContent = yen(earnings);
      toast(`💛 チップ ${yen(msg.amount)} を受け取りました！`);
      notify('チップを受け取りました', `お客様から ${yen(msg.amount)} のチップ`);
    } else if (msg.type === 'cancelled') {
      // customer cancelled or switched photographer
      if (session) {
        session = null;
        toast('お客様が依頼をキャンセルしました');
        enterStandby();
        $('statusText').textContent = '🟢 待機中';
        $('toggleBtn').textContent = '待機をオフにする';
        $('toggleBtn').classList.add('secondary');
        renderRequests();
      }
    }
  });
}

function renderRequests() {
  const wrap = $('requests');
  if (!online) {
    wrap.innerHTML = '<p class="muted">オフラインです。待機をオンにすると、お客様に選ばれるのを待てます。</p>';
    return;
  }
  wrap.innerHTML = `
    <div class="card center" style="padding:28px 18px">
      <div class="near" style="margin-bottom:10px"><span class="dot"></span>オンライン</div>
      <p class="muted" style="margin:0">お客様があなたを選ぶと、ここで撮影が始まります。</p>
    </div>`;
}

function enterSession() {
  show('step-session');
  $('sessAvatar').textContent = (session.customer || '?').charAt(0);
  $('sessCustomer').textContent = session.customer + ' さん';
  $('sessPlan').textContent = session.plan;
  // shoot brief
  $('briefLoc').textContent = session.location || '指定なし';
  const peopleRow = $('briefPeopleRow');
  if (session.people) { $('briefPeople').textContent = session.people; peopleRow.classList.remove('hidden'); }
  else { peopleRow.classList.add('hidden'); }
  const sceneRow = $('briefSceneRow');
  if (session.scene) { $('briefScene').textContent = (session.scene || '').split(',').join('・'); sceneRow.classList.remove('hidden'); }
  else { sceneRow.classList.add('hidden'); }
  const noteRow = $('briefNoteRow');
  if (session.note) { $('briefNote').textContent = session.note; noteRow.classList.remove('hidden'); }
  else { noteRow.classList.add('hidden'); }
  hydrateIcons($('sessBrief'));
  uploadedTotal = 0;
  $('uploadCount').textContent = '';
  // chat
  pChat = [];
  renderPChat();
  loadPChat();
}

// ---------- chat with the customer ----------
let pChat = [];

function renderPChat() {
  const log = $('pChatLog');
  log.innerHTML = pChat.length
    ? pChat.map((m) => chatBubble(m.text, m.sender === 'photographer', m.ts)).join('')
    : '<p class="chat-empty muted">お客様にメッセージを送れます。<br>「○分で着きます」など合流の連絡に。</p>';
}

function scrollPChat() { const l = $('pChatLog'); l.scrollTop = l.scrollHeight; }

function addPMsg(sender, text, ts) {
  pChat.push({ sender, text, ts: ts || new Date().toISOString() });
  renderPChat();
  scrollPChat();
}

async function loadPChat() {
  if (!session) return;
  try {
    const msgs = await api(`/api/requests/${session.request_id}/messages`);
    pChat = msgs.map((m) => ({ sender: m.sender, text: m.text, ts: m.created_at }));
  } catch (e) { /* keep what we have */ }
  renderPChat();
  scrollPChat();
}

$('pChatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!session) return;
  const v = $('pChatText').value.trim();
  if (!v) return;
  $('pChatText').value = '';
  addPMsg('photographer', v, new Date().toISOString());
  try {
    await api(`/api/requests/${session.request_id}/messages`, 'POST', { sender: 'photographer', text: v });
  } catch (err) { toast('送信できませんでした'); }
});

$('uploadBtn').addEventListener('click', async () => {
  const files = $('fileInput').files;
  if (!files.length) { toast('写真を選択してください'); return; }
  $('uploadBtn').disabled = true;
  $('uploadBtn').innerHTML = 'アップロード中…';
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  try {
    const res = await fetch(`/api/sessions/${session.gallery_token}/photos`, { method: 'POST', body: fd });
    const data = await res.json();
    uploadedTotal += data.uploaded;
    $('uploadCount').textContent = `✅ 合計 ${uploadedTotal} 枚 アップロード済み`;
    $('fileInput').value = '';
    toast(`${data.uploaded}枚を共有しました`);
  } catch (e) {
    toast('アップロード失敗: ' + e.message);
  }
  $('uploadBtn').disabled = false;
  $('uploadBtn').innerHTML = `${icon('zap', 18)} 写真をアップロード`;
});

$('completeBtn').addEventListener('click', async () => {
  try {
    const earned = Math.round((session.price || 0) * 0.75);
    await api(`/api/sessions/${session.gallery_token}/complete`, 'POST', {});
    earnings += earned;
    sessionsDone += 1;
    toast(`お疲れさまでした！+${yen(earned)}`);
    session = null;
    online = true;
    enterStandby();
    $('todayEarn').textContent = yen(earnings);
    $('earnSub').textContent = `本日 ${sessionsDone}件 完了 · また依頼が届きます`;
    $('statusText').textContent = '🟢 待機中';
    $('toggleBtn').textContent = '待機をオフにする';
    $('toggleBtn').classList.add('secondary');
    if (!sock) connect();
    renderRequests();
  } catch (e) { toast('エラー: ' + e.message); }
});

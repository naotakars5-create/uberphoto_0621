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
  ['step-register', 'step-standby', 'step-session'].forEach((s) => $(s).classList.add('hidden'));
  $(step).classList.remove('hidden');
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
    const res = await api('/api/photographers', 'POST', { name, phone: $('pphone').value.trim() });
    me = { id: res.id, name: res.name };
    store('photographer', me);
    enterStandby();
  } catch (e) { toast('エラー: ' + e.message); }
});

function enterStandby() {
  show('step-standby');
  $('hello').textContent = `こんにちは、${me.name}さん`;
  requestNotifyPermission();
}

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
        gallery_token: msg.gallery_token,
        customer: msg.customer,
        plan: msg.plan,
        price: msg.price,
      };
      activeRequests = {};
      enterSession();
      notify('撮影リクエスト', `${msg.customer}さんに選ばれました！`);
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
  uploadedTotal = 0;
  $('uploadCount').textContent = '';
}

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

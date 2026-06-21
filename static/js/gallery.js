const $ = (id) => document.getElementById(id);
const token = new URLSearchParams(location.search).get('token');

let currentImg = null;
let galleryPhotos = [];

// favorites persist per gallery token
const FAV_KEY = `fav_${token}`;
let favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
function saveFavs() { localStorage.setItem(FAV_KEY, JSON.stringify([...favorites])); }
function updateFavBar() {
  const btn = $('downloadFavBtn');
  const n = favorites.size;
  btn.classList.toggle('hidden', n === 0);
  $('favCount').textContent = `お気に入り${n}枚を保存`;
}

function show(view) {
  $('gallery-view').classList.toggle('hidden', view !== 'gallery');
  $('editor-view').classList.toggle('hidden', view !== 'editor');
}

async function load() {
  if (!token) { $('title').textContent = 'リンクが無効です'; return; }
  try {
    const data = await api(`/api/gallery/${token}`);
    galleryPhotos = data.photos;
    $('title').textContent = `${data.customer_name}さんの写真`;
    $('meta').textContent = `${data.plan} ・ ${data.photos.length}枚`;
    const grid = $('grid');
    const hasPhotos = data.photos.length > 0;
    $('empty').classList.toggle('hidden', hasPhotos);
    $('actions').style.display = hasPhotos ? 'grid' : 'none';
    grid.innerHTML = '';
    data.photos.forEach((src) => {
      const fig = document.createElement('div');
      fig.className = 'gphoto';
      const faved = favorites.has(src);
      fig.innerHTML = `<img src="${src}" loading="lazy" alt="">` +
        `<button class="fav-btn${faved ? ' on' : ''}" aria-label="お気に入り">${icon('heart', 18)}</button>` +
        `<span class="ed">${icon('edit', 16)}</span>`;
      fig.querySelector('img').onclick = () => openEditor(src);
      fig.querySelector('.ed').onclick = () => openEditor(src);
      const fav = fig.querySelector('.fav-btn');
      fav.onclick = (e) => {
        e.stopPropagation();
        if (favorites.has(src)) { favorites.delete(src); fav.classList.remove('on'); }
        else { favorites.add(src); fav.classList.add('on'); }
        saveFavs();
        updateFavBar();
      };
      grid.appendChild(fig);
    });
    updateFavBar();
  } catch (e) {
    $('title').textContent = '写真が見つかりません';
  }
}

async function downloadList(list, label) {
  if (!list.length) return;
  toast(`${list.length}枚を保存中…`);
  for (let i = 0; i < list.length; i++) {
    try {
      const res = await fetch(list[i]);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `uberphoto_${label}_${i + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {}
  }
}

$('downloadFavBtn').addEventListener('click', () => {
  const list = galleryPhotos.filter((s) => favorites.has(s));
  downloadList(list, 'fav');
});

$('refreshBtn').addEventListener('click', load);

// download all
$('downloadAllBtn').addEventListener('click', () => downloadList(galleryPhotos, 'all'));

// share gallery link
$('shareBtn').addEventListener('click', async () => {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: 'UberPHOTO', text: '私の写真です📷', url }); } catch (e) {}
  } else {
    try { await navigator.clipboard.writeText(url); toast('リンクをコピーしました'); }
    catch (e) { toast(url); }
  }
});

// ---------- editor ----------
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const controls = ['brightness', 'contrast', 'saturate', 'warmth'];

function openEditor(src) {
  show('editor');
  controls.forEach((c) => { $(c).value = c === 'warmth' ? 0 : 100; });
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    currentImg = img;
    const maxW = 1000;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    render();
  };
  img.src = src;
}

function render() {
  if (!currentImg) return;
  const b = $('brightness').value;
  const c = $('contrast').value;
  const s = $('saturate').value;
  const w = parseInt($('warmth').value, 10);
  ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  if (w !== 0) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = w > 0 ? `rgba(255,150,40,${w / 250})` : `rgba(40,120,255,${-w / 250})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
}

controls.forEach((c) => $(c).addEventListener('input', render));

$('downloadBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `uberphoto_${Date.now()}.jpg`;
  a.href = canvas.toDataURL('image/jpeg', 0.92);
  a.click();
  toast('保存しました');
});

$('backBtn').addEventListener('click', () => show('gallery'));

load();
const poll = setInterval(load, 6000);

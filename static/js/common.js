// Shared helpers for UberPHOTO PWA
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).detail || msg; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function wsUrl(path) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${path}`;
}

function openSocket(path, onMessage) {
  let ws;
  let alive = true;
  function connect() {
    ws = new WebSocket(wsUrl(path));
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch (err) {}
    };
    ws.onclose = () => { if (alive) setTimeout(connect, 1500); };
    // keepalive ping
    ws.onopen = () => {
      const ping = setInterval(() => {
        if (ws.readyState === 1) ws.send('ping'); else clearInterval(ping);
      }, 25000);
    };
  }
  connect();
  return { close: () => { alive = false; if (ws) ws.close(); } };
}

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function yen(n) { return '¥' + n.toLocaleString('ja-JP'); }

function store(key, val) {
  if (val === undefined) {
    const v = localStorage.getItem(key);
    try { return JSON.parse(v); } catch (e) { return v; }
  }
  localStorage.setItem(key, JSON.stringify(val));
}

// register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  });
}

// Best-effort geolocation; resolves null if unavailable or denied.
function getPosition(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

// Escape user-generated text before inserting via innerHTML.
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Format a timestamp (server "YYYY-MM-DD HH:MM:SS" in UTC, or ISO) to local HH:MM.
function fmtTime(ts) {
  if (!ts) return '';
  const s = String(ts);
  const d = (s.includes('T') || s.endsWith('Z')) ? new Date(s) : new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// One chat bubble. `mine` = sent by the viewer (right-aligned, brand colour).
function chatBubble(text, mine, ts) {
  const t = fmtTime(ts);
  return `<div class="chat-msg ${mine ? 'me' : 'them'}">` +
    `<div class="bubble">${escapeHtml(text)}</div>` +
    (t ? `<span class="chat-time">${t}</span>` : '') +
    `</div>`;
}

function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

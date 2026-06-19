const $ = (id) => document.getElementById(id);

const planShort = (p) => (p || '').split(' ')[0];
const statusLabel = { waiting: 'マッチ待ち', matched: 'マッチ済', shooting: '撮影中', done: '完了', cancelled: 'キャンセル' };

async function refresh() {
  try {
    const s = await api('/api/stats');
    $('s-online').textContent = s.online;
    $('s-busy').textContent = s.busy;
    $('s-waiting').textContent = s.waiting;
    $('s-rate').textContent = s.match_rate + '%';
    const tb = $('recent');
    tb.innerHTML = '';
    s.recent.forEach((r) => {
      const tr = document.createElement('tr');
      const cls = ['waiting', 'matched', 'shooting'].includes(r.status) ? r.status : (r.status === 'done' ? 'done' : 'waiting');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.customer_name}</td>
        <td>${planShort(r.plan)}</td>
        <td>${r.photographer_name || '—'}</td>
        <td><span class="pill ${cls}">${statusLabel[r.status] || r.status}</span></td>`;
      tb.appendChild(tr);
    });
  } catch (e) { /* ignore */ }
}

refresh();
// realtime updates + periodic safety refresh
openSocket('/ws/operator', (msg) => { if (msg.type === 'stats_changed') refresh(); });
setInterval(refresh, 5000);

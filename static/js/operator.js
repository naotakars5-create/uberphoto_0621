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

    // area demand bars (relative to the busiest area)
    const ba = $('byArea');
    const areas = s.by_area || [];
    if (!areas.length) {
      ba.innerHTML = '<p class="muted">いまアクティブな依頼はありません。</p>';
    } else {
      const max = Math.max(...areas.map((a) => a.active), 1);
      ba.innerHTML = areas.map((a) => `
        <div class="ad-row">
          <div class="ad-name">${escapeHtml(a.name)}</div>
          <div class="ad-track"><div class="ad-fill" style="width:${Math.round(a.active / max * 100)}%"></div></div>
          <div class="ad-num">${a.active}件${a.waiting ? ` <span class="ad-wait">待${a.waiting}</span>` : ''}</div>
        </div>`).join('');
    }

    const tb = $('recent');
    tb.innerHTML = '';
    s.recent.forEach((r) => {
      const tr = document.createElement('tr');
      const cls = ['waiting', 'matched', 'shooting'].includes(r.status) ? r.status : (r.status === 'done' ? 'done' : 'waiting');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${escapeHtml(r.customer_name)}</td>
        <td>${escapeHtml(r.location || '—')}</td>
        <td>${planShort(r.plan)}</td>
        <td>${r.photographer_name ? escapeHtml(r.photographer_name) : '—'}</td>
        <td><span class="pill ${cls}">${statusLabel[r.status] || r.status}</span></td>`;
      tb.appendChild(tr);
    });
  } catch (e) { /* ignore */ }
}

refresh();
// realtime updates + periodic safety refresh
openSocket('/ws/operator', (msg) => { if (msg.type === 'stats_changed') refresh(); });
setInterval(refresh, 5000);

(() => {
  const labels = {
    source: '来源',
    platform: '平台',
    verification_status: '核验状态',
    brand: '品牌',
    cause: '事故原因',
    road_type: '道路类型',
    province: '省/地区',
    city: '城市'
  };
  const pretty = value => String(value || 'Unknown').replaceAll('_', ' ');
  const sourceOf = row => row.publisher_name || row.source_name || row.platform || 'Unknown';
  const valueOf = (row, key) => key === 'source' ? sourceOf(row) : (row[key] || 'Unknown');
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .filters{background:#fff;border:1px solid #dce3ea;border-radius:12px;padding:1rem 1.25rem;margin:1rem 0;display:grid;gap:.75rem}
      .filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem}
      .filters label{display:grid;gap:.25rem;color:#44515e;font-size:.85rem}
      .filters input,.filters select,.filters button{font:inherit;border:1px solid #c8d2dc;border-radius:7px;background:#fff;padding:.5rem .6rem;color:#17202a}
      .filters button{cursor:pointer;background:#eef4f8}
      .filter-summary{color:#637385;font-size:.9rem}
      .no-results{padding:1rem;background:#fff;border:1px dashed #c8d2dc;border-radius:12px;color:#637385}
    `;
    document.head.append(style);
  }

  function makeControl(key, values) {
    const label = document.createElement('label');
    label.innerHTML = `<span>${esc(labels[key])}</span>`;
    const select = document.createElement('select');
    select.dataset.filter = key;
    select.innerHTML = `<option value="">全部</option>${values.map(value => `<option value="${esc(value)}">${esc(pretty(value))}</option>`).join('')}`;
    label.append(select);
    return label;
  }

  async function init() {
    addStyles();
    const main = document.querySelector('main');
    if (!main) return;
    const cards = [...main.querySelectorAll('article')];
    let reports = [];
    try {
      const response = await fetch('data/reports.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      reports = await response.json();
    } catch (error) {
      console.warn('Filter metadata unavailable:', error);
      reports = cards.map(() => ({}));
    }

    const panel = document.createElement('section');
    panel.className = 'filters';
    panel.setAttribute('aria-label', '筛选公开报道');
    panel.innerHTML = '<strong>筛选公开报道</strong><div class="filter-grid"></div><div class="filter-actions"><button type="button" data-reset>重置筛选</button> <span class="filter-summary" aria-live="polite"></span></div>';
    const grid = panel.querySelector('.filter-grid');
    const queryLabel = document.createElement('label');
    queryLabel.innerHTML = '<span>关键词</span><input type="search" placeholder="标题、摘要或来源" data-filter="q">';
    grid.append(queryLabel);
    for (const key of Object.keys(labels)) {
      const values = [...new Set(reports.map(row => valueOf(row, key)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
      grid.append(makeControl(key, values));
    }
    main.before(panel);
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = '没有符合当前筛选条件的报道。';
    empty.hidden = true;
    main.after(empty);

    cards.forEach((card, index) => { card.dataset.reportIndex = String(index); });
    const controls = [...panel.querySelectorAll('[data-filter]')];
    const summary = panel.querySelector('.filter-summary');
    const apply = () => {
      const selected = Object.fromEntries(controls.map(control => [control.dataset.filter, control.value.trim().toLowerCase()]));
      let visible = 0;
      cards.forEach((card, index) => {
        const row = reports[index] || {};
        const haystack = [row.title, row.content, row.english_description, sourceOf(row)].filter(Boolean).join(' ').toLowerCase();
        const matches = (!selected.q || haystack.includes(selected.q)) && Object.keys(labels).every(key => !selected[key] || String(valueOf(row, key)).toLowerCase() === selected[key]);
        card.hidden = !matches;
        if (matches) visible++;
      });
      empty.hidden = visible !== 0;
      summary.textContent = `显示 ${visible} / ${cards.length} 条`;
    };
    controls.forEach(control => control.addEventListener('input', apply));
    panel.querySelector('[data-reset]').addEventListener('click', () => { controls.forEach(control => { control.value = ''; }); apply(); });
    apply();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

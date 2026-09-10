(() => {
  const labels = {
    source: 'Source',
    platform: 'Platform',
    verification_status: 'Verification status',
    brand: 'Brand',
    cause: 'Cause',
    road_type: 'Road type',
    province: 'Province/region',
    city: 'City'
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
    select.innerHTML = `<option value="">All</option>${values.map(value => `<option value="${esc(value)}">${esc(pretty(value))}</option>`).join('')}`;
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
    panel.setAttribute('aria-label', 'Filter public reports');
    panel.innerHTML = '<strong>Filter public reports</strong><div class="filter-grid"></div><div class="filter-actions"><button type="button" data-reset>Reset filters</button> <span class="filter-summary" aria-live="polite"></span></div>';
    const grid = panel.querySelector('.filter-grid');
    const queryLabel = document.createElement('label');
    queryLabel.innerHTML = '<span>Keyword</span><input type="search" placeholder="Title, description, or source" data-filter="q">';
    grid.append(queryLabel);
    for (const key of Object.keys(labels)) {
      const values = [...new Set(reports.map(row => valueOf(row, key)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
      grid.append(makeControl(key, values));
    }
    main.before(panel);
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = 'No reports match the current filters.';
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
        const haystack = [row.title_en, row.description_en, row.title, row.content, row.english_description, sourceOf(row)].filter(Boolean).join(' ').toLowerCase();
        const matches = (!selected.q || haystack.includes(selected.q)) && Object.keys(labels).every(key => !selected[key] || String(valueOf(row, key)).toLowerCase() === selected[key]);
        card.hidden = !matches;
        if (matches) visible++;
      });
      empty.hidden = visible !== 0;
      summary.textContent = `Showing ${visible} / ${cards.length}`;
    };
    controls.forEach(control => control.addEventListener('input', apply));
    panel.querySelector('[data-reset]').addEventListener('click', () => { controls.forEach(control => { control.value = ''; }); apply(); });
    apply();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

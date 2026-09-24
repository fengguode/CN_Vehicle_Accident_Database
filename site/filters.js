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
      .sort-control{display:grid;gap:.25rem;color:#44515e;font-size:.85rem;max-width:320px}
      .filters button{cursor:pointer;background:#eef4f8}
      .filter-summary{color:#637385;font-size:.9rem}
      .no-results{padding:1rem;background:#fff;border:1px dashed #c8d2dc;border-radius:12px;color:#637385}
      .language-toggle{font-size:1rem;font-weight:600;border:1px solid #0b63ce;border-radius:8px;background:#e8f2ff;color:#064f9d;padding:.55rem .85rem;cursor:pointer;margin:.25rem 0 .75rem}
      .github-login,.github-logout{display:inline-block;margin:0 0 .75rem .5rem;border:1px solid #24292f;border-radius:8px;background:#24292f;color:#fff;padding:.55rem .85rem;text-decoration:none;font:inherit;font-weight:600;cursor:pointer}
      .vote-tools{display:flex;gap:.35rem;align-items:center;flex-wrap:wrap}.vote-tools button{cursor:pointer}.vote-tools button.selected{background:#d5ead9;border-color:#5c996b}.vote-tools [data-vote-status]{color:#44515e;font-size:.9rem}
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
    const header = document.querySelector('header');
    const languageToggle = document.querySelector('#language-toggle') || document.createElement('button');
    languageToggle.type = 'button';
    languageToggle.id = 'language-toggle';
    languageToggle.className = 'language-toggle';
    languageToggle.dataset.lang = 'en';
    languageToggle.textContent = '中文 / Chinese';
    if (!languageToggle.parentElement && header) header.insertBefore(languageToggle, header.querySelector('p:last-child'));
    const setLanguage = language => {
      const chinese = language === 'zh';
      cards.forEach(card => {
        const title = card.querySelector('h2');
        const summary = card.querySelector('.summary');
        const titleText = card.getAttribute(chinese ? 'data-title-zh' : 'data-title-en');
        const summaryText = card.getAttribute(chinese ? 'data-summary-zh' : 'data-summary-en');
        if (title && titleText != null) title.textContent = titleText;
        if (summary && summaryText != null) summary.textContent = summaryText;
        if (summary) summary.classList.toggle('english', !chinese);
      });
      languageToggle.dataset.lang = language;
      languageToggle.textContent = chinese ? 'English / 英文' : '中文 / Chinese';
      document.documentElement.lang = chinese ? 'zh-CN' : 'en';
    };
    languageToggle.addEventListener('click', () => setLanguage(languageToggle.dataset.lang === 'en' ? 'zh' : 'en'));
    setLanguage('en');
    const api = window.ADAS_VOTE_API;
    const account = document.querySelector('#vote-account');
    const tokenKey = 'adas-github-vote-session';
    const callbackToken = new URLSearchParams(location.hash.slice(1)).get('session');
    if (callbackToken && /^[a-f0-9]{64}$/.test(callbackToken)) {
      sessionStorage.setItem(tokenKey, callbackToken);
      history.replaceState(null, '', location.pathname + location.search);
    }
    let token = sessionStorage.getItem(tokenKey);
    let votes = new Map();
    let totals = new Map();
    const login = document.createElement('a');
    login.className = 'github-login';
    login.textContent = 'Log in with GitHub to vote';
    const logout = document.createElement('button');
    logout.type = 'button'; logout.className = 'github-logout'; logout.textContent = 'Log out';
    const renderVote = card => {
      const current = votes.get(card.dataset.fingerprint);
      card.querySelectorAll('[data-vote]').forEach(button => {
        button.disabled = !token;
        button.classList.toggle('selected', current === button.dataset.vote);
        button.setAttribute('aria-pressed', String(current === button.dataset.vote));
      });
      const revoke = card.querySelector('[data-revoke]');
      if (revoke) { revoke.hidden = !current; revoke.disabled = !token || !current; }
      const status = card.querySelector('[data-vote-status]');
      const total = totals.get(card.dataset.fingerprint) || { relevant: 0, not_relevant: 0 };
      if (status) status.textContent = `${current ? `Your vote: ${current === 'relevant' ? 'Relevant' : 'Not relevant'} · ` : ''}${total.relevant} relevant · ${total.not_relevant} not relevant`;
    };
    const renderAll = () => cards.forEach(renderVote);
    async function refreshTotals() {
      const response = await fetch(api + '/api/votes/summary');
      if (!response.ok) throw new Error(`Vote totals unavailable (${response.status}).`);
      const body = await response.json();
      totals = new Map(body.totals.map(row => [row.fingerprint, row]));
      renderAll();
    }
    async function requestVote(path, options = {}) {
      const response = await fetch(api + path, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) } });
      if (response.status === 401) { token = null; sessionStorage.removeItem(tokenKey); renderAccount(); renderAll(); throw new Error('Session expired. Log in again.'); }
      if (!response.ok) throw new Error(`Vote service error (${response.status}).`);
      return response.json();
    }
    function renderAccount(loginName) {
      if (!api) { if (account) account.textContent = 'Voting is being configured.'; return; }
      login.href = api + '/auth/github/start';
      if (account) account.textContent = token ? `Signed in${loginName ? ` as ${loginName}` : ''}. Votes are saved immediately.` : 'Sign in with GitHub to vote.';
      login.hidden = Boolean(token);
      logout.hidden = !token;
    }
    if (api && header) {
      header.insertBefore(login, account);
      header.insertBefore(logout, account);
      logout.addEventListener('click', async () => {
        try { await requestVote('/auth/logout', { method: 'POST' }); } catch { /* Clear this browser session even if the service is unreachable. */ }
        token = null; votes = new Map(); sessionStorage.removeItem(tokenKey); renderAccount(); renderAll();
      });
      cards.forEach(card => {
        card.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await requestVote('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fingerprint: card.dataset.fingerprint, vote: button.dataset.vote }) });
            votes.set(card.dataset.fingerprint, button.dataset.vote);
            renderVote(card);
            try { await refreshTotals(); } catch { /* The vote was saved even if the public count is temporarily unavailable. */ }
          } catch (error) { card.querySelector('[data-vote-status]').textContent = error.message; button.disabled = !token; }
        }));
        card.querySelector('[data-revoke]')?.addEventListener('click', async () => {
          try {
            await requestVote('/api/vote/' + card.dataset.fingerprint, { method: 'DELETE' });
            votes.delete(card.dataset.fingerprint);
            renderVote(card);
            try { await refreshTotals(); } catch { /* Revocation succeeded even if the public count is temporarily unavailable. */ }
          } catch (error) { card.querySelector('[data-vote-status]').textContent = error.message; }
        });
      });
      if (token) {
        try {
          const [identity, mine] = await Promise.all([requestVote('/auth/me'), requestVote('/api/my-votes')]);
          if (!identity.authenticated) throw new Error('Session expired. Log in again.');
          votes = new Map(mine.votes.map(row => [row.fingerprint, row.vote]));
          renderAccount(identity.login);
        } catch { token = null; sessionStorage.removeItem(tokenKey); renderAccount(); }
      }
      try { await refreshTotals(); } catch { /* Vote controls remain usable while public totals are unavailable. */ }
    }
    renderAccount();
    renderAll();
    let reports = [];
    let svmScores = new Map();
    try {
      const response = await fetch('data/reports.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      reports = await response.json();
    } catch (error) {
      console.warn('Filter metadata unavailable:', error);
      reports = cards.map(() => ({}));
    }
    try {
      const response = await fetch('data/svm-scores.json', { cache: 'no-store' });
      if (response.ok) svmScores = new Map((await response.json()).map(item => [item.fingerprint, Number(item.score)]));
    } catch (error) { console.warn('SVM relevance scores unavailable:', error); }

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
    const sortControl = document.createElement('label');
    sortControl.className = 'sort-control';
    sortControl.innerHTML = '<span>Sort by</span><select data-sort><option value="date">Date (newest first)</option><option value="relevance">Relevance (highest first)</option></select>';
    grid.append(sortControl);
    main.before(panel);
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = 'No reports match the current filters.';
    empty.hidden = true;
    main.after(empty);

    cards.forEach((card, index) => { card.dataset.reportIndex = String(index); });
    const controls = [...panel.querySelectorAll('[data-filter]')];
    const sortSelect = panel.querySelector('[data-sort]');
    const summary = panel.querySelector('.filter-summary');
    const apply = () => {
      const selected = Object.fromEntries(controls.map(control => [control.dataset.filter, control.value.trim().toLowerCase()]));
      let visible = 0;
      const rowFor = card => reports[Number(card.dataset.reportIndex)] || {};
      const dateFor = row => Date.parse(row.event_date || row.published_at || row.collected_at || '') || 0;
      const scoreFor = row => {
        const score = svmScores.get(row.fingerprint) ?? row.relevance_score;
        return Number.isFinite(Number(score)) ? Number(score) : Number.NEGATIVE_INFINITY;
      };
      const matchesFilters = card => {
        const row = rowFor(card);
        const haystack = [row.title_en, row.description_en, row.title, row.content, row.english_description, sourceOf(row)].filter(Boolean).join(' ').toLowerCase();
        return (!selected.q || haystack.includes(selected.q)) && Object.keys(labels).every(key => !selected[key] || String(valueOf(row, key)).toLowerCase() === selected[key]);
      };
      const ordered = [...cards].sort((a, b) => {
        const rowA = rowFor(a); const rowB = rowFor(b);
        if (sortSelect.value === 'relevance') {
          const scoreA = scoreFor(rowA); const scoreB = scoreFor(rowB);
          if (scoreA !== scoreB) {
            if (scoreA === Number.NEGATIVE_INFINITY) return 1;
            if (scoreB === Number.NEGATIVE_INFINITY) return -1;
            return scoreB - scoreA;
          }
        }
        return dateFor(rowB) - dateFor(rowA);
      });
      main.append(...ordered);
      ordered.forEach(card => {
        const matches = matchesFilters(card);
        card.hidden = !matches;
        if (matches) visible++;
      });
      empty.hidden = visible !== 0;
      summary.textContent = `Showing ${visible} / ${cards.length}`;
    };
    controls.forEach(control => control.addEventListener('input', apply));
    sortSelect.addEventListener('change', apply);
    panel.querySelector('[data-reset]').addEventListener('click', () => { controls.forEach(control => { control.value = ''; }); apply(); });
    apply();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// /assets/js/university-search.js

(function(){
  // Utilities + state
  const norm = s => (s||'').toString().trim().toLowerCase();

  const el = {
    input: document.getElementById('universitySearch'),
    apply: document.getElementById('searchApplyBtn'),
    suggest: document.getElementById('searchSuggest'),
    state: document.getElementById('stateFilter'),
    type: document.getElementById('typeFilter'),
    level: document.getElementById('levelFilter'),
    sort: document.getElementById('sortBy'),
    reset: document.getElementById('resetBtn'),
    applyFilters: document.getElementById('filterApplyBtn'),
    select: document.getElementById('universitySelect'),
    grid: document.getElementById('universityGrid'),
    empty: document.getElementById('emptyState'),
    prev: document.getElementById('prevPage'),
    next: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    pageSize: document.getElementById('pageSize'),
    selectedList: document.getElementById('selectedList'),
    resultMeta: document.getElementById('resultMeta'),
  };

  if (!el.grid) return;

  const state = {
    q: '',
    byState: '',
    byType: '',
    byLevel: '',
    sort: 'name_asc',
    page: 1,
    pageSize: 40,
    filteredIds: [],
  };

  function renderResultMeta(filtered, total){
    if (el.resultMeta) el.resultMeta.textContent = `Showing ${filtered} of ${total}`;
  }

  function applyFiltersAndSort(){
    if (!Array.isArray(window.universities)) return;
    const q = norm(state.q);
    let rows = window.universities.slice();

    if (q) rows = rows.filter(u => norm(u.name).includes(q));
    if (state.byState) rows = rows.filter(u => (u.state || '') === state.byState);
    if (state.byType)  rows = rows.filter(u => (u.type  || '') === state.byType);
    if (state.byLevel) rows = rows.filter(u => (u.level || '') === state.byLevel);

    if (state.sort === 'name_asc') {
      rows.sort((a,b)=> a.name.localeCompare(b.name));
    } else if (state.sort === 'state_asc') {
      rows.sort((a,b)=> (a.state||'').localeCompare(b.state||'') || a.name.localeCompare(b.name));
    }

    state.filteredIds = rows.map(u => u.unitid);
    state.page = 1;
    renderResultMeta(state.filteredIds.length, window.universities.length);
    renderPage();
  }

  function renderPage(){
    const { page, pageSize, filteredIds } = state;
    const start = (page - 1) * pageSize;
    const end   = start + pageSize;
    const ids = filteredIds.slice(start, end);

    el.grid.innerHTML = '';

    if (!ids.length) {
      if (el.empty) el.empty.style.display = 'block';
      el.grid.style.display = 'none';
    } else {
      if (el.empty) el.empty.style.display = 'none';
      el.grid.style.display = 'grid';

      ids.forEach(id => {
        const u = window.universities.find(x => x.unitid === id);
        if (!u) return;

        const card = document.createElement('div');
        card.className = 'university-card';
        card.role = 'listitem';
        card.innerHTML = `
          <div class="university-header">
            <div class="university-logo">${(u.name||'U').slice(0,1)}</div>
            <div>
              <div class="university-name">${u.name}</div>
              <div class="university-location">${u.state || ''}</div>
              ${u.level ? `<span class="university-pill">${u.level}</span>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:.5rem; align-items:center; margin-top:.5rem;">
            <button type="button" class="apply-btn add-btn">Add</button>
          </div>
        `;
        card.querySelector('.add-btn').addEventListener('click', () => {
          selectUniversity(u);
          animateToSelected(card, u.name);
        });
        el.grid.appendChild(card);
      });
    }

    const totalPages = Math.max(1, Math.ceil(filteredIds.length / state.pageSize));
    if (el.pageInfo) el.pageInfo.textContent = `Page ${Math.min(page,totalPages)} of ${totalPages}`;
    if (el.prev) el.prev.disabled = (page <= 1);
    if (el.next) el.next.disabled = (page >= totalPages);
  }

  function selectUniversity(u){
    window.studentUnitIds = window.studentUnitIds || new Set();
    window.addedByRecommender = window.addedByRecommender || new Set();
    window.removedByRecommender = window.removedByRecommender || new Set();

    if (window.studentUnitIds.has(u.unitid)) {
      window.removedByRecommender.delete(u.unitid);
    } else {
      window.addedByRecommender.add(u.unitid);
    }

    window.updateSelectedList?.();
    window.updateSendButton?.();
  }

  function animateToSelected(fromEl, label){
    try {
      const list = el.selectedList;
      if (!fromEl || !list) return;

      const r1 = fromEl.getBoundingClientRect();
      const r2 = list.getBoundingClientRect();
      const dx = (r2.left + r2.width * 0.15) - (r1.left + r1.width/2);
      const dy = (r2.top  + 8) - (r1.top  + r1.height/2);

      const chip = document.createElement('div');
      chip.className = 'fly-chip';
      chip.textContent = label || 'Added';
      chip.style.left = `${r1.left + r1.width/2}px`;
      chip.style.top  = `${r1.top  + r1.height/2}px`;
      chip.style.setProperty('--dx', `${dx}px`);
      chip.style.setProperty('--dy', `${dy}px`);
      document.body.appendChild(chip);
      setTimeout(()=> chip.remove(), 480);
    } catch {}
  }

  function buildSuggestions(query){
    if (!Array.isArray(window.universities)) return [];
    const q = norm(query);
    if (!q) return [];
    const max = 10, out = [];
    for (const u of window.universities) {
      if (norm(u.name).includes(q)) {
        out.push(u);
        if (out.length >= max) break;
      }
    }
    return out;
  }

  function showSuggest(list){
    if (!el.suggest) return;
    if (!list.length) { el.suggest.style.display='none'; el.input?.setAttribute('aria-expanded','false'); return; }
    el.suggest.innerHTML = list.map((u,i)=>`
      <div class="suggest-item" role="option" data-id="${u.unitid}" aria-selected="${i===0?'true':'false'}">
        <span class="material-icons" aria-hidden="true">school</span>
        <span>${u.name}</span>
        <span class="suggest-muted">· ${u.state||''}</span>
      </div>
    `).join('');
    el.suggest.style.display = 'block';
    el.input?.setAttribute('aria-expanded','true');
  }

  function hideSuggest(){
    if (!el.suggest) return;
    el.suggest.style.display='none';
    el.input?.setAttribute('aria-expanded','false');
  }

  function setupAutosuggest(){
    if (!el.input) return;
    let hoverIdx = -1;
    let items = [];

    function refresh(){
      items = buildSuggestions(el.input.value);
      showSuggest(items);
      hoverIdx = items.length ? 0 : -1;
      highlight();
    }
    function highlight(){
      if (!el.suggest) return;
      [...el.suggest.querySelectorAll('.suggest-item')].forEach((n,i)=>{
        n.setAttribute('aria-selected', i===hoverIdx ? 'true' : 'false');
      });
    }

    el.input.addEventListener('input', refresh);
    el.input.addEventListener('keydown', (e)=>{
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); hoverIdx = Math.min(hoverIdx+1, items.length-1); highlight(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); hoverIdx = Math.max(0, hoverIdx-1); highlight(); }
      if (e.key === 'Enter')     { e.preventDefault(); choose(items[hoverIdx]); }
      if (e.key === 'Escape')    { hideSuggest(); }
    });

    el.suggest?.addEventListener('click', (e)=>{
      const it = e.target.closest('.suggest-item');
      if (!it) return;
      const id = it.getAttribute('data-id');
      const u = window.universities?.find(x=> String(x.unitid) === String(id));
      choose(u);
    });

    document.addEventListener('click', (e)=>{
      if (!e.target.closest('.university-search')) hideSuggest();
    });

    function choose(u){
      if (!u) return;
      el.input.value = u.name;
      state.q = u.name;
      hideSuggest();
      applyFiltersAndSort();

      const card = [...el.grid.querySelectorAll('.university-card')]
        .find(c => c.querySelector('.university-name')?.textContent === u.name);
      if (card) {
        selectUniversity(u);
        animateToSelected(card, u.name);
      } else {
        animateToSelected(el.input, u.name);
        selectUniversity(u);
      }
    }
  }

  function setupFilterHandlers(){
    el.apply?.addEventListener('click', ()=>{
      state.q = el.input?.value || '';
      applyFiltersAndSort();
    });
    el.input?.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') { e.preventDefault(); el.apply?.click(); }
    });

    el.applyFilters?.addEventListener('click', ()=>{
      state.byState = el.state?.value || '';
      state.byType  = el.type?.value  || '';
      state.byLevel = el.level?.value || '';
      state.sort    = el.sort?.value  || 'name_asc';
      applyFiltersAndSort();
    });

    el.reset?.addEventListener('click', ()=>{
      state.q = '';
      state.byState = '';
      state.byType  = '';
      state.byLevel = '';
      state.sort    = 'name_asc';
      if (el.input) el.input.value = '';
      if (el.state) el.state.value = '';
      if (el.type)  el.type.value  = '';
      if (el.level) el.level.value = '';
      if (el.sort)  el.sort.value  = 'name_asc';
      applyFiltersAndSort();
    });

    el.select?.addEventListener('change', ()=>{
      const id = el.select.value;
      const u = window.universities?.find(x => String(x.unitid) === String(id) || x.name === id);
      if (u) {
        selectUniversity(u);
        animateToSelected(el.select, u.name);
      }
      el.select.value = '';
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', ()=> el.reset?.click());
  }

  function setupPagination(){
    el.prev?.addEventListener('click', ()=>{
      if (state.page > 1) { state.page--; renderPage(); }
    });
    el.next?.addEventListener('click', ()=>{
      const totalPages = Math.max(1, Math.ceil(state.filteredIds.length / state.pageSize));
      if (state.page < totalPages) { state.page++; renderPage(); }
    });
    el.pageSize?.addEventListener('change', ()=>{
      const v = parseInt(el.pageSize.value, 10);
      state.pageSize = isNaN(v) ? 40 : v;
      state.page = 1;
      renderPage();
    });
  }

  function bootOnceDataReady(){
    if (!Array.isArray(window.universities) || !window.universities.length) {
      setTimeout(bootOnceDataReady, 200);
      return;
    }
    setupAutosuggest();
    setupFilterHandlers();
    setupPagination();

    if (el.select && el.select.options.length <= 1) {
      const frag = document.createDocumentFragment();
      window.universities.slice(0, 1000).forEach(u=>{
        const opt = document.createElement('option');
        opt.value = String(u.unitid);
        opt.textContent = u.name;
        frag.appendChild(opt);
      });
      el.select.appendChild(frag);
    }

    applyFiltersAndSort();
  }

  bootOnceDataReady();
})();


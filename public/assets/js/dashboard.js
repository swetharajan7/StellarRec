// Tiny toast helper (no deps)
(function(){
  const wrap = document.getElementById('toastWrap');
  window.toast = function(msg, type='info'){
    if(!wrap) return alert(msg);
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="material-icons" aria-hidden="true">${
      type==='success'?'check_circle':type==='error'?'error':'info'
    }</span><div>${msg}</div>`;
    wrap.appendChild(el);
    setTimeout(()=> el.remove(), 2600);
  };
})();

// Tabs
(function(){
  const tabs = [
    { tab: 'tab-application', panel: 'panel-application' },
    { tab: 'tab-recos',       panel: 'panel-recos' }
  ];
  tabs.forEach(({tab,panel})=>{
    const t = document.getElementById(tab);
    const p = document.getElementById(panel);
    t?.addEventListener('click', ()=>{
      tabs.forEach(({tab:tid,panel:pid})=>{
        const tt = document.getElementById(tid);
        const pp = document.getElementById(pid);
        const active = (tid === tab);
        tt?.setAttribute('aria-selected', active ? 'true':'false');
        if (pp) pp.hidden = !active;
      });
    });
  });
})();

// Modal open/close
(function(){
  const openBtns = [document.getElementById('openAddRecBtn'), document.getElementById('openAddRecBtn2')].filter(Boolean);
  const overlay  = document.getElementById('addRecOverlay');
  const closeBtn = document.getElementById('closeAddRecBtn');
  const cancel   = document.getElementById('cancelRecBtn');

  function open(){ overlay?.classList.add('show'); overlay?.setAttribute('aria-hidden','false'); }
  function close(){ overlay?.classList.remove('show'); overlay?.setAttribute('aria-hidden','true'); }

  openBtns.forEach(b=> b.addEventListener('click', open));
  closeBtn?.addEventListener('click', close);
  cancel?.addEventListener('click', close);
  overlay?.addEventListener('click', (e)=>{ if(e.target === overlay) close(); });

  // Escape to close
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && overlay?.classList.contains('show')) close(); });
})();

// Form validation + “send” simulation
(function(){
  const form = document.getElementById('addRecForm');
  const sendBtn = document.getElementById('sendToRecBtn');

  const f = (id)=> document.getElementById(id);
  const first = f('firstName'), last = f('lastName'), email = f('email');

  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').toLowerCase()); }
  function showErr(id, show){ const el = f(id); if(el) el.style.display = show ? 'block' : 'none'; }

  sendBtn?.addEventListener('click', ()=>{
    let ok = true;
    if(!first.value.trim()){ showErr('firstErr', true); ok=false; } else showErr('firstErr', false);
    if(!last.value.trim()){ showErr('lastErr', true);  ok=false; } else showErr('lastErr', false);
    if(!validEmail(email.value)){ showErr('emailErr', true); ok=false; } else showErr('emailErr', false);
    if(!ok){ toast('Please fix the highlighted fields.', 'error'); return; }

    // Demo: pretend we sent the request and the recommender uploaded.
    toast('Request sent to recommender.', 'success');

    // Add a line item in the Recommendations panel
    const list = document.getElementById('recList');
    if (list) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:.6rem;border:1px solid #e5e7eb;border-radius:10px;padding:.6rem .8rem;background:#fff';
      row.innerHTML = `
        <span class="material-icons" aria-hidden="true" style="color:#1976d2">person</span>
        <div style="flex:1">
          <div style="font-weight:700">${first.value} ${last.value}</div>
          <div style="font-size:.9rem;color:#667">${email.value}</div>
        </div>
        <span class="ok"><span class="material-icons" aria-hidden="true">check_circle</span> Uploaded</span>
      `;
      list.prepend(row);
    }

    // Flip tabs state: show success pill + success block in Application panel
    document.getElementById('recStatusPill')?.style.setProperty('display','inline-flex');
    const okBlock = document.getElementById('recUploadOk');
    const pending = document.getElementById('recUploadPending');
    if (okBlock) okBlock.style.display = 'flex';
    if (pending) pending.style.display = 'none';

    // Close modal & reset
    document.getElementById('cancelRecBtn')?.click();
    form?.reset();
  });

  // Hide errors on input
  [first,last,email].forEach(inp=>{
    inp?.addEventListener('input', ()=>{
      if(inp===first) showErr('firstErr', false);
      if(inp===last)  showErr('lastErr', false);
      if(inp===email) showErr('emailErr', false);
    });
  });
})();
<script>
(function(){
  const sendBtn = document.getElementById('sendBtn');

  // CHANGE THIS to your mock site page path
  const MOCK_INBOX_URL = 'https://mockuniversity.netlify.app/inbox.html';

  function buildDemoPdfUrl(){
    // Option 1: static demo file
    return 'https://stellarrec.netlify.app/assets/mock/reco-demo.pdf';

    // Option 2 (optional): if you actually attached a PDF and
    // upload it to some storage, return that URL instead.
  }

  function getSelectedUnitIds(){
    // These are maintained by your existing code.
    // Fall back to studentUnitIds set if present.
    const s = (window.studentUnitIds && [...window.studentUnitIds]) || [];
    return s;
  }

  function getStudentMeta(){
    // Pull from your referral/local form; use empty defaults if not available
    try {
      const saved = JSON.parse(localStorage.getItem('sr_referral')||'{}');
      const s = saved.student || {};
      return {
        studentFirst: s.first || '',
        studentLast:  s.last  || '',
        studentEmail: s.email || '',
        waive:        !!s.waive
      };
    } catch { return { studentFirst:'', studentLast:'', studentEmail:'', waive:false }; }
  }

  function getRecommenderMeta(){
    try {
      const saved = JSON.parse(localStorage.getItem('sr_referral')||'{}');
      const r = saved.recommender || {};
      return {
        recommenderName:  r.name  || '',
        recommenderEmail: r.email || ''
      };
    } catch { return { recommenderName:'', recommenderEmail:'' }; }
  }

  function goToMockInbox(){
    const pdfUrl = buildDemoPdfUrl();

    const stu  = getStudentMeta();
    const rec  = getRecommenderMeta();
    const list = getSelectedUnitIds(); // array of unitids (strings)

    const params = new URLSearchParams({
      sf: stu.studentFirst,
      sl: stu.studentLast,
      se: stu.studentEmail,
      waive: stu.waive ? '1' : '0',
      rname: rec.recommenderName,
      remail: rec.recommenderEmail,
      pdf: pdfUrl
    });

    // include selected universities (CSV of unitids)
    if (list.length) params.set('unis', list.join(','));

    // OPTIONAL: include your own demo “letter title”
    const titleEl = document.getElementById('writerTitle');
    if (titleEl && titleEl.value.trim()) params.set('title', titleEl.value.trim());

    // Navigate to Mock University inbox page
    window.location.href = `${MOCK_INBOX_URL}?${params.toString()}`;
  }

  // Wire the real send button
  sendBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    // If you show a confirm modal, call goToMockInbox() after confirm.
    // For demo: jump immediately
    goToMockInbox();
  });
})();
</script>


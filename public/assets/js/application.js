// Tiny toast helper (no deps)
(function(){
  const wrap = document.getElementById('toastWrap');
  window.toast = function(msg, type='info'){
    if(!wrap) return alert(msg);
    const el = document.createElement('div');
    el.className = 'toast ' + (type==='success'?'success':type==='error'?'error':'info');
    el.innerHTML = `<span class="material-icons icon" aria-hidden="true">${
      type==='success'?'check_circle':type==='error'?'error':'info'
    }</span><div class="msg">${msg}</div><button class="x" aria-label="Close">✕</button>`;
    el.querySelector('.x').addEventListener('click', ()=> el.remove());
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

// Form validation + “send” simulation  (ENHANCED: now creates & updates via MockAPI)
(function(){
  const form   = document.getElementById('addRecForm');
  const sendBtn = document.getElementById('sendToRecBtn');

  const f = (id)=> document.getElementById(id);
  const first = f('firstName'), last = f('lastName'), email = f('email');

  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').toLowerCase()); }
  function showErr(id, show){ const el = f(id); if(el) el.style.display = show ? 'block' : 'none'; }

  // ---------- CONFIG — set your student/applicant info here ----------
  // This student info is what Mock University uses to show/refresh the status.
  // Make sure it matches the email your MU page queries for.
  const STUDENT_NAME  = 'Swetha Rajan';                 // change if needed
  const STUDENT_EMAIL = 'swetha.rajan@example.com';     // change if needed

  // Your MockAPI "recs" endpoint with API prefix
  const API_URL = 'https://68bfba1a9c70953d96f04ea0.mockapi.io/api/recs';

  async function createRecommendation({ studentName, studentEmail, recommenderName, recommenderEmail }){
    const externalId = 'sr_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    const payload = {
      external_id:       externalId,
      student_name:      studentName,
      student_email:     (studentEmail||'').toLowerCase(),
      recommender_name:  recommenderName,
      recommender_email: (recommenderEmail||'').toLowerCase(),
      status:            'Pending',
      created_at:        new Date().toISOString()
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Create failed: ' + res.status);
    const data = await res.json();

    // Save ids for later update
    try {
      localStorage.setItem('sr_last_external_id', externalId);
      localStorage.setItem('sr_last_mock_id', String(data.id));
    } catch(_) {}

    return data; // includes .id
  }

  async function markRecommendationSent(recordId){
    const res = await fetch(`${API_URL}/${recordId}`, {
      method: 'PUT', // MockAPI accepts PUT for updates; body can be partial
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ status: 'Sent' })
    });
    if (!res.ok) throw new Error('Update failed: ' + res.status);
    return res.json();
  }

  sendBtn?.addEventListener('click', async ()=>{
    let ok = true;
    if(!first.value.trim()){ showErr('firstErr', true); ok=false; } else showErr('firstErr', false);
    if(!last.value.trim()){ showErr('lastErr', true);  ok=false; } else showErr('lastErr', false);
    if(!validEmail(email.value)){ showErr('emailErr', true); ok=false; } else showErr('emailErr', false);
    if(!ok){ toast('Please fix the highlighted fields.', 'error'); return; }

    const recommenderFullName = `${first.value.trim()} ${last.value.trim()}`.replace(/\s+/g,' ').trim();
    const recommenderEmail = email.value.trim();

    // 1) CREATE in MockAPI (status = Pending)
    let created;
    try {
      created = await createRecommendation({
        studentName: STUDENT_NAME,
        studentEmail: STUDENT_EMAIL,
        recommenderName: recommenderFullName,
        recommenderEmail
      });
      toast('Request sent to recommender (created in portal).', 'success');
    } catch(err){
      console.error(err);
      toast('Could not create the recommendation in the portal. Please try again.', 'error');
      return;
    }

    // 2) Your existing UI updates (kept intact)
    const list = document.getElementById('recList');
    if (list) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:.6rem;border:1px solid #e5e7eb;border-radius:10px;padding:.6rem .8rem;background:#fff';
      row.innerHTML = `
        <span class="material-icons" aria-hidden="true" style="color:#1976d2">person</span>
        <div style="flex:1">
          <div style="font-weight:700">${recommenderFullName}</div>
          <div style="font-size:.9rem;color:#667">${recommenderEmail}</div>
        </div>
        <span class="track-pill pending" style="display:inline-flex;align-items:center;gap:.35rem;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:999px;padding:.15rem .5rem;font-weight:700;font-size:.82rem;">Pending</span>
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

    // 3) (Simulate the recommender uploading) → UPDATE to Sent after 2s
    //    If later you have a real "upload complete" button, call markRecommendationSent(id) there instead.
    const id = String(created.id);
    setTimeout(async ()=>{
      try {
        await markRecommendationSent(id);
        toast('Recommender upload received — status marked Sent in the portal.', 'success');

        // Update the little pill in this list row from Pending → Uploaded (optional cosmetic)
        const firstPill = document.querySelector('#recList .track-pill.pending');
        if (firstPill) {
          firstPill.classList.remove('pending');
          firstPill.classList.add('received');
          firstPill.style.border = '1px solid #bbf7d0';
          firstPill.style.background = '#ecfdf5';
          firstPill.style.color = '#166534';
          firstPill.innerHTML = `<span class="material-icons" aria-hidden="true">check_circle</span> Sent`;
        }
      } catch (err){
        console.error(err);
        toast('Tried to mark as Sent but the update failed.', 'error');
      }
    }, 2000);
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

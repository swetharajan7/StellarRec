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

// Form validation + “send” with MockAPI integration
(function(){
  const form = document.getElementById('addRecForm');
  const sendBtn = document.getElementById('sendToRecBtn');

  const f = (id)=> document.getElementById(id);
  const first = f('firstName'), last = f('lastName'), email = f('email');

  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').toLowerCase()); }
  function showErr(id, show){ const el = f(id); if(el) el.style.display = show ? 'block' : 'none'; }

  // ---------- CONFIG ----------
  const STUDENT_NAME  = 'Test Applicant';
  const STUDENT_EMAIL = 'applicant@test.com';
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

    localStorage.setItem('sr_last_external_id', externalId);
    localStorage.setItem('sr_last_mock_id', String(data.id));

    return data;
  }

  async function markRecommendationSent(recordId){
    const res = await fetch(`${API_URL}/${recordId}`, {
      method: 'PUT',
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
        <span class="track-pill pending">Pending</span>
      `;
      list.prepend(row);
    }

    document.getElementById('recStatusPill')?.style.setProperty('display','inline-flex');
    const okBlock = document.getElementById('recUploadOk');
    const pending = document.getElementById('recUploadPending');
    if (okBlock) okBlock.style.display = 'flex';
    if (pending) pending.style.display = 'none';

    document.getElementById('cancelRecBtn')?.click();
    form?.reset();

    // Update to Sent after 2s (simulating recommender upload)
    const id = String(created.id);
    setTimeout(async ()=>{
      try {
        await markRecommendationSent(id);
        toast('Recommender upload received — status marked Sent.', 'success');
        const firstPill = document.querySelector('#recList .track-pill.pending');
        if (firstPill) {
          firstPill.classList.remove('pending');
          firstPill.classList.add('sent');
          firstPill.textContent = 'Sent';
        }
      } catch (err){
        console.error(err);
        toast('Update failed while marking Sent.', 'error');
      }
    }, 2000);
  });

  [first,last,email].forEach(inp=>{
    inp?.addEventListener('input', ()=>{
      if(inp===first) showErr('firstErr', false);
      if(inp===last)  showErr('lastErr', false);
      if(inp===email) showErr('emailErr', false);
    });
  });
})();

// Extra script to demo "Send to Universities" redirect
(function(){
  const sendBtn = document.getElementById('sendBtn');

  function buildDemoPdfUrl(){
    return 'https://stellarrec.netlify.app/assets/mock/reco-demo.pdf';
  }

  function getSelectedUnitIds(){
    return (window.studentUnitIds && [...window.studentUnitIds]) || [];
  }

  function getStudentMeta(){
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
    const list = getSelectedUnitIds();

    const params = new URLSearchParams({
      sf: stu.studentFirst,
      sl: stu.studentLast,
      se: stu.studentEmail,
      waive: stu.waive ? '1' : '0',
      rname: rec.recommenderName,
      remail: rec.recommenderEmail,
      pdf: pdfUrl
    });

    if (list.length) params.set('unis', list.join(','));
    const titleEl = document.getElementById('writerTitle');
    if (titleEl && titleEl.value.trim()) params.set('title', titleEl.value.trim());

    // CHANGE THIS to your mock university inbox page
    const MOCK_INBOX_URL = 'https://mockuniversity.netlify.app/apply';
    window.location.href = `${MOCK_INBOX_URL}?${params.toString()}`;
  }

  sendBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    goToMockInbox();
  });
})();

<script>
// ---------- Tiny toast (keeps your #toastWrap) ----------
(function(){
  const wrap = document.getElementById('toastWrap');
  window.toast = function(msg, type='info'){
    if(!wrap) return alert(msg);
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="material-icons" aria-hidden="true">${
      type==='success'?'check_circle':type==='error'?'error':'info'
    }</span><div class="msg">${msg}</div><button class="x" aria-label="Dismiss">✕</button>`;
    wrap.appendChild(el);
    el.querySelector('.x').onclick = ()=> el.remove();
    setTimeout(()=> el.remove(), 3000);
  };
})();

// ---------- Student tabs (match dashboard.html IDs) ----------
(function(){
  const tabs = {
    send:   document.getElementById('stuTabSend'),
    select: document.getElementById('stuTabSelect'),
    track:  document.getElementById('stuTabTrack'),
  };
  const panels = {
    send:   document.getElementById('stuPanelSend'),
    select: document.getElementById('stuPanelSelect'),
    track:  document.getElementById('stuPanelTrack'),
  };
  function activate(which){
    Object.entries(tabs).forEach(([k,btn])=> btn?.setAttribute('aria-selected', k===which?'true':'false'));
    Object.entries(panels).forEach(([k,sec])=> sec && (sec.hidden = (k!==which)));
    if (which==='track' && typeof window.renderStudentTrack==='function') window.renderStudentTrack();
  }
  tabs.send  ?.addEventListener('click', ()=>activate('send'));
  tabs.select?.addEventListener('click', ()=>activate('select'));
  tabs.track ?.addEventListener('click', ()=>activate('track'));
  // default respects current aria-selected or falls back to "send"
  const defaultTab = Object.entries(tabs).find(([,b])=>b?.getAttribute('aria-selected')==='true')?.[0] || 'send';
  activate(defaultTab);
})();

// ---------- Header: Contact admin (overlay on your page) ----------
(function(){
  const openBtn = document.getElementById('contactAdminItem');
  const overlay = document.getElementById('contactOverlay');
  const close1  = document.getElementById('contactCloseBtn2');
  const close2  = document.getElementById('contactCancelBtn2');
  if (!openBtn) return;
  const open = ()=>{ if (overlay){ overlay.style.display='flex'; } };
  const close= ()=>{ if (overlay){ overlay.style.display='none'; } };
  openBtn.addEventListener('click', open);
  close1   ?.addEventListener('click', close);
  close2   ?.addEventListener('click', close);
  overlay  ?.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && overlay?.style.display==='flex') close(); });
})();

// ---------- Uploads: PDF & Video (match your IDs) ----------
(function(){
  // PDF
  const choose = document.getElementById('chooseFileBtn');
  const input  = document.getElementById('fileInput');
  const card   = document.getElementById('uploadedFile');
  const nameEl = document.getElementById('fileName');
  const sizeEl = document.getElementById('fileSize');
  const remove = document.getElementById('removeFileBtn');
  choose?.addEventListener('click', ()=> input?.click());
  input ?.addEventListener('change', ()=>{
    const f = input.files?.[0]; if(!f) return;
    nameEl && (nameEl.textContent = f.name);
    sizeEl && (sizeEl.textContent = `${(f.size/1024/1024).toFixed(2)} MB`);
    card && (card.style.display='block');
    toast('PDF attached.','success');
  });
  remove?.addEventListener('click', ()=>{ if(input) input.value=''; if(card) card.style.display='none'; });

  // Video
  const chooseV = document.getElementById('chooseVideoBtn');
  const inputV  = document.getElementById('videoInput');
  const cardV   = document.getElementById('uploadedVideo');
  const nameV   = document.getElementById('videoName');
  const sizeV   = document.getElementById('videoSize');
  const removeV = document.getElementById('removeVideoBtn');
  const prevV   = document.getElementById('videoPreview');
  chooseV?.addEventListener('click', ()=> inputV?.click());
  inputV ?.addEventListener('change', ()=>{
    const f = inputV.files?.[0]; if(!f) return;
    nameV && (nameV.textContent = f.name);
    sizeV && (sizeV.textContent = `${(f.size/1024/1024).toFixed(2)} MB`);
    cardV && (cardV.style.display='block');
    if (prevV){ try { prevV.src = URL.createObjectURL(f); prevV.style.display='block'; } catch(_){} }
  });
  removeV?.addEventListener('click', ()=>{
    if (inputV) inputV.value='';
    if (cardV) cardV.style.display='none';
    if (prevV){ prevV.removeAttribute('src'); prevV.style.display='none'; }
  });
})();

// ---------- Writer toolbar + draft utilities (match your IDs) ----------
(function(){
  const box   = document.getElementById('writerBox');
  const title = document.getElementById('writerTitle');
  if (!box) return;
  const exec = (cmd)=>{ box.focus({preventScroll:true}); document.execCommand(cmd, false, null); refreshMeta(); };
  document.querySelectorAll('[data-wcmd]').forEach(btn=>{
    btn.addEventListener('click', ()=> exec(btn.getAttribute('data-wcmd')));
  });
  function refreshMeta(){
    const text = box.innerText || '';
    const words = (text.trim().match(/\S+/g)||[]).length;
    const chars = text.length;
    const meta = document.getElementById('writerCount');
    if (meta) meta.textContent = `${words} words • ${chars} chars`;
  }
  const LSKEY='sr_writer_draft';
  const savedEl=document.getElementById('writerSaved');
  const setSaved=(s)=> savedEl && (savedEl.textContent = s);
  document.getElementById('saveDraftBtn')   ?.addEventListener('click', ()=>{ try{ localStorage.setItem(LSKEY, JSON.stringify({title:title?.value||'', html: box.innerHTML})); setSaved('Saved'); }catch{} });
  document.getElementById('restoreDraftBtn')?.addEventListener('click', ()=>{ try{ const d=JSON.parse(localStorage.getItem(LSKEY)||'{}'); if(title&&d.title) title.value=d.title; box.innerHTML=d.html||''; setSaved('Restored'); refreshMeta(); }catch{} });
  document.getElementById('clearDraftBtn')  ?.addEventListener('click', ()=>{ box.innerHTML=''; refreshMeta(); setSaved('Cleared'); });
  document.getElementById('copyDraftBtn')   ?.addEventListener('click', async ()=>{ try{ const tmp=document.createElement('div'); tmp.innerHTML=box.innerHTML; await navigator.clipboard.writeText(tmp.innerText); setSaved('Copied'); }catch{} });
  document.getElementById('downloadDraftBtn')?.addEventListener('click', ()=>{ const a=document.createElement('a'); const text=(title?.value?title.value+'\n\n':'')+(box.innerText||''); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download='recommendation-letter.txt'; a.click(); setSaved('Downloaded'); });
  document.getElementById('attachDraftBtn') ?.addEventListener('click', ()=> setSaved('Attached (stub)'));
  ['input','keyup','paste','cut'].forEach(ev=> box.addEventListener(ev, refreshMeta));
  refreshMeta();
})();

// ---------- Student: Send Recommendation Request (MockAPI hook) ----------
(function(){
  const form = document.getElementById('stuSendForm');
  if (!form) return;
  const nameEl = document.getElementById('stuName');
  const emailEl= document.getElementById('stuEmail');
  const recName= document.getElementById('recName');
  const recMail= document.getElementById('recEmail');

  const API_URL = 'https://68bfba1a9c70953d96f04ea0.mockapi.io/api/recs';
  const validEmail = (v)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').toLowerCase());

  async function createRecommendation({ studentName, studentEmail, recommenderName, recommenderEmail }){
    const externalId = 'sr_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    const payload = {
      external_id: externalId,
      student_name: studentName,
      student_email: (studentEmail||'').toLowerCase(),
      recommender_name:  recommenderName,
      recommender_email: (recommenderEmail||'').toLowerCase(),
      status: 'Pending',
      created_at: new Date().toISOString()
    };
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Create failed: ' + res.status);
    const data = await res.json();
    try { localStorage.setItem('sr_last_external_id', externalId); localStorage.setItem('sr_last_mock_id', String(data.id)); } catch {}
    return data;
  }

  function pushToTrackRow({who,email,ts,status}){
    const tbody = document.getElementById('stuTrackBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${who}</td>
      <td>${email}</td>
      <td>${new Date(ts).toLocaleString()}</td>
      <td><span class="track-pill ${status==='Sent'?'sent':'pending'}">${status}</span></td>
    `;
    tbody.prepend(tr);
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const studentName = (nameEl?.value||'').trim();
    const studentEmail= (emailEl?.value||'').trim();
    const rName = (recName?.value||'').trim();
    const rMail = (recMail?.value||'').trim();
    if (!studentName || !validEmail(studentEmail) || !rName || !validEmail(rMail)){
      toast('Please fill valid student & recommender details.','error'); return;
    }
    try {
      await createRecommendation({ studentName, studentEmail, recommenderName:rName, recommenderEmail:rMail });
      toast('Request sent to recommender.','success');
      // Log to Track as Pending→Sent (demo)
      const now = Date.now();
      pushToTrackRow({ who:rName, email:rMail, ts: now, status:'Pending' });
      setTimeout(()=>{ pushToTrackRow({ who:rName, email:rMail, ts: now+2000, status:'Sent' }); }, 2000);
      form.reset();
    } catch(err){
      console.error(err);
      toast('Could not create the recommendation in the portal.','error');
    }
  });
})();

// ---------- Optional: demo redirect for "Send to Selected Universities" ----------
// Opt-in: add data-mock-redirect="1" to #sendBtn if you want this behavior.
(function(){
  const sendBtn = document.getElementById('sendBtn');
  if (!sendBtn || sendBtn.getAttribute('data-mock-redirect')!=='1') return; // keep your confirm modal by default

  function getSelectedUnitIds(){
    if (window.SR && SR.selected) return Array.from(SR.selected);
    if (window.studentUnitIds)    return Array.from(window.studentUnitIds);
    return [];
  }
  function buildDemoPdfUrl(){ return 'https://stellarrec.netlify.app/assets/mock/reco-demo.pdf'; }
  function getStudentMeta(){
    try {
      const saved = JSON.parse(localStorage.getItem('sr_referral')||'{}');
      const s = saved.student || {};
      return { studentFirst:s.first||'', studentLast:s.last||'', studentEmail:s.email||'', waive:!!s.waive };
    } catch { return { studentFirst:'', studentLast:'', studentEmail:'', waive:false }; }
  }
  function getRecommenderMeta(){
    try {
      const saved = JSON.parse(localStorage.getItem('sr_referral')||'{}');
      const r = saved.recommender || {};
      return { recommenderName:r.name||'', recommenderEmail:r.email||'' };
    } catch { return { recommenderName:'', recommenderEmail:'' }; }
  }

  sendBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const pdfUrl = buildDemoPdfUrl();
    const stu = getStudentMeta();
    const rec = getRecommenderMeta();
    const list= getSelectedUnitIds();
    const params = new URLSearchParams({
      sf: stu.studentFirst, sl: stu.studentLast, se: stu.studentEmail,
      waive: stu.waive ? '1':'0', rname: rec.recommenderName, remail: rec.recommenderEmail, pdf: pdfUrl
    });
    if (list.length) params.set('unis', list.join(','));
    const titleEl = document.getElementById('writerTitle'); if (titleEl?.value.trim()) params.set('title', titleEl.value.trim());
    const MOCK_INBOX_URL = 'https://mockuniversity.netlify.app/apply';
    window.location.href = `${MOCK_INBOX_URL}?${params.toString()}`;
  });
})();
</script>

<script>
/* ===================== tiny toast ===================== */
(function(){
  window.toast = function(msg, type='info', opts={}){
    const wrap = document.getElementById('toastWrap') || (()=>{ const d=document.createElement('div'); d.id='toastWrap'; d.className='toast-wrap'; document.body.appendChild(d); return d; })();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="icon">${type==='success'?'✓':type==='error'?'!':'ℹ︎'}</div>
      <div class="msg">${msg}</div>
      <button class="x" aria-label="Close">×</button>`;
    wrap.appendChild(el);
    const ttl = opts.ttl || 2500;
    const close = ()=>{ if(el.parentNode){ el.parentNode.removeChild(el); } };
    el.querySelector('.x').onclick = close;
    setTimeout(close, ttl);
  };
})();
</script>

<script>
/* ===================== utilities & state ===================== */
const norm = s => (s||'').toString().trim().toLowerCase();
const escapeHtml = s => (s??'').toString()
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const debounce = (fn,wait=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; };

let universities = [];       // full dataset
let filtered = [];           // filtered working set
let page = 1, pageSize = 40; // paging
let flashNextRender = false;

let studentProfile = null;
let studentUnitIds = new Set();     // preselected by student
let addedByRecommender = new Set(); // extra you added
let removedByRecommender = new Set();// you removed from student's list
const getEffectiveSelection = ()=>{
  const s = new Set(studentUnitIds);
  removedByRecommender.forEach(id=>s.delete(id));
  addedByRecommender.forEach(id=>s.add(id));
  return s;
};

/* ===================== THEME ===================== */
(function themeInit(){
  const KEY='sr_theme';
  function apply(t){ document.body.classList.toggle('sr-dark', t==='dark'); }
  apply(localStorage.getItem(KEY)||'light');
  const tgl = document.getElementById('themeToggle');
  if (tgl) {
    tgl.checked = (localStorage.getItem(KEY)==='dark');
    tgl.onchange = e=>{ const mode=e.target.checked?'dark':'light'; localStorage.setItem(KEY,mode); apply(mode); toast(`Theme: ${mode}`,'info',{ttl:1200}); };
  }
})();
</script>

<script>
/* ===================== CONTACT ADMIN (Netlify Forms) ===================== */
(function contactAdmin(){
  const dropdown = document.getElementById('userDropdown');
  const avatar   = document.getElementById('userAvatarBtn');
  const overlay  = document.getElementById('contactOverlay');
  const form     = document.getElementById('contactForm');

  // open/close dropdown
  function toggleUserDropdown(){
    const dd = document.getElementById('userDropdown');
    const show = !dd.classList.contains('show');
    dd.classList.toggle('show', show);
    avatar.setAttribute('aria-expanded', show?'true':'false');
  }
  window.toggleUserDropdown = toggleUserDropdown;
  avatar?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleUserDropdown(); });
  document.addEventListener('click', (e)=>{
    if (!dropdown.contains(e.target) && e.target!==avatar) dropdown.classList.remove('show');
  });

  // open overlay from dropdown item
  const contactItem = document.querySelector('.dropdown-item#contactAdminItem,[data-sr="contact-admin"]') || document.getElementById('contactAdminItem');
  contactItem?.addEventListener('click', ()=>{
    dropdown.classList.remove('show');
    overlay.classList.add('show');
    document.getElementById('contactFirst')?.focus();
  });

  // close buttons
  document.getElementById('contactCancelBtn')?.addEventListener('click', ()=> overlay.classList.remove('show'));
  document.getElementById('contactCloseBtn')?.addEventListener('click', ()=> overlay.classList.remove('show'));
  document.getElementById('contactCancel')?.addEventListener('click', ()=> overlay.classList.remove('show'));
  document.getElementById('contactClose')?.addEventListener('click', ()=> overlay.classList.remove('show'));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') overlay.classList.remove('show'); });

  // submit → Netlify Forms + fallback
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = new FormData(form);
    try {
      const resp = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type':'application/x-www-form-urlencoded' },
        body: new URLSearchParams([...data, ['form-name','contact-admin']]).toString()
      });
      if (resp.ok) {
        toast('Message sent.','success');
        form.reset(); overlay.classList.remove('show');
        return;
      }
      throw new Error('Bad response');
    } catch {
      // fallback: open mail client (address not shown on page)
      const to='swetha.rajan103@gmail.com';
      const subject=encodeURIComponent('StellarRec — Admin Contact');
      const body=encodeURIComponent(`First name: ${data.get('first')||''}\nEmail: ${data.get('email')||''}\n\nQuery:\n${data.get('query')||data.get('message')||''}`);
      window.location.href=`mailto:${to}?subject=${subject}&body=${body}`;
      overlay.classList.remove('show');
      toast('Opening your email client…','info');
    }
  });
})();
</script>

<script>
/* ===================== WRITER ===================== */
let writerAutosaveTimer=null;
function writerCmd(cmd){ document.execCommand(cmd,false,null); }
function stripHtml(html){ const t=document.createElement('div'); t.innerHTML=html||''; return t.textContent||t.innerText||''; }
function draftKey(){ const sid=(window.studentProfile && (studentProfile.id||studentProfile.email))||'default'; return 'sr_draft_'+sid; }
function saveDraft(quiet=false){
  const bodyHtml=document.getElementById('writerBox').innerHTML||'';
  const title=document.getElementById('writerTitle').value||'';
  const payload={title, bodyHtml, savedAt:Date.now()};
  try{ localStorage.setItem(draftKey(), JSON.stringify(payload)); updateSavedIndicator(payload.savedAt); if(!quiet) toast('Draft saved.','success',{ttl:1800}); }catch(e){ if(!quiet) toast('Could not save draft.','error'); }
}
function restoreDraft(silent=false){
  try{
    const raw=localStorage.getItem(draftKey());
    if(!raw){ if(!silent) toast('No saved draft found.','info'); updateSavedIndicator(null); return; }
    const p=JSON.parse(raw);
    document.getElementById('writerTitle').value=p.title||'';
    document.getElementById('writerBox').innerHTML=p.bodyHtml||'';
    updateWriterCounts(); updateSavedIndicator(p.savedAt||null);
    if(!silent) toast('Draft restored.','success',{ttl:1500});
  }catch(e){ if(!silent) toast('Could not restore draft.','error'); }
}
function clearDraft(){ document.getElementById('writerTitle').value=''; document.getElementById('writerBox').innerHTML=''; updateWriterCounts(); updateSavedIndicator(null); toast('Editor cleared.','info'); }
function copyDraft(){
  const t=document.getElementById('writerTitle').value||'';
  const text=t? (t+'\n\n'+stripHtml(document.getElementById('writerBox').innerHTML)) : stripHtml(document.getElementById('writerBox').innerHTML);
  navigator.clipboard.writeText(text).then(()=>toast('Copied.','success',{ttl:1200})).catch(()=>toast('Copy failed.','error'));
}
function downloadDraft(){
  const title=(document.getElementById('writerTitle').value||'recommendation-letter').replace(/[^\w\d-_ ]+/g,'').trim()||'letter';
  const text=stripHtml(document.getElementById('writerBox').innerHTML);
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.download=`${title}.txt`; a.href=URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
}
function attachDraft(){
  const title=(document.getElementById('writerTitle').value||'recommendation-letter').replace(/[^\w\d-_ ]+/g,'').trim()||'letter';
  const text=stripHtml(document.getElementById('writerBox').innerHTML).trim(); if(!text){ toast('Draft is empty.','error'); return; }
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'}); const file=new File([blob], `${title}.txt`, {type:'text/plain'}); handleFile(file,true);
}
function updateWriterCounts(){ const text=stripHtml(document.getElementById('writerBox').innerHTML); const words=text.trim()?text.trim().split(/\s+/).length:0; document.getElementById('writerCount').textContent=`${words} words • ${text.length} chars`; }
function updateSavedIndicator(ts){ const el=document.getElementById('writerSaved'); if(!ts){ el.textContent='Not saved'; return; } el.textContent='Saved '+new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function scheduleAutosave(immediate=false){ const t=document.getElementById('writerAutosaveToggle'); if(!t?.checked) return; if(writerAutosaveTimer) clearTimeout(writerAutosaveTimer); writerAutosaveTimer=setTimeout(()=>saveDraft(true), immediate?50:600); }
function setupWriter(){
  const box=document.getElementById('writerBox'); const title=document.getElementById('writerTitle'); const autosave=document.getElementById('writerAutosaveToggle');
  restoreDraft(true); updateWriterCounts();
  box.addEventListener('input', ()=>{ updateWriterCounts(); scheduleAutosave(); });
  title.addEventListener('input', ()=> scheduleAutosave() );
  autosave?.addEventListener('change', ()=>{ if(autosave.checked) scheduleAutosave(true); else if(writerAutosaveTimer){ clearTimeout(writerAutosaveTimer); writerAutosaveTimer=null; } });
  box.addEventListener('blur', ()=>{ if(document.getElementById('writerAutosaveToggle').checked) saveDraft(true); });
  title.addEventListener('blur', ()=>{ if(document.getElementById('writerAutosaveToggle').checked) saveDraft(true); });

  // Toolbar buttons using data-wcmd
  document.querySelectorAll('.writer-toolbar [data-wcmd]').forEach(btn=>{
    btn.addEventListener('click', ()=> writerCmd(btn.getAttribute('data-wcmd')));
  });

  document.getElementById('saveDraftBtn')?.addEventListener('click', ()=>saveDraft(false));
  document.getElementById('restoreDraftBtn')?.addEventListener('click', ()=>restoreDraft(false));
  document.getElementById('clearDraftBtn')?.addEventListener('click', clearDraft);
  document.getElementById('copyDraftBtn')?.addEventListener('click', copyDraft);
  document.getElementById('downloadDraftBtn')?.addEventListener('click', downloadDraft);
  document.getElementById('attachDraftBtn')?.addEventListener('click', attachDraft);
}
</script>

<script>
/* ===================== UPLOAD ===================== */
function setupUpload(){
  const fileInput = document.getElementById('fileInput');
  const chooseBtn = document.getElementById('chooseFileBtn');
  const uploadArea= document.getElementById('uploadArea');
  const removeBtn = document.getElementById('removeFileBtn');

  chooseBtn?.addEventListener('click', ()=> fileInput?.click());
  fileInput?.addEventListener('change', e=>{ if(e.target.files?.[0]) handleFile(e.target.files[0]); });

  uploadArea?.addEventListener('dragover', e=>{ e.preventDefault(); document.getElementById('uploadSection').classList.add('dragover'); });
  uploadArea?.addEventListener('dragleave', ()=> document.getElementById('uploadSection').classList.remove('dragover'));
  uploadArea?.addEventListener('drop', e=>{
    e.preventDefault(); document.getElementById('uploadSection').classList.remove('dragover');
    const f = e.dataTransfer.files?.[0]; if(f) handleFile(f);
  });

  removeBtn?.addEventListener('click', removeFile);
}

function handleFile(file, allowAny=false){
  if(!allowAny && file.type !== 'application/pdf'){ toast('Please upload a PDF file.','error'); return; }
  window.uploadedFile = file;
  document.getElementById('uploadedFile').style.display='block';
  document.getElementById('fileName').textContent = file.name;
  const sizeMB=(file.size/1024/1024).toFixed(1);
  document.getElementById('fileSize').textContent = `${sizeMB} MB • ${allowAny?'Draft attached':'Uploaded successfully'}`;
  toast(allowAny ? 'Draft attached to send queue.' : 'PDF attached. Ready to send.','success');
  updateSendButton();
}
function removeFile(){
  window.uploadedFile=null;
  document.getElementById('uploadedFile').style.display='none';
  const fi=document.getElementById('fileInput'); if(fi) fi.value='';
  updateSendButton();
}
</script>

<script>
/* ===================== SEARCH, FILTERS, PAGING ===================== */
const filters = { q:'', state:'', type:'', level:'', sort:'name_asc' };
let suggestWrap=null, activeIndex=-1, currentSuggestions=[];

function setupUniversitySearch(){
  const input = document.getElementById('universitySearch');
  const apply = document.getElementById('searchApplyBtn');
  if (!input || !apply) return;

  // suggest container sits just under input
  suggestWrap = document.getElementById('searchSuggest');

  const run = (fromApply=false)=>{
    filters.q = norm(input.value);
    page=1; flashNextRender=true;
    refreshList();
    if(fromApply) closeSuggest();
  };
  const runDebounced = debounce(()=>{ run(false); renderSuggestions(input.value); },150);

  apply.addEventListener('click', ()=> run(true));
  input.addEventListener('input', runDebounced);

  input.addEventListener('keydown', (e)=>{
    const open = suggestWrap && suggestWrap.style.display!=='none';
    if(e.key==='Enter'){
      if(open && activeIndex>=0 && currentSuggestions[activeIndex]){
        pickSuggestion(currentSuggestions[activeIndex]); e.preventDefault(); return;
      }
      e.preventDefault(); run(true); return;
    }
    if(e.key==='Escape'){ e.preventDefault(); if(open){ closeSuggest(); return; } input.value=''; run(true); }
    if(open && (e.key==='ArrowDown'||e.key==='ArrowUp')){
      e.preventDefault();
      const max=currentSuggestions.length-1;
      activeIndex = e.key==='ArrowDown' ? (activeIndex+1>max?0:activeIndex+1) : (activeIndex-1<0?max:activeIndex-1);
      updateActiveSuggestion();
    }
  });

  document.addEventListener('click',(ev)=>{
    if(!suggestWrap) return;
    if(ev.target===suggestWrap || suggestWrap.contains(ev.target)) return;
    if(ev.target===input) return;
    closeSuggest();
  });
}

function renderSuggestions(query){
  if(!suggestWrap) return;
  const q=norm(query); if(!q){ closeSuggest(); return; }
  const scored=[];
  for(const u of universities){
    const nm=norm(u.name||''), ct=norm(u.city||''), st=norm(u.state||'');
    let score=0; if(nm.startsWith(q)) score=2; else if(nm.includes(q)) score=1.5; else if(ct.includes(q)||st.includes(q)) score=1;
    if(score>0) scored.push([score,u]); if(scored.length>600) break;
  }
  scored.sort((a,b)=> b[0]-a[0] || (a[1].name||'').localeCompare(b[1].name||'')); 
  const list=scored.slice(0,10).map(x=>x[1]);
  currentSuggestions=list; activeIndex=list.length?0:-1;
  if(!list.length){ closeSuggest(); return; }

  suggestWrap.innerHTML='';
  list.forEach((u,idx)=>{
    const item=document.createElement('div'); item.className='suggest-item'; item.setAttribute('role','option'); item.setAttribute('aria-selected', idx===activeIndex?'true':'false');
    const loc=[u.city,u.state].filter(Boolean).join(', ');
    item.innerHTML = `
      <span class="material-icons" aria-hidden="true" style="font-size:1rem;">school</span>
      <div>
        <div>${highlight(u.name, query)}</div>
        ${loc?`<div class="suggest-muted">${escapeHtml(loc)}</div>`:''}
      </div>`;
    item.addEventListener('mouseenter', ()=>{ activeIndex=idx; updateActiveSuggestion(); });
    item.addEventListener('click', ()=> pickSuggestion(u) );
    suggestWrap.appendChild(item);
  });
  suggestWrap.style.display='block';
}
function highlight(text, query){
  const q=norm(query); if(!q) return escapeHtml(text);
  const i=norm(text).indexOf(q);
  if(i<0) return escapeHtml(text);
  return escapeHtml(text.slice(0,i)) + `<span class="suggest-highlight">${escapeHtml(text.slice(i,i+q.length))}</span>` + escapeHtml(text.slice(i+q.length));
}
function updateActiveSuggestion(){
  if(!suggestWrap) return;
  [...suggestWrap.children].forEach((el,i)=> el.setAttribute('aria-selected', i===activeIndex?'true':'false'));
}
function closeSuggest(){ if(!suggestWrap) return; suggestWrap.style.display='none'; activeIndex=-1; currentSuggestions=[]; }
function pickSuggestion(u){
  const input=document.getElementById('universitySearch'); input.value=u.name||'';
  filters.q = norm(u.name); page=1; flashNextRender=true; refreshList(); closeSuggest();
  const idx=filtered.findIndex(x=>String(x.unitid)===String(u.unitid));
  if(idx>=0){
    page=Math.floor(idx/pageSize)+1; refreshList();
    requestAnimationFrame(()=>{
      const cards=[...document.querySelectorAll('.university-card')];
      const startIdx=(page-1)*pageSize;
      const card=cards[idx-startIdx];
      if(card){ card.classList.add('flash'); setTimeout(()=>card.classList.remove('flash'),1000); card.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    });
  }
}

function setupFilterHandlers(){
  const stateFilter=document.getElementById('stateFilter');
  const typeFilter =document.getElementById('typeFilter');
  const levelFilter=document.getElementById('levelFilter');
  const sortBy     =document.getElementById('sortBy');
  const applyBtn   =document.getElementById('filterApplyBtn');
  const resetBtn   =document.getElementById('resetBtn');
  const selectPageBtn=document.getElementById('selectPageBtn');

  applyBtn?.addEventListener('click', ()=>{
    filters.state=stateFilter.value; filters.type=typeFilter.value; filters.level=levelFilter.value; filters.sort=sortBy.value;
    page=1; flashNextRender=true; refreshList();
  });

  resetBtn?.addEventListener('click', ()=>{
    document.getElementById('universitySearch').value=''; stateFilter.value=''; typeFilter.value=''; levelFilter.value=''; sortBy.value='name_asc';
    filters.q=filters.state=filters.type=filters.level=''; filters.sort='name_asc'; page=1; flashNextRender=true; refreshList();
    toast('Filters reset.','info',{ttl:1500});
  });

  selectPageBtn?.addEventListener('click', ()=>{
    const start=(page-1)*pageSize, end=Math.min(filtered.length, start+pageSize);
    const eff=getEffectiveSelection();
    filtered.slice(start,end).forEach(u=> eff.add(u.unitid));
    filtered.slice(start,end).forEach(u=>{
      if(studentUnitIds.has(u.unitid)) removedByRecommender.delete(u.unitid);
      else addedByRecommender.add(u.unitid);
    });
    renderPage(); updateSelectedList(); updateSendButton();
    toast('Selected all on current page.','success',{ttl:1200});
  });
}

function setupPagination(){
  const prev=document.getElementById('prevPage');
  const next=document.getElementById('nextPage');
  const ps  =document.getElementById('pageSize');
  prev?.addEventListener('click', ()=>{ if(page>1) page--; refreshList(); });
  next?.addEventListener('click', ()=>{ const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)); if(page<totalPages) page++; refreshList(); });
  ps?.addEventListener('change', e=>{ pageSize=parseInt(e.target.value,10)||40; page=1; refreshList(); });
}

function computeFiltered(){
  filtered = universities.filter(u=>{
    const q=filters.q;
    const qOk=!q || (u.name && norm(u.name).includes(q)) || (u.city && norm(u.city).includes(q)) || (u.state && norm(u.state).includes(q));
    const stOk=!filters.state || u.state===filters.state;
    const tyOk=!filters.type  || u.control===filters.type;
    const lvOk=!filters.level || u.level===filters.level;
    return qOk && stOk && tyOk && lvOk;
  });
  if(filters.sort==='name_asc') filtered.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if(filters.sort==='state_asc') filtered.sort((a,b)=>(a.state||'').localeCompare(b.state||'') || (a.name||'').localeCompare(b.name||''));
  populateUniversitySelectOptions(filtered.length?filtered:universities);
}

function updateMeta(){
  const start=filtered.length? ((page-1)*pageSize+1):0;
  const end=Math.min(filtered.length, page*pageSize);
  const meta=document.getElementById('resultMeta');
  if(meta) meta.textContent = `Showing ${start}-${end} of ${filtered.length} (from ${universities.length} total)`;
}
function updatePager(){
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  document.getElementById('pageInfo').textContent = `Page ${Math.min(page,totalPages)} of ${totalPages}`;
  document.getElementById('prevPage').disabled = (page<=1);
  document.getElementById('nextPage').disabled = (page>=totalPages);
  updateMeta();
}

function renderUniversities(list){
  const grid=document.getElementById('universityGrid'); grid.innerHTML='';
  const eff=getEffectiveSelection();
  const frag=document.createDocumentFragment();
  list.forEach(uni=>{
    const card=document.createElement('div');
    card.className='university-card'+(eff.has(uni.unitid)?' selected':'');
    card.setAttribute('role','listitem');
    card.title=uni.sector||uni.control||'';
    card.addEventListener('click', ()=> toggleUniversity(uni.unitid) );
    card.innerHTML=`
      <div class="university-header">
        <div class="university-logo">${escapeHtml((uni.name||'?').charAt(0))}</div>
        <div>
          <div class="university-name">${escapeHtml(uni.name||'Unknown Institution')}</div>
          <div class="university-location">${escapeHtml([uni.city, uni.state].filter(Boolean).join(', '))}</div>
          ${(uni.level||uni.control)?`<span class="university-pill">${[uni.control,uni.level].filter(Boolean).map(escapeHtml).join(' • ')}</span>`:''}
        </div>
      </div>`;
    if(flashNextRender){ card.classList.add('flash'); setTimeout(()=>card.classList.remove('flash'), 750); }
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

function renderPage(){
  const start=(page-1)*pageSize, end=start+pageSize;
  const slice=filtered.slice(start,end);
  renderUniversities(slice);
  updatePager();
  const grid=document.getElementById('universityGrid');
  const empty=document.getElementById('emptyState');
  if(filtered.length===0){ grid.style.display='none'; empty.style.display='block'; }
  else{ empty.style.display='none'; grid.style.display='grid'; }
  if(flashNextRender) flashNextRender=false;
}

function toggleUniversity(unitid){
  const allowEdits=document.getElementById('allowEditsToggle')?.checked;
  if(!studentProfile || allowEdits){
    if(studentUnitIds.has(unitid)){ // base had it
      if(removedByRecommender.has(unitid)) removedByRecommender.delete(unitid);
      else removedByRecommender.add(unitid);
      addedByRecommender.delete(unitid);
    } else {
      if(addedByRecommender.has(unitid)) addedByRecommender.delete(unitid);
      else addedByRecommender.add(unitid);
    }
  } else {
    if(studentUnitIds.has(unitid)){
      if(removedByRecommender.has(unitid)) removedByRecommender.delete(unitid);
      else removedByRecommender.add(unitid);
    } else {
      toast('Student has locked the list. You cannot add new universities.','error');
    }
  }
  renderPage(); updateSelectedList(); updateSendButton();
}

function removeFromEffective(unitid){
  if(studentUnitIds.has(unitid)){ removedByRecommender.add(unitid); addedByRecommender.delete(unitid); }
  else { addedByRecommender.delete(unitid); }
  renderPage(); updateSelectedList(); updateSendButton();
}
window.removeFromEffective = removeFromEffective;

function updateSelectedList(){
  const container=document.getElementById('selectedList');
  const counter=document.getElementById('selectedCount');
  const eff=getEffectiveSelection();
  counter.textContent = `${eff.size} universities selected`;
  const chips=[];
  eff.forEach(unitid=>{
    const uni = filtered.find(u=>u.unitid===unitid) || universities.find(u=>u.unitid===unitid);
    const name = uni? uni.name : 'Unknown';
    const badges=[];
    if(studentUnitIds.has(unitid)) badges.push('<span class="badge badge-student">Student</span>');
    if(addedByRecommender.has(unitid)) badges.push('<span class="badge badge-added">You added</span>');
    if(removedByRecommender.has(unitid)) badges.push('<span class="badge badge-removed">Removed</span>');
    chips.push(`
      <div class="selected-tag">
        ${escapeHtml(name)}
        ${badges.length?`<span style="margin-left:.35rem; display:inline-flex; gap:.25rem;">${badges.join('')}</span>`:''}
        <div class="remove-tag" title="Remove" onclick="removeFromEffective(${JSON.stringify(unitid)})">×</div>
      </div>`);
  });
  container.innerHTML=chips.join('');
}

function updateSendButton(){
  const btn=document.getElementById('sendBtn');
  btn.disabled = !(window.uploadedFile && getEffectiveSelection().size>0);
}
</script>

<script>
/* ===================== BROWSE-ALL DROPDOWN ===================== */
function setupUniversitySelect(){
  populateUniversitySelectOptions(universities);
  const sel=document.getElementById('universitySelect');
  if(!sel) return;
  sel.addEventListener('change', e=>{
    const val=e.target.value; if(!val) return;
    // clear filters for visibility
    document.getElementById('universitySearch').value='';
    document.getElementById('stateFilter').value='';
    document.getElementById('typeFilter').value='';
    document.getElementById('levelFilter').value='';
    filters.q=filters.state=filters.type=filters.level=''; filters.sort='name_asc';
    refreshList();

    const idx=filtered.findIndex(u=>String(u.unitid)===String(val));
    if(idx>=0){
      page=Math.floor(idx/pageSize)+1; refreshList();
      requestAnimationFrame(()=>{
        const cards=[...document.querySelectorAll('.university-card')];
        const startIdx=(page-1)*pageSize;
        const card=cards[idx-startIdx];
        if(card){ card.classList.add('flash'); setTimeout(()=>card.classList.remove('flash'),1000); card.scrollIntoView({behavior:'smooth', block:'nearest'}); }
      });
    }

    const uid=Number.isNaN(Number(val))? val : Number(val);
    if(studentUnitIds.has(uid)) removedByRecommender.delete(uid); else addedByRecommender.add(uid);
    updateSelectedList(); updateSendButton(); persistAndSync?.();
    sel.selectedIndex=0;
  });
}
function populateUniversitySelectOptions(list){
  const sel=document.getElementById('universitySelect'); if(!sel) return;
  const placeholder=sel.options[0]; sel.innerHTML=''; sel.appendChild(placeholder);
  const frag=document.createDocumentFragment();
  [...list].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).forEach(u=>{
    const opt=document.createElement('option'); opt.value=u.unitid;
    const loc=[u.city,u.state].filter(Boolean).join(', ');
    opt.textContent = `${u.name||'Unknown Institution'}${loc?' — '+loc:''}`; frag.appendChild(opt);
  });
  sel.appendChild(frag);
}
</script>

<script>
/* ===================== BULK IMPORT (optional simple match) ===================== */
function setupBulkImport(){
  const btn=document.getElementById('bulkImportBtn'); const modal=document.getElementById('importModal');
  const close=document.getElementById('importCloseBtn'); const cancel=document.getElementById('importCancelBtn');
  const confirm=document.getElementById('importConfirmBtn'); const ta=document.getElementById('importTextarea');
  const prev=document.getElementById('importPreview');

  btn?.addEventListener('click', ()=>{ modal.style.display='flex'; ta.value=''; prev.textContent=''; });
  close?.addEventListener('click', ()=> modal.style.display='none');
  cancel?.addEventListener('click', ()=> modal.style.display='none');

  confirm?.addEventListener('click', ()=>{
    const lines=(ta.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(!lines.length){ toast('Nothing to import.','error'); return; }
    const qset=new Set(lines.map(norm));
    const matches=universities.filter(u=> qset.has(norm(u.name)) );
    if(!matches.length){ toast('No exact matches. Try pasting official names.','error'); return; }

    const eff=getEffectiveSelection();
    matches.forEach(u=>{
      if(studentUnitIds.has(u.unitid)) removedByRecommender.delete(u.unitid); else addedByRecommender.add(u.unitid);
      eff.add(u.unitid);
    });
    updateSelectedList(); updateSendButton(); toast(`Added ${matches.length} matches.`,'success'); modal.style.display='none';
  });
}
</script>

<script>
/* ===================== STUDENT LOADER (mock) ===================== */
function setupStudentLoader(){
  const btn=document.getElementById('loadStudentBtn'); const input=document.getElementById('studentIdInput');
  btn?.addEventListener('click', async ()=>{
    const id=(input.value||'').trim(); if(!id){ toast('Enter a student id/email.','error'); return; }
    await loadStudentProfile(id);
  });
}
async function fetchStudentProfile(studentIdOrEmail){
  const picks=[]; const pool=[...universities].slice(0,600);
  while(picks.length<10 && pool.length){ const i=Math.floor(Math.random()*pool.length); picks.push(pool[i].unitid); pool.splice(i,1); }
  return { id:studentIdOrEmail, email:/@/.test(studentIdOrEmail)?studentIdOrEmail:(studentIdOrEmail+'@example.edu'), name:`Student ${studentIdOrEmail}`, allowRecommenderEdits:true, selectedUnitIds:picks };
}
async function loadStudentProfile(id){
  try{
    const prof=await fetchStudentProfile(id);
    studentProfile=prof; studentUnitIds=new Set(prof.selectedUnitIds||[]); addedByRecommender.clear(); removedByRecommender.clear();
    document.getElementById('studentTitle').textContent=prof.name;
    document.getElementById('studentMeta').textContent=`Preselected: ${studentUnitIds.size} universities • Edits ${prof.allowRecommenderEdits?'allowed':'locked'}`;
    document.getElementById('allowEditsToggle').checked=!!prof.allowRecommenderEdits;
    page=1; refreshList(); updateSelectedList(); updateSendButton(); toast(`Loaded ${prof.name}.`,'success');
    persistAndSync?.();
  }catch(e){ console.error(e); toast('Could not load student profile.','error'); }
}
</script>

<script>
/* ===================== SEND FLOW (simulated) ===================== */
function setupSendHandler(){
  document.getElementById('sendBtn')?.addEventListener('click', ()=>{
    const eff=getEffectiveSelection();
    if(!window.uploadedFile){ toast('Please upload a file first.','error'); return; }
    if(eff.size===0){ toast('Select at least one university.','error'); return; }
    beginSend(eff);
  });
}
function beginSend(effective){
  const container=document.getElementById('progressList'); container.innerHTML='';
  document.querySelector('.send-section').style.display='block';
  const unis=[...effective].map(uid=> filtered.find(u=>u.unitid===uid)||universities.find(u=>u.unitid===uid)).filter(Boolean);
  let completed=0;
  unis.forEach((uni,i)=>{
    const div=document.createElement('div'); div.className='delivery-item';
    div.innerHTML=`
      <div class="delivery-status pending">…</div>
      <div>
        <div style="font-weight:600">${escapeHtml(uni.name||'Unknown')}</div>
        <div style="font-size:.85rem; color:#666">Sending…</div>
      </div>`;
    container.appendChild(div);
    setTimeout(()=>{
      completed++;
      const ok=Math.random()>0.08;
      const s=div.querySelector('.delivery-status'); const m=div.querySelector('div div:last-child');
      if(ok){ s.className='delivery-status success'; s.textContent='✓'; m.textContent='Delivered successfully'; }
      else  { s.className='delivery-status error';   s.textContent='!'; m.textContent='Failed to deliver'; }
      updateProgress(completed, unis.length);
      if(completed===unis.length){ toast('Send complete.','success'); showSuccess(); }
    }, 1000 + i*450);
  });
}
function updateProgress(done,total){
  const fill=document.getElementById('progressFill'); const txt=document.getElementById('progressText');
  const pct=Math.round((done/total)*100); fill.style.width=pct+'%'; txt.textContent=`Sent ${done} of ${total} (${pct}%)`;
}
function showSuccess(){ document.getElementById('successSection').style.display='block'; }
</script>

<script>
/* ===================== DATASET LOADER (single source of truth) ===================== */
async function loadDataset(){
  try{
    const candidates=[
      'assets/us_institutions_by_state_2023.json',
      '/assets/us_institutions_by_state_2023.json',
      'https://raw.githubusercontent.com/swetharajan7/StellarRec/main/assets/us_institutions_by_state_2023.json',
      'https://cdn.jsdelivr.net/gh/swetharajan7/StellarRec@main/assets/us_institutions_by_state_2023.json'
    ];
    let data=null;
    for(const url of candidates){
      try{
        const resp=await fetch(url+(url.startsWith('http')?'':`?v=${Date.now()}`), {credentials:'omit', cache:'no-store'});
        if(!resp.ok) throw new Error(resp.status);
        let txt=await resp.text();
        txt=txt.replace(/\b-?Infinity\b/g,'null').replace(/\bNaN\b/g,'null').replace(/,\s*([}\]])/g,'$1');
        data=JSON.parse(txt); break;
      }catch(e){ console.warn('[dataset] fallback ->', url, e); }
    }
    if(!data) throw new Error('No dataset loaded');
    universities = Array.isArray(data) ? data : (data && typeof data==='object' ? Object.values(data).flat() : []);
    universities = universities.map(u=>({
      unitid:u.unitid??u.UNITID??u.id,
      name:u.name??u.INSTNM??'Unknown',
      city:u.city??u.CITY??'',
      state:u.state??u.STABBR??'',
      control:u.control??u.CONTROL??'',
      level:u.level??u.ICLEVEL??'',
      sector:u.sector??u.SECTOR??''
    })).filter(u=>u.unitid && u.name);

    // hydrate browse-all placeholder
    const sel=document.getElementById('universitySelect');
    if(sel && sel.options[0]) sel.options[0].textContent=`Browse all universities (${universities.length.toLocaleString()})`;

    refreshList(); updateSelectedList(); updateSendButton();
  }catch(err){
    console.error(err); toast('Failed to load universities list.','error');
    document.getElementById('resultMeta').textContent='Failed to load universities.';
    document.getElementById('emptyState').style.display='block';
    document.getElementById('universityGrid').style.display='none';
    const rb=document.getElementById('retryLoadBtn'); if(rb){ rb.style.display='inline-block'; rb.onclick=()=>location.reload(); }
  }
}
function refreshList(){ computeFiltered(); renderPage(); }
</script>

<script>
/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', ()=>{
  // Writer
  setupWriter();
  // Upload
  setupUpload();
  // Search/filter/paging
  setupUniversitySearch();
  setupFilterHandlers();
  setupPagination();
  // Browse-all dropdown
  setupUniversitySelect();
  // Bulk import
  setupBulkImport();
  // Student loader (mock)
  setupStudentLoader();
  // Send
  setupSendHandler();
  // Dataset
  loadDataset();

  // Tagline hotfix
  const h1=document.querySelector('.hero-title'); if(h1) h1.textContent='One upload. Unlimited reach.';
});
</script>
<footer class="site-footer">
  <div class="container">
    <p>&copy; 2025 <span style="color: #ffeb3b; font-weight: 600;">StellarRec™</span>. All rights reserved. |
      Making recommendations stellar since 2025 🚀</p>
  </div>
</footer>
<script>
  // Avatar dropdown toggle
  const avatarBtn = document.getElementById('userAvatarBtn'); // the person icon button
  const userDropdown = document.getElementById('userDropdown');

  function closeDropdown(){
    if (!userDropdown) return;
    userDropdown.classList.remove('show');
    if (avatarBtn) avatarBtn.setAttribute('aria-expanded','false');
  }

  function toggleDropdown(e){
    if (!userDropdown) return;
    e?.stopPropagation();
    const isOpen = userDropdown.classList.contains('show');
    if (isOpen) {
      closeDropdown();
    } else {
      userDropdown.classList.add('show');
      if (avatarBtn) avatarBtn.setAttribute('aria-expanded','true');
    }
  }

  // Open/close on avatar click
  if (avatarBtn) {
    avatarBtn.addEventListener('click', toggleDropdown);
  }

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!userDropdown) return;
    const clickInside = userDropdown.contains(e.target) || avatarBtn.contains(e.target);
    if (!clickInside) closeDropdown();
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  // “How it works” -> go to /university-portal/
  const howItWorksItem = document.getElementById('howItWorksItem');
  if (howItWorksItem) {
    const go = () => { window.location.href = '/university-portal/'; };
    // Click or Enter key
    howItWorksItem.addEventListener('click', (e) => { e.preventDefault(); go(); });
    howItWorksItem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  }
</script>
<script>
/* === Avatar Dropdown — Robust Wire-Up ===
   Paste this at the very end of dashboard.html, just before </body>.
   It tolerates older inline onclick handlers and conflicting code. */

(function () {
  const avatar = document.getElementById('userAvatarBtn');
  const dropdown = document.getElementById('userDropdown');

  if (!avatar || !dropdown) {
    console.warn('[SR] Dropdown wiring: missing #userAvatarBtn or #userDropdown');
    return;
  }

  // Safety: ensure parent is positioned so absolute dropdown anchors correctly
  const userInfo = avatar.closest('.user-info');
  if (userInfo && getComputedStyle(userInfo).position === 'static') {
    userInfo.style.position = 'relative';
  }

  // Helper: open/close handlers
  function openDropdown() {
    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
    avatar.setAttribute('aria-expanded', 'true');
  }
  function closeDropdown() {
    dropdown.classList.remove('show');
    dropdown.setAttribute('aria-hidden', 'true');
    avatar.setAttribute('aria-expanded', 'false');
  }
  function isOpen() {
    return dropdown.classList.contains('show');
  }
  function toggleDropdown(event) {
    event && event.stopPropagation();
    isOpen() ? closeDropdown() : openDropdown();
  }

  // Make it globally available if older HTML uses onclick="toggleUserDropdown()"
  window.toggleUserDropdown = toggleDropdown;

  // Remove any existing listeners we may have added before (defensive)
  avatar.replaceWith(avatar.cloneNode(true));
  const freshAvatar = document.getElementById('userAvatarBtn');

  // Rebind to the fresh node
  freshAvatar.addEventListener('click', toggleDropdown);
  freshAvatar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDropdown(e); }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    const clickedInside = dropdown.contains(e.target) || freshAvatar.contains(e.target);
    if (!clickedInside && isOpen()) closeDropdown();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeDropdown();
  });

  // Accessibility niceties
  dropdown.setAttribute('role', dropdown.getAttribute('role') || 'menu');
  dropdown.setAttribute('aria-hidden', 'true');

  // Log to help troubleshoot in DevTools
  console.log('[SR] Dropdown wired. Click the person icon to toggle.');
})();
</script>


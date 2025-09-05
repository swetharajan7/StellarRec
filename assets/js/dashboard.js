/* ===================== tiny toast ===================== */
(function(){
  window.toast = function(msg, type='info', opts={}){
    const wrap = document.getElementById('toastWrap') || (()=>{ 
      const d=document.createElement('div'); 
      d.id='toastWrap'; 
      d.className='toast-wrap'; 
      document.body.appendChild(d); 
      return d; 
    })();
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

/* ===================== utilities & state ===================== */
const norm = s => (s||'').toString().trim().toLowerCase();

if (typeof window.updateSendButton !== 'function') {
  window.updateSendButton = function () {
    const sendBtn = document.getElementById('sendBtn');
    if (!sendBtn) return;
    const hasFile = !!window.uploadedFile;
    const selectedList = document.getElementById('selectedList');
    const selectedCount = selectedList ? selectedList.children.length : 0;
    sendBtn.disabled = !(hasFile && selectedCount > 0);
  };
}

/* ===================== THEME BUTTON (center) ===================== */
function themeButtonInit(){
  const KEY = 'sr_theme';
  const root = document.documentElement;
  const btn  = document.getElementById('headerThemeBtn');

  const saved = localStorage.getItem(KEY) || 'light';
  root.dataset.theme = (saved === 'dark') ? 'dark' : 'light';
  if (btn) btn.setAttribute('aria-pressed', saved === 'dark' ? 'true' : 'false');

  function toggleTheme(){
    const current = root.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem(KEY, next);
    if (btn) btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    window.toast?.(`Theme: ${next}`, 'info', { ttl: 1200 });
  }

  btn?.addEventListener('click', toggleTheme);
}

/* ===================== UPLOAD (PDF + size warning) ===================== */
const MAX_WARN_MB = 10;
const HARD_LIMIT_MB = null; // set a number to hard-reject files

function setupUpload(){
  const fileInput  = document.getElementById('fileInput');
  const chooseBtn  = document.getElementById('chooseFileBtn');
  const uploadArea = document.getElementById('uploadArea');
  const removeBtn  = document.getElementById('removeFileBtn');

  chooseBtn?.addEventListener('click', (e)=>{ e.preventDefault(); fileInput?.click(); });
  fileInput?.addEventListener('change', (e)=>{ const f = e.target.files && e.target.files[0]; if (f) handleFile(f); });

  // drag-n-drop
  if (uploadArea){
    uploadArea.addEventListener('dragover', (e)=>{ e.preventDefault(); document.getElementById('uploadSection')?.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', ()=> document.getElementById('uploadSection')?.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e)=>{
      e.preventDefault();
      document.getElementById('uploadSection')?.classList.remove('dragover');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  removeBtn?.addEventListener('click', removeFile);
}

function isPdf(file){
  return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

function handleFile(file){
  if (!isPdf(file)) { toast('Please upload a PDF file.', 'error'); return; }
  const sizeMB = file.size / 1024 / 1024;
  if (HARD_LIMIT_MB && sizeMB > HARD_LIMIT_MB) { toast(`File is ${sizeMB.toFixed(1)} MB — limit ${HARD_LIMIT_MB} MB.`, 'error', {ttl:4000}); return; }
  if (sizeMB > MAX_WARN_MB) toast(`Heads up: ${sizeMB.toFixed(1)} MB is large. Recommended ≤ ${MAX_WARN_MB} MB.`, 'info', {ttl:3500});

  window.uploadedFile = file;

  document.getElementById('uploadedFile')?.style && (document.getElementById('uploadedFile').style.display = 'block');
  const nameEl = document.getElementById('fileName');
  const sizeEl = document.getElementById('fileSize');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${sizeMB.toFixed(1)} MB • Uploaded successfully`;

  toast('PDF attached. Ready to send.', 'success');
  updateSendButton();

  const selSection = document.querySelector('.selected-section');
  if (selSection) {
    selSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.classList.add('flash');
      setTimeout(()=> sendBtn.classList.remove('flash'), 900);
    }
  }
}

function removeFile(){
  window.uploadedFile = null;
  const uploadedBox = document.getElementById('uploadedFile');
  if (uploadedBox) uploadedBox.style.display = 'none';
  const fi = document.getElementById('fileInput');
  if (fi) fi.value = '';
  updateSendButton();
  toast('Attachment removed.', 'info');
}

/* ===================== PRESELECT AFTER DATA LOAD ===================== */
function preselectByName(universityName) {
  try {
    if (!Array.isArray(window.universities) || !universities.length) return;
    const targetName = norm(universityName);
    let match = universities.find(u => norm(u.name) === targetName) 
             || universities.find(u => norm(u.name).includes(targetName));
    if (!match) return;

    window.studentUnitIds = window.studentUnitIds || new Set();
    window.addedByRecommender = window.addedByRecommender || new Set();
    window.removedByRecommender = window.removedByRecommender || new Set();

    if (studentUnitIds.has(match.unitid)) removedByRecommender.delete(match.unitid);
    else addedByRecommender.add(match.unitid);

    window.updateSelectedList?.();
    window.updateSendButton?.();
    toast(`Preselected: ${match.name}`, 'success', { ttl: 1500 });
  } catch (e) {
    console.warn('[SR] preselectByName error:', e);
  }
}

// run preselect after loadDataset completes (if present)
(function wrapLoadDatasetForPreselect(){
  if (typeof window.loadDataset !== 'function') {
    const obs = new MutationObserver(() => {
      if (typeof window.loadDataset === 'function') {
        const original = window.loadDataset;
        window.loadDataset = async function(...args) {
          const result = await original.apply(this, args);
          preselectByName('Experimental University');
          return result;
        };
        obs.disconnect();
      }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  } else {
    const original = window.loadDataset;
    window.loadDataset = async function(...args) {
      const result = await original.apply(this, args);
      preselectByName('Experimental University');
      return result;
    };
  }
})();
/* ===================== USER DROPDOWN (no “how it works” override) ===================== */
function setupUserDropdown() {
  const avatarBtn = document.getElementById('userAvatarBtn');
  const dropdown  = document.getElementById('userDropdown');
  const contactAdminItem = document.getElementById('contactAdminItem');
  if (!avatarBtn || !dropdown) return;

  let isOpen = false;
  function openDropdown() {
    dropdown.classList.add('show');
    avatarBtn.setAttribute('aria-expanded', 'true');
    dropdown.setAttribute('aria-hidden', 'false');
    isOpen = true;
  }
  function closeDropdown() {
    dropdown.classList.remove('show');
    avatarBtn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
    isOpen = false;
  }
  function toggleDropdown() { isOpen ? closeDropdown() : openDropdown(); }

  avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(); });
  document.addEventListener('click', (e) => { if (isOpen && !e.target.closest('.user-info')) closeDropdown(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) closeDropdown(); });

  // Contact Admin (open overlay modal)
  contactAdminItem?.addEventListener('click', () => {
    openContactOverlay();
    closeDropdown();
  });

  function openContactOverlay(){
    const overlay = document.getElementById('contactOverlay');
    if (!overlay) { toast('Contact admin would open here.', 'info'); return; }
    overlay.style.display = 'flex';
    setTimeout(() => {
      const panel = overlay.querySelector('div[style*="transform"]') || overlay.querySelector('div > div');
      if (panel) { panel.style.transform = 'translateY(0)'; panel.style.opacity = '1'; }
    }, 10);
  }

  // Overlay buttons
  document.getElementById('contactCloseBtn2')?.addEventListener('click', ()=> closeOverlay());
  document.getElementById('contactCancelBtn2')?.addEventListener('click', ()=> closeOverlay());
  function closeOverlay(){
    const overlay = document.getElementById('contactOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  // Legacy small modal (if used)
  document.getElementById('contactCloseBtn')?.addEventListener('click', ()=> closeLegacy());
  document.getElementById('contactCancelBtn')?.addEventListener('click', ()=> closeLegacy());
  function closeLegacy(){
    const modal = document.getElementById('contactModal');
    if (!modal) return;
    modal.style.display = 'none';
  }
}

/* ===================== BULK IMPORT (button lives inside white box) ===================== */
function setupBulkImport(){
  const openBtn  = document.getElementById('bulkImportBtn');
  const modal    = document.getElementById('importModal');
  const closeBtn = document.getElementById('importCloseBtn');
  const cancel   = document.getElementById('importCancelBtn');
  const confirm  = document.getElementById('importConfirmBtn');
  const textarea = document.getElementById('importTextarea');
  const preview  = document.getElementById('importPreview');

  if (!openBtn || !modal) return;

  openBtn.addEventListener('click', ()=> {
    modal.style.display = 'flex';
    textarea.value = '';
    preview.textContent = '';
    textarea.focus();
  });
  function close(){ modal.style.display = 'none'; }
  closeBtn?.addEventListener('click', close);
  cancel?.addEventListener('click', close);

  // Live preview: count lines + found matches
  textarea?.addEventListener('input', ()=>{
    const lines = textarea.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const unique = Array.from(new Set(lines));
    const total = unique.length;
    let matches = 0;
    if (Array.isArray(window.universities) && total){
      for (const name of unique){
        const q = norm(name);
        const hit = window.universities.find(u => norm(u.name).includes(q));
        if (hit) matches++;
      }
    }
    preview.textContent = total ? `Entries: ${total} • Potential matches: ${matches}` : '';
  });

  confirm?.addEventListener('click', ()=>{
    if (!Array.isArray(window.universities)) { toast('University dataset not loaded yet.', 'error'); return; }
    const names = textarea.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (!names.length) { toast('Paste at least one university name.', 'error'); return; }

    // simple fuzzy "includes" match per line
    const chosen = [];
    for (const raw of Array.from(new Set(names))){
      const q = norm(raw);
      const u = window.universities.find(x => norm(x.name).includes(q));
      if (u) chosen.push(u);
    }

    if (!chosen.length){ toast('No matches found. Try shorter names (e.g., "Carnegie Mellon").', 'info'); return; }

    window.studentUnitIds = window.studentUnitIds || new Set();
    window.addedByRecommender = window.addedByRecommender || new Set();
    window.removedByRecommender = window.removedByRecommender || new Set();

    for (const u of chosen){
      if (window.studentUnitIds.has(u.unitid)) {
        window.removedByRecommender.delete(u.unitid);
      } else {
        window.addedByRecommender.add(u.unitid);
      }
    }

    window.updateSelectedList?.();
    window.updateSendButton?.();
    toast(`Added ${chosen.length} match${chosen.length>1?'es':''} from bulk import.`, 'success');
    close();
  });
}
/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // If your data loader exists, it will run; preselect is patched above.
  if (typeof loadDataset === 'function') loadDataset();

  // Upload & theme
  setupUpload();
  themeButtonInit();

  // Dropdown & bulk import
  setupUserDropdown();
  setupBulkImport();

  // IMPORTANT: We intentionally DO NOT call any old search/filter/pagination initializers here,
  // because those are now implemented inline in your HTML. If you still have functions like
  // setupUniversitySearch()/setupFilterHandlers()/setupPagination() in older code, remove their calls.

  // Tagline hotfix (optional)
  const h1 = document.querySelector('.hero-title');
  if (h1) h1.textContent = 'One upload. Unlimited reach.';
});

/* Optional global exports (handy for debugging) */
window.SR = Object.assign(window.SR||{}, {
  preselectByName
});




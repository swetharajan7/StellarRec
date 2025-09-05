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
const escapeHtml = s => (s??'').toString()
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const debounce = (fn,wait=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; };

/* Keep Send button state sensible even if other code isn't loaded yet */
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

/* ===================== UPLOAD (robust + size warning) ===================== */
const MAX_WARN_MB = 10;     // soft warn threshold
const HARD_LIMIT_MB = null; // set a number to hard-reject large files

function setupUpload(){
  const fileInput  = document.getElementById('fileInput');
  const chooseBtn  = document.getElementById('chooseFileBtn');
  const uploadArea = document.getElementById('uploadArea');
  const removeBtn  = document.getElementById('removeFileBtn');

  // 1) button opens picker
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', (e)=> {
      e.preventDefault();
      fileInput.click();
    });
  }

  // 2) picker -> handle file
  fileInput?.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  // 3) drag & drop
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e)=>{ 
      e.preventDefault(); 
      document.getElementById('uploadSection')?.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', ()=>{ 
      document.getElementById('uploadSection')?.classList.remove('dragover'); 
    });
    uploadArea.addEventListener('drop', (e)=>{
      e.preventDefault();
      document.getElementById('uploadSection')?.classList.remove('dragover');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  // 4) remove file
  removeBtn?.addEventListener('click', removeFile);
}

function isPdf(file){
  return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

function handleFile(file){
  if (!isPdf(file)) { toast('Please upload a PDF file.', 'error'); return; }

  const sizeMB = file.size / 1024 / 1024;
  if (HARD_LIMIT_MB && sizeMB > HARD_LIMIT_MB) {
    toast(`File is ${sizeMB.toFixed(1)} MB — the limit is ${HARD_LIMIT_MB} MB.`, 'error', { ttl: 4000 });
    return;
  }
  if (sizeMB > MAX_WARN_MB) {
    toast(`Heads up: ${sizeMB.toFixed(1)} MB is large. Recommended ≤ ${MAX_WARN_MB} MB.`, 'info', { ttl: 3500 });
  }

  window.uploadedFile = file;

  const uploadedBox = document.getElementById('uploadedFile');
  if (uploadedBox) uploadedBox.style.display = 'block';

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

/* ===================== Preselect “Experimental University” ===================== */
function preselectByName(universityName) {
  try {
    if (!window.universities || !universities.length) return;
    const targetName = norm(universityName);
    let match = universities.find(u => norm(u.name) === targetName);
    if (!match) match = universities.find(u => norm(u.name).includes(targetName));
    if (!match) { console.warn('[SR] Could not find university named:', universityName); return; }

    const id = match.unitid;
    window.studentUnitIds = window.studentUnitIds || new Set();
    window.addedByRecommender = window.addedByRecommender || new Set();
    window.removedByRecommender = window.removedByRecommender || new Set();

    if (studentUnitIds.has(id)) removedByRecommender.delete(id);
    else addedByRecommender.add(id);

    if (typeof refreshList === 'function') refreshList();
    if (typeof updateSelectedList === 'function') updateSelectedList();
    updateSendButton();

    const selSection = document.querySelector('.selected-section');
    if (selSection) selSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`Preselected: ${match.name}`, 'success', { ttl: 1500 });
  } catch (e) {
    console.warn('[SR] preselectByName error:', e);
  }
}

/* Patch loadDataset so preselect runs AFTER first render */
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

/* ===================== SINGLE INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof setupWriter === 'function') setupWriter();
  if (typeof setupUniversitySearch === 'function') setupUniversitySearch();
  if (typeof setupFilterHandlers === 'function') setupFilterHandlers();
  if (typeof setupPagination === 'function') setupPagination();
  if (typeof setupUniversitySelect === 'function') setupUniversitySelect();
  if (typeof setupBulkImport === 'function') setupBulkImport();
  if (typeof setupStudentLoader === 'function') setupStudentLoader();
  if (typeof setupSendHandler === 'function') setupSendHandler();
  if (typeof loadDataset === 'function') loadDataset();

  setupUpload();
  setupUserDropdown();   // defined in Chunk 2
  themeButtonInit();     // defined in Chunk 3

  // Restore last view if you use multi-panels (safe no-op if not present)
  const savedView = localStorage.getItem('sr_current_view');
  if (savedView && (savedView === 'recommender' || savedView === 'student')) {
    switchView(savedView);
  }

  // Tagline hotfix
  const h1 = document.querySelector('.hero-title');
  if (h1) h1.textContent = 'One upload. Unlimited reach.';
});
/* ===================== USER DROPDOWN FUNCTIONALITY ===================== */
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
    const firstItem = dropdown.querySelector('.dropdown-item[role="menuitem"]');
    if (firstItem) setTimeout(() => firstItem.focus(), 50);
  }
  function closeDropdown() {
    dropdown.classList.remove('show');
    avatarBtn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
    isOpen = false;
  }
  function toggleDropdown() { isOpen ? closeDropdown() : openDropdown(); }

  avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(); });

  // Close on outside click / Esc
  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('.user-info')) closeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeDropdown();
  });

  // SAME-TAB "How it works" — prefer the anchor inside the item if present
  const howItWorksLink = dropdown.querySelector('a.view-name[href*="portal-signin"]');
  const howItWorksItem = howItWorksLink ? howItWorksLink.closest('.dropdown-item') : null;

  if (howItWorksLink) {
    // Let the anchor behave normally (same tab). Also make the whole row clickable.
    howItWorksItem?.addEventListener('click', (e) => {
      // If they didn't click the anchor directly, navigate to the same URL in the same tab.
      if (!(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        window.location.assign(howItWorksLink.href);
      }
      closeDropdown();
    });
  }

  // Contact Admin
  if (contactAdminItem) {
    contactAdminItem.addEventListener('click', () => {
      openContactModal();
      closeDropdown();
    });
  }

  // Optional: if you keep recommender/student items with [data-sr-view], handle them
  dropdown.addEventListener('click', (e) => {
    const viewItem = e.target.closest('[data-sr-view]');
    if (viewItem) {
      const view = viewItem.getAttribute('data-sr-view');
      switchView(view, e);
      closeDropdown();
    }
  });

  function openContactModal() {
    const modal = document.getElementById('contactOverlay') || document.getElementById('contactModal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        const content = modal.querySelector('div > div');
        if (content) {
          content.style.transform = 'translateY(0)';
          content.style.opacity = '1';
        }
      }, 10);
      const firstInput = modal.querySelector('input, textarea');
      if (firstInput) setTimeout(() => firstInput.focus(), 120);
    } else {
      toast('Contact admin would open here.', 'info');
    }
  }
}

/* ===================== VIEW SWITCHING FUNCTIONALITY ===================== */
function switchView(view, event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }

  // Update active states in dropdown, if those items exist
  document.querySelectorAll('[data-sr-view]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-sr-view') === view);
  });

  // Update any tabs if they exist (safe no-op if you removed them)
  document.querySelectorAll('.sr-tab').forEach(tab => {
    const isActive = tab.id === `tab-${view}`;
    tab.setAttribute('aria-selected', isActive.toString());
  });

  // Show panel if you are using multi-panel layout
  document.querySelectorAll('[id^="panel-"]').forEach(panel => {
    const panelView = panel.id.replace('panel-', '');
    panel.style.display = panelView === view ? 'block' : 'none';
  });

  localStorage.setItem('sr_current_view', view);
  toast(`Switched to ${view} view`, 'success', { ttl: 1200 });
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

/* Optional global exports (handy for debugging) */
window.SR = Object.assign(window.SR||{}, {
  preselectByName,
  switchView
});



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

/* If the rest of your app defines these, great; if not, this fallback keeps Send enabled/disabled logically */
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

/* ===================== THEME ===================== */
(function themeInit(){
  const KEY='sr_theme';
  function apply(t){ document.body.classList.toggle('sr-dark', t==='dark'); }
  apply(localStorage.getItem(KEY)||'light');
  const tgl = document.getElementById('themeToggle');
  if (tgl) {
    tgl.checked = (localStorage.getItem(KEY)==='dark');
    tgl.onchange = e=>{ 
      const mode=e.target.checked?'dark':'light'; 
      localStorage.setItem(KEY,mode); 
      apply(mode); 
      toast(`Theme: ${mode}`,'info',{ttl:1200}); 
    };
  }
})();

/* ===================== UPLOAD (robust + size warning) ===================== */
/** SETTINGS **/
const MAX_WARN_MB = 10;     // show a warning if the file is larger than this
const HARD_LIMIT_MB = null; // set to a number (e.g. 20) to REJECT files over that limit, or leave null for no hard cap

function setupUpload(){
  const fileInput  = document.getElementById('fileInput');      // <input type="file" ...>
  const chooseBtn  = document.getElementById('chooseFileBtn');  // “Choose File” button
  const uploadArea = document.getElementById('uploadArea');     // big drag-drop box
  const removeBtn  = document.getElementById('removeFileBtn');  // little [x] on the file pill

  // 1) button opens file picker
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', (e)=> {
      e.preventDefault();
      fileInput.click();
    });
  }

  // 2) file picker -> handle file
  fileInput?.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  // 3) drag & drop events
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

// detect PDF by MIME or filename
function isPdf(file){
  return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

function handleFile(file){
  // 1) type check
  if (!isPdf(file)) {
    toast('Please upload a PDF file.', 'error');
    return;
  }

  // 2) size checks
  const sizeMB = file.size / 1024 / 1024;

  if (HARD_LIMIT_MB && sizeMB > HARD_LIMIT_MB) {
    toast(`File is ${sizeMB.toFixed(1)} MB — the limit is ${HARD_LIMIT_MB} MB. Please upload a smaller PDF.`, 'error', { ttl: 4000 });
    return;
  }

  if (sizeMB > MAX_WARN_MB) {
    // soft warning only — we still accept the file
    toast(`Heads up: ${sizeMB.toFixed(1)} MB is large. Recommended ≤ ${MAX_WARN_MB} MB.`, 'info', { ttl: 3500 });
  }

  // 3) reflect in UI and connect with "Selected Universities"
  window.uploadedFile = file;

  // show the “uploaded-file” panel
  const uploadedBox = document.getElementById('uploadedFile');
  if (uploadedBox) uploadedBox.style.display = 'block';

  // set file name and size
  const nameEl = document.getElementById('fileName');
  const sizeEl = document.getElementById('fileSize');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${sizeMB.toFixed(1)} MB • Uploaded successfully`;

  // confirm to the user
  toast('PDF attached. Ready to send.', 'success');

  // IMPORTANT: this connects the upload with the Selected Universities send button
  updateSendButton();  // enables the Send button if there are selected universities

  // (optional) scroll to the “Selected Universities” section so they see the button enable
  const selSection = document.querySelector('.selected-section');
  if (selSection) {
    selSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // brief visual nudge on the Send button if available
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
  if (fi) fi.value = ''; // clear the picker

  updateSendButton(); // disables Send if no file
  toast('Attachment removed.', 'info');
}

/* ===================== Preselect “Experimental University” ===================== */
/* This helper marks a university as selected by its name, then refreshes UI. */
function preselectByName(universityName) {
  try {
    if (!window.universities || !universities.length) return;

    const targetName = norm(universityName);
    // exact match first
    let match = universities.find(u => norm(u.name) === targetName);
    // fallback contains
    if (!match) match = universities.find(u => norm(u.name).includes(targetName));
    if (!match) {
      console.warn('[SR] Could not find university named:', universityName);
      return;
    }

    const id = match.unitid;

    // ensure Sets exist (they're defined in your other script file)
    window.studentUnitIds = window.studentUnitIds || new Set();
    window.addedByRecommender = window.addedByRecommender || new Set();
    window.removedByRecommender = window.removedByRecommender || new Set();

    if (studentUnitIds.has(id)) {
      removedByRecommender.delete(id);
    } else {
      addedByRecommender.add(id);
    }

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

/* Wrap your existing loadDataset() so preselect runs AFTER data loads & first render */
(function wrapLoadDatasetForPreselect(){
  if (typeof window.loadDataset !== 'function') {
    // If loadDataset gets defined later, patch it then.
    const obs = new MutationObserver(() => {
      if (typeof window.loadDataset === 'function') {
        const original = window.loadDataset;
        window.loadDataset = async function(...args) {
          const result = await original.apply(this, args);
          // after your success path (refreshList/updateSelectedList/updateSendButton), do the preselect:
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

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // If you have these elsewhere, they’ll run; if not, no problem.
  if (typeof setupWriter === 'function') setupWriter();
  if (typeof setupUniversitySearch === 'function') setupUniversitySearch();
  if (typeof setupFilterHandlers === 'function') setupFilterHandlers();
  if (typeof setupPagination === 'function') setupPagination();
  if (typeof setupUniversitySelect === 'function') setupUniversitySelect();
  if (typeof setupBulkImport === 'function') setupBulkImport();
  if (typeof setupStudentLoader === 'function') setupStudentLoader();
  if (typeof setupSendHandler === 'function') setupSendHandler();
  if (typeof loadDataset === 'function') loadDataset();

  // Upload must run after the DOM exists
  setupUpload();

  // Tagline hotfix (kept from your version)
  const h1=document.querySelector('.hero-title'); 
  if(h1) h1.textContent='One upload. Unlimited reach.';
});
/* ===================== USER DROPDOWN FUNCTIONALITY ===================== */
function setupUserDropdown() {
  const avatarBtn = document.getElementById('userAvatarBtn');
  const dropdown = document.getElementById('userDropdown');
  const howItWorksItem = document.getElementById('howItWorksItem');
  const contactAdminItem = document.getElementById('contactAdminItem');
  
  if (!avatarBtn || !dropdown) return;
  
  let isOpen = false;
  
  // Toggle dropdown on avatar click
  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('.user-info')) {
      closeDropdown();
    }
  });
  
  // Handle keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeDropdown();
    }
  });
  
  // Handle "How It Works" click
  if (howItWorksItem) {
    howItWorksItem.addEventListener('click', () => {
      // Open university portal in new tab
      window.open('https://stellarrec.netlify.app/university-portal/', '_blank');
      closeDropdown();
      toast('Opening university portal...', 'info', { ttl: 1500 });
    });
    
    // Make it keyboard accessible
    howItWorksItem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        howItWorksItem.click();
      }
    });
  }
  
  // Handle "Contact Admin" click
  if (contactAdminItem) {
    contactAdminItem.addEventListener('click', () => {
      openContactModal();
      closeDropdown();
    });
  }
  
  // Handle view switching (Recommender/Student)
  dropdown.addEventListener('click', (e) => {
    const viewItem = e.target.closest('[data-sr-view]');
    if (viewItem) {
      const view = viewItem.getAttribute('data-sr-view');
      switchView(view, e);
      closeDropdown();
    }
  });
  
  function toggleDropdown() {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }
  
  function openDropdown() {
    dropdown.classList.add('show');
    avatarBtn.setAttribute('aria-expanded', 'true');
    dropdown.setAttribute('aria-hidden', 'false');
    isOpen = true;
    
    // Focus first item for accessibility
    const firstItem = dropdown.querySelector('.dropdown-item[role="menuitem"]');
    if (firstItem) {
      setTimeout(() => firstItem.focus(), 100);
    }
  }
  
  function closeDropdown() {
    dropdown.classList.remove('show');
    avatarBtn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
    isOpen = false;
  }
  
  function openContactModal() {
    const modal = document.getElementById('contactOverlay') || document.getElementById('contactModal');
    if (modal) {
      modal.style.display = 'flex';
      // Animate in
      setTimeout(() => {
        const content = modal.querySelector('div > div');
        if (content) {
          content.style.transform = 'translateY(0)';
          content.style.opacity = '1';
        }
      }, 10);
      
      // Focus first input
      const firstInput = modal.querySelector('input, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 150);
      }
    } else {
      // Fallback if modal doesn't exist
      toast('Contact admin functionality would open here', 'info');
    }
  }
}

/* ===================== VIEW SWITCHING FUNCTIONALITY ===================== */
function switchView(view, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Update active states in dropdown
  const dropdownItems = document.querySelectorAll('[data-sr-view]');
  dropdownItems.forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-sr-view') === view);
  });
  
  // Update tab states
  const tabs = document.querySelectorAll('.sr-tab');
  tabs.forEach(tab => {
    const isActive = tab.id === `tab-${view}`;
    tab.setAttribute('aria-selected', isActive.toString());
  });
  
  // Show appropriate content (if you have different panels)
  const panels = document.querySelectorAll('[id^="panel-"]');
  panels.forEach(panel => {
    const panelView = panel.id.replace('panel-', '');
    panel.style.display = panelView === view ? 'block' : 'none';
  });
  
  // Store current view
  localStorage.setItem('sr_current_view', view);
  
  // Show feedback
  toast(`Switched to ${view} view`, 'success', { ttl: 1200 });
}

/* ===================== INITIALIZATION UPDATE ===================== */
// Update your existing DOMContentLoaded listener to include the dropdown setup
document.addEventListener('DOMContentLoaded', () => {
  // Your existing setup calls...
  if (typeof setupWriter === 'function') setupWriter();
  if (typeof setupUniversitySearch === 'function') setupUniversitySearch();
  if (typeof setupFilterHandlers === 'function') setupFilterHandlers();
  if (typeof setupPagination === 'function') setupPagination();
  if (typeof setupUniversitySelect === 'function') setupUniversitySelect();
  if (typeof setupBulkImport === 'function') setupBulkImport();
  if (typeof setupStudentLoader === 'function') setupStudentLoader();
  if (typeof setupSendHandler === 'function') setupSendHandler();
  if (typeof loadDataset === 'function') loadDataset();
  
  // Upload setup
  setupUpload();
  
  // NEW: Setup user dropdown
  setupUserDropdown();
  
  // Restore last view
  const savedView = localStorage.getItem('sr_current_view');
  if (savedView && (savedView === 'recommender' || savedView === 'student')) {
    switchView(savedView);
  }
  
  // Tagline hotfix
  const h1 = document.querySelector('.hero-title');
  if (h1) h1.textContent = 'One upload. Unlimited reach.';
});
(function themeButtonInit(){
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
    if (typeof window.toast === 'function') {
      window.toast(`Theme: ${next}`, 'info', { ttl: 1200 });
    }
  }

  if (btn) btn.addEventListener('click', toggleTheme);
})();



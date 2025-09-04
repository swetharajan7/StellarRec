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
    // best-effort: if selected chips exist, count > 0
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

  // <-- THIS is the key call you were missing -->
  setupUpload();

  // Tagline hotfix (kept from your version)
  const h1=document.querySelector('.hero-title'); 
  if(h1) h1.textContent='One upload. Unlimited reach.';
});

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

/* ===================== utilities & state ===================== */
const norm = s => (s||'').toString().trim().toLowerCase();
const escapeHtml = s => (s??'').toString()
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const debounce = (fn,wait=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; };

let universities = [];
let filtered = [];
let page = 1, pageSize = 40;
let flashNextRender = false;

let studentProfile = null;
let studentUnitIds = new Set();
let addedByRecommender = new Set();
let removedByRecommender = new Set();
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

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // If you have these functions defined above, this wires them up:
  if (typeof setupWriter === 'function') setupWriter();
  if (typeof setupUpload === 'function') setupUpload();
  if (typeof setupUniversitySearch === 'function') setupUniversitySearch();
  if (typeof setupFilterHandlers === 'function') setupFilterHandlers();
  if (typeof setupPagination === 'function') setupPagination();
  if (typeof setupUniversitySelect === 'function') setupUniversitySelect();
  if (typeof setupBulkImport === 'function') setupBulkImport();
  if (typeof setupStudentLoader === 'function') setupStudentLoader();
  if (typeof setupSendHandler === 'function') setupSendHandler();
  if (typeof loadDataset === 'function') loadDataset();

  // Tagline hotfix (optional)
  const h1 = document.querySelector('.hero-title');
  if (h1) h1.textContent = 'One upload. Unlimited reach.';
});
/* === Avatar Dropdown — Robust Wire-Up === */
(function () {
  const avatar   = document.getElementById('userAvatarBtn');
  const dropdown = document.getElementById('userDropdown');

  if (!avatar || !dropdown) {
    console.warn('[SR] Dropdown wiring: missing #userAvatarBtn or #userDropdown');
    return;
  }

  // Ensure the dropdown anchors correctly
  const userInfo = avatar.closest('.user-info') || avatar.parentElement;
  if (userInfo && getComputedStyle(userInfo).position === 'static') {
    userInfo.style.position = 'relative';
  }

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
  function toggleDropdown(e) {
    if (e) e.stopPropagation();
    isOpen() ? closeDropdown() : openDropdown();
  }

  // If old HTML ever called toggleUserDropdown(), keep a global
  window.toggleUserDropdown = toggleDropdown;

  // Rebind clean listeners
  const freshAvatar = avatar; // (no need to clone unless you had duplicates)
  freshAvatar.addEventListener('click', toggleDropdown);
  freshAvatar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDropdown(e); }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    const inside = dropdown.contains(e.target) || freshAvatar.contains(e.target);
    if (!inside && isOpen()) closeDropdown();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeDropdown();
  });

  // “How it works” → /university-portal/
  const howItWorksItem = document.getElementById('howItWorksItem');
  if (howItWorksItem) {
    const go = () => { window.location.href = '/university-portal/'; };
    howItWorksItem.addEventListener('click', (e) => { e.preventDefault(); go(); });
    howItWorksItem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  }

  // Accessibility defaults
  dropdown.setAttribute('role', dropdown.getAttribute('role') || 'menu');
  dropdown.setAttribute('aria-hidden', 'true');

  console.log('[SR] Dropdown wired. Click the person icon to toggle.');
})();


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

<!-- Sanity checks + header interactions -->
<script>
  (function(){
    if (typeof Fuse !== 'function') console.warn('[SR] Fuse.js not loaded');
    if (typeof localforage === 'undefined') console.warn('[SR] localForage not loaded');
    else localforage.config({ name: 'StellarRec' });

    // Avatar dropdown toggling (works with corrected structure)
    const btn = document.getElementById('userAvatarBtn');
    const dd  = document.getElementById('userDropdown');
    function closeDD(e){
      if (!dd) return;
      if (e && (dd.contains(e.target) || btn.contains(e.target))) return;
      dd.classList.remove('show');
      btn?.setAttribute('aria-expanded','false');
      document.removeEventListener('click', closeDD);
    }
    btn?.addEventListener('click', (e)=>{
      e.stopPropagation();
      dd?.classList.toggle('show');
      btn.setAttribute('aria-expanded', dd?.classList.contains('show') ? 'true' : 'false');
      if (dd?.classList.contains('show')) setTimeout(()=>document.addEventListener('click', closeDD), 0);
    });

    // Theme button fallback (dashboard.js will also manage this)
    document.getElementById('headerThemeBtn')?.addEventListener('click', ()=>{
      const root = document.documentElement;
      const isDark = root.getAttribute('data-theme') === 'dark';
      root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    });
  })();
</script>

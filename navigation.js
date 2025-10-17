// navigation.js - controla sidebar, rolagem suave e destaque de seção
(function(){
  // Force dark theme globally to ensure pages render with the expected dark palette.
  try{ document.documentElement.setAttribute('data-theme','dark'); document.body.classList.add('theme-dark'); }catch(e){}
  const allLinks = Array.from(document.querySelectorAll('.nav-list a'));
  const hasAnchorMode = allLinks.some(l => l.getAttribute('href')?.startsWith('#'));

  if(hasAnchorMode){
    // --- Single-page fallback (antigo) ---
    const links = allLinks.filter(l=>l.getAttribute('href').startsWith('#'))
    const sections = Array.from(document.querySelectorAll('[data-section]'));
    const showAllBtn = document.getElementById('show-all');

    function isolateSection(targetId){
      sections.forEach(sec => {
        const match = sec.id === targetId;
        sec.classList.toggle('section-hidden', !match);
        sec.classList.toggle('section-active', match);
      });
    }
    function showAllSections(){ sections.forEach(sec => sec.classList.remove('section-hidden','section-active')); }

    links.forEach(l => {
      l.addEventListener('click', e => {
        e.preventDefault();
        const id = l.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if(target){ isolateSection(target.id); target.scrollIntoView({behavior:'smooth', block:'start'}); }
      });
    });
    showAllBtn && showAllBtn.addEventListener('click', showAllSections);
    document.addEventListener('keydown', e => { if(e.key==='Escape') showAllSections(); });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.id;
        if(entry.isIntersecting){
          links.forEach(l => {
            const match = l.getAttribute('href') === '#' + id;
            l.classList.toggle('active', match);
            if(match) l.setAttribute('aria-current','page'); else l.removeAttribute('aria-current');
          });
        }
      });
    }, { root:null, rootMargin:'0px 0px -60% 0px', threshold:0.25 });
    const sectionIds = ['sec-lancamento','sec-resumo','sec-filtros','sec-lista','sec-grafico'];
    sectionIds.forEach(id => { const el = document.getElementById(id); if(el) observer.observe(el); });
    if(location.hash){ const initial = document.getElementById(location.hash.slice(1)); if(initial && sections.includes(initial)) isolateSection(initial.id); }
    if(links.length){ links[0].classList.add('active'); links[0].setAttribute('aria-current','page'); }
    return;
  }

  // --- Multi-page modo ---
  const current = location.pathname.split('/').pop();
  allLinks.forEach(l => {
    const href = l.getAttribute('href');
    const match = href === current || (href === 'resumo.html' && current === '');
    l.classList.toggle('active', match);
    if(match) l.setAttribute('aria-current','page'); else l.removeAttribute('aria-current');
  });

  // Preencher identidade (email + avatar) se houver sessão
  try {
    const email = localStorage.getItem('auth_session_email');
    if(email){
      const span = document.getElementById('side-user-email'); if(span) span.textContent = email;
      const avatar = document.getElementById('user-avatar');
      if(avatar){
        const namePart = email.split('@')[0];
        const parts = namePart.replace(/[^a-zA-Z0-9]/g,' ').split(' ').filter(Boolean);
        let initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]) : namePart.slice(0,2);
        avatar.textContent = initials.toUpperCase();
      }
      const logoutBtn = document.getElementById('side-logout');
      if(logoutBtn){ logoutBtn.addEventListener('click', () => { localStorage.removeItem('auth_session_email'); location.replace('index.html'); }); }
    }
  } catch(e){ console.warn('identity fill failed', e); }

  // Adiciona itens utilitários ao sidebar (dinâmico, evita editar cada HTML)
  try {
    const nav = document.querySelector('.nav-list');
    if(nav){
      const tools = [
        { id:'menu-account', label:'Minha Conta', action:'account', href:'minha-conta.html' },
        { id:'menu-reset', label:'Reset meus dados', action:'reset', href:'minha-conta.html' },
        { id:'menu-reports', label:'Relatórios', action:'reports', href:'relatorios.html' },
        { id:'menu-settings', label:'Configurações', action:'settings', href:'configuracoes.html' },
        { id:'menu-help', label:'Ajuda / Sobre', action:'help', href:'ajuda.html' }
      ];
      tools.forEach(t=>{
        if(document.getElementById(t.id)) return;
        const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = t.href || '#'; a.id = t.id; a.textContent = t.label; a.className = 'nav-tool';
        li.appendChild(a); nav.appendChild(li);
        a.addEventListener('click', (e)=>{
          e.preventDefault();
          try {
            if(t.action==='account'){
              if(window.__openAccount) return window.__openAccount();
              return location.href='minha-conta.html';
            }
            if(t.action==='export'){
              if(window.__userExport) return (function(){ const data=window.__userExport(); const blob=new Blob([data],{type:'application/json'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='meus_dados.json'; link.click(); URL.revokeObjectURL(link.href); })();
              if(window.UI && UI.toast) return UI.toast('Export não disponível', {type:'error'});
              return;
            }
            if(t.action==='reset'){
              if(window.__resetMyData) return window.__resetMyData();
              return location.href='minha-conta.html';
            }
            if(t.action==='reports'){
              if(window.__openReports) return window.__openReports();
              return location.href='relatorios.html';
            }
            if(t.action==='settings'){
              if(window.__openSettings) return window.__openSettings();
              return location.href='configuracoes.html';
            }
            if(t.action==='help') return location.href='ajuda.html';
          } catch(err){ console.warn('tool action fail', err); }
        });
      });
    }
  } catch(err){ console.warn('sidebar tools failed', err); }

  // Mobile hamburger toggle: inject into header and wire sidebar open/close
  try{
    const header = document.querySelector('.app-header');
    if(header){
      const ctrl = document.createElement('div'); ctrl.className='mobile-header-controls';
      const btn = document.createElement('button'); btn.className='hamburger'; btn.innerHTML = '&#9776;'; btn.title='Menu';
      ctrl.appendChild(btn);
      const sidebar = document.querySelector('.sidebar');
      // create overlay
      let overlay = document.querySelector('.sidebar-overlay');
      if(!overlay){ overlay = document.createElement('div'); overlay.className='sidebar-overlay'; document.body.appendChild(overlay); }

      function openSidebar(){ if(!sidebar) return; sidebar.classList.add('open'); overlay.classList.add('visible'); document.body.classList.add('menu-open'); trapFocus(sidebar); }
      function closeSidebar(){ if(!sidebar) return; sidebar.classList.remove('open'); overlay.classList.remove('visible'); document.body.classList.remove('menu-open'); releaseFocus(); }

      btn.addEventListener('click', ()=>{ if(sidebar && sidebar.classList.contains('open')) closeSidebar(); else openSidebar(); });
      
      overlay.addEventListener('click', ()=> closeSidebar());
      document.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape') closeSidebar(); });

      // simple focus trap
      let lastFocused = null;
      function trapFocus(container){ lastFocused = document.activeElement; const focusable = container.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'); if(focusable.length) focusable[0].focus(); document.addEventListener('focus', maintainFocus, true); }
      function maintainFocus(e){ const container = document.querySelector('.sidebar'); if(container && !container.contains(e.target)) { e.stopPropagation(); container.querySelector('a,button,input,select,textarea')?.focus(); } }
      function releaseFocus(){ document.removeEventListener('focus', maintainFocus, true); if(lastFocused) lastFocused.focus(); }
    }
  } catch(e){/* noop */}
})();

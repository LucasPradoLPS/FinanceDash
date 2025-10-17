// ui-widgets.js - lightweight toasts and confirm modal
(function(global){
  function ensureContainer(){
    let c = document.getElementById('fd-toast-wrap');
    if(!c){ c = document.createElement('div'); c.id='fd-toast-wrap'; c.style.position='fixed'; c.style.right='16px'; c.style.top='16px'; c.style.zIndex=9999; c.style.display='flex'; c.style.flexDirection='column'; c.style.gap='8px'; document.body.appendChild(c); }
    return c;
  }

  function toast(message, opts={type:'info', duration:3500}){
    const c = ensureContainer();
    const el = document.createElement('div');
    el.className = 'fd-toast fd-toast-'+(opts.type||'info');
    el.textContent = message;
    el.style.opacity='0'; el.style.transform='translateY(-6px)'; el.style.transition='opacity .28s, transform .28s';
    c.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });
    const to = setTimeout(()=>{ close(); }, opts.duration||3500);
    function close(){ el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 300); }
    el.addEventListener('click', ()=>{ clearTimeout(to); close(); });
    return { close };
  }

  // Confirm modal returns promise resolving true/false
  function confirmDialog(title, message, opts={okText:'OK', cancelText:'Cancelar'}){
    return new Promise((resolve)=>{
      // ensure modal container
      let m = document.getElementById('fd-confirm-modal');
      if(m) m.remove();
      m = document.createElement('div'); m.id='fd-confirm-modal'; m.className='modal'; m.setAttribute('aria-hidden','false');
      m.innerHTML = `
        <div class="modal-content" role="dialog" aria-modal="true">
          <div class="modal-header"><strong>${escapeHtml(title||'Confirmação')}</strong><button class="modal-close">✕</button></div>
          <div class="modal-body"><div style="min-width:420px">${escapeHtml(message||'')}</div></div>
          <div class="modal-footer"><button class="ghost modal-cancel">${escapeHtml(opts.cancelText)}</button><button class="primary modal-ok">${escapeHtml(opts.okText)}</button></div>
        </div>`;
      document.body.appendChild(m);
      const btnOk = m.querySelector('.modal-ok');
      const btnCancel = m.querySelector('.modal-cancel');
      const btnClose = m.querySelector('.modal-close');
      function cleanup(val){ m.setAttribute('aria-hidden','true'); setTimeout(()=> m.remove(), 220); resolve(val); }
      btnOk.addEventListener('click', ()=> cleanup(true));
      btnCancel.addEventListener('click', ()=> cleanup(false));
      btnClose.addEventListener('click', ()=> cleanup(false));
    });
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  global.UI = global.UI || {};
  global.UI.toast = toast;
  global.UI.confirm = confirmDialog;
})(window);

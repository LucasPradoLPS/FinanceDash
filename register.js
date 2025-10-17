// register.js - cadastro de usuário local (sem backend)
(function(){
  const form = document.getElementById('register-form');
  const statusEl = document.getElementById('register-status');
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-pass');
  const pass2Input = document.getElementById('reg-pass2');
  const togglePassBtn = document.getElementById('toggle-pass-reg');

  const errName = document.getElementById('name-error');
  const errEmail = document.getElementById('reg-email-error');
  const errPass = document.getElementById('reg-pass-error');
  const errPass2 = document.getElementById('reg-pass2-error');

  const USERS_KEY = 'finance_dash_users_v1';

  function loadUsers(){
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') || []; } catch(e){ return []; }
  }
  function saveUsers(list){
    try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch(e){}
  }

  function hash(str){
    // hash simples (não seguro; apenas ofuscação leve para demo)
    let h = 0, i, chr; if(str.length === 0) return h.toString(16);
    for(i=0;i<str.length;i++){ chr = str.charCodeAt(i); h = (h << 5) - h + chr; h |= 0; }
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }

  function validateName(){
    const v = nameInput.value.trim();
    if(v.length < 2){ errName.textContent = 'Nome muito curto.'; return false; }
    errName.textContent = ''; return true;
  }
  function validateEmail(){
    const v = emailInput.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){ errEmail.textContent = 'Email inválido.'; return false; }
    const users = loadUsers();
    if(users.some(u => u.email.toLowerCase() === v.toLowerCase())){ errEmail.textContent = 'Email já cadastrado.'; return false; }
    errEmail.textContent = ''; return true;
  }
  function validatePass(){
    const v = passInput.value;
    if(v.length < 6){ errPass.textContent = 'Mínimo 6 caracteres.'; return false; }
    errPass.textContent=''; return true;
  }
  function validatePass2(){
    if(pass2Input.value !== passInput.value){ errPass2.textContent = 'Senhas não coincidem.'; return false; }
    errPass2.textContent=''; return true;
  }
  function allValid(){
    const a = [validateName(), validateEmail(), validatePass(), validatePass2()];
    return a.every(Boolean);
  }

  [nameInput,emailInput,passInput,pass2Input].forEach(inp => {
    inp.addEventListener('input', () => {
      switch(inp){
        case nameInput: validateName(); break;
        case emailInput: validateEmail(); break;
        case passInput: validatePass(); validatePass2(); break;
        case pass2Input: validatePass2(); break;
      }
    });
  });

  if(togglePassBtn){
    togglePassBtn.addEventListener('click', () => {
      const showing = passInput.type === 'text';
      passInput.type = showing ? 'password' : 'text';
      togglePassBtn.textContent = showing ? '👁' : '🙈';
      togglePassBtn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      passInput.focus();
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    statusEl.textContent = '';
    if(!allValid()){ statusEl.textContent = 'Verifique os campos destacados.'; return; }
    const users = loadUsers();
  const user = { name: nameInput.value.trim(), email: emailInput.value.trim(), passHash: hash(passInput.value), createdAt: Date.now() };
    users.push(user); saveUsers(users);
  // cria sessão
    Auth.setSession(user.email);
  // A memória específica por usuário é carregada ao entrar nas páginas via app.js
    statusEl.textContent = 'Conta criada! Redirecionando...';
    setTimeout(()=> window.location.replace('resumo.html'), 600);
  });

})();

// login.js - lógica da página de login
(function(){
  // Elements
  const form = document.getElementById('login-form')
  const statusEl = document.getElementById('login-status')
  const registerBtn = document.getElementById('btn-register')
  const loginBtn = document.getElementById('btn-login') || form.querySelector('button[type="submit"]')
  const emailInput = document.getElementById('login-email')
  const passInput = document.getElementById('login-password')
  const togglePassBtn = document.getElementById('toggle-pass')
  const rememberChk = document.getElementById('remember-email')
  const passStrengthBar = document.getElementById('pass-strength-bar')
  const passStrengthText = document.getElementById('pass-strength')
  const emailGroup = emailInput.closest('.field-group')
  const passGroup = passInput.closest('.field-group')
  const emailError = document.getElementById('email-error')
  const passError = document.getElementById('pass-error')

  // Helpers
  const EMAIL_KEY = 'rememberedEmail'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const USERS_KEY = 'finance_dash_users_v1'

  function setLoading(btn, loading){
    if(!btn) return
    if(loading){ btn.classList.add('loading'); btn.disabled = true }
    else { btn.classList.remove('loading'); btn.disabled = false }
  }

  function validateEmail(){
    const val = emailInput.value.trim()
    let ok = true
    if(!val){ ok = false; emailError.textContent = 'Email é obrigatório' }
    else if(!emailRegex.test(val)){ ok = false; emailError.textContent = 'Formato de email inválido' }
    else { emailError.textContent = '' }
    emailGroup.classList.toggle('error', !ok)
    emailGroup.classList.toggle('valid', ok)
    return ok
  }

  function validatePass(){
    const val = passInput.value
    let ok = true
    if(!val){ ok = false; passError.textContent = 'Senha é obrigatória' }
    else if(val.length < 6){ ok = false; passError.textContent = 'Mínimo 6 caracteres' }
    else { passError.textContent = '' }
    passGroup.classList.toggle('error', !ok)
    passGroup.classList.toggle('valid', ok)
    updateStrength(val)
    return ok
  }

  function scorePassword(pw){
    if(!pw) return 0
    let score = 0
    if(pw.length >= 6) score += 1
    if(pw.length >= 10) score += 1
    if(/[0-9]/.test(pw)) score += 1
    if(/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1
    if(/[^A-Za-z0-9]/.test(pw)) score += 1
    return score // 0..5
  }

  function updateStrength(pw){
    if(!passStrengthBar || !passStrengthText) return
    const s = scorePassword(pw)
    const pct = Math.min(100, Math.round((s/5)*100))
    passStrengthBar.style.width = pct + '%'
    let label = ''
    if(s <= 1) label = 'Muito fraca'
    else if(s === 2) label = 'Fraca'
    else if(s === 3) label = 'Média'
    else if(s === 4) label = 'Forte'
    else label = 'Muito forte'
    passStrengthText.textContent = pw ? label : ''
    passStrengthText.setAttribute('data-score', s)
    passStrengthBar.setAttribute('data-score', s)
  }

  function overallValid(){
    const eOk = validateEmail()
    const pOk = validatePass()
    return eOk && pOk
  }

  function loadUsers(){
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') || [] } catch(e){ return [] }
  }

  function findUser(email){
    const users = loadUsers()
    return users.find(u => u.email.toLowerCase() === email.toLowerCase())
  }

  async function doLogin(email, pass){
    try {
      // Primeiro tenta login local
      const u = findUser(email)
      if(u){
        // hash simples local replicado (mesma função de register.js)
        const passHash = (function(str){ let h=0,i,chr; if(str.length===0) return h.toString(16); for(i=0;i<str.length;i++){ chr=str.charCodeAt(i); h=(h<<5)-h+chr; h|=0;} return ('00000000'+(h>>>0).toString(16)).slice(-8); })(pass)
        if(passHash !== u.passHash) throw new Error('Senha incorreta.')
        Auth.setSession(u.email)
      } else {
        // fallback para API fictícia se existir
        if(window.FirebaseAPI && window.FirebaseAPI.auth){
          const user = await window.FirebaseAPI.auth.login(email, pass)
          Auth.setSession(user.email || email)
        } else {
          throw new Error('Usuário não encontrado. Cadastre-se.')
        }
      }
      statusEl.textContent = 'Login efetuado. Redirecionando...'
      if(rememberChk.checked){ localStorage.setItem(EMAIL_KEY, email) } else { localStorage.removeItem(EMAIL_KEY) }
      setTimeout(()=> window.location.replace('resumo.html'), 350)
    } catch(e){
      statusEl.textContent = 'Falha no login: ' + (e.message || e)
    } finally {
      setLoading(loginBtn, false)
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault()
    if(!overallValid()){ statusEl.textContent = 'Corrija os campos destacados.'; return }
    const email = emailInput.value.trim()
    const pass = passInput.value
    statusEl.textContent = 'Entrando...'
    setLoading(loginBtn, true)
    doLogin(email, pass)
  })

  registerBtn.addEventListener('click', (e) => {
    e.preventDefault()
    window.location.href = 'cadastro.html'
  })

  // Real-time validation
  emailInput.addEventListener('input', () => validateEmail())
  passInput.addEventListener('input', () => validatePass())

  // Toggle password visibility
  if(togglePassBtn){
    togglePassBtn.addEventListener('click', () => {
      const showing = passInput.getAttribute('type') === 'text'
      passInput.setAttribute('type', showing ? 'password':'text')
      togglePassBtn.textContent = showing ? '👁' : '🙈'
      togglePassBtn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha')
      passInput.focus()
    })
  }

  // Remember email restore
  const stored = localStorage.getItem(EMAIL_KEY)
  if(stored){
    emailInput.value = stored
    rememberChk.checked = true
    validateEmail()
  }

  // Acessibilidade: limpar status ao digitar
  form.addEventListener('input', () => {
    if(statusEl.textContent.startsWith('Falha') || statusEl.textContent.startsWith('Corrija')){
      if(overallValid()) statusEl.textContent = ''
    }
  })

  if(Auth.getSession()){
    window.location.replace('resumo.html')
  }
})();

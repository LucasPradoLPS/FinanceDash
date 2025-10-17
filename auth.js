// auth.js - util simples de sessão local
(function(){
  const SESSION_KEY = 'auth_session_email'
  function setSession(email){ localStorage.setItem(SESSION_KEY, email) }
  function clearSession(){ localStorage.removeItem(SESSION_KEY) }
  function getSession(){ return localStorage.getItem(SESSION_KEY) }
  window.Auth = { setSession, clearSession, getSession }
})();

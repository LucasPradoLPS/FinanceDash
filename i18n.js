// Simple i18n helper (PT-BR / EN)
(function(global){
  const LOCALES = {
    'pt': {
      'app_name': 'FinanceDash',
      'app_tagline': 'Controle financeiro claro, inteligente e em tempo real.',
      'benefit_summary': 'Resumo instantâneo de entradas e saídas',
      'benefit_charts': 'Gráficos por categoria',
      'benefit_export': 'Exportação em CSV',
      'benefit_sync': 'Sincronização opcional com Firebase',
      'login_title': 'Acesse sua conta',
      'label_email': 'Email',
      'placeholder_email': 'voce@exemplo.com',
      'hint_email': 'Use um email válido (ex: nome@dominio.com)',
      'label_password': 'Senha',
      'placeholder_password': 'Mínimo 6 caracteres',
      'hint_password': 'Mínimo 6 caracteres. Recomenda-se letras e números.',
      'remember_email': 'Lembrar email',
      'forgot_password': 'Esqueci a senha',
      'btn_login': 'Entrar',
      'btn_register': 'Criar conta',
      'agreement': 'Ao continuar você concorda com nossos Termos & Privacidade',
      'title_reports': 'Relatórios',
      'label_month': 'Mês',
      'label_type': 'Tipo',
      'btn_generate': 'Gerar',
      'btn_export': 'Exportar CSV',
      'msg_none': 'Nenhum relatório gerado.',
      'pref_language': 'Idioma',
      'th_category': 'Categoria',
      'th_total': 'Total',
      'th_count': 'Qtd',
      'th_percent': '%',
      'report_monthly': 'Relatório Mensal',
      'total_label': 'Total:'
    },
    'en': {
      'app_name': 'FinanceDash',
      'app_tagline': 'Clear, smart financial control in real time.',
      'benefit_summary': 'Instant summary of income and expenses',
      'benefit_charts': 'Charts by category',
      'benefit_export': 'CSV export',
      'benefit_sync': 'Optional Firebase sync',
      'login_title': 'Sign in to your account',
      'label_email': 'Email',
      'placeholder_email': 'you@example.com',
      'hint_email': 'Use a valid email (e.g. name@domain.com)',
      'label_password': 'Password',
      'placeholder_password': 'Minimum 6 characters',
      'hint_password': 'Minimum 6 characters. Use letters and numbers.',
      'remember_email': 'Remember email',
      'forgot_password': 'Forgot password',
      'btn_login': 'Log in',
      'btn_register': 'Create account',
      'agreement': 'By continuing you agree to our Terms & Privacy',
      'title_reports': 'Reports',
      'label_month': 'Month',
      'label_type': 'Type',
      'btn_generate': 'Generate',
      'btn_export': 'Export CSV',
      'msg_none': 'No report generated.',
      'pref_language': 'Language',
      'th_category': 'Category',
      'th_total': 'Total',
      'th_count': 'Qty',
      'th_percent': '%',
      'report_monthly': 'Monthly Report',
      'total_label': 'Total:'
    }
    ,
    'common': {
      // fallback common labels not page-specific
    }
  };

  const STORAGE_KEY = 'fd_lang';
  let lang = localStorage.getItem(STORAGE_KEY) || 'pt';

  function t(key){ return (LOCALES[lang] && LOCALES[lang][key]) || LOCALES['pt'][key] || key; }
  function setLanguage(l){ lang = l; localStorage.setItem(STORAGE_KEY, l); apply(); if(window.UI && UI.toast) UI.toast('Language: '+l, {type:'info'}); }

  function apply(){
    // scan for data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const k = el.getAttribute('data-i18n');
      if(el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'select'){
        el.placeholder = t(k);
      } else {
        el.textContent = t(k);
      }
    });
  }

  global.I18n = { t, setLanguage, apply, current: ()=>lang };
  // auto-apply on DOM ready
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})(window);

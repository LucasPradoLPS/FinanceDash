// userdb.js - Camada simples de "banco" multiusuário sobre localStorage
// Estrutura:
//   finance_db_v1 = {
//      users: {
//         "email_normalizado": {
//             transactions: [...],
//             meta: { createdAt, updatedAt, version }
//         },
//         ...
//      },
//      _version: 1
//   }
// Fornece isolamento claro por usuário e migração a partir das chaves antigas.
(function(global){
  const DB_KEY = 'finance_db_v1';
  const OLD_PREFIX_V2 = 'dashboard_financeiro_user_v2::';
  const LEGACY_KEY = 'dashboard_financeiro_transactions_v1';

  function normalizeEmail(email){ return String(email||'').trim().toLowerCase(); }

  function loadDB(){
    try { const raw = localStorage.getItem(DB_KEY); return raw ? JSON.parse(raw) : { users:{}, _version:1 }; } catch(e){ return { users:{}, _version:1 }; }
  }
  function saveDB(db){ try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e){ console.warn('[UserDB] save fail', e); }
  }
  function ensureUser(db, norm){ if(!db.users[norm]) db.users[norm] = { transactions:[], meta:{ createdAt:Date.now(), updatedAt:Date.now(), version:1 } }; return db.users[norm]; }

  function migrateFromOld(norm){
    const db = loadDB();
    const userEntry = ensureUser(db, norm);
    if(userEntry._migrated) return; // simples flag
    let changed = false;
    // Migra da chave v2 plain
    const oldKey = OLD_PREFIX_V2 + norm;
    const rawOld = localStorage.getItem(oldKey);
    if(rawOld){
      try { const arr = JSON.parse(rawOld); if(Array.isArray(arr)&&arr.length){
        const ids = new Set(userEntry.transactions.map(t=>t.id));
        arr.forEach(t=>{ if(!ids.has(t.id)) userEntry.transactions.push({ ...t, owner:norm }); });
        changed = true;
      } } catch(e){ console.warn('[UserDB] old v2 parse fail'); }
      localStorage.removeItem(oldKey);
    }
    // Migra legado global se ainda existir e estiver vazio o usuário
    if(userEntry.transactions.length===0){
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if(legacyRaw){
        try { const arr = JSON.parse(legacyRaw); if(Array.isArray(arr)&&arr.length){
          arr.forEach(t=> userEntry.transactions.push({ ...t, owner:norm }));
          changed = true;
        } } catch(e){ console.warn('[UserDB] legacy parse fail'); }
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    if(changed){ userEntry.meta.updatedAt = Date.now(); userEntry._migrated = true; saveDB(db); }
  }

  function getUserData(norm){ const db=loadDB(); return db.users[norm]?.transactions || []; }
  function setUserData(norm, txs){ const db=loadDB(); const entry=ensureUser(db,norm); entry.transactions = Array.isArray(txs)? txs.slice():[]; entry.meta.updatedAt=Date.now(); saveDB(db); }
  function exportUser(norm){ return JSON.stringify(getUserData(norm), null, 2); }
  function importUser(norm, json){ try { const arr=JSON.parse(json); if(Array.isArray(arr)){ setUserData(norm, arr.map(t=>({...t, owner:norm}))); return true; } } catch(e){ return false; } return false; }

  global.UserDB = { loadDB, getUserData, setUserData, exportUser, importUser, migrateFromOld, normalizeEmail };
})(window);

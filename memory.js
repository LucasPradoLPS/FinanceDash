// memory.js - Camada de memória sem banco externo
// Fornece cache em RAM com fallback opcional em localStorage e suporte a undo básico.
(function(global){
  class MemoryStore {
    constructor(key, { persistent = true, maxSnapshots = 25 } = {}){
      this.key = key;
      this.persistent = persistent;
      this.maxSnapshots = maxSnapshots;
      this.data = [];
      this.snapshots = [];
      this.observers = new Set();
      this._load();
      // Listener de mudança entre abas (apenas se persistente)
      window.addEventListener('storage', (e) => {
        if(!this.persistent) return;
        if(e.key === this.key){
          try { this.data = JSON.parse(e.newValue || '[]') || []; this._notify(); } catch(err){ console.warn('sync parse fail', err); }
        }
      });
    }
    switchKey(newKey){
      if(newKey === this.key) return;
      this.key = newKey;
      this.snapshots = [];
      this._load();
      this._notify();
    }
    _load(){
      if(!this.persistent){ this.data = []; return; }
      try { const raw = localStorage.getItem(this.key); this.data = raw ? JSON.parse(raw) : []; } catch(e){ this.data = []; }
    }
    _save(){ if(this.persistent){ try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch(e){ console.warn('save fail', e); } } }
    _snapshot(){
      // salva cópia superficial
      this.snapshots.push(JSON.stringify(this.data));
      if(this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
    }
    undo(){
      if(!this.snapshots.length) return false;
      const last = this.snapshots.pop();
      try { this.data = JSON.parse(last); this._save(); this._notify(); return true; } catch(e){ return false; }
    }
    setPersistent(flag){
      this.persistent = !!flag;
      if(!this.persistent){
        // desliga persistência (não remove dados em memória, apenas para de salvar)
      } else {
        this._save();
      }
      this._notify();
    }
    replaceAll(newArr){
      this._snapshot();
      this.data = Array.isArray(newArr) ? newArr.slice() : [];
      this._save();
      this._notify();
    }
    push(obj){
      this._snapshot();
      this.data.push(obj);
      this._save();
      this._notify();
      return obj;
    }
    update(id, patch){
      const idx = this.data.findIndex(t => t.id === id);
      if(idx === -1) return null;
      this._snapshot();
      this.data[idx] = { ...this.data[idx], ...patch };
      this._save();
      this._notify();
      return this.data[idx];
    }
    removeByIndex(i){
      if(i < 0 || i >= this.data.length) return null;
      this._snapshot();
      const removed = this.data.splice(i,1)[0];
      this._save();
      this._notify();
      return removed;
    }
    subscribe(fn){ if(typeof fn === 'function'){ this.observers.add(fn); return () => this.observers.delete(fn); } return () => {}; }
    _notify(){ this.observers.forEach(fn => { try { fn(this.data); } catch(e){} }); }
    exportJSON(){ return JSON.stringify(this.data, null, 2); }
    importJSON(json){ try { const arr = JSON.parse(json); if(Array.isArray(arr)){ this.replaceAll(arr); return true; } } catch(e){ return false; } return false; }
  }

  global.MemoryStore = MemoryStore;
})(window);

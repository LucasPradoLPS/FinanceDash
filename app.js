// Dashboard Financeiro - app.js (refatorado com MemoryStore)
// A chave base será personalizada por usuário: dashboard_financeiro_transactions_v1::<emailHash>
// Assim cada usuário tem seu conjunto isolado de lançamentos sem misturar dados.
const STORAGE_KEY_BASE = 'dashboard_financeiro_transactions_v1'
const STORAGE_KEY_PREFIX_NEW = 'dashboard_financeiro_user_v2::' // nova chave por email normalizado
// Compat: chave antiga usada por funções legacySave/legacyLoad (pré multiusuário)
const STORAGE_KEY = 'dashboard_financeiro_transactions_v1'
// Chave legada (pré multi-usuário) usada para migração automática
const LEGACY_KEY = 'dashboard_financeiro_transactions_v1'
const CHART_TOP_N = 6
function $(id){ return document.getElementById(id) }

let transactions = []
let store = null
let currentUserEmail = null
let currentUserNorm = null
let chart = null
let chartType = 'pie'
let chartMode = 'all' // Modo único combinado (entradas e saídas juntos)
let showAllCategories = false
let barStacked = true // controla se barras ficam empilhadas ou lado a lado
let activeFilter = { from: null, to: null }
let syncWithFirebase = false

// ---------- Utilidades ----------
// Preference-aware formatting
// Helpers to get/set user prefs in a normalized way
function _prefsStorageKeyForSession(){ const sessionEmail = (window.Auth && Auth.getSession && Auth.getSession()) || localStorage.getItem('auth_session_email') || ''; const norm = normalizeEmail(sessionEmail||'anon'); return 'fd_prefs::'+norm; }
window.getUserPrefs = function(){ try{ const key=_prefsStorageKeyForSession(); const raw = localStorage.getItem(key); const p = raw? JSON.parse(raw) : {}; return { currency: p.currency || 'BRL', locale: p.locale || (p.currency==='BRL'?'pt-BR':'en-US'), theme: p.theme || 'dark' }; } catch(e){ return { currency:'BRL', locale:'pt-BR', theme:'dark' }; } };
window.setUserPrefs = function(obj){ try{ const key=_prefsStorageKeyForSession(); const raw = localStorage.getItem(key); const existing = raw? JSON.parse(raw):{}; const merged = Object.assign({}, existing, obj); localStorage.setItem(key, JSON.stringify(merged)); try{ window.dispatchEvent(new CustomEvent('prefs:changed',{ detail: merged })); }catch(e){} return true; } catch(e){ return false; } };
function getCurrentPrefs(){ if(window.getUserPrefs) return window.getUserPrefs(); return { currency: 'BRL', locale: 'pt-BR' }; }
function formatCurrency(value){ const prefs = getCurrentPrefs(); try{ return Number(value).toLocaleString(prefs.locale, { style:'currency', currency: prefs.currency }); }catch(e){ return Number(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); } }
function formatDate(ts){ const prefs = getCurrentPrefs(); try{ return new Date(ts).toLocaleString(prefs.locale); }catch(e){ return new Date(ts).toLocaleString('pt-BR'); } }
function legacySave(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)) } catch(e){ console.warn('legacySave fail', e); }
}
function legacyLoad(){
  try { const raw = localStorage.getItem(STORAGE_KEY); transactions = raw ? JSON.parse(raw) : [] } catch(e){ transactions = []; console.warn('legacyLoad fail', e); }
}
function normalizeEmail(email){ return String(email||'').trim().toLowerCase(); }
function emailHash(email){
  if(!email) return 'anon';
  const norm = normalizeEmail(email);
  let h=0; for(let i=0;i<norm.length;i++){ h=((h<<5)-h)+norm.charCodeAt(i); h|=0; }
  return (h>>>0).toString(16);
}
function userStorageKeyHashed(email){ return `${STORAGE_KEY_BASE}::${emailHash(email)}` }
function userStorageKeyPlain(email){ const norm=normalizeEmail(email)||'anon'; return `${STORAGE_KEY_PREFIX_NEW}${norm}` }
function resolveUserKey(email){
  // tenta chave nova, senão cai para antiga
  const newKey = userStorageKeyPlain(email);
  return newKey;
}
function initStore(){
  currentUserEmail = (window.Auth && Auth.getSession && Auth.getSession()) || null;
  const normEmail = normalizeEmail(currentUserEmail||'anon');
  currentUserNorm = normEmail;
  const newKey = resolveUserKey(normEmail);
  const oldHashedKey = userStorageKeyHashed(normEmail);
  if(window.MemoryStore){
    if(store){
      store.switchKey(newKey);
      transactions = store.data;
    } else {
      store = new MemoryStore(newKey, { persistent:true, maxSnapshots:50 });
      transactions = store.data;
          // subscribe resanitizador: sempre aplica sanitize e atualiza transactions com visão do usuário
          store.subscribe(arr => {
            try {
              const norm = normalizeEmail(currentUserEmail||'anon');
              const sanitized = sanitizeStoreOwnership(arr, norm);
              if(sanitized.changed){
                // grava de volta se houve alterações (evita adoção de itens alheios)
                store.replaceAll(sanitized.cleaned);
                return;
              }
              transactions = sanitized.cleaned;
              safeRender();
            } catch(e){ console.warn('subscribe sanitize fail', e); transactions = arr; safeRender(); }
          });
      // Migração de chave antiga (hash) para nova (plain) se existir e não migrado ainda
      try {
        if(currentUserEmail){
          const oldRaw = localStorage.getItem(oldHashedKey);
          if(oldRaw){
            const oldArr = JSON.parse(oldRaw);
            if(Array.isArray(oldArr) && oldArr.length){
              // Atualiza cada item com owner se não tiver
              const migrated = oldArr.map(t=> ({ ...t, owner: t.owner || normEmail }));
              if(transactions.length === 0){
                store.replaceAll(migrated);
              } else {
                // mescla evitando duplicados
                const ids = new Set(transactions.map(t=>t.id));
                const merged = [...transactions];
                migrated.forEach(t=>{ if(!ids.has(t.id)) merged.push(t); });
                store.replaceAll(merged);
              }
              localStorage.removeItem(oldHashedKey);
              console.info('[MIGRATION] Migrou dados de chave hash para nova plain:', normEmail);
            }
          }
        }
        // Migração legado global pré multiusuário
        if(transactions.length === 0 && currentUserEmail){
          const legacyRaw = localStorage.getItem(LEGACY_KEY);
          if(legacyRaw){
            const legacyArr = JSON.parse(legacyRaw);
            if(Array.isArray(legacyArr) && legacyArr.length){
              const migratedLegacy = legacyArr.map(t=> ({ ...t, owner: t.owner || normEmail }));
              store.replaceAll(migratedLegacy);
              localStorage.removeItem(LEGACY_KEY);
              console.info('[MIGRATION] Dados legados globais migrados para', normEmail);
            }
          }
        }
      } catch(migErr){ console.warn('Falha migração legacy/plain', migErr); }
    }
    // Filtro defensivo: apenas lançamentos do usuário atual
    if(currentUserEmail){
      const sanitized = sanitizeStoreOwnership(transactions, normEmail);
      if(sanitized.changed){
        store.replaceAll(sanitized.cleaned);
        console.warn('[FILTER] Sanitização aplicada. Removidos ou ignorados lançamentos estranhos');
      } else if(sanitized.cleaned.length !== transactions.length){
        store.replaceAll(sanitized.cleaned);
        console.warn('[FILTER] Removidos lançamentos de outros usuários');
      }
    }
  } else { legacyLoad() }
  console.info('[SESSION] Usuário ativo:', normEmail, 'Chave:', store? store.key : '(legacy)');
}
function escapeHtml(str){
  if(!str) return '';
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(str).replace(/[&<>"']/g, ch => map[ch]);
}

// ---------- CRUD + camada memória ----------
function addTransaction(tx){
  tx.id = tx.id || `tx_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  tx.createdAt = tx.createdAt || Date.now();
  if(currentUserEmail && !tx.owner){ tx.owner = normalizeEmail(currentUserEmail); }
  if(store){ store.push(tx) } else { transactions.push(tx); legacySave() }
  maybeSyncTransaction(tx);
  safeRender();
}
function removeTransaction(index){
  let removed = null
  if(store){ removed = store.removeByIndex(index) } else { removed = transactions.splice(index,1)[0]; legacySave() }
  if(removed) maybeDeleteRemote(removed)
  safeRender()
}
function updateTransaction(id, patch){
  let updated = null;
  if(store){
    updated = store.update(id, patch);
  } else {
    const idx = transactions.findIndex(t=>t.id===id);
    if(idx===-1) return;
    const norm = normalizeEmail(currentUserEmail||'');
    transactions[idx]={...transactions[idx],...patch, owner: transactions[idx].owner || norm};
    legacySave();
    updated = transactions[idx];
  }
  if(updated) maybeSyncTransaction(updated);
  safeRender();
}

// ---------- Cálculos / filtros ----------
function computeTotals(){ let income=0, expense=0; for(const t of transactions){ if(!t || t.owner !== currentUserNorm) continue; if(!inCurrentFilter(t)) continue; if(t.type==='income') income+=Number(t.amount); else expense+=Number(t.amount); } return { income, expense, balance: income-expense } }
function inCurrentFilter(t){ if(!activeFilter.from && !activeFilter.to) return true; const ts=t.createdAt||0; if(activeFilter.from){ const f=new Date(activeFilter.from).setHours(0,0,0,0); if(ts<f) return false } if(activeFilter.to){ const to=new Date(activeFilter.to).setHours(23,59,59,999); if(ts>to) return false } if(activeFilter.category && t.category !== activeFilter.category) return false; return true }
function getCategoryMapByMode(){
  if(chartMode==='all'){
    const maps = { expense:{}, income:{} };
    for(const t of transactions){
      if(!t || t.owner !== currentUserNorm) continue;
      if(!inCurrentFilter(t)) continue;
      const cat=t.category||'Sem categoria';
      const bucket = maps[t.type];
      if(!bucket) continue; // ignore unknown types
      bucket[cat]=(bucket[cat]||0)+Number(t.amount);
    }
    return maps; // {expense:{cat:val}, income:{cat:val}}
  } else {
    const map={};
    for(const t of transactions){
      if(!t || t.owner !== currentUserNorm) continue;
      if(t.type !== chartMode) continue;
      if(!inCurrentFilter(t)) continue;
      const cat=t.category||'Sem categoria';
      map[cat]=(map[cat]||0)+Number(t.amount);
    }
    return map;
  }
}

// ---------- Renderização ----------
function renderTotals(){ const {income,expense,balance}=computeTotals(); const incEl=$('total-income'); const expEl=$('total-expense'); const balEl=$('balance'); if(incEl) incEl.textContent=formatCurrency(income); if(expEl) expEl.textContent=formatCurrency(expense); if(balEl){ const old=balEl.textContent; balEl.textContent=formatCurrency(balance); if(old && old!==balEl.textContent) { balEl.parentElement?.classList.add('changed'); setTimeout(()=> balEl.parentElement?.classList.remove('changed'),1200); } } }
function renderList(){ const ul=$('transaction-list'); if(!ul) return; ul.innerHTML=''; transactions.forEach((t,idx)=>{ if(!t || t.owner !== currentUserNorm) return; if(!inCurrentFilter(t)) return; const li=document.createElement('li'); li.className=t.type==='income'?'tx income':'tx expense'; const meta=document.createElement('div'); meta.className='meta'; meta.innerHTML=`<div><strong>${escapeHtml(t.description)}</strong><div class="small">${escapeHtml(t.category)} • ${formatDate(t.createdAt||Date.now())}</div></div>`; const right=document.createElement('div'); right.className='right'; right.innerHTML=`<div>${formatCurrency(Number(t.amount))}</div><div class="small">${t.type==='income'?'Entrada':'Saída'}</div>`; const del=document.createElement('button'); del.className='btn-delete'; del.textContent='Excluir'; del.onclick=()=>removeTransaction(idx); const edit=document.createElement('button'); edit.className='btn-edit'; edit.textContent='Editar'; edit.onclick=()=>openEditModal(t); const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.appendChild(edit); actions.appendChild(del); li.appendChild(meta); li.appendChild(right); li.appendChild(actions); ul.appendChild(li); }); }
function buildLegend(labels, data, total){
  const legendEl = $('chart-legend');
  if(!legendEl) return;
  legendEl.innerHTML='';
  if(!labels.length){ return; }
  labels.forEach((lab,idx)=>{
    const val = data[idx];
    const pct = total>0 ? ((val/total)*100).toFixed(1) : '0.0';
    const color = chart?.data?.datasets[0]?.backgroundColor[idx] || '#888';
    const item = document.createElement('div');
    item.className='chart-legend-item';
    // Itens agora somente informativos: remover interatividade de toggle
    item.setAttribute('role','listitem');
    item.setAttribute('aria-label',`${lab}: ${pct}% (${formatCurrency(val)})`);
    item.innerHTML = `<span class="chart-legend-swatch" style="background:${color}"></span><span class="label">${escapeHtml(lab)}</span><span class="value">${pct}% • ${formatCurrency(val)}</span>`;
    legendEl.appendChild(item);
  });
}
// Legenda especial para modo 'all' (duas séries)
function buildLegendAll(unionLabels, expenseData, incomeData){
  const legendEl = $('chart-legend');
  if(!legendEl) return;
  legendEl.innerHTML='';
  if(!unionLabels.length) return;
  const totalExpense = expenseData.reduce((s,x)=>s+Number(x),0);
  const totalIncome = incomeData.reduce((s,x)=>s+Number(x),0);
  const grandTotal = totalExpense + totalIncome;
  unionLabels.forEach((lab, idx)=>{
    const expVal = expenseData[idx]||0;
    const incVal = incomeData[idx]||0;
    const catTotal = expVal + incVal;
    const pct = grandTotal>0 ? ((catTotal/grandTotal)*100).toFixed(1) : '0.0';
    const col = colorForCategory(lab || '');
    const item = document.createElement('div');
    item.className='chart-legend-item dual';
    item.setAttribute('role','listitem');
    item.setAttribute('aria-label',`${lab}: Desp ${formatCurrency(expVal)}, Entr ${formatCurrency(incVal)} (Total ${pct}%)`);
    item.innerHTML = `<span class="chart-legend-swatch" style="background:${col.solid}"></span>`+
      `<span class="label">${escapeHtml(lab)}</span>`+
      `<span class="value">${pct}% • D ${formatCurrency(expVal)} / E ${formatCurrency(incVal)}</span>`;
    legendEl.appendChild(item);
  });
}
function renderChart(){
  const canvas=$('expense-chart');
  if(!canvas){ if(chart){ chart.destroy(); chart=null; if(window.__df) window.__df.chart=null; } return }
  if(typeof Chart==='undefined') return;
  const ctx=canvas.getContext('2d');
  // Em modo combinado, se tipo for 'pie' converter para 'doughnut' para melhor visualização
  if(chartMode==='all' && chartType==='pie') chartType='doughnut';
  let labels, data;
  let expenseData = [], incomeData = [];
  if(chartMode==='all'){
    const maps = getCategoryMapByMode(); // {expense:{}, income:{}}
    const expenseEntries = Object.entries(maps.expense).map(([k,v])=>({k,v}));
    const incomeEntries = Object.entries(maps.income).map(([k,v])=>({k,v}));
    // União de categorias
    const unionSet = new Set([...expenseEntries.map(e=>e.k), ...incomeEntries.map(e=>e.k)]);
    let unionArray=[...unionSet].map(k=>({k, v:(maps.expense[k]||0)+(maps.income[k]||0)})).sort((a,b)=>b.v-a.v);
    if(!showAllCategories){
      const top = unionArray.slice(0,CHART_TOP_N);
      const others = unionArray.slice(CHART_TOP_N);
      const topSet = new Set(top.map(x=>x.k));
      labels = top.map(x=>x.k);
      if(others.length){
        labels.push('Outros');
      }
      // Mapear dados
      labels.forEach(lab=>{
        if(lab==='Outros'){
          const otherCats = others.map(o=>o.k);
          const expSum = otherCats.reduce((s,c)=> s + (maps.expense[c]||0), 0);
          const incSum = otherCats.reduce((s,c)=> s + (maps.income[c]||0), 0);
          expenseData.push(expSum);
            incomeData.push(incSum);
        } else {
          expenseData.push(maps.expense[lab]||0);
          incomeData.push(maps.income[lab]||0);
        }
      });
    } else {
      labels = unionArray.map(x=>x.k);
      labels.forEach(lab=>{
        expenseData.push(maps.expense[lab]||0);
        incomeData.push(maps.income[lab]||0);
      });
    }
  } else {
    const dataMap=getCategoryMapByMode();
    const entries=Object.entries(dataMap).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
    if(showAllCategories){
      labels = entries.map(x=>x.k);
      data = entries.map(x=>x.v);
    } else {
      const top=entries.slice(0,CHART_TOP_N);
      const others=entries.slice(CHART_TOP_N);
      labels=top.map(x=>x.k);
      data=top.map(x=>x.v);
      if(others.length){ labels.push('Outros'); data.push(others.reduce((s,x)=>s+x.v,0)) }
    }
  }
  let emptyDiv=$('chart-empty');
  if(!emptyDiv){ emptyDiv=document.createElement('div'); emptyDiv.id='chart-empty'; emptyDiv.className='chart-empty'; emptyDiv.textContent='Nenhuma despesa registrada'; canvas.parentElement.appendChild(emptyDiv); }
  if(!labels || !labels.length){
    if(chart){ chart.destroy(); chart=null; if(window.__df) window.__df.chart=null; }
    canvas.style.display='none'; emptyDiv.style.display='flex';
    const legend=$('chart-legend'); if(legend) legend.innerHTML='';
    return;
  }
  emptyDiv.style.display='none';
  canvas.style.display='block';
  if(chart) chart.destroy();
  const total = chartMode==='all' ? (expenseData.reduce((s,x)=>s+Number(x),0) + incomeData.reduce((s,x)=>s+Number(x),0)) : data.reduce((s,x)=>s+Number(x),0);
  // Plugin para texto central em doughnut
  const centerText = {
    id:'centerText',
    afterDraw(c){
      if(chartType!=='doughnut') return;
      if(chartMode!=='all') return; // só modo combinado
      const {ctx, chartArea:{width,height}} = c;
      const totalIn = incomeData.reduce((s,x)=>s+Number(x),0);
      const totalOut = expenseData.reduce((s,x)=>s+Number(x),0);
      const saldo = totalIn - totalOut;
      const lines = [
        `Entr ${formatCurrency(totalIn)}`,
        `Desp ${formatCurrency(totalOut)}`,
        `Saldo ${formatCurrency(saldo)}`
      ];
      ctx.save();
      ctx.fillStyle='#d4d9e2';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      const baseY = height/2 - ((lines.length-1)*10);
      lines.forEach((ln,i)=>{
        const isSaldo = i===2;
        ctx.font = (isSaldo? '600 12px':'500 11px') + ' system-ui, sans-serif';
        if(isSaldo){
          ctx.fillStyle = saldo>=0 ? '#10b981' : '#ef4444';
        } else {
          ctx.fillStyle = '#d4d9e2';
        }
        ctx.fillText(ln, width/2, baseY + i*18);
      });
      ctx.restore();
    }
  };
  let cfg;
  if(chartMode==='all'){
    const baseType = chartType === 'bar' ? 'bar' : 'doughnut';
    if(baseType==='bar'){
      // mantém barras comparativas com duas séries
      const expenseColors = labels.map(l=>{ const c=colorForCategory(l); return c.alpha(0.85)});
      const incomeColors = labels.map(l=>{ const c=colorForCategory(l); return c.alpha(0.40)});
      cfg = {
        type:'bar',
        data:{ labels, datasets:[
          { label:'Despesas', data: expenseData, backgroundColor: expenseColors, borderColor:'rgba(0,0,0,0.15)', borderWidth:1, stack: barStacked? 'stack1': undefined },
          { label:'Entradas', data: incomeData, backgroundColor: incomeColors, borderColor:'rgba(0,0,0,0.15)', borderWidth:1, stack: barStacked? 'stack1': undefined }
        ]},
        options:{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label(ctx){ return `${ctx.dataset.label} - ${ctx.label}: ${formatCurrency(Number(ctx.parsed.y)||0)}`; } } } }, scales:{ x:{ stacked:barStacked, ticks:{color:'#d4d9e2'} }, y:{ stacked:barStacked, ticks:{color:'#d4d9e2'}, grid:{ color:'rgba(255,255,255,0.08)'} } } },
        plugins: []
      };
    } else {
      // split slices: cada categoria gera até 2 fatias (Desp / Entr) numa única dataset
      const sliceLabels=[]; const sliceData=[]; const sliceColors=[]; const sliceMeta=[];
      labels.forEach((lab, idx)=>{
        const expVal=expenseData[idx]||0; const incVal=incomeData[idx]||0; const col=colorForCategory(lab);
        if(expVal>0){ sliceLabels.push(lab+ ' (Desp)'); sliceData.push(expVal); sliceColors.push(col.alpha(0.85)); sliceMeta.push({cat:lab,type:'Desp',value:expVal}); }
        if(incVal>0){ sliceLabels.push(lab+ ' (Entr)'); sliceData.push(incVal); sliceColors.push(col.alpha(0.40)); sliceMeta.push({cat:lab,type:'Entr',value:incVal}); }
      });
      const grand = sliceData.reduce((s,v)=>s+v,0);
      cfg = {
        type:'doughnut',
        data:{ labels:sliceLabels, datasets:[{ data:sliceData, backgroundColor:sliceColors, borderColor:'rgba(0,0,0,0.25)', borderWidth:1 }] },
        options:{
          responsive:true,
          maintainAspectRatio:true,
          cutout:'55%',
          plugins:{
            legend:{ display:false },
            tooltip:{
              callbacks:{
                label(ctx){
                  const v = Number(ctx.parsed)||0; const pct = grand>0? ((v/grand)*100).toFixed(1):'0.0';
                  return `${ctx.label}: ${formatCurrency(v)} (${pct}%)`;
                },
                afterBody(items){
                  if(items && items.length){
                    const idx = items[0].dataIndex;
                    const meta = sliceMeta[idx];
                    if(!meta) return;
                    return [`Categoria: ${meta.cat}`, meta.type==='Desp'? 'Tipo: Despesa':'Tipo: Entrada'];
                  }
                }
              }
            }
          }
        },
        plugins: [ centerText ]
      };
    }
  } else {
    cfg = {
      type: chartType === 'bar' ? 'bar' : (chartType === 'doughnut' ? 'doughnut' : 'pie'),
      data:{ labels, datasets:[{ data, backgroundColor: labels.map(()=>randomColor()), borderWidth:1, borderColor:'rgba(0,0,0,0.15)' }] },
      options:{
        responsive:true,
        maintainAspectRatio:true,
        plugins:{
          legend:{ display:false },
          tooltip:{
            callbacks:{
              label(ctx){
                const v = Number(ctx.parsed) || 0;
                const pct = total>0 ? ((v/total)*100).toFixed(1) : '0.0';
                return `${ctx.label}: ${formatCurrency(v)} (${pct}%)`;
              }
            }
          }
        },
        scales: chartType==='bar' ? { x:{ ticks:{ color:'#d4d9e2'} }, y:{ ticks:{ color:'#d4d9e2'}, grid:{ color:'rgba(255,255,255,0.08)'} } } : {}
      },
      plugins: [ centerText ]
    };
  }
  chart=new Chart(ctx,cfg);
  if(window.__df) window.__df.chart = chart;
  if(chartMode==='all'){
    buildLegendAll(labels, expenseData, incomeData);
  } else {
    buildLegend(labels, data, total);
  }
}
function setChartType(t){ chartType = t; renderChart(); }
function setChartMode(m){ /* modo fixo combinado - ignorado */ }
function highlightChartModeButtons(){ /* botões removidos */ }
function toggleShowAll(){ showAllCategories = !showAllCategories; renderChart(); updateShowAllButton(); }
function updateShowAllButton(){ const b=$('chart-show-all'); if(!b) return; b.classList.toggle('active', showAllCategories); b.textContent = showAllCategories ? 'Agrupar Top' : 'Mostrar Todos'; }
function downloadChart(){
  if(!chart) return;
  const a=document.createElement('a');
  a.href=chart.toBase64Image('image/png',1);
  a.download='gastos_categoria.png';
  a.click();
}
function toggleBarLayout(){
  barStacked = !barStacked;
  const btn = document.getElementById('chart-toggle-stack');
  if(btn){ btn.textContent = barStacked ? 'Agrupar' : 'Empilhar'; }
  renderChart();
}
function render(){ renderTotals(); renderList(); renderChart(); }
function safeRender(){ try { render() } catch(e){} }

// ---------- Sync / util ----------
function maybeSyncTransaction(tx){ if(!syncWithFirebase) return; try{ if(window.FirebaseAPI?.saveTransaction) window.FirebaseAPI.saveTransaction(tx) }catch(e){ console.warn('sync failed', e) } }
function maybeDeleteRemote(tx){ if(!syncWithFirebase) return; try{ if(window.FirebaseAPI?.deleteTransaction) window.FirebaseAPI.deleteTransaction(tx.id) }catch(e){ console.warn('remote delete failed', e) } }
function randomColor(){ const r=Math.floor(Math.random()*200)+30; const g=Math.floor(Math.random()*200)+30; const b=Math.floor(Math.random()*200)+30; return `rgb(${r},${g},${b})` }
function colorForCategory(cat){
  const str = String(cat||'');
  let hash = 0; for(let i=0;i<str.length;i++){ hash = ((hash<<5)-hash)+str.charCodeAt(i); hash|=0; }
  const h = Math.abs(hash)%360;
  const s = 55 + (Math.abs(hash)>>3)%20; // 55-74
  const l = 46 + (Math.abs(hash)>>5)%10; // 46-55
  return { solid:`hsl(${h} ${s}% ${l}%)`, alpha:(a)=>`hsl(${h} ${s}% ${l}% / ${a})` };
}

// ---------- Filtros / categorias ----------
function populateCategoryFilter(){ const sel=$('filter-category'); if(!sel) return; const cats=[...new Set(transactions.map(t=>t.category).filter(Boolean))]; sel.innerHTML='<option value="">(todas)</option>'; cats.forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; sel.appendChild(opt) }) }

// ---------- Modal edição ----------
function openEditModal(tx){ const modal=$('edit-modal'); if(!modal){ if(window.UI && UI.toast) UI.toast('Modal de edição não encontrado.', {type:'error'}); else console.warn('Modal não encontrado'); return; } modal.setAttribute('aria-hidden','false'); $('modal-description').value=tx.description||''; $('modal-amount').value=Number(tx.amount)||0; $('modal-category').value=tx.category||''; $('modal-type').value=tx.type||'expense'; modal.dataset.editId=tx.id||'' }
function closeModal(){ const m=$('edit-modal'); if(m){ m.setAttribute('aria-hidden','true'); m.dataset.editId='' } }
if($('modal-close')) $('modal-close').addEventListener('click', closeModal)
if($('modal-cancel')) $('modal-cancel').addEventListener('click', closeModal)
if($('modal-save')) $('modal-save').addEventListener('click', ()=>{ const m=$('edit-modal'); if(!m) return; const id=m.dataset.editId; if(!id) return closeModal(); const desc=$('modal-description').value.trim(); const amount=parseFloat($('modal-amount').value); const category=$('modal-category').value.trim(); const type=$('modal-type').value; if(!desc||!amount||!category){ if(window.UI && UI.toast) UI.toast('Preencha todos os campos', {type:'error'}); else alert('Preencha todos os campos'); return; } updateTransaction(id,{ description:desc, amount, category, type }); closeModal(); })

// ---------- Form principal ----------
function bindTransactionForm(){
  const txForm=$('transaction-form'); if(!txForm) return;
  if(txForm.dataset.bound) return; // evitar binding duplicado
  txForm.dataset.bound = '1';
  txForm.addEventListener('submit', e=>{
    e.preventDefault();
    const descriptionEl=$('description'); const amountEl=$('amount'); const typeEl=$('type'); const categoryEl=$('category'); const feedback=$('tx-feedback');
    if(!descriptionEl||!amountEl||!typeEl||!categoryEl) return;
    const btn = txForm.querySelector('button[type="submit"]');
    const originalBtnText = btn ? btn.textContent : '';
    const description=descriptionEl.value.trim();
    // Normalizar valor: remover R$, espaços, pontos de milhar e trocar vírgula final por ponto
    let raw = amountEl.value.trim();
    raw = raw.replace(/R\$/i,'').replace(/\s+/g,'');
    // Se houver mais de uma vírgula, manter apenas a última como decimal
    const parts = raw.split(',');
    if(parts.length > 2){
      const dec = parts.pop();
      raw = parts.join('') + ',' + dec;
    }
    raw = raw.replace(/\.(?=\d{3}(\D|$))/g,''); // remove pontos de milhar
    raw = raw.replace(',','.');
    let amount = parseFloat(raw);
    const type=typeEl.value; const category=categoryEl.value.trim();
    if(feedback) feedback.textContent='';
    if(!description||!category){ feedback&&(feedback.textContent='Preencha todos os campos'); return; }
    if(isNaN(amount)){ feedback&&(feedback.textContent='Valor inválido. Ex: 123,45'); return; }
    if(amount<=0){ feedback&&(feedback.textContent='Valor deve ser maior que zero'); return; }
    if(btn){ btn.disabled = true; btn.textContent = 'Adicionando...'; }
    try {
      addTransaction({ description, amount, type, category, createdAt:Date.now() });
      if(feedback){ feedback.textContent='Lançamento adicionado!'; }
      txForm.reset();
      setTimeout(()=>{ if(feedback) feedback.textContent=''; },1600);
    } catch(err){
      console.error('Erro ao adicionar', err);
      if(feedback) feedback.textContent='Erro ao adicionar lançamento';
    } finally {
      if(btn){ btn.disabled=false; btn.textContent = originalBtnText; }
    }
  });
}
bindTransactionForm();
document.addEventListener('DOMContentLoaded', bindTransactionForm);
const clearBtn=$('clear-storage'); if(clearBtn){ clearBtn.addEventListener('click', async ()=>{ let ok = true; if(window.UI && UI.confirm){ ok = await UI.confirm('Limpar lançamentos','Tem certeza que deseja limpar todos os lançamentos?'); } else { ok = confirm('Limpar todos os lançamentos?'); } if(!ok) return; if(store){ store.replaceAll([]) } else { transactions=[]; legacySave(); safeRender() } if(window.UI && UI.toast) UI.toast('Lançamentos limpos.', {type:'success'}); }) }

// ---------- Filtros ----------
const applyFiltersBtn=$('apply-filters'); if(applyFiltersBtn){ applyFiltersBtn.addEventListener('click', ()=>{ const fromEl=$('filter-from'); const toEl=$('filter-to'); activeFilter.from=fromEl?(fromEl.value||null):null; activeFilter.to=toEl?(toEl.value||null):null; safeRender(); }) }
const clearFiltersBtn=$('clear-filters'); if(clearFiltersBtn){ clearFiltersBtn.addEventListener('click', ()=>{ const fromEl=$('filter-from'); const toEl=$('filter-to'); if(fromEl) fromEl.value=''; if(toEl) toEl.value=''; activeFilter={ from:null,to:null }; safeRender(); }) }
const applyMonthBtn=$('apply-month'); if(applyMonthBtn){ applyMonthBtn.addEventListener('click', ()=>{ const monthInput=$('filter-month'); if(!monthInput) return; const m=monthInput.value; if(!m) return; const [y, mon]=m.split('-'); activeFilter.from=new Date(y,Number(mon)-1,1).toISOString().slice(0,10); activeFilter.to=new Date(y,Number(mon),0).toISOString().slice(0,10); safeRender(); }) }
const filterCatSel=$('filter-category'); if(filterCatSel){ filterCatSel.addEventListener('change', ()=>{ activeFilter.category=filterCatSel.value||null; safeRender(); }) }
const syncChk=$('sync-firebase'); if(syncChk){ syncChk.addEventListener('change', (e)=>{ syncWithFirebase=e.target.checked; if(syncWithFirebase && window.FirebaseAPI?.loadTransactions){ window.FirebaseAPI.loadTransactions().then(remote=>{ if(Array.isArray(remote)){ const map=Object.fromEntries(transactions.map(t=>[t.id,t])); for(const r of remote){ if(!map[r.id]){ if(store){ store.push(r) } else { transactions.push(r) } } } if(!store) legacySave(); safeRender(); } }).catch(err=>console.warn('load remote failed',err)); } }) }

// ---------- Export CSV & JSON ----------
function exportCSV(){ const rows=[[ 'id','createdAt','description','type','category','amount']]; for(const t of transactions){ if(!inCurrentFilter(t)) continue; rows.push([t.id,new Date(t.createdAt).toISOString(),t.description,t.type,t.category,Number(t.amount)]) } const csv=rows.map(r=>r.map(cell=>'"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='relatorio_transacoes.csv'; a.click(); URL.revokeObjectURL(url); }
function exportJSON(){ const data=JSON.stringify(transactions,null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='transacoes.json'; a.click(); URL.revokeObjectURL(url); }
function importJSONFile(file){ const reader=new FileReader(); reader.onload=e=>{ try { const parsed=JSON.parse(e.target.result); if(Array.isArray(parsed)){ const norm = currentUserNorm || normalizeEmail((currentUserEmail)||'anon'); const adjusted = parsed.filter(Boolean).map(t=>({ ...t, owner:norm })); if(store){ store.replaceAll(adjusted) } else { transactions=adjusted; legacySave(); safeRender() } } } catch(err){ if(window.UI && UI.toast) UI.toast('JSON inválido', {type:'error'}); else alert('JSON inválido'); } }; reader.readAsText(file); }
const exportBtn=$('export-csv'); if(exportBtn){ exportBtn.addEventListener('click', exportCSV) }
// Note: Export/Import JSON UI removed from filters per user request. Underlying
// functions exportJSON/importJSONFile remain available and can be used from
// backup/restore pages or developer console if needed.

// ---------- Undo (se MemoryStore) ----------
function undoLast(){ if(store){ if(!store.undo()){ if(window.UI && UI.toast) UI.toast('Nada para desfazer', {type:'info'}); else alert('Nada para desfazer'); } } else { if(window.UI && UI.toast) UI.toast('Undo disponível apenas com MemoryStore.', {type:'info'}); else alert('Undo disponível apenas com MemoryStore.'); } }

// ---------- Render override p/ categorias ----------
const originalRender = render
render = function(){ try{ populateCategoryFilter() }catch(e){} originalRender() }

// ---------- Init ----------
initStore();
// --- Sanitização e reforço de ownership ---
function sanitizeStoreOwnership(list, normEmail){
  // Regras:
  // 1. Se o item não tem owner, adota normEmail.
  // 2. Se tem owner diferente -> descarta (não reassume para evitar "sequestro").
  // 3. Remove duplicados por id privilegiando o primeiro que pertença ao usuário.
  const seenIds = new Set();
  let changed = false;
  const cleaned = [];
  for(const t of list){
    if(!t) continue;
    let tx = t;
    if(!tx.owner){ tx = { ...tx, owner: normEmail }; changed = true; }
    if(tx.owner !== normEmail) { changed = true; continue; }
    if(seenIds.has(tx.id)){ changed = true; continue; }
    seenIds.add(tx.id);
    cleaned.push(tx);
  }
  return { cleaned, changed };
}
// Limpeza única de restos antigos (chaves hash de outros usuários) – executa 1 vez por perfil/navegador
(function enforceIsolationOnce(){
  try {
    const FLAG = 'finance_cleanup_done_v1';
    if(localStorage.getItem(FLAG)) return;
    const sessionEmail = (window.Auth && Auth.getSession && Auth.getSession()) || null;
    const norm = normalizeEmail(sessionEmail||'anon');
    const myHashKeySuffix = emailHash(norm);
    // Marca reivindicação do legado para este usuário, evitando que outro usuário adote depois
    const LEGACY_CLAIM_FLAG = 'finance_legacy_claimed_v1';
    if(!localStorage.getItem(LEGACY_CLAIM_FLAG)){
      // Se existir LEGACY_KEY e o usuário atual tem store vazia, podemos considerar migração automática;
      // Caso contrário, apenas marcamos como reivindicado para não ser migrado indevidamente por outro usuário.
      localStorage.setItem(LEGACY_CLAIM_FLAG, norm);
    }
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('dashboard_financeiro_transactions_v1::')){
        // se for hash de outro usuário, remove
        if(!k.endsWith(myHashKeySuffix)){
          localStorage.removeItem(k);
        }
      }
    });
    localStorage.setItem(FLAG,'1');
    console.info('[CLEANUP] Limpeza única de chaves antigas concluída');
  } catch(e){ console.warn('Isolation enforce skip', e); }
})();
// Integração UserDB: se disponível, sincroniza transactions com camada unificada
try {
  if(window.UserDB){
    const norm = normalizeEmail((window.Auth && Auth.getSession && Auth.getSession())||'anon');
    window.UserDB.migrateFromOld(norm);
    // Carrega dados do "banco" central e injeta na store se a store estiver vazia ou divergir
    const dbTx = window.UserDB.getUserData(norm);
    if(store){
      if(store.data.length===0 && dbTx.length){
        store.replaceAll(dbTx);
      } else if(store.data.length && !dbTx.length){
        window.UserDB.setUserData(norm, store.data);
      }
      // Observa mudanças futuras e salva
      store.subscribe(arr => {
        // salva somente se não for igual (comparação simples de tamanhos + ids)
        try {
          const existing = window.UserDB.getUserData(norm);
          if(existing.length !== arr.length){
            window.UserDB.setUserData(norm, arr);
          } else {
            const idsA = existing.map(t=>t.id).sort().join('|');
            const idsB = arr.map(t=>t.id).sort().join('|');
            if(idsA!==idsB){ window.UserDB.setUserData(norm, arr); }
          }
        } catch(e){ console.warn('[UserDB] persist fail', e); }
      });
        // Observa mudanças futuras e salva (com sanitização por defesa em profundidade)
        store.subscribe(arr => {
          try {
            const sanitized = sanitizeStoreOwnership(arr, norm);
            const toPersist = sanitized.cleaned;
            const existing = window.UserDB.getUserData(norm);
            if(existing.length !== toPersist.length){
              window.UserDB.setUserData(norm, toPersist);
            } else {
              const idsA = existing.map(t=>t.id).sort().join('|');
              const idsB = toPersist.map(t=>t.id).sort().join('|');
              if(idsA!==idsB){ window.UserDB.setUserData(norm, toPersist); }
            }
            // Atualiza transactions e UI
            transactions = toPersist;
            safeRender();
          } catch(e){ console.warn('[UserDB] persist fail', e); transactions = arr; safeRender(); }
        });

// Expose sanitization helper for manual trigger
window.__sanitizeNow = function(){
  try {
    const norm = normalizeEmail((window.Auth && Auth.getSession && Auth.getSession())||'anon');
    if(store){ const sanitized = sanitizeStoreOwnership(store.data, norm); if(sanitized.changed) store.replaceAll(sanitized.cleaned); }
    if(window.UserDB){ const db = window.UserDB.getUserData(norm); const san = sanitizeStoreOwnership(db, norm); if(san.changed) window.UserDB.setUserData(norm, san.cleaned); }
    safeRender();
    return true;
  } catch(e){ console.warn('sanitizeNow fail', e); return false; }
};

// Reset only current user's data (destrói finance_db_v1.users[norm] and storage keys for that user)
window.__resetMyData = function(){
  try {
    const sessionEmail = (window.Auth && Auth.getSession && Auth.getSession()) || null;
    const norm = normalizeEmail(sessionEmail||'anon');
    // Use UI.confirm if available (returns Promise)
    if(window.UI && UI.confirm){
      return UI.confirm('Apagar meus dados','Tem certeza? Isso irá apagar TODOS os seus lançamentos localmente.').then(ok=>{ if(!ok) return false; return tryReset(norm); }).catch(e=>{ console.warn('confirm fail', e); return false; });
    }
    // Fallback to synchronous confirm
    if(!confirm('Tem certeza? Isso irá apagar TODOS os seus lançamentos localmente.')) return false;
    return tryReset(norm);
  } catch(e){ console.warn('reset fail', e); if(window.UI && UI.toast) UI.toast('Falha ao resetar seus dados', {type:'error'}); else alert('Falha ao resetar seus dados'); return false; }
};

function tryReset(norm){
  try{
    try { const raw = localStorage.getItem('finance_db_v1'); if(raw){ const db = JSON.parse(raw); if(db && db.users && db.users[norm]){ delete db.users[norm]; localStorage.setItem('finance_db_v1', JSON.stringify(db)); } } } catch(e){ console.warn('reset userdb fail', e); }
    try { localStorage.removeItem(userStorageKeyPlain(norm)); } catch(e){}
    if(store){ store.replaceAll([]); }
    try { localStorage.removeItem(userStorageKeyHashed(norm)); } catch(e){}
    safeRender();
    if(window.UI && UI.toast) UI.toast('Seus dados foram apagados localmente.', {type:'success'}); else alert('Seus dados foram apagados localmente.');
    return true;
  } catch(e){ console.warn('tryReset fail', e); if(window.UI && UI.toast) UI.toast('Falha ao resetar seus dados', {type:'error'}); else alert('Falha ao resetar seus dados'); return false; }
}

// Open account modal (very small) – shows email and logout
window.__openAccount = function(){
  try {
    let modal = document.getElementById('account-modal');
    if(!modal){
      modal = document.createElement('div'); modal.id='account-modal'; modal.className='modal'; modal.style.display='block';
      modal.innerHTML = `<div class="modal-content"><header class="modal-header"><h3>Minha Conta</h3><button id="acc-close">×</button></header><div class="modal-body"><p>Email: <span id="acc-email"></span></p><p><button id="acc-logout" class="secondary">Sair</button></p></div></div>`;
      document.body.appendChild(modal);
  const accClose = document.getElementById('acc-close');
  if(accClose) accClose.addEventListener('click', ()=> modal.remove());
  const accLogout = document.getElementById('acc-logout');
  if(accLogout) accLogout.addEventListener('click', ()=>{ localStorage.removeItem('auth_session_email'); location.replace('index.html'); });
    }
    const email = localStorage.getItem('auth_session_email') || '—';
  const accEmailEl = document.getElementById('acc-email');
  if(accEmailEl) accEmailEl.textContent = email;
    modal.style.display='block';
  } catch(e){ console.warn('open account fail', e); }
};

// placeholders for future features
window.__openReports = function(){ if(window.UI && UI.toast) UI.toast('Relatórios - em breve', {type:'info'}); else console.info('Relatórios - em breve'); };
window.__openSettings = function(){ if(window.UI && UI.toast) UI.toast('Configurações - em breve', {type:'info'}); else console.info('Configurações - em breve'); };
    }
    // Expor helpers
    window.__userExport = () => window.UserDB.exportUser(norm);
    window.__userImport = (json) => window.UserDB.importUser(norm, json);
  }
} catch(dbErr){ console.warn('UserDB integration error', dbErr); }
safeRender();

// React to preferences changes (currency/locale) so UI updates formatting immediately
window.addEventListener('prefs:changed', () => {
  try{ safeRender(); }catch(e){}
});

// Integrate with filtros.html: load session-stored range and react to filter events
(function(){
  try{
    const SKEY = 'fd_filter_range';
    const raw = sessionStorage.getItem(SKEY);
    if(raw){
      const parsed = JSON.parse(raw);
      activeFilter.from = parsed.from || null;
      activeFilter.to = parsed.to || null;
    }
  }catch(e){ /* ignore */ }
  // If other pages dispatch filters:applied, update activeFilter and re-render
  window.addEventListener('filters:applied', (ev)=>{
    try{
      const d = ev && ev.detail ? ev.detail : {};
      activeFilter.from = d.from || null;
      activeFilter.to = d.to || null;
      safeRender();
    }catch(e){}
  });
  window.addEventListener('filters:cleared', ()=>{ activeFilter = { from:null, to:null }; safeRender(); });
})();

// Ensure a global sanitize function exists even if UserDB integration path didn't define it
if(typeof window.__sanitizeNow !== 'function'){
  window.__sanitizeNow = function(){
    try {
      const norm = normalizeEmail((window.Auth && Auth.getSession && Auth.getSession())||'anon');
      if(store){ const sanitized = sanitizeStoreOwnership(store.data, norm); if(sanitized.changed) store.replaceAll(sanitized.cleaned); }
      if(window.UserDB && typeof window.UserDB.getUserData === 'function'){ const db = window.UserDB.getUserData(norm); const san = sanitizeStoreOwnership(db, norm); if(san.changed) window.UserDB.setUserData(norm, san.cleaned); }
      safeRender();
      return true;
    } catch(e){ console.warn('sanitizeNow fallback fail', e); return false; }
  };
}

// Controles específicos de gráfico (se a página contiver os botões)
document.addEventListener('DOMContentLoaded', () => {
  const btnPie=$('chart-type-pie');
  const btnDough=$('chart-type-doughnut');
  const btnBar=$('chart-type-bar');
  const btnDown=$('chart-download');
  const btnShowAll=$('chart-show-all');
  const btnStack=$('chart-toggle-stack');
  if(btnPie) btnPie.addEventListener('click', ()=> setChartType('pie'));
  if(btnDough) btnDough.addEventListener('click', ()=> setChartType('doughnut'));
  if(btnBar) btnBar.addEventListener('click', ()=> setChartType('bar'));
  if(btnDown) btnDown.addEventListener('click', downloadChart);
  if(btnShowAll) btnShowAll.addEventListener('click', toggleShowAll);
  if(btnStack) btnStack.addEventListener('click', toggleBarLayout);
  updateShowAllButton();
  // Ajustar label inicial do botão de stack
  if(btnStack) btnStack.textContent = barStacked ? 'Agrupar' : 'Empilhar';
});

// ---------- Expose debug ----------
window.__df = { addTransaction, removeTransaction, updateTransaction, transactions, store, undoLast, chart, setChartType, toggleBarLayout }

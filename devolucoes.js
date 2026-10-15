/* ==================================================================
   DEVOLUÇÕES — módulo independente
   Lançamento (puxa cliente, descrição, planta e peso do cadastro de
   produtos), lista e dashboard próprio. Dados separados dos refugos.
   Sincroniza com o Firestore (coleção "devolucoes") quando online.
   ================================================================== */
(function(){
const DKEY='controle_refugos_2026_devolucoes_v1';
const DKEY_DEL=DKEY+'_del';
const DISP=['Aguardando análise','Retrabalhar','Sucatear (refugo)','Reclamação não procede','Reenviado ao cliente'];
const TIPOS=[{k:'Fundição',n:'Fundição (Metalúrgica)'},{k:'Usinagem',n:'Usinagem (Metal)'}];
const PROC=['','Sim','Não'];
let lista=[];
try{lista=JSON.parse(localStorage.getItem(DKEY)||'[]');if(!Array.isArray(lista))lista=[]}catch(e){lista=[]}
let unsub=null,built=false,aba='lancar';
const $=id=>document.getElementById(id);
const num=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0};
const totalKg=r=>num(r.qtd)*num(r.pesoUn);
const tipoPl=pl=>normalizeText(pl||'').indexOf('USINAGEM')===0?'Usinagem':'Fundição';
const tipoDe=r=>r.tipo||tipoPl(r.planta);
const hoje=()=>{const n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const brDate=iso=>String(iso||'').split('-').reverse().join('/');

/* ---------- estilo ---------- */
(function(){
  const st=document.createElement('style');
  st.textContent='#dvBalao{position:fixed;z-index:9999;background:var(--card,#fff);color:var(--text,#222);border:1px solid var(--border,#ddd);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:12px 14px;max-height:60vh;overflow:auto;font-size:12px}#dvBalao .dvt{font-weight:800;font-size:14px;padding-right:22px}#dvBalao .dvs{color:var(--muted,#667);margin:2px 0 8px}#dvBalao table{width:100%;border-collapse:collapse}#dvBalao th,#dvBalao td{text-align:left;padding:4px 6px;border-top:1px solid var(--border,#ddd);white-space:normal}#dvBalao th:nth-child(n+3),#dvBalao td:nth-child(n+3){text-align:right;white-space:nowrap}#dvBalao .dvx{position:absolute;top:6px;right:8px;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:var(--muted,#667)}.dev-sec{margin:22px 0 10px;font-size:18px;padding-left:10px;border-left:5px solid var(--orange)}.dvbox{position:relative;height:320px}.dvbox canvas{width:100%;height:100%;display:block}.dev-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.dev-tab{border:1px solid var(--border);background:var(--card);color:var(--text);padding:9px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px}.dev-tab.on{background:var(--orange);color:#fff;border-color:var(--orange)}.dev-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.dev-filters label{font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}.dev-info{font-size:12px;color:var(--muted);margin:2px 0 10px}.dev-disp{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(255,90,24,.12);color:var(--orange);white-space:nowrap}.dev-disp.ok{background:#eaf7f1;color:#157348}.dev-disp.no{background:#eef2f6;color:#536273}';
  document.head.appendChild(st);
})();

/* ---------- persistência e Firebase ---------- */
function persist(){try{localStorage.setItem(DKEY,JSON.stringify(lista))}catch(e){console.warn('Devoluções: não foi possível salvar localmente',e)}}
function tombs(){try{return new Set(JSON.parse(localStorage.getItem(DKEY_DEL)||'[]'))}catch(e){return new Set()}}
function saveTombs(s){try{localStorage.setItem(DKEY_DEL,JSON.stringify([...s]))}catch(e){}}
function fbOk(){try{return !!(firebaseOnlineConnected&&firebaseDbOnline)}catch(e){return false}}
function col(){return firebaseRoot().collection('devolucoes')}
function limpo(r){const o={...r};delete o._s;return o}
async function pushOne(r){
  if(!fbOk())return;
  try{
    await col().doc(r.id).set(fsSanitize(limpo(r)));
    const l=lista.find(x=>x.id===r.id);if(l&&!l._s){l._s=true;persist()}
  }catch(e){console.warn('Devolução não enviada ao Firebase:',e)}
}
async function delOne(id){
  if(!fbOk())return false;
  try{await col().doc(id).delete();const t=tombs();t.delete(id);saveTombs(t);return true}catch(e){console.warn('Devolução não apagada no Firebase:',e);return false}
}
function onSnap(snap){
  if(snap&&snap.metadata&&snap.metadata.hasPendingWrites)return;
  const rem=new Map();
  snap.docs.forEach(d=>{const r=fsDesanitize(d.data());r.id=d.id;rem.set(d.id,r)});
  const t=tombs(),out=[];
  rem.forEach((r,id)=>{
    if(t.has(id)){delOne(id);return}
    const l=lista.find(x=>x.id===id);
    if(l&&(l.ts||0)>(r.ts||0)){pushOne(l);out.push({...l})}
    else out.push({...r,_s:true});
  });
  lista.forEach(l=>{
    if(rem.has(l.id)||t.has(l.id))return;
    if(l._s)return;            /* já existia na nuvem e sumiu: foi excluída em outro aparelho */
    pushOne(l);out.push({...l}); /* criada offline: envia */
  });
  lista=out;persist();
  if(built&&$('devolucoes')?.classList.contains('active'))renderAba();
}
window.devListen=function(){
  window.devUnlisten();
  if(!fbOk())return;
  try{if(localStorage.getItem(FIREBASE_SYNC_KEY)==='false')return}catch(e){}
  try{unsub=col().onSnapshot(onSnap,e=>console.error('Escuta devoluções:',e))}catch(e){console.error(e)}
};
window.devUnlisten=function(){if(unsub){try{unsub()}catch(e){}unsub=null}};

/* ---------- construção da tela ---------- */
function build(){
  const root=$('devRoot');if(!root)return;
  const meses=months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
  root.innerHTML=`
  <div class="dev-tabs">
    <button type="button" class="dev-tab on" data-dv="lancar" onclick="devAba('lancar')">➕ Lançar devolução</button>
    <button type="button" class="dev-tab" data-dv="painel" onclick="devAba('painel')">📊 Dashboard</button>
    <button type="button" class="dev-tab" data-dv="lista" onclick="devAba('lista')">📋 Devoluções lançadas</button>
  </div>

  <div id="dvLancar" class="panel">
    <div class="cad-section-head"><div><h3 id="dvTitulo">Nova devolução</h3><div class="small">Formulário FQ051. Selecione a planta e informe o código interno: cliente, descrição e peso vêm do cadastro de produtos. Cada item do formulário é um lançamento (use o mesmo nº do registro).</div></div></div>
    <div id="dvInfo" class="dev-info">Digite o código interno para localizar cliente, peça e peso.</div>
    <form id="dvForm">
      <input type="hidden" id="dvId">
      <div class="formgrid">
        <div class="field"><label>Planta *</label><select id="dvTipo" required><option value="">Selecione a planta</option><option value="Fundição">Fundição (Metalúrgica)</option><option value="Usinagem">Usinagem (Metal)</option></select></div>
        <div class="field"><label>Nº do registro (FQ051)</label><input id="dvNum" placeholder="Ex.: 12/26"></div>
        <div class="field"><label>Data da devolução *</label><input id="dvData" type="date" required></div>
        <div class="field"><label>Recebido por</label><input id="dvRecb" placeholder="Quem recebeu (opcional)"></div>
        <div class="field"><label>Origem</label><select id="dvOrig"><option>Cliente</option><option>Fornecedor</option></select></div>
        <div class="field"><label>Código interno *</label><input id="dvCod" autocomplete="off" placeholder="Digite o código da peça" required></div>
        <div class="field"><label>Cliente *</label><select id="dvCli" required><option value="">Digite o código primeiro</option></select></div>
        <div class="field"><label>Descrição da peça</label><input id="dvProd" readonly placeholder="Preenchida pelo cadastro"></div>
        <div class="field"><label>Nota fiscal de devolução</label><input id="dvNf" placeholder="Nº da NF (opcional)"></div>
        <div class="field"><label>OF</label><input id="dvOf" placeholder="Ex.: 440/26 (opcional)"></div>
        <div class="field"><label>Quantidade devolvida *</label><input id="dvQtd" type="number" step="1" min="0" required placeholder="Peças"></div>
        <div class="field"><label>Peso unitário (kg)</label><input id="dvPeso" type="number" step="0.001" min="0" placeholder="Cadastro da peça (editável)"></div>
        <div class="field"><label>Peso total (kg)</label><input id="dvTot" readonly placeholder="Quantidade × peso unitário"></div>
        <div class="field"><label>Motivo da devolução</label><input id="dvMot" list="dvMotList" placeholder="Ex.: porosidade, dimensional…"><datalist id="dvMotList"></datalist></div>
        <div class="field"><label>Procede?</label><select id="dvProc"><option value="">—</option><option>Sim</option><option>Não</option></select></div>
        <div class="field"><label>S.A. nº</label><input id="dvSA" placeholder="Ex.: 05/26 (opcional)"></div>
        <div class="field"><label>Inspetor</label><input id="dvInsp"></div>
        <div class="field"><label>Vendas</label><input id="dvVend"></div>
        <div class="field"><label>Destino / disposição</label><select id="dvDisp">${DISP.map(d=>`<option>${d}</option>`).join('')}</select></div>
        <div class="field full"><label>Observação</label><textarea id="dvObs" rows="3" placeholder="Detalhes da reclamação, tratativa, etc."></textarea></div>
      </div>
      <div class="actions"><button type="button" class="btn secondary" onclick="devLimpar()">Limpar</button><button type="submit" class="btn primary">Salvar devolução</button></div>
    </form>
  </div>

  <div id="dvPainel" style="display:none">
    <div class="filterbar">
      <strong style="font-size:12px;margin-right:4px">PERÍODO</strong>
      <select id="dvFa"><option value="">Todos os anos</option></select>
      <select id="dvFm"><option value="">Todos os meses</option>${meses}</select>
      <select id="dvFc"><option value="">Todos os clientes</option></select>
      <button class="btn secondary" type="button" onclick="devLimparFiltros()">Limpar</button>
    </div>
    <div class="dev-info">Clique em uma barra para ver o que foi devolvido (cliente, peça e quantidade). Em cada gráfico: <b style="color:var(--orange)">quantidade (peças)</b> no eixo esquerdo e <b style="color:#1f5f99">peso (kg)</b> no eixo direito, lado a lado.</div>
    ${TIPOS.map((t,i)=>`
    <h2 class="dev-sec">${t.n}</h2>
    <div class="cards">
      <div class="card"><div class="kpi-accent"></div><div class="label">Devoluções</div><div class="value" id="dvK${i}Reg">0</div><div class="sub">lançamentos</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Peças devolvidas</div><div class="value" id="dvK${i}Qtd">0</div><div class="sub">quantidade total</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Peso devolvido</div><div class="value" id="dvK${i}Kg">0 kg</div><div class="sub">quantidade × peso unitário</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Aguardando análise</div><div class="value" id="dvK${i}Ab">0</div><div class="sub">sem destino definido</div></div>
    </div>
    <div class="grid">
      <div class="panel wide"><h3>Evolução mensal — ${t.k}</h3><div class="hint">Peças (barras) e kg (linha) por mês.</div><div class="chartbox dvbox"><canvas id="dvC${i}Mes"></canvas></div></div>
      <div class="panel wide"><h3>Por cliente — ${t.k}</h3><div class="hint">Clientes que mais devolveram.</div><div class="chartbox dvbox"><canvas id="dvC${i}Cli"></canvas></div></div>
      <div class="panel wide"><h3>Por motivo — ${t.k}</h3><div class="hint">Principais motivos de devolução.</div><div class="chartbox dvbox"><canvas id="dvC${i}Mot"></canvas></div></div>
      <div class="panel wide"><h3>Por peça — ${t.k}</h3><div class="hint">Peças mais devolvidas.</div><div class="chartbox dvbox"><canvas id="dvC${i}Pec"></canvas></div></div>
    </div>`).join('')}
  </div>

  <div id="dvLista" class="panel" style="display:none">
    <h3>Devoluções lançadas</h3>
    <div class="toolbar"><input id="dvBusca" placeholder="Buscar cliente, código, peça, NF, OF, motivo…"><span id="dvCount" class="small"></span><button class="btn secondary" type="button" onclick="devCsv()">⬇ Exportar CSV</button></div>
    <div class="tablewrap"><table><thead><tr><th>Tipo</th><th>FQ</th><th>Data</th><th>Cliente</th><th>Código</th><th>Peça</th><th>NF</th><th>Qtd.</th><th>Kg</th><th>Motivo</th><th>Procede</th><th>Destino</th><th>Ações</th></tr></thead><tbody id="dvTbody"></tbody></table></div>
  </div>`;

  $('dvForm').addEventListener('submit',salvar);
  $('dvCod').addEventListener('input',buscarPeca);
  $('dvCod').addEventListener('change',buscarPeca);
  $('dvCod').addEventListener('blur',buscarPeca);
  $('dvTipo').addEventListener('change',buscarPeca);
  $('dvQtd').addEventListener('input',calcTot);
  $('dvPeso').addEventListener('input',calcTot);
  ['dvFa','dvFm','dvFc'].forEach(id=>$(id).addEventListener('change',painel));
  $('dvBusca').addEventListener('input',tabela);
  $('dvData').value=hoje();
  built=true;
}

/* ---------- lançamento ---------- */
function pesoDe(p,tipo){
  const pos=v=>{const x=num(v);return x>0?x:0};
  if(tipo==='Usinagem')return pos(p.pesoUsinado)||pos(p.pesoFundUsin)||pos(p.pesoPrincipal)||0;
  return pos(p.pesoFundUsin)||pos(p.pesoPrincipal)||pos(p.pesoUsinado)||0;
}
function setP(p){
  $('dvProd').value=p?(p.descricao||''):'';
  $('dvPeso').value=p?(pesoDe(p,$('dvTipo').value)||''):'';
  calcTot();
}
function calcTot(){const t=num($('dvQtd').value)*num($('dvPeso').value);$('dvTot').value=t?t.toFixed(3):''}
function buscarPeca(){
  const cod=$('dvCod').value.trim(),sel=$('dvCli'),info=$('dvInfo'),atual=sel.value;
  if(!cod){
    sel.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
    setP(null);info.textContent='Digite o código interno para localizar cliente, peça e peso.';return;
  }
  let ms=[];try{ms=pecasPorCodigo(cod)}catch(e){console.warn(e)}
  const tp=$('dvTipo').value;
  const base=ms.find(x=>tp&&tipoPl(x.planta)===tp&&String(x.descricao||'').trim())||ms.find(x=>String(x.descricao||'').trim())||ms[0]||null;
  if(!base){
    sel.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
    setP(null);info.textContent='Código não encontrado no cadastro de produtos. Cadastre o produto ou confira o código.';return;
  }
  setP(base);
  const clientes=normalizeClientList(ms.map(x=>x.cliente).filter(Boolean));
  sel.innerHTML=clienteOptionsHtml(clientes.length?clientes:normalizeClientList(cadastros.clientes),'Selecione o cliente');
  if(atual&&[...sel.options].some(o=>o.value===atual))sel.value=atual;
  else if(clientes.length===1)sel.value=clientes[0];
  const pu=pesoDe(base,tp);
  info.textContent='Código '+cod+' localizado'+(clientes.length>1?' para '+clientes.length+' clientes — selecione o cliente.':'.')+(pu?'':' Produto sem peso cadastrado: informe o peso unitário.');
}
function salvar(ev){
  ev.preventDefault();
  const g=id=>$(id).value.trim();
  const codigo=g('dvCod'),cliente=canonicalClientName(g('dvCli')),qtd=num(g('dvQtd')),data=g('dvData');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return alert('Informe a data da devolução.');
  if(!g('dvTipo'))return alert('Selecione a planta (Fundição ou Usinagem).');
  if(!codigo)return alert('Informe o código interno da peça.');
  if(!cliente)return alert('Selecione o cliente.');
  if(!(qtd>0))return alert('Informe a quantidade devolvida.');
  const id=g('dvId')||('d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  const old=lista.find(x=>x.id===id);
  const r={id,tipo:g('dvTipo'),numFq:g('dvNum'),recebPor:g('dvRecb'),origem:g('dvOrig'),procede:g('dvProc'),sa:g('dvSA'),inspetor:g('dvInsp'),vendas:g('dvVend'),data,codigo,cliente,produto:g('dvProd'),planta:g('dvTipo'),nf:g('dvNf'),of:g('dvOf'),qtd,pesoUn:num(g('dvPeso')),motivo:g('dvMot'),disp:g('dvDisp')||DISP[0],obs:g('dvObs'),criado:old?old.criado:new Date().toISOString(),ts:Date.now()};
  if(old)lista[lista.indexOf(old)]=r;else lista.push(r);
  persist();pushOne(r);
  const edit=!!old;
  limpar();
  try{showToast(edit?'Devolução atualizada.':'Devolução salva com sucesso.')}catch(e){}
}
function limpar(){
  $('dvForm').reset();$('dvId').value='';$('dvTitulo').textContent='Nova devolução';
  $('dvData').value=hoje();
  $('dvCli').innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
  setP(null);$('dvInfo').textContent='Digite o código interno para localizar cliente, peça e peso.';
  listaMotivos();
}
function listaMotivos(){
  const s=new Set();
  lista.forEach(r=>{if(r.motivo)s.add(r.motivo)});
  ['Falha no dimensional','Porosidade','Rechupe','Inclusão de areia','Falha de usinagem','Falha de acabamento','Peça trincada','Dureza fora do especificado'].forEach(x=>s.add(x));
  const dl=$('dvMotList');if(dl)dl.innerHTML=[...s].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(x=>`<option value="${esc(x)}">`).join('');
}
window.devLimpar=limpar;
window.devEdit=function(id){
  const r=lista.find(x=>x.id===id);if(!r)return;
  devAba('lancar');
  $('dvForm').reset();
  $('dvId').value=r.id;$('dvTitulo').textContent='Editar devolução';
  $('dvData').value=r.data||hoje();$('dvCod').value=r.codigo||'';
  $('dvTipo').value=tipoDe(r);
  buscarPeca();$('dvNum').value=r.numFq||'';$('dvRecb').value=r.recebPor||'';$('dvOrig').value=r.origem||'Cliente';$('dvProc').value=r.procede||'';$('dvSA').value=r.sa||'';$('dvInsp').value=r.inspetor||'';$('dvVend').value=r.vendas||'';
  const sel=$('dvCli');
  if(![...sel.options].some(o=>o.value===r.cliente)){const o=document.createElement('option');o.value=r.cliente;o.textContent=r.cliente;sel.appendChild(o)}
  sel.value=r.cliente;
  $('dvProd').value=r.produto||'';
  $('dvNf').value=r.nf||'';$('dvOf').value=r.of||'';$('dvQtd').value=r.qtd??'';
  $('dvPeso').value=r.pesoUn||'';$('dvMot').value=r.motivo||'';$('dvDisp').value=r.disp||DISP[0];$('dvObs').value=r.obs||'';
  calcTot();window.scrollTo({top:0,behavior:'smooth'});
};
window.devDel=function(id){
  const r=lista.find(x=>x.id===id);if(!r)return;
  if(!confirm('Excluir a devolução de '+brDate(r.data)+' ('+(r.produto||r.codigo)+')?'))return;
  lista=lista.filter(x=>x.id!==id);persist();
  const t=tombs();t.add(id);saveTombs(t);delOne(id);
  renderAba();
};

/* ---------- lista ---------- */
function dispCls(d){return d==='Reclamação não procede'?'no':(d==='Aguardando análise'?'':'ok')}
function tabela(){
  const q=String($('dvBusca')?.value||'').toLowerCase();
  const rows=lista.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q)).sort((a,b)=>String(b.data).localeCompare(String(a.data))||(b.ts||0)-(a.ts||0));
  $('dvCount').textContent=rows.length.toLocaleString('pt-BR')+' de '+lista.length.toLocaleString('pt-BR')+' devoluções';
  const mostra=rows.slice(0,300);
  $('dvTbody').innerHTML=mostra.map(r=>`<tr><td>${esc(tipoDe(r))}</td><td>${esc(r.numFq||'')}</td><td>${esc(brDate(r.data))}</td><td>${esc(r.cliente)}</td><td>${esc(r.codigo)}</td><td style="white-space:normal;min-width:160px">${esc(r.produto)}</td><td>${esc(r.nf||'')}</td><td>${fmt(r.qtd)}</td><td>${fmt(totalKg(r))}</td><td style="white-space:normal;min-width:120px">${esc(r.motivo||'')}</td><td>${esc(r.procede||'')}</td><td><span class="dev-disp ${dispCls(r.disp)}">${esc(r.disp||'')}</span></td><td><button class="btn secondary" type="button" onclick="devEdit('${r.id}')">Editar</button> <button class="btn danger" type="button" onclick="devDel('${r.id}')">Excluir</button></td></tr>`).join('')
    ||'<tr><td colspan="12" class="small" style="text-align:center">Nenhuma devolução lançada.</td></tr>';
  if(rows.length>mostra.length)$('dvTbody').innerHTML+=`<tr><td colspan="12" class="small" style="text-align:center">Exibindo as 300 mais recentes. Use a busca para localizar as demais.</td></tr>`;
}
window.devCsv=function(){
  const h=['Tipo','Nº FQ','Recebido por','Origem','Procede','S.A.','Inspetor','Vendas','Data','Cliente','Código','Peça','Planta','NF','OF','Quantidade','Peso unitário (kg)','Peso total (kg)','Motivo','Destino','Observação'];
  const rows=[...lista].sort((a,b)=>String(b.data).localeCompare(String(a.data))).map(r=>[tipoDe(r),r.numFq,r.recebPor,r.origem,r.procede,r.sa,r.inspetor,r.vendas,brDate(r.data),r.cliente,r.codigo,r.produto,r.planta,r.nf,r.of,r.qtd,r.pesoUn,totalKg(r),r.motivo,r.disp,r.obs]);
  const csv=[h,...rows].map(l=>l.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download='devolucoes.csv';a.click();
};

/* ---------- dashboard ---------- */
function opcoes(id,vazio,itens,fmtLabel){
  const el=$(id),old=el.value;
  el.innerHTML=`<option value="">${vazio}</option>`+itens.map(x=>`<option value="${esc(x)}">${esc(fmtLabel?fmtLabel(x):x)}</option>`).join('');
  if(itens.map(String).includes(old))el.value=old;
}
function filtrados(){
  const y=$('dvFa').value,m=$('dvFm').value,c=$('dvFc').value;
  return lista.filter(r=>{const d=String(r.data||'');return (!y||d.slice(0,4)===y)&&(!m||String(Number(d.slice(5,7)))===m)&&(!c||r.cliente===c)});
}
function agrupa(rows,chave,med,limite){
  const o={};rows.forEach(r=>{const k=String(chave(r)||'').trim()||'Não informado';o[k]=(o[k]||0)+med(r)});
  return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,limite||10);
}
function cor(n,f){try{return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f}catch(e){return f}}
function curto(t,n){t=String(t);return t.length>n?t.slice(0,n-1)+'…':t}
/* gráfico combinado: quantidade (eixo esq.) x peso (eixo dir.) */
function combo(id,labels,qtd,kg,linha,grupos){
  const cv=$(id);if(!cv)return;
  cv.style.cursor='pointer';
  const W=cv.clientWidth||cv.parentElement.clientWidth||600,H=cv.clientHeight||320,dpr=window.devicePixelRatio||1;
  cv.width=W*dpr;cv.height=H*dpr;
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const txt=cor('--text','#222'),mut=cor('--muted','#667'),bor=cor('--border','#ddd'),cq=cor('--orange','#ff5a18'),ck='#1f5f99';
  if(!labels.length||!(qtd.some(v=>v>0)||kg.some(v=>v>0))){c.fillStyle=mut;c.font='13px sans-serif';c.textAlign='center';c.fillText('Sem dados no filtro.',W/2,H/2);return}
  const rot=!linha&&labels.length>4,pb=rot?70:28,pl=48,pr=58,pt=26;
  const x0=pl,x1=W-pr,y0=pt,y1=H-pb,gw=(x1-x0)/labels.length;
  cv._hit={x0,x1,gw,labels,grupos:grupos||[],y0,y1};
  if(!cv._bound){cv._bound=1;cv.addEventListener('click',ev=>balao(cv,ev))}
  const nice=m=>{if(m<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(m))),f=m/e;return (f<=1?1:f<=2?2:f<=5?5:10)*e};
  const mq=nice(Math.max(...qtd,0)),mk=nice(Math.max(...kg,0));
  const f=v=>v>=1000?(v/1000).toFixed(v%1000?1:0).replace('.',',')+'k':String(Math.round(v*10)/10).replace('.',',');
  c.font='11px sans-serif';c.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=y1-(y1-y0)*i/4;
    c.strokeStyle=bor;c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.stroke();
    c.fillStyle=cq;c.textAlign='right';c.fillText(f(mq*i/4),x0-6,y+4);
    c.fillStyle=ck;c.textAlign='left';c.fillText(f(mk*i/4),x1+6,y+4);
  }
  c.fillStyle=cq;c.textAlign='left';c.font='bold 11px sans-serif';c.fillText('Peças',x0-40,y0-10);
  c.fillStyle=ck;c.textAlign='right';c.fillText('kg',x1+52,y0-10);c.font='11px sans-serif';
  const bw=linha?Math.min(34,gw*.55):Math.min(26,gw*.34);
  const px=[];
  labels.forEach((l,i)=>{
    const cx=x0+gw*(i+.5),hq=(y1-y0)*qtd[i]/mq,hk=(y1-y0)*kg[i]/mk;
    if(linha){
      c.fillStyle=cq;c.fillRect(cx-bw/2,y1-hq,bw,hq);px.push([cx,y1-hk]);
      if(qtd[i]>0){c.fillStyle=txt;c.textAlign='center';c.fillText(f(qtd[i]),cx,y1-hq-4)}
    }else{
      c.fillStyle=cq;c.fillRect(cx-bw-1,y1-hq,bw,hq);c.fillStyle=ck;c.fillRect(cx+1,y1-hk,bw,hk);
      c.fillStyle=txt;c.textAlign='center';c.font='10px sans-serif';
      if(qtd[i]>0)c.fillText(f(qtd[i]),cx-bw/2-1,y1-hq-3);
      if(kg[i]>0)c.fillText(f(kg[i]),cx+bw/2+1,y1-hk-3);
      c.font='11px sans-serif';
    }
    c.fillStyle=mut;
    if(rot){c.save();c.translate(cx,y1+10);c.rotate(-Math.PI/4);c.textAlign='right';c.fillText(curto(l,22),0,0);c.restore()}
    else{c.textAlign='center';c.fillText(curto(l,12),cx,y1+16)}
  });
  if(linha){
    c.strokeStyle=ck;c.lineWidth=2.5;c.beginPath();px.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();
    px.forEach((p,i)=>{c.fillStyle=ck;c.beginPath();c.arc(p[0],p[1],3.5,0,7);c.fill();if(kg[i]>0){c.textAlign='center';c.fillText(f(kg[i]),p[0],p[1]-8)}});
  }
  c.strokeStyle=mut;c.beginPath();c.moveTo(x0,y1);c.lineTo(x1,y1);c.stroke();
}
function fechaBalao(){const b=$('dvBalao');if(b)b.remove()}
function balao(cv,ev){
  fechaBalao();
  const h=cv._hit;if(!h)return;
  const rc=cv.getBoundingClientRect(),x=ev.clientX-rc.left,y=ev.clientY-rc.top;
  if(x<h.x0||x>h.x1||y<h.y0-4||y>h.y1+80)return;
  const i=Math.floor((x-h.x0)/h.gw),rs=h.grupos[i];
  if(!rs||!rs.length)return;
  const ag={};
  rs.forEach(r=>{const k=r.cliente+'||'+(r.produto||r.codigo);const e=ag[k]||(ag[k]={cli:r.cliente,pec:r.produto||r.codigo,cod:r.codigo,q:0,k:0});e.q+=num(r.qtd);e.k+=totalKg(r)});
  const it=Object.values(ag).sort((a,b)=>b.q-a.q);
  const tq=it.reduce((a,e)=>a+e.q,0),tk=it.reduce((a,e)=>a+e.k,0);
  const b=document.createElement('div');b.id='dvBalao';
  b.innerHTML='<button type="button" class="dvx" aria-label="Fechar">×</button><div class="dvt">'+esc(h.labels[i])+'</div><div class="dvs">'+fmt(tq)+' peça(s) · '+fmt(tk)+' kg · '+rs.length+' lançamento(s)</div><table><thead><tr><th>Cliente</th><th>Peça</th><th>Qtd.</th><th>Kg</th></tr></thead><tbody>'+it.map(e=>'<tr><td>'+esc(e.cli)+'</td><td>'+esc(e.cod)+' — '+esc(e.pec)+'</td><td>'+fmt(e.q)+'</td><td>'+fmt(e.k)+'</td></tr>').join('')+'</tbody></table>';
  document.body.appendChild(b);
  const w=Math.min(460,window.innerWidth-16);b.style.width=w+'px';
  let L=ev.clientX+12,T=ev.clientY+12;
  if(L+w>window.innerWidth-8)L=Math.max(8,window.innerWidth-w-8);
  const bh=b.offsetHeight;if(T+bh>window.innerHeight-8)T=Math.max(8,window.innerHeight-bh-8);
  b.style.left=L+'px';b.style.top=T+'px';
  b.querySelector('.dvx').onclick=fechaBalao;
  ev.stopPropagation();
}
document.addEventListener('click',ev=>{const b=$('dvBalao');if(b&&!b.contains(ev.target))fechaBalao()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')fechaBalao()});
function painel(){
  if(!built)return;
  opcoes('dvFa','Todos os anos',[...new Set(lista.map(r=>String(r.data||'').slice(0,4)).filter(Boolean))].sort());
  opcoes('dvFc','Todos os clientes',[...new Set(lista.map(r=>r.cliente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  const todas=filtrados();
  TIPOS.forEach((t,i)=>{
    const rows=todas.filter(r=>tipoDe(r)===t.k);
    const tq=rows.reduce((a,r)=>a+num(r.qtd),0),tk=rows.reduce((a,r)=>a+totalKg(r),0);
    $('dvK'+i+'Reg').textContent=fmt(rows.length);$('dvK'+i+'Qtd').textContent=fmt(tq);$('dvK'+i+'Kg').textContent=fmt(tk)+' kg';
    $('dvK'+i+'Ab').textContent=fmt(rows.filter(r=>(r.disp||DISP[0])===DISP[0]).length);
    const mq=Array(12).fill(0),mk=Array(12).fill(0);
    rows.forEach(r=>{const m=Number(String(r.data||'').slice(5,7));if(m>=1&&m<=12){mq[m-1]+=num(r.qtd);mk[m-1]+=totalKg(r)}});
    const gm=Array.from({length:12},()=>[]);rows.forEach(r=>{const m=Number(String(r.data||'').slice(5,7));if(m>=1&&m<=12)gm[m-1].push(r)});
    combo('dvC'+i+'Mes',months,mq,mk,true,gm);
    const por=(id,chave)=>{
      const o={};rows.forEach(r=>{const k=String(chave(r)||'').trim()||'Não informado';const e=o[k]||(o[k]={q:0,k:0,rs:[]});e.q+=num(r.qtd);e.k+=totalKg(r);e.rs.push(r)});
      const it=Object.entries(o).sort((a,b)=>b[1].k-a[1].k||b[1].q-a[1].q).slice(0,8);
      combo(id,it.map(x=>x[0]),it.map(x=>x[1].q),it.map(x=>x[1].k),false,it.map(x=>x[1].rs));
    };
    por('dvC'+i+'Cli',r=>r.cliente);por('dvC'+i+'Mot',r=>r.motivo);por('dvC'+i+'Pec',r=>r.produto||r.codigo);
  });
}
window.devLimparFiltros=function(){['dvFa','dvFm','dvFc'].forEach(id=>$(id).value='');painel()};

/* ---------- abas ---------- */
function renderAba(){
  if(aba==='painel')painel();
  else if(aba==='lista')tabela();
  else listaMotivos();
}
window.devAba=function(a){
  if(!built)return;
  fechaBalao();
  aba=a;
  document.querySelectorAll('#devRoot .dev-tab').forEach(b=>b.classList.toggle('on',b.dataset.dv===a));
  $('dvLancar').style.display=a==='lancar'?'':'none';
  $('dvPainel').style.display=a==='painel'?'':'none';
  $('dvLista').style.display=a==='lista'?'':'none';
  renderAba();
};
window.devInit=function(){
  if(!built){build();limpar()}
  devAba(aba);
  try{if(!unsub)window.devListen()}catch(e){}
};
window.addEventListener('resize',()=>{if(built&&aba==='painel'&&$('devolucoes')?.classList.contains('active'))painel()});
})();

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
const naoProcede=r=>r.procede==='Não'||r.disp==='Reclamação não procede';
let viewRaw=false,tabPl=0;
const totalKg=r=>(naoProcede(r)&&!viewRaw)?0:num(r.qtd)*num(r.pesoUn);
const okCusto=()=>{try{return costAccessAllowed()}catch(e){return false}};
const valorR=r=>{try{return totalKg(r)*window.custoDevKg(tipoDe(r),r.data)}catch(e){return 0}};
const tipoPl=pl=>normalizeText(pl||'').indexOf('USINAGEM')===0?'Usinagem':'Fundição';
const tipoDe=r=>r.tipo||tipoPl(r.planta);
const hoje=()=>{const n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const brDate=iso=>String(iso||'').split('-').reverse().join('/');

/* ---------- estilo ---------- */
(function(){
  const st=document.createElement('style');
  st.textContent='#dvBalao{position:fixed;z-index:9999;background:var(--card,#fff);color:var(--text,#222);border:1px solid var(--border,#ddd);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:12px 14px;max-height:60vh;overflow:auto;font-size:12px}#dvBalao .dvt{font-weight:800;font-size:14px;padding-right:22px}#dvBalao .dvs{color:var(--muted,#667);margin:2px 0 8px}#dvBalao table{width:100%;border-collapse:collapse}#dvBalao th,#dvBalao td{text-align:left;padding:4px 6px;border-top:1px solid var(--border,#ddd);white-space:normal}#dvBalao th:nth-child(n+3),#dvBalao td:nth-child(n+3){text-align:right;white-space:nowrap}#dvBalao .dvx{position:absolute;top:6px;right:8px;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:var(--muted,#667)}.dv-prev{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.dv-prev .th{position:relative}.dv-prev img{height:84px;border-radius:8px;border:1px solid var(--border)}.dv-prev button{position:absolute;top:-6px;right:-6px;border:0;border-radius:50%;width:20px;height:20px;background:#d32f2f;color:#fff;cursor:pointer;line-height:1}#dvFotoModal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:14px}#dvFotoModal .box{background:var(--card,#fff);color:var(--text,#222);border-radius:14px;max-width:900px;width:100%;max-height:90vh;overflow:auto;padding:16px}#dvFotoModal .gal{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}#dvFotoModal .gal .th{position:relative}#dvFotoModal .gal img{height:150px;border-radius:10px;border:1px solid var(--border);cursor:zoom-in}#dvFotoModal .gal button{position:absolute;top:4px;right:4px}.dev-h{margin:18px 0 8px;font-size:15px}.dv-item{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px;background:var(--card)}.dv-ih{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.dev-sec{margin:22px 0 10px;font-size:18px;padding-left:10px;border-left:5px solid var(--orange)}.dvbox{position:relative;height:320px}.dvbox canvas{width:100%;height:100%;display:block}.dev-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.dev-tab{border:1px solid var(--border);background:var(--card);color:var(--text);padding:9px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px}.dev-tab.on{background:var(--orange);color:#fff;border-color:var(--orange)}.dev-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.dev-filters label{font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}.dev-info{font-size:12px;color:var(--muted);margin:2px 0 10px}.dev-disp{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(255,90,24,.12);color:var(--orange);white-space:nowrap}.dev-disp.ok{background:#eaf7f1;color:#157348}.dev-disp.no{background:#eef2f6;color:#536273}';
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
  try{reenviarFotos()}catch(e){}
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
    <div class="cad-section-head"><div><h3 id="dvTitulo">Novo registro de devolução</h3><div class="small">Formulário FQ051. Preencha os dados da etiqueta/FQ051 e adicione quantos itens foram devolvidos nela. Em cada item, o código puxa cliente, descrição e peso do cadastro.</div></div></div>
    <form id="dvForm">
      <input type="hidden" id="dvId">
      <div class="formgrid">
        <div class="field"><label>Planta *</label><select id="dvTipo" required><option value="">Selecione a planta</option><option value="Fundição">Fundição (Metalúrgica)</option><option value="Usinagem">Usinagem (Metal)</option></select></div>
        <div class="field"><label>Nº do registro (FQ051) *</label><input id="dvNum" required placeholder="Ex.: 02/26"></div>
        <div class="field"><label>Data da devolução *</label><input id="dvData" type="date" required></div>
        <div class="field"><label>Recebido por</label><input id="dvRecb" placeholder="Quem recebeu (opcional)"></div>
        <div class="field"><label>Origem</label><select id="dvOrig"><option>Cliente</option><option>Fornecedor</option></select></div>
        <div class="field"><label>Nota fiscal de devolução</label><input id="dvNf" placeholder="Nº da NF (opcional)"></div>
        <div class="field"><label>S.A. nº</label><input id="dvSA" placeholder="Ex.: 05/26 (opcional)"></div>
        <div class="field"><label>Inspetor</label><input id="dvInsp"></div>
        <div class="field"><label>Vendas</label><input id="dvVend"></div>
      </div>
      <input type="hidden" id="dvReg">
      <div class="field full" style="margin:6px 0 4px"><label>📷 Fotos da etiqueta / peça devolvida (opcional)</label><input id="dvFotoIn" type="file" accept="image/*" multiple><div id="dvFotoPrev" class="dv-prev"></div></div>
      <h4 class="dev-h">Itens devolvidos neste registro</h4>
      <div id="dvItens"></div>
      <div class="actions"><button type="button" class="btn secondary" onclick="devAddItem()">➕ Adicionar item</button><button type="button" class="btn secondary" onclick="devLimpar()">Limpar</button><button type="submit" class="btn primary">Salvar registro</button></div>
    </form>
  </div>

  <div id="dvPainel" style="display:none">
    <div class="filterbar">
      <strong style="font-size:12px;margin-right:4px">PERÍODO</strong>
      <select id="dvFa"><option value="">Todos os anos</option></select>
      <select id="dvFm"><option value="">Todos os meses</option>${meses}</select>
      <select id="dvFc"><option value="">Todos os clientes</option></select>
      <select id="dvFp" title="Filtrar por procedência"><option value="proc">Só as que procedem</option><option value="nao">Só as que NÃO procedem</option><option value="todas">Todas (procede + não procede)</option></select>
      <button class="btn secondary" type="button" onclick="devLimparFiltros()">Limpar</button>
      <button class="btn primary" type="button" onclick="devPdf()">📄 PDF do período</button>
    </div>
    <div class="dev-info">Clique em uma barra para ver o que foi devolvido (cliente, peça e quantidade). Em cada gráfico: <b style="color:var(--orange)">quantidade (peças)</b> no eixo esquerdo e <b style="color:#1f5f99">peso (kg)</b> no eixo direito, lado a lado.</div>
    <div id="dvNpPanel" class="panel wide" style="margin-top:10px"><h3>🚫 Reclamações "não procede" por cliente</h3><div class="hint">Clientes que mais abriram devolução improcedente no período (ano e mês dos filtros; todas as plantas). Útil para conversar com Vendas.</div><div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Reclamações</th><th>Não procede</th><th>% improcedente</th><th>Peças não procede</th><th>Peças total</th></tr></thead><tbody id="dvNpBody"></tbody></table></div></div>
    <div id="dvTabs" style="display:flex;gap:8px;margin:10px 0">${TIPOS.map((t,i)=>`<button type="button" class="btn secondary" id="dvTab${i}" onclick="devTab(${i})">${t.n}</button>`).join('')}</div>
    ${TIPOS.map((t,i)=>`<div id="dvSec${i}" style="display:${i===0?'block':'none'}">
    <h2 class="dev-sec">${t.n}</h2>
    <div class="cards">
      <div class="card"><div class="kpi-accent"></div><div class="label">Registros (etiquetas)</div><div class="value" id="dvK${i}Reg">0</div><div class="sub">nº de FQ051 distintos</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Peças devolvidas</div><div class="value" id="dvK${i}Qtd">0</div><div class="sub">quantidade total</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Peso devolvido (só procedentes)</div><div class="value" id="dvK${i}Kg">0 kg</div><div class="sub">qtd × peso unit.; "não procede" fica fora</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Valor devolvido</div><div class="value" id="dvK${i}Rs">—</div><div class="sub" id="dvK${i}RsS">kg × R$/kg da planta</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Aguardando análise</div><div class="value" id="dvK${i}Ab">0</div><div class="sub">sem destino definido</div></div>
    </div>
    <div class="grid">
      <div class="panel wide"><h3>Evolução mensal — ${t.k}</h3><div class="hint">Peças (barras) e kg (linha) por mês.</div><div class="chartbox dvbox"><canvas id="dvC${i}Mes"></canvas></div></div>
      ${i===0?`<div class="panel wide"><h3>Produção × devolução — Fundição</h3><div class="hint">Barras: produção da Fundição no mês (kg, eixo esquerdo). Linha: % devolvido = kg devolvido (só procedentes) ÷ produção (eixo direito). A produção é a da planta inteira (não muda com o filtro de cliente).</div><div class="chartbox dvbox"><canvas id="dvCmp"></canvas></div><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Período</th><th>Produção (kg)</th><th>Peças devolvidas</th><th>Kg devolvido</th><th>% devolvido</th><th>Peças "não procede"</th></tr></thead><tbody id="dvCmpBody"></tbody></table></div></div>`:''}
      <div class="panel wide"><h3>Por cliente — ${t.k}</h3><div class="hint">Clientes que mais devolveram.</div><div class="chartbox dvbox"><canvas id="dvC${i}Cli"></canvas></div></div>
      <div class="panel wide"><h3>Por motivo — ${t.k}</h3><div class="hint">Principais motivos de devolução.</div><div class="chartbox dvbox"><canvas id="dvC${i}Mot"></canvas></div></div>
      <div class="panel wide"><h3>Por peça — ${t.k}</h3><div class="hint">Peças mais devolvidas.</div><div class="chartbox dvbox"><canvas id="dvC${i}Pec"></canvas></div></div>
    </div></div>`).join('')}
  </div>

  <div id="dvLista" class="panel" style="display:none">
    <h3>Devoluções lançadas</h3>
    <div class="toolbar"><input id="dvBusca" placeholder="Buscar cliente, código, peça, NF, OF, motivo…"><span id="dvCount" class="small"></span><button class="btn secondary" type="button" onclick="devCsv()">⬇ Exportar CSV</button><button class="btn secondary" type="button" onclick="devBackup()">💾 Backup JSON</button><label class="btn secondary">📂 Restaurar backup<input type="file" accept=".json" hidden onchange="devRestaurar(this)"></label></div>
    <div class="tablewrap"><table><thead><tr><th>Tipo</th><th>FQ</th><th>Data</th><th>Cliente</th><th>Código</th><th>Peça</th><th>NF</th><th>Qtd.</th><th>Kg</th><th>Motivo</th><th>Procede</th><th>Destino</th><th>Ações</th></tr></thead><tbody id="dvTbody"></tbody></table></div>
  </div>`;

  $('dvForm').addEventListener('submit',salvar);
  $('dvFotoIn').addEventListener('change',async ev=>{for(const f of [...ev.target.files]){try{pend.push(await comprimir(f))}catch(e){alert('Não foi possível ler a imagem '+f.name)}}ev.target.value='';prevFotos()});
  $('dvTipo').addEventListener('change',()=>document.querySelectorAll('#dvItens .dv-item').forEach(buscarRow));
  const it=$('dvItens');
  it.addEventListener('input',ev=>{const f=ev.target.dataset&&ev.target.dataset.f,row=ev.target.closest('.dv-item');if(!row)return;if(f==='cod')buscarRow(row);else if(f==='qtd'||f==='peso')calcRow(row)});
  it.addEventListener('focusout',ev=>{if(ev.target.dataset&&ev.target.dataset.f==='cod')buscarRow(ev.target.closest('.dv-item'))});
  ['dvFa','dvFm','dvFc','dvFp'].forEach(id=>$(id).addEventListener('change',painel));
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
const Q=(row,f)=>row.querySelector('[data-f="'+f+'"]');
const INFO0='Digite o código interno para localizar cliente, peça e peso.';
function itemHtml(){
  return `<div class="dv-item">
    <div class="dv-ih"><b class="dv-n">Item</b><button type="button" class="btn danger" onclick="devDelItem(this)">Remover item</button></div>
    <div class="dev-info" data-f="info">${INFO0}</div>
    <div class="formgrid">
      <div class="field"><label>Código interno *</label><input data-f="cod" autocomplete="off" placeholder="Digite o código da peça"></div>
      <div class="field"><label>Cliente *</label><select data-f="cli"><option value="">Digite o código primeiro</option></select></div>
      <div class="field"><label>Descrição da peça</label><input data-f="prod" readonly placeholder="Preenchida pelo cadastro"></div>
      <div class="field"><label>OF</label><input data-f="of" placeholder="Ex.: 440/26 (opcional)"></div>
      <div class="field"><label>Quantidade devolvida *</label><input data-f="qtd" type="number" step="1" min="0" placeholder="Peças"></div>
      <div class="field"><label>Peso unitário (kg)</label><input data-f="peso" type="number" step="0.001" min="0" placeholder="Cadastro (editável)"></div>
      <div class="field"><label>Peso total (kg)</label><input data-f="tot" readonly placeholder="Quantidade × peso unitário"></div>
      <div class="field"><label>Problema informado / motivo</label><input data-f="mot" list="dvMotList" placeholder="Ex.: porosidade, dimensional…"></div>
      <div class="field"><label>Procede?</label><select data-f="proc"><option value="">—</option><option>Sim</option><option>Não</option></select></div>
      <div class="field"><label>Destino / disposição</label><select data-f="disp">${DISP.map(d=>`<option>${d}</option>`).join('')}</select></div>
      <div class="field full"><label>Observação</label><textarea data-f="obs" rows="2" placeholder="Detalhes, tratativa, etc."></textarea></div>
    </div>
  </div>`;
}
function renum(){const rs=document.querySelectorAll('#dvItens .dv-item');rs.forEach((r,i)=>{r.querySelector('.dv-n').textContent='Item '+(i+1);r.querySelector('.btn.danger').style.display=rs.length>1?'':'none'})}
function addItem(){const d=document.createElement('div');d.innerHTML=itemHtml();const row=d.firstElementChild;$('dvItens').appendChild(row);resetCli(row);renum();return row}
window.devAddItem=function(){const row=addItem();const c=Q(row,'cod');if(c)c.focus()};
window.devDelItem=function(btn){const rs=document.querySelectorAll('#dvItens .dv-item');if(rs.length<=1)return;btn.closest('.dv-item').remove();renum()};
function resetCli(row){Q(row,'cli').innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente')}
function setP(row,p){
  Q(row,'prod').value=p?(p.descricao||''):'';
  Q(row,'peso').value=p?(pesoDe(p,$('dvTipo').value)||''):'';
  calcRow(row);
}
function calcRow(row){const t=num(Q(row,'qtd').value)*num(Q(row,'peso').value);Q(row,'tot').value=t?t.toFixed(3):''}
function buscarRow(row){
  if(!row)return;
  const cod=Q(row,'cod').value.trim(),sel=Q(row,'cli'),info=Q(row,'info'),atual=sel.value;
  if(!cod){resetCli(row);setP(row,null);info.textContent=INFO0;return}
  let ms=[];try{ms=pecasPorCodigo(cod)}catch(e){console.warn(e)}
  const tp=$('dvTipo').value;
  const base=ms.find(x=>tp&&tipoPl(x.planta)===tp&&String(x.descricao||'').trim())||ms.find(x=>String(x.descricao||'').trim())||ms[0]||null;
  if(!base){resetCli(row);setP(row,null);info.textContent='Código não encontrado no cadastro de produtos. Cadastre o produto ou confira o código.';return}
  setP(row,base);
  const clientes=normalizeClientList(ms.map(x=>x.cliente).filter(Boolean));
  sel.innerHTML=clienteOptionsHtml(clientes.length?clientes:normalizeClientList(cadastros.clientes),'Selecione o cliente');
  if(atual&&[...sel.options].some(o=>o.value===atual))sel.value=atual;
  else if(clientes.length===1)sel.value=clientes[0];
  const pu=pesoDe(base,tp);
  info.textContent='Código '+cod+' localizado'+(clientes.length>1?' para '+clientes.length+' clientes — selecione o cliente.':'.')+(pu?'':' Produto sem peso cadastrado: informe o peso unitário.');
}
function cab(){const g=id=>$(id).value.trim();return{tipo:g('dvTipo'),numFq:g('dvNum'),data:g('dvData'),recebPor:g('dvRecb'),origem:g('dvOrig'),nf:g('dvNf'),sa:g('dvSA'),inspetor:g('dvInsp'),vendas:g('dvVend')}}
function salvar(ev){
  ev.preventDefault();
  const c=cab();
  if(!c.tipo)return alert('Selecione a planta (Fundição ou Usinagem).');
  if(!c.numFq)return alert('Informe o nº do registro (FQ051), ex.: 02/26.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(c.data))return alert('Informe a data da devolução.');
  const rows=[...document.querySelectorAll('#dvItens .dv-item')];
  const itens=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i],g=f=>Q(row,f).value.trim();
    const codigo=g('cod'),qtd=num(g('qtd'));
    if(!codigo&&!qtd&&rows.length>1)continue;
    if(!codigo)return alert('Item '+(i+1)+': informe o código interno da peça.');
    const cliente=canonicalClientName(g('cli'));
    if(!cliente)return alert('Item '+(i+1)+': selecione o cliente.');
    if(!(qtd>0))return alert('Item '+(i+1)+': informe a quantidade devolvida.');
    itens.push({i,codigo,cliente,qtd,produto:g('prod'),of:g('of'),pesoUn:num(g('peso')),motivo:g('mot'),procede:g('proc'),disp:g('disp')||DISP[0],obs:g('obs')});
  }
  if(!itens.length)return alert('Adicione ao menos um item.');
  const editId=$('dvId').value,agora=Date.now();
  const oldRec=editId?lista.find(x=>x.id===editId):null;
  const regId=$('dvReg').value||(oldRec&&oldRec.regId)||('R'+agora.toString(36)+Math.random().toString(36).slice(2,6));
  itens.forEach((it,k)=>{
    const id=(editId&&it.i===0)?editId:('d'+agora.toString(36)+Math.random().toString(36).slice(2,6)+k);
    const old=lista.find(x=>x.id===id);
    const r={id,regId,nFotos:(old&&old.nFotos)||(lista.find(x=>x.regId===regId)||{}).nFotos||0,tipo:c.tipo,numFq:c.numFq,recebPor:c.recebPor,origem:c.origem,procede:it.procede,sa:c.sa,inspetor:c.inspetor,vendas:c.vendas,data:c.data,codigo:it.codigo,cliente:it.cliente,produto:it.produto,planta:c.tipo,nf:c.nf,of:it.of,qtd:it.qtd,pesoUn:it.pesoUn,motivo:it.motivo,disp:it.disp,obs:it.obs,criado:old?old.criado:new Date().toISOString(),ts:agora+k};
    if(old)lista[lista.indexOf(old)]=r;else lista.push(r);
    pushOne(r);
  });
  persist();
  const nova=pend.slice();
  if(nova.length)salvarFotos(regId,nova);
  const edit=!!editId;
  limpar();
  try{showToast(edit?'Registro atualizado.':('Registro salvo com '+itens.length+(itens.length===1?' item.':' itens.')))}catch(e){}
}
function limpar(){
  $('dvForm').reset();$('dvId').value='';$('dvTitulo').textContent='Novo registro de devolução';
  $('dvData').value=hoje();
  $('dvItens').innerHTML='';addItem();
  $('dvReg').value='';pend=[];prevFotos();
  listaMotivos();
}
function listaMotivos(){
  const s=new Set();
  lista.forEach(r=>{if(r.motivo)s.add(r.motivo)});
  ['Falha no dimensional','Porosidade','Rechupe','Inclusão de areia','Falha de usinagem','Falha de acabamento','Peça trincada','Dureza fora do especificado'].forEach(x=>s.add(x));
  if(!$('dvMotList')){const d=document.createElement('datalist');d.id='dvMotList';document.body.appendChild(d)}
  $('dvMotList').innerHTML=[...s].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(x=>`<option value="${esc(x)}">`).join('');
}
window.devLimpar=limpar;
function fillCab(r){
  $('dvReg').value=r.regId||'';pend=[];prevFotos();
  $('dvTipo').value=tipoDe(r);$('dvNum').value=r.numFq||'';$('dvData').value=r.data||hoje();$('dvRecb').value=r.recebPor||'';
  $('dvOrig').value=r.origem||'Cliente';$('dvNf').value=r.nf||'';$('dvSA').value=r.sa||'';$('dvInsp').value=r.inspetor||'';$('dvVend').value=r.vendas||'';
}
window.devEdit=function(id){
  const r=lista.find(x=>x.id===id);if(!r)return;
  devAba('lancar');
  $('dvForm').reset();$('dvItens').innerHTML='';
  $('dvId').value=r.id;$('dvTitulo').textContent='Editar item do registro '+(r.numFq||'');
  fillCab(r);
  const row=addItem();
  Q(row,'cod').value=r.codigo||'';buscarRow(row);
  const sel=Q(row,'cli');
  if(![...sel.options].some(o=>o.value===r.cliente)){const o=document.createElement('option');o.value=r.cliente;o.textContent=r.cliente;sel.appendChild(o)}
  sel.value=r.cliente;
  Q(row,'prod').value=r.produto||'';Q(row,'of').value=r.of||'';Q(row,'qtd').value=r.qtd??'';
  Q(row,'peso').value=r.pesoUn||'';Q(row,'mot').value=r.motivo||'';Q(row,'proc').value=r.procede||'';Q(row,'disp').value=r.disp||DISP[0];Q(row,'obs').value=r.obs||'';
  calcRow(row);window.scrollTo({top:0,behavior:'smooth'});
};
window.devMaisItem=function(id){
  const r=lista.find(x=>x.id===id);if(!r)return;
  devAba('lancar');
  $('dvForm').reset();$('dvItens').innerHTML='';
  $('dvId').value='';$('dvTitulo').textContent='Novo item no registro '+(r.numFq||'(sem nº)');
  fillCab(r);
  const row=addItem();Q(row,'cod').focus();
  window.scrollTo({top:0,behavior:'smooth'});
};
window.devDel=function(id){
  const r=lista.find(x=>x.id===id);if(!r)return;
  if(!confirm('Excluir a devolução de '+brDate(r.data)+' ('+(r.produto||r.codigo)+')?'))return;
  lista=lista.filter(x=>x.id!==id);persist();
  if(r.regId&&!lista.some(x=>x.regId===r.regId))apagarFotosReg(r.regId);
  const t=tombs();t.add(id);saveTombs(t);delOne(id);
  renderAba();
};

/* ---------- fotos da etiqueta (IndexedDB local + Firestore "devolucaoFotos") ---------- */
let pend=[];
function idbOpen(){return new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('sem IndexedDB'));const q=indexedDB.open('controle_refugos_devfotos',1);q.onupgradeneeded=()=>{q.result.createObjectStore('f',{keyPath:'id'}).createIndex('reg','regId')};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function fotosLocais(regId){try{const db=await idbOpen();return await new Promise(res=>{const o=db.transaction('f').objectStore('f').index('reg').getAll(regId);o.onsuccess=()=>res(o.result||[]);o.onerror=()=>res([])})}catch(e){return []}}
async function fotosTodas(){try{const db=await idbOpen();return await new Promise(res=>{const o=db.transaction('f').objectStore('f').getAll();o.onsuccess=()=>res(o.result||[]);o.onerror=()=>res([])})}catch(e){return []}}
async function fotoPut(f){const db=await idbOpen();return new Promise((res,rej)=>{const t=db.transaction('f','readwrite');t.objectStore('f').put(f);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function fotoDelLocal(id){try{const db=await idbOpen();await new Promise(res=>{const t=db.transaction('f','readwrite');t.objectStore('f').delete(id);t.oncomplete=()=>res();t.onerror=()=>res()})}catch(e){}}
function colF(){return firebaseRoot().collection('devolucaoFotos')}
async function fotoUp(f){
  if(!fbOk())return false;
  try{await colF().doc(f.id).set({id:f.id,regId:f.regId,dataUrl:f.dataUrl,ts:f.ts});if(!f.up){f.up=true;await fotoPut(f)}return true}catch(e){console.warn('Foto não enviada:',e);return false}
}
async function reenviarFotos(){if(!fbOk())return;for(const f of await fotosTodas()){if(!f.up)await fotoUp(f)}}
function comprimir(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(fr.error);
    fr.onload=()=>{
      const im=new Image();
      im.onerror=()=>rej(new Error('imagem inválida'));
      im.onload=()=>{
        const M=1280,s=Math.min(1,M/Math.max(im.width,im.height)),w=Math.round(im.width*s),h=Math.round(im.height*s);
        const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
        res(c.toDataURL('image/jpeg',0.7));
      };
      im.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function prevFotos(){
  const el=$('dvFotoPrev');if(!el)return;
  el.innerHTML=pend.map((u,i)=>`<div class="th"><img src="${u}" alt="foto ${i+1}"><button type="button" title="Remover" onclick="devFotoPend(${i})">×</button></div>`).join('');
}
window.devFotoPend=function(i){pend.splice(i,1);prevFotos()};
async function contaFotos(regId){
  const n=(await fotosLocais(regId)).length;
  lista.forEach(r=>{if(r.regId===regId&&r.nFotos!==n){r.nFotos=n;r.ts=Date.now();pushOne(r)}});
  persist();if(built)renderAba();
  return n;
}
async function salvarFotos(regId,urls){
  for(let i=0;i<urls.length;i++){
    const f={id:regId+'_'+Date.now().toString(36)+i,regId,dataUrl:urls[i],ts:Date.now(),up:false};
    try{await fotoPut(f)}catch(e){alert('Não foi possível guardar a foto neste navegador.');continue}
    fotoUp(f);
  }
  await contaFotos(regId);
  try{showToast('Foto(s) da etiqueta salva(s).')}catch(e){}
}
async function apagarFotosReg(regId){
  for(const f of await fotosLocais(regId)){await fotoDelLocal(f.id);if(fbOk()){try{await colF().doc(f.id).delete()}catch(e){}}}
}
async function baixarFotosRemotas(regId){
  if(!fbOk())return;
  try{
    const snap=await colF().where('regId','==',regId).get();
    for(const d of snap.docs){const x=d.data();await fotoPut({id:d.id,regId:x.regId,dataUrl:x.dataUrl,ts:x.ts||0,up:true})}
  }catch(e){console.warn('Fotos remotas:',e)}
}
function fechaFotos(){const m=$('dvFotoModal');if(m)m.remove()}
async function abreFotos(regId,titulo){
  fechaFotos();
  const m=document.createElement('div');m.id='dvFotoModal';
  m.innerHTML='<div class="box"><div style="display:flex;justify-content:space-between;align-items:center"><b>📷 Fotos — '+esc(titulo)+'</b><button type="button" class="btn secondary" id="dvFotoX">Fechar</button></div><div class="gal" id="dvGal">Carregando…</div><label class="btn primary" style="display:inline-block">➕ Adicionar foto<input type="file" accept="image/*" multiple hidden id="dvFotoAdd"></label></div>';
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)fechaFotos()});
  $('dvFotoX').onclick=fechaFotos;
  const mostrar=async()=>{
    let fs=await fotosLocais(regId);
    if(!fs.length){await baixarFotosRemotas(regId);fs=await fotosLocais(regId)}
    fs.sort((a,b)=>(a.ts||0)-(b.ts||0));
    $('dvGal').innerHTML=fs.length?fs.map(f=>`<div class="th"><img src="${f.dataUrl}" data-id="${f.id}" alt="foto"><button type="button" class="btn danger" data-del="${f.id}">Excluir</button></div>`).join(''):'<div class="small">Nenhuma foto neste registro.</div>';
    $('dvGal').querySelectorAll('img').forEach(im=>im.onclick=()=>{const w=window.open('');if(w){w.document.write('<img src="'+im.src+'" style="max-width:100%">');}});
    $('dvGal').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Excluir esta foto?'))return;
      const id=b.dataset.del;await fotoDelLocal(id);if(fbOk()){try{await colF().doc(id).delete()}catch(e){}}
      await contaFotos(regId);mostrar();
    });
  };
  $('dvFotoAdd').addEventListener('change',async ev=>{
    const urls=[];for(const f of [...ev.target.files]){try{urls.push(await comprimir(f))}catch(e){}}
    ev.target.value='';
    if(urls.length){await salvarFotos(regId,urls);mostrar()}
  });
  mostrar();
}
window.devFotos=function(id){
  const r=lista.find(x=>x.id===id);if(!r)return;
  if(!r.regId){r.regId='R'+r.id;persist()}
  abreFotos(r.regId,(r.numFq?'registro '+r.numFq+' • ':'')+(r.cliente||''));
};

/* ---------- lista ---------- */
function dispCls(d){return d==='Reclamação não procede'?'no':(d==='Aguardando análise'?'':'ok')}
function tabela(){
  const q=String($('dvBusca')?.value||'').toLowerCase();
  const rows=lista.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q)).sort((a,b)=>String(b.data).localeCompare(String(a.data))||String(b.numFq||'').localeCompare(String(a.numFq||''))||(a.ts||0)-(b.ts||0));
  $('dvCount').textContent=rows.length.toLocaleString('pt-BR')+' de '+lista.length.toLocaleString('pt-BR')+' itens devolvidos';
  const mostra=rows.slice(0,300);
  $('dvTbody').innerHTML=mostra.map(r=>`<tr><td>${esc(tipoDe(r))}</td><td>${esc(r.numFq||'')}</td><td>${esc(brDate(r.data))}</td><td>${esc(r.cliente)}</td><td>${esc(r.codigo)}</td><td style="white-space:normal;min-width:160px">${esc(r.produto)}</td><td>${esc(r.nf||'')}</td><td>${fmt(r.qtd)}</td><td>${fmt(totalKg(r))}</td><td style="white-space:normal;min-width:120px">${esc(r.motivo||'')}</td><td>${esc(r.procede||'')}</td><td><span class="dev-disp ${dispCls(r.disp)}">${esc(r.disp||'')}</span></td><td><button class="btn secondary" type="button" onclick="devEdit('${r.id}')">Editar</button> <button class="btn secondary" type="button" onclick="devMaisItem('${r.id}')" title="Adicionar outro item a este registro">+ Item</button> <button class="btn secondary" type="button" onclick="devRegPdf('${r.id}')" title="PDF do registro (FQ051)">🖨 PDF</button> <button class="btn secondary" type="button" onclick="devFotos('${r.id}')" title="Fotos da etiqueta">📷${r.nFotos?' '+r.nFotos:''}</button> <button class="btn danger" type="button" onclick="devDel('${r.id}')">Excluir</button></td></tr>`).join('')
    ||'<tr><td colspan="12" class="small" style="text-align:center">Nenhuma devolução lançada.</td></tr>';
  if(rows.length>mostra.length)$('dvTbody').innerHTML+=`<tr><td colspan="12" class="small" style="text-align:center">Exibindo as 300 mais recentes. Use a busca para localizar as demais.</td></tr>`;
}
window.devBackup=function(){
  const dados=lista.map(limpo);
  const blob=new Blob([JSON.stringify({tipo:'devolucoes',versao:1,geradoEm:new Date().toISOString(),total:dados.length,devolucoes:dados,excluidas:[...tombs()]},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-devolucoes-'+hoje()+'.json';a.click();
  try{showToast('Backup de devoluções baixado ('+dados.length+' itens).')}catch(e){}
};
window.devRestaurar=function(inp){
  const f=inp&&inp.files&&inp.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const j=JSON.parse(rd.result),arr=Array.isArray(j)?j:j.devolucoes;
      if(!Array.isArray(arr)||(j.tipo&&j.tipo!=='devolucoes'))throw new Error('formato');
      const t=tombs();let novos=0,atual=0;
      arr.forEach(r=>{
        if(!r||!r.id)return;
        const x=lista.find(l=>l.id===r.id);
        if(!x){lista.push({...r});novos++;t.delete(r.id);pushOne(r)}
        else if((r.ts||0)>(x.ts||0)){lista[lista.indexOf(x)]={...r};atual++;pushOne(r)}
      });
      saveTombs(t);persist();
      if(built)renderAba();
      alert('Backup de devoluções restaurado: '+novos+' item(ns) novo(s) e '+atual+' atualizado(s). Nada foi apagado.');
    }catch(e){alert('Arquivo inválido. Use um backup de devoluções (.json) gerado pelo app.')}
    inp.value='';
  };
  rd.readAsText(f);
};
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
  const y=$('dvFa').value,m=$('dvFm').value,c=$('dvFc').value,p=$('dvFp').value||'proc';
  return lista.filter(r=>{const d=String(r.data||'');return (!y||d.slice(0,4)===y)&&(!m||String(Number(d.slice(5,7)))===m)&&(!c||r.cliente===c)&&(p==='todas'||(p==='nao')===naoProcede(r))});
}
function agrupa(rows,chave,med,limite){
  const o={};rows.forEach(r=>{const k=String(chave(r)||'').trim()||'Não informado';o[k]=(o[k]||0)+med(r)});
  return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,limite||10);
}
function cor(n,f){try{return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||f}catch(e){return f}}
function curto(t,n){t=String(t);return t.length>n?t.slice(0,n-1)+'…':t}
/* gráfico combinado: quantidade (eixo esq.) x peso (eixo dir.) */
function combo(id,labels,qtd,kg,linha,grupos,eix){
  eix=eix||{q:'Peças',k:'kg'};
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
  c.fillStyle=cq;c.textAlign='left';c.font='bold 11px sans-serif';c.fillText(eix.q,x0-40,y0-10);
  c.fillStyle=ck;c.textAlign='right';c.fillText(eix.k,x1+52,y0-10);c.font='11px sans-serif';
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
function comparativo(rows){
  let prod=new Map();try{prod=prodMonthTotals()}catch(e){}
  const y=$('dvFa').value,mf=$('dvFm').value;
  const pk=(yy,mm)=>{const a=prod.get(yy+'-'+mm),b=prod.get(yy+'-'+String(mm).padStart(2,'0')),c=prod.get(String(yy)+'-'+Number(mm));return num(a??b??c)};
  let per=[];
  if(y)for(let m=1;m<=12;m++)per.push([Number(y),m]);
  else{const s=new Set();rows.forEach(r=>{const d=String(r.data||'');if(d.length>=7)s.add(d.slice(0,4)+'-'+Number(d.slice(5,7)))});per=[...s].map(k=>k.split('-').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1])}
  if(mf)per=per.filter(p=>String(p[1])===mf);
  const lab=[],P=[],pc=[],gr=[],lin=[];
  per.forEach(([yy,mm])=>{
    const rs=rows.filter(r=>{const d=String(r.data||'');return d.slice(0,4)===String(yy)&&Number(d.slice(5,7))===mm});
    const pr=pk(yy,mm),kgD=rs.reduce((a,r)=>a+totalKg(r),0),qD=rs.reduce((a,r)=>a+num(r.qtd),0),qNp=rs.filter(naoProcede).reduce((a,r)=>a+num(r.qtd),0);
    if(!pr&&!rs.length)return;
    const p=pr?kgD/pr*100:0;
    lab.push(months[mm-1]+(y?'':'/'+String(yy).slice(2)));P.push(pr);pc.push(Math.round(p*100)/100);gr.push(rs);
    lin.push(`<tr><td>${months[mm-1]}/${yy}</td><td>${pr?fmt(pr):'—'}</td><td>${fmt(qD)}</td><td>${fmt(kgD)}</td><td>${pr?fmt(p)+'%':'—'}</td><td>${fmt(qNp)}</td></tr>`);
  });
  combo('dvCmp',lab,P,pc,true,gr,{q:'Produção (kg)',k:'% devol.'});
  const tb=$('dvCmpBody');if(tb)tb.innerHTML=lin.join('')||'<tr><td colspan="6" class="small" style="text-align:center">Sem dados no período.</td></tr>';
}
function painel(){
  if(!built)return;
  opcoes('dvFa','Todos os anos',[...new Set(lista.map(r=>String(r.data||'').slice(0,4)).filter(Boolean))].sort());
  opcoes('dvFc','Todos os clientes',[...new Set(lista.map(r=>r.cliente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  try{
    const y=$('dvFa').value,mf=$('dvFm').value,o={};
    lista.filter(r=>{const dt=String(r.data||'');return (!y||dt.slice(0,4)===y)&&(!mf||String(Number(dt.slice(5,7)))===mf)}).forEach(r=>{
      const c=r.cliente||'Não informado',e=o[c]||(o[c]={n:0,np:0,q:0,qnp:0});e.n++;e.q+=num(r.qtd);if(naoProcede(r)){e.np++;e.qnp+=num(r.qtd)}});
    const it=Object.entries(o).filter(x=>x[1].np>0).sort((a,b)=>b[1].qnp-a[1].qnp||b[1].np-a[1].np).slice(0,15);
    $('dvNpBody').innerHTML=it.map(([c,e])=>`<tr><td>${esc(c)}</td><td>${fmt(e.n)}</td><td>${fmt(e.np)}</td><td>${fmt(e.np/e.n*100)}%</td><td>${fmt(e.qnp)}</td><td>${fmt(e.q)}</td></tr>`).join('')||'<tr><td colspan="6" class="small" style="text-align:center">Nenhuma reclamação "não procede" no período.</td></tr>';
  }catch(e){console.warn(e)}
  const todas=filtrados();
  viewRaw=($('dvFp').value||'proc')!=='proc';
  TIPOS.forEach((t,i)=>{
    const ab=$('dvTab'+i);if(ab){ab.className='btn '+(i===tabPl?'primary':'secondary');ab.textContent=t.n+' ('+todas.filter(r=>tipoDe(r)===t.k).length+')'}
    $('dvSec'+i).style.display=i===tabPl?'block':'none';
    if(i!==tabPl)return;
    const rows=todas.filter(r=>tipoDe(r)===t.k);
    const tq=rows.reduce((a,r)=>a+num(r.qtd),0),tk=rows.reduce((a,r)=>a+totalKg(r),0);
    $('dvK'+i+'Reg').textContent=fmt(new Set(rows.map(r=>r.numFq?(r.data+'|'+r.numFq+'|'+r.cliente):r.id)).size);$('dvK'+i+'Qtd').textContent=fmt(tq);$('dvK'+i+'Kg').textContent=fmt(tk)+' kg';
    $('dvK'+i+'Rs').textContent=okCusto()?'R$ '+fmt(rows.reduce((a,r)=>a+valorR(r),0)):'🔒 Restrito';
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
    if(i===0)comparativo(rows);
    por('dvC'+i+'Cli',r=>r.cliente);por('dvC'+i+'Mot',r=>r.motivo);por('dvC'+i+'Pec',r=>r.produto||r.codigo);
  });
}
window.devRefresh=function(){if(built&&aba==='painel'&&$('devolucoes')?.classList.contains('active'))painel()};
window.devDados=function(){return lista.map(limpo)};
const semRaw=f=>function(){const s=viewRaw;viewRaw=false;try{return f.apply(null,arguments)}finally{viewRaw=s}};
window.devKg=semRaw(totalKg);window.devValor=semRaw(valorR);window.devTipo=tipoDe;
window.devLimparFiltros=function(){['dvFa','dvFm','dvFc'].forEach(id=>$(id).value='');$('dvFp').value='proc';painel()};
function pdfCanvasImg(orig,clone){
  const a=[...orig.querySelectorAll('canvas')],b=[...clone.querySelectorAll('canvas')];
  b.forEach((c,i)=>{try{const im=document.createElement('img');im.src=a[i].toDataURL('image/png');im.style.cssText='width:100%;max-height:300px;object-fit:contain';c.replaceWith(im)}catch(e){}});
  return clone;
}
window.devPdf=function(){
  const keep=tabPl,txt=id=>{const e=$(id);return e&&e.value?e.options[e.selectedIndex].text:''};
  const fl=[txt('dvFa'),txt('dvFm'),txt('dvFc'),txt('dvFp')].filter(Boolean).join(' · ');
  let corpo=pdfCab('↩ Relatório de devoluções',fl||'Todos os períodos');
  corpo+=pdfCanvasImg($('dvNpPanel'),$('dvNpPanel').cloneNode(true)).outerHTML;
  TIPOS.forEach((t,i)=>{
    tabPl=i;painel();
    const c=pdfCanvasImg($('dvSec'+i),$('dvSec'+i).cloneNode(true));c.style.display='block';c.style.pageBreakBefore='always';
    corpo+=c.outerHTML;
  });
  tabPl=keep;painel();
  pdfImprimir('Relatório de devoluções',corpo,true);
};
window.devRegPdf=function(id){
  const r0=lista.find(x=>x.id===id);if(!r0)return;
  const its=r0.regId?lista.filter(x=>x.regId===r0.regId):lista.filter(x=>x.numFq===r0.numFq&&x.data===r0.data&&x.cliente===r0.cliente);
  const c=(l,v,w)=>`<div${w?' class="w"':''}><b>${l}:</b> ${v==null||v===''?'—':esc(v)}</div>`;
  const tq=its.reduce((a,r)=>a+num(r.qtd),0),tk=its.reduce((a,r)=>a+(naoProcede(r)?0:(num(r.qtd)*num(r.pesoUn))),0);
  const corpo=pdfCab('Registro de devolução — FQ051 nº '+(r0.numFq||'s/nº'),tipoDe(r0)+' · '+r0.cliente)+
   '<div class="pdf-grid">'+c('Planta',tipoDe(r0))+c('Data',brDate(r0.data))+c('Cliente',r0.cliente)+c('Recebido por',r0.recebPor)+c('Origem',r0.origem)+c('NF de devolução',r0.nf)+c('S.A. nº',r0.sa)+c('Inspetor',r0.inspetor)+c('Vendas',r0.vendas)+'</div>'+
   '<h3 style="margin:12px 0 4px">Itens devolvidos</h3><table><thead><tr><th>Código</th><th>Peça</th><th>OF</th><th>Qtd.</th><th>Peso unit. (kg)</th><th>Peso total (kg)</th><th>Motivo</th><th>Procede?</th><th>Destino</th><th>Obs.</th></tr></thead><tbody>'+
   its.map(r=>`<tr><td>${esc(r.codigo)}</td><td>${esc(r.produto||'')}</td><td>${esc(r.of||'')}</td><td>${fmt(r.qtd)}</td><td>${fmt(r.pesoUn)}</td><td>${naoProcede(r)?'—':fmt((num(r.qtd)*num(r.pesoUn)))}</td><td>${esc(r.motivo||'')}</td><td>${esc(r.procede||'')}</td><td>${esc(r.disp||'')}</td><td>${esc(r.obs||'')}</td></tr>`).join('')+
   `<tr><th colspan="3">TOTAL</th><th>${fmt(tq)}</th><th></th><th>${fmt(tk)}</th><th colspan="4"></th></tr></tbody></table><div style="font-size:10px;color:#555;margin-top:4px">Itens "não procede" não entram no peso total.</div>`;
  pdfImprimir('Devolução '+(r0.numFq||''),corpo,false);
};
window.devTab=function(i){tabPl=i;painel()};

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

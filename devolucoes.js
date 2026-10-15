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
let lista=[];
try{lista=JSON.parse(localStorage.getItem(DKEY)||'[]');if(!Array.isArray(lista))lista=[]}catch(e){lista=[]}
let unsub=null,built=false,aba='lancar';
const $=id=>document.getElementById(id);
const num=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0};
const totalKg=r=>num(r.qtd)*num(r.pesoUn);
const hoje=()=>{const n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const brDate=iso=>String(iso||'').split('-').reverse().join('/');

/* ---------- estilo ---------- */
(function(){
  const st=document.createElement('style');
  st.textContent='.dev-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.dev-tab{border:1px solid var(--border);background:var(--card);color:var(--text);padding:9px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px}.dev-tab.on{background:var(--orange);color:#fff;border-color:var(--orange)}.dev-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.dev-filters label{font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}.dev-info{font-size:12px;color:var(--muted);margin:2px 0 10px}.dev-disp{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(255,90,24,.12);color:var(--orange);white-space:nowrap}.dev-disp.ok{background:#eaf7f1;color:#157348}.dev-disp.no{background:#eef2f6;color:#536273}';
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
    <div class="cad-section-head"><div><h3 id="dvTitulo">Nova devolução</h3><div class="small">Informe o código interno: cliente, descrição, planta e peso vêm do cadastro de produtos.</div></div></div>
    <div id="dvInfo" class="dev-info">Digite o código interno para localizar cliente, peça e peso.</div>
    <form id="dvForm">
      <input type="hidden" id="dvId">
      <div class="formgrid">
        <div class="field"><label>Data da devolução *</label><input id="dvData" type="date" required></div>
        <div class="field"><label>Código interno *</label><input id="dvCod" autocomplete="off" placeholder="Digite o código da peça" required></div>
        <div class="field"><label>Cliente *</label><select id="dvCli" required><option value="">Digite o código primeiro</option></select></div>
        <div class="field"><label>Descrição da peça</label><input id="dvProd" readonly placeholder="Preenchida pelo cadastro"></div>
        <div class="field"><label>Planta</label><input id="dvPlanta" readonly placeholder="Preenchida pelo cadastro"></div>
        <div class="field"><label>Nota fiscal de devolução</label><input id="dvNf" placeholder="Nº da NF (opcional)"></div>
        <div class="field"><label>OF</label><input id="dvOf" placeholder="Ex.: 440/26 (opcional)"></div>
        <div class="field"><label>Quantidade devolvida *</label><input id="dvQtd" type="number" step="1" min="0" required placeholder="Peças"></div>
        <div class="field"><label>Peso unitário (kg)</label><input id="dvPeso" type="number" step="0.001" min="0" placeholder="Cadastro da peça (editável)"></div>
        <div class="field"><label>Peso total (kg)</label><input id="dvTot" readonly placeholder="Quantidade × peso unitário"></div>
        <div class="field"><label>Motivo da devolução</label><input id="dvMot" list="dvMotList" placeholder="Ex.: porosidade, dimensional…"><datalist id="dvMotList"></datalist></div>
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
      <select id="dvMet"><option value="kg">Medir por peso (kg)</option><option value="q">Medir por quantidade</option></select>
      <button class="btn secondary" type="button" onclick="devLimparFiltros()">Limpar</button>
    </div>
    <div class="cards">
      <div class="card"><div class="kpi-accent"></div><div class="label">Devoluções</div><div class="value" id="dvKReg">0</div><div class="sub">lançamentos no filtro</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Peças devolvidas</div><div class="value" id="dvKQtd">0</div><div class="sub">quantidade total</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Peso devolvido</div><div class="value" id="dvKKg">0 kg</div><div class="sub">quantidade × peso unitário</div></div>
      <div class="card"><div class="kpi-accent"></div><div class="label">Aguardando análise</div><div class="value" id="dvKAb">0</div><div class="sub" id="dvKAbSub">devoluções sem destino definido</div></div>
    </div>
    <div class="grid">
      <div class="panel wide"><h3>Evolução mensal das devoluções</h3><div class="hint" id="dvHMes">Por mês, conforme a medida escolhida.</div><div class="chartbox"><canvas id="dvChMes"></canvas></div></div>
      <div class="panel"><h3>Por cliente</h3><div class="hint">Clientes que mais devolveram.</div><div class="chartbox"><canvas id="dvChCli"></canvas></div></div>
      <div class="panel"><h3>Por motivo</h3><div class="hint">Principais motivos de devolução.</div><div class="chartbox"><canvas id="dvChMot"></canvas></div></div>
      <div class="panel"><h3>Por peça</h3><div class="hint">Peças mais devolvidas.</div><div class="chartbox"><canvas id="dvChPec"></canvas></div></div>
      <div class="panel"><h3>Por destino</h3><div class="hint">O que foi feito com as peças devolvidas.</div><div class="chartbox"><canvas id="dvChDisp"></canvas></div></div>
    </div>
  </div>

  <div id="dvLista" class="panel" style="display:none">
    <h3>Devoluções lançadas</h3>
    <div class="toolbar"><input id="dvBusca" placeholder="Buscar cliente, código, peça, NF, OF, motivo…"><span id="dvCount" class="small"></span><button class="btn secondary" type="button" onclick="devCsv()">⬇ Exportar CSV</button></div>
    <div class="tablewrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Código</th><th>Peça</th><th>NF</th><th>Qtd.</th><th>Kg</th><th>Motivo</th><th>Destino</th><th>Ações</th></tr></thead><tbody id="dvTbody"></tbody></table></div>
  </div>`;

  $('dvForm').addEventListener('submit',salvar);
  $('dvCod').addEventListener('input',buscarPeca);
  $('dvCod').addEventListener('change',buscarPeca);
  $('dvCod').addEventListener('blur',buscarPeca);
  $('dvQtd').addEventListener('input',calcTot);
  $('dvPeso').addEventListener('input',calcTot);
  ['dvFa','dvFm','dvFc','dvMet'].forEach(id=>$(id).addEventListener('change',painel));
  $('dvBusca').addEventListener('input',tabela);
  $('dvData').value=hoje();
  built=true;
}

/* ---------- lançamento ---------- */
function pesoDe(p){
  const pos=v=>{const x=num(v);return x>0?x:0};
  const pl=normalizeText(p.planta);
  if(pl.indexOf('USINAGEM')===0&&pos(p.pesoUsinado))return pos(p.pesoUsinado);
  return pos(p.pesoFundUsin)||pos(p.pesoUsinado)||pos(p.pesoPrincipal)||0;
}
function setP(p){
  $('dvProd').value=p?(p.descricao||''):'';
  $('dvPlanta').value=p?(p.planta||''):'';
  $('dvPeso').value=p?(pesoDe(p)||''):'';
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
  const base=ms.find(x=>String(x.descricao||'').trim())||ms[0]||null;
  if(!base){
    sel.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
    setP(null);info.textContent='Código não encontrado no cadastro de produtos. Cadastre o produto ou confira o código.';return;
  }
  setP(base);
  const clientes=normalizeClientList(ms.map(x=>x.cliente).filter(Boolean));
  sel.innerHTML=clienteOptionsHtml(clientes.length?clientes:normalizeClientList(cadastros.clientes),'Selecione o cliente');
  if(atual&&[...sel.options].some(o=>o.value===atual))sel.value=atual;
  else if(clientes.length===1)sel.value=clientes[0];
  const pu=pesoDe(base);
  info.textContent='Código '+cod+' localizado'+(clientes.length>1?' para '+clientes.length+' clientes — selecione o cliente.':'.')+(pu?'':' Produto sem peso cadastrado: informe o peso unitário.');
}
function salvar(ev){
  ev.preventDefault();
  const g=id=>$(id).value.trim();
  const codigo=g('dvCod'),cliente=canonicalClientName(g('dvCli')),qtd=num(g('dvQtd')),data=g('dvData');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return alert('Informe a data da devolução.');
  if(!codigo)return alert('Informe o código interno da peça.');
  if(!cliente)return alert('Selecione o cliente.');
  if(!(qtd>0))return alert('Informe a quantidade devolvida.');
  const id=g('dvId')||('d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  const old=lista.find(x=>x.id===id);
  const r={id,data,codigo,cliente,produto:g('dvProd'),planta:g('dvPlanta'),nf:g('dvNf'),of:g('dvOf'),qtd,pesoUn:num(g('dvPeso')),motivo:g('dvMot'),disp:g('dvDisp')||DISP[0],obs:g('dvObs'),criado:old?old.criado:new Date().toISOString(),ts:Date.now()};
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
  buscarPeca();
  const sel=$('dvCli');
  if(![...sel.options].some(o=>o.value===r.cliente)){const o=document.createElement('option');o.value=r.cliente;o.textContent=r.cliente;sel.appendChild(o)}
  sel.value=r.cliente;
  $('dvProd').value=r.produto||'';$('dvPlanta').value=r.planta||'';
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
  $('dvTbody').innerHTML=mostra.map(r=>`<tr><td>${esc(brDate(r.data))}</td><td>${esc(r.cliente)}</td><td>${esc(r.codigo)}</td><td style="white-space:normal;min-width:160px">${esc(r.produto)}</td><td>${esc(r.nf||'')}</td><td>${fmt(r.qtd)}</td><td>${fmt(totalKg(r))}</td><td style="white-space:normal;min-width:120px">${esc(r.motivo||'')}</td><td><span class="dev-disp ${dispCls(r.disp)}">${esc(r.disp||'')}</span></td><td><button class="btn secondary" type="button" onclick="devEdit('${r.id}')">Editar</button> <button class="btn danger" type="button" onclick="devDel('${r.id}')">Excluir</button></td></tr>`).join('')
    ||'<tr><td colspan="10" class="small" style="text-align:center">Nenhuma devolução lançada.</td></tr>';
  if(rows.length>mostra.length)$('dvTbody').innerHTML+=`<tr><td colspan="10" class="small" style="text-align:center">Exibindo as 300 mais recentes. Use a busca para localizar as demais.</td></tr>`;
}
window.devCsv=function(){
  const h=['Data','Cliente','Código','Peça','Planta','NF','OF','Quantidade','Peso unitário (kg)','Peso total (kg)','Motivo','Destino','Observação'];
  const rows=[...lista].sort((a,b)=>String(b.data).localeCompare(String(a.data))).map(r=>[brDate(r.data),r.cliente,r.codigo,r.produto,r.planta,r.nf,r.of,r.qtd,r.pesoUn,totalKg(r),r.motivo,r.disp,r.obs]);
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
function painel(){
  if(!built)return;
  opcoes('dvFa','Todos os anos',[...new Set(lista.map(r=>String(r.data||'').slice(0,4)).filter(Boolean))].sort());
  opcoes('dvFc','Todos os clientes',[...new Set(lista.map(r=>r.cliente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  const rows=filtrados(),porQtd=$('dvMet').value==='q';
  const med=porQtd?(r=>num(r.qtd)):totalKg,un=porQtd?'un.':'kg';
  const tq=rows.reduce((a,r)=>a+num(r.qtd),0),tk=rows.reduce((a,r)=>a+totalKg(r),0);
  const ab=rows.filter(r=>(r.disp||DISP[0])===DISP[0]);
  $('dvKReg').textContent=fmt(rows.length);$('dvKQtd').textContent=fmt(tq);$('dvKKg').textContent=fmt(tk)+' kg';
  $('dvKAb').textContent=fmt(ab.length);
  $('dvKAbSub').textContent=ab.length?fmt(ab.reduce((a,r)=>a+num(r.qtd),0))+' peça(s) sem destino definido':'nenhuma pendente';
  const mes=Array(12).fill(0);
  rows.forEach(r=>{const m=Number(String(r.data||'').slice(5,7));if(m>=1&&m<=12)mes[m-1]+=med(r)});
  $('dvHMes').textContent=(porQtd?'Quantidade devolvida':'Peso devolvido (kg)')+' por mês'+($('dvFa').value?' em '+$('dvFa').value:' (todos os anos somados)')+'.';
  drawLine('dvChMes',months,[{values:mes,unit:un}]);
  const cli=agrupa(rows,r=>r.cliente,med,10);draw('dvChCli',cli.map(x=>x[0]),cli.map(x=>x[1]),true,un);
  const mot=agrupa(rows,r=>r.motivo,med,10);draw('dvChMot',mot.map(x=>x[0]),mot.map(x=>x[1]),true,un);
  const pec=agrupa(rows,r=>r.produto||r.codigo,med,10);draw('dvChPec',pec.map(x=>x[0]),pec.map(x=>x[1]),true,un);
  const dis=agrupa(rows,r=>r.disp||DISP[0],med,8);drawDonutQty('dvChDisp',dis.map(x=>x[0]),dis.map(x=>x[1]),un);
}
window.devLimparFiltros=function(){['dvFa','dvFm','dvFc'].forEach(id=>$(id).value='');$('dvMet').value='kg';painel()};

/* ---------- abas ---------- */
function renderAba(){
  if(aba==='painel')painel();
  else if(aba==='lista')tabela();
  else listaMotivos();
}
window.devAba=function(a){
  if(!built)return;
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

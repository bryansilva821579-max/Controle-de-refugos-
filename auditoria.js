/* =====================================================================
   AUDITORIA — histórico de alterações, lixeira (senha) e backup semanal
   Carregado depois de app.js e reuniao.js (ele "envolve" funções já existentes).
   ===================================================================== */
var AUD_KEY=KEY+'_audit',TRASH_KEY=KEY+'_lixeira',BK_KEY=KEY+'_backup_ultimo',BK_AUTO=KEY+'_backup_auto',USER_KEY='controle_refugos_2026_usuario',LIX_SESSION='refugos_lixeira_ok',LIX_HASH='ccdd11078688d58f0d6cf9ae88258df0a92782c626d93a37f320dc5d2b5654ed',REU_LS='controle_refugos_2026_reunioes';
var audMute=false,audSnap=null,cadSnap=null;

/* ---------- armazenamento ---------- */
function audLoad(){try{return JSON.parse(localStorage.getItem(AUD_KEY)||'[]')}catch(e){return[]}}
function audStore(a){a=a.slice(0,3000);try{localStorage.setItem(AUD_KEY,JSON.stringify(a))}catch(e){try{localStorage.setItem(AUD_KEY,JSON.stringify(a.slice(0,500)))}catch(x){}}}
function trLoad(){try{return JSON.parse(localStorage.getItem(TRASH_KEY)||'[]')}catch(e){return[]}}
function trStore(a){try{localStorage.setItem(TRASH_KEY,JSON.stringify(a.slice(0,500)))}catch(e){console.error('Lixeira: sem espaço',e)}}
function audUser(ask){var u=localStorage.getItem(USER_KEY)||'';if(!u&&ask&&!sessionStorage.getItem('aud_asked')){sessionStorage.setItem('aud_asked','1');u=(prompt('Digite seu nome para registrar no histórico de alterações:')||'').trim();if(u)localStorage.setItem(USER_KEY,u)}return u||'Não identificado'}
function audLog(tipo,acao,resumo,ref){var e={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),quem:audUser(true),tipo:tipo,acao:acao,resumo:String(resumo||'').slice(0,400),ref:ref||''},a=audLoad();a.unshift(e);audStore(a);
  try{if(typeof rtOnline==='function'&&rtOnline())firebaseRoot().collection('auditoria').doc(e.id).set(e).catch(function(){})}catch(x){}return e}
function trAdd(tipo,dados,resumo){var a=trLoad();a.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),quem:audUser(false),tipo:tipo,resumo:String(resumo||'').slice(0,300),dados:dados});trStore(a)}
(function(){var lim=Date.now()-180*864e5,a=trLoad(),b=a.filter(function(x){return x.ts>lim});if(b.length!==a.length)trStore(b)})();

/* ---------- diferenças ---------- */
function audDiffObj(o,n,ign){ign=ign||['FOTOS','ts','fa','fd'];var out=[];Object.keys(Object.assign({},o,n)).forEach(function(k){if(ign.indexOf(k)>=0)return;var a=o[k],b=n[k];if(JSON.stringify(a)!==JSON.stringify(b))out.push(k+': '+(a==null||a===''?'∅':a)+' → '+(b==null||b===''?'∅':b))});return out.slice(0,6).join('; ')}
function audRefRes(r){return [val(r,'codigo'),val(r,'produto'),'OF '+(val(r,'of')||'—'),(val(r,'quantidade')||0)+' pç',fmt(kg(r))+' kg'].join(' • ')}
function audSnapBuild(){audSnap=new Map();(Array.isArray(data)?data:[]).forEach(function(r){audSnap.set(r,JSON.stringify(r))})}
function audRefugoDiff(){
  if(audMute||(typeof firebasePulling!=='undefined'&&firebasePulling)){audSnapBuild();return}
  if(!audSnap){audSnapBuild();return}
  var cur=new Set(data),added=[],removed=[],edited=[];
  data.forEach(function(r){if(!audSnap.has(r))added.push(r);else{var j=JSON.stringify(r);if(j!==audSnap.get(r))edited.push([JSON.parse(audSnap.get(r)),r])}});
  audSnap.forEach(function(j,r){if(!cur.has(r))removed.push(JSON.parse(j))});
  if(added.length===1&&removed.length===1){edited.push([removed[0],added[0]]);added=[];removed=[]}
  var total=added.length+removed.length+edited.length;
  if(total>25){if(removed.length<=300)removed.forEach(function(o){trAdd('Refugo',o,audRefRes(o))});audLog('Refugo','Lote','Alteração em lote: +'+added.length+' criados, −'+removed.length+' excluídos, '+edited.length+' editados','')}
  else{edited.forEach(function(p){var d=audDiffObj(p[0],p[1]);audLog('Refugo','Editou',audRefRes(p[1])+' | '+(d||'fotos'),'')});added.forEach(function(r){audLog('Refugo','Criou',audRefRes(r),'')});removed.forEach(function(o){trAdd('Refugo',o,audRefRes(o));audLog('Refugo','Excluiu',audRefRes(o),'')})}
  audSnapBuild()}
(function(){var f=window.save;if(typeof f!=='function')return;window.save=function(){var r=f.apply(this,arguments);try{audRefugoDiff()}catch(e){console.error('auditoria',e)}return r};
  ['pullRemoteQuiet','downloadFromFirebase'].forEach(function(n){var g=window[n];if(typeof g!=='function')return;window[n]=async function(){var r=await g.apply(this,arguments);try{audSnapBuild()}catch(e){}return r}});
  try{audSnapBuild()}catch(e){}})();

/* ---------- retrabalhos ---------- */
function audRtRes(r){return [r.cod,r.prod,'OF '+(r.of||'—'),(r.qtd||0)+' pç',r.st].join(' • ')}
(function(){var f=window.rtPut;if(typeof f!=='function')return;window.rtPut=function(r){var before=null;try{before=rtRaw().find(function(x){return x.id===r.id})||null}catch(e){}var res=f.apply(this,arguments);
  try{if(!audMute){if(r.del){if(before&&!before.del){trAdd('Retrabalho',before,audRtRes(before));audLog('Retrabalho','Excluiu',audRtRes(before),r.id)}}
  else if(!before||before.del)audLog('Retrabalho',before?'Restaurou':'Criou',audRtRes(r),r.id);
  else{var d=audDiffObj(before,r);if(d||true)audLog('Retrabalho','Editou',audRtRes(r)+(d?' | '+d:''),r.id)}}}catch(e){console.error('auditoria',e)}return res}})();

/* ---------- atas ---------- */
function audAtaRes(m){return 'Ata '+(m.num||'s/nº')+' de '+anaBR(m.data)+' • '+((m.acoes||[]).length)+' ação(ões)'}
function audAtas(before){var B={},C={},cur=window.reunioes||[];before.forEach(function(j){var o=JSON.parse(j);B[o.id]=o});cur.forEach(function(m){C[m.id]=m});
  cur.forEach(function(m){if(!B[m.id])audLog('Ata','Criou',audAtaRes(m),m.id);else if(JSON.stringify(m)!==JSON.stringify(B[m.id]))audLog('Ata','Editou',audAtaRes(m),m.id)});
  Object.keys(B).forEach(function(id){if(!C[id]){trAdd('Ata',B[id],audAtaRes(B[id]));audLog('Ata','Excluiu',audAtaRes(B[id]),id)}})}
['reuSalvar','reuDel'].forEach(function(n){var f=window[n];if(typeof f!=='function')return;window[n]=function(){var before=(window.reunioes||[]).map(function(m){return JSON.stringify(m)}),res=f.apply(this,arguments);try{if(!audMute)audAtas(before)}catch(e){console.error('auditoria',e)}return res}});

/* ---------- cadastros e meta ---------- */
function cadSnapBuild(){try{cadSnap=JSON.parse(JSON.stringify(cadastros))}catch(e){}}
function cadDiffMsg(){if(!cadSnap)return'';var NM={pecas:'Produtos',motivos:'Motivos',clientes:'Clientes',responsaveis:'Responsáveis',participantes:'Participantes',materiais:'Materiais'},out=[];
  Object.keys(NM).forEach(function(k){var B=(cadSnap[k]||[]).map(function(x){return JSON.stringify(x)}),C=((cadastros&&cadastros[k])||[]).map(function(x){return JSON.stringify(x)}),sb=new Set(B),sc=new Set(C),ad=C.filter(function(x){return !sb.has(x)}).length,rm=B.filter(function(x){return !sc.has(x)}).length,ed=Math.min(ad,rm);ad-=ed;rm-=ed;
  if(ad||rm||ed)out.push(NM[k]+': '+(ad?'+'+ad+' ':'')+(rm?'−'+rm+' ':'')+(ed?'~'+ed+' alterados':''))});return out.join(' | ')}
(function(){var f=window.saveCad;try{cadSnapBuild()}catch(e){}if(typeof f==='function')window.saveCad=function(){var res=f.apply(this,arguments);try{var m=cadDiffMsg();if(m&&typeof cadastroAccessAllowed==='function'&&cadastroAccessAllowed())audLog('Cadastro','Editou',m,'');cadSnapBuild()}catch(e){console.error('auditoria',e)}return res};
  var g=window.saveMeta;if(typeof g==='function')window.saveMeta=function(){var b=JSON.stringify(meta),res=g.apply(this,arguments);try{if(JSON.stringify(meta)!==b)audLog('Meta','Editou','Meta % '+(JSON.parse(b).perc||'—')+' → '+meta.perc+' | Meta kg/mês '+(JSON.parse(b).kg||'—')+' → '+meta.kg,'')}catch(e){}return res}})();

/* ---------- lixeira: restaurar / excluir ---------- */
async function audSha(s){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
function trRestore(id){var a=trLoad(),it=a.find(function(x){return x.id===id});if(!it||!confirm('Restaurar este item ('+it.tipo+')?\n\n'+it.resumo+'\n\nObs.: fotos já apagadas não voltam.'))return;audMute=true;
  try{if(it.tipo==='Refugo'){data.push(it.dados);save();refresh()}
  else if(it.tipo==='Retrabalho'){rtPut(it.dados)}
  else if(it.tipo==='Ata'){window.reunioes=(window.reunioes||[]).concat([it.dados]);localStorage.setItem(REU_LS,JSON.stringify(window.reunioes));try{scheduleFirebasePush()}catch(e){}try{window.reuLists&&window.reuLists()}catch(e){}}
  audSnapBuild();trStore(a.filter(function(x){return x.id!==id}));audMute=false;audLog(it.tipo,'Restaurou',it.resumo,'')}catch(e){audMute=false;alert('Não foi possível restaurar: '+(e&&e.message||e))}lixRender();audRender()}
function trDelForever(id){if(!confirm('Excluir DEFINITIVAMENTE este item? Não poderá ser recuperado.'))return;trStore(trLoad().filter(function(x){return x.id!==id}));lixRender()}
function trEmpty(){if(!trLoad().length)return;if(!confirm('Esvaziar a lixeira? Todos os itens serão apagados de vez.'))return;trStore([]);audLog('Lixeira','Esvaziou','Lixeira esvaziada','');lixRender()}

/* ---------- backup ---------- */
function bkGather(){var g=function(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};return{app:'Controle de Perdas, Refugos e Retrabalhos',versao:window.APP_VERSION,geradoEm:new Date().toISOString(),usuario:audUser(false),
  data:g(KEY),cadastros:g(CADKEY),meta:g(KEY+'_meta'),producao:g(PROD_KEY),reunioes:g(REU_LS),retrabalhos:g(KEY+'_retrabalhos'),auditoria:audLoad().slice(0,1000),lixeira:trLoad()}}
function bkDownload(auto){var d=new Date(),nome='backup_refugos_'+anaFmtD(d)+(auto?'_semanal':'')+'.json',b=new Blob([JSON.stringify(bkGather())],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=nome;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000);localStorage.setItem(BK_KEY,String(Date.now()));
  audLog('Backup',auto?'Automático':'Manual','Arquivo '+nome,'');try{showToast('💾 Backup salvo: '+nome)}catch(e){}bkRender()}
function bkAutoCheck(){if(localStorage.getItem(BK_AUTO)==='0')return;if(document.documentElement.classList.contains('gate-on'))return;if(!(Array.isArray(data)&&data.length))return;if(Date.now()-Number(localStorage.getItem(BK_KEY)||0)<7*864e5)return;bkDownload(true)}
setTimeout(function(){bkAutoCheck();setInterval(bkAutoCheck,60000)},6000);
function bkRestore(inp){var f=inp.files&&inp.files[0];inp.value='';if(!f)return;var r=new FileReader();r.onload=function(){try{var b=JSON.parse(r.result);if(!b||!Array.isArray(b.data))throw new Error('arquivo de backup inválido');
  if(!confirm('RESTAURAR este backup ('+(b.geradoEm||'').slice(0,10)+')?\n\nOs dados atuais deste aparelho serão SUBSTITUÍDOS pelos do arquivo. Se o sistema estiver online, os outros computadores também podem receber esses dados.\n\nFaça um backup atual antes. Continuar?'))return;
  var s=function(k,v){if(v!=null)localStorage.setItem(k,JSON.stringify(v))};s(KEY,b.data);s(CADKEY,b.cadastros);s(KEY+'_meta',b.meta);s(PROD_KEY,b.producao);s(REU_LS,b.reunioes);s(KEY+'_retrabalhos',b.retrabalhos);audLog('Backup','Restaurou','Backup de '+(b.geradoEm||'').slice(0,10),'');alert('Backup restaurado. O sistema será recarregado.');location.reload()}catch(e){alert('Não foi possível ler o backup: '+(e&&e.message||e))}};r.readAsText(f)}

/* ---------- telas ---------- */
var AU_COR={Criou:'#16a34a',Editou:'#2563eb',Excluiu:'#dc2626',Restaurou:'#7c3aed'};
function auBd(a){return '<span class="rt-bd" style="background:'+(AU_COR[a]||'#64748b')+'">'+esc(a)+'</span>'}
function audTab(k){document.querySelectorAll('#auditoria .rt-tab').forEach(function(b){b.classList.toggle('on',b.dataset.au===k)});[['hist','auHist'],['lix','auLix'],['bk','auBk']].forEach(function(p){var e=document.getElementById(p[1]);if(e)e.style.display=p[0]===k?'':'none'});if(k==='hist')audRender();if(k==='lix')lixRender();if(k==='bk')bkRender()}
window.audInit=function(){audRender();var e=document.getElementById('auUser');if(e)e.textContent=audUser(false)};
function audRender(){var q=anaNorm((document.getElementById('auQ')||{}).value||''),tp=(document.getElementById('auTipo')||{}).value||'',a=audLoad().filter(function(x){return(!tp||x.tipo===tp)&&(!q||anaNorm([x.quem,x.tipo,x.acao,x.resumo].join(' ')).indexOf(q)>=0)});
  var e=document.getElementById('auUser');if(e)e.textContent=audUser(false);
  document.getElementById('auTbl').innerHTML='<table><thead><tr><th>Data / hora</th><th>Usuário</th><th>Tipo</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>'+(a.slice(0,300).map(function(x){return '<tr><td style="white-space:nowrap">'+new Date(x.ts).toLocaleString('pt-BR')+'</td><td>'+esc(x.quem)+'</td><td>'+esc(x.tipo)+'</td><td>'+auBd(x.acao)+'</td><td>'+esc(x.resumo)+'</td></tr>'}).join('')||'<tr><td colspan="5">Nenhuma alteração registrada ainda.</td></tr>')+'</tbody></table>'}
function audNome(){var u=(prompt('Seu nome para o histórico:',audUser(false)==='Não identificado'?'':audUser(false))||'').trim();if(u){localStorage.setItem(USER_KEY,u);audRender()}}
async function audPull(){if(!(typeof rtOnline==='function'&&rtOnline())){alert('Conecte o sistema online (Dados e backup) para buscar o histórico dos outros computadores.');return}
  try{var s=await firebaseRoot().collection('auditoria').orderBy('ts','desc').limit(500).get(),by={};audLoad().forEach(function(x){by[x.id]=x});s.docs.forEach(function(d){var x=d.data();if(x&&x.id)by[x.id]=x});audStore(Object.keys(by).map(function(k){return by[k]}).sort(function(a,b){return b.ts-a.ts}));audRender()}catch(e){alert('Não foi possível buscar: '+(e&&e.message||e))}}
async function lixUnlock(){var v=(document.getElementById('lixPw')||{}).value||'',m=document.getElementById('lixMsg');if(!(window.crypto&&crypto.subtle)){m.textContent='Abra o sistema por HTTPS.';return}
  if((await audSha('indi-lixeira|'+v))===LIX_HASH){sessionStorage.setItem(LIX_SESSION,'1');lixRender()}else{m.textContent='Senha incorreta.';document.getElementById('lixPw').value=''}}
function lixLock(){sessionStorage.removeItem(LIX_SESSION);lixRender()}
function lixRender(){var ok=sessionStorage.getItem(LIX_SESSION)==='1';document.getElementById('lixLock').style.display=ok?'none':'';document.getElementById('lixBox').style.display=ok?'':'none';if(!ok)return;
  var a=trLoad();document.getElementById('lixTbl').innerHTML='<table><thead><tr><th>Excluído em</th><th>Por</th><th>Tipo</th><th>Item</th><th></th></tr></thead><tbody>'+(a.map(function(x){return '<tr><td style="white-space:nowrap">'+new Date(x.ts).toLocaleString('pt-BR')+'</td><td>'+esc(x.quem)+'</td><td>'+esc(x.tipo)+'</td><td>'+esc(x.resumo)+'</td><td class="rt-act"><button onclick="trRestore(\''+x.id+'\')">♻ Restaurar</button><button onclick="trDelForever(\''+x.id+'\')">🗑 Apagar</button></td></tr>'}).join('')||'<tr><td colspan="5">A lixeira está vazia.</td></tr>')+'</tbody></table>'}
function bkRender(){var l=Number(localStorage.getItem(BK_KEY)||0),e=document.getElementById('bkInfo');if(!e)return;var d=l?Math.floor((Date.now()-l)/864e5):null;
  e.innerHTML=l?'Último backup: <b>'+new Date(l).toLocaleString('pt-BR')+'</b> ('+(d===0?'hoje':'há '+d+' dia(s)')+').':'<b>Nenhum backup feito neste aparelho ainda.</b>';var c=document.getElementById('bkAuto');if(c)c.checked=localStorage.getItem(BK_AUTO)!=='0'}
function bkToggle(c){localStorage.setItem(BK_AUTO,c.checked?'1':'0')}

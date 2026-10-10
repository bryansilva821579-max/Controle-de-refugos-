/* ==================================================================
   REUNIÃO E ATA
   Período, convites, ata FQ095, PDF e e-mail.
   ================================================================== */
(function(){
var rq=function(i){return document.getElementById(i)},PK='controle_refugos_2026_pw',LK='controle_refugos_2026_lock',RK='controle_refugos_2026_reunioes';
var DEF={cadastro:{s:'c97f18ac4519cdf7',h:'3330e2e4e92c3fc2530fb5230b8e105178ec3bf44e850d944245bb1db1c68690'},cost:{s:'28bb948b6e292d99',h:'ec1bd99025eda03b20c3847669ff731926177356c88f1e82fd04d20e2b7ae1f0'}},TTL=20*60000;
function pwCfg(){var o={};try{o=JSON.parse(localStorage.getItem(PK)||'{}')}catch(e){}return{cadastro:o.cadastro||DEF.cadastro,cost:o.cost||DEF.cost}}
async function pwHash(p,s){var e=new TextEncoder(),k=await crypto.subtle.importKey('raw',e.encode(p),'PBKDF2',false,['deriveBits']),b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:e.encode(s),iterations:150000},k,256);return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
function fresh(k){return Date.now()-Number(sessionStorage.getItem(k)||0)<TTL}
window.__cadOK=function(){var ok=!!cadastroUnlocked&&fresh('cr_u_cad');if(!ok)cadastroUnlocked=false;return ok};
window.__costOK=function(){var ok=!!costUnlocked&&fresh('cr_u_cost');if(!ok)costUnlocked=false;return ok};
window.__submitSec=async function(){var inp=rq('securityPassword'),senha=String(inp&&inp.value||''),L={};try{L=JSON.parse(localStorage.getItem(LK)||'{}')}catch(e){}
if(L.until>Date.now()){alert('Muitas tentativas. Aguarde '+Math.ceil((L.until-Date.now())/60000)+' min.');return}
if(!window.crypto||!crypto.subtle){alert('Este endereço não permite validar a senha com segurança. Abra o arquivo localmente ou por HTTPS.');return}
var mode=securityMode,c=pwCfg()[mode==='cadastro'?'cadastro':'cost'];
if(await pwHash(senha,c.s)!==c.h){var n=(L.n||0)+1;localStorage.setItem(LK,JSON.stringify(n>=5?{n:0,until:Date.now()+300000}:{n:n}));if(inp){inp.value='';inp.focus()}alert(n>=5?'Muitas tentativas. Bloqueado por 5 minutos.':'Senha incorreta.');return}
localStorage.removeItem(LK);var cb=securitySuccessCallback;
if(mode==='cadastro'){cadastroUnlocked=true;sessionStorage.setItem('cr_u_cad',Date.now())}
if(mode==='cost'){costUnlocked=true;sessionStorage.setItem('cr_u_cost',Date.now())}
closeSecurityModal();updateSecurityUI();if(mode==='cost')refreshSensitiveViews();if(typeof cb==='function')cb()};
window.alterarSenha=async function(t){t=t==='cadastro'?'cadastro':'cost';var cfg=pwCfg(),a=prompt('Senha atual:');if(a===null)return;
if(await pwHash(a,cfg[t].s)!==cfg[t].h){alert('Senha atual incorreta.');return}
var n=prompt('Nova senha (mínimo 8 caracteres):');if(n===null)return;if(n.length<8){alert('Mínimo 8 caracteres.');return}
if(prompt('Repita a nova senha:')!==n){alert('As senhas não conferem.');return}
var s=Array.from(crypto.getRandomValues(new Uint8Array(8))).map(function(x){return x.toString(16).padStart(2,'0')}).join('');
cfg[t]={s:s,h:await pwHash(n,s)};localStorage.setItem(PK,JSON.stringify(cfg));alert('Senha alterada neste navegador.')};

/* limpeza de lançamentos em branco (sem data e sem ano) */
window.__limpaVazios=function(){var a=data.length;data=data.filter(function(r){return r[cols.data]||(Number(r['ANO'])&&Number(r['ANO'])!==1900)});
if(data.length<a){save();try{scheduleFirebasePush()}catch(e){}}return a-data.length};

/* ---------- Reunião (v76) ---------- */
try{window.reunioes=JSON.parse(localStorage.getItem(RK)||'[]')}catch(e){window.reunioes=[]}try{salvarHistoricoFonte()}catch(e){}
var ac=[],cur=null,editId=null,PARTS0=['Ryan','Jambres','Gabriel','Antonio','Jose Raimundo','Josemario','Johnny','Christoffer','Fabio R.','Tiago B.','Thiago M.'];
function partList(){try{if(typeof cadastros!=='undefined'&&cadastros&&Array.isArray(cadastros.participantes)&&cadastros.participantes.length)return cadastros.participantes.map(function(x){return x.nome})}catch(e){}return PARTS0}
function rSave(){localStorage.setItem(RK,JSON.stringify(window.reunioes));salvarHistoricoFonte();try{scheduleFirebasePush()}catch(e){}}
function rd(r){var s=String(r[cols.data]||'').trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:s.slice(0,10)}
/* Filtro da Reunião: a partir de 08/10/2026 vale a DATA DO LANÇAMENTO; registros anteriores (ou sem data de lançamento válida) usam a DATA DO REFUGO */
var REU_CORTE='2026-10-08';
function rdLanc(r){var s=String(r[cols.dataLancamento]||'').trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:(/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'')}
function rdFiltro(r){var l=rdLanc(r);return(l&&l>=REU_CORTE)?l:rd(r)}
function rows(a,b,pl){return data.filter(function(r){var d=rdFiltro(r);return d>=a&&d<=b&&(!pl||String(pl).split('|').indexOf(plantNormName(plantaPeloMotivo(r)||r['PLANTA']))>=0)})}
function grp(R,f){var m={};R.forEach(function(r){var k=f(r)||'—',o=m[k]||(m[k]={k:k,kg:0,q:0,d:{}});o.kg+=kg(r);o.q+=qty(r);o.d[rd(r)]=1});return Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return b.kg-a.kg})}
var br=function(s){return String(s).split('-').reverse().join('/')},D=function(s){return new Date(s+'T00:00:00Z')},S=function(d){return d.toISOString().slice(0,10)};
var loc=function(x){return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
function tb(h,R){return '<div class="tablewrap"><table><thead><tr>'+h.map(function(x){return '<th>'+x+'</th>'}).join('')+'</tr></thead><tbody>'+(R.length?R.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+c+'</td>'}).join('')+'</tr>'}).join(''):'<tr><td colspan="'+h.length+'">Sem dados</td></tr>')+'</tbody></table></div>'}
function card(l,v,s){return '<div class="card"><div class="kpi-accent"></div><div class="label">'+l+'</div><div class="value">'+v+'</div><div class="sub">'+s+'</div></div>'}
function dv(a,b){if(!b)return 'sem base anterior';var d=(a-b)/b*100;return '<b style="color:'+(d>0?'#d92d20':'#12a150')+'">'+(d>0?'▲ ':'▼ ')+fmt(Math.abs(d))+'%</b> vs período anterior'}
function presOf(m){return Array.isArray(m.pres)?m.pres:String(m.part||'').split(',').map(function(x){return x.trim()}).filter(Boolean)}
function findM(id){return window.reunioes.filter(function(x){return x.id===id})[0]}
function snapHtml(s,extra){var h='<div class="cards">'+card('Refugo (kg)',fmt(s.k.kg),dv(s.k.kg,s.p.kg))+card('Quantidade',fmt(s.k.q),dv(s.k.q,s.p.q))+card('Lançamentos',fmt(s.k.n),dv(s.k.n,s.p.n))+(extra||'')+'</div>';
h+='<div class="reu-sub">Pareto de motivos</div>'+tb(['Motivo','Kg','Qtd.','% acum.'],s.par.map(function(x){return [esc(x[0]),fmt(x[1]),fmt(x[2]),fmt(x[3])+'%']}));
h+='<div class="reu-sub">Top 5 itens</div>'+tb(['Item','Kg','Qtd.'],s.it.map(function(x){return [esc(x[0]),fmt(x[1]),fmt(x[2])]}));
h+='<div class="reu-sub">Top 5 clientes</div>'+tb(['Cliente','Kg','Qtd.'],s.cl.map(function(x){return [esc(x[0]),fmt(x[1]),fmt(x[2])]}));
h+='<div class="reu-sub">Itens recorrentes (3+ datas diferentes)</div>'+tb(['Item','Dias com refugo','Kg'],s.rec.map(function(x){return [esc(x[0]),x[1],fmt(x[2])]}));
h+='<div class="reu-sub">Lançamentos mais pesados</div>'+tb(['Data','Item','OF','Kg','Motivo'],s.pes.map(function(x){return [br(x[0]),esc(x[1]),esc(x[2]),fmt(x[3]),esc(x[4])]}));return h}

/* Detalhamento: cliente, item, OF, quantidade, peso e motivo do período */
function detRows(a,b,pl){return rows(a,b,pl).map(function(r){return{d:rd(r),l:rdFiltro(r),c:String(r[cols.cliente]||'').trim().toUpperCase()||'—',i:String(r[cols.produto]||'').trim()||'—',of:String(r[cols.of]||'').trim()||'—',q:qty(r),k:kg(r),m:String(r['DESCRIÇÃO DO MOTIVO']||'').trim()||'—'}}).sort(function(x,y){return x.c.localeCompare(y.c,'pt-BR')||x.i.localeCompare(y.i,'pt-BR')||(x.d<y.d?-1:x.d>y.d?1:0)})}
function detHtml(a,b,pl,plain){var L=detRows(a,b,pl),tq=0,tk=0;
var body=L.map(function(x){tq+=x.q;tk+=x.k;return '<tr data-q="'+x.q+'" data-k="'+x.k+'"><td>'+br(x.d)+'</td><td>'+br(x.l)+'</td><td>'+esc(x.c)+'</td><td>'+esc(x.i)+'</td><td>'+esc(x.of)+'</td><td class="num">'+fmt(x.q)+'</td><td class="num">'+fmt(x.k)+'</td><td class="mot">'+esc(x.m)+'</td></tr>'}).join('');
return '<div class="reu-det"><div class="reu-sub">Detalhamento dos refugos do período ('+L.length+' lançamento(s))</div>'+(plain?'':'<input class="reu-in reu-busca" placeholder="Filtrar por cliente, item, OF ou motivo..." oninput="reuFiltra(this)">')+'<div class="tablewrap"><table><thead><tr><th>Data refugo</th><th>Lançamento</th><th>Cliente</th><th>Item</th><th>OF</th><th class="num">Qtd.</th><th class="num">Peso (kg)</th><th>Motivo</th></tr></thead><tbody>'+(body||'<tr><td colspan="8">Sem dados</td></tr>')+'</tbody><tfoot><tr><td colspan="5">Total</td><td class="num tq">'+fmt(tq)+'</td><td class="num tk">'+fmt(tk)+'</td><td></td></tr></tfoot></table></div></div>'}
window.reuFiltra=function(inp){var box=inp.closest('.reu-det'),t=inp.value.trim().toLowerCase(),q=0,k=0;box.querySelectorAll('tbody tr[data-q]').forEach(function(tr){var ok=!t||tr.textContent.toLowerCase().indexOf(t)>-1;tr.style.display=ok?'':'none';if(ok){q+=Number(tr.dataset.q);k+=Number(tr.dataset.k)}});box.querySelector('.tq').textContent=fmt(q);box.querySelector('.tk').textContent=fmt(k)};

window.reuPreset=function(t){var n=new Date(),y=n.getFullYear(),m=n.getMonth(),a,b=n;if(t==='sem'){a=new Date(n);a.setDate(n.getDate()-6)}else if(t==='mes'){a=new Date(y,m,1)}else{a=new Date(y,m-1,1);b=new Date(y,m,0)}
rq('reuA').value=loc(a);rq('reuB').value=loc(b);reuGerar()};
function showOut(s){var len=Math.round((D(s.b)-D(s.a))/864e5)+1,c=0;if(costAccessAllowed())c=rows(s.a,s.b,s.pl).reduce(function(x,r){return x+cost(r)},0);
rq('reuOut').innerHTML='<div class="hint" style="margin:8px 0">Período '+br(s.a)+' a '+br(s.b)+(s.pl?' • '+esc(plLbl(s.pl)):'')+' • filtrado pela data de lançamento (registros anteriores a 08/10/2026 usam a data do refugo) (comparado aos '+len+' dias anteriores)</div>'+snapHtml(s,card('Custo estimado',costAccessAllowed()?'R$ '+fmt(c):'🔒 Restrito','acesso restrito por senha'))+detHtml(s.a,s.b,s.pl)}
window.reuGerar=function(){var a=rq('reuA').value,b=rq('reuB').value,pl=msGet('reuPl').join('|');if(!a||!b||a>b){alert('Informe um período válido.');return}
var len=Math.round((D(b)-D(a))/864e5)+1,R=rows(a,b,pl),P=rows(S(new Date(D(a)-len*864e5)),S(new Date(D(a)-864e5)),pl);
var t=function(x){return{kg:x.reduce(function(s,r){return s+kg(r)},0),q:x.reduce(function(s,r){return s+qty(r)},0),n:x.length}},k=t(R),p=t(P),mot=grp(R,function(r){return String(r['DESCRIÇÃO DO MOTIVO']||'').trim()}),acc=0;
cur={a:a,b:b,pl:pl,k:k,p:p,
par:mot.slice(0,8).map(function(x){acc+=k.kg?x.kg/k.kg*100:0;return [x.k,x.kg,x.q,acc]}),
it:grp(R,function(r){return String(r[cols.produto]||'').trim()}).slice(0,5).map(function(x){return [x.k,x.kg,x.q]}),
cl:grp(R,function(r){return String(r.CLIENTE||'').trim().toUpperCase()}).slice(0,5).map(function(x){return [x.k,x.kg,x.q]}),
rec:grp(R,function(r){return String(r[cols.produto]||'').trim()}).filter(function(x){return Object.keys(x.d).length>=3}).slice(0,5).map(function(x){return [x.k,Object.keys(x.d).length,x.kg]}),
pes:R.slice().sort(function(x,y){return kg(y)-kg(x)}).slice(0,5).map(function(r){return [rd(r),String(r[cols.produto]||'').trim(),r[cols.of]||'',kg(r),String(r['DESCRIÇÃO DO MOTIVO']||'').trim()]})};
showOut(cur)};
window.reuPres=function(){var el=rq('reuOut');el.classList.add('reu-pres');(el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el)};
document.addEventListener('fullscreenchange',function(){if(!document.fullscreenElement)rq('reuOut').classList.remove('reu-pres')});

/* Participantes */
function buildChips(){var box=rq('reuPartBox'),nm=partList(),sig=nm.join('|');if(box.children.length&&box.dataset.sig===sig)return;var keep=[];box.querySelectorAll('input:checked').forEach(function(i){keep.push(i.value)});box.dataset.sig=sig;box.innerHTML=partList().map(function(n){return '<label class="reu-chip"><input type="checkbox" value="'+esc(n)+'" onchange="reuCount()"><span>'+esc(n)+'</span></label>'}).join('');box.querySelectorAll('input').forEach(function(i){i.checked=keep.indexOf(i.value)>-1});if(!rq('reuPartExtra').dataset.ev){rq('reuPartExtra').dataset.ev=1;rq('reuPartExtra').addEventListener('input',window.reuCount)}window.reuCount&&window.reuCount()}
function getPres(){var o=[];rq('reuPartBox').querySelectorAll('input:checked').forEach(function(i){o.push(i.value)});rq('reuPartExtra').value.split(',').forEach(function(x){x=x.trim();if(x&&o.indexOf(x)<0)o.push(x)});return o}
function setPres(L){rq('reuPartBox').querySelectorAll('input').forEach(function(i){i.checked=L.indexOf(i.value)>-1});rq('reuPartExtra').value=L.filter(function(x){return partList().indexOf(x)<0}).join(', ');window.reuCount()}
window.reuCount=function(){var n=getPres().length;rq('reuPartCount').textContent=n?n+' selecionado(s)':'Nenhum selecionado'};
window.reuMarcar=function(v){rq('reuPartBox').querySelectorAll('input').forEach(function(i){i.checked=v});window.reuCount()};

/* Ações */
function acRender(){rq('reuAc').innerHTML=ac.map(function(x,i){return '<tr><td><input class="reu-in" value="'+esc(x.acao)+'" oninput="reuUpd('+i+',\'acao\',this.value)"></td><td><input class="reu-in" value="'+esc(x.resp)+'" oninput="reuUpd('+i+',\'resp\',this.value)"></td><td><input class="reu-in" list="reuAlvoList" placeholder="motivo ou item" value="'+esc(x.alvo||'')+'" oninput="reuUpd('+i+',\'alvo\',this.value)"></td><td><input class="reu-in" type="date" value="'+x.prazo+'" onchange="reuUpd('+i+',\'prazo\',this.value)"></td><td><select class="reu-in" onchange="reuUpd('+i+',\'status\',this.value)">'+['Aberta','Em andamento','Concluída'].map(function(s){return '<option'+(s===x.status?' selected':'')+'>'+s+'</option>'}).join('')+'</select></td><td><button class="btn secondary" onclick="reuDelAc('+i+')">✕</button></td></tr>'}).join('')}
window.reuAddAc=function(){ac.push({acao:'',resp:'',alvo:'',prazo:'',status:'Aberta'});acRender()};
window.reuUpd=function(i,k,v){ac[i][k]=v};window.reuDelAc=function(i){ac.splice(i,1);acRender()};

/* Salvar / editar */
function editUI(on){rq('reuEditBanner').innerHTML=on?'<div class="reu-edit-banner">✎ Editando reunião de '+br(rq('reuData').value)+'. Salve para atualizar o registro.</div>':'';rq('reuCancelBtn').style.display=on?'':'none';rq('reuSalvarBtn').textContent=on?'💾 Atualizar reunião':'💾 Salvar reunião'}
function syncTop(){var t=rq('reuDataTop');if(t)t.value=rq('reuData').value}
function proxNum(){var yy=String(new Date().getFullYear()).slice(-2),mx=0;(window.reunioes||[]).forEach(function(m){var x=String(m.num||'').match(/^(\d+)\s*\/\s*(\d{2})$/);if(x&&x[2]===yy&&Number(x[1])>mx)mx=Number(x[1])});return mx?(mx+1)+'/'+yy:''}
function resetForm(){editId=null;ac=[];setPres([]);rq('reuAta').value='';if(rq('reuNum'))rq('reuNum').value=proxNum();rq('reuData').value=loc(new Date());syncTop();acRender();editUI(false)}
window.reuCancelEdit=function(){resetForm()};
window.reuSalvar=function(){if(!cur){alert('Gere o período primeiro.');return}
var pres=getPres();if(!pres.length){alert('Marque ao menos um participante.');return}
var rec={id:editId||Date.now(),num:(rq('reuNum').value||'').trim(),data:rq('reuData').value||loc(new Date()),pres:pres,part:pres.join(', '),ata:rq('reuAta').value,acoes:ac.filter(function(x){return x.acao.trim()}),snap:cur},ed=!!editId;
if(ed){var ix=window.reunioes.findIndex(function(x){return x.id===editId});if(ix>-1)window.reunioes[ix]=rec;else window.reunioes.unshift(rec)}else window.reunioes.unshift(rec);
rSave();resetForm();lists();alert(ed?'Reunião atualizada.':'Reunião salva.')};
function reuSenha(){var s=window.prompt('Digite a senha para alterar ou excluir esta ata:');if(s===null)return false;if(s!=='1966'){alert('Senha incorreta. A operação foi cancelada.');return false}return true}
window.reuEdit=function(id){if(!reuSenha())return;var m=findM(id);if(!m)return;editId=id;cur=m.snap;rq('reuData').value=m.data;rq('reuNum').value=m.num||'';syncTop();setPres(presOf(m));rq('reuAta').value=m.ata||'';ac=(m.acoes||[]).map(function(x){return Object.assign({},x)});acRender();
rq('reuA').value=m.snap.a;rq('reuB').value=m.snap.b;msSet('reuPl',String(m.snap.pl||'').split('|').filter(Boolean));showOut(m.snap);editUI(true);rq('reuPartBox').scrollIntoView({behavior:'smooth',block:'center'})};
window.reuClose=function(id,i){var m=findM(id);if(m){m.acoes[i].status='Concluída';rSave();lists()}};
window.reuDel=function(id){if(!reuSenha())return;if(!confirm('Excluir esta reunião? Esta ação não poderá ser desfeita.'))return;window.reunioes=window.reunioes.filter(function(x){return x.id!==id});if(editId===id)resetForm();rSave();lists()};

/* Ata / impressão */
function ataHtml(m,plain){var P=presOf(m);return '<p><b>Participantes ('+P.length+'):</b> '+(P.length?(plain?esc(P.join(', ')):P.map(function(x){return '<span class="reu-pill">'+esc(x)+'</span>'}).join('')):'—')+'</p><p><b>Decisões:</b> '+esc(m.ata||'—').replace(/\n/g,'<br>')+'</p>'+tb(['Ação','Responsável','Prazo','Status'],(m.acoes||[]).map(function(x){return [esc(x.acao),esc(x.resp),x.prazo?br(x.prazo):'—',x.status]}))}
window.reuPrint=function(id){var m=findM(id);if(!m)return;var w=window.open('','_blank');
var P=presOf(m),lg=(document.querySelector('.brand img')||{}).src||'';
var rowsP='';for(var k=0;k<P.length;k+=2){rowsP+='<tr class="pr"><td class="pn">'+esc(P[k])+'</td><td class="ps"></td><td class="pn">'+(P[k+1]?esc(P[k+1]):'')+'</td><td class="ps"></td></tr>'}
var cab='<table class="fq"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col style="width:35%"></colgroup>'
+'<tr><td rowspan="2" class="lg">'+(lg?'<img src="'+lg+'" alt="">':'')+'<div class="lgt">INDI</div></td><td colspan="2" class="tit">ATA DE REUNIÃO</td><td class="rv">PÁG. 01/<span id="pgTot">01</span> &nbsp;FQ095 rev01</td></tr>'
+'<tr><td class="nr">Nº'+esc(m.num||'____')+'</td><td class="dt"><b>DATA</b></td><td class="dv">'+br(m.data).slice(0,6)+br(m.data).slice(8)+'</td></tr>'
+'<tr><td class="lb">TEMA:</td><td colspan="3" class="vl">Reunião de Refugo</td></tr>'
+'<tr><td class="lb">LOCAL:</td><td colspan="3" class="vl">Sala de Engenharia Fundição</td></tr>'
+'<tr><td colspan="4" class="ph">PARTICIPANTES:</td></tr>'+rowsP+'</table>';
w.document.write('<html><head><meta charset="utf-8"><title>Ata '+br(m.data)+'</title><style>@page{margin:12mm}body{font-family:Arial;padding:0;color:#17212b;width:186mm}table{border-collapse:collapse;width:100%;margin-bottom:10px;font-size:12px}td,th{border:1px solid #ccc;padding:5px;text-align:left}.num{text-align:right}tfoot td{font-weight:bold;background:#f3f3f3}.reu-sub{font-weight:bold;margin:14px 0 4px}.cards{display:flex;gap:12px}.card{border:1px solid #ccc;padding:8px;flex:1}.kpi-accent{display:none}.value{font-size:22px;font-weight:700}'
+'table.fq{border:1.5px solid #222;margin-bottom:12px}table.fq td{border:1px solid #222;padding:6px 8px;font-size:13px}table.fq td.lg{text-align:center;vertical-align:middle;background:#f5f5f5}table.fq td.lg img{width:54px;height:54px;object-fit:cover;border-radius:6px;display:block;margin:0 auto 3px}.lgt{font-weight:900;font-size:15px;letter-spacing:.5px}table.fq td.tit{text-align:center;font-size:22px;font-weight:900;border-right:1px solid #222}table.fq td.rv{text-align:center;font-weight:700;font-size:13px}table.fq td.nr{font-size:17px;font-weight:700}table.fq td.dt{text-align:center}table.fq td.dv{text-align:center;font-size:14px}table.fq td.lb{font-weight:900;font-size:14px;background:#f5f5f5}table.fq td.ph{text-align:center;font-weight:900;font-size:14px;background:#f5f5f5}table.fq td.pn{font-size:13px}table.fq tr.pr td{height:30px}table.fq tr{break-inside:avoid}</style></head><body>'+cab+'<p style="font-size:13px;margin:0 0 8px"><b>Referente ao dia '+br(m.snap.a)+' A '+br(m.snap.b)+'</b>'+(m.snap.pl?' • '+esc(plLbl(m.snap.pl)):'')+'</p>'+'<p><b>Decisões:</b> '+esc(m.ata||'—').replace(/\n/g,'<br>')+'</p>'+tb(['Ação','Responsável','Prazo','Status'],(m.acoes||[]).map(function(x){return [esc(x.acao),esc(x.resp),x.prazo?br(x.prazo):'—',x.status]}))+snapHtml(m.snap)+detHtml(m.snap.a,m.snap.b,m.snap.pl,true)+'</body></html>');w.document.close();setTimeout(function(){try{var h=w.document.body.scrollHeight,n=Math.max(1,Math.ceil(h/1032)),el=w.document.getElementById('pgTot');if(el)el.textContent=('0'+n).slice(-2)}catch(e){}w.print()},350)};

/* Histórico */
window.reuLoadDet=function(el){if(!el.open)return;var s=el.querySelector('.reu-det-slot');if(!s||s.dataset.ok)return;var m=findM(Number(el.dataset.id));if(m){s.innerHTML=detHtml(m.snap.a,m.snap.b,m.snap.pl);s.dataset.ok=1}};
function fillFil(){var sel=rq('reuHistFil'),v=sel.value,ex=[];window.reunioes.forEach(function(m){presOf(m).forEach(function(n){if(partList().indexOf(n)<0&&ex.indexOf(n)<0)ex.push(n)})});
sel.innerHTML='<option value="">Todos</option>'+partList().concat(ex).map(function(n){return '<option value="'+esc(n)+'"'+(n===v?' selected':'')+'>'+esc(n)+'</option>'}).join('')}
function presenca(){var T=window.reunioes.length,ex=[],cnt={};window.reunioes.forEach(function(m){presOf(m).forEach(function(n){cnt[n]=(cnt[n]||0)+1;if(partList().indexOf(n)<0&&ex.indexOf(n)<0)ex.push(n)})});
return '<details><summary><b>Presença por participante</b> ('+T+' reunião(ões) registrada(s))</summary>'+tb(['Participante','Presenças','% das reuniões'],partList().concat(ex).map(function(n){var c=cnt[n]||0;return [esc(n),c,T?fmt(c/T*100)+'%':'—']}))+'</details>'}
function lists(){var op=[];window.reunioes.forEach(function(m){(m.acoes||[]).forEach(function(x,i){if(x.status!=='Concluída')op.push([esc(x.acao),esc(x.resp),x.prazo?br(x.prazo):'—',x.status,br(m.data),'<button class="btn secondary" onclick="reuClose('+m.id+','+i+')">Concluir</button>'])})});
rq('reuAbertas').innerHTML=tb(['Ação','Responsável','Prazo','Status','Reunião',''],op);
fillFil();rq('reuPresenca').innerHTML=presenca();
var fil=rq('reuHistFil').value,L=window.reunioes.slice().sort(function(x,y){return (y.data>x.data)-(y.data<x.data)||y.id-x.id});if(fil)L=L.filter(function(m){return presOf(m).indexOf(fil)>-1});
rq('reuHist').innerHTML=L.length?L.map(function(m){return '<details data-id="'+m.id+'" ontoggle="reuLoadDet(this)" style="margin-bottom:8px"><summary><b>'+br(m.data)+'</b> — período '+br(m.snap.a)+' a '+br(m.snap.b)+' • '+presOf(m).length+' participante(s) • '+(m.acoes||[]).length+' ação(ões)</summary>'+ataHtml(m)+snapHtml(m.snap)+'<div class="reu-det-slot"></div><div class="toolbar"><button class="btn secondary" onclick="reuEdit('+m.id+')">✎ Editar</button><button class="btn primary" onclick="reuPrint('+m.id+')">🖨 Imprimir ata</button><button class=\"btn secondary\" onclick=\"reuMail('+m.id+')\">✉ Enviar por e-mail</button><button class="btn secondary" onclick="reuDel('+m.id+')">Excluir</button></div></details>'}).join(''):'<div class="hint">'+(fil?'Nenhuma reunião com este participante.':'Nenhuma reunião salva ainda.')+'</div>'}
window.reuLists=lists;
window.__loadPdfLibs=function(){
if(window.__pdfP)return window.__pdfP;
function ld(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){no(new Error('não foi possível carregar a biblioteca de PDF'))};document.head.appendChild(s)})}
window.__pdfP=ld('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(function(){return ld('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}).catch(function(e){window.__pdfP=null;throw e});
return window.__pdfP};
function pdfTxt(s){return String(s==null?'':s).replace(/[\u2013\u2014]/g,'-').replace(/\u2022/g,'-').replace(/[^\x00-\xFF]/g,'')}
function buildAtaPdf(m){
var J=window.jspdf.jsPDF,doc=new J({unit:'mm',format:'a4'}),s=m.snap,P=presOf(m),X=12,W=186,y;
doc.setLineWidth(.3);doc.setDrawColor(30);doc.setTextColor(20);
function box(x,yy,w,h){doc.rect(x,yy,w,h)}
function ct(tx,x,yy,w,h,sz,b){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz);doc.text(pdfTxt(tx),x+w/2,yy+h/2,{align:'center',baseline:'middle'})}
function lt(tx,x,yy,w,h,sz,b){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz);doc.text(pdfTxt(tx),x+2,yy+h/2,{baseline:'middle'})}
box(X,12,28,26);box(X+28,12,100,14);box(X+128,12,58,14);box(X+28,26,100,12);box(X+128,26,26,12);box(X+154,26,32,12);
box(X,38,28,8);box(X+28,38,158,8);box(X,46,28,8);box(X+28,46,158,8);box(X,54,W,8);
try{var lg=(document.querySelector('.brand img')||{}).src;if(lg)doc.addImage(lg,'JPEG',X+6,14,16,16)}catch(e){}
ct('INDI',X,31,28,6,11,1);ct('ATA DE REUNIÃO',X+28,12,100,14,17,1);
lt('Nº '+(m.num||'____'),X+28,26,100,12,13,1);ct('DATA',X+128,26,26,12,10,1);
var dbr=br(m.data);ct(dbr.slice(0,6)+dbr.slice(8),X+154,26,32,12,11,0);
lt('TEMA:',X,38,28,8,10,1);lt('Reunião de Refugo',X+28,38,158,8,10,0);
lt('LOCAL:',X,46,28,8,10,1);lt('Sala de Engenharia Fundição',X+28,46,158,8,10,0);
ct('PARTICIPANTES:',X,54,W,8,10,1);
var pr=[];for(var k=0;k<P.length;k+=2)pr.push([pdfTxt(P[k]),'',pdfTxt(P[k+1]||''),'']);
if(!pr.length)pr.push(['','','','']);
doc.autoTable({startY:62,body:pr,theme:'grid',margin:{left:X,right:X},styles:{fontSize:10,cellPadding:2.2,minCellHeight:9,lineColor:[30,30,30],lineWidth:.3,textColor:20,valign:'middle'},columnStyles:{0:{cellWidth:46},1:{cellWidth:47},2:{cellWidth:46},3:{cellWidth:47}}});
y=doc.lastAutoTable.finalY+7;
function need(h){if(y+h>282){doc.addPage();y=14}}
function h2(tx){need(14);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(20);doc.text(pdfTxt(tx),X,y);y+=5}
function tbl(head,body,opt){if(!body.length)body=[[{content:'Sem dados',colSpan:head.length}]];doc.autoTable(Object.assign({startY:y,head:[head],body:body,margin:{left:X,right:X},theme:'grid',headStyles:{fillColor:[34,48,66],textColor:255,fontSize:8},styles:{fontSize:8,cellPadding:1.6,lineColor:[190,190,190],lineWidth:.2,textColor:20}},opt||{}));y=doc.lastAutoTable.finalY+6}
var R3={1:{halign:'right'},2:{halign:'right'}};
doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(pdfTxt('Referente ao dia '+br(s.a)+' A '+br(s.b)+(s.pl?' - '+plLbl(s.pl):'')),X,y);y+=7;
h2('Decisões');doc.setFont('helvetica','normal');doc.setFontSize(10);
doc.splitTextToSize(pdfTxt(m.ata||'-'),W).forEach(function(l){need(5);doc.text(l,X,y);y+=4.6});y+=3;
h2('Ações');tbl(['Ação','Responsável','Prazo','Status'],(m.acoes||[]).map(function(x){return [pdfTxt(x.acao),pdfTxt(x.resp),x.prazo?br(x.prazo):'-',pdfTxt(x.status)]}));
h2('Resumo do período');doc.setFont('helvetica','normal');doc.setFontSize(10);
[['Refugo (kg)',s.k.kg,s.p.kg],['Quantidade',s.k.q,s.p.q],['Lançamentos',s.k.n,s.p.n]].forEach(function(r){need(5);doc.text(pdfTxt(r[0]+': '+fmt(r[1])+'   (período anterior: '+fmt(r[2])+')'),X,y);y+=5});y+=2;
h2('Pareto de motivos');tbl(['Motivo','Kg','Qtd.','% acum.'],s.par.map(function(x){return [pdfTxt(x[0]),fmt(x[1]),fmt(x[2]),fmt(x[3])+'%']}),{columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}});
h2('Top 5 itens');tbl(['Item','Kg','Qtd.'],s.it.map(function(x){return [pdfTxt(x[0]),fmt(x[1]),fmt(x[2])]}),{columnStyles:R3});
h2('Top 5 clientes');tbl(['Cliente','Kg','Qtd.'],s.cl.map(function(x){return [pdfTxt(x[0]),fmt(x[1]),fmt(x[2])]}),{columnStyles:R3});
h2('Itens recorrentes (3+ datas diferentes)');tbl(['Item','Dias com refugo','Kg'],s.rec.map(function(x){return [pdfTxt(x[0]),x[1],fmt(x[2])]}),{columnStyles:R3});
h2('Lançamentos mais pesados');tbl(['Data','Item','OF','Kg','Motivo'],s.pes.map(function(x){return [br(x[0]),pdfTxt(x[1]),pdfTxt(x[2]),fmt(x[3]),pdfTxt(x[4])]}),{columnStyles:{3:{halign:'right'}}});
var D=detRows(s.a,s.b,s.pl),tq=0,tk=0;D.forEach(function(x){tq+=x.q;tk+=x.k});
h2('Detalhamento dos refugos do período ('+D.length+' lançamento(s))');
doc.autoTable({startY:y,head:[['Data refugo','Lançamento','Cliente','Item','OF','Qtd.','Peso (kg)','Motivo']],body:D.map(function(x){return [br(x.d),br(x.l),pdfTxt(x.c),pdfTxt(x.i),pdfTxt(x.of),fmt(x.q),fmt(x.k),pdfTxt(x.m)]}),foot:[[{content:'Total',colSpan:5},fmt(tq),fmt(tk),'']],showFoot:'lastPage',margin:{left:X,right:X},theme:'grid',headStyles:{fillColor:[34,48,66],textColor:255,fontSize:7},footStyles:{fillColor:[235,238,242],textColor:20,fontStyle:'bold',fontSize:7},styles:{fontSize:7,cellPadding:1.3,lineColor:[190,190,190],lineWidth:.2,textColor:20},columnStyles:{5:{halign:'right'},6:{halign:'right'}}});
var N=doc.getNumberOfPages();
for(var i=1;i<=N;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(110);doc.text('FQ095 rev01 - Pág. '+i+'/'+N,198,291,{align:'right'})}
doc.setPage(1);doc.setTextColor(20);ct('PÁG. 01/'+('0'+N).slice(-2)+'   FQ095 rev01',X+128,12,58,14,10,1);
return doc.output('blob')}
window.reuMail=async function(id){var m=findM(id);if(!m)return;var pres=presOf(m),mp={};((typeof cadastros!=='undefined'&&cadastros.participantes)||[]).forEach(function(p){if(p.email)mp[p.nome.toUpperCase()]=p.email});
var to=pres.map(function(n){return mp[n.toUpperCase()]}).filter(Boolean);
var subj='Ata de reunião de refugos — '+br(m.data);
var body='ATA DE REUNIÃO DE REFUGOS — '+br(m.data)+'\nPeríodo analisado: '+br(m.snap.a)+' a '+br(m.snap.b)+'\n\nParticipantes: '+pres.join(', ')+'\n\nDecisões:\n'+(m.ata||'—')+'\n\nAções:\n'+((m.acoes||[]).map(function(x){return '- '+x.acao+' | Resp.: '+x.resp+' | Prazo: '+(x.prazo?br(x.prazo):'—')+' | '+x.status}).join('\n')||'—')+'\n\nO PDF da ata (FQ095) com os itens tratados segue em anexo.';
var fname='Ata_FQ095_'+(m.num?String(m.num).replace(/[\/\\]/g,'-')+'_':'')+m.data+'.pdf',blob;
try{await window.__loadPdfLibs();blob=buildAtaPdf(m)}catch(e){console.error(e);alert('Não foi possível gerar o PDF ('+(e&&e.message||e)+'). Verifique a internet e tente novamente.');return}
var file=new File([blob],fname,{type:'application/pdf'});
if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:subj,text:body+(to.length?'\n\nDestinatários: '+to.join(', '):'')});return}catch(e){if(e&&e.name==='AbortError')return}}
var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000);
alert('O PDF "'+fname+'" foi baixado. Anexe esse arquivo no e-mail que vai abrir agora.');
location.href='mailto:'+to.join(',')+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body)};
window.reuniaoInit=function(){try{window.__loadPdfLibs().catch(function(){})}catch(e){}try{anaInitReu()}catch(e){console.error(e)}var pl=rq('reuPl');if(pl.options.length<2){var ps={};data.forEach(function(r){var p=plantNormName(plantaPeloMotivo(r)||r['PLANTA']);if(p)ps[p]=1});Object.keys(ps).sort().forEach(function(p){pl.add(new Option(p,p))})}
buildChips();if(!rq('reuData').value)rq('reuData').value=loc(new Date());syncTop();if(!rq('reuDataTop').dataset.ev){rq('reuDataTop').dataset.ev=1;rq('reuDataTop').addEventListener('change',function(){if(rq('reuDataTop').value){rq('reuData').value=rq('reuDataTop').value;if(editId)editUI(true)}});rq('reuData').addEventListener('change',syncTop)}window.reuCount();
if(!rq('reuA').value)reuPreset('ant');else reuGerar();acRender();lists()};
refresh();
})();

/* ===== Marcar reunião / convite ===== */
function agPartic(){return ((typeof cadastros!=='undefined'&&cadastros&&cadastros.participantes)||[])}
function agBuild(){
  const box=document.getElementById('reuAgBox');if(!box)return;
  const L=agPartic(),sig=L.map(x=>x.nome+'|'+x.email).join(';');
  if(box.dataset.sig===sig&&box.children.length)return;
  const keep0=[...box.querySelectorAll('input:checked')].map(i=>i.value),keep=keep0.length?keep0:agSavedSel();
  box.dataset.sig=sig;
  box.innerHTML=L.map(x=>x.email?`<label class="reu-chip"><input type="checkbox" value="${esc(x.email)}" data-nome="${esc(x.nome)}" ${keep.includes(x.email)?'checked':''} onchange="agCount()"> ${esc(x.nome)}</label>`:`<label class="reu-chip" style="opacity:.5" title="Cadastre o e-mail em Cadastro > Participantes"><input type="checkbox" disabled> ${esc(x.nome)} (sem e-mail)</label>`).join('')||'<span class="small">Nenhum participante cadastrado. Cadastre em Cadastro > Participantes.</span>';
  agCount();
  const d=document.getElementById('reuAgData');if(d&&!d.value){const t=new Date();t.setDate(t.getDate()+1);d.value=new Date(t.getTime()-t.getTimezoneOffset()*60000).toISOString().slice(0,10)}
}
function agMarcar(on){document.querySelectorAll('#reuAgBox input:not(:disabled)').forEach(i=>{i.checked=!!on});agCount()}
function agSavedSel(){try{return JSON.parse(localStorage.getItem('reuAgSel')||'[]')}catch(e){return[]}}
function agCount(){const sel=[...document.querySelectorAll('#reuAgBox input:checked')].map(i=>i.value);try{localStorage.setItem('reuAgSel',JSON.stringify(sel))}catch(e){}const n=sel.length;const e=document.getElementById('reuAgCount');if(e)e.textContent=n+' convidado(s)'}
function agDados(){
  const data=document.getElementById('reuAgData').value,hora=document.getElementById('reuAgHora').value||'09:00',dur=Math.max(15,parseInt(document.getElementById('reuAgDur').value)||60);
  if(!data){alert('Informe a data da reunião.');return null}
  const conv=[...document.querySelectorAll('#reuAgBox input:checked')].map(i=>({email:i.value,nome:i.dataset.nome||i.value}));
  if(!conv.length){alert('Marque pelo menos um convidado (que tenha e-mail cadastrado).');return null}
  const local=document.getElementById('reuAgLocal').value.trim(),pauta=document.getElementById('reuAgPauta').value.trim();
  const ini=new Date(data+'T'+hora+':00'),fim=new Date(ini.getTime()+dur*60000);
  const dataBr=data.split('-').reverse().join('/'),dia=ini.toLocaleDateString('pt-BR',{weekday:'long'});
  return {data,hora,dur,conv,local,pauta,ini,fim,dataBr,dia,titulo:'Reunião de Refugos — '+dataBr};
}
function agTexto(d){return 'Olá,\n\nVocê está convidado(a) para a reunião de análise de refugos.\n\nData: '+d.dataBr+' ('+d.dia+')\nHorário: '+d.hora+' (duração prevista: '+d.dur+' min)\n'+(d.local?'Local/Link: '+d.local+'\n':'')+(d.pauta?'\nPauta:\n'+d.pauta+'\n':'')+'\nAtenciosamente.'}
function agEnviar(){
  const d=agDados();if(!d)return;
  const url='mailto:'+d.conv.map(c=>c.email).join(',')+'?subject='+encodeURIComponent(d.titulo)+'&body='+encodeURIComponent(agTexto(d));
  if(url.length>1900&&!confirm('A lista de convidados é grande e o e-mail pode não abrir corretamente. Continuar mesmo assim?'))return;
  location.href=url;
}
function agFmt(dt){const z=n=>String(n).padStart(2,'0');return dt.getFullYear()+z(dt.getMonth()+1)+z(dt.getDate())+'T'+z(dt.getHours())+z(dt.getMinutes())+'00'}
function agICS(){
  const d=agDados();if(!d)return;
  const esc=t=>String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Controle de Refugos//PT-BR','METHOD:REQUEST','BEGIN:VEVENT','UID:refugos-'+Date.now()+'@controle-de-refugos','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z','DTSTART:'+agFmt(d.ini),'DTEND:'+agFmt(d.fim),'SUMMARY:'+esc(d.titulo)];
  if(d.local)L.push('LOCATION:'+esc(d.local));
  L.push('DESCRIPTION:'+esc((d.pauta?'Pauta:\n'+d.pauta:'Reunião de análise de refugos')));
  d.conv.forEach(c=>L.push('ATTENDEE;CN='+esc(c.nome)+';RSVP=TRUE:mailto:'+c.email));
  L.push('END:VEVENT','END:VCALENDAR');
  const blob=new Blob([L.join('\r\n')],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='reuniao-refugos-'+d.data+'.ics';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  if(typeof showToast==='function')showToast('Convite .ics baixado. Anexe ao e-mail ou abra para adicionar à agenda.');
}
function agGoogle(){
  const d=agDados();if(!d)return;
  const u='https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(d.titulo)+'&dates='+agFmt(d.ini)+'/'+agFmt(d.fim)+'&details='+encodeURIComponent(d.pauta||'Reunião de análise de refugos')+(d.local?'&location='+encodeURIComponent(d.local):'')+'&add='+encodeURIComponent(d.conv.map(c=>c.email).join(','));
  window.open(u,'_blank');
}
(function(){const o=window.reuniaoInit;window.reuniaoInit=function(){if(o)o.apply(this,arguments);try{agBuild()}catch(e){console.warn(e)}}})();

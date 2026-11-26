window.__V=window.__V||{};window.__V.extras='v218';
/* Extras: painel "Hoje", barra inferior no celular, tema automático e estados vazios. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var fm=function(v,d){return(Number(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:d==null?0:d})};
function css(){if($('extrasCss'))return;var s=document.createElement('style');s.id='extrasCss';s.textContent=
'#hoje .hj-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;margin:4px 0 14px}#hoje .hj-h h2{margin:0;font-size:22px}#hoje .hj-h span{color:var(--muted,#667085);font-size:13px}'+
'.hj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:16px}'+
'.hj-k{background:var(--card,#fff);border:1px solid var(--border,#e4e7ec);border-radius:14px;padding:14px 16px;position:relative;overflow:hidden;animation:hjIn .5s cubic-bezier(.2,.7,.2,1) both}.hj-k:nth-child(2){animation-delay:.06s}.hj-k:nth-child(3){animation-delay:.12s}.hj-k:nth-child(4){animation-delay:.18s}'+
'.hj-k small{display:block;color:var(--muted,#667085);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.hj-k b{display:block;font-size:28px;margin:4px 0 2px;line-height:1.1}.hj-k i{font-style:normal;font-size:12px;color:var(--muted,#667085)}'+
'.hj-k.ok{border-left:5px solid #16a34a}.hj-k.bad{border-left:5px solid #dc2626}.hj-k.warn{border-left:5px solid #f59e0b}.hj-k.none{border-left:5px solid #98a2b3}'+
'.hj-bar{height:6px;border-radius:4px;background:rgba(128,140,160,.22);margin-top:8px;overflow:hidden}.hj-bar u{display:block;height:100%;border-radius:4px;background:#16a34a;transition:width .8s ease}.hj-k.bad .hj-bar u{background:#dc2626}'+
'.hj-box{background:var(--card,#fff);border:1px solid var(--border,#e4e7ec);border-radius:14px;padding:14px 16px;margin-bottom:14px}.hj-box h3{margin:0 0 8px;font-size:15px}.hj-box ul{margin:0;padding-left:18px}.hj-box li{margin:4px 0;font-size:14px}'+
'.hj-at{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.hj-at button{border:1px solid var(--border,#e4e7ec);background:var(--card,#fff);color:var(--text,#101828);border-radius:12px;padding:14px 10px;font-weight:800;font-size:14px;cursor:pointer}'+
'@keyframes hjIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'+
'.vazio{text-align:center;padding:34px 16px;color:var(--muted,#667085)}.vazio .vz-i{font-size:42px;display:block;margin-bottom:6px;animation:vzFloat 3s ease-in-out infinite}.vazio b{display:block;color:var(--text,#101828);font-size:16px;margin-bottom:4px}@keyframes vzFloat{50%{transform:translateY(-6px)}}'+
'#extraBN{display:none}'+
'@media (max-width:820px){#extraBN{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9980;background:var(--card,#fff);border-top:1px solid var(--border,#e4e7ec);box-shadow:0 -4px 16px rgba(0,0,0,.12);padding:4px 4px calc(4px + env(safe-area-inset-bottom))}#extraBN button{flex:1;border:0;background:none;color:var(--muted,#667085);font-size:11px;font-weight:700;padding:6px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;border-radius:10px}#extraBN button span{font-size:20px;line-height:1}#extraBN button.on{color:#ff6a1f;background:rgba(255,106,31,.12)}body{padding-bottom:68px}}'+
'@media print{#extraBN{display:none!important}}'+
'#appUndo{position:fixed;left:50%;bottom:90px;transform:translate(-50%,20px);background:#1f2937;color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:14px;align-items:center;font:600 14px system-ui,Arial;box-shadow:0 10px 28px rgba(0,0,0,.35);z-index:99998;opacity:0;pointer-events:none;transition:opacity .25s,transform .3s}#appUndo.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}#appUndo button{background:none;border:0;color:#ffb27a;font-weight:800;font-size:14px;cursor:pointer;text-transform:uppercase}';
document.head.appendChild(s)}

/* ---------- dados ---------- */
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function lerRt(){try{if(typeof rtLoad==='function')return rtLoad();return(JSON.parse(localStorage.getItem(KEY+'_retrabalhos')||'[]')||[]).filter(function(r){return r&&!r.del})}catch(e){return[]}}
function lerDev(){try{var a=typeof window.devDados==='function'?window.devDados():JSON.parse(localStorage.getItem('controle_refugos_2026_devolucoes_v1')||'[]');return(a||[]).filter(function(r){return r&&r.data})}catch(e){return[]}}
function hojeDados(){
  var now=new Date(),t0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),t1=t0+864e5,m0=new Date(now.getFullYear(),now.getMonth(),1).getTime(),m1=new Date(now.getFullYear(),now.getMonth()+1,1).getTime();
  var hoje=[],mes=[],ult=0;
  (typeof data!=='undefined'?data:[]).forEach(function(r){var t=0;try{t=historyDateMs(r)}catch(e){}if(!t)return;if(t>=t0&&t<t1)hoje.push(r);if(t>=m0&&t<m1)mes.push(r);if(t<t1&&t>ult)ult=t});
  var kgH=0,qH=0;hoje.forEach(function(r){kgH+=kg(r);qH+=qty(r)});
  var kgF=0;mes.forEach(function(r){if(recordPlant(r)==='FUNDICAO')kgF+=kg(r)});
  var ym=ymd(now).slice(0,7),prod=0;try{prod=prodMonthTotals().get(ym)||0}catch(e){}
  var perc=prod?kgF/prod*100:null,metaP=(typeof meta!=='undefined'&&meta&&meta.perc)?Number(meta.perc):0;
  var rts=lerRt().filter(function(r){return r.st!=='Retrabalho concluído'}),limite=ymd(new Date(now.getTime()-7*864e5));
  var parados=rts.filter(function(r){return r.dt&&r.dt<=limite});
  var dm=lerDev().filter(function(r){return String(r.data).slice(0,7)===ym});
  return{hoje:hoje.length,kgH:kgH,qH:qH,ult:ult,perc:perc,metaP:metaP,kgF:kgF,prod:prod,rtPend:rts.length,rtPar:parados.length,devN:dm.length,devQ:dm.reduce(function(a,r){return a+(+r.qtd||0)},0)};
}
function critSubindo(){
  var now=Date.now(),a0=now-30*864e5,b0=now-60*864e5,A={},B={},nm={};
  (typeof data!=='undefined'?data:[]).forEach(function(r){var t=0;try{t=historyDateMs(r)}catch(e){}if(!t||t<b0)return;var c=String(val(r,'codigo')||'').trim();if(!c)return;nm[c]=String(val(r,'produto')||'');var k=kg(r);if(t>=a0)A[c]=(A[c]||0)+k;else B[c]=(B[c]||0)+k});
  var best=null;Object.keys(A).forEach(function(c){var a=A[c],b=B[c]||0;if(a>=50&&a>b*1.5){var g=a-b;if(!best||g>best.g)best={c:c,a:a,b:b,g:g}}});
  return best?best.c+(nm[best.c]?' — '+nm[best.c]:'')+': '+fm(best.a)+' kg nos últimos 30 dias contra '+fm(best.b)+' kg nos 30 dias anteriores.':''
}
function hojeRender(){
  var root=$('hoje');if(!root)return;var D=hojeDados(),now=new Date();
  var dias=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'],h=now.getHours(),sd=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  var k1=D.hoje?'<div class="hj-k '+(D.kgH>0?'warn':'ok')+'"><small>Refugo hoje</small><b>'+fm(D.kgH)+' kg</b><i>'+fm(D.qH)+' peças em '+D.hoje+' lançamento'+(D.hoje>1?'s':'')+'</i></div>':'<div class="hj-k ok"><small>Refugo hoje</small><b>Sem lançamentos</b><i>'+(D.ult?'último lançamento em '+new Date(D.ult).toLocaleDateString('pt-BR'):'nenhum registro ainda')+'</i></div>';
  var st=D.perc==null?'none':!D.metaP?'none':D.perc<=D.metaP?'ok':'bad',r=D.metaP&&D.perc!=null?D.perc/D.metaP*100:0;
  var k2='<div class="hj-k '+st+'"><small>% refugo no mês (Fundição)</small><b>'+(D.perc==null?'—':fm(D.perc,2)+'%')+'</b><i>'+(D.metaP?'meta '+fm(D.metaP,2)+'% • '+(D.perc==null?'sem produção lançada':D.perc<=D.metaP?'dentro da meta':'acima da meta'):'defina a meta em Cadastro › Metas')+'</i>'+(D.metaP&&D.perc!=null?'<div class="hj-bar"><u style="width:'+Math.min(100,r)+'%"></u></div>':'')+'</div>';
  var k3='<div class="hj-k '+(D.rtPar?'bad':D.rtPend?'warn':'ok')+'"><small>Retrabalhos pendentes</small><b>'+D.rtPend+'</b><i>'+(D.rtPar?D.rtPar+' parado'+(D.rtPar>1?'s':'')+' há mais de 7 dias':D.rtPend?'nenhum parado há mais de 7 dias':'tudo em dia')+'</i></div>';
  var k4='<div class="hj-k '+(D.devN?'warn':'ok')+'"><small>Devoluções no mês</small><b>'+D.devN+'</b><i>'+(D.devN?fm(D.devQ)+' peças':'nenhuma devolução')+'</i></div>';
  var al=[];try{['refugo','devol','retrab','forno'].forEach(function(d){var t={refugo:'Refugos',devol:'Devoluções',retrab:'Retrabalhos',forno:'Forno e produção'}[d];(window.asstDestaques?window.asstDestaques(d):[]).forEach(function(x){al.push('<li><b>'+t+':</b> '+esc(x)+'</li>')})})}catch(e){}
  /* alertas automáticos: meta %, lançamento faltando, ações vencidas, metas por cliente/peça, peça crítica subindo */
  try{
    if(D.metaP&&D.perc!=null&&D.perc>D.metaP)al.unshift('<li><b>Meta:</b> o % de refugo da Fundição no mês ('+fm(D.perc,2)+'%) está acima da meta ('+fm(D.metaP,2)+'%).</li>');
    var dw=now.getDay(),hh=now.getHours();
    if(dw>=1&&dw<=5&&hh>=14&&!D.hoje)al.push('<li><b>Lançamento:</b> ainda não há refugo lançado hoje. Se não houve refugo, ignore; senão, lance antes de fechar o dia.</li>');
    var ontem=new Date(now.getTime()-864e5),yo=ontem.getDay();
    if(typeof producaoFundicao!=='undefined'&&Array.isArray(producaoFundicao)&&producaoFundicao.length&&yo>=1&&yo<=5){var yk=ymd(ontem);if(!producaoFundicao.some(function(p){return p&&p.data===yk}))al.push('<li><b>Produção:</b> não há produção lançada em '+ontem.toLocaleDateString('pt-BR')+'.</li>')}
    (window.__acVencidas?window.__acVencidas():[]).slice(0,5).forEach(function(x){al.push('<li><b>Ação vencida:</b> '+esc(x)+'</li>')});
    (window.__mfAlertas?window.__mfAlertas():[]).slice(0,5).forEach(function(x){al.push('<li><b>Meta:</b> '+esc(x)+'</li>')});
    var cr=critSubindo();if(cr)al.push('<li><b>Peça crítica subindo:</b> '+esc(cr)+'</li>');
  }catch(e){console.error(e)}
  root.innerHTML='<div class="hj-h"><h2>'+sd+'! 👋</h2><span>'+dias[now.getDay()]+', '+now.toLocaleDateString('pt-BR')+'</span></div><div class="hj-grid">'+k1+k2+k3+k4+'</div>'+
  '<div class="hj-box"><h3>⚠ Pontos de atenção</h3>'+(al.length?'<ul>'+al.join('')+'</ul>':'<div class="vazio" style="padding:14px"><span class="vz-i">✅</span><b>Nada fora do normal</b>Sem alertas no momento.</div>')+'</div>'+
  '<div class="hj-box"><h3>Atalhos</h3><div class="hj-at"><button onclick="navigate(\'lancamentos\')">＋<br>Lançar refugo</button><button onclick="navigate(\'lancamentos\');setTimeout(function(){switchLaunchTab(\'producao\')},60)">🏭<br>Produção</button><button onclick="navigate(\'retrabalho\')">🔧<br>Retrabalhos</button><button onclick="navigate(\'devolucoes\')">↩<br>Devoluções</button><button onclick="navigate(\'reuniao\')">👥<br>Reunião</button><button onclick="window.asstAbrir&&window.asstAbrir()">🤖<br>Assistente</button></div></div>';
}

/* ---------- aba Hoje + barra inferior ---------- */
function montarHoje(){
  if(!$('hoje')){var sec=document.createElement('section');sec.id='hoje';sec.className='page';var ref=$('dashboard');ref.parentNode.insertBefore(sec,ref)}
  document.querySelectorAll('.sidebar .tab[data-page="dashboard"],.mobile-nav .tab[data-page="dashboard"]').forEach(function(b){
    if(b.parentNode.querySelector('.tab[data-page="hoje"]'))return;var n=document.createElement('button');n.className='tab';n.setAttribute('data-page','hoje');n.innerHTML='🏠 &nbsp; Hoje';n.addEventListener('click',function(){navigate('hoje');try{closeMobileMenu()}catch(e){}});b.parentNode.insertBefore(n,b)});
}
function barra(){
  if($('extraBN'))return;var b=document.createElement('nav');b.id='extraBN';b.setAttribute('aria-label','Atalhos');
  b.innerHTML='<button data-p="hoje"><span>🏠</span>Hoje</button><button data-p="lancamentos"><span>＋</span>Lançar</button><button data-p="dashboard"><span>▣</span>Painel</button><button data-p="retrabalho"><span>🔧</span>Retrabalho</button><button data-m="1"><span>☰</span>Menu</button>';
  b.addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;if(t.dataset.m){try{openMobileMenu()}catch(x){}return}navigate(t.dataset.p)});
  document.body.appendChild(b);
}
function marcar(){var id=(document.querySelector('.page.active')||{}).id,bn=$('extraBN');if(!bn)return;bn.querySelectorAll('button[data-p]').forEach(function(x){x.classList.toggle('on',x.dataset.p===id)})}

/* ---------- tema automático ---------- */
var TK='controle_refugos_2026_theme';
function temaAuto(){
  var mq=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');if(!mq)return;
  var aplica=function(){var t=null;try{t=localStorage.getItem(TK)}catch(e){}if(t)return;var d=mq.matches?'dark':'light';if(document.documentElement.getAttribute('data-theme')!==d){document.documentElement.setAttribute('data-theme',d);try{applyThemeAuto(d)}catch(e){}}};
  var applyThemeAuto=function(d){try{var bt=$('themeToggle');if(bt)bt.innerHTML=d==='dark'?'☀️ <span>Modo claro</span>':'🌙 <span>Modo escuro</span>';dashboardDirty=true;dashboardQtdDirty=true;var a=(document.querySelector('.page.active')||{}).id;if(a==='dashboard')dashboard();else if(a==='dashboardQtd')dashboardQtd()}catch(e){}};
  aplica();if(mq.addEventListener)mq.addEventListener('change',aplica);
  var tg=$('themeToggle');if(tg&&!$('themeAuto')){var a=document.createElement('button');a.id='themeAuto';a.type='button';a.className=tg.className;a.innerHTML='🌓 <span>Tema automático</span>';a.title='Seguir o tema do aparelho';a.onclick=function(){try{localStorage.removeItem(TK)}catch(e){}aplica();try{showToast('Tema automático ligado')}catch(e){}};tg.parentNode.insertBefore(a,tg.nextSibling)}
}

/* ---------- estados vazios ---------- */
function vazioHist(){var tb=$('tbody');if(!tb)return;var trs=tb.querySelectorAll('tr');if(trs.length>1||(trs.length===1&&!/Nenhum lan/i.test(trs[0].textContent||'')))return;var f=false;try{f=(typeof data!=='undefined'&&data.length>0)}catch(e){}
  tb.innerHTML='<tr><td colspan="16"><div class="vazio"><span class="vz-i">'+(f?'🔍':'📭')+'</span><b>'+(f?'Nada encontrado com esses filtros':'Nenhum lançamento ainda')+'</b>'+(f?'Limpe a busca ou os filtros para ver os registros.':'Use o botão ＋ Lançamentos para registrar o primeiro refugo.')+'</div></td></tr>'}

/* ---------- ganchos ---------- */
function ganchos(){
  var nav=window.navigate;if(typeof nav==='function'&&!nav.__ex){var w=function(p){var r=nav.apply(this,arguments);if(p==='hoje'){try{hojeRender()}catch(e){console.error(e)}}setTimeout(marcar,0);return r};w.__ex=1;window.navigate=w;try{navigate=w}catch(e){}}
  var rt=window.renderTable;if(typeof rt==='function'&&!rt.__ex){var w2=function(){var r=rt.apply(this,arguments);try{vazioHist()}catch(e){}return r};w2.__ex=1;window.renderTable=w2;try{renderTable=w2}catch(e){}}
}
function init(){css();montarHoje();barra();ganchos();temaAuto();marcar();window.hojeRender=hojeRender;try{vazioHist()}catch(e){}
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&(document.querySelector('.page.active')||{}).id==='hoje')hojeRender()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

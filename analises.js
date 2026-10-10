/* ==================================================================
   ANÁLISES
   Resumo automático, Pareto/concentração e acompanhamento das ações da ata.
   ================================================================== */
/* ===== Análises v101: resumo automático, ações e custo ===== */
function anaFmtD(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function anaToday(){return anaFmtD(new Date())}
function anaAdd(iso,k){var x=new Date(iso+'T00:00:00');x.setDate(x.getDate()+k);return anaFmtD(x)}
function anaDays(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5)}
function anaBR(iso){var m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:(iso||'—')}
function anaISO(r){var s=String(val(r,'data')||'').trim(),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:(/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'')}
function anaNorm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim()}
function anaMatch(r,al){al=anaNorm(al);if(!al)return false;return anaNorm(motivoDescricao(r)).indexOf(al)>=0||anaNorm(val(r,'produto')).indexOf(al)>=0||anaNorm(val(r,'codigo'))===al||anaNorm(val(r,'motivo'))===al}
function anaBd(tx,cl){var c={ok:'#16a34a',bad:'#dc2626',mid:'#d97706',none:'#64748b'}[cl]||'#64748b';return '<span style="background:'+c+';color:#fff;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap">'+esc(tx)+'</span>'}
function anaEf(m,x){var al=String(x.alvo||'').trim();if(!al)return null;var pz=x.prazo||m.data,td=anaToday(),dd=anaDays(pz,td);
if(dd<0)return{t:'prazo ainda não venceu',cl:'none'};var L=Math.min(30,dd);if(L<7)return{t:'aguardando dados ('+dd+' d após o prazo)',cl:'none'};
var a0=anaAdd(pz,-L),a1=anaAdd(pz,-1),b1=anaAdd(pz,L-1),sa=0,sb=0;
data.forEach(function(r){if(!anaMatch(r,al))return;var d=anaISO(r);if(d>=a0&&d<=a1)sa+=kg(r);else if(d>=pz&&d<=b1)sb+=kg(r)});
if(!sa&&!sb)return{t:'sem refugo antes e depois',cl:'ok'};if(!sa)return{t:'sem refugo antes; depois: '+fmt(sb)+' kg',cl:'bad'};
var dl=(sb-sa)/sa*100;return{t:(dl<=0?'▼ ':'▲ +')+fmt(Math.abs(dl))+'% ('+fmt(sa)+' → '+fmt(sb)+' kg em '+L+' d)',cl:dl<=-10?'ok':dl>=10?'bad':'mid'}}
function anaAcoes(){var td=anaToday(),out=[];(window.reunioes||[]).forEach(function(m){(m.acoes||[]).forEach(function(x){if(!String(x.acao||'').trim())return;var c=x.status==='Concluída',pz=x.prazo||'',ov=!c&&!!pz&&pz<td,dd=pz?anaDays(td,pz):null;out.push({m:m,x:x,c:c,ov:ov,dd:dd,soon:!c&&!!pz&&!ov&&dd<=7,ef:anaEf(m,x)})})});return out}
function anaDatalist(){var d=document.getElementById('reuAlvoList');if(!d){d=document.createElement('datalist');d.id='reuAlvoList';document.body.appendChild(d)}var s={};((typeof cadastros!=='undefined'&&cadastros.motivos)||[]).forEach(function(m){if(m.descricao)s[m.descricao]=1});d.innerHTML=Object.keys(s).sort().map(function(k){return '<option value="'+esc(k)+'">'}).join('')}
function anaRenderAcoes(){var el=document.getElementById('anaAcoesBox');if(!el)return;anaDatalist();var A=anaAcoes();
A.sort(function(a,b){return (b.ov-a.ov)||(a.c-b.c)||String(a.x.prazo||'9').localeCompare(String(b.x.prazo||'9'))});
var nv=A.filter(function(a){return a.ov}).length,ns=A.filter(function(a){return a.soon}).length,na=A.filter(function(a){return !a.c}).length;
var rows=A.slice(0,40).map(function(a){var st=a.c?anaBd('✔ Concluída','ok'):a.ov?anaBd('Vencida há '+(-a.dd)+' d','bad'):a.soon?anaBd('Vence em '+a.dd+' d','mid'):anaBd(a.x.prazo?'No prazo':'Sem prazo','none');
return '<tr><td>'+esc(a.m.num||'')+'<br><span class="hint">'+anaBR(a.m.data)+'</span></td><td>'+esc(a.x.acao)+'</td><td>'+esc(a.x.resp||'')+'</td><td>'+esc(a.x.alvo||'—')+'</td><td>'+anaBR(a.x.prazo)+'</td><td>'+st+'</td><td>'+(a.ef?anaBd(a.ef.t,a.ef.cl):'<span class="hint">defina o alvo na ata</span>')+'</td></tr>'}).join('');
el.innerHTML='<h3>Acompanhamento das ações</h3><div class="hint" style="margin-bottom:8px">'+na+' em aberto • <b style="color:#dc2626">'+nv+' vencida(s)</b> • '+ns+' vencendo em até 7 dias. O resultado compara o refugo do <b>alvo</b> (motivo ou item) nos dias antes e depois do prazo.</div><div class="tablewrap"><table><thead><tr><th>Ata</th><th>Ação</th><th>Resp.</th><th>Alvo</th><th>Prazo</th><th>Situação</th><th>Resultado</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Nenhuma ação registrada nas atas.</td></tr>')+'</tbody></table></div>'}
function anaInitReu(){anaRenderAcoes();var h=document.getElementById('reuHist');if(h&&!h.__ana){h.__ana=1;new MutationObserver(function(){clearTimeout(window.__anaT);window.__anaT=setTimeout(anaRenderAcoes,150)}).observe(h,{childList:true,subtree:true})}}
function anaRenderResumo(mode){var q=mode==='q',mv=q?qty:kg,uu=q?' un':' kg',el=document.getElementById(q?'anaResumoQ':'anaResumo');if(!el)return;
var PL=plSel(q?'qFilterPlant':'filterPlant'),pRaw=PL.join(' + '),pn=pRaw;
var R=data.filter(function(r){return plHas(PL,recordPlant(r))}),td=anaToday(),ym=td.slice(0,7),by={};
R.forEach(function(r){var k=anaISO(r).slice(0,7);if(k)(by[k]=by[k]||[]).push(r)});
var ks=Object.keys(by).sort();if(!ks.length){el.innerHTML='';return}
var ref=by[ym]?ym:(ks.filter(function(k){return k<ym}).pop()||ks[ks.length-1]),pi=ks.filter(function(k){return k<ref}).pop();
var cur=by[ref],prv=pi?by[pi]:[],sum=function(a){return a.reduce(function(s,r){return s+mv(r)},0)},ck=sum(cur),pk=sum(prv);
var yy=+ref.slice(0,4),mm=+ref.slice(5,7),dim=new Date(yy,mm,0).getDate(),part=ref===ym,ed=part?+td.slice(8,10):dim,f=part?dim/ed:1,proj=ck*f;
function gm(a){var m={};a.forEach(function(r){var k=motivoDescricao(r)||'—';m[k]=(m[k]||0)+mv(r)});return m}
var gc=gm(cur),gp=gm(prv),best=null,top=null;
Object.keys(gc).forEach(function(k){var d=gc[k]*f-(gp[k]||0);if(!best||d>best.d)best={k:k,d:d};if(!top||gc[k]>gc[top])top=k});
var L=[];L.push('<b>'+fmt(ck)+uu+'</b> refugados'+(part?' até agora — projeção de fechamento: <b>'+fmt(proj)+uu+'</b>':'')+'.');
if(pk){var dl=(proj-pk)/pk*100;L.push('Em relação a '+months[+pi.slice(5,7)-1]+'/'+pi.slice(0,4)+' ('+fmt(pk)+uu+'): <b style="color:'+(dl>0?'#dc2626':'#16a34a')+'">'+(dl>0?'▲ +':'▼ ')+fmt(Math.abs(dl))+'%</b>'+(part?' (pela projeção)':'')+'.')}
if(top)L.push('Principal motivo: <b>'+esc(top)+'</b> ('+fmt(gc[top])+uu+').'+(pk&&best&&best.d>0?' Maior alta: <b>'+esc(best.k)+'</b> (+'+fmt(best.d)+uu+').':''));
var col=pk?(proj>pk?'#d97706':'#16a34a'):'#4f46e5';
if(!q&&meta.kg>0){var ok=proj<=meta.kg;col=ok?'#16a34a':'#dc2626';L.push(ok?'✔ Projeção dentro da meta de '+fmt(meta.kg)+' kg/mês ('+fmt(proj/meta.kg*100)+'% do limite).':'▲ Projeção acima da meta de '+fmt(meta.kg)+' kg/mês em <b>'+fmt(proj-meta.kg)+' kg</b>.')}
var A=anaAcoes(),nv=A.filter(function(a){return a.ov}).length;
if(nv)L.push('<a href="#" onclick="navigate(\'reuniao\');return false" style="color:#dc2626;font-weight:700">⚠ '+nv+' ação(ões) vencida(s) — ver acompanhamento</a>');
el.innerHTML='<div class="panel wide" style="margin-bottom:16px;border-left:6px solid '+col+'"><h3>📌 Resumo de '+months[mm-1]+'/'+yy+(part?' (dia '+ed+' de '+dim+')':'')+(q?' — quantidade':' — peso')+(pn?' — '+esc(pRaw):'')+'</h3>'+L.map(function(x){return '<div style="margin:5px 0;line-height:1.45">'+x+'</div>'}).join('')+'</div>'}
function anaRenderCusto(rows,mode){var q=mode==='q',el=document.getElementById(q?'anaCustoQ':'anaCusto');if(!el)return;var ok=!q&&costAccessAllowed(),fn=q?qty:(ok?cost:kg),un=q?'un':(ok?'R$':'kg');
function par(kf){var m={},tot=0,ds={};rows.forEach(function(r){var k=kf(r)||'—',v=fn(r);m[k]=(m[k]||0)+v;tot+=v;(ds[k]=ds[k]||{})[anaISO(r)]=1});var ac=0,a=Object.keys(m).map(function(k){return[k,m[k]]}).sort(function(x,y){return y[1]-x[1]});return{tot:tot,m:m,ds:ds,a:a.slice(0,8).map(function(x){ac+=x[1];return{k:x[0],v:x[1],p:tot?x[1]/tot*100:0,c:tot?ac/tot*100:0}})}}
function tb(ti,P){return '<div><h4 style="margin:0 0 6px">'+ti+'</h4><div class="tablewrap"><table><thead><tr><th>Descrição</th><th>'+un+'</th><th>%</th><th>% acum.</th></tr></thead><tbody>'+(P.a.map(function(x){return '<tr><td>'+esc(x.k)+'<div style="height:6px;border-radius:4px;background:rgba(127,127,127,.2);margin-top:3px"><div style="height:6px;border-radius:4px;width:'+Math.min(100,x.p)+'%;background:linear-gradient(90deg,#ff5a1a,#ff9a62)"></div></div></td><td>'+fmt(x.v)+'</td><td>'+fmt(x.p)+'%</td><td>'+fmt(x.c)+'%</td></tr>'}).join('')||'<tr><td colspan="4">Sem dados</td></tr>')+'</tbody></table></div></div>'}
var PM=par(function(r){return motivoDescricao(r)}),PMt=par(function(r){return matRec(r)}),PI=par(function(r){var c=String(val(r,'codigo')||'').trim(),p=String(val(r,'produto')||'').trim();return (c?c+' - ':'')+p});
var t3=PI.a.slice(0,3).reduce(function(s,x){return s+x.p},0),rc=0,rn=0;
Object.keys(PI.m).forEach(function(k){if(Object.keys(PI.ds[k]).length>=3){rn++;rc+=PI.m[k]}});
var ins='<div class="hint" style="margin:8px 0 12px">Os 3 itens principais concentram <b>'+fmt(t3)+'%</b> do total'+(PI.tot&&rn?'; <b>'+rn+'</b> item(ns) reincidente(s) (3+ datas) somam <b>'+fmt(rc/PI.tot*100)+'%</b>':'')+'.'+(ok||q?'':' <b>Valores em kg — libere os custos para ver em R$.</b>')+'</div>';
el.innerHTML='<div class="panel wide" style="margin-bottom:16px"><h3>Pareto por '+(q?'quantidade (un)':ok?'custo (R$)':'peso (kg)')+' e concentração</h3>'+ins+'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">'+tb('Por motivo',PM)+tb('Por item',PI)+tb('Por material',PMt)+'</div></div>'}
function helpGo(id){var e=document.getElementById(id);if(e)e.scrollIntoView({behavior:'smooth',block:'start'})}
function helpFilter(){var q=(document.getElementById('helpSearch').value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),n=0,s=document.getElementById('ajuda');
s.querySelectorAll('[data-h]').forEach(function(x){var tx=((x.getAttribute('data-h')||'')+' '+x.textContent).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),ok=!q||tx.indexOf(q)>=0;x.style.display=ok?'':'none';if(ok)n++;if(q&&ok&&x.tagName==='DETAILS')x.open=true;if(!q&&x.tagName==='DETAILS')x.open=false});
document.getElementById('helpEmpty').style.display=(q&&!n)?'block':'none'}

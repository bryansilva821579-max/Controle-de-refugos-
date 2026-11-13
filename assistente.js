/* ==================================================================
   ASSISTENTE DO SITE (v207) — botão flutuante 🤖 em todas as telas.
   Responde sobre refugos, devoluções, retrabalhos, forno/boletim e
   produção. Roda no próprio navegador: sem chave de API e sem enviar
   dados para fora. Não é um chat de IA aberto: entende perguntas dos
   tipos listados nos botões de exemplo.
   ================================================================== */
(function(){
const N=t=>asstNorm(t),pc=v=>rendPc(v),F=v=>fmt(Math.round(v*10)/10),D=iso=>iso.split('-').reverse().join('/');
const MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const NM=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const hojeIso=()=>rendIso(new Date());
/* ---------- fontes de dados ---------- */
function isoRef(r){let d=null;try{d=date(r)}catch(e){}if(d instanceof Date&&!isNaN(d))return rendIso(d);const y=recordYear(r),m=recordMonth(r);return y&&m?y+'-'+String(m).padStart(2,'0')+'-15':null}
function devAll(){try{return(window.devDados?window.devDados():JSON.parse(localStorage.getItem('controle_refugos_2026_devolucoes_v1')||'[]')).filter(r=>r&&r.data)}catch(e){return[]}}
function rtAll(){try{return JSON.parse(localStorage.getItem('controle_refugos_2026_retrabalhos')||'[]').filter(r=>r&&r.dt)}catch(e){return[]}}
function maxIso(a,f){let m='';a.forEach(x=>{const d=f(x);if(d&&d>m)m=d});return m||hojeIso()}
/* ---------- período ---------- */
function periodo(q,ult,defAno){
  const my=q.match(/\b(20\d\d)\b/),yr=my?my[1]:(defAno||ult.slice(0,4)),mi=MESES.findIndex(m=>q.includes(m));let r;
  const per=(de,ate,nota)=>({de,ate,nota,ult});
  if(mi>=0){const mm=String(mi+1).padStart(2,'0');return per(yr+'-'+mm+'-01',yr+'-'+mm+'-31','Período: '+MESES[mi]+'/'+yr+'.')}
  if((r=q.match(/ultimos?\s+(\d+)\s+dias?/)))return per(rendAddDias(ult,-(+r[1]-1)),ult,'Período: últimos '+r[1]+' dias (até '+D(ult)+').');
  if(/ultima semana|essa semana|esta semana/.test(q))return per(rendAddDias(ult,-6),ult,'Período: últimos 7 dias (até '+D(ult)+').');
  if(/mes passado|ultimo mes/.test(q)){const d=new Date(ult.slice(0,7)+'-01T12:00:00');d.setMonth(d.getMonth()-1);const p=rendIso(d).slice(0,7);return per(p+'-01',p+'-31','Período: mês passado ('+p.slice(5)+'/'+p.slice(0,4)+').')}
  if(/este mes|esse mes|mes atual/.test(q))return per(ult.slice(0,7)+'-01',ult.slice(0,7)+'-31','Período: mês de '+ult.slice(5,7)+'/'+ult.slice(0,4)+'.');
  if(/\bhoje\b|ultimo dia/.test(q))return per(ult,ult,'Período: último dia com registro ('+D(ult)+').');
  return per(yr+'-01-01',yr+'-12-31','Período: ano '+yr+'.');
}
/* ---------- REFUGOS ---------- */
function refRows(p){return(typeof data!=='undefined'?data:[]).filter(r=>{const d=isoRef(r);return d&&d>=p.de&&d<=p.ate})}
function grp(rows,fn){const m=new Map();rows.forEach(r=>{const k=String(fn(r)||'').trim()||'Não informado',o=m.get(k)||{k,kg:0,q:0,n:0};o.kg+=kg(r);o.q+=qty(r);o.n++;m.set(k,o)});return[...m.values()].sort((a,b)=>b.kg-a.kg)}
const refTot=rows=>rows.reduce((a,r)=>({kg:a.kg+kg(r),q:a.q+qty(r),n:a.n+1}),{kg:0,q:0,n:0});
const top=(g,t,n)=>g.slice(0,n||3).map((o,i)=>(i+1)+'. '+o.k+': '+F(o.kg)+' kg ('+pc(t?o.kg/t*100:0)+', '+o.n+' lançamento(s))');
function refPorMes(p){const rows=refRows(p),m=new Map();rows.forEach(r=>{const d=isoRef(r).slice(0,7),o=m.get(d)||{d,kg:0,kgF:0};const k=kg(r);o.kg+=k;if(recordPlant(r)==='FUNDICAO')o.kgF+=k;m.set(d,o)});
  let pt;try{pt=prodMonthTotals()}catch(e){pt=new Map()}
  return[...m.values()].sort((a,b)=>a.d.localeCompare(b.d)).map(o=>{const pr=pt.get(o.d)||0,inteiro=o.d+'-01'>=p.de&&o.d+'-31'<=p.ate;return{...o,pr,pct:pr&&inteiro?o.kgF/pr*100:null}})}
function refAnalise(p){
  const R={resumo:[],alertas:[],acoes:[]},rows=refRows(p);if(!rows.length){R.resumo.push('Não há lançamentos de refugo neste período.');return R}
  const T=refTot(rows),mot=grp(rows,motivoDescricao),cli=grp(rows,r=>val(r,'cliente')),pro=grp(rows,r=>(val(r,'codigo')+' '+val(r,'produto')).trim()),pl=grp(rows,recordPlant),meses=refPorMes(p);
  R.resumo.push(T.n+' lançamento(s): '+F(T.kg)+' kg refugados ('+fmt(T.q)+' peças).');
  R.resumo.push('Principal motivo: '+mot[0].k+' ('+pc(mot[0].kg/T.kg*100)+' do peso). Principal cliente: '+cli[0].k+' ('+pc(cli[0].kg/T.kg*100)+').');
  if(pro[0])R.resumo.push('Peça que mais refugou: '+pro[0].k+' ('+F(pro[0].kg)+' kg, '+pc(pro[0].kg/T.kg*100)+').');
  if(pl.length>1)R.resumo.push('Por planta: '+pl.slice(0,3).map(x=>x.k+' '+pc(x.kg/T.kg*100)).join(' • ')+'.');
  const mtaP=(typeof meta!=='undefined'&&meta&&meta.perc)?meta.perc:null;
  const cp=meses.filter(m=>m.pct!=null);if(cp.length){const mt=cp.reduce((a,m)=>a+m.kgF,0),pt=cp.reduce((a,m)=>a+m.pr,0);R.resumo.push('Refugo da Fundição: '+pc(pt?mt/pt*100:0)+' da produção ('+cp.length+' mês(es) completos)'+(mtaP?' — meta '+pc(mtaP):'')+'.');
    if(mtaP)cp.filter(m=>m.pct>mtaP).forEach(m=>R.alertas.push(NM[+m.d.slice(5)-1]+'/'+m.d.slice(2,4)+': refugo da Fundição em '+pc(m.pct)+', acima da meta de '+pc(mtaP)+'.'))}
  if(mot.length>1&&(mot[0].kg+mot[1].kg)/T.kg>0.5){R.alertas.push('Dois motivos concentram '+pc((mot[0].kg+mot[1].kg)/T.kg*100)+' do refugo: '+mot[0].k+' e '+mot[1].k+'.');R.acoes.push('Ataque primeiro “'+mot[0].k+'” e “'+mot[1].k+'”: juntos são mais da metade do peso refugado.')}
  if(cli[0].kg/T.kg>0.3){R.alertas.push('O cliente '+cli[0].k+' concentra '+pc(cli[0].kg/T.kg*100)+' do refugo.');R.acoes.push('Revise as peças do cliente '+cli[0].k+' — concentram boa parte do refugo.')}
  if(pro[0]&&pro[0].n>=3)R.acoes.push('A peça '+pro[0].k+' tem '+pro[0].n+' lançamentos no período: vale uma análise de causa raiz específica.');
  const ult=p.ult,a=refRows({de:rendAddDias(ult,-29),ate:ult}),b=refRows({de:rendAddDias(ult,-59),ate:rendAddDias(ult,-30)});
  if(a.length&&b.length){const ka=refTot(a).kg,kb=refTot(b).kg,df=kb?(ka-kb)/kb*100:0;if(Math.abs(df)>=15){R.alertas.push('Nos últimos 30 dias o refugo '+(df>0?'subiu ':'caiu ')+pc(Math.abs(df))+' ('+F(ka)+' kg contra '+F(kb)+' kg nos 30 dias anteriores).');if(df>0)R.acoes.push('O refugo está subindo: compare os motivos dos últimos 30 dias com os do período anterior.')}}
  if(!R.alertas.length)R.alertas.push('Nada fora do padrão em refugos neste período.');if(!R.acoes.length)R.acoes.push('Sem ações sugeridas para refugos: indicadores estáveis.');
  return R;
}
/* ---------- DEVOLUÇÕES ---------- */
const dKg=r=>(+r.qtd||0)*(+r.pesoUn||0);
function devRows(p){return devAll().filter(r=>r.data>=p.de&&r.data<=p.ate)}
function gd(rows,fn){const m=new Map();rows.forEach(r=>{const k=String(fn(r)||'').trim()||'Não informado',o=m.get(k)||{k,q:0,kg:0,n:0};o.q+=+r.qtd||0;o.kg+=dKg(r);o.n++;m.set(k,o)});return[...m.values()].sort((a,b)=>b.q-a.q)}
const dTop=(g,t,n)=>g.slice(0,n||3).map((o,i)=>(i+1)+'. '+o.k+': '+fmt(o.q)+' peça(s) ('+pc(t?o.q/t*100:0)+', '+F(o.kg)+' kg)');
function devAnalise(p){
  const R={resumo:[],alertas:[],acoes:[]},rows=devRows(p);if(!rows.length){R.resumo.push('Não há devoluções neste período.');return R}
  const Q=rows.reduce((a,r)=>a+(+r.qtd||0),0),K=rows.reduce((a,r)=>a+dKg(r),0),cli=gd(rows,r=>r.cliente),mot=gd(rows,r=>r.motivo),disp=gd(rows,r=>r.disp);
  R.resumo.push(rows.length+' item(ns) devolvido(s): '+fmt(Q)+' peças ('+F(K)+' kg).');R.resumo.push('Cliente com mais devoluções: '+cli[0].k+' ('+pc(cli[0].q/Q*100)+'). Principal motivo: '+mot[0].k+' ('+pc(mot[0].q/Q*100)+').');
  R.resumo.push('Situação: '+disp.slice(0,4).map(x=>x.k+' '+x.n).join(' • ')+'.');
  const ab=rows.filter(r=>/aguardando/i.test(r.disp||''));if(ab.length){const ant=ab.map(r=>r.data).sort()[0],dias=Math.round((new Date(p.ult)-new Date(ant))/864e5);R.alertas.push(ab.length+' item(ns) ainda “Aguardando análise” — o mais antigo é de '+D(ant)+' ('+dias+' dias).');R.acoes.push('Analise as devoluções pendentes, começando pela de '+D(ant)+'.')}
  const np=rows.filter(r=>r.procede==='Não').length;if(np)R.alertas.push(np+' item(ns) marcados como reclamação que não procede.');
  if(cli[0].q/Q>0.35){R.alertas.push(cli[0].k+' concentra '+pc(cli[0].q/Q*100)+' das peças devolvidas.');R.acoes.push('Converse com o cliente '+cli[0].k+' sobre o motivo “'+mot[0].k+'”, que lidera as devoluções.')}
  if(!R.alertas.length)R.alertas.push('Nada fora do padrão em devoluções.');if(!R.acoes.length)R.acoes.push('Sem ações sugeridas para devoluções.');return R}
/* ---------- RETRABALHOS ---------- */
function rtRows(p){return rtAll().filter(r=>r.dt>=p.de&&r.dt<=p.ate)}
function gr(rows,fn){const m=new Map();rows.forEach(r=>{const k=String(fn(r)||'').trim()||'Não informado',o=m.get(k)||{k,q:0,n:0};o.q+=+r.qtd||0;o.n++;m.set(k,o)});return[...m.values()].sort((a,b)=>b.q-a.q)}
const rTop=(g,t,n)=>g.slice(0,n||3).map((o,i)=>(i+1)+'. '+o.k+': '+fmt(o.q)+' peça(s) ('+pc(t?o.q/t*100:0)+', '+o.n+' lançamento(s))');
function rtAnalise(p){
  const R={resumo:[],alertas:[],acoes:[]},rows=rtRows(p);if(!rows.length){R.resumo.push('Não há retrabalhos neste período.');return R}
  const Q=rows.reduce((a,r)=>a+(+r.qtd||0),0),mot=gr(rows,r=>r.mot),cli=gr(rows,r=>r.cli),st=gr(rows,r=>r.st);
  R.resumo.push(rows.length+' retrabalho(s): '+fmt(Q)+' peças. Principal motivo: '+mot[0].k+' ('+pc(mot[0].q/Q*100)+'). Cliente: '+cli[0].k+' ('+pc(cli[0].q/Q*100)+').');R.resumo.push('Situação: '+st.map(x=>x.k+' '+x.n).join(' • ')+'.');
  const com=rows.filter(r=>r.qOk!=null&&r.qRef!=null),ok=com.reduce((a,r)=>a+r.qOk,0),rf=com.reduce((a,r)=>a+r.qRef,0);if(ok+rf>0){R.resumo.push('Resultado dos retrabalhos concluídos: '+pc(ok/(ok+rf)*100)+' recuperadas e '+pc(rf/(ok+rf)*100)+' viraram refugo.');if(rf/(ok+rf)>0.15)R.alertas.push('Mais de 15% das peças retrabalhadas acabaram como refugo ('+fmt(rf)+' peça(s)).')}
  const ab=rows.filter(r=>!/conclu/i.test(r.st||'')&&Math.round((new Date(p.ult)-new Date(r.dt))/864e5)>7);if(ab.length){R.alertas.push(ab.length+' retrabalho(s) abertos há mais de 7 dias.');R.acoes.push('Cobre a conclusão dos '+ab.length+' retrabalhos parados há mais de uma semana.')}
  if(mot[0].q/Q>0.3)R.acoes.push('“'+mot[0].k+'” responde por '+pc(mot[0].q/Q*100)+' dos retrabalhos: investigue a origem para evitar repetição.');
  if(!R.alertas.length)R.alertas.push('Nada fora do padrão em retrabalhos.');if(!R.acoes.length)R.acoes.push('Sem ações sugeridas para retrabalhos.');return R}
/* ---------- FORNO / BOLETIM ---------- */
function fornoAnalise(p){const B=lingBase(),ds=[...B.keys()].filter(d=>B.get(d).p>0).sort(),ult=ds.pop()||hojeIso();return asstAnalise(ult.slice(0,8)+'01',ult)}
/* ---------- roteamento ---------- */
const PAGINA={dashboard:'refugo',dashboardQtd:'refugo',historico:'refugo',gestao:'refugo',reuniao:'refugo',auditoria:'refugo',dados:'refugo',lancamentos:'refugo',cadastro:'refugo',ajuda:'refugo',devolucoes:'devol',retrabalho:'retrab',painel360:'forno'};
function paginaAtual(){const el=document.querySelector('.page.active');const id=el?el.id:'';let d=PAGINA[id]||'refugo';if(id==='lancamentos'){const b=document.getElementById('launchTabBoletim'),pr=document.getElementById('launchTabProducao');if((b&&b.style.display!=='none')||(pr&&pr.style.display!=='none'))d='forno'}return d}
function dominio(q,pag){
  if(/devol|fq051|reclamac/.test(q))return'devol';if(/retrabal/.test(q))return'retrab';
  if(/forno|lingote|respingo|gota|carga fria|panela|boletim|corrida|fusao|rendimento|perda na/.test(q))return'forno';
  if(/refug|motivo|cliente|peca|produto|planta|usinagem|fundicao|responsavel|setor|meta|etiqueta|causa/.test(q))return'refugo';
  return pag}
function ultDe(dom){return dom==='devol'?maxIso(devAll(),r=>r.data):dom==='retrab'?maxIso(rtAll(),r=>r.dt):maxIso(typeof data!=='undefined'?data:[],isoRef)}
/* ---------- MOTOR DE PERGUNTAS (v209): filtros combinados, comparações, evolução, projeção, perguntas de continuação e gráficos ---------- */
const ULT={last:null,sug:[]};
const W=t=>N(t).replace(/[^a-z0-9]+/g,' ').trim();
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const DIMN={motivo:'motivo',cliente:'cliente',peca:'peça',planta:'planta',responsavel:'responsável',setor:'setor',material:'material',situacao:'situação'};
const ADAPT={
  refugo:{nome:'refugo',all:()=>typeof data!=='undefined'?data:[],dt:isoRef,defM:'kg',
    F:{cliente:r=>String(val(r,'cliente')||'').trim().toUpperCase(),motivo:r=>motivoDescricao(r),peca:r=>(String(val(r,'codigo')||'')+' '+String(val(r,'produto')||'')).trim(),pecaCod:r=>String(val(r,'codigo')||'').trim(),pecaNome:r=>String(val(r,'produto')||'').trim(),planta:r=>recordPlant(r),responsavel:r=>String(val(r,'responsavel')||'').trim(),setor:r=>String(val(r,'setor')||'').trim(),material:r=>String(val(r,'material')||'').trim()},
    M:{kg:r=>kg(r),q:r=>qty(r),n:()=>1}},
  devol:{nome:'devolução',all:devAll,dt:r=>r.data,defM:'q',
    F:{cliente:r=>String(r.cliente||'').trim().toUpperCase(),motivo:r=>String(r.motivo||'').trim(),peca:r=>((r.codigo||'')+' '+(r.produto||'')).trim(),pecaCod:r=>String(r.codigo||'').trim(),pecaNome:r=>String(r.produto||'').trim(),planta:r=>String(r.tipo||'').trim(),situacao:r=>String(r.disp||'').trim()},
    M:{kg:dKg,q:r=>+r.qtd||0,n:()=>1}},
  retrab:{nome:'retrabalho',all:rtAll,dt:r=>r.dt,defM:'q',
    F:{cliente:r=>String(r.cli||'').trim().toUpperCase(),motivo:r=>String(r.mot||'').trim(),peca:r=>String(r.prod||'').trim(),pecaNome:r=>String(r.prod||'').trim(),setor:r=>String(r.setor||'').trim(),situacao:r=>String(r.st||'').trim(),material:r=>String(r.mat||'').trim(),responsavel:r=>String(r.respE||'').trim()},
    M:{q:r=>+r.qtd||0,n:()=>1}}
};
const dimDe=f=>/^peca/.test(f)?'peca':f;
const NO_ENT=/^(nao informado|)$/;
const ENTC={};
function entidadesDe(dom){const A=ADAPT[dom],all=A.all(),key=all.length+':'+(all[0]?JSON.stringify(all[all.length-1]).length:0);if(ENTC[dom]&&ENTC[dom].k===key)return ENTC[dom].e;
  const e=[];Object.keys(A.F).forEach(f=>{if(f==='peca')return;const s=new Map();all.forEach(r=>{const v=String(A.F[f](r)||'').trim();if(v&&!s.has(v))s.set(v,W(v))});s.forEach((nv,v)=>{if(nv.length>=3&&!NO_ENT.test(nv))e.push({f,v,nv,w:nv.split(' ').filter(x=>x.length>=3)})})});
  ENTC[dom]={k:key,e};return e}
function achaEnt(dom,qw){const pad=' '+qw+' ',hits=[];entidadesDe(dom).forEach(x=>{if(pad.includes(' '+x.nv+' ')||(x.w.length>=2&&x.w.every(w=>pad.includes(' '+w+' '))))hits.push(x)});
  return hits.filter(a=>!hits.some(b=>b!==a&&dimDe(b.f)===dimDe(a.f)&&b.nv.length>a.nv.length&&(' '+b.nv+' ').includes(' '+a.nv+' ')))}
function lev(a,b){const m=a.length,n=b.length;if(Math.abs(m-n)>2)return 9;const d=[];for(let i=0;i<=m;i++){d[i]=[i];}for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
const KNOWN=/^(refug|devol|retrab|cliente|motivo|causa|defeito|material|planta|setor|maquina|responsavel|situacao|status|produto|peca|item|itens|codigo|quant|lancament|maior|menor|mais|menos|principal|compar|evolu|mensal|diari|semanal|tendenc|projec|previs|period|ultim|primeir|segund|terceir|quart|trimest|semest|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|passad|atual|forno|meta|lingote|resumo|alerta|sugest|melhor|pior|ranking|quais|quanto|quando|media|total|percent|porcent|kilos|quilo|pesou|perdeu|perda|fundicao|usinagem|mes|meses|semana|semanas|dias|ontem|hoje|entre)/;
const STOP=/^(esse|isso|essa|este|esta|para|pelo|pela|como|qual|quem|foi|ser|dos|das|nos|nas|com|sem|que|uma|uns|todo|toda|tudo|vez|teve|tem|ter|sao|era|dia|dias|ano|anos|dele|dela|nele|desse|onde|cada|ainda|ja|so|mim|voce)$/;
function fuzzyEnt(dom,qw,hits){const ent=entidadesDe(dom),pad=' '+qw+' ',out=[];const used=new Set();hits.forEach(h=>h.nv.split(' ').forEach(w=>used.add(w)));
  qw.split(' ').filter(t=>t.length>=4&&!KNOWN.test(t)&&!STOP.test(t)&&!used.has(t)&&!ent.some(x=>(' '+x.nv+' ').includes(' '+t+' '))).slice(0,3).forEach(t=>{let best=null,bd=9;const lim=t.length>=8?2:1;ent.forEach(x=>x.nv.split(' ').forEach(w=>{if(w.length<4)return;const d=lev(t,w);if(d<bd&&d<=lim&&(t.length>=5||t[0]===w[0])){bd=d;best=x}}));if(best&&!out.some(o=>o.x===best))out.push({t,x:best})});return out}
function mesAntIso(iso,fim){const y=+iso.slice(0,4),m=+iso.slice(5,7),d=+iso.slice(8,10),ul=new Date(y,m,0).getDate(),py=m===1?y-1:y,pm=m===1?12:m-1,pu=new Date(py,pm,0).getDate(),dd=(fim&&d===ul)?pu:Math.min(d,pu);return py+'-'+String(pm).padStart(2,'0')+'-'+String(dd).padStart(2,'0')}
function perPar(q,ult){
  const yN=+ult.slice(0,4),mN=+ult.slice(5,7),my=q.match(/\b(20\d\d)\b/),pos=m=>q.search(new RegExp('\\b'+m+'\\b'));
  const ms=MESES.map((m,i)=>i).filter(i=>pos(MESES[i])>=0).sort((a,b)=>pos(MESES[a])-pos(MESES[b]));
  const yrOf=i=>my?+my[1]:(i+1>mN?yN-1:yN),mk=i=>{const y=yrOf(i),mm=String(i+1).padStart(2,'0');return{de:y+'-'+mm+'-01',ate:y+'-'+mm+'-'+String(new Date(y,i+1,0).getDate()).padStart(2,'0'),nota:MESES[i]+'/'+y}};
  const R=(de,ate,nota)=>({de,ate,nota,explicit:true,meses:ms.map(mk),ult});let r;
  const ds=[...q.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g)];
  if(ds.length>=2){const f=x=>{const y=x[3]?(x[3].length===2?2000+ +x[3]:+x[3]):yN;return y+'-'+x[2].padStart(2,'0')+'-'+x[1].padStart(2,'0')};const a=f(ds[0]),b=f(ds[1]);return R(a<=b?a:b,a<=b?b:a,D(a<=b?a:b)+' a '+D(a<=b?b:a))}
  if(ds.length===1){const y=ds[0][3]?(ds[0][3].length===2?2000+ +ds[0][3]:+ds[0][3]):yN,d=y+'-'+ds[0][2].padStart(2,'0')+'-'+ds[0][1].padStart(2,'0');return R(d,d,D(d))}
  if((r=q.match(/ultimos?\s+(\d+)\s+(dia|semana|mes)/))){const n=+r[1];if(r[2]==='dia')return R(rendAddDias(ult,-(n-1)),ult,'últimos '+n+' dias');if(r[2]==='semana')return R(rendAddDias(ult,-(7*n-1)),ult,'últimas '+n+' semanas');let d=ult.slice(0,8)+'01';for(let i=1;i<n;i++)d=mesAntIso(d,false);return R(d,ult,'últimos '+n+' meses')}
  if(/semana passada/.test(q))return R(rendAddDias(ult,-13),rendAddDias(ult,-7),'semana passada');
  if(/ultima semana|essa semana|esta semana|ultimos 7/.test(q))return R(rendAddDias(ult,-6),ult,'últimos 7 dias');
  if(/ano passado|ano anterior/.test(q))return R((yN-1)+'-01-01',(yN-1)+'-12-31','ano '+(yN-1));
  if(/mes passado|mes anterior|ultimo mes/.test(q)&&!ms.length){const a=mesAntIso(ult.slice(0,8)+'01',false);return R(a,a.slice(0,8)+String(new Date(+a.slice(0,4),+a.slice(5,7),0).getDate()),'mês passado')}
  if(/este mes|esse mes|mes atual|neste mes/.test(q)&&!ms.length)return R(ult.slice(0,8)+'01',ult,'mês atual até '+D(ult));
  if((r=q.match(/(primeiro|segundo|terceiro|quarto|1o|2o|3o|4o)\s+(trimestre|semestre)/))){const i={primeiro:1,segundo:2,terceiro:3,quarto:4,'1o':1,'2o':2,'3o':3,'4o':4}[r[1]],t=r[2]==='trimestre'?3:6,y=my?+my[1]:yN,m1=(i-1)*t+1,m2=m1+t-1;return R(y+'-'+String(m1).padStart(2,'0')+'-01',y+'-'+String(m2).padStart(2,'0')+'-'+String(new Date(y,m2,0).getDate()).padStart(2,'0'),r[1]+' '+r[2]+'/'+y)}
  if(/\bhoje\b|ultimo dia/.test(q))return R(ult,ult,'último dia com registro ('+D(ult)+')');
  if(ms.length&&!/compar|versus|\bvs\b|contra|entre/.test(q))return R(mk(ms[0]).de,mk(ms[0]).ate,mk(ms[0]).nota);
  if(ms.length>=2){const a=mk(ms[0]),b=mk(ms[1]);return R(a.de<b.de?a.de:b.de,a.de<b.de?b.ate:a.ate,a.nota+' e '+b.nota)}
  if(ms.length===1)return R(mk(ms[0]).de,mk(ms[0]).ate,mk(ms[0]).nota);
  if(my)return R(my[1]+'-01-01',my[1]+'-12-31','ano '+my[1]);
  if(/este ano|ano atual|neste ano|esse ano/.test(q))return R(yN+'-01-01',ult,'ano '+yN+' até '+D(ult));
  return{de:yN+'-01-01',ate:yN+'-12-31',nota:'ano '+yN,explicit:false,meses:[],ult};
}
function detDim(q){const o=[['motivo',/motivo|causa|defeito|razao/],['cliente',/cliente/],['peca',/\bpecas?\b|produto|\bitens?\b|\bitem\b|codigo/],['planta',/planta|unidade/],['responsavel',/responsavel|etiqueta|quem /],['setor',/setor|maquina/],['material',/material|\bliga\b/],['situacao',/situacao|status|disposicao|andamento/]];return o.filter(x=>x[1].test(q)).map(x=>x[0])}
function detMetric(q){if(/lancamento|ocorrencia|\bvezes\b/.test(q))return'n';if(/quantidade|unidades|quantas pecas|numero de pecas|em pecas|total de pecas/.test(q)&&!/\bkg\b|peso|quilo/.test(q))return'q';if(/\bkg\b|peso|quilo|kilo/.test(q))return'kg';return null}
function detOp(q){
  if(/sugest|acao|acoes|melhorar|reduzir|o que fazer|recomend/.test(q))return'acoes';if(/alerta|anomal|fora do (normal|padrao)|problema|atencao|atrasad|parado/.test(q))return'alertas';if(/resumo|visao geral|como (estamos|foi|esta)|panorama/.test(q))return'resumo';
  if(/\bmeta\b|% de refugo|percentual de refugo|taxa de refugo|porcentagem de refugo/.test(q))return'meta';
  if(/compar|versus|\bvs\b|contra o|em relacao|diferenca entre|variou|variacao/.test(q))return'comp';
  if(/projec|previs|vai fechar|fechar o mes|estimativa|tendencia de fechamento/.test(q))return'proj';
  if(/evolu|por mes|mensal|mes a mes|por dia|diari|por semana|semanal|historico|tendencia|serie/.test(q))return'serie';
  if(/ultima vez|ultimo registro|quando foi|primeira vez|quando (foi|teve|houve)|data (do|da) ultim/.test(q))return/primeira/.test(q)?'primeira':'ultima';
  if(/lancamentos? mais pesados?|maiores lancamentos|maior lancamento|mais pesado|registros? (mais|maiores)/.test(q))return'pesados';
  if(/recorrente|repetid|reincid/.test(q))return'recor';
  if(/\bquant(os|as)\s+(clientes|motivos|pecas|itens|setores|materiais|responsaveis|plantas|produtos)/.test(q))return'distintos';
  if(/media|medio/.test(q))return'media';
  return null}
function detN(q){const w={um:1,dois:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10};let r=q.match(/top\s*(\d+)|(\d+)\s*(maiores|principais|piores|menores|melhores|clientes|motivos|pecas|itens)/);if(r)return+(r[1]||r[2]);r=q.match(/\b(um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(maiores|principais|piores|menores|melhores|clientes|motivos|pecas|itens)/);if(r)return w[r[1]];return/ranking|lista|quais|principais|top|maiores|menores/.test(q)?5:3}
function filtra(A,rows,fl){if(!fl.length)return rows;const by={};fl.forEach(x=>{(by[dimDe(x.f)]=by[dimDe(x.f)]||[]).push(x)});
  return rows.filter(r=>Object.keys(by).every(k=>by[k].some(x=>String(A.F[x.f](r)||'').trim()===x.v)))}
const rowsIn=(A,p)=>A.all().filter(r=>{const d=A.dt(r);return d&&d>=p.de&&d<=p.ate});
function agrega(A,rows,fn,mt){const m=new Map();rows.forEach(r=>{const k=String(fn(r)||'').trim()||'Não informado',o=m.get(k)||{k,v:0,kg:0,q:0,n:0,dates:new Set()};o.v+=A.M[mt](r);if(A.M.kg)o.kg+=A.M.kg(r);o.q+=A.M.q(r);o.n++;o.dates.add(A.dt(r));m.set(k,o)});return[...m.values()]}
const mTxt=(mt,v)=>mt==='kg'?F(v)+' kg':mt==='q'?fmt(Math.round(v))+' peça(s)':fmt(Math.round(v))+' lançamento(s)';
const totais=(A,rows)=>({kg:A.M.kg?rows.reduce((a,r)=>a+A.M.kg(r),0):null,q:rows.reduce((a,r)=>a+A.M.q(r),0),n:rows.length});
const totTxt=(A,T)=>[T.kg!=null?F(T.kg)+' kg':null,fmt(Math.round(T.q))+' peça(s)',fmt(T.n)+' lançamento(s)'].filter(Boolean).join(' • ');
const barsC=(t,g,mt,tot,cor)=>({chart:'bars',t,cor:cor||'#ff6a1f',items:g.map(o=>({l:o.k,v:o.v,txt:mTxt(mt,o.v).replace(' peça(s)',' pç').replace(' lançamento(s)',' lanç.')+(tot?' · '+pc(o.v/tot*100):'')}))});
function rowTxt(A,r){return D(A.dt(r))+' — '+[A.F.peca&&A.F.peca(r),A.F.cliente&&A.F.cliente(r),A.F.motivo&&A.F.motivo(r)].filter(Boolean).join(' — ')+' — '+(A.M.kg?F(A.M.kg(r))+' kg':fmt(A.M.q(r))+' peça(s)')}
function bucketKey(d,tp){if(tp==='m')return d.slice(0,7);if(tp==='s'){const x=new Date(d+'T12:00:00'),w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);return rendIso(x)}return d}
function bucketLbl(k,tp){return tp==='m'?NM[+k.slice(5,7)-1]+'/'+k.slice(2,4):D(k).slice(0,5)}
function motor(dom,q0,explicit,follow){
  const A=ADAPT[dom],q=N(q0),qw=W(q0),ult=ultDe(dom);let notas=[];
  let pp=perPar(q,ult),fl=achaEnt(dom,qw);const fz=fuzzyEnt(dom,qw,fl);fz.forEach(z=>{fl.push(z.x);notas.push('Interpretei “'+z.t+'” como “'+z.x.v+'”.')});
  const dims=detDim(q),L=ULT.last,P={dom,per:pp.explicit?pp:null,filters:fl,dim:null,metric:detMetric(q),op:detOp(q),n:detN(q)};
  const dimsLivres=dims.filter(d=>!fl.some(x=>dimDe(x.f)===d)&&A.F[d]);P.dim=dimsLivres[0]||null;
  if(follow&&L&&L.dom===dom){if(!P.per)P.per=L.per;const novos=new Set(fl.map(x=>dimDe(x.f)));P.filters=L.filters.filter(x=>!novos.has(dimDe(x.f))&&!dims.includes(dimDe(x.f))).concat(fl);if(!P.dim&&!(P.op==='serie'||P.op==='comp'||P.op==='proj'))P.dim=L.dim;if(!P.metric)P.metric=L.metric;if(!P.op)P.op=P.dim&&P.dim!==L.dim?'rank':L.op;if(P.dim&&(P.op==='total'||!P.op))P.op='rank'}
  const per=P.per||pp,op=P.op||(P.dim?'rank':'total');P.op=op;let mt=P.metric&&A.M[P.metric]?P.metric:A.defM;P.metric=P.metric||null;
  P.sem=/\b(abert|pendente|aguardand|em andamento|nao concluid)/.test(q)?'ab':/\b(concluid|finalizad|encerrad)/.test(q)?'ok':(follow&&L&&L.dom===dom?L.sem:null);
  const semF=rs=>(!P.sem||!A.F.situacao)?rs:rs.filter(r=>{const v=String(A.F.situacao(r));const fechado=dom==='retrab'?/conclu/i.test(v):!/aguardando/i.test(v);return P.sem==='ab'?!fechado:fechado});
  const R0=semF(filtra(A,rowsIn(A,per),P.filters)),T=totais(A,R0),tv=agrega(A,R0,()=>'t',mt)[0]?agrega(A,R0,()=>'t',mt)[0].v:0;
  const fdesc=P.filters.map(x=>(DIMN[dimDe(x.f)]||x.f)+' '+x.v).concat(P.sem?[P.sem==='ab'?'em aberto':'concluídos']:[]).join(' • '),eco='🔎 '+cap(A.nome)+' • '+per.nota+(fdesc?' • '+fdesc:'')+' • '+(mt==='kg'?'peso':mt==='q'?'peças':'lançamentos');
  const out=[eco].concat(notas),sug=[];ULT.last=P;
  const finish=(L2,s)=>{ULT.sug=s||[];return out.concat(L2)};
  const sg=(...a)=>a.filter(x=>x);
  const An=dom==='devol'?devAnalise:dom==='retrab'?rtAnalise:refAnalise,pr={de:per.de,ate:per.ate,nota:'',ult};
  if(op==='resumo')return finish(An(pr).resumo,['E o que posso melhorar?','E os alertas?','E a evolução por mês?']);
  if(op==='alertas')return finish(An(pr).alertas,['E o que posso melhorar?','Resumo','E a evolução por mês?']);
  if(op==='acoes')return finish(An(pr).acoes,['E os alertas?','Resumo','E a evolução por mês?']);
  if(op==='comp'){
    let a,b;const ms=pp.meses||[];if(ms.length>=2){a=ms[0];b=ms[1]}else if(ms.length===1){a=ms[0];const d1=mesAntIso(a.de,false);b={de:d1,ate:mesAntIso(a.ate,true),nota:'mês anterior'}}
    else if(P.per&&P.per.explicit&&per.de!==per.ate&&!/semana|dia/.test(per.nota)){a=per;b={de:mesAntIso(per.de,false),ate:mesAntIso(per.ate,true),nota:'mesmo período do mês passado'}}else{a={de:ult.slice(0,8)+'01',ate:ult,nota:'mês atual (até '+D(ult)+')'};b={de:mesAntIso(a.de,false),ate:mesAntIso(ult,true),nota:'mesmo período do mês passado'}}
    const RA=semF(filtra(A,rowsIn(A,a),P.filters)),RB=semF(filtra(A,rowsIn(A,b),P.filters)),TA=totais(A,RA),TB=totais(A,RB),dl=(x,y)=>Math.abs(x-y)<1e-9?'= igual':y?(x>y?'▲ ':'▼ ')+pc(Math.abs((x-y)/y*100)):(x?'▲ novo':'—');
    const L2=['Comparação: '+a.nota+' ('+D(a.de)+' a '+D(a.ate)+') contra '+b.nota+' ('+D(b.de)+' a '+D(b.ate)+'):'];
    if(TA.kg!=null)L2.push('• Peso: '+F(TA.kg)+' kg contra '+F(TB.kg)+' kg  '+dl(TA.kg,TB.kg));L2.push('• Peças: '+fmt(Math.round(TA.q))+' contra '+fmt(Math.round(TB.q))+'  '+dl(TA.q,TB.q));L2.push('• Lançamentos: '+TA.n+' contra '+TB.n+'  '+dl(TA.n,TB.n));
    const dm=P.dim||(P.filters.some(x=>x.f==='motivo')?'cliente':'motivo'),fn=A.F[dm]||A.F.motivo,ga=new Map(agrega(A,RA,fn,mt).map(o=>[o.k,o.v])),gb=new Map(agrega(A,RB,fn,mt).map(o=>[o.k,o.v])),ks=new Set([...ga.keys(),...gb.keys()]);
    const df=[...ks].map(k=>({k,v:(ga.get(k)||0)-(gb.get(k)||0)}));const up=df.filter(x=>x.v>0).sort((x,y)=>y.v-x.v).slice(0,3),dn=df.filter(x=>x.v<0).sort((x,y)=>x.v-y.v).slice(0,3);
    if(up.length)L2.push('Maiores aumentos por '+DIMN[dm]+': '+up.map(x=>x.k+' (+'+mTxt(mt,x.v)+')').join('; ')+'.');if(dn.length)L2.push('Maiores quedas por '+DIMN[dm]+': '+dn.map(x=>x.k+' (−'+mTxt(mt,-x.v)+')').join('; ')+'.');
    return finish(L2.concat([{chart:'bars',t:'Total por período ('+mTxt(mt,0).replace(/^0 /,'')+')',cor:'#38bdf8',items:[{l:a.nota,v:agrega(A,RA,()=>'t',mt).reduce((s,o)=>s+o.v,0),txt:mTxt(mt,agrega(A,RA,()=>'t',mt).reduce((s,o)=>s+o.v,0))},{l:b.nota,v:agrega(A,RB,()=>'t',mt).reduce((s,o)=>s+o.v,0),txt:mTxt(mt,agrega(A,RB,()=>'t',mt).reduce((s,o)=>s+o.v,0))}]}]),['E a evolução por mês?','E por cliente?','E por motivo?'])}
  if(op==='meta'&&dom==='refugo'){const m=refPorMes(per).filter(x=>x.pct!=null),mt2=(typeof meta!=='undefined'&&meta&&meta.perc)||null;if(!m.length)return finish(['Para calcular o % do refugo preciso de meses completos com produção lançada nesse período.'],['E a evolução por mês?','E o resumo?']);const a2=m.reduce((x,y)=>x+y.kgF,0),b2=m.reduce((x,y)=>x+y.pr,0);
    return finish(['Refugo da Fundição: '+pc(b2?a2/b2*100:0)+' da produção ('+F(a2)+' kg de '+F(b2)+' kg)'+(mt2?', meta '+pc(mt2)+(a2/b2*100>mt2?' — acima da meta.':' — dentro da meta.'):'.'),{chart:'cols',t:'% de refugo da Fundição por mês',cor:'#ef4444',items:m.map(x=>({l:NM[+x.d.slice(5)-1],v:x.pct,txt:pc(x.pct)}))}],['E a evolução por mês?','E o que posso melhorar?','E comparando com o mês passado?'])}
  if(!R0.length)return finish(['Não encontrei registros com esses filtros neste período. Confira se o nome do cliente/motivo está escrito como no cadastro, ou tente outro período (ex.: “em 2026”).'],['E a evolução por mês?','E o resumo?']);
  if(op==='proj'){const mes=ult.slice(0,7),dec=+ult.slice(8),tot=new Date(+ult.slice(0,4),+ult.slice(5,7),0).getDate(),Rm=filtra(A,rowsIn(A,{de:mes+'-01',ate:ult}),P.filters),sm=agrega(A,Rm,()=>'t',mt).reduce((s,o)=>s+o.v,0),pj=sm/dec*tot,ant=mesAntIso(mes+'-01',false),Rp=filtra(A,rowsIn(A,{de:ant,ate:ant.slice(0,8)+String(new Date(+ant.slice(0,4),+ant.slice(5,7),0).getDate())}),P.filters),sp=agrega(A,Rp,()=>'t',mt).reduce((s,o)=>s+o.v,0);
    const L2=['Projeção de '+NM[+mes.slice(5)-1]+'/'+mes.slice(2,4)+': até o dia '+dec+' já são '+mTxt(mt,sm)+'; mantendo o ritmo, o mês fecha em ~'+mTxt(mt,pj)+'.'];if(sp)L2.push('O mês passado fechou em '+mTxt(mt,sp)+' ('+(pj>=sp?'▲ ':'▼ ')+pc(Math.abs((pj-sp)/sp*100))+' em relação a isso).');L2.push('É uma projeção simples (ritmo médio por dia), sem considerar sazonalidade.');return finish(L2,['E a evolução por mês?','E comparando com o mês passado?','E por cliente?'])}
  if(op==='serie'){const dias=Math.round((new Date(per.ate+'T12:00:00')-new Date(per.de+'T12:00:00'))/864e5)+1,tp=/semanal|por semana/.test(q)?'s':/por dia|diari/.test(q)?'d':/por mes|mensal|mes a mes|evolu|historico|tendencia|serie/.test(q)?(dias>62||!/por dia/.test(q)?'m':'d'):(dias>62?'m':'d');
    const g=new Map();R0.forEach(r=>{const k=bucketKey(A.dt(r),tp);g.set(k,(g.get(k)||0)+A.M[mt](r))});let ks=[...g.keys()].sort();if(tp==='d'&&ks.length>20)ks=ks.slice(-20);const vs=ks.map(k=>g.get(k)),sm=vs.reduce((a,b)=>a+b,0),pico=ks[vs.indexOf(Math.max(...vs))];
    let pm=null;if(tp==='m'&&dom==='refugo'&&!P.filters.length&&mt==='kg'){try{pm=new Map(refPorMes(per).map(x=>[x.d,x.pct]))}catch(e){}}
    const L2=['Evolução '+(tp==='m'?'por mês':tp==='s'?'por semana':'por dia')+': total '+mTxt(mt,sm)+', média de '+mTxt(mt,sm/ks.length)+' por '+(tp==='m'?'mês':tp==='s'?'semana':'dia')+'; pico em '+bucketLbl(pico,tp)+' ('+mTxt(mt,Math.max(...vs))+').'];
    if(vs.length>=6){const h=Math.floor(vs.length/2),a=vs.slice(0,h).reduce((x,y)=>x+y,0)/h,b=vs.slice(h).reduce((x,y)=>x+y,0)/(vs.length-h);if(a)L2.push('Tendência: a 2ª metade do período está '+pc(Math.abs((b-a)/a*100))+(b>=a?' acima':' abaixo')+' da 1ª metade.')}
    if(pm){const cp=ks.filter(k=>pm.get(k)!=null);if(cp.length)L2.push('% de refugo da Fundição: '+cp.map(k=>bucketLbl(k,tp)+' '+pc(pm.get(k))).join(' • ')+'.')}
    return finish(L2.concat([{chart:'cols',t:cap(A.nome)+' — '+(mt==='kg'?'kg':mt==='q'?'peças':'lançamentos'),cor:'#ff6a1f',items:ks.map(k=>({l:bucketLbl(k,tp),v:g.get(k),txt:mt==='kg'?fmt(Math.round(g.get(k))):fmt(Math.round(g.get(k)))}))}]),['E a projeção do mês?','E por cliente?','E por motivo?','E comparando com o mês passado?'])}
  if(op==='ultima'||op==='primeira'){const s=[...R0].sort((x,y)=>A.dt(x)<A.dt(y)?-1:1),r=op==='ultima'?s[s.length-1]:s[0],d=A.dt(r),n=R0.filter(x=>A.dt(x)===d).length;return finish([(op==='ultima'?'Última':'Primeira')+' ocorrência'+(fdesc?' de '+fdesc:'')+' no período: '+D(d)+' ('+n+' lançamento(s) nesse dia).',rowTxt(A,r)],['E a evolução por mês?','E por cliente?'])}
  if(op==='pesados'){const t=[...R0].sort((x,y)=>(A.M.kg||A.M.q)(y)-(A.M.kg||A.M.q)(x)).slice(0,P.n>3?P.n:5);return finish(['Lançamentos mais pesados:'].concat(t.map((r,i)=>(i+1)+'. '+rowTxt(A,r))),['E por cliente?','E a evolução por mês?'])}
  if(op==='recor'){const g=agrega(A,R0,A.F.peca,mt).filter(o=>o.dates.size>=3).sort((x,y)=>y.dates.size-x.dates.size).slice(0,5);return finish(g.length?['Itens recorrentes (3+ dias diferentes):'].concat(g.map((o,i)=>(i+1)+'. '+o.k+': '+o.dates.size+' dias • '+mTxt(mt,o.v))):['Nenhum item apareceu em 3 ou mais dias diferentes nesse recorte.'],['E por motivo?','E a evolução por mês?'])}
  if(op==='distintos'){const dm=P.dim||dims[0]||'cliente',g=agrega(A,R0,A.F[dm]||A.F.cliente,mt).sort((x,y)=>y.v-x.v);return finish(['Há '+g.length+' '+DIMN[dm]+'(s) diferentes no recorte, somando '+totTxt(A,T)+'.',barsC('Principais '+DIMN[dm]+'s',g.slice(0,5),mt,tv)],['E por motivo?','E a evolução por mês?'])}
  if(op==='media'){const dias=new Set(R0.map(A.dt)).size,meses=new Set(R0.map(r=>A.dt(r).slice(0,7))).size;return finish(['Média por dia com registro ('+dias+' dias): '+mTxt(mt,tv/dias)+'. Média por mês ('+meses+' mês(es)): '+mTxt(mt,tv/meses)+'.'],['E a evolução por mês?','E a projeção do mês?'])}
  if(op==='rank'){const dm=P.dim,fn=A.F[dm];if(!fn)return finish(['Não tenho “'+DIMN[dm]+'” em '+A.nome+'s. Tente cliente, motivo, peça'+(A.F.setor?', setor':'')+(A.F.material?', material':'')+'.'],['E por cliente?','E por motivo?']);
    const asc=/\b(menos|menor|menores|melhor|melhores)\b/.test(q),g=agrega(A,R0,fn,mt).sort((x,y)=>asc?x.v-y.v:y.v-x.v),N2=Math.min(g.length,P.n||3),top1=g[0];
    const L2=[cap(DIMN[dm])+' com '+(asc?'menos':'mais')+' '+A.nome+': '+top1.k+' ('+mTxt(mt,top1.v)+', '+pc(tv?top1.v/tv*100:0)+' do total).'];if(g.length>1)L2.push('Total no recorte: '+totTxt(A,T)+' em '+g.length+' '+DIMN[dm]+'(s).');
    return finish(L2.concat([barsC((asc?'Menores ':'Maiores ')+DIMN[dm]+'s',g.slice(0,Math.max(N2,3)),mt,tv)]),sg(dm!=='cliente'&&'E por cliente?',dm!=='motivo'&&'E por motivo?','E a evolução por mês?','E comparando com o mês passado?'))}
  /* total */
  const dm=P.filters.some(x=>dimDe(x.f)==='motivo')?'cliente':'motivo',g=agrega(A,R0,A.F[dm]||A.F.motivo,mt).sort((x,y)=>y.v-x.v);
  const L2=[cap(A.nome)+(fdesc?' ('+fdesc+')':'')+': '+totTxt(A,T)+'.'];if(g.length>1)L2.push('Principal '+DIMN[dm]+': '+g[0].k+' ('+mTxt(mt,g[0].v)+', '+pc(tv?g[0].v/tv*100:0)+').');
  return finish(L2.concat(g.length>1?[barsC('Por '+DIMN[dm],g.slice(0,5),mt,tv)]:[]),sg('E a evolução por mês?','E comparando com o mês passado?',dm!=='cliente'&&'E por cliente?',dm!=='motivo'&&'E por motivo?'))
}
function responder(q0){
  const q=N(q0),pag=paginaAtual(),L=ULT.last;ULT.sug=[];
  if(/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|help|o que (voce|vc) faz|como (funciona|usar))/.test(q.trim()))return['Sou o assistente do Controle de Refugos. Respondo sobre refugos, devoluções, retrabalhos, forno/boletim e produção, com os dados que estão no app.','Você pode combinar filtros (cliente, motivo, peça, planta, material, período), comparar períodos, pedir evolução por dia/semana/mês, projeção do mês e continuar a conversa (“e em setembro?”, “e por cliente?”).','Exemplos: “quanto o cliente ACME refugou por porosidade em outubro?”, “compare outubro com setembro”, “evolução de devoluções por mês”, “quais retrabalhos estão abertos?”, “resumo geral”.'];
  if(/resumo geral|visao geral do site|como estamos|panorama/.test(q)&&!/devol|retrabal|forno|refug/.test(q))return resumoGeral();
  const strong=/devol|fq051|reclamac/.test(q)?'devol':/retrabal/.test(q)?'retrab':/forno|lingote|respingo|gota|carga fria|panela|boletim|corrida|fusao|rendimento|perda na/.test(q)?'forno':/refug/.test(q)?'refugo':null;
  const nw=W(q0).split(' ').length,cont=!strong&&!!L&&(/^(e|agora|tambem|so|apenas|mesmo|desse|dele|nele|dela)\b/.test(q.trim())||(nw<=3&&!detOp(q)));
  let dom=strong||(cont?L.dom:null);
  if(!dom){const weak=/motivo|cliente|peca|produto|planta|usinagem|fundicao|responsavel|setor|meta|etiqueta|causa|material/.test(q);dom=pag==='forno'?(/material/.test(q)||!weak?'forno':'refugo'):pag}
  if(dom==='forno'){let q1=q0;if(cont&&L&&L.dom==='forno'&&ULT.fq)q1=q0+' '+ULT.fq.replace(new RegExp('\\b('+MESES.join('|')+')\\b','gi'),'');ULT.fq=q1;ULT.last={dom:'forno'};ULT.sug=['Qual o pior dia?','Quanto de lingote no mês?','Resumo do forno'];return asstPergunta(q1)}
  return motor(dom,q0,!!strong,cont)}
function resumoGeral(){
  const L=['Panorama geral (período mais recente de cada área):'],add=(t,R)=>{L.push(t+' '+R.resumo.slice(0,2).join(' '));if(R.alertas[0]&&!/^Nada fora|^Não há/.test(R.alertas[0]))L.push('   ⚠ '+R.alertas[0])};
  const pr=d=>{const u=ultDe(d);return periodo('',u)};add('🧱 Refugos:',refAnalise(pr('refugo')));add('↩ Devoluções:',devAnalise(pr('devol')));add('🔧 Retrabalhos:',rtAnalise(pr('retrab')));add('🔥 Forno:',fornoAnalise());return L}
/* ---------- interface ---------- */
const CHIPS={refugo:['Principal motivo de refugo','Compare este mês com o mês passado','Evolução do refugo por mês','Refugo da Fundição vs meta','Projeção do mês','O que posso melhorar?'],devol:['Qual cliente mais devolveu?','Evolução das devoluções por mês','Devoluções aguardando análise','Compare este mês com o mês passado'],retrab:['Retrabalhos abertos','Principais motivos de retrabalho','Evolução dos retrabalhos por mês','Compare este mês com o mês passado'],forno:['Qual material perdeu mais?','Qual o pior dia?','Quanto de lingote no mês?','Resumo do forno']};
const TITULO={refugo:'Refugos',devol:'Devoluções',retrab:'Retrabalhos',forno:'Forno e produção'};
function css(){if(document.getElementById('asstGCss'))return;const s=document.createElement('style');s.id='asstGCss';
  s.textContent='@keyframes asstUp{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}@keyframes asstPulse{0%,100%{box-shadow:0 4px 14px #0006,0 0 0 0 rgba(255,106,31,.55)}60%{box-shadow:0 4px 14px #0006,0 0 0 12px rgba(255,106,31,0)}}'+
  '#asstFab{position:fixed;right:18px;bottom:18px;z-index:9990;width:54px;height:54px;border-radius:50%;border:0;background:linear-gradient(135deg,#ff6a1f,#ff9d4d);color:#fff;font-size:26px;cursor:pointer;animation:asstPulse 2.6s infinite;transition:transform .15s}#asstFab:hover{transform:scale(1.08)}#asstFab:active{transform:scale(.94)}'+
  '#asstPanel{position:fixed;right:18px;bottom:84px;z-index:9991;width:min(410px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 110px));display:none;flex-direction:column;border-radius:16px;border:1px solid rgba(136,136,136,.35);box-shadow:0 12px 40px #0008;background:#1b232c;color:#eef2f6;font-size:14px;overflow:hidden}#asstPanel.on{display:flex;animation:asstUp .28s cubic-bezier(.2,.7,.2,1) both}'+
  ':root[data-theme="light"] #asstPanel{background:#fff;color:#18222c}#asstPanel .ah{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(135deg,#ff6a1f,#ff9d4d);color:#fff;font-weight:800}#asstPanel .ah span{flex:1}#asstPanel .ah button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}'+
  '#asstLog{flex:1;overflow:auto;padding:10px 12px}#asstLog .am{margin:6px 0;padding:8px 10px;border-radius:12px;line-height:1.45;animation:rFade .3s ease both}#asstLog .u{background:rgba(255,106,31,.18);margin-left:34px;border-bottom-right-radius:4px}#asstLog .b{background:rgba(136,136,136,.16);margin-right:12px;border-bottom-left-radius:4px}'+
  '#asstChips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}#asstChips button{font-size:12px;padding:4px 10px;border-radius:99px;border:1px solid rgba(255,106,31,.6);background:transparent;color:inherit;cursor:pointer}#asstChips button:hover{background:rgba(255,106,31,.2)}'+
  '#asstPanel form{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(136,136,136,.3)}#asstPanel form input{flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid rgba(136,136,136,.45);background:transparent;color:inherit;font-size:14px}#asstPanel form button{border:0;border-radius:10px;padding:0 14px;background:#ff6a1f;color:#fff;font-weight:800;cursor:pointer}'+
  '@media (max-width:640px){#asstFab{bottom:74px}#asstPanel{right:8px;left:8px;width:auto;bottom:138px;max-height:calc(100vh - 170px)}}@media print{#asstFab,#asstPanel{display:none!important}}html.gate-on #asstFab,html.gate-on #asstPanel{display:none!important}@media (prefers-reduced-motion:reduce){#asstFab,#asstPanel.on,#asstLog .am{animation:none!important}}';
  document.head.appendChild(s)}
function chartHtml(c){
  const cor=c.cor||'#ff6a1f',it=c.items||[];if(!it.length)return'<div></div>';const mx=Math.max(1,...it.map(x=>x.v));
  if(c.chart==='cols'){const n=it.length,W0=380,H0=140,bw=Math.min(28,(W0-20)/n*.7),st=(W0-20)/n;let sv='<svg viewBox="0 0 '+W0+' '+H0+'" style="width:100%;height:auto" role="img">';
    it.forEach((x,i)=>{const h=x.v/mx*90,xx=10+i*st+(st-bw)/2,y=110-h;sv+='<rect class="rA" x="'+xx.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(h,1.5).toFixed(1)+'" rx="2" fill="'+cor+'" style="--d:'+(i*0.03).toFixed(2)+'s"><title>'+esc(x.l)+': '+esc(x.txt)+'</title></rect>';
      if(n<=12)sv+='<text class="rT" style="--d:'+(i*0.03).toFixed(2)+'s" x="'+(xx+bw/2).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="700" fill="'+cor+'">'+esc(x.txt)+'</text>';
      if(n<=14||i%2===0)sv+='<text x="'+(xx+bw/2).toFixed(1)+'" y="126" text-anchor="middle" font-size="'+(n>14?7:9)+'" fill="currentColor" fill-opacity=".8">'+esc(x.l)+'</text>'});
    return'<div style="margin-top:8px"><div class="small" style="font-weight:700">'+esc(c.t||'')+'</div>'+sv+'</svg></div>'}
  return'<div style="margin-top:8px"><div class="small" style="font-weight:700;margin-bottom:2px">'+esc(c.t||'')+'</div>'+it.map((x,i)=>'<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><span title="'+esc(x.l)+'" style="flex:0 0 34%;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.l)+'</span><div style="flex:1;height:12px;background:rgba(136,136,136,.2);border-radius:4px;overflow:hidden"><span class="rW" style="width:'+Math.max(2,x.v/mx*100).toFixed(1)+'%;background:'+cor+';--d:'+(i*0.07).toFixed(2)+'s"></span></div><b style="font-size:11px;white-space:nowrap">'+esc(x.txt)+'</b></div>').join('')+'</div>'}
function msg(items,cls){const lg=document.getElementById('asstLog'),d=document.createElement('div');d.className='am '+cls;
  if(Array.isArray(items)){const tx=items.filter(x=>typeof x==='string'),ch=items.filter(x=>x&&typeof x==='object');lg.appendChild(d);asstDigitar(d,tx);
    if(ch.length)setTimeout(()=>{ch.forEach(c=>{const h=document.createElement('div');h.innerHTML=chartHtml(c);d.appendChild(h.firstChild)});lg.scrollTop=lg.scrollHeight},Math.min(1800,tx.join('').length*4));
    let k=0;const iv=setInterval(()=>{lg.scrollTop=lg.scrollHeight;if(++k>40)clearInterval(iv)},100)}
  else{d.textContent=items;lg.appendChild(d)}lg.scrollTop=lg.scrollHeight}
function chipsSug(list){const el=document.getElementById('asstChips');if(!el)return;el.innerHTML=list.map(t=>'<button type="button">'+t+'</button>').join('');el.querySelectorAll('button').forEach(b=>b.onclick=()=>enviar(b.textContent))}
function chips(){const dom=paginaAtual(),el=document.getElementById('asstChips');el.innerHTML=(CHIPS[dom]||CHIPS.refugo).concat(['Resumo geral']).map(t=>'<button type="button">'+t+'</button>').join('');el.querySelectorAll('button').forEach(b=>b.onclick=()=>enviar(b.textContent));document.getElementById('asstCtx').textContent=TITULO[dom]}
function enviar(t){t=String(t||'').trim();if(!t)return;msg(t,'u');let r;try{r=responder(t)}catch(e){console.error(e);r=['Tive um problema ao analisar essa pergunta. Tente reformular.']}msg(r.filter(Boolean),'b');if(ULT.sug&&ULT.sug.length)chipsSug(ULT.sug)}
function abrir(){const pn=document.getElementById('asstPanel');if(!pn.classList.contains('on')){pn.classList.add('on');chips();if(!document.getElementById('asstLog').children.length)msg(['Olá! Sou o assistente do site. Pergunte sobre refugos, devoluções, retrabalhos, forno ou produção — ou toque em uma sugestão abaixo.'],'b');setTimeout(()=>document.getElementById('asstGq').focus(),50)}else pn.classList.remove('on')}
function montar(){if(document.getElementById('asstFab'))return;css();
  const b=document.createElement('button');b.id='asstFab';b.type='button';b.title='Assistente';b.setAttribute('aria-label','Abrir assistente');b.textContent='🤖';b.onclick=abrir;
  const p=document.createElement('div');p.id='asstPanel';p.setAttribute('role','dialog');p.innerHTML='<div class="ah">🤖<span>Assistente <small id="asstCtx" style="font-weight:400;opacity:.9"></small></span><button type="button" id="asstX" aria-label="Fechar">✕</button></div><div id="asstLog"></div><div id="asstChips"></div><form id="asstForm"><input id="asstGq" type="text" placeholder="Pergunte algo sobre o site…" autocomplete="off"><button type="submit">➤</button></form>';
  document.body.appendChild(p);document.body.appendChild(b);
  document.getElementById('asstX').onclick=()=>p.classList.remove('on');
  document.getElementById('asstForm').onsubmit=e=>{e.preventDefault();const i=document.getElementById('asstGq');enviar(i.value);i.value=''};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')p.classList.remove('on')});
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.tab,[data-page]')&&p.classList.contains('on'))setTimeout(chips,50)})}
window.asstResponder=responder;window.asstAbrir=abrir;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar);else montar();
})();

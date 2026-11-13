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
function refPergunta(q,p){
  const rows=refRows(p),n=p.nota+' ';if(!rows.length)return[n+'Não encontrei lançamentos de refugo nesse período.'];
  const T=refTot(rows),has=r=>r.test(q),g=(fn,t)=>[n+t].concat(top(grp(rows,fn),T.kg,has(/\b(5|cinco)\b/)?5:3));
  if(has(/sugest|acao|acoes|melhorar|reduzir|o que fazer|recomend/))return[n].concat(refAnalise(p).acoes);
  if(has(/alerta|anomal|fora do (normal|padrao)|problema|atencao/))return[n].concat(refAnalise(p).alertas);
  if(has(/resumo|visao geral|como (estamos|foi|esta)/))return[n].concat(refAnalise(p).resumo);
  if(has(/por mes|mensal|evolucao|mes a mes|pior mes|melhor mes|mes (mais|com)/)){const m=refPorMes(p);if(has(/pior|mais|maior/)){const x=[...m].sort((a,b)=>b.kg-a.kg)[0];return[n+'Mês com mais refugo: '+NM[+x.d.slice(5)-1]+'/'+x.d.slice(2,4)+' com '+F(x.kg)+' kg'+(x.pct!=null?' ('+pc(x.pct)+' da produção da Fundição)':'')+'.']}
    if(has(/melhor|menos|menor/)){const x=[...m].sort((a,b)=>a.kg-b.kg)[0];return[n+'Mês com menos refugo: '+NM[+x.d.slice(5)-1]+'/'+x.d.slice(2,4)+' com '+F(x.kg)+' kg.']}
    return[n+'Refugo por mês:'].concat(m.map(x=>NM[+x.d.slice(5)-1]+'/'+x.d.slice(2,4)+': '+F(x.kg)+' kg'+(x.pct!=null?' • '+pc(x.pct)+' da produção':'')))}
  if(has(/meta|percentual|% |porcentagem|taxa/)){const m=refPorMes(p).filter(x=>x.pct!=null),mt=(typeof meta!=='undefined'&&meta.perc)||null;if(!m.length)return[n+'Para o % do refugo preciso de meses completos com produção lançada.'];const a=m.reduce((s,x)=>s+x.kgF,0),b=m.reduce((s,x)=>s+x.pr,0);return[n+'Refugo da Fundição: '+pc(a/b*100)+' da produção ('+F(a)+' kg de '+F(b)+' kg)'+(mt?', meta '+pc(mt)+(a/b*100>mt?' — acima da meta.':' — dentro da meta.'):'.')].concat(m.map(x=>NM[+x.d.slice(5)-1]+': '+pc(x.pct)))}
  if(has(/motivo|causa|defeito|por ?que|razao/))return g(motivoDescricao,'Principais motivos de refugo:');
  if(has(/cliente/))return g(r=>val(r,'cliente'),'Clientes com mais refugo:');
  if(has(/peca|produto|codigo|item/))return g(r=>(val(r,'codigo')+' '+val(r,'produto')).trim(),'Peças com mais refugo:');
  if(has(/planta|usinagem|fundicao/))return g(recordPlant,'Refugo por planta:');
  if(has(/responsavel|etiqueta|quem/))return g(r=>val(r,'responsavel'),'Responsáveis pelas etiquetas com mais refugo:');
  if(has(/setor|maquina/))return g(r=>val(r,'setor'),'Setores/máquinas com mais refugo:');
  if(has(/material|liga/))return g(r=>val(r,'material'),'Materiais com mais refugo:');
  if(has(/dia\b/)){const d=grp(rows,isoRef)[0];return[n+'Dia com mais refugo: '+D(d.k)+' com '+F(d.kg)+' kg ('+d.n+' lançamento(s)).']}
  return[n+'Refugo: '+F(T.kg)+' kg, '+fmt(T.q)+' peças em '+T.n+' lançamento(s).'].concat(top(grp(rows,motivoDescricao),T.kg,1).map(x=>'Principal motivo — '+x.slice(3)))
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
function devPergunta(q,p){
  const rows=devRows(p),n=p.nota+' ';if(!rows.length)return[n+'Não encontrei devoluções nesse período.'];const Q=rows.reduce((a,r)=>a+(+r.qtd||0),0),has=r=>r.test(q);
  if(has(/sugest|acao|acoes|melhorar|reduzir|o que fazer/))return[n].concat(devAnalise(p).acoes);if(has(/alerta|anomal|problema|atencao|pendente|aguardando/))return[n].concat(devAnalise(p).alertas);if(has(/resumo|visao geral|como/))return[n].concat(devAnalise(p).resumo);
  if(has(/cliente/))return[n+'Clientes com mais devoluções:'].concat(dTop(gd(rows,r=>r.cliente),Q));if(has(/motivo|causa|porque/))return[n+'Principais motivos de devolução:'].concat(dTop(gd(rows,r=>r.motivo),Q));
  if(has(/peca|produto|codigo/))return[n+'Peças mais devolvidas:'].concat(dTop(gd(rows,r=>(r.codigo||'')+' '+(r.produto||'')),Q));if(has(/situacao|disposicao|status/))return[n+'Situação das devoluções:'].concat(dTop(gd(rows,r=>r.disp),Q,5));
  return[n+rows.length+' item(ns) devolvido(s): '+fmt(Q)+' peças ('+F(rows.reduce((a,r)=>a+dKg(r),0))+' kg).']}
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
function rtPergunta(q,p){
  const rows=rtRows(p),n=p.nota+' ';if(!rows.length)return[n+'Não encontrei retrabalhos nesse período.'];const Q=rows.reduce((a,r)=>a+(+r.qtd||0),0),has=r=>r.test(q);
  if(has(/sugest|acao|acoes|melhorar|o que fazer/))return[n].concat(rtAnalise(p).acoes);if(has(/alerta|problema|atencao|parado|atrasad/))return[n].concat(rtAnalise(p).alertas);if(has(/resumo|visao geral|como/))return[n].concat(rtAnalise(p).resumo);
  if(has(/cliente/))return[n+'Clientes com mais retrabalho:'].concat(rTop(gr(rows,r=>r.cli),Q));if(has(/motivo|causa|porque/))return[n+'Principais motivos de retrabalho:'].concat(rTop(gr(rows,r=>r.mot),Q));
  if(has(/situacao|status|andamento|aberto/))return[n+'Situação dos retrabalhos:'].concat(rTop(gr(rows,r=>r.st),Q,5));
  return[n+rows.length+' retrabalho(s): '+fmt(Q)+' peças.']}
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
function responder(q0){
  const q=N(q0),pag=paginaAtual();
  if(/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|help|o que (voce|vc) faz|como (funciona|usar))/.test(q.trim()))return['Sou o assistente do Controle de Refugos. Respondo sobre refugos, devoluções, retrabalhos, forno/boletim e produção, sempre com os dados que estão no app.','Exemplos: “qual o principal motivo de refugo em outubro?”, “qual cliente mais devolveu?”, “quantos retrabalhos estão abertos?”, “qual material perdeu mais no forno?”, “resumo geral”.'];
  if(/resumo geral|visao geral do site|como estamos|panorama/.test(q)&&!/devol|retrabal|forno|refug/.test(q))return resumoGeral();
  const dom=dominio(q,pag);
  if(dom==='forno')return asstPergunta(q0);
  const ult=ultDe(dom),pr=periodo(q,ult),r=dom==='devol'?devPergunta(q,pr):dom==='retrab'?rtPergunta(q,pr):refPergunta(q,pr);return r}
function resumoGeral(){
  const L=['Panorama geral (período mais recente de cada área):'],add=(t,R)=>{L.push(t+' '+R.resumo.slice(0,2).join(' '));if(R.alertas[0]&&!/^Nada fora|^Não há/.test(R.alertas[0]))L.push('   ⚠ '+R.alertas[0])};
  const pr=d=>{const u=ultDe(d);return periodo('',u)};add('🧱 Refugos:',refAnalise(pr('refugo')));add('↩ Devoluções:',devAnalise(pr('devol')));add('🔧 Retrabalhos:',rtAnalise(pr('retrab')));add('🔥 Forno:',fornoAnalise());return L}
/* ---------- interface ---------- */
const CHIPS={refugo:['Principal motivo de refugo','Qual cliente mais refugou?','Refugo por mês','Refugo da Fundição vs meta','O que posso melhorar?'],devol:['Qual cliente mais devolveu?','Principais motivos de devolução','Devoluções pendentes','Resumo de devoluções'],retrab:['Retrabalhos abertos','Principais motivos de retrabalho','Qual cliente mais retrabalha?','Resumo de retrabalhos'],forno:['Qual material perdeu mais?','Qual o pior dia?','Quanto de lingote no mês?','Resumo do forno']};
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
function msg(txt,cls){const lg=document.getElementById('asstLog'),d=document.createElement('div');d.className='am '+cls;if(Array.isArray(txt)){lg.appendChild(d);asstDigitar(d,txt)}else{d.textContent=txt;lg.appendChild(d)}lg.scrollTop=lg.scrollHeight;
  if(Array.isArray(txt)){let k=0;const iv=setInterval(()=>{lg.scrollTop=lg.scrollHeight;if(++k>60)clearInterval(iv)},100)}}
function chips(){const dom=paginaAtual(),el=document.getElementById('asstChips');el.innerHTML=(CHIPS[dom]||CHIPS.refugo).concat(['Resumo geral']).map(t=>'<button type="button">'+t+'</button>').join('');el.querySelectorAll('button').forEach(b=>b.onclick=()=>enviar(b.textContent));document.getElementById('asstCtx').textContent=TITULO[dom]}
function enviar(t){t=String(t||'').trim();if(!t)return;msg(t,'u');let r;try{r=responder(t)}catch(e){console.error(e);r=['Tive um problema ao analisar essa pergunta. Tente reformular.']}msg(r.filter(Boolean),'b')}
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

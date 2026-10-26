window.__V=window.__V||{};window.__V.relatorios='v172';
/* ==================================================================
   RELATÓRIOS MENSAIS — Retrabalhos e Devoluções
   Mesmo formato do relatório mensal de refugos: gráficos com análise
   automática embaixo de cada um, textos editáveis, PDF e Excel.
   Só LÊ os dados dos módulos; os textos editados ficam por mês.
   Depende de gestao.js (gráficos, xlsx) — carregar depois dele.
   ================================================================== */
(function(){
const $=id=>document.getElementById(id);
const G=()=>window.__gestao||{};
const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const pc=v=>fmt(v)+'%';
const hm=m=>Math.floor(m/60)+'h '+('0'+Math.round(m%60)).slice(-2)+'min';
const okCusto=()=>{try{return costAccessAllowed()}catch(e){return false}};
const RS=v=>'R$ '+fmt(v);
const mesesDe=k=>[5,4,3,2,1,0].map(i=>G().addM(k,-i));
const isoMes=d=>String(d||'').slice(0,7);

/* ---------- utilidades de texto ---------- */
function rank(rows,key,val,lim){
  const m=new Map();
  rows.forEach(r=>{const k=String(key(r)||'').trim()||'Não informado';m.set(k,(m.get(k)||0)+val(r))});
  return [...m].map(([nome,v])=>({nome,v})).filter(e=>e.v>0).sort((a,b)=>b.v-a.v).slice(0,lim||999);
}
function txtRank(mes,L,total,unid,rotulo,fm){
  fm=fm||fmt;
  if(!total||!L.length)return '<p>Sem '+rotulo+' registrado em '+mes+'.</p>';
  const t=L[0];
  let s='<p>Em '+mes+', <b>'+esc(t.nome)+'</b> lidera '+rotulo+' com '+fm(t.v)+' '+unid+' ('+pc(t.v/total*100)+' do total de '+fm(total)+' '+unid+').';
  if(L.length>=3)s+=' Os 3 primeiros somam '+pc(sum(L.slice(0,3),e=>e.v)/total*100)+'.';
  s+='</p>';
  if(L.length>1)s+='<ul>'+L.slice(1,5).map(e=>'<li>'+esc(e.nome)+': '+fm(e.v)+' '+unid+' ('+pc(e.v/total*100)+')</li>').join('')+'</ul>';
  return s;
}
function varTxt(cur,prev,mesP,unid){
  if(!(prev>0))return '';
  const v=(cur-prev)/prev*100;
  return ' Em relação a '+mesP+' ('+fmt(prev)+' '+unid+') houve '+(v<0?'redução':'aumento')+' de '+pc(Math.abs(v))+'.';
}
const barras=(L,f)=>L.length?G().imgBar(L.map(e=>e.nome.length>34?e.nome.slice(0,33)+'…':e.nome),L.map(e=>e.v),{f:f||(v=>String(Math.round(v)))}):null;
function tabela(cab,linhas){
  return '<table class="tb"><thead><tr>'+cab.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+
    (linhas.map(l=>'<tr>'+l.map((c,i)=>'<td'+(i>0&&typeof c==='number'?' class="n"':'')+'>'+(typeof c==='number'?fmt(c):esc(c))+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+cab.length+'">Sem dados.</td></tr>')+'</tbody></table>';
}

/* ---------- RETRABALHOS ---------- */
function rtDados(){return (typeof rtLoad==='function'?rtLoad():[]).filter(r=>r.dt)}
function rtSecoes(k){
  const A=rtDados(),rows=A.filter(r=>isoMes(r.dt)===k),pk=G().addM(k,-1),prev=A.filter(r=>isoMes(r.dt)===pk),mes=G().mesExt(k),mesP=G().mesExt(pk);
  const q=r=>N(r.qtd),tq=sum(rows,q),pq=sum(prev,q);
  const ok=sum(rows,r=>N(r.qOk)),rf=sum(rows,r=>N(r.qRef));
  const dp=rows.filter(r=>rtMpp(r)!=null),dMin=sum(dp,r=>rtDur(r)),dPc=sum(dp,r=>rtPecasTrab(r));
  const abertas=rows.filter(r=>r.st!==RT_ST[2]),atras=abertas.filter(r=>rtAge(r)>3);
  const secs=[];
  /* 1 evolução + resumo */
  const ms=mesesDe(k),ev=ms.map(m=>({nome:G().lblM(m),v:sum(A.filter(r=>isoMes(r.dt)===m),q)}));
  let t1='<p>Em '+mes+' foram emitidas <b>'+fmt(rows.length)+'</b> etiqueta(s) de retrabalho, somando <b>'+fmt(tq)+'</b> peças ('+fmt(sum(rows,r=>rtKg(r)))+' kg, peso '+({bruto:'bruto fracionado',liquido:'líquido Fund. / bruto Usin.',usinado:'usinado'})[rtPT()]+').'+varTxt(tq,pq,mesP,'peças');
  if(ok+rf>0)t1+=' Das peças com resultado informado, <b>'+pc(ok/(ok+rf)*100)+'</b> foram recuperadas ('+fmt(ok)+') e '+pc(rf/(ok+rf)*100)+' foram refugadas no retrabalho ('+fmt(rf)+').';
  if(dp.length)t1+=' O tempo médio de retrabalho foi de <b>'+fmt(dMin/dPc)+' min por peça</b> ('+dp.length+' etiqueta(s) com horário, '+hm(dMin)+' no total).';
  if(abertas.length)t1+=' '+abertas.length+' etiqueta(s) seguem abertas'+(atras.length?', sendo '+atras.length+' com mais de 3 dias':'')+'.';
  t1+='</p>';
  secs.push({t:'Peças em retrabalho — últimos 6 meses.',img:barras(ev),txt:rows.length?t1:'<p>Nenhum retrabalho emitido em '+mes+'.</p>'});
  /* 2-6 rankings */
  const rk=(titulo,key,rotulo,lim)=>{const L=rank(rows,key,q,lim||12);secs.push({t:titulo,img:barras(L),txt:txtRank(mes,L,tq,'peças',rotulo)})};
  rk('Total de peças em retrabalho por motivo.',r=>(r.mot||'').slice(0,70),'o retrabalho por motivo',15);
  rk('Total de peças em retrabalho por cliente.',r=>r.cli,'o retrabalho por cliente');
  rk('Total de peças em retrabalho por item.',r=>(r.cod?r.cod+' - ':'')+(r.prod||''),'o retrabalho por item',15);
  rk('Total de peças em retrabalho por setor / máquina.',r=>r.setor?setorTxt(r.setor):'Não informado','o retrabalho por setor / máquina',15);
  rk('Total de peças em retrabalho por tipo de máquina.',r=>r.setor?(setorTipo(r.setor)||r.setor):'Não informado','o retrabalho por tipo de máquina');
  /* 7-9 tempo */
  const tempoPor=(key)=>{const m=new Map();dp.forEach(r=>{const k2=String(key(r)||'').trim()||'Não informado',e=m.get(k2)||{min:0,pc:0,n:0};e.min+=rtDur(r);e.pc+=rtPecasTrab(r);e.n++;m.set(k2,e)});return [...m].map(([nome,e])=>({nome,min:e.min,pc:e.pc,n:e.n,mpp:e.min/e.pc}))};
  const bySet=tempoPor(r=>r.setor?setorTxt(r.setor):'Não informado');
  const Ltot=bySet.map(e=>({nome:e.nome,v:e.min/60})).sort((a,b)=>b.v-a.v).slice(0,12);
  let t7='';
  if(!Ltot.length)t7='<p>Nenhuma etiqueta com hora inicial e final preenchida em '+mes+'.</p>';
  else t7='<p>O setor/máquina que mais consumiu tempo de retrabalho foi <b>'+esc(Ltot[0].nome)+'</b>, com <b>'+fmt(Ltot[0].v)+' h</b> ('+pc(Ltot[0].v/sum(Ltot,e=>e.v)*100)+' das horas registradas). No total foram '+hm(dMin)+' em '+dp.length+' etiqueta(s) com horário.</p>';
  secs.push({t:'Tempo total de retrabalho por setor / máquina (horas).',img:Ltot.length?barras(Ltot,v=>String(Math.round(v*10)/10).replace('.',',')):null,txt:t7});
  const Lmpp=bySet.map(e=>({nome:e.nome,v:e.mpp})).sort((a,b)=>b.v-a.v).slice(0,12);
  secs.push({t:'Tempo de retrabalho por peça em cada setor / máquina (min/peça).',img:Lmpp.length?barras(Lmpp,v=>String(Math.round(v*10)/10).replace('.',',')):null,
    txt:Lmpp.length?'<p>O retrabalho mais lento por peça foi em <b>'+esc(Lmpp[0].nome)+'</b> ('+fmt(Lmpp[0].v)+' min/peça)'+(Lmpp.length>1?' e o mais rápido em '+esc(Lmpp[Lmpp.length-1].nome)+' ('+fmt(Lmpp[Lmpp.length-1].v)+' min/peça)':'')+'. Média geral: '+fmt(dMin/dPc)+' min/peça.</p>':'<p>Sem etiquetas com horário preenchido.</p>'});
  const byIt=tempoPor(r=>(r.cod?r.cod+' - ':'')+(r.prod||'')).sort((a,b)=>b.min-a.min).slice(0,10);
  secs.push({t:'Tempo de retrabalho por item (maiores consumos).',img:byIt.length?barras(byIt.map(e=>({nome:e.nome,v:e.min/60})),v=>String(Math.round(v*10)/10).replace('.',',')):null,
    pre:byIt.length?tabela(['Item','Etiquetas','Peças','Tempo total','Min/peça'],byIt.map(e=>[e.nome,e.n,e.pc,hm(e.min),Math.round(e.mpp*10)/10])):'',
    txt:byIt.length?'<p>O item que mais consumiu tempo de retrabalho foi <b>'+esc(byIt[0].nome)+'</b> ('+hm(byIt[0].min)+', '+fmt(byIt[0].mpp)+' min por peça).</p>':'<p>Sem dados de tempo por item.</p>'});
  /* 10 resultado */
  const sem=Math.max(0,tq-ok-rf),Lr=[{nome:'Recuperadas (OK)',v:ok},{nome:'Refugadas no retrabalho',v:rf},{nome:'Sem resultado informado',v:sem}];
  secs.push({t:'Resultado do retrabalho (peças).',img:tq?barras(Lr):null,txt:tq?'<p>De '+fmt(tq)+' peças em retrabalho, '+fmt(ok)+' foram recuperadas ('+pc(ok/tq*100)+'), '+fmt(rf)+' viraram refugo ('+pc(rf/tq*100)+') e '+fmt(sem)+' ainda não têm resultado informado.</p>':'<p>Sem retrabalho no mês.</p>'});
  /* 11 retrabalho x refugo */
  let rfg=0;try{const y=+k.slice(0,4),m=+k.slice(5,7);(Array.isArray(data)?data:[]).forEach(r=>{if(recordYear(r)===y&&recordMonth(r)===m)rfg+=qty(r)||0})}catch(e){}
  secs.push({t:'Retrabalho × refugo (peças no mês).',img:(tq+rfg)?barras([{nome:'Retrabalho',v:tq},{nome:'Refugo',v:rfg}]):null,
    txt:(tq+rfg)?'<p>Entre as peças com problema em '+mes+', <b>'+pc(tq/(tq+rfg)*100)+'</b> foram para retrabalho ('+fmt(tq)+') e <b>'+pc(rfg/(tq+rfg)*100)+'</b> viraram refugo ('+fmt(rfg)+').</p>':'<p>Sem peças com problema registradas no mês.</p>'});
  /* 12 abertas */
  const ab=abertas.slice().sort((a,b)=>rtAge(b)-rtAge(a)).slice(0,12);
  secs.push({t:'Etiquetas abertas e atrasadas.',pre:ab.length?tabela(['Item','Cliente','Setor / máquina','Qtd.','Status','Idade (dias)'],ab.map(r=>[(r.cod?r.cod+' - ':'')+(r.prod||''),r.cli||'',r.setor?setorTxt(r.setor):'—',N(r.qtd),r.st,rtAge(r)])):'',
    txt:abertas.length?'<p>'+abertas.length+' etiqueta(s) emitida(s) em '+mes+' ainda não foram concluídas'+(atras.length?'; '+atras.length+' estão há mais de 3 dias em aberto e merecem atenção':'')+'.</p>':'<p>Todas as etiquetas emitidas em '+mes+' foram concluídas.</p>'});
  return secs;
}
function rtSheets(k){
  const A=rtDados(),rows=A.filter(r=>isoMes(r.dt)===k),q=r=>N(r.qtd);
  const mpp=r=>rtMpp(r)==null?'':Math.round(rtMpp(r)*100)/100;
  const ag=(key)=>[['Item','Peças','Etiquetas'],...rank(rows,key,q).map(e=>[e.nome,e.v,rows.filter(r=>(String(key(r)||'').trim()||'Não informado')===e.nome).length])];
  return [
    {name:'Resumo',rows:[['Indicador','Valor'],['Mês',k],['Etiquetas',rows.length],['Peças em retrabalho',sum(rows,q)],['Peso bruto fracionado (kg)',Math.round(sum(rows,r=>rtKg(r,'bruto'))*100)/100],['Peso líquido (kg)',Math.round(sum(rows,r=>rtKg(r,'liquido'))*100)/100],['Peso usinado (kg)',Math.round(sum(rows,r=>rtKg(r,'usinado'))*100)/100],['Peças OK',sum(rows,r=>N(r.qOk))],['Peças refugadas no retrabalho',sum(rows,r=>N(r.qRef))],['Tempo total com horário (min)',sum(rows.filter(r=>rtDur(r)!=null),r=>rtDur(r))],['Etiquetas abertas',rows.filter(r=>r.st!==RT_ST[2]).length]]},
    {name:'Etiquetas',rows:[['Emissão','Cód. sistema','Cliente','Produto','OF','Qtd','Material','Setor','Tipo de máquina','Local/máquina','Motivo','Status','Início','Fim','Duração (min)','Min/peça','Peças OK','Peças refugadas','Kg bruto fracionado','Kg líquido','Kg usinado'],...rows.map(r=>[r.dt,r.cod||'',r.cli||'',r.prod||'',r.of||'',q(r),rtMatOf(r),r.setor||'',r.setor?(setorTipo(r.setor)||''):'',rtLocOf(r),r.mot||'',r.st,(r.di||'')+' '+(r.hi||''),(r.df||'')+' '+(r.hf||''),rtDur(r)==null?'':rtDur(r),mpp(r),N(r.qOk),N(r.qRef),rtKg(r,'bruto'),rtKg(r,'liquido'),rtKg(r,'usinado')])]},
    {name:'Por setor',rows:ag(r=>r.setor?setorTxt(r.setor):'Não informado')},
    {name:'Por item',rows:ag(r=>(r.cod?r.cod+' - ':'')+(r.prod||''))},
    {name:'Por motivo',rows:ag(r=>r.mot||'')},
    {name:'Por cliente',rows:ag(r=>r.cli||'')}
  ];
}

/* ---------- DEVOLUÇÕES ---------- */
const np=r=>r.procede==='Não'||r.disp==='Reclamação não procede';
function dvDados(){return (window.devDados?window.devDados():[]).filter(r=>r.data)}
const dvTipo=r=>(window.devTipo?window.devTipo(r):(r.tipo||'Fundição'));
function prodDe(k){try{return prodMonthTotals().get(k.slice(0,4)+'-'+Number(k.slice(5,7)))||0}catch(e){return 0}}
function dvSecoes(k){
  const A=dvDados(),rows=A.filter(r=>isoMes(r.data)===k),pk=G().addM(k,-1),prev=A.filter(r=>isoMes(r.data)===pk),mes=G().mesExt(k),mesP=G().mesExt(pk);
  const q=r=>N(r.qtd),kgv=r=>window.devKg?window.devKg(r):0;
  const proc=rows.filter(r=>!np(r)),procP=prev.filter(r=>!np(r)),nao=rows.filter(np);
  const regs=new Set(rows.map(r=>r.numFq?r.data+'|'+r.numFq+'|'+r.cliente:r.id)).size;
  const secs=[];
  /* 1 evolução por planta */
  const ms=mesesDe(k),lab=ms.map(m=>G().lblM(m));
  const serie=(t,cor)=>({name:t,cor,values:ms.map(m=>sum(A.filter(r=>isoMes(r.data)===m&&!np(r)&&dvTipo(r)===t),q))});
  const st=[serie('Fundição','#ED7D31'),serie('Usinagem','#1f5f99')];
  const tq=sum(proc,q),tkg=sum(proc,kgv),pq=sum(procP,q);
  let t1='<p>Em '+mes+' foram <b>'+fmt(regs)+'</b> registro(s) de devolução com <b>'+fmt(rows.length)+'</b> item(ns). Considerando só as reclamações que procedem: <b>'+fmt(tq)+'</b> peças e <b>'+fmt(tkg)+' kg</b>'+(okCusto()?' (valor estimado '+RS(sum(proc,r=>window.devValor?window.devValor(r):0))+')':'')+'.'+varTxt(tq,pq,mesP,'peças');
  if(nao.length)t1+=' Outras '+fmt(sum(nao,q))+' peças ('+fmt(nao.length)+' item(ns)) foram reclamações que <b>não procedem</b> e ficam fora do peso e dos gráficos abaixo.';
  t1+='</p>';
  secs.push({t:'Peças devolvidas por mês e por planta (só reclamações que procedem).',img:(st[0].values.concat(st[1].values).some(v=>v>0))?G().imgStack(lab,st):null,txt:rows.length?t1:'<p>Nenhuma devolução registrada em '+mes+'.</p>'});
  /* 2-7 por planta */
  [['Fundição','Metalúrgica'],['Usinagem','Metal']].forEach(([pl,nome])=>{
    const rp=proc.filter(r=>dvTipo(r)===pl),tp=sum(rp,q);
    const rk=(t,key,rot,lim)=>{const L=rank(rp,key,q,lim||12);secs.push({t:t+' '+nome+' ('+pl+').',img:barras(L),txt:txtRank(mes,L,tp,'peças',rot)})};
    rk('Peças devolvidas por cliente',r=>r.cliente,'as devoluções de '+pl.toLowerCase()+' por cliente');
    rk('Peças devolvidas por motivo',r=>(r.motivo||'').slice(0,70),'as devoluções de '+pl.toLowerCase()+' por motivo');
    rk('Peças devolvidas por item',r=>(r.codigo?r.codigo+' - ':'')+(r.produto||''),'as devoluções de '+pl.toLowerCase()+' por item',15);
  });
  /* 8 produção x devolução */
  const pF=ms.map(m=>{const pr=prodDe(m),kk=sum(A.filter(r=>isoMes(r.data)===m&&!np(r)&&dvTipo(r)==='Fundição'),kgv);return{m,pr,kk,p:pr?kk/pr*100:0}});
  const cur=pF[pF.length-1],pv=pF[pF.length-2];
  let t8;
  if(!cur.pr)t8='<p>Não há produção da Fundição lançada em '+mes+', então o comparativo com as devoluções não pôde ser calculado.</p>';
  else{t8='<p>Em '+mes+' a Fundição produziu <b>'+fmt(cur.pr)+' kg</b> e as devoluções procedentes somaram <b>'+fmt(cur.kk)+' kg</b>, ou seja, <b>'+pc(cur.p)+'</b> da produção.';if(pv&&pv.pr)t8+=' Em '+mesP+' foi '+pc(pv.p)+' ('+fmt(pv.kk)+' kg sobre '+fmt(pv.pr)+' kg produzidos), '+(cur.p<pv.p?'uma melhora':cur.p>pv.p?'uma piora':'o mesmo nível')+' de '+fmt(Math.abs(cur.p-pv.p))+' ponto(s) percentual(is).';t8+='</p>'}
  secs.push({t:'Produção × devolução da Fundição (% do peso produzido que foi devolvido).',img:pF.some(x=>x.p>0)?G().imgBar(pF.map(x=>G().lblM(x.m)),pF.map(x=>Math.round(x.p*100)/100),{f:v=>String(Math.round(v*100)/100).replace('.',',')+'%',leg:'% devolvido (Fundição)'}):null,
    pre:tabela(['Mês','Produção (kg)','Devolvido (kg)','% devolvido'],pF.map(x=>[G().lblM(x.m),x.pr,x.kk,x.pr?fmt(x.p)+'%':'—'])),txt:t8});
  /* 9 não procede */
  const Ln=rank(nao,r=>r.cliente,q,12),tn=sum(nao,q),tAll=sum(rows,q);
  const porCli=new Map();rows.forEach(r=>{const c=r.cliente||'Não informado',e=porCli.get(c)||{n:0,np:0};e.n++;if(np(r))e.np++;porCli.set(c,e)});
  secs.push({t:'Reclamações que não procedem — peças por cliente.',img:barras(Ln),
    pre:nao.length?tabela(['Cliente','Reclamações','Não procede','% improcedente'],[...porCli].filter(([c,e])=>e.np>0).sort((a,b)=>b[1].np-a[1].np).slice(0,10).map(([c,e])=>[c,e.n,e.np,Math.round(e.np/e.n*100)+'%'])):'',
    txt:nao.length?'<p>'+fmt(nao.length)+' item(ns) ('+fmt(tn)+' peças, '+pc(tAll?tn/tAll*100:0)+' das peças devolvidas no mês) foram classificados como <b>não procede</b>. O cliente com mais reclamações improcedentes foi <b>'+esc(Ln[0].nome)+'</b> ('+fmt(Ln[0].v)+' peças).</p>':'<p>Nenhuma reclamação classificada como "não procede" em '+mes+'.</p>'});
  /* 10 destino */
  const Ld=rank(rows,r=>r.disp||'Sem destino',q,10);
  secs.push({t:'Destino / disposição das peças devolvidas.',img:barras(Ld),txt:txtRank(mes,Ld,tAll,'peças','o destino das devoluções')});
  /* 11 aguardando */
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const aguard=A.filter(r=>(r.disp||'Aguardando análise')==='Aguardando análise'&&!np(r)).map(r=>({r,d:Math.max(0,Math.round((hoje-new Date(r.data+'T00:00:00'))/864e5))})).sort((a,b)=>b.d-a.d);
  secs.push({t:'Devoluções aguardando análise / destino (todas as datas).',pre:aguard.length?tabela(['Data','Cliente','Item','Qtd.','Planta','Dias em aberto'],aguard.slice(0,12).map(o=>[o.r.data.split('-').reverse().join('/'),o.r.cliente||'',(o.r.codigo?o.r.codigo+' - ':'')+(o.r.produto||''),N(o.r.qtd),dvTipo(o.r),o.d])):'',
    txt:aguard.length?'<p>Há <b>'+aguard.length+'</b> item(ns) de devolução sem destino definido; o mais antigo está há <b>'+aguard[0].d+' dias</b> em aberto.</p>':'<p>Nenhuma devolução aguardando análise.</p>'});
  /* 12 valor */
  if(okCusto()){
    const Lv=['Fundição','Usinagem'].map(pl=>({nome:pl,v:sum(proc.filter(r=>dvTipo(r)===pl),r=>window.devValor?window.devValor(r):0)})).filter(e=>e.v>0),tv=sum(Lv,e=>e.v);
    secs.push({t:'Valor estimado das devoluções por planta (R$).',img:Lv.length?barras(Lv,v=>String(Math.round(v))):null,txt:tv?'<p>O valor estimado das devoluções procedentes de '+mes+' é de <b>'+RS(tv)+'</b>. '+Lv.map(e=>esc(e.nome)+': '+RS(e.v)+' ('+pc(e.v/tv*100)+')').join('; ')+'.</p>':'<p>Sem valor de devolução no mês.</p>'});
  }
  return secs;
}
function dvSheets(k){
  const A=dvDados(),rows=A.filter(r=>isoMes(r.data)===k),q=r=>N(r.qtd),kgv=r=>window.devKg?window.devKg(r):0,proc=rows.filter(r=>!np(r));
  const ag=(base,key)=>[['Item','Peças','Kg (procedentes)'],...rank(base,key,q).map(e=>[e.nome,e.v,sum(base.filter(r=>(String(key(r)||'').trim()||'Não informado')===e.nome),kgv)])];
  return [
    {name:'Resumo',rows:[['Indicador','Valor'],['Mês',k],['Itens',rows.length],['Peças (todas)',sum(rows,q)],['Peças procedentes',sum(proc,q)],['Kg procedentes',sum(proc,kgv)],['Peças não procede',sum(rows.filter(np),q)],['Produção Fundição (kg)',prodDe(k)]]},
    {name:'Itens do mês',rows:[['Data','Planta','FQ','Cliente','Código','Produto','OF','Qtd','Peso unit. (kg)','Kg (procedente)','Motivo','Procede','Destino','NF'],...rows.map(r=>[r.data,dvTipo(r),r.numFq||'',r.cliente||'',r.codigo||'',r.produto||'',r.of||'',q(r),N(r.pesoUn),kgv(r),r.motivo||'',r.procede||'',r.disp||'',r.nf||''])]},
    {name:'Por cliente',rows:ag(proc,r=>r.cliente)},
    {name:'Por motivo',rows:ag(proc,r=>r.motivo)},
    {name:'Por item',rows:ag(proc,r=>(r.codigo?r.codigo+' - ':'')+(r.produto||''))},
    {name:'Não procede',rows:ag(rows.filter(np),r=>r.cliente)}
  ];
}

/* ---------- motor comum (HTML, edição, PDF, Excel) ---------- */
const CFG={
  rt:{titulo:'Relatório mensal de retrabalhos',sec:rtSecoes,sheets:rtSheets,arq:'relatorio-retrabalhos'},
  dv:{titulo:'Relatório mensal de devoluções',sec:dvSecoes,sheets:dvSheets,arq:'relatorio-devolucoes'}
};

/* ---------- VISÃO GERAL (refugo + retrabalho + devolução) ---------- */
function vgSecoes(k){
  const g=G(),R=g.refAll(),D=g.devAll().filter(r=>!np(r.raw)),RT=rtDados(),mes=g.mesExt(k),pk=g.addM(k,-1),mesP=g.mesExt(pk);
  const mm=g.metricasMes(k,R,D),mp=g.metricasMes(pk,R,D);
  const rtK=m=>RT.filter(r=>isoMes(r.dt)===m),dvK=m=>D.filter(r=>r.k===m),rfK=m=>R.filter(r=>r.k===m);
  const rtq=sum(rtK(k),r=>N(r.qtd)),rtqP=sum(rtK(pk),r=>N(r.qtd));
  const dp=rtK(k).filter(r=>rtMpp(r)!=null),mpp=dp.length?sum(dp,r=>rtDur(r))/sum(dp,r=>rtPecasTrab(r)):null;
  const dKg=sum(dvK(k),r=>r.kg),dKgP=sum(dvK(pk),r=>r.kg);
  const prod=mm.prod,devF=sum(dvK(k).filter(r=>r.tipo==='Fundição'),r=>r.kg),pDev=prod?devF/prod*100:null,pRef=mm.perc;
  const custo=okCusto(),rsTot=mm.rs+sum(dvK(k),r=>r.rs);
  const secs=[],ms=mesesDe(k),lab=ms.map(m=>g.lblM(m));
  const metaP=(typeof meta!=='undefined'&&meta&&meta.perc>0)?meta.perc:0;
  /* 1 resumo */
  const kp=[['Refugo (kg)',mm.kg,mp.kg],['Refugo Fundição (% da produção)',pRef==null?null:pRef,mp.perc],['Retrabalho (peças)',rtq,rtqP],['Devoluções procedentes (kg)',dKg,dKgP]];
  const tb=tabela(['Indicador',mes,mesP,'Variação'],kp.map(([n,a,b])=>[n,a==null?'—':fmt(a),b==null?'—':fmt(b),(a==null||!(b>0))?'—':(a>=b?'+':'−')+fmt(Math.abs((a-b)/b*100))+'%']));
  let t1='<p>Em '+mes+' a fábrica refugou <b>'+fmt(mm.kg)+' kg</b>'+(pRef!=null?' (<b>'+pc(pRef)+'</b> da produção da Fundição'+(metaP?', meta de '+pc(metaP)+' — '+(pRef>metaP?'<b>acima</b> da meta':'dentro da meta'):'')+')':'')+', teve <b>'+fmt(rtq)+' peças</b> em retrabalho'+(mpp!=null?' (média de '+fmt(mpp)+' min por peça)':'')+' e recebeu <b>'+fmt(dKg)+' kg</b> de devoluções procedentes'+(pDev!=null?' ('+pc(pDev)+' da produção da Fundição)':'')+'.';
  if(custo&&rsTot>0)t1+=' O custo estimado da não qualidade (refugo + devoluções) foi de <b>'+RS(rsTot)+'</b>.';
  t1+='</p>';
  secs.push({t:'Resumo executivo do mês.',pre:tb,txt:t1});
  /* 2 pontos de atenção */
  const at=[],last3=[2,1,0].map(i=>g.metricasMes(g.addM(k,-i),R,D));
  if(metaP&&pRef!=null&&pRef>metaP)at.push('O refugo da Fundição ('+pc(pRef)+') está acima da meta de '+pc(metaP)+'.');
  if(last3.every(x=>x.perc!=null)&&last3[0].perc<last3[1].perc&&last3[1].perc<last3[2].perc)at.push('O % de refugo da Fundição subiu nos últimos 3 meses seguidos ('+last3.map(x=>pc(x.perc)).join(' → ')+').');
  if(mp.kg>0&&mm.kg>mp.kg*1.2)at.push('O refugo em kg subiu '+pc((mm.kg-mp.kg)/mp.kg*100)+' em relação a '+mesP+'.');
  if(dKgP>0&&dKg>dKgP*1.2)at.push('As devoluções procedentes subiram '+pc((dKg-dKgP)/dKgP*100)+' em kg em relação a '+mesP+'.');
  const ab=RT.filter(r=>r.st!==RT_ST[2]&&rtAge(r)>3);if(ab.length)at.push(ab.length+' etiqueta(s) de retrabalho abertas há mais de 3 dias.');
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const pend=D.filter(r=>(r.disp||'Aguardando análise')==='Aguardando análise'&&r.data&&(hoje-new Date(r.data+'T00:00:00'))/864e5>15);
  if(pend.length)at.push(pend.length+' item(ns) de devolução aguardando destino há mais de 15 dias.');
  const todas=g.devAll().filter(r=>r.k===k),npt=todas.filter(r=>np(r.raw));if(todas.length>=5&&npt.length/todas.length>0.3)at.push('Mais de 30% das reclamações do mês ('+npt.length+' de '+todas.length+') foram classificadas como não procede.');
  const sc=rfK(k).filter(r=>!r.causa||r.causa==='Outros'||r.causa==='Sem causa');const tkR=sum(rfK(k),r=>r.kg);if(tkR>0&&sum(sc,r=>r.kg)/tkR>0.3)at.push(pc(sum(sc,r=>r.kg)/tkR*100)+' do refugo (kg) está sem causa definida ou em "Outros" — classifique os motivos por causa para melhorar a análise.');
  secs.push({t:'Pontos de atenção.',txt:at.length?'<ul>'+at.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'<p>Nenhum ponto crítico identificado automaticamente em '+mes+'.</p>'});
  /* 3 perda % produção */
  const ser=[{name:'Refugo Fundição (%)',cor:'#ED7D31',values:ms.map(m=>{const x=g.metricasMes(m,R,D);return x.perc==null?0:Math.round(x.perc*100)/100})},{name:'Devolução Fundição (%)',cor:'#1f5f99',values:ms.map(m=>{const pr=prodDe(m);return pr?Math.round(sum(dvK(m).filter(r=>r.tipo==='Fundição'),r=>r.kg)/pr*10000)/100:0})}];
  const tot=ser[0].values[5]+ser[1].values[5],totP=ser[0].values[4]+ser[1].values[4];
  secs.push({t:'Perda da Fundição como % da produção (refugo + devolução).',img:ser.some(x=>x.values.some(v=>v>0))?g.imgStack(lab,ser):null,
    txt:prod?'<p>Em '+mes+', refugo e devolução juntos representaram <b>'+pc(tot)+'</b> da produção da Fundição'+(totP>0?' (em '+mesP+' foram '+pc(totP)+', '+(tot<totP?'uma melhora':'uma piora')+' de '+fmt(Math.abs(tot-totP))+' p.p.)':'')+'. Refugo: '+pc(ser[0].values[5])+'; devolução: '+pc(ser[1].values[5])+'.</p>':'<p>Sem produção da Fundição lançada em '+mes+'.</p>'});
  /* 4-6 tendências */
  const tend=(t,vals,f,unid,txtF)=>{const a=vals[5],b=vals[4],med=sum(vals.slice(0,5),x=>x)/5;secs.push({t,img:vals.some(v=>v>0)?g.imgBar(lab,vals,{f}):null,txt:'<p>'+txtF+' Em '+mes+': <b>'+fmt(a)+' '+unid+'</b>'+(b>0?' ('+(a>=b?'+':'−')+pc(Math.abs((a-b)/b*100))+' vs '+mesP+')':'')+(med>0?'; média dos 5 meses anteriores: '+fmt(med)+' '+unid+'.':'.')+'</p>'})};
  tend('Refugo total por mês (kg).',ms.map(m=>Math.round(sum(rfK(m),r=>r.kg))),v=>String(Math.round(v)),'kg','Evolução do peso refugado.');
  tend('Retrabalho por mês (peças).',ms.map(m=>sum(rtK(m),r=>N(r.qtd))),v=>String(Math.round(v)),'peças','Evolução das peças em retrabalho.');
  tend('Devoluções procedentes por mês (kg).',ms.map(m=>Math.round(sum(dvK(m),r=>r.kg))),v=>String(Math.round(v)),'kg','Evolução do peso devolvido (só reclamações que procedem).');
  /* 7 causas */
  const Lc=rank(rfK(k),r=>r.causa||'Sem causa',r=>r.kg,10).map(e=>({nome:e.nome,v:Math.round(e.v)}));
  secs.push({t:'Refugo por causa do motivo (kg).',img:barras(Lc),txt:txtRank(mes,Lc,sum(Lc,e=>e.v),'kg','o refugo por causa')});
  /* 8 clientes críticos */
  const cl=new Map(),ac=(c,f,v)=>{const key=String(c||'').trim()||'Não informado',e=cl.get(key)||{rk:0,dk:0,rq:0};e[f]+=v;cl.set(key,e)};
  rfK(k).forEach(r=>ac(r.cli,'rk',r.kg));dvK(k).forEach(r=>ac(r.cli,'dk',r.kg));rtK(k).forEach(r=>ac(r.cli,'rq',N(r.qtd)));
  const Lcl=[...cl].map(([n,e])=>({nome:n,...e,v:e.rk+e.dk})).sort((a,b)=>b.v-a.v).slice(0,10);
  secs.push({t:'Clientes com maior impacto (refugo + devolução, kg).',img:barras(Lcl.map(e=>({nome:e.nome,v:Math.round(e.v)}))),pre:Lcl.length?tabela(['Cliente','Refugo (kg)','Devolução (kg)','Retrabalho (peças)'],Lcl.map(e=>[e.nome,Math.round(e.rk),Math.round(e.dk),e.rq])):'',
    txt:Lcl.length?'<p>O cliente com maior impacto em '+mes+' foi <b>'+esc(Lcl[0].nome)+'</b>: '+fmt(Lcl[0].rk)+' kg de refugo, '+fmt(Lcl[0].dk)+' kg devolvidos e '+fmt(Lcl[0].rq)+' peças em retrabalho.</p>':'<p>Sem dados no mês.</p>'});
  /* 9 itens recorrentes (3 meses) */
  const w=[0,1,2].map(i=>g.addM(k,-i)),it=new Map(),ai=(cod,nome,f,v)=>{cod=String(cod||'').trim();if(!cod)return;const e=it.get(cod)||{nome:nome||cod,rf:0,rt:0,dv:0};if(nome&&e.nome===cod)e.nome=nome;e[f]+=v;it.set(cod,e)};
  R.filter(r=>w.includes(r.k)).forEach(r=>ai(r.cod,r.pec,'rf',r.qtd));RT.filter(r=>w.includes(isoMes(r.dt))).forEach(r=>ai(r.cod,r.prod,'rt',N(r.qtd)));D.filter(r=>w.includes(r.k)).forEach(r=>ai(r.cod,r.pec,'dv',r.qtd));
  const rec=[...it].map(([c,e])=>({c,...e,n:(e.rf>0)+(e.rt>0)+(e.dv>0),t:e.rf+e.rt+e.dv})).filter(e=>e.n>=2).sort((a,b)=>b.n-a.n||b.t-a.t).slice(0,12);
  secs.push({t:'Itens recorrentes: com problema em mais de uma frente (últimos 3 meses).',pre:rec.length?tabela(['Item','Refugo (pç)','Retrabalho (pç)','Devolução (pç)','Frentes'],rec.map(e=>[e.c+' - '+e.nome,e.rf,e.rt,e.dv,e.n])):'',
    txt:rec.length?'<p><b>'+rec.length+'</b> item(ns) aparecem em duas ou mais frentes (refugo, retrabalho, devolução) nos últimos 3 meses. O mais crítico é <b>'+esc(rec[0].c+' - '+rec[0].nome)+'</b>, presente em '+rec[0].n+' frente(s). Itens que escapam do refugo e voltam como retrabalho ou devolução merecem análise de causa raiz.</p>':'<p>Nenhum item com problema em mais de uma frente nos últimos 3 meses.</p>'});
  /* 10 custo */
  if(custo){
    const cs=ms.map(m=>Math.round(g.metricasMes(m,R,D).rs)),cd=ms.map(m=>Math.round(sum(dvK(m),r=>r.rs)));
    secs.push({t:'Custo estimado da não qualidade por mês (R$).',img:(cs.concat(cd)).some(v=>v>0)?g.imgStack(lab,[{name:'Refugo',cor:'#ED7D31',values:cs},{name:'Devolução',cor:'#1f5f99',values:cd}]):null,
      txt:'<p>Em '+mes+': refugo '+RS(cs[5])+' + devoluções '+RS(cd[5])+' = <b>'+RS(cs[5]+cd[5])+'</b>'+((cs[4]+cd[4])>0?' ('+(cs[5]+cd[5]>=cs[4]+cd[4]?'+':'−')+pc(Math.abs((cs[5]+cd[5]-cs[4]-cd[4])/(cs[4]+cd[4])*100))+' vs '+mesP+')':'')+'. O retrabalho não tem custo em R$ no sistema, então não entra nesta soma.</p>'});
  }
  return secs;
}
function vgSheets(k){
  const g=G(),R=g.refAll(),D=g.devAll().filter(r=>!np(r.raw)),RT=rtDados(),ms=mesesDe(k);
  return [{name:'Evolução',rows:[['Mês','Refugo (kg)','Refugo Fundição %','Retrabalho (peças)','Devolução procedente (kg)'],...ms.map(m=>{const x=g.metricasMes(m,R,D);return[m,Math.round(x.kg*100)/100,x.perc==null?'':Math.round(x.perc*100)/100,sum(RT.filter(r=>isoMes(r.dt)===m),r=>N(r.qtd)),Math.round(sum(D.filter(r=>r.k===m),r=>r.kg)*100)/100]})]}];
}
CFG.vg={titulo:'Visão geral da qualidade',sec:k=>{const s=vgSecoes(k);try{return window.__vgPatch?window.__vgPatch(s,k):s}catch(e){console.error(e);return s}},sheets:vgSheets,arq:'visao-geral-qualidade'};
const EDK=c=>'controle_refugos_2026_reltxt_'+c;
function lerEd(c){try{const o=JSON.parse(localStorage.getItem(EDK(c))||'{}');return o&&typeof o==='object'?o:{}}catch(e){return{}}}
function gravarEd(c,k,n,html){const o=lerEd(c);o[k]=o[k]||{};if(html===null)delete o[k][n];else o[k][n]=html;try{localStorage.setItem(EDK(c),JSON.stringify(o))}catch(e){}}
function montar(c,k,numTxt,edit){
  const cf=CFG[c],EDS=lerEd(c)[k]||{},out=[];let n=0;
  cf.sec(k).forEach(s=>{
    n++;
    const ed=EDS[n]!==undefined?G().limparHtml(EDS[n]):undefined,body=ed!==undefined?ed:s.txt;
    const barra=edit?'<div class="ed-bar no-print">'+(ed!==undefined?'✎ texto editado por você — <a href="#" data-restore="'+n+'">↺ restaurar texto automático</a>':'✎ clique no texto para editar — a análise acima foi gerada automaticamente')+'</div>':'';
    out.push('<div class="sec"><h2>'+n+'. '+esc(s.t)+'</h2>'+(s.img?'<img src="'+s.img+'" alt="">':'')+(s.pre||'')+'<div class="txt"'+(edit?' contenteditable="true" spellcheck="true" data-sec="'+n+'"':'')+'>'+body+'</div>'+barra+'</div>');
  });
  const logo=(document.querySelector('.sidebar .brand img')||{}).src||'',hoje=new Date().toLocaleDateString('pt-BR');
  const cab='<div class="cab"><div class="cl">'+(logo?'<img src="'+logo+'" alt="logo">':'')+'</div><div class="cm">'+esc(cf.titulo)+': '+G().mesExt(k)+' de '+k.slice(0,4)+'</div><div class="cr"><b>N° '+esc(numTxt||'—')+'</b><span>'+hoje+'</span></div></div>';
  return '<table class="rp"><thead><tr><td>'+cab+'</td></tr></thead><tbody><tr><td>'+out.join('')+'</td></tr></tbody></table>';
}
function mesAtual(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function ui(c){
  const k=$(c+'RelMes').value||mesAtual(),box=$(c+'RelPrev');
  try{box.innerHTML='<style>'+G().REPCSS+'</style>'+montar(c,k,$(c+'RelNum').value,true)}catch(e){console.error(e);box.textContent='Erro ao montar o relatório: '+e.message;return}
  const barra=(t,k2)=>{
    const s=t.closest('.sec'),b=s&&s.querySelector('.ed-bar');if(!b)return;
    const ed=(lerEd(c)[k2]||{})[t.dataset.sec]!==undefined;
    b.innerHTML=ed?'✎ texto editado por você — <a href="#" data-restore="'+t.dataset.sec+'">↺ restaurar texto automático</a>':'✎ clique no texto para editar — a análise acima foi gerada automaticamente';
    const a=b.querySelector('[data-restore]');if(a)a.addEventListener('click',ev=>{ev.preventDefault();if(!confirm('Voltar ao texto automático desta seção? Sua edição será descartada.'))return;gravarEd(c,k2,a.dataset.restore,null);ui(c)});
  };
  box.querySelectorAll('.txt[data-sec]').forEach(t=>{
    t.addEventListener('input',()=>{t._d=1});
    t.addEventListener('blur',()=>{if(!t._d)return;t._d=0;gravarEd(c,k,t.dataset.sec,G().limparHtml(t.innerHTML));barra(t,k)});
  });
  box.querySelectorAll('[data-restore]').forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault();if(!confirm('Voltar ao texto automático desta seção? Sua edição será descartada.'))return;gravarEd(c,k,a.dataset.restore,null);ui(c)}));
}
window.relUiInit=function(c){
  const host=$(c==='rt'?'rtRelatorio':c==='dv'?'dvRelatorio':'gVisao');if(!host)return;
  if(!host.dataset.built){
    host.dataset.built='1';
    host.innerHTML='<style>.rl-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.rl-bar label{font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}.rl-prev{background:#fff;color:#1d2733;border-radius:12px;padding:16px;border:1px solid var(--border);overflow:auto}</style>'+
    '<div class="panel"><div class="rl-bar"><strong>Mês do relatório</strong><input type="month" id="'+c+'RelMes"><label>Nº do relatório <input id="'+c+'RelNum" placeholder="Ex.: 13/26" style="width:90px"></label><button class="btn primary" type="button" onclick="relPdf(\''+c+'\')">📄 Gerar PDF</button><button class="btn secondary" type="button" onclick="relXlsx(\''+c+'\')">📊 Baixar Excel</button></div>'+
    '<div class="hint" style="margin-bottom:10px"><b>Os textos de análise podem ser editados:</b> clique em qualquer texto, ajuste e ele fica salvo para aquele mês e entra no PDF. Os gráficos e números vêm direto dos lançamentos.</div><div class="rl-prev" id="'+c+'RelPrev"></div></div>';
    $(c+'RelMes').value=mesAtual();
    try{const n=localStorage.getItem('controle_refugos_2026_relnum_'+c);if(n)$(c+'RelNum').value=n}catch(e){}
    $(c+'RelMes').addEventListener('change',()=>ui(c));
  }
  ui(c);
};
window.relPdf=function(c){
  const k=$(c+'RelMes').value||mesAtual();
  try{localStorage.setItem('controle_refugos_2026_relnum_'+c,$(c+'RelNum').value)}catch(e){}
  const html=montar(c,k,$(c+'RelNum').value,false);
  const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();d.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(CFG[c].titulo)+' '+k+'</title><style>@page{size:A4;margin:12mm}body{margin:0}'+G().REPCSS+'</style></head><body>'+html+'</body></html>');d.close();
  Promise.all([...d.images].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=im.onerror=r}))).then(()=>setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){alert('Não foi possível abrir a impressão.')}setTimeout(()=>f.remove(),60000)},300));
};
window.relXlsx=function(c){
  const k=$(c+'RelMes').value||mesAtual();
  G().baixar(G().xlsxBlob(CFG[c].sheets(k)),CFG[c].arq+'-'+k+'.xlsx');
};
window.__relRefresh=function(){if($('vgRelPrev'))ui('vg')};
window.__relatorios={vgSecoes,vgSheets,rtSecoes,dvSecoes,rtSheets,dvSheets,montar};
})();

/* ==================================================================
   PAINEL 360 — dashboards de análise avançada (executivo, Pareto,
   mapa de calor, peças críticas, clientes, calendário).
   Só LÊ os dados do app; não grava nada neles.
   ================================================================== */
(function(){
const G=()=>window.__gestao,$=id=>document.getElementById(id);
const PK='controle_refugos_2026_p360';
const OR='#ff6a1f',ST='#8fa6bd',BL='#3b82f6',GR='#22c55e',RD='#ef4444',PU='#a855f7',YL='#eab308',TE='#14b8a6';
const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fm=(v,d)=>N(v).toLocaleString('pt-BR',{maximumFractionDigits:d==null?0:d,minimumFractionDigits:0});
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const norm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const plc=t=>{t=norm(t);return t.includes('FUND')?'F':t.includes('USIN')?'U':''};
const rgb=c=>{const m=String(c).match(/^#([0-9a-f]{6})$/i);return m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)):[255,106,31]};
const mix=(c,t,k)=>'rgb('+rgb(c).map(v=>Math.round(v+((t?255:0)-v)*k)).join(',')+')';
const hk=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const range=(a,b)=>{const o=[];let k=a,i=0;while(k<=b&&i++<120){o.push(k);k=G().addM(k,1)}return o};
let S={a:'',b:'',pl:'ab',mt:'kg',tab:'exec',sel:null,q:''};
try{Object.assign(S,JSON.parse(localStorage.getItem(PK)||'{}'))}catch(e){}
if(!S.a||!S.b){S.b=hk();S.a=G().addM(S.b,-11)}
const save=()=>{try{localStorage.setItem(PK,JSON.stringify({a:S.a,b:S.b,pl:S.pl,mt:S.mt,tab:S.tab}))}catch(e){}};
let _g=0;

/* ---------- dados ---------- */
function dados(){
  const g=G(),PF=S.pl!=='u',PU=S.pl!=='f',both=PF&&PU,keep=c=>c==='F'?PF:c==='U'?PU:both,mt=S.mt==='qtd'?'qtd':'kg',vv=r=>mt==='qtd'?N(r.qtd):N(r.kg);
  const R0=g.refAll().filter(r=>keep(plc(r.pl))),D0=g.devAll().filter(r=>keep(plc(r.tipo))&&!(r.raw&&(r.raw.procede==='Não'||r.raw.disp==='Reclamação não procede')));
  let T0=[];try{T0=(typeof rtLoad==='function'?rtLoad():[]).filter(r=>r.dt)}catch(e){}
  const T1=T0.filter(r=>{try{return keep(plc((typeof setorInfo==='function'&&setorInfo(r.setor)||{}).planta))}catch(e){return true}});
  const ms=range(S.a,S.b),len=ms.length,pa=g.addM(S.a,-len),pb=g.addM(S.a,-1),pms=range(pa,pb);
  const inM=(k,L)=>L.includes(k);
  const R=R0.filter(r=>inM(r.k,ms)),D=D0.filter(r=>inM(r.k,ms)),T=T1.filter(r=>inM(String(r.dt).slice(0,7),ms));
  const Rp=R0.filter(r=>inM(r.k,pms)),Dp=D0.filter(r=>inM(r.k,pms)),Tp=T1.filter(r=>inM(String(r.dt).slice(0,7),pms));
  const by=(L,k)=>L.filter(r=>r.k===k);
  const ref=ms.map(k=>sum(by(R,k),vv)),dev=ms.map(k=>sum(by(D,k),vv)),rtq=ms.map(k=>sum(T.filter(r=>String(r.dt).slice(0,7)===k),r=>N(r.qtd)));
  const prod=ms.map(k=>g.metricasMes(k,R0,D0).prod),kgF=ms.map(k=>sum(by(R,k).filter(r=>plc(r.pl)==='F'),r=>N(r.kg)));
  const dkF=ms.map(k=>sum(by(D,k).filter(r=>plc(r.tipo)==='F'),r=>N(r.kg)));
  const perc=ms.map((k,i)=>(mt==='kg'&&PF&&prod[i])?kgF[i]/prod[i]*100:null);
  const ppm=ms.map((k,i)=>(mt==='kg'&&PF&&prod[i])?dkF[i]/prod[i]*1e6:null);
  const refF=ms.map(k=>sum(by(R,k).filter(r=>plc(r.pl)==='F'),vv)),refU=ms.map(k=>sum(by(R,k).filter(r=>plc(r.pl)==='U'),vv));
  const cus=ms.map(k=>sum(by(R,k),r=>N(r.rs))+sum(by(D,k),r=>N(r.rs)));
  const pi=sum(pms,k=>g.metricasMes(k,R0,D0).prod),ci=sum(ms,k=>g.metricasMes(k,R0,D0).prod);
  const tot={ref:sum(R,vv),dev:sum(D,vv),rt:sum(T,r=>N(r.qtd)),rs:sum(R,r=>N(r.rs))+sum(D,r=>N(r.rs)),pecas:sum(R,r=>N(r.qtd)),
    perc:(mt==='kg'&&PF&&ci)?sum(R.filter(r=>plc(r.pl)==='F'),r=>N(r.kg))/ci*100:null,
    ppm:(mt==='kg'&&PF&&ci)?sum(D.filter(r=>plc(r.tipo)==='F'),r=>N(r.kg))/ci*1e6:null};
  const prev={ref:sum(Rp,vv),dev:sum(Dp,vv),rt:sum(Tp,r=>N(r.qtd)),rs:sum(Rp,r=>N(r.rs))+sum(Dp,r=>N(r.rs)),
    perc:(mt==='kg'&&PF&&pi)?sum(Rp.filter(r=>plc(r.pl)==='F'),r=>N(r.kg))/pi*100:null,
    ppm:(mt==='kg'&&PF&&pi)?sum(Dp.filter(r=>plc(r.tipo)==='F'),r=>N(r.kg))/pi*1e6:null};
  let cu=false;try{cu=costAccessAllowed()}catch(e){}
  return{mt,PF,PU,both,vv,ms,len,R,D,T,ref,dev,rtq,prod,perc,ppm,refF,refU,cus,tot,prev,cu,un:mt==='qtd'?'peças':'kg'};
}
function rank(rows,key,val,lim){const m=new Map();rows.forEach(r=>{const k=String(key(r)||'').trim()||'Não informado';m.set(k,(m.get(k)||0)+val(r))});const a=[...m].map(([nome,v])=>({nome,v})).filter(e=>e.v>0).sort((x,y)=>y.v-x.v);return lim?a.slice(0,lim):a}

/* ---------- gráficos SVG ---------- */
function grad(id,c){return '<linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+mix(c,1,.55)+'"/><stop offset=".3" stop-color="'+mix(c,1,.1)+'"/><stop offset=".52" stop-color="'+c+'"/><stop offset=".56" stop-color="'+mix(c,0,.22)+'"/><stop offset="1" stop-color="'+mix(c,0,.42)+'"/></linearGradient>'}
function nice(m){if(m<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(m))),f=m/e;return(f<=1?1:f<=2?2:f<=5?5:10)*e}
function combo(o){
  const W=760,H=o.h||290,L=54,Rr=o.line?50:14,T=16,B=o.rot?74:34,cw=W-L-Rr,ch=H-T-B,n=o.labels.length||1,step=cw/n,id='c'+(++_g);
  const bars=o.bars||[],ns=o.stack?1:Math.max(1,bars.length),bw=Math.min(46,step*.72/ns);
  let mx=0;if(o.stack)for(let i=0;i<n;i++)mx=Math.max(mx,sum(bars,b=>N(b.values[i])));else bars.forEach(b=>b.values.forEach(v=>mx=Math.max(mx,N(v))));
  mx=nice(mx*1.08||1);const lmx=o.line?(o.line.max||nice(Math.max(.1,o.ref||0,...o.line.values.map(N))*1.12)):1;
  let s='<svg class="p3svg" viewBox="0 0 '+W+' '+H+'" role="img"><defs>'+bars.map((b,i)=>grad(id+'b'+i,b.color)).join('')+'</defs>';
  for(let g=0;g<=4;g++){const y=T+ch-g*ch/4;s+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+y+'" y2="'+y+'" class="gl"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end" class="ax">'+fm(mx*g/4,mx<10?1:0)+'</text>';if(o.line)s+='<text x="'+(W-Rr+6)+'" y="'+(y+4)+'" class="ax" fill="'+o.line.color+'">'+fm(lmx*g/4,lmx<10?1:0)+(o.line.suf||'')+'</text>'}
  if(o.ref!=null&&o.line){const y=T+ch-o.ref/lmx*ch;s+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+y+'" y2="'+y+'" stroke="'+RD+'" stroke-dasharray="6 4" stroke-width="1.5"/><text x="'+(L+4)+'" y="'+(y-4)+'" class="ax" fill="'+RD+'">'+(o.refTxt||'meta')+'</text>'}
  for(let i=0;i<n;i++){
    const x0=L+i*step+(step-bw*ns)/2;let acc=0;
    bars.forEach((b,j)=>{const v=N(b.values[i]),h=v/mx*ch,x=o.stack?x0:x0+j*bw,y=o.stack?T+ch-(acc+v)/mx*ch:T+ch-h;acc+=v;
      if(h>.3)s+='<rect class="bar" data-i="'+i+'" data-s="'+j+'" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="'+(o.stack?0:4)+'" fill="url(#'+id+'b'+j+')"><title>'+esc(o.labels[i])+' — '+esc(b.name)+': '+fm(v,1)+' '+(o.unit||'')+'</title></rect>';
      if(!o.stack&&o.vals&&h>12&&bars.length===1&&n<=14)s+='<text x="'+(x+bw/2)+'" y="'+(y-4)+'" text-anchor="middle" class="vl">'+fm(v,v<10?1:0)+'</text>'});
    const lx=L+i*step+step/2,ty=T+ch+14;
    s+=o.rot?'<text transform="translate('+lx+','+(ty)+') rotate(-38)" text-anchor="end" class="ax">'+esc(String(o.labels[i]).slice(0,22))+'</text>':'<text x="'+lx+'" y="'+ty+'" text-anchor="middle" class="ax">'+esc(String(o.labels[i]).slice(0,10))+'</text>';
  }
  if(o.line){const pts=o.line.values.map((v,i)=>v==null?null:[L+i*step+step/2,T+ch-N(v)/lmx*ch]).filter(Boolean);
    if(pts.length){s+='<polyline fill="none" stroke="'+o.line.color+'" stroke-width="3" stroke-linejoin="round" class="glow" points="'+pts.map(p=>p.join(',')).join(' ')+'"/>'+pts.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="'+o.line.color+'" stroke="#fff" stroke-width="1.2"><title>'+esc(o.line.name)+': '+fm(o.line.values.filter(v=>v!=null)[i],2)+(o.line.suf||'')+'</title></circle>').join('')}}
  return s+'</svg>';
}
function lines(o){ // várias linhas com mesma escala
  const W=760,H=o.h||260,L=54,Rr=14,T=14,B=34,cw=W-L-Rr,ch=H-T-B,n=o.labels.length;let mx=nice(Math.max(1,...o.series.flatMap(s=>s.values.map(N)))*1.1);
  let s='<svg class="p3svg" viewBox="0 0 '+W+' '+H+'">';
  for(let g=0;g<=4;g++){const y=T+ch-g*ch/4;s+='<line x1="'+L+'" x2="'+(W-Rr)+'" y1="'+y+'" y2="'+y+'" class="gl"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end" class="ax">'+fm(mx*g/4,mx<10?1:0)+'</text>'}
  const xs=i=>L+(n===1?cw/2:i*cw/(n-1));
  o.labels.forEach((l,i)=>{s+='<text x="'+xs(i)+'" y="'+(T+ch+16)+'" text-anchor="middle" class="ax">'+esc(String(l).slice(0,10))+'</text>'});
  o.series.forEach(se=>{const p=se.values.map((v,i)=>xs(i)+','+(T+ch-N(v)/mx*ch));s+='<polyline fill="none" stroke="'+se.color+'" stroke-width="3" class="glow" stroke-linejoin="round" points="'+p.join(' ')+'"/>'+se.values.map((v,i)=>'<circle cx="'+xs(i)+'" cy="'+(T+ch-N(v)/mx*ch)+'" r="3.5" fill="'+se.color+'"><title>'+esc(se.name)+' — '+esc(o.labels[i])+': '+fm(v,1)+'</title></circle>').join('')});
  s+='<g transform="translate('+L+',2)">'+o.series.map((se,i)=>'<rect x="'+(i*120)+'" y="0" width="10" height="10" rx="2" fill="'+se.color+'"/><text x="'+(i*120+14)+'" y="9" class="ax">'+esc(se.name)+'</text>').join('')+'</g>';
  return s+'</svg>';
}
function spark(v,c){v=v.map(N);if(v.length<2)return '';const w=84,h=26,mx=Math.max(...v,1e-9),mn=Math.min(...v),r=mx-mn||1;return '<svg class="p3sp" viewBox="0 0 '+w+' '+h+'"><polyline fill="none" stroke="'+(c||OR)+'" stroke-width="2" stroke-linejoin="round" points="'+v.map((x,i)=>(i*w/(v.length-1)).toFixed(1)+','+(h-3-(x-mn)/r*(h-6)).toFixed(1)).join(' ')+'"/></svg>'}
function hbar(items,fmtv,tot,c){const mx=Math.max(1,...items.map(e=>e.v));return '<div class="hb">'+items.map(e=>'<div class="hr" data-n="'+esc(e.nome)+'"><span class="hn" title="'+esc(e.nome)+'">'+esc(e.nome)+'</span><span class="ht"><i style="width:'+(e.v/mx*100).toFixed(1)+'%;--c:'+(e.c||c||OR)+'"></i></span><span class="hv">'+fmtv(e.v)+(tot?' <small>'+fm(e.v/tot*100,0)+'%</small>':'')+'</span></div>').join('')+'</div>'}
function delta(c,p,bad){if(p==null||!(p>0)||c==null)return '<small class="mu">sem base anterior</small>';const d=(c-p)/p*100;const up=d>0;return '<small class="'+((up===(bad!==false))?'up':'dn')+'">'+(up?'▲ +':'▼ ')+fm(Math.abs(d),0)+'% vs período anterior</small>'}

/* ---------- abas ---------- */
const TABS=[['exec','🏁 Executivo'],['pareto','📉 Pareto e causas'],['heat','🔥 Mapa de calor'],['pecas','🧩 Peças críticas'],['cli','👥 Clientes'],['cal','📅 Calendário'],['peixe','🐟 Espinha 6M']];
function kpi(l,v,sub,sp,c){return '<div class="p3k" style="--c:'+(c||OR)+'"><span>'+l+'</span><b>'+v+'</b>'+sub+'<div class="p3sk">'+(sp||'')+'</div></div>'}
function tExec(d){
  const g=G(),lb=d.ms.map(g.lblM),U=d.un,mt=d.mt==='qtd';
  const yld=d.tot.perc!=null?100-d.tot.perc:null,yp=d.prev.perc!=null?100-d.prev.perc:null;
  let h='<div class="p3kp">'+
   kpi('Refugo ('+U+')',fm(d.tot.ref,mt?0:1),delta(d.tot.ref,d.prev.ref),spark(d.ref,OR))+
   (d.tot.perc!=null?kpi('% refugo Fundição',fm(d.tot.perc,2)+'%',delta(d.tot.perc,d.prev.perc)+(typeof meta!=='undefined'&&meta&&meta.perc>0?'<small class="'+(d.tot.perc>meta.perc?'up':'dn')+'"> · meta '+fm(meta.perc,1)+'%</small>':''),spark(d.perc.map(N),RD),RD)+kpi('Rendimento de qualidade',fm(yld,2)+'%','<small class="mu">produção boa ÷ produção</small>',spark(d.perc.map(v=>100-N(v)),GR),GR):'')+
   kpi('Retrabalho (peças)',fm(d.tot.rt),delta(d.tot.rt,d.prev.rt),spark(d.rtq,BL),BL)+
   kpi('Devolução procedente ('+U+')',fm(d.tot.dev,mt?0:1),delta(d.tot.dev,d.prev.dev),spark(d.dev,PU),PU)+
   (d.tot.ppm!=null?kpi('PPM de devolução',fm(d.tot.ppm,0),delta(d.tot.ppm,d.prev.ppm)+'<small class="mu"> · kg devolvido por milhão de kg produzido</small>',spark(d.ppm.map(N),YL),YL):'')+
   (d.cu?kpi('Custo da não qualidade','R$ '+fm(d.tot.rs),delta(d.tot.rs,d.prev.rs),spark(d.cus,RD),RD):'')+'</div>';
  h+='<div class="p3g2"><div class="p3c"><h4>Refugo mensal'+(d.tot.perc!=null?' × % da produção da Fundição':'')+'</h4>'+combo({labels:lb,bars:[{name:'Refugo ('+U+')',color:OR,values:d.ref}],unit:U,vals:true,line:d.tot.perc!=null?{name:'% produção',color:'#cfe0f2',values:d.perc.map(v=>v==null?null:v),suf:'%'}:null,ref:(d.tot.perc!=null&&typeof meta!=='undefined'&&meta&&meta.perc>0)?meta.perc:null,refTxt:'meta'})+'</div>'+
   '<div class="p3c"><h4>Perda total: refugo + devolução ('+U+')</h4>'+combo({labels:lb,stack:true,bars:[{name:'Refugo',color:OR,values:d.ref},{name:'Devolução procedente',color:PU,values:d.dev}],unit:U})+'<div class="p3lg"><i style="--c:'+OR+'"></i>Refugo <i style="--c:'+PU+'"></i>Devolução</div></div></div>';
  h+='<div class="p3g2"><div class="p3c"><h4>Retrabalho (peças) por mês</h4>'+combo({labels:lb,bars:[{name:'Retrabalho',color:BL,values:d.rtq}],unit:'peças',vals:true})+'</div>'+
   (d.both?'<div class="p3c"><h4>Fundição × Usinagem ('+U+')</h4>'+lines({labels:lb,series:[{name:'Fundição',color:OR,values:d.refF},{name:'Usinagem',color:ST,values:d.refU}]})+'</div>':'<div class="p3c"><h4>Devolução por mês ('+U+')</h4>'+combo({labels:lb,bars:[{name:'Devolução',color:PU,values:d.dev}],unit:U,vals:true})+'</div>')+'</div>';
  /* leitura automática */
  const L=[],im=d.ref.indexOf(Math.max(...d.ref)),mot=rank(d.R,r=>r.mot,d.vv,3),cli=rank(d.R,r=>r.cli,d.vv,1),cau=rank(d.R,r=>r.causa,d.vv,1);
  if(d.ref.some(v=>v>0)){L.push('Pior mês do período: <b>'+g.lblM(d.ms[im])+'</b> com '+fm(d.ref[im],mt?0:1)+' '+U+' de refugo.');
    if(mot.length)L.push('Os 3 maiores motivos somam <b>'+fm(sum(mot,e=>e.v)/Math.max(1,d.tot.ref)*100,0)+'%</b> do refugo: '+mot.map(e=>esc(e.nome)).join(', ')+'.');
    if(cli.length&&d.tot.ref)L.push('Cliente com maior parcela do refugo: <b>'+esc(cli[0].nome)+'</b> ('+fm(cli[0].v/d.tot.ref*100,0)+'%).');
    if(cau.length&&d.tot.ref)L.push('Causa 6M predominante: <b>'+esc(cau[0].nome)+'</b> ('+fm(cau[0].v/d.tot.ref*100,0)+'%).');
    const a3=d.ref.slice(-3),b3=d.ref.slice(-6,-3);if(b3.length===3&&sum(b3,x=>x)>0){const t=(sum(a3,x=>x)-sum(b3,x=>x))/sum(b3,x=>x)*100;L.push('Últimos 3 meses vs 3 anteriores: <b class="'+(t>0?'up':'dn')+'">'+(t>0?'▲ +':'▼ ')+fm(Math.abs(t),0)+'%</b> no refugo.')}}
  h+='<div class="p3c"><h4>🔎 Leitura automática</h4>'+(L.length?'<ul class="p3ul">'+L.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'<span class="mu">Sem lançamentos no período.</span>')+'</div>';
  return h;
}
function tPareto(d){
  const U=d.un,mot=rank(d.R,r=>r.mot,d.vv,14),tot=d.tot.ref||1;let ac=0;const cum=mot.map(e=>(ac+=e.v)/tot*100);
  const cau=rank(d.R,r=>r.causa,d.vv),pl=rank(d.R,r=>plc(r.pl)==='F'?'Fundição':plc(r.pl)==='U'?'Usinagem':'Outros',d.vv);
  let h='<div class="p3c"><h4>Pareto — motivos de refugo ('+U+') · linha = % acumulado</h4>'+(mot.length?combo({labels:mot.map(e=>e.nome),bars:[{name:'Refugo',color:OR,values:mot.map(e=>e.v)}],unit:U,line:{name:'% acumulado',color:'#cfe0f2',values:cum,max:100,suf:'%'},ref:80,refTxt:'80%',rot:true,h:340}):'<span class="mu">Sem dados.</span>')+'<div class="p3hint">Clique em uma barra para ver clientes e peças daquele motivo.</div><div id="p3det"></div></div>';
  h+='<div class="p3g2"><div class="p3c"><h4>Causa 6M</h4>'+(cau.length?hbar(cau,v=>fm(v,0)+' '+U,tot,TE):'<span class="mu">—</span>')+'</div><div class="p3c"><h4>Por planta</h4>'+(pl.length?hbar(pl,v=>fm(v,0)+' '+U,tot,ST):'<span class="mu">—</span>')+'</div></div>';
  const v80=cum.findIndex(x=>x>=80)+1;if(v80)h+='<div class="p3c"><h4>Regra 80/20</h4><p><b>'+v80+'</b> motivo(s) concentram <b>80%</b> do refugo do período. Priorize ação nesses primeiro.</p></div>';
  return h;
}
function heatTbl(d,key,titulo,lim){
  const items=rank(d.R,key,d.vv,lim).map(e=>e.nome),lb=d.ms.map(G().lblM);
  const M=items.map(nm=>d.ms.map(k=>sum(d.R.filter(r=>r.k===k&&(String(key(r)||'').trim()||'Não informado')===nm),d.vv)));
  const mx=Math.max(1,...M.flat());
  return '<div class="p3c"><h4>'+titulo+'</h4><div class="p3hm"><table><thead><tr><th></th>'+lb.map(l=>'<th>'+esc(l.replace('/20','/'))+'</th>').join('')+'<th>Total</th></tr></thead><tbody>'+items.map((nm,i)=>'<tr><th title="'+esc(nm)+'">'+esc(nm.slice(0,30))+'</th>'+M[i].map((v,j)=>'<td data-r="'+esc(nm)+'" data-k="'+d.ms[j]+'" data-w="'+(titulo.includes('Cliente')?'c':'m')+'" style="--a:'+(v/mx).toFixed(3)+'" class="'+(v>0?'on':'')+'" title="'+esc(nm)+' · '+lb[j]+': '+fm(v,1)+'">'+(v>0?fm(v,v<10?1:0):'')+'</td>').join('')+'<td class="tt">'+fm(sum(M[i],x=>x),0)+'</td></tr>').join('')+'</tbody></table></div></div>';
}
function tHeat(d){return heatTbl(d,r=>r.mot,'Motivo × mês ('+d.un+')',12)+heatTbl(d,r=>r.cli,'Cliente × mês ('+d.un+')',12)+'<div class="p3hint">Quanto mais forte o laranja, maior o valor. Clique numa célula para ver o detalhe.</div><div id="p3det"></div>'}
function pecasLista(d){
  const m=new Map(),add=(cod,nome,cli,f,v)=>{const k=cod||nome;if(!k)return;let e=m.get(k);if(!e){e={cod,nome,cli,ref:0,dev:0,rt:0,ser:d.ms.map(()=>0)};m.set(k,e)}if(nome&&!e.nome)e.nome=nome;e[f]+=v;return e};
  d.R.forEach(r=>{const e=add(r.cod,r.pec,r.cli,'ref',d.vv(r));if(e){const i=d.ms.indexOf(r.k);if(i>=0)e.ser[i]+=d.vv(r)}});
  d.D.forEach(r=>add(r.cod,r.pec,r.cli,'dev',d.vv(r)));
  d.T.forEach(r=>add(r.cod,r.prod,r.cli,'rt',N(r.qtd)));
  const tr=d.tot.ref||1,td=d.tot.dev||1,tt=d.tot.rt||1;
  return [...m.values()].map(e=>{e.sc=(e.ref/tr+e.dev/td+e.rt/tt)/((d.tot.ref>0)+(d.tot.dev>0)+(d.tot.rt>0)||1)*100;const a=e.ser.slice(-3),b=e.ser.slice(-6,-3),sa=sum(a,x=>x),sb=sum(b,x=>x);e.tr=sb>0?(sa-sb)/sb*100:(sa>0?100:0);return e}).sort((x,y)=>y.sc-x.sc);
}
function tPecas(d){
  const q=norm(S.q),L=pecasLista(d).filter(e=>!q||norm(e.cod+' '+e.nome+' '+e.cli).includes(q)).slice(0,40);
  return '<div class="p3c"><h4>Ranking de criticidade das peças</h4><div class="p3hint">Índice = média da participação da peça no refugo, na devolução e no retrabalho do período. Clique numa linha para ver o histórico.</div><input id="p3q" class="p3in" placeholder="Buscar por código, peça ou cliente" value="'+esc(S.q)+'"><div class="tablewrap"><table class="p3t"><thead><tr><th>#</th><th>Peça</th><th>Cliente</th><th>Refugo ('+d.un+')</th><th>Devolução ('+d.un+')</th><th>Retrab. (pç)</th><th>Índice</th><th>12 meses</th><th>Tendência</th></tr></thead><tbody>'+
    L.map((e,i)=>'<tr data-cod="'+esc(e.cod||e.nome)+'"><td>'+(i+1)+'</td><td>'+esc((e.cod?e.cod+' — ':'')+(e.nome||''))+'</td><td>'+esc(e.cli||'')+'</td><td>'+fm(e.ref,d.mt==='qtd'?0:1)+'</td><td>'+fm(e.dev,d.mt==='qtd'?0:1)+'</td><td>'+fm(e.rt)+'</td><td><div class="ib"><i style="width:'+Math.min(100,e.sc*3).toFixed(0)+'%"></i></div>'+fm(e.sc,1)+'%</td><td>'+spark(e.ser,OR)+'</td><td class="'+(e.tr>0?'up':'dn')+'">'+(e.ref>0?(e.tr>0?'▲ +':'▼ ')+fm(Math.abs(e.tr),0)+'%':'—')+'</td></tr>').join('')+(L.length?'':'<tr><td colspan="9" class="mu">Nada encontrado.</td></tr>')+'</tbody></table></div><div id="p3det"></div></div>';
}
function tCli(d){
  const m=new Map(),add=(c,f,v)=>{c=String(c||'').trim()||'Não informado';let e=m.get(c);if(!e){e={nome:c,ref:0,dev:0,rt:0};m.set(c,e)}e[f]+=v};
  d.R.forEach(r=>add(r.cli,'ref',d.vv(r)));d.D.forEach(r=>add(r.cli,'dev',d.vv(r)));d.T.forEach(r=>add(r.cli,'rt',N(r.qtd)));
  const L=[...m.values()].map(e=>{e.t=e.ref+e.dev;return e}).sort((a,b)=>b.t-a.t).slice(0,12),tt=d.tot.ref+d.tot.dev||1;
  return '<div class="p3c"><h4>Clientes — refugo + devolução ('+d.un+')</h4>'+(L.length?combo({labels:L.map(e=>e.nome),stack:true,bars:[{name:'Refugo',color:OR,values:L.map(e=>e.ref)},{name:'Devolução',color:PU,values:L.map(e=>e.dev)}],unit:d.un,rot:true,h:340}):'<span class="mu">Sem dados.</span>')+'</div>'+
   '<div class="p3c"><h4>Tabela por cliente</h4><div class="tablewrap"><table class="p3t"><thead><tr><th>Cliente</th><th>Refugo</th><th>Devolução</th><th>Retrab. (pç)</th><th>% do total</th></tr></thead><tbody>'+L.map(e=>'<tr><td>'+esc(e.nome)+'</td><td>'+fm(e.ref,1)+'</td><td>'+fm(e.dev,1)+'</td><td>'+fm(e.rt)+'</td><td><div class="ib"><i style="width:'+Math.min(100,e.t/tt*100).toFixed(0)+'%"></i></div>'+fm(e.t/tt*100,1)+'%</td></tr>').join('')+'</tbody></table></div></div>';
}
function tCal(d){
  const DS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],dw=DS.map(()=>0),sm=[0,0,0,0,0],dm=Array(31).fill(0);let n=0;
  d.R.forEach(r=>{if(!r.dt)return;const p=r.dt.split('-').map(Number);if(p.length<3)return;const dt=new Date(p[0],p[1]-1,p[2]),v=d.vv(r);dw[dt.getDay()]+=v;sm[Math.min(4,Math.floor((p[2]-1)/7))]+=v;dm[p[2]-1]+=v;n++});
  if(!n)return '<div class="p3c"><span class="mu">Sem lançamentos com data no período.</span></div>';
  const top=dw.indexOf(Math.max(...dw));
  return '<div class="p3g2"><div class="p3c"><h4>Refugo por dia da semana ('+d.un+')</h4>'+combo({labels:DS,bars:[{name:'Refugo',color:OR,values:dw}],unit:d.un,vals:true})+'<p class="p3hint">Dia mais crítico: <b>'+DS[top]+'</b> ('+fm(dw[top]/Math.max(1,sum(dw,x=>x))*100,0)+'% do refugo).</p></div>'+
   '<div class="p3c"><h4>Por semana do mês ('+d.un+')</h4>'+combo({labels:['1–7','8–14','15–21','22–28','29–31'],bars:[{name:'Refugo',color:ST,values:sm}],unit:d.un,vals:true})+'</div></div>'+
   '<div class="p3c"><h4>Por dia do mês ('+d.un+')</h4>'+combo({labels:dm.map((_,i)=>String(i+1)),bars:[{name:'Refugo',color:OR,values:dm}],unit:d.un})+'</div>';
}
/* ---------- detalhes ao clicar ---------- */
function det(html){const e=$('p3det');if(e){e.innerHTML=html;try{e.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(x){}}}
function detMotivo(d,mot){
  const rr=d.R.filter(r=>(String(r.mot||'').trim()||'Não informado')===mot),tot=sum(rr,d.vv);
  const l=(t,a)=>'<div><h5>'+t+'</h5>'+hbar(a,v=>fm(v,0)+' '+d.un,tot,OR)+'</div>';
  det('<div class="p3dt"><h4>'+esc(mot)+' — '+fm(tot,1)+' '+d.un+'</h4><div class="p3g3">'+l('Clientes',rank(rr,r=>r.cli,d.vv,6))+l('Peças',rank(rr,r=>(r.cod?r.cod+' - ':'')+(r.pec||''),d.vv,6))+l('Meses',rank(rr,r=>G().lblM(r.k),d.vv,6))+'</div></div>');
}
function detCel(d,nm,k,w){
  const rr=d.R.filter(r=>r.k===k&&(String((w==='c'?r.cli:r.mot)||'').trim()||'Não informado')===nm),tot=sum(rr,d.vv);
  det('<div class="p3dt"><h4>'+esc(nm)+' · '+G().lblM(k)+' — '+fm(tot,1)+' '+d.un+' ('+rr.length+' lançamento(s))</h4><div class="p3g3"><div><h5>'+(w==='c'?'Motivos':'Clientes')+'</h5>'+hbar(rank(rr,r=>w==='c'?r.mot:r.cli,d.vv,6),v=>fm(v,0)+' '+d.un,tot,OR)+'</div><div><h5>Peças</h5>'+hbar(rank(rr,r=>(r.cod?r.cod+' - ':'')+(r.pec||''),d.vv,6),v=>fm(v,0)+' '+d.un,tot,ST)+'</div></div></div>');
}
function detPeca(d,cod){
  const e=pecasLista(d).find(x=>(x.cod||x.nome)===cod);if(!e)return;
  const rr=d.R.filter(r=>(r.cod||r.pec)===cod);
  det('<div class="p3dt"><h4>'+esc((e.cod?e.cod+' — ':'')+(e.nome||''))+'</h4>'+combo({labels:d.ms.map(G().lblM),bars:[{name:'Refugo',color:OR,values:e.ser}],unit:d.un,vals:true,h:220})+'<div class="p3g3"><div><h5>Motivos</h5>'+hbar(rank(rr,r=>r.mot,d.vv,6),v=>fm(v,0)+' '+d.un,e.ref,OR)+'</div></div></div>');
}

/* ---------- espinha de peixe (Ishikawa 6M) ---------- */
const MS6=[['Mão de obra','#3b82f6'],['Método','#22c55e'],['Máquina','#ff6a1f'],['Material','#a855f7'],['Medição','#eab308'],['Meio ambiente','#14b8a6']];
function fishSvg(o){
  const dk=o.tema!=='lt',tx=dk?'#e8eef4':'#1d2733',mu=dk?'#9fb0c2':'#5b6b7c',bg=dk?'#16202a':'#ffffff',bd=dk?'#2f3f50':'#cfd8e2',rows=o.rows||[],cost=!!o.cost;
  const vq=r=>N(r.qtd),vk=r=>N(r.kgB!=null?r.kgB:r.kg),vr=r=>N(r.rs);
  const tq=sum(rows,vq),tk=sum(rows,vk),tr=sum(rows,vr),id='f'+(++_g);
  const A=MS6.map(([nome,c])=>{const rr=rows.filter(r=>r.causa===nome);return{nome,c,q:sum(rr,vq),k:sum(rr,vk),r:sum(rr,vr),mot:rank(rr,r=>r.mot,vk,3),n:rr.length}});
  const cls=A.reduce((s,a)=>s+a.k,0),sem=tk-cls,semQ=tq-sum(A,a=>a.q);
  const W=1000,H=548,SY=262,money=v=>cost?'R$ '+fm(v):'🔒';
  let s='<svg xmlns="http://www.w3.org/2000/svg" class="p3svg p3fs" viewBox="0 0 '+W+' '+H+'" font-family="Segoe UI,Arial,sans-serif"><defs><linearGradient id="'+id+'s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f0f7"/><stop offset=".5" stop-color="#8da2b8"/><stop offset="1" stop-color="#4a5d72"/></linearGradient><linearGradient id="'+id+'h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c3b4b"/><stop offset=".55" stop-color="#121a23"/><stop offset="1" stop-color="#26323f"/></linearGradient>'+A.map((a,i)=>grad(id+i,a.c)).join('')+'</defs>';
  /* cauda + espinha dorsal + cabeça */
  s+='<polygon points="8,'+(SY-26)+' 52,'+SY+' 8,'+(SY+26)+'" fill="url(#'+id+'s)"/><rect x="40" y="'+(SY-5)+'" width="760" height="10" rx="5" fill="url(#'+id+'s)" stroke="'+bd+'"/>';
  s+='<path d="M790,'+(SY-92)+' H936 Q992,'+(SY-92)+' 992,'+(SY-36)+' V'+(SY+36)+' Q992,'+(SY+92)+' 936,'+(SY+92)+' H790 Z" fill="url(#'+id+'h)" stroke="#ff6a1f" stroke-width="2.5"/>';
  s+='<text x="891" y="'+(SY-60)+'" text-anchor="middle" font-size="13" font-weight="800" fill="#ff9a55" letter-spacing="1.5">PROBLEMA</text><text x="891" y="'+(SY-36)+'" text-anchor="middle" font-size="19" font-weight="900" fill="#f4f8fc">REFUGO</text>'+
     '<text x="891" y="'+(SY-6)+'" text-anchor="middle" font-size="22" font-weight="900" fill="#ffffff">'+fm(tq)+' <tspan font-size="12" font-weight="700" fill="#aebccb">peças</tspan></text>'+
     '<text x="891" y="'+(SY+22)+'" text-anchor="middle" font-size="19" font-weight="900" fill="#ffffff">'+fm(tk,1)+' <tspan font-size="12" font-weight="700" fill="#aebccb">kg</tspan></text><text x="891" y="'+(SY+37)+'" text-anchor="middle" font-size="10" fill="#aebccb">peso bruto fracionado</text>'+
     '<text x="891" y="'+(SY+66)+'" text-anchor="middle" font-size="19" font-weight="900" fill="#ffb27a">'+money(tr)+'</text>';
  /* ossos */
  A.forEach((a,i)=>{
    const top=i<3,col=i%3,cx=(top?150:150)+col*232,bx=cx-95,by=top?6:H-6-86,y0=top?by+86:by,y1=SY,x1=cx+112,sh=tk>0?a.k/tk:0,sw=(3+sh*13).toFixed(1);
    const xAt=y=>cx+(y-y0)*(x1-cx)/(y1-y0);
    s+='<g class="p3m" data-m="'+esc(a.nome)+'" style="cursor:pointer"><line x1="'+cx+'" y1="'+y0+'" x2="'+x1+'" y2="'+y1+'" stroke="url(#'+id+i+')" stroke-width="'+sw+'" stroke-linecap="round"/>';
    a.mot.forEach((m,j)=>{const y=top?y0+34+j*40:y0-34-j*40,x=xAt(y),pc=a.k>0?m.v/a.k*100:0;
      s+='<line x1="'+(x-26)+'" y1="'+y+'" x2="'+x+'" y2="'+y+'" stroke="'+a.c+'" stroke-width="2.2" opacity=".85"/><text x="'+(x-30)+'" y="'+(y-4)+'" text-anchor="end" font-size="11.5" font-weight="700" fill="'+tx+'">'+esc(String(m.nome).slice(0,24))+'</text><text x="'+(x-30)+'" y="'+(y+9)+'" text-anchor="end" font-size="10.5" fill="'+mu+'">'+fm(m.v,1)+' kg · '+fm(pc,0)+'%</text>'});
    s+='<rect x="'+bx+'" y="'+by+'" width="190" height="86" rx="10" fill="'+bg+'" stroke="'+a.c+'" stroke-width="2"/><path d="M'+bx+','+(by+24)+' V'+(by+10)+' Q'+bx+','+by+' '+(bx+10)+','+by+' H'+(bx+180)+' Q'+(bx+190)+','+by+' '+(bx+190)+','+(by+10)+' V'+(by+24)+' Z" fill="url(#'+id+i+')"/>'+
     '<text x="'+(bx+95)+'" y="'+(by+17)+'" text-anchor="middle" font-size="13.5" font-weight="900" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width=".4">'+esc(a.nome.toUpperCase())+'</text>'+
     '<text x="'+(bx+95)+'" y="'+(by+44)+'" text-anchor="middle" font-size="13" font-weight="800" fill="'+tx+'">'+fm(a.q)+' pç · '+fm(a.k,1)+' kg</text>'+
     '<text x="'+(bx+95)+'" y="'+(by+64)+'" text-anchor="middle" font-size="13" font-weight="800" fill="'+a.c+'">'+money(a.r)+'</text><text x="'+(bx+95)+'" y="'+(by+79)+'" text-anchor="middle" font-size="10.5" fill="'+mu+'">'+fm(sh*100,0)+'% do peso</text><title>'+esc(a.nome)+': '+fm(a.q)+' peças, '+fm(a.k,1)+' kg'+(cost?', R$ '+fm(a.r):'')+' — clique para detalhar</title></g>';
  });
  if(sem>0.0001||semQ>0)s+='<text x="12" y="'+(H-6)+'" font-size="11" fill="'+mu+'">Sem classificação 6M: '+fm(semQ)+' pç · '+fm(sem,1)+' kg ('+fm(tk>0?sem/tk*100:0,0)+'%) — classifique os motivos em Cadastro para completar o diagrama.</text>';
  return s+'</svg>';
}
function fishRows(a,b,pl){const PF=pl!=='u',PU=pl!=='f',ms=range(a,b);return G().refAll().filter(r=>ms.includes(r.k)&&(plc(r.pl)==='F'?PF:plc(r.pl)==='U'?PU:(PF&&PU)))}
function costOk(){try{return costAccessAllowed()}catch(e){return false}}
function tPeixe(d){
  const dk=document.documentElement.getAttribute('data-theme')==='dark';
  return '<div class="p3c"><h4>Espinha de peixe — causa e efeito (6M)</h4><div class="p3hint">O problema é o refugo do período. Cada espinha é um dos 6M, com quantidade, peso bruto fracionado e valor. Nas espinhas menores ficam os principais motivos. Clique em um M para detalhar.</div><div class="p3fish">'+fishSvg({rows:d.R,tema:dk?'dk':'lt',cost:d.cu})+'</div><div class="p3bar" style="margin-top:8px"><button class="btn secondary" type="button" data-a="png">⬇ Baixar imagem (PNG)</button>'+(d.cu?'':'<button class="btn secondary" type="button" data-a="cost">🔐 Mostrar valores (R$)</button>')+'</div><div id="p3det"></div></div>';
}
function detM(d,nm){
  const rr=d.R.filter(r=>r.causa===nm),tk=sum(rr,r=>N(r.kgB!=null?r.kgB:r.kg)),vk=r=>N(r.kgB!=null?r.kgB:r.kg);
  const l=(t,a)=>'<div><h5>'+t+'</h5>'+hbar(a,v=>fm(v,1)+' kg',tk,OR)+'</div>';
  det('<div class="p3dt"><h4>'+esc(nm)+' — '+fm(sum(rr,r=>N(r.qtd)))+' peças · '+fm(tk,1)+' kg'+(d.cu?' · R$ '+fm(sum(rr,r=>N(r.rs))):'')+'</h4><div class="p3g3">'+l('Todos os motivos',rank(rr,r=>r.mot,vk,8))+l('Peças',rank(rr,r=>(r.cod?r.cod+' - ':'')+(r.pec||''),vk,8))+l('Clientes',rank(rr,r=>r.cli,vk,8))+'</div></div>');
}
function pngFish(){
  const sv=document.querySelector('#painel360 .p3fs');if(!sv)return;
  const dk=document.documentElement.getAttribute('data-theme')==='dark',xml=new XMLSerializer().serializeToString(sv),im=new Image(),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
  im.onload=()=>{const c=document.createElement('canvas');c.width=2000;c.height=Math.round(2000*548/1000);const x=c.getContext('2d');x.fillStyle=dk?'#0f1720':'#ffffff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(b=>G().baixar(b,'espinha-de-peixe-6M.png'),'image/png')};
  im.onerror=()=>alert('Não foi possível gerar a imagem.');im.src=url;
}
/* ---------- página ---------- */
const CSS='.p3{--o:#ff6a1f}.p3 .p3bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.p3 .p3bar label{font-size:12px;font-weight:800;color:var(--muted)}.p3 .p3bar input,.p3 .p3bar select,.p3in{border:1px solid var(--border);border-radius:10px;padding:7px 10px;background:var(--card);color:var(--text);font:inherit}.p3in{width:100%;max-width:340px;margin:6px 0 10px}'+
'.p3tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px}.p3tabs button{white-space:nowrap;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:999px;padding:8px 15px;font-weight:800;cursor:pointer}.p3tabs button.on{background:linear-gradient(180deg,#ff9a55,#ff6a1f 55%,#d94a08);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(255,106,31,.4)}'+
'.p3kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:12px}.p3k{position:relative;border:1px solid var(--border);border-radius:14px;padding:12px 14px;background:linear-gradient(150deg,rgba(255,255,255,.1),rgba(255,255,255,.02) 40%,rgba(0,0,0,.1)),var(--card);box-shadow:var(--shadow,0 4px 14px rgba(0,0,0,.15)),inset 0 1px 0 rgba(255,255,255,.25);overflow:hidden}.p3k::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c);box-shadow:0 0 10px var(--c)}'+
'.p3k span{display:block;font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}.p3k b{display:block;font-size:26px;font-weight:900;margin:3px 0}.p3k small{display:block;font-size:11px}.p3sk{margin-top:4px;height:26px}.p3sp{width:100%;height:26px}'+
'.p3g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-bottom:12px}.p3g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}'+
'.p3c{border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;background:linear-gradient(150deg,rgba(255,255,255,.08),rgba(255,255,255,.01) 40%),var(--card);box-shadow:var(--shadow,0 4px 14px rgba(0,0,0,.12)),inset 0 1px 0 rgba(255,255,255,.22);min-width:0}.p3g2 .p3c{margin-bottom:0}.p3c h4{margin:0 0 10px;font-size:14px;display:flex;gap:8px;align-items:center}.p3c h4::before{content:"";width:5px;height:16px;border-radius:3px;background:linear-gradient(180deg,#ffb27a,#ff6a1f,#b53a04)}.p3c h5{margin:0 0 6px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}'+
'.p3svg{width:100%;height:auto;display:block;overflow:visible}.p3svg .gl{stroke:var(--border);stroke-width:1}.p3svg .ax{font-size:10.5px;fill:var(--muted)}.p3svg .vl{font-size:10px;font-weight:800;fill:var(--text)}.p3svg .bar{cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.28));transition:opacity .15s}.p3svg .bar:hover{opacity:.82}.p3svg .glow{filter:drop-shadow(0 0 5px currentColor)}'+
'.p3hint{font-size:12px;color:var(--muted);margin:6px 0}.mu{color:var(--muted)}.up{color:#ef4444;font-weight:800}.dn{color:#22c55e;font-weight:800}.p3lg{font-size:12px;color:var(--muted)}.p3lg i{display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--c);margin:0 4px 0 10px}'+
'.p3ul{margin:0;padding-left:18px;line-height:1.7}.hb .hr{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:8px;align-items:center;margin:5px 0;font-size:12.5px;cursor:default}.hb .hn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hb .ht{height:14px;border-radius:7px;background:rgba(0,0,0,.2);box-shadow:inset 0 1px 3px rgba(0,0,0,.4);overflow:hidden}.hb .ht i{display:block;height:100%;border-radius:7px;background:linear-gradient(180deg,var(--c),color-mix(in srgb,var(--c) 55%,#000));box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}.hb .hv{font-weight:800;white-space:nowrap}.hb small{color:var(--muted);font-weight:600}'+
'.p3hm{overflow:auto}.p3hm table{border-collapse:separate;border-spacing:3px;font-size:11.5px;width:100%}.p3hm th{font-weight:800;text-align:left;padding:3px 6px;white-space:nowrap;color:var(--muted)}.p3hm thead th{text-align:center}.p3hm td{min-width:40px;height:30px;text-align:center;border-radius:6px;background:rgba(127,140,155,.1);cursor:default}.p3hm td.on{background:rgba(255,106,31,calc(.12 + var(--a)*.88));color:#fff;font-weight:800;cursor:pointer;text-shadow:0 1px 2px rgba(0,0,0,.4)}.p3hm td.on:hover{outline:2px solid #fff}.p3hm td.tt{background:none;font-weight:900;color:var(--text)}'+
'.p3t{width:100%;border-collapse:collapse;font-size:12.5px}.p3t th{text-align:left;padding:8px;background:linear-gradient(180deg,#52657a,#26323f);color:#fff;border-bottom:2px solid #ff6a1f;white-space:nowrap}.p3t td{padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:middle}.p3t tbody tr{cursor:pointer}.p3t tbody tr:hover td{background:rgba(255,106,31,.1)}.ib{display:inline-block;width:60px;height:8px;border-radius:4px;background:rgba(0,0,0,.25);margin-right:6px;vertical-align:middle;overflow:hidden}.ib i{display:block;height:100%;background:linear-gradient(90deg,#ffb27a,#ff6a1f)}.p3t .p3sp{width:84px}'+
'.p3fish{overflow-x:auto}.p3fs{min-width:720px;max-width:1100px;margin:0 auto}.p3m:hover line{filter:brightness(1.2)}.p3dt{margin-top:12px;padding:12px;border:1px dashed var(--border);border-radius:12px;animation:p3in .3s both}@keyframes p3in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media(max-width:820px){.p3g2{grid-template-columns:1fr}.p3k b{font-size:21px}}';
let built=false,SIG='';
function build(){
  if(built||$('painel360'))return;built=true;
  const st=document.createElement('style');st.id='p3css';st.textContent=CSS;document.head.appendChild(st);
  const sec=document.createElement('section');sec.id='painel360';sec.className='page p3';
  const host=$('dashboardQtd');if(!host||!host.parentNode)return;host.parentNode.insertBefore(sec,host.nextSibling);
  document.querySelectorAll('.tab[data-page="dashboardQtd"]').forEach(b=>{const n=document.createElement('button');n.className='tab';n.dataset.page='painel360';n.type='button';n.innerHTML='📊 &nbsp; Painel 360';n.addEventListener('click',e=>{e.preventDefault();navigate('painel360');setTimeout(()=>render(true),60)});b.parentNode.insertBefore(n,b.nextSibling)});
  sec.addEventListener('click',onClick);sec.addEventListener('change',onChange);sec.addEventListener('input',onInput);
}
function render(force){
  const sec=$('painel360');if(!sec||!sec.classList.contains('active'))return;
  let sig='';try{sig=[Array.isArray(data)?data.length:0,pesoTipo(),window.devDados?window.devDados().length:0,(typeof rtLoad==='function'?rtLoad().length:0),S.a,S.b,S.pl,S.mt,S.tab].join('|')}catch(e){}
  if(!force&&sig===SIG&&sec.firstChild)return;SIG=sig;
  const g=G();let d;try{d=dados()}catch(e){console.error(e);sec.innerHTML='<div class="p3c">Não foi possível montar o painel.</div>';return}
  const pesoOpts=['bruto','liquido','usinado'].map(t=>'<option value="'+t+'"'+(pesoTipo()===t?' selected':'')+'>'+((typeof PESO_CURTO!=='undefined'&&PESO_CURTO[t])||t)+'</option>').join('');
  const f=document.activeElement&&document.activeElement.id==='p3q';
  let h=(window.__dbSubHtml?window.__dbSubHtml('painel360'):'')+'<div class="p3bar"><label>De</label><input type="month" id="p3a" value="'+S.a+'"><label>até</label><input type="month" id="p3b" value="'+S.b+'"><select id="p3pl"><option value="ab"'+(S.pl==='ab'?' selected':'')+'>Fundição + Usinagem</option><option value="f"'+(S.pl==='f'?' selected':'')+'>Só Fundição</option><option value="u"'+(S.pl==='u'?' selected':'')+'>Só Usinagem</option></select><select id="p3mt"><option value="kg"'+(S.mt==='kg'?' selected':'')+'>Peso (kg)</option><option value="qtd"'+(S.mt==='qtd'?' selected':'')+'>Quantidade (peças)</option></select><select id="p3pe" title="Tipo de peso">'+pesoOpts+'</select><button class="btn secondary" type="button" data-a="m6">Últimos 6 meses</button><button class="btn secondary" type="button" data-a="m12">12 meses</button><button class="btn secondary" type="button" data-a="ano">Ano atual</button><button class="btn primary" type="button" data-a="pdf">🖨 Imprimir / PDF</button></div>';
  h+='<div class="p3tabs">'+TABS.map(t=>'<button type="button" data-t="'+t[0]+'" class="'+(S.tab===t[0]?'on':'')+'">'+t[1]+'</button>').join('')+'</div>';
  h+={exec:tExec,pareto:tPareto,heat:tHeat,pecas:tPecas,cli:tCli,cal:tCal,peixe:tPeixe}[S.tab](d);
  sec.innerHTML=h;sec._d=d;
  if(f){const q=$('p3q');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}}
}
function onClick(e){
  const sec=$('painel360'),d=sec._d;
  const t=e.target.closest('[data-t]');if(t){S.tab=t.dataset.t;save();render(true);return}
  const a=e.target.closest('[data-a]');if(a){const k=a.dataset.a,h=hk();if(k==='m6'){S.b=h;S.a=G().addM(h,-5)}else if(k==='m12'){S.b=h;S.a=G().addM(h,-11)}else if(k==='ano'){S.a=h.slice(0,4)+'-01';S.b=h}else if(k==='pdf'){window.print();return}else if(k==='png'){pngFish();return}else if(k==='cost'){try{toggleCostAccess()}catch(x){}setTimeout(()=>render(true),400);return}save();render(true);return}
  const mm=e.target.closest('.p3m');if(mm){detM(d,mm.dataset.m);return}
  const bar=e.target.closest('rect.bar');if(bar&&S.tab==='pareto'){const mot=rank(d.R,r=>r.mot,d.vv,14)[+bar.dataset.i];if(mot)detMotivo(d,mot.nome);return}
  const c=e.target.closest('.p3hm td.on');if(c){detCel(d,c.dataset.r,c.dataset.k,c.dataset.w);return}
  const r=e.target.closest('.p3t tbody tr[data-cod]');if(r){detPeca(d,r.dataset.cod)}
}
function onChange(e){const id=e.target.id;if(id==='p3a'&&e.target.value){S.a=e.target.value;if(S.a>S.b)S.b=S.a}else if(id==='p3b'&&e.target.value){S.b=e.target.value;if(S.b<S.a)S.a=S.b}else if(id==='p3pl')S.pl=e.target.value;else if(id==='p3mt')S.mt=e.target.value;else if(id==='p3pe'){setPesoTipo(e.target.value);return}else return;save();render(true)}
let tq=0;function onInput(e){if(e.target.id==='p3q'){S.q=e.target.value;clearTimeout(tq);tq=setTimeout(()=>render(true),250)}}
function ini(){try{build()}catch(e){console.error(e)}}
ini();
window.addEventListener('pesotipo',()=>setTimeout(()=>render(true),30));
setInterval(()=>{try{render(false)}catch(e){}},1500);
window.__painel360={dados,render,fishSvg,fishRows,costOk};
})();

/* ==================================================================
   MENUS AGRUPADOS: "Dashboards" (Peso + Quantidade + Painel 360) e
   "Dados e auditoria" (Dados e backup + Auditoria) — menos abas.
   ================================================================== */
(function(){
const GR=[{main:'dashboard',label:'Dashboards',icon:'▣',tip:'Peso, Quantidade e Painel 360',items:[['dashboard','⚖ Peso'],['dashboardQtd','🔢 Quantidade'],['painel360','📊 Painel 360']]},
          {main:'dados',label:'Dados e auditoria',icon:'⚙',tip:'Dados e backup, e Auditoria',items:[['dados','💾 Dados e backup'],['auditoria','🗂 Auditoria']]}];
const grOf=p=>GR.find(g=>g.items.some(x=>x[0]===p));
const css=document.createElement('style');css.textContent='.dbSub{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.dbSub button{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:999px;padding:8px 16px;cursor:pointer;font:inherit;font-weight:800;transition:all .2s}.dbSub button:hover{border-color:#ff6a1f}.dbSub button.on{background:linear-gradient(180deg,#ff9a55,#ff6a1f 55%,#d94a08);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(255,106,31,.4)}@media print{.dbSub{display:none!important}}';document.head.appendChild(css);
window.__dbSubHtml=cur=>{const g=grOf(cur);return g?'<div class="dbSub">'+g.items.map(p=>'<button type="button" data-dbp="'+p[0]+'" class="'+(p[0]===cur?'on':'')+'">'+p[1]+'</button>').join('')+'</div>':''};
function rename(b,g){const sp=b.querySelector('span');if(sp)sp.textContent=g.label;else b.innerHTML=g.icon+' &nbsp; '+g.label;b.title=g.tip}
function ini(){
  GR.forEach(g=>{
    g.items.slice(1).forEach(it=>document.querySelectorAll('.tab[data-page="'+it[0]+'"]').forEach(b=>{b.style.display='none'}));
    document.querySelectorAll('.tab[data-page="'+g.main+'"]').forEach(b=>{if(b.dataset.grp!==g.label){rename(b,g);b.dataset.grp=g.label}});
    g.items.forEach(it=>{const sec=document.getElementById(it[0]);if(it[0]==='painel360')return;if(sec&&!sec.querySelector(':scope>.dbSub'))sec.insertAdjacentHTML('afterbegin',window.__dbSubHtml(it[0]))});
  });
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.dbSub button[data-dbp]');if(!b)return;e.preventDefault();navigate(b.dataset.dbp);if(b.dataset.dbp==='painel360')setTimeout(()=>{try{window.__painel360.render(true)}catch(x){}},80)});
const nav0=window.navigate;
if(typeof nav0==='function')window.navigate=function(page){
  const r=nav0.apply(this,arguments),g=grOf(page);
  if(g){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.page===g.main));const t=document.querySelector('.top-title h1');if(t)t.textContent=g.label+' — '+g.items.find(p=>p[0]===page)[1].replace(/^\S+\s/,'');setTimeout(ini,50)}
  return r;
};
ini();setInterval(ini,1200);
})();

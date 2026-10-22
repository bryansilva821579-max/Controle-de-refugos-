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
  let t1='<p>Em '+mes+' foram emitidas <b>'+fmt(rows.length)+'</b> etiqueta(s) de retrabalho, somando <b>'+fmt(tq)+'</b> peças.'+varTxt(tq,pq,mesP,'peças');
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
    {name:'Resumo',rows:[['Indicador','Valor'],['Mês',k],['Etiquetas',rows.length],['Peças em retrabalho',sum(rows,q)],['Peças OK',sum(rows,r=>N(r.qOk))],['Peças refugadas no retrabalho',sum(rows,r=>N(r.qRef))],['Tempo total com horário (min)',sum(rows.filter(r=>rtDur(r)!=null),r=>rtDur(r))],['Etiquetas abertas',rows.filter(r=>r.st!==RT_ST[2]).length]]},
    {name:'Etiquetas',rows:[['Emissão','Cód. sistema','Cliente','Produto','OF','Qtd','Material','Setor','Tipo de máquina','Local/máquina','Motivo','Status','Início','Fim','Duração (min)','Min/peça','Peças OK','Peças refugadas'],...rows.map(r=>[r.dt,r.cod||'',r.cli||'',r.prod||'',r.of||'',q(r),rtMatOf(r),r.setor||'',r.setor?(setorTipo(r.setor)||''):'',rtLocOf(r),r.mot||'',r.st,(r.di||'')+' '+(r.hi||''),(r.df||'')+' '+(r.hf||''),rtDur(r)==null?'':rtDur(r),mpp(r),N(r.qOk),N(r.qRef)])]},
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
  const host=$(c==='rt'?'rtRelatorio':'dvRelatorio');if(!host)return;
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
window.__relatorios={rtSecoes,dvSecoes,rtSheets,dvSheets,montar};
})();

window.__V=window.__V||{};window.__V.gestao='v172';
/* ==================================================================
   GESTÃO — alertas e metas, comparativo de períodos, cruzamento
   refugo × devolução e relatório mensal (PDF / Excel .xlsx).
   Só LÊ os dados do app (refugos, produção, devoluções); não grava
   nada neles. Guarda apenas as configurações dos alertas.
   ================================================================== */
(function(){
const $=id=>document.getElementById(id);
const CFGK='controle_refugos_2026_gestao_cfg';
let cfg={var:20,minKg:50,diasPend:7,fator:1.5};
try{Object.assign(cfg,JSON.parse(localStorage.getItem(CFGK)||'{}'))}catch(e){}
const MN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const mkKey=(y,m)=>y+'-'+String(m).padStart(2,'0');
const addM=(k,d)=>{const y=+k.slice(0,4),m=+k.slice(5,7)-1+d,yy=y+Math.floor(m/12),mm=((m%12)+12)%12;return mkKey(yy,mm+1)};
const lblM=k=>MN[+k.slice(5,7)-1]+'/'+k.slice(0,4);
const hojeK=()=>{const d=new Date();return mkKey(d.getFullYear(),d.getMonth()+1)};
const okCusto=()=>{try{return costAccessAllowed()}catch(e){return false}};
const RS=v=>'R$ '+fmt(v);
const pct=(a,b)=>b?((a-b)/b*100):null;
const fp=v=>v===null||v===undefined?'—':(v>0?'+':'')+fmt(v)+'%';

/* ---------- leitura dos dados ---------- */
function refAll(){
  const out=[];
  (Array.isArray(data)?data:[]).forEach(r=>{
    const y=recordYear(r),m=recordMonth(r);if(!y||!m)return;
    let dt='';try{const d0=date(r);if(d0)dt=d0.getFullYear()+'-'+String(d0.getMonth()+1).padStart(2,'0')+'-'+String(d0.getDate()).padStart(2,'0')}catch(e){}
    out.push({k:mkKey(y,m),dt,kgB:kgBruto(r),kg:kg(r),rs:cost(r),qtd:qty(r),pl:recordPlant(r),
      cli:canonicalClientName(val(r,'cliente'))||'Não informado',
      mot:motivoDescricao(r)||'Não informado',causa:causaPeloMotivo(r),
      cod:String(val(r,'codigo')||'').trim(),pec:String(val(r,'produto')||'').trim(),of:String(val(r,'of')||'').trim()});
  });
  return out;
}
function devAll(){
  let l=[];try{l=window.devDados()}catch(e){}
  return l.map(r=>({k:String(r.data||'').slice(0,7),data:r.data,kg:window.devKg(r),rs:window.devValor(r),qtd:N(r.qtd),
    cli:r.cliente||'Não informado',cod:String(r.codigo||'').trim(),pec:String(r.produto||'').trim(),tipo:window.devTipo(r),
    fq:r.numFq||'',mot:r.motivo||'',proc:r.procede||'',disp:r.disp||'Aguardando análise',raw:r}));
}
function prodDe(k){try{return prodMonthTotals().get(k.slice(0,4)+'-'+Number(k.slice(5,7)))||0}catch(e){return 0}}
const inRange=(k,a,b)=>k&&k>=a&&k<=b;
function somar(rows,f){return rows.reduce((a,r)=>a+f(r),0)}
function agrupar(rows,key,fields){
  const m=new Map();
  rows.forEach(r=>{const k=key(r)||'Não informado';let e=m.get(k);if(!e){e={nome:k};fields.forEach(f=>e[f]=0);m.set(k,e)}fields.forEach(f=>e[f]+=r[f]||0)});
  return [...m.values()];
}
function metricasMes(k,R,D){
  R=R||refAll();D=D||devAll();
  const rr=R.filter(r=>r.k===k),dd=D.filter(r=>r.k===k);
  const prod=prodDe(k),kgR=somar(rr,r=>r.kg),kgF=somar(rr.filter(r=>r.pl==='FUNDICAO'),r=>r.kg);
  return {k,prod,kg:kgR,kgF,rs:somar(rr,r=>r.rs),perc:prod?kgF/prod*100:null,
    dN:new Set(dd.map(r=>r.fq?r.data+'|'+r.fq+'|'+r.cli:r.raw.id)).size,dItens:dd.length,dQtd:somar(dd,r=>r.qtd),dKg:somar(dd,r=>r.kg),dRs:somar(dd,r=>r.rs)};
}
/* fator para projetar o mês corrente (parcial) */
function fatorProj(k){
  if(k!==hojeK())return 1;
  const d=new Date(),dias=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  return dias/Math.max(1,d.getDate());
}

/* ---------- alertas ---------- */
function calcAlertas(k){
  const R=refAll(),D=devAll(),A=[];
  const add=(sev,t,x)=>A.push({sev,t,x});
  const fpj=fatorProj(k),proj=k===hojeK();
  const mm=metricasMes(k,R,D),prev=[1,2,3].map(i=>addM(k,-i));
  const kgProj=mm.kg*fpj;
  /* meta % e meta kg */
  try{
    if(meta&&meta.perc>0&&mm.prod>0){
      const p=mm.kgF*fpj/mm.prod*100,r=p/meta.perc;
      if(r>1)add('crit','% de refugo da Fundição acima da meta','Refugo da Fundição '+(proj?'projetado ':'')+'de '+fmt(p)+'% contra meta de '+fmt(meta.perc)+'% ('+fmt(p-meta.perc)+' p.p. acima).');
      else if(r>=0.9)add('warn','% de refugo da Fundição perto da meta','Refugo da Fundição '+(proj?'projetado ':'')+'de '+fmt(p)+'% — meta de '+fmt(meta.perc)+'% (folga de '+fmt(100-r*100)+'%).');
    }else if(meta&&meta.perc>0&&!mm.prod){add('info','Sem produção lançada','Não há produção da Fundição lançada em '+lblM(k)+', então o % de refugo não pode ser calculado.')}
    if(meta&&meta.kg>0){
      const r=kgProj/meta.kg;
      if(r>1)add('crit','Meta de kg/mês estourada','Refugo '+(proj?'projetado ':'')+'de '+fmt(kgProj)+' kg contra limite de '+fmt(meta.kg)+' kg/mês.');
      else if(r>=0.9)add('warn','Perto do limite de kg/mês','Refugo '+(proj?'projetado ':'')+'de '+fmt(kgProj)+' kg — limite de '+fmt(meta.kg)+' kg/mês.');
    }
  }catch(e){}
  /* média dos 3 meses anteriores */
  const base=prev.map(p=>metricasMes(p,R,D)),com=base.filter(b=>b.kg>0);
  if(com.length){
    const med=somar(com,b=>b.kg)/com.length,v=pct(kgProj,med);
    if(v!==null&&v>cfg.var&&kgProj>=cfg.minKg)add('warn','Refugo acima do normal','Refugo '+(proj?'projetado ':'')+'de '+fmt(kgProj)+' kg está '+fmt(v)+'% acima da média dos meses anteriores ('+fmt(med)+' kg).');
  }
  /* clientes / motivos / causas que dispararam */
  const dispara=(titulo,key)=>{
    const atual=agrupar(R.filter(r=>r.k===k),key,['kg']);
    const hist=agrupar(R.filter(r=>prev.includes(r.k)),key,['kg']),hm=new Map(hist.map(h=>[h.nome,h.kg/3]));
    atual.map(a=>({nome:a.nome,kg:a.kg*fpj,med:hm.get(a.nome)||0})).filter(a=>a.kg>=cfg.minKg&&a.kg>a.med*cfg.fator)
      .sort((a,b)=>b.kg-a.kg).slice(0,3).forEach(a=>add('warn',titulo+' em alta: '+a.nome,fmt(a.kg)+' kg '+(proj?'(projeção) ':'')+(a.med?'contra média de '+fmt(a.med)+' kg nos 3 meses anteriores.':'— não aparecia nos 3 meses anteriores.')));
  };
  dispara('Cliente',r=>r.cli);dispara('Motivo',r=>r.mot);dispara('Causa',r=>r.causa);
  /* devoluções */
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const pend=D.filter(r=>r.disp==='Aguardando análise'&&r.data&&(hoje-new Date(r.data+'T00:00:00'))/86400000>cfg.diasPend);
  if(pend.length)add('crit','Devoluções sem destino definido','Há '+pend.length+' item(ns) de devolução aguardando análise há mais de '+cfg.diasPend+' dias ('+fmt(somar(pend,r=>r.qtd))+' peças).');
  const dBase=prev.map(p=>D.filter(r=>r.k===p)).filter(a=>a.length);
  const dAtual=D.filter(r=>r.k===k);
  if(dBase.length&&dAtual.length){
    const med=dBase.reduce((a,l)=>a+somar(l,r=>r.qtd),0)/dBase.length,q=somar(dAtual,r=>r.qtd)*fpj,v=pct(q,med);
    if(v!==null&&v>cfg.var&&med>0)add('warn','Devoluções acima do normal','Peças devolvidas '+(proj?'(projeção) ':'')+fmt(q)+' — '+fmt(v)+'% acima da média dos meses anteriores ('+fmt(med)+').');
  }
  /* reincidência refugo + devolução */
  const cr=cruzar(k,k,R,D).filter(x=>x.rKg>0&&x.dQtd>0);
  if(cr.length)add('warn',cr.length+' peça(s) com refugo e devolução no mês','Ex.: '+cr.slice(0,3).map(x=>x.cod||x.pec).join(', ')+'. Veja a aba "Refugo × Devolução".');
  /* qualidade dos dados */
  try{
    const Rk=R.filter(r=>r.k===k),tk=somar(Rk,r=>r.kg),sc=Rk.filter(r=>!r.causa||r.causa==='Não classificado');
    if(tk>0&&somar(sc,r=>r.kg)/tk>0.2)add('warn','Muitos motivos sem causa definida',fmt(somar(sc,r=>r.kg)/tk*100)+'% do refugo de '+lblM(k)+' (em kg) ainda não tem causa. Use Cadastro → Motivos → "Classificar motivos por causa".');
    const sp=Rk.filter(r=>r.qtd>0&&!(r.kg>0));
    if(sp.length)add('warn',sp.length+' lançamento(s) do mês sem peso','Produtos sem peso no cadastro fazem o refugo sair com 0 kg. Use Cadastro → Produtos → "Produtos sem peso" para completar. Ex.: '+[...new Set(sp.map(r=>r.cod||r.pec))].slice(0,4).join(', ')+'.');
    const bk=Number(localStorage.getItem(KEY+'_backup_ultimo')||0),dias=bk?Math.floor((Date.now()-bk)/864e5):null;
    if(dias===null)add('warn','Nenhum backup feito neste aparelho','Faça um backup em Dados e backup (o automático roda semanalmente quando está ligado).');
    else if(dias>14)add('warn','Backup desatualizado','O último backup foi há '+dias+' dias. Faça um novo em Dados e backup.');
  }catch(e){}
  if(!A.some(a=>a.sev==='crit'||a.sev==='warn'))add('ok','Tudo dentro do esperado','Nenhum alerta para '+lblM(k)+' com os parâmetros atuais.');
  const ord={crit:0,warn:1,info:2,ok:3};
  return A.sort((a,b)=>ord[a.sev]-ord[b.sev]);
}
function badge(){
  try{
    const n=calcAlertas(hojeK()).filter(a=>a.sev==='crit'||a.sev==='warn').length;
    document.querySelectorAll('[data-page="gestao"]').forEach(b=>{if(n)b.dataset.n=n;else delete b.dataset.n});
  }catch(e){console.warn('Gestão: alertas',e)}
}

/* ---------- cruzamento refugo × devolução ---------- */
function cruzar(a,b,R,D){
  R=R||refAll();D=D||devAll();
  const m=new Map(),chave=(cod,pec)=>String(cod||pec||'').trim().toUpperCase();
  R.filter(r=>inRange(r.k,a,b)).forEach(r=>{const c=chave(r.cod,r.pec);if(!c)return;let e=m.get(c);if(!e){e={cod:r.cod,pec:r.pec,cli:r.cli,rKg:0,rRs:0,dQtd:0,dKg:0,dRs:0};m.set(c,e)}e.rKg+=r.kg;e.rRs+=r.rs;if(!e.pec)e.pec=r.pec});
  D.filter(r=>inRange(r.k,a,b)).forEach(r=>{const c=chave(r.cod,r.pec);if(!c)return;let e=m.get(c);if(!e){e={cod:r.cod,pec:r.pec,cli:r.cli,rKg:0,rRs:0,dQtd:0,dKg:0,dRs:0};m.set(c,e)}e.dQtd+=r.qtd;e.dKg+=r.kg;e.dRs+=r.rs;if(!e.pec)e.pec=r.pec});
  return [...m.values()];
}

/* ---------- gráfico de barras agrupadas A × B ---------- */
function grupo(id,labels,A,B,nA,nB){
  const cv=$(id);if(!cv)return;
  const W=cv.clientWidth||cv.parentElement.clientWidth||600,H=cv.clientHeight||300,dpr=window.devicePixelRatio||1;
  cv.width=W*dpr;cv.height=H*dpr;const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const css=getComputedStyle(document.documentElement),txt=css.getPropertyValue('--text').trim()||'#222',mut=css.getPropertyValue('--muted').trim()||'#667',bor=css.getPropertyValue('--border').trim()||'#ddd',cA=css.getPropertyValue('--orange').trim()||'#ff5a18',cB='#1f5f99';
  if(!labels.length){c.fillStyle=mut;c.font='13px sans-serif';c.textAlign='center';c.fillText('Sem dados.',W/2,H/2);return}
  const pl=44,pr=10,pt=28,pb=64,x0=pl,x1=W-pr,y0=pt,y1=H-pb,gw=(x1-x0)/labels.length;
  const mx=(()=>{const m=Math.max(...A,...B,1),e=Math.pow(10,Math.floor(Math.log10(m))),f=m/e;return (f<=1?1:f<=2?2:f<=5?5:10)*e})();
  const f=v=>v>=1000?(v/1000).toFixed(1).replace('.',',')+'k':String(Math.round(v*10)/10).replace('.',',');
  c.font='11px sans-serif';c.lineWidth=1;
  for(let i=0;i<=4;i++){const y=y1-(y1-y0)*i/4;c.strokeStyle=bor;c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.stroke();c.fillStyle=mut;c.textAlign='right';c.fillText(f(mx*i/4),x0-6,y+4)}
  c.textAlign='left';c.fillStyle=cA;c.fillRect(x0,6,10,10);c.fillStyle=txt;c.fillText(nA,x0+14,15);c.fillStyle=cB;c.fillRect(x0+14+c.measureText(nA).width+16,6,10,10);c.fillStyle=txt;c.fillText(nB,x0+14+c.measureText(nA).width+30,15);
  const bw=Math.min(24,gw*.36);
  labels.forEach((l,i)=>{
    const cx=x0+gw*(i+.5),ha=(y1-y0)*A[i]/mx,hb=(y1-y0)*B[i]/mx;
    c.fillStyle=cA;c.fillRect(cx-bw-1,y1-ha,bw,ha);c.fillStyle=cB;c.fillRect(cx+1,y1-hb,bw,hb);
    c.fillStyle=mut;c.save();c.translate(cx,y1+10);c.rotate(-Math.PI/4);c.textAlign='right';c.fillText(String(l).length>20?String(l).slice(0,19)+'…':l,0,0);c.restore();
  });
}

/* ---------- relatório (estrutura única → HTML/PDF e Excel) ---------- */
function relatorio(k){
  const R=refAll(),D=devAll(),ok=okCusto(),mm=metricasMes(k,R,D),ant=metricasMes(addM(k,-1),R,D);
  const rr=R.filter(r=>r.k===k),dd=D.filter(r=>r.k===k);
  const totKg=mm.kg||0,sec=[];
  const kpis=[['Período',lblM(k)],['Produção da Fundição (kg)',fmt(mm.prod)],['Refugo total (kg)',fmt(mm.kg)],['Refugo da Fundição (kg)',fmt(mm.kgF)],['% de refugo da Fundição (refugo Fundição ÷ produção)',mm.perc===null?'—':fmt(mm.perc)+'%']];
  try{if(meta&&meta.perc)kpis.push(['Meta de % de refugo',fmt(meta.perc)+'%'])}catch(e){}
  try{if(meta&&meta.kg)kpis.push(['Meta de kg/mês',fmt(meta.kg)+' kg'])}catch(e){}
  kpis.push(['Valor do refugo (R$)',ok?RS(mm.rs):'restrito (senha)']);
  kpis.push(['Refugo vs mês anterior (kg)',fp(pct(mm.kg,ant.kg))]);
  kpis.push(['Devoluções — registros (etiquetas)',fmt(mm.dN)]);
  kpis.push(['Devoluções — itens / peças',fmt(mm.dItens)+' / '+fmt(mm.dQtd)]);
  kpis.push(['Devoluções — peso (kg)',fmt(mm.dKg)]);
  kpis.push(['Devoluções — valor (R$)',ok?RS(mm.dRs):'restrito (senha)']);
  const tabela=(titulo,arr,nomeCol,lim)=>{
    const l=arr.sort((a,b)=>b.kg-a.kg).slice(0,lim||999);
    const hs=[nomeCol,'Refugo (kg)','% do total','Qtd.'];if(ok)hs.push('Valor (R$)');
    sec.push({titulo,headers:hs,rows:l.map(e=>{const x=[e.nome,N(e.kg),totKg?e.kg/totKg*100:0,N(e.qtd)];if(ok)x.push(N(e.rs));return x}),fmts:ok?['t','n','p','n','n']:['t','n','p','n']});
  };
  tabela('Refugo por planta',agrupar(rr,r=>r.pl,['kg','qtd','rs']),'Planta');
  tabela('Refugo por causa do motivo',agrupar(rr,r=>r.causa,['kg','qtd','rs']),'Causa');
  tabela('Top 10 motivos',agrupar(rr,r=>r.mot,['kg','qtd','rs']),'Motivo',10);
  tabela('Top 10 clientes',agrupar(rr,r=>r.cli,['kg','qtd','rs']),'Cliente',10);
  tabela('Top 10 peças',agrupar(rr,r=>(r.cod?r.cod+' — ':'')+r.pec,['kg','qtd','rs']),'Peça',10);
  const hd=['Data','FQ','Planta','Cliente','Código','Peça','Qtd.','Kg'];if(ok)hd.push('Valor (R$)');hd.push('Problema','Procede','Destino');
  sec.push({titulo:'Devoluções do mês',headers:hd,fmts:ok?['t','t','t','t','t','t','n','n','n','t','t','t']:['t','t','t','t','t','t','n','n','t','t','t'],
    rows:dd.sort((a,b)=>String(a.data).localeCompare(String(b.data))).map(r=>{const x=[String(r.data||'').split('-').reverse().join('/'),r.fq,r.tipo,r.cli,r.cod,r.pec,r.qtd,r.kg];if(ok)x.push(r.rs);x.push(r.mot,r.proc,r.disp);return x})});
  const cr=cruzar(k,k,R,D).filter(x=>x.rKg>0&&x.dQtd>0).sort((a,b)=>(b.rKg+b.dKg)-(a.rKg+a.dKg));
  const hc=['Código','Peça','Cliente','Refugo (kg)','Devol. (peças)','Devol. (kg)'];if(ok)hc.push('Custo total (R$)');
  sec.push({titulo:'Peças com refugo e devolução no mês',headers:hc,fmts:ok?['t','t','t','n','n','n','n']:['t','t','t','n','n','n'],rows:cr.map(x=>{const r=[x.cod,x.pec,x.cli,x.rKg,x.dQtd,x.dKg];if(ok)r.push(x.rRs+x.dRs);return r})});
  sec.push({titulo:'Alertas do mês',headers:['Nível','Alerta','Detalhe'],fmts:['t','t','t'],rows:calcAlertas(k).map(a=>[{crit:'Crítico',warn:'Atenção',info:'Info',ok:'OK'}[a.sev],a.t,a.x])});
  return {k,titulo:'Relatório mensal — '+lblM(k),kpis,sec,ok};
}
function fmtCel(v,t){if(t==='n')return fmt(v);if(t==='p')return fmt(v)+'%';return v===null||v===undefined?'':String(v)}
function relHtml(rel,paraPdf){
  const ths=h=>h.map(x=>`<th>${esc(x)}</th>`).join('');
  return `<div class="rel"><h1>${esc(rel.titulo)}</h1><div class="sub">Controle de Refugos — gerado em ${new Date().toLocaleString('pt-BR')}${rel.ok?'':' • valores em R$ ocultos (custos protegidos por senha)'}</div>
  <h2>Resumo</h2><table class="kv"><tbody>${rel.kpis.map(([a,b])=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
  ${rel.sec.map(s=>`<h2>${esc(s.titulo)}</h2>${s.rows.length?`<table><thead><tr>${ths(s.headers)}</tr></thead><tbody>${s.rows.map(r=>`<tr>${r.map((v,i)=>`<td${s.fmts[i]==='t'?'':' class="n"'}>${esc(fmtCel(v,s.fmts[i]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p class="vz">Sem dados neste mês.</p>'}`).join('')}</div>`;
}
const RELCSS='.rel{font-family:Arial,Helvetica,sans-serif;color:#1d2733}.rel h1{font-size:20px;margin:0 0 2px}.rel .sub{font-size:11px;color:#667;margin-bottom:10px}.rel h2{font-size:14px;margin:16px 0 6px;border-left:4px solid #ff5a18;padding-left:8px;page-break-after:avoid}.rel table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px}.rel th,.rel td{border:1px solid #cfd6de;padding:4px 6px;text-align:left;vertical-align:top}.rel thead th{background:#eef2f6}.rel td.n{text-align:right;white-space:nowrap}.rel .kv th{width:42%;background:#f6f8fa}.rel .vz{font-size:11px;color:#667}.rel tr{page-break-inside:avoid}';
function gerarPdf(k){
  const rel=relatorio(k);
  const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();d.write('<!doctype html><html><head><meta charset="utf-8"><title>'+rel.titulo+'</title><style>@page{size:A4;margin:12mm}body{margin:0}'+RELCSS+'</style></head><body>'+relHtml(rel,true)+'</body></html>');d.close();
  setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){alert('Não foi possível abrir a impressão.')}setTimeout(()=>f.remove(),60000)},400);
}

/* ---------- gerador mínimo de .xlsx (sem bibliotecas) ---------- */
function crc32(b){let c,crc=-1;if(!crc32.t){crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crc32.t[n]=c}}for(let i=0;i<b.length;i++)crc=crc32.t[(crc^b[i])&255]^(crc>>>8);return(crc^-1)>>>0}
function zipStore(files){
  const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  files.forEach(f=>{
    const nm=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
    const lh=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0)]);
    parts.push(lh,nm,data);
    cen.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=lh.length+nm.length+data.length;
  });
  const cs=cen.reduce((a,x)=>a+x.length,0);
  parts.push(...cen,new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cs),...u32(off),0,0]));
  return new Blob(parts,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const xe=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const colL=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
function sheetXml(rows,hdrRows){
  const widths=[];
  rows.forEach(r=>r.forEach((v,i)=>{const l=String(v===null||v===undefined?'':(typeof v==='number'?v.toFixed(2):v)).length;widths[i]=Math.min(60,Math.max(widths[i]||8,l+2))}));
  const cols='<cols>'+widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>';
  const body=rows.map((r,ri)=>`<row r="${ri+1}">`+r.map((v,ci)=>{
    const ref=colL(ci)+(ri+1),h=hdrRows.has(ri);
    if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}" s="${h?1:2}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr" s="${h?1:0}"><is><t xml:space="preserve">${xe(v===null||v===undefined?'':v)}</t></is></c>`;
  }).join('')+'</row>').join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}
function xlsxBlob(sheets){
  const names=sheets.map((s,i)=>(s.name.replace(/[\\\/\?\*\[\]:]/g,' ').slice(0,31)||('Plan'+(i+1))));
  const files=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+names.map((n,i)=>`<sheet name="${xe(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F6"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'}
  ];
  sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows,s.hdr||new Set([0]))}));
  return zipStore(files);
}
function baixar(blob,nome){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
function relSheets(rel){
  const sheets=[{name:'Resumo',rows:[['Indicador','Valor'],...rel.kpis.map(([a,b])=>[a,b])]}];
  rel.sec.forEach(s=>{
    const rows=[s.headers,...s.rows.map(r=>r.map((v,i)=>s.fmts[i]==='t'?String(v??''):N(v)))];
    sheets.push({name:s.titulo,rows});
  });
  return sheets;
}
function gerarXlsx(k){
  const rel=relatorio(k);
  baixar(xlsxBlob(relSheets(rel)),'relatorio-'+k+'.xlsx');
}

/* ---------- relatório mensal no formato do relatório do PDF (gráficos + análise) ---------- */
const MES_EXT=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesExt=k=>MES_EXT[+k.slice(5,7)-1];
const isU=r=>r.pl==='USINAGEM',isM=r=>r.pl==='FUNDICAO'||r.pl==='FUNDICAO NA USINAGEM',isF=r=>r.pl==='FUNDICAO';
const COR='#ED7D31',COR2='#1f5f99',COR3='#a5a5a5';
function topo(rows,key,lim,med){
  const m=new Map();
  rows.forEach(r=>{const k=String(key(r)||'').trim()||'Não informado';let e=m.get(k);if(!e){e={nome:k,qtd:0,kg:0,rs:0};m.set(k,e)}e.qtd+=r.qtd;e.kg+=r.kg;e.rs+=r.rs});
  const f=med||'qtd';
  return [...m.values()].filter(e=>e[f]>0).sort((a,b)=>b[f]-a[f]).slice(0,lim||999);
}
const cut=(t,n)=>{t=String(t);return t.length>n?t.slice(0,n-1)+'…':t};
function novoCanvas(H){const S=2,W=1000,cv=document.createElement('canvas');cv.width=W*S;cv.height=H*S;const c=cv.getContext('2d');c.scale(S,S);c.fillStyle='#fff';c.fillRect(0,0,W,H);c.font='12px Arial, sans-serif';return {cv,c,W,H}}
function eixoY(c,x0,x1,y0,y1,mx,fmtf,cor){
  c.lineWidth=1;c.font='12px Arial, sans-serif';
  for(let i=0;i<=5;i++){const y=y1-(y1-y0)*i/5;c.strokeStyle='#d9d9d9';c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.stroke();c.fillStyle=cor||'#595959';c.textAlign='right';c.fillText(fmtf(mx*i/5),x0-8,y+4)}
  c.strokeStyle='#bfbfbf';c.beginPath();c.moveTo(x0,y1);c.lineTo(x1,y1);c.stroke();
}
function escala(m){if(m<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(m))),f=m/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function legenda(c,W,itens){let x=W-20;c.font='12px Arial, sans-serif';itens.slice().reverse().forEach(([nome,cor,tipo])=>{const w=c.measureText(nome).width;x-=w;c.fillStyle='#595959';c.textAlign='left';c.fillText(nome,x,18);x-=14;c.fillStyle=cor;if(tipo==='linha'){c.fillRect(x-4,13,18,3);}else c.fillRect(x,10,10,10);x-=22})}
function rotulos(c,labels,x0,gw,y1,rot){
  c.fillStyle='#404040';c.font='12px Arial, sans-serif';
  labels.forEach((l,i)=>{const cx=x0+gw*(i+.5);if(rot){c.save();c.translate(cx+4,y1+10);c.rotate(-Math.PI/4);c.textAlign='right';c.fillText(cut(l,28),0,0);c.restore()}else{c.textAlign='center';c.fillText(cut(l,14),cx,y1+18)}});
}
/* barras verticais simples (laranja, como no relatório em PDF) */
function imgBar(labels,vals,o){
  o=o||{};const rot=labels.length>6||labels.some(l=>String(l).length>12);
  const {cv,c,W,H}=novoCanvas(o.h||430),x0=58,x1=W-18,y0=34,y1=H-(rot?150:50),gw=(x1-x0)/Math.max(1,labels.length);
  const mx=escala(Math.max(...vals,0)*1.08),f=o.f||(v=>String(Math.round(v*100)/100).replace('.',','));
  eixoY(c,x0,x1,y0,y1,mx,v=>f(v));legenda(c,W,[[o.leg||'Total',COR]]);
  const bw=Math.min(54,gw*.6);
  vals.forEach((v,i)=>{const cx=x0+gw*(i+.5),h=(y1-y0)*v/mx;c.fillStyle=COR;c.fillRect(cx-bw/2,y1-h,bw,h);c.fillStyle='#262626';c.font='12px Arial, sans-serif';c.textAlign='center';c.fillText(f(v),cx,y1-h-6)});
  rotulos(c,labels,x0,gw,y1,rot);
  return cv.toDataURL('image/png');
}
/* barras empilhadas por mês (quantidade por planta) */
function imgStack(labels,series,o){
  o=o||{};const {cv,c,W,H}=novoCanvas(o.h||430),x0=58,x1=W-18,y0=34,y1=H-46,gw=(x1-x0)/Math.max(1,labels.length);
  const tot=labels.map((_,i)=>series.reduce((a,s)=>a+s.values[i],0)),mx=escala(Math.max(...tot,0)*1.08);
  eixoY(c,x0,x1,y0,y1,mx,v=>String(Math.round(v)).replace('.',','));legenda(c,W,series.map(s=>[s.name,s.cor]));
  const bw=Math.min(70,gw*.6);
  labels.forEach((l,i)=>{const cx=x0+gw*(i+.5);let y=y1;series.forEach(s=>{const h=(y1-y0)*s.values[i]/mx;if(h>0){c.fillStyle=s.cor;c.fillRect(cx-bw/2,y-h,bw,h);if(h>16){c.fillStyle='#fff';c.font='11px Arial, sans-serif';c.textAlign='center';c.fillText(String(Math.round(s.values[i])),cx,y-h/2+4)}y-=h}});c.fillStyle='#262626';c.font='bold 12px Arial, sans-serif';c.textAlign='center';c.fillText(String(Math.round(tot[i])),cx,y-6)});
  rotulos(c,labels,x0,gw,y1,false);
  return cv.toDataURL('image/png');
}
/* barras (%) com linha de meta */
function imgBarMeta(labels,vals,metaV,o){
  o=o||{};const {cv,c,W,H}=novoCanvas(o.h||400),x0=58,x1=W-18,y0=34,y1=H-46,gw=(x1-x0)/Math.max(1,labels.length);
  const mx=escala(Math.max(...vals,metaV||0,0.5)*1.15),f=v=>(Math.round(v*100)/100).toString().replace('.',',')+'%';
  eixoY(c,x0,x1,y0,y1,mx,f);legenda(c,W,[['% de refugo (Fundição)',COR],...(metaV?[['Meta',COR2,'linha']]:[])]);
  const bw=Math.min(54,gw*.6);
  vals.forEach((v,i)=>{const cx=x0+gw*(i+.5),h=(y1-y0)*v/mx;c.fillStyle=COR;c.fillRect(cx-bw/2,y1-h,bw,h);if(v>0){c.fillStyle='#262626';c.textAlign='center';c.fillText(f(v),cx,y1-h-6)}});
  if(metaV){const y=y1-(y1-y0)*metaV/mx;c.strokeStyle=COR2;c.lineWidth=2.5;c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.stroke()}
  rotulos(c,labels,x0,gw,y1,false);
  return cv.toDataURL('image/png');
}
const pc1=v=>fmt(v)+'%';
function lista(L,n,un){return L.slice(0,n).map(e=>fmt(un==='kg'?e.kg:e.qtd)+(un==='kg'?' kg':'')+' '+(un==='kg'?'':'por ')+esc(e.nome)).join('; ')}
function tMotivo(k,rowsG,prevG,nomeG){
  const tot=somar(rowsG,r=>r.qtd),L=topo(rowsG,r=>r.mot);
  if(!tot)return 'Sem refugo registrado neste mês para '+nomeG+'.';
  const t=L[0];let s=`<p>Em ${mesExt(k)} o motivo que mais refugamos em ${nomeG} foi <b>${esc(t.nome)}</b>, com ${fmt(t.qtd)} peças (${pc1(t.qtd/tot*100)} das ${fmt(tot)} peças do mês).`;
  const pv=somar(prevG.filter(r=>r.mot===t.nome),r=>r.qtd),pk=addM(k,-1);
  if(pv>0){const v=pct(t.qtd,pv);s+=` Em relação a ${mesExt(pk)}, esse motivo teve ${v<0?'queda':'aumento'} de ${pc1(Math.abs(v))} (${fmt(pv)} → ${fmt(t.qtd)} peças).`}
  else if(prevG.length)s+=` Esse motivo não aparecia em ${mesExt(pk)}.`;
  if(L.length>1)s+=` Na sequência: ${L.slice(1,3).map(e=>esc(e.nome)+' ('+fmt(e.qtd)+')').join(' e ')}.`;
  if(L.length>=3)s+=` Os 3 principais motivos concentram ${pc1(somar(L.slice(0,3),e=>e.qtd)/tot*100)} do refugo.`;
  s+='</p>';
  const ofs=topo(rowsG.filter(r=>r.mot===t.nome&&r.of),r=>r.of+'||'+(r.cod||r.pec),4);
  if(ofs.length)s+='<p>Principais OFs desse motivo:</p><ul>'+ofs.map(e=>{const [of,it]=e.nome.split('||');return `<li>${fmt(e.qtd)} peças da OF ${esc(of)} do item ${esc(it)}</li>`}).join('')+'</ul>';
  return s;
}
function tCliente(k,rowsG,nomeG){
  const tot=somar(rowsG,r=>r.qtd),L=topo(rowsG,r=>r.cli);
  if(!tot)return 'Sem refugo registrado neste mês para '+nomeG+'.';
  const t=L[0];let s=`<p>O cliente com mais peças refugadas em ${nomeG} foi <b>${esc(t.nome)}</b>, com ${fmt(t.qtd)} peças (${pc1(t.qtd/tot*100)} do total)`;
  if(L.length>1)s+=`, seguido de ${L.slice(1,3).map(e=>esc(e.nome)+' ('+fmt(e.qtd)+')').join(' e ')}`;
  s+='.';if(t.qtd/tot>0.3)s+=' Esse cliente concentra grande parte do refugo do mês.';s+='</p>';
  const mot=topo(rowsG.filter(r=>r.cli===t.nome),r=>r.mot,4);
  s+=`<p><b>${esc(t.nome)}</b> — principais motivos:</p><ul>`+mot.map(e=>`<li>${fmt(e.qtd)} peças por ${esc(e.nome)}</li>`).join('')+'</ul>';
  return s;
}
function tItem(k,rowsG,nomeG){
  const tot=somar(rowsG,r=>r.qtd),L=topo(rowsG,r=>(r.cod||r.pec));
  if(!tot)return 'Sem refugo registrado neste mês para '+nomeG+'.';
  const t=L[0],desc=(rowsG.find(r=>(r.cod||r.pec)===t.nome)||{}).pec||'';
  let s=`<p>O item mais refugado em ${nomeG} foi <b>${esc(t.nome)}</b>${desc&&desc!==t.nome?' ('+esc(cut(desc,50))+')':''}, com ${fmt(t.qtd)} peças (${pc1(t.qtd/tot*100)} do total)`;
  const cl=topo(rowsG.filter(r=>(r.cod||r.pec)===t.nome),r=>r.cli,1)[0];if(cl)s+=`, do cliente ${esc(cl.nome)}`;
  s+='.';if(L.length>=3)s+=` Os 3 itens mais refugados somam ${pc1(somar(L.slice(0,3),e=>e.qtd)/tot*100)} das peças.`;s+='</p>';
  const mot=topo(rowsG.filter(r=>(r.cod||r.pec)===t.nome),r=>r.mot,4);
  s+=`<p>${esc(t.nome)} — por motivo:</p><ul>`+mot.map(e=>`<li>${fmt(e.qtd)} peças por ${esc(e.nome)}</li>`).join('')+'</ul>';
  return s;
}
const EDK='controle_refugos_2026_gestao_reltxt';
function lerEdits(){try{const o=JSON.parse(localStorage.getItem(EDK)||'{}');return o&&typeof o==='object'?o:{}}catch(e){return {}}}
function gravarEdit(k,n,html){const o=lerEdits();o[k]=o[k]||{};if(html===null)delete o[k][n];else o[k][n]=html;try{localStorage.setItem(EDK,JSON.stringify(o))}catch(e){}}
function limparHtml(h){
  try{
    const d=new DOMParser().parseFromString('<body>'+h+'</body>','text/html');
    d.body.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button').forEach(x=>x.remove());
    d.body.querySelectorAll('*').forEach(x=>{[...x.attributes].forEach(a=>{if(/^on/i.test(a.name)||/^\s*javascript:/i.test(a.value)||a.name==='style'||a.name==='contenteditable')x.removeAttribute(a.name)})});
    return d.body.innerHTML;
  }catch(e){return ''}
}
function relCompleto(k,numTxt,opt){
  opt=opt||{};const EDIT=!!opt.edit,EDS=lerEdits()[k]||{};
  const R=refAll(),D=devAll(),ok=okCusto(),ano=k.slice(0,4),pk=addM(k,-1);
  const rows=R.filter(r=>r.k===k),prev=R.filter(r=>r.k===pk);
  const rU=rows.filter(isU),rM=rows.filter(isM),pU=prev.filter(isU),pM=prev.filter(isM);
  const secs=[];let n=0;
  const sec=(titulo,img,txt,pre)=>{
    n++;const ed=EDS[n]!==undefined?limparHtml(EDS[n]):undefined,body=ed!==undefined?ed:txt;
    const barra=EDIT?`<div class="ed-bar no-print">${ed!==undefined?'✎ texto editado por você — ':'✎ clique no texto para editar — '}${ed!==undefined?`<a href="#" data-restore="${n}">↺ restaurar texto automático</a>`:'a análise acima foi gerada automaticamente'}</div>`:'';
    secs.push(`<div class="sec"><h2>${n}. ${esc(titulo)}</h2>${img?`<img src="${img}" alt="">`:''}${pre||''}<div class="txt"${EDIT?` contenteditable="true" spellcheck="true" data-sec="${n}"`:''}>${body}</div>${barra}</div>`);
  };
  const vazio=(rs)=>!somar(rs,r=>r.qtd);
  /* 1-3 Usinagem */
  const gm=(rs,key,lim)=>topo(rs,key,lim);
  const barQ=(rs,key,lim,rotulo)=>{const L=gm(rs,key,lim||12);return L.length?imgBar(L.map(e=>rotulo?rotulo(e):e.nome),L.map(e=>e.qtd),{f:v=>String(Math.round(v))}):null};
  sec('Total de peças por Motivo Metal (Usinagem).',barQ(rU,r=>r.mot),tMotivo(k,rU,pU,'usinagem'));
  sec('Total de peças por cliente Metal (Usinagem).',barQ(rU,r=>r.cli),tCliente(k,rU,'usinagem'));
  sec('Total de peças por item Metal (Usinagem).',barQ(rU,r=>(r.cod||r.pec),20),tItem(k,rU,'usinagem'));
  /* 4-6 Metalúrgica */
  sec('Total de peças por Motivo Metalúrgica (Fundição e Fundição na Usinagem).',barQ(rM,r=>r.mot,25),tMotivo(k,rM,pM,'fundição / fundição na usinagem'));
  sec('Total de peças por cliente Metalúrgica (Fundição e Fundição na Usinagem).',barQ(rM,r=>r.cli,25),tCliente(k,rM,'fundição / fundição na usinagem'));
  sec('Total de peças por item Metalúrgica (Fundição e Fundição na Usinagem).',barQ(rM,r=>(r.cod||r.pec),20),tItem(k,rM,'fundição / fundição na usinagem'));
  /* 7 peso por item (fundição) */
  const rF=rows.filter(isF),kgF=somar(rF,r=>r.kg),prod=prodDe(k),Lk=topo(rF,r=>(r.cod||r.pec),15,'kg'),rsF=somar(rF,r=>r.rs);
  let t7='';
  if(!kgF)t7='<p>Sem refugo de peso registrado na fundição neste mês.</p>';
  else{
    t7=`<p>Em ${mesExt(k)} fechamos com <b>${fmt(kgF)} kg</b> de refugo somente na fundição.`;
    if(prod){const p=kgF/prod*100;t7+=` Pelos indicadores do sistema, fundimos ${fmt(prod)} kg; o refugo representa <b>${pc1(p)}</b> do total fundido, considerando apenas a fundição.`;try{if(meta&&meta.perc)t7+=p<=meta.perc?` Isso está dentro da meta de ${pc1(meta.perc)}.`:` Isso está ${fmt(p-meta.perc)} p.p. acima da meta de ${pc1(meta.perc)}.`}catch(e){}}
    else t7+=' Não há produção da fundição lançada neste mês, então o percentual não pôde ser calculado.';
    const pkF=somar(prev.filter(isF),r=>r.kg);if(pkF>0){const v=pct(kgF,pkF);t7+=` Em relação a ${mesExt(pk)} (${fmt(pkF)} kg) houve ${v<0?'redução':'aumento'} de ${pc1(Math.abs(v))}.`}
    t7+=` O item de maior peso refugado foi ${esc(Lk[0].nome)} (${fmt(Lk[0].kg)} kg). No gráfico estão os ${Lk.length} primeiros da lista.`;
    if(ok)t7+=` Valor estimado do refugo da fundição: ${RS(rsF)}.`;
    t7+='</p>';
  }
  sec('Total de peso (Kg) por item — Fundição.',Lk.length?imgBar(Lk.map(e=>e.nome),Lk.map(e=>e.kg),{f:v=>String(Math.round(v*100)/100).replace('.',','),leg:'Kg'}):null,t7);
  /* 8 tabela e gráfico por mês */
  const mkeys=[];for(let m=1;m<=+k.slice(5,7);m++)mkeys.push(mkKey(ano,m));
  const plantas=[['FUNDICAO','FUNDICAO',COR],['FUNDICAO NA USINAGEM','FUNDICAO NA USINAGEM',COR3],['USINAGEM','USINAGEM','#ffc000']];
  const qtdMes=mkeys.map(mk=>plantas.map(([p])=>somar(R.filter(r=>r.k===mk&&r.pl===p),r=>r.qtd)));
  const totCol=plantas.map((_,j)=>qtdMes.reduce((a,l)=>a+l[j],0));
  const tab=`<table class="tb"><thead><tr><th>Mês</th>${plantas.map(p=>`<th>${p[0]}</th>`).join('')}<th>Total geral</th></tr></thead><tbody>${mkeys.map((mk,i)=>`<tr><td>${+mk.slice(5,7)}</td>${qtdMes[i].map(v=>`<td class="n">${fmt(v)}</td>`).join('')}<td class="n">${fmt(qtdMes[i].reduce((a,b)=>a+b,0))}</td></tr>`).join('')}<tr class="tt"><td>Total geral</td>${totCol.map(v=>`<td class="n">${fmt(v)}</td>`).join('')}<td class="n">${fmt(totCol.reduce((a,b)=>a+b,0))}</td></tr></tbody></table>`;
  const totM=qtdMes.map(l=>l.reduce((a,b)=>a+b,0)),i=mkeys.length-1;
  let t8=`<p>Em ${mesExt(k)} foram ${fmt(totM[i])} peças refugadas no total`;
  if(i>0){const v=pct(totM[i],totM[i-1]);t8+=`, ${v===null?'':(v<0?'uma queda':'um aumento')+' de '+pc1(Math.abs(v||0))+' em relação a '+mesExt(pk)+' ('+fmt(totM[i-1])+' peças)'}`}
  t8+='.';const mp=qtdMes[i].indexOf(Math.max(...qtdMes[i]));if(totM[i])t8+=` A planta com maior volume foi ${plantas[mp][0]} (${fmt(qtdMes[i][mp])} peças).`;
  const mpior=totM.indexOf(Math.max(...totM));t8+=` No acumulado do ano (jan a ${MN[+k.slice(5,7)-1].toLowerCase()}) são ${fmt(totM.reduce((a,b)=>a+b,0))} peças; o mês de maior refugo até aqui foi ${mesExt(mkeys[mpior])} (${fmt(totM[mpior])} peças).</p>`;
  sec('Tabela e gráfico de total por mês em quantidade.',imgStack(mkeys.map(mk=>MN[+mk.slice(5,7)-1]),plantas.map((p,j)=>({name:p[0],cor:p[2],values:qtdMes.map(l=>l[j])}))),t8,tab);
  /* 9 % por mês x meta */
  const percs=mkeys.map(mk=>{const p=prodDe(mk);return p?somar(R.filter(r=>r.k===mk&&isF(r)),r=>r.kg)/p*100:0});
  let metaP=0;try{metaP=(meta&&meta.perc)||0}catch(e){}
  const comProd=percs.map((p,j)=>({p,j})).filter(x=>x.p>0);
  let t9='';
  if(!comProd.length)t9='<p>Não há produção da fundição lançada nos meses do ano para calcular o percentual.</p>';
  else{
    const cur=percs[i],ult=percs.slice(Math.max(0,i-2),i+1).filter(v=>v>0),med=ult.reduce((a,b)=>a+b,0)/(ult.length||1),mel=comProd.reduce((a,x)=>x.p<a.p?x:a,comProd[0]),pio=comProd.reduce((a,x)=>x.p>a.p?x:a,comProd[0]);
    t9=`<p>O refugo da fundição em ${mesExt(k)} foi de <b>${pc1(cur)}</b> sobre a produção${metaP?(cur<=metaP?`, dentro da meta de ${pc1(metaP)}`:`, ${fmt(cur-metaP)} p.p. acima da meta de ${pc1(metaP)}`):''}. A média dos últimos ${ult.length} mês(es) com produção é de ${pc1(med)}. Melhor mês do ano: ${mesExt(mkeys[mel.j])} (${pc1(mel.p)}); pior: ${mesExt(mkeys[pio.j])} (${pc1(pio.p)}).</p>`;
  }
  sec('Percentual de refugo da Fundição por mês (refugo ÷ produção).',comProd.length?imgBarMeta(mkeys.map(mk=>MN[+mk.slice(5,7)-1]),percs,metaP):null,t9);
  /* 10 causa */
  const Lc=topo(rows,r=>r.causa,8),totQ=somar(rows,r=>r.qtd);
  let t10='';
  if(!totQ)t10='<p>Sem refugo registrado neste mês.</p>';
  else{
    t10=`<p>Por causa do motivo, em ${mesExt(k)}: ${Lc.map(e=>`<b>${esc(e.nome)}</b> ${fmt(e.qtd)} peças (${pc1(e.qtd/totQ*100)})`).join('; ')}.`;
    const nc=Lc.find(e=>e.nome==='Não classificado');if(nc&&nc.qtd/totQ>0.2)t10+=' Há muitos motivos ainda sem causa definida: classifique-os em Cadastro → Motivos para melhorar esta análise.';
    t10+='</p>';
  }
  sec('Total de peças por causa do motivo (6M: Mão de obra, Máquina, Método, Material, Meio ambiente, Medição, Outros).',Lc.length?imgBar(Lc.map(e=>e.nome),Lc.map(e=>e.qtd),{f:v=>String(Math.round(v))}):null,t10);
  /* 11 devoluções */
  const dd=D.filter(r=>r.k===k),dq=somar(dd,r=>r.qtd),dkg=somar(dd,r=>r.kg),dN=new Set(dd.map(r=>r.fq?r.data+'|'+r.fq+'|'+r.cli:r.raw.id)).size;
  let t11='';const Ld=topo(dd,r=>r.cli,10);
  if(!dd.length)t11='<p>Nenhuma devolução registrada neste mês.</p>';
  else{
    const pdv=D.filter(r=>r.k===pk),pq=somar(pdv,r=>r.qtd);
    t11=`<p>Em ${mesExt(k)} foram ${fmt(dN)} registro(s) de devolução, com ${fmt(dd.length)} item(ns), ${fmt(dq)} peças e ${fmt(dkg)} kg${ok?' (valor estimado '+RS(somar(dd,r=>r.rs))+')':''}.`;
    if(pq>0){const v=pct(dq,pq);t11+=` Em relação a ${mesExt(pk)} (${fmt(pq)} peças) houve ${v<0?'queda':'aumento'} de ${pc1(Math.abs(v))}.`}
    t11+=` O cliente com mais peças devolvidas foi ${esc(Ld[0].nome)} (${fmt(Ld[0].qtd)}).`;
    const mo=topo(dd,r=>r.mot,1)[0];if(mo&&mo.nome!=='Não informado')t11+=` Principal problema informado: ${esc(mo.nome)} (${fmt(mo.qtd)} peças).`;
    const pend=dd.filter(r=>r.disp==='Aguardando análise').length;if(pend)t11+=` ${pend} item(ns) ainda aguardam análise/destino.`;
    t11+='</p>';
  }
  sec('Devoluções do mês — peças por cliente.',Ld.length?imgBar(Ld.map(e=>e.nome),Ld.map(e=>e.qtd),{f:v=>String(Math.round(v))}):null,t11);
  /* 12 valor */
  if(ok){
    const Lp=plantas.map(([p])=>({nome:p,rs:somar(rows.filter(r=>r.pl===p),r=>r.rs),kg:somar(rows.filter(r=>r.pl===p),r=>r.kg)})).filter(e=>e.rs>0);
    const tr=somar(rows,r=>r.rs);
    let t12=!tr?'<p>Sem valor de refugo no mês.</p>':`<p>O valor estimado do refugo de ${mesExt(k)} é de <b>${RS(tr)}</b> (${fmt(somar(rows,r=>r.kg))} kg). ${Lp.map(e=>esc(e.nome)+': '+RS(e.rs)+' ('+pc1(e.rs/tr*100)+')').join('; ')}.`+(()=>{const a=somar(prev,r=>r.rs);if(a>0){const v=pct(tr,a);return ' Em relação a '+mesExt(pk)+' ('+RS(a)+') houve '+(v<0?'redução':'aumento')+' de '+pc1(Math.abs(v))+'.'}return ''})()+'</p>';
    sec('Valor estimado do refugo por planta (R$).',Lp.length?imgBar(Lp.map(e=>e.nome),Lp.map(e=>e.rs),{f:v=>String(Math.round(v)),leg:'R$'}):null,t12);
  }
  const logo=(document.querySelector('.sidebar .brand img')||{}).src||'';
  const hoje=new Date().toLocaleDateString('pt-BR');
  const cab=`<div class="cab"><div class="cl">${logo?`<img src="${logo}" alt="logo">`:''}</div><div class="cm">Relatório mensal refugos: ${mesExt(k)} de ${ano}</div><div class="cr"><b>N° ${esc(numTxt||'—')}</b><span>${hoje}</span></div></div>`;
  return `<table class="rp"><thead><tr><td>${cab}</td></tr></thead><tbody><tr><td>${secs.join('')}</td></tr></tbody></table>`;
}
const REPCSS='.sec .txt[contenteditable]{outline:1px dashed #c9d1d9;border-radius:6px;padding:4px;min-height:24px}.sec .txt[contenteditable]:focus{outline:2px solid #ED7D31;background:#fffaf5}.ed-bar{font:11px Arial,sans-serif;color:#667;margin-top:4px}.ed-bar a{color:#1f5f99;cursor:pointer}@media print{.no-print{display:none!important}}.rp{width:100%;border-collapse:collapse;font-family:"Times New Roman",Times,serif;color:#000;font-size:13px}.rp>thead>tr>td,.rp>tbody>tr>td{padding:0;border:0}.cab{display:flex;align-items:flex-start;justify-content:space-between;padding:0 0 8px}.cab .cl img{height:54px}.cab .cm{flex:1;font-weight:bold;font-size:15px;padding:12px 16px 0}.cab .cr{text-align:right}.cab .cr b{display:block;font-size:13px}.cab .cr span{display:inline-block;margin-top:14px;font-weight:bold;border-bottom:1px solid #000}.sec{page-break-inside:avoid;margin:0 0 18px}.sec h2{font-size:13.5px;margin:10px 0 6px;padding-left:4px}.sec img{width:100%;display:block;border:1px solid #d9d9d9}.sec .txt{margin-top:8px;line-height:1.45;text-align:justify}.sec .txt p{margin:0 0 6px}.sec .txt ul{margin:2px 0 6px 20px;padding:0}.tb{border-collapse:collapse;width:100%;margin:4px 0 8px;font-size:12px}.tb th,.tb td{border:1px solid #999;padding:3px 6px}.tb th{background:#ED7D31;color:#fff}.tb td.n{text-align:right}.tb tr.tt td{font-weight:bold;background:#f2f2f2}';
function gerarPdfRel(k){
  const html=relCompleto(k,($('gRelNum')||{}).value,{edit:false});
  const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();d.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório mensal refugos '+k+'</title><style>@page{size:A4;margin:12mm}body{margin:0}'+REPCSS+'</style></head><body>'+html+'</body></html>');d.close();
  const imgs=[...d.images];
  Promise.all(imgs.map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=im.onerror=r}))).then(()=>setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){alert('Não foi possível abrir a impressão.')}setTimeout(()=>f.remove(),60000)},300));
}

/* ---------- interface ---------- */
let aba='alertas',built=false,cmpDim='planta';
function css(){
  const st=document.createElement('style');
  st.textContent='.tab[data-page=gestao][data-n]::after{content:attr(data-n);background:#d32f2f;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:800;margin-left:6px}.g-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.g-tab{border:1px solid var(--border);background:var(--card);color:var(--text);padding:9px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px}.g-tab.on{background:var(--orange);color:#fff;border-color:var(--orange)}.g-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.g-bar label{font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}.g-al{border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid var(--border);border-left:6px solid #999;background:var(--card)}.g-al.crit{border-left-color:#d32f2f;background:rgba(211,47,47,.08)}.g-al.warn{border-left-color:#f59e0b;background:rgba(245,158,11,.10)}.g-al.ok{border-left-color:#157348;background:rgba(21,115,72,.08)}.g-al.info{border-left-color:#1f5f99;background:rgba(31,95,153,.08)}.g-al b{display:block;margin-bottom:2px}.g-al span{font-size:13px}.g-up{color:#d32f2f;font-weight:800}.g-down{color:#157348;font-weight:800}.g-prev{background:#fff;color:#1d2733;border-radius:12px;padding:16px;border:1px solid var(--border);overflow:auto}'+RELCSS;
  document.head.appendChild(st);
}
function build(){
  const root=$('gestRoot');if(!root)return;
  root.innerHTML=`
  <div class="g-tabs">
    <button type="button" class="g-tab" data-g="visao" onclick="gestAba('visao')">🧭 Visão geral</button>
    <button type="button" class="g-tab on" data-g="alertas" onclick="gestAba('alertas')">🔔 Alertas e metas</button>
    <button type="button" class="g-tab" data-g="comp" onclick="gestAba('comp')">⚖ Comparativo</button>
    <button type="button" class="g-tab" data-g="cruz" onclick="gestAba('cruz')">🔗 Refugo × Devolução</button>
    <button type="button" class="g-tab" data-g="rel" onclick="gestAba('rel')">📑 Relatório mensal</button>
    <button type="button" class="g-tab" data-g="analise" onclick="gestAba('analise')">⌕ Análises</button>
    <button type="button" class="g-tab" data-g="relOld" onclick="gestAba('relOld')">▤ Relatórios</button>
  </div>
  <div id="gAlertas">
    <div class="panel"><div class="g-bar"><strong>Mês analisado</strong><input type="month" id="gAlMes"><button class="btn secondary" type="button" onclick="gestAlMesAtual()">Mês atual</button></div>
    <div id="gAlLista"></div></div>
    <div class="panel" style="margin-top:12px"><h3>Parâmetros dos alertas</h3><div class="hint">A meta de % e de kg/mês é definida em Cadastro → Metas. Aqui você ajusta a sensibilidade.</div>
      <div class="g-bar"><label>Aviso se subir mais de <input id="gCfgVar" type="number" min="1" step="1" style="width:70px"> % sobre a média</label>
      <label>Ignorar abaixo de <input id="gCfgMin" type="number" min="0" step="1" style="width:80px"> kg</label>
      <label>Cliente/motivo em alta se passar <input id="gCfgFat" type="number" min="1" step="0.1" style="width:70px">× a média</label>
      <label>Devolução pendente após <input id="gCfgDias" type="number" min="1" step="1" style="width:70px"> dias</label>
      <button class="btn primary" type="button" onclick="gestSalvarCfg()">Salvar parâmetros</button></div></div>
  </div>
  <div id="gComp" style="display:none">
    <div class="panel"><div class="g-bar"><strong>Período A</strong><input type="month" id="gCmpA"><strong>contra B</strong><input type="month" id="gCmpB">
      <button class="btn secondary" type="button" onclick="gestCmpRapido('ant')">Mês anterior</button><button class="btn secondary" type="button" onclick="gestCmpRapido('ano')">Mesmo mês do ano passado</button></div>
      <div class="tablewrap"><table><thead><tr><th>Indicador</th><th id="gCmpTA">A</th><th id="gCmpTB">B</th><th>Diferença</th><th>Variação</th></tr></thead><tbody id="gCmpBody"></tbody></table></div></div>
    <div class="panel" style="margin-top:12px"><div class="g-bar"><strong>Detalhar refugo por</strong>
      <select id="gCmpDim"><option value="planta">Planta</option><option value="causa">Causa do motivo</option><option value="motivo">Motivo</option><option value="cliente">Cliente</option><option value="peca">Peça</option></select></div>
      <div class="chartbox" style="height:300px"><canvas id="gCmpCv"></canvas></div>
      <div class="tablewrap"><table><thead><tr id="gCmpHead"></tr></thead><tbody id="gCmpDet"></tbody></table></div></div>
  </div>
  <div id="gCruz" style="display:none">
    <div class="panel"><div class="g-bar"><strong>Período</strong><input type="month" id="gCrA"> <span>até</span> <input type="month" id="gCrB">
      <label><input type="checkbox" id="gCrSo" checked> só peças com refugo <b>e</b> devolução</label></div>
      <div class="cards" id="gCrKpi"></div>
      <div class="tablewrap"><table><thead id="gCrHead"></thead><tbody id="gCrBody"></tbody></table></div></div>
  </div>
  <div id="gRel" style="display:none">
    <div class="panel"><div class="g-bar"><strong>Mês do relatório</strong><input type="month" id="gRelMes">
      <label>Nº do relatório <input id="gRelNum" placeholder="Ex.: 13/26" style="width:90px"></label>
      <button class="btn primary" type="button" onclick="gestPdf()">📄 Gerar PDF</button><button class="btn secondary" type="button" onclick="gestXlsx()">📊 Dados em Excel (.xlsx)</button></div>
      <div class="hint"><b>Os textos de análise podem ser editados:</b> clique em qualquer texto abaixo, ajuste ou acrescente o seu contexto (fica salvo por mês e entra no PDF). Relatório no formato mensal da qualidade: gráficos de peças por motivo, cliente e item (Usinagem e Metalúrgica), peso, evolução mensal, causa e devoluções, cada um com uma análise do período. O PDF abre a janela de impressão (escolha “Salvar como PDF”). Valores em R$ só entram com os custos liberados.</div>
      <div id="gRelPrev" class="g-prev"></div></div>
  </div>
  <div id="gVisao" style="display:none"></div>
  <div id="gAnalise" style="display:none"><div id="gAnalisePane"></div></div>
  <div id="gRelOld" style="display:none"><div id="gRelOldPane"></div></div>
  </div>`;
  const mAtual=hojeK();
  ['gAlMes','gCmpA','gCrB','gRelMes'].forEach(id=>$(id).value=mAtual);
  $('gCmpB').value=addM(mAtual,-1);$('gCrA').value=addM(mAtual,-5);
  $('gCfgVar').value=cfg.var;$('gCfgMin').value=cfg.minKg;$('gCfgFat').value=cfg.fator;$('gCfgDias').value=cfg.diasPend;
  ['gAlMes'].forEach(id=>$(id).addEventListener('change',alertasUi));
  ['gCmpA','gCmpB','gCmpDim'].forEach(id=>$(id).addEventListener('change',compUi));
  ['gCrA','gCrB','gCrSo'].forEach(id=>$(id).addEventListener('change',cruzUi));
  $('gRelMes').addEventListener('change',relUi);
  const mover=(id,pane)=>{const s=document.getElementById(id),p=$(pane);if(s&&p){s.classList.remove('page','active');p.appendChild(s)}};
  mover('analise','gAnalisePane');mover('relatorio','gRelOldPane');
  try{const n=localStorage.getItem('controle_refugos_2026_gestao_relnum');if(n)$('gRelNum').value=n}catch(e){}
  $('gRelNum').addEventListener('change',()=>{try{localStorage.setItem('controle_refugos_2026_gestao_relnum',$('gRelNum').value)}catch(e){}relUi()});
  built=true;
}
function alertasUi(){
  const k=$('gAlMes').value||hojeK();
  const L=calcAlertas(k);
  $('gAlLista').innerHTML=L.map(a=>`<div class="g-al ${a.sev}"><b>${{crit:'🔴',warn:'🟠',info:'🔵',ok:'🟢'}[a.sev]} ${esc(a.t)}</b><span>${esc(a.x)}</span></div>`).join('');
}
window.gestAlMesAtual=function(){$('gAlMes').value=hojeK();alertasUi()};
window.gestSalvarCfg=function(){
  const v=id=>Number($(id).value);
  if(!(v('gCfgVar')>0)||!(v('gCfgFat')>=1)||!(v('gCfgDias')>0)||v('gCfgMin')<0)return alert('Confira os valores informados.');
  cfg={var:v('gCfgVar'),minKg:v('gCfgMin'),fator:v('gCfgFat'),diasPend:v('gCfgDias')};
  try{localStorage.setItem(CFGK,JSON.stringify(cfg))}catch(e){}
  alertasUi();badge();alert('Parâmetros salvos.');
};
function varCls(d,subeRuim){return d===null||d===0?'':((d>0)===subeRuim?'g-up':'g-down')}
function compUi(){
  const a=$('gCmpA').value,b=$('gCmpB').value;if(!a||!b)return;
  const R=refAll(),D=devAll(),ma=metricasMes(a,R,D),mb=metricasMes(b,R,D),ok=okCusto();
  $('gCmpTA').textContent=lblM(a);$('gCmpTB').textContent=lblM(b);
  const linhas=[['Produção da Fundição (kg)','prod',false],['Refugo total (kg)','kg',true],['Refugo da Fundição (kg)','kgF',true],['% de refugo da Fundição','perc',true]];
  if(ok)linhas.push(['Valor do refugo (R$)','rs',true]);
  linhas.push(['Devoluções — registros','dN',true],['Devoluções — peças','dQtd',true],['Devoluções — kg','dKg',true]);
  if(ok)linhas.push(['Devoluções — valor (R$)','dRs',true]);
  $('gCmpBody').innerHTML=linhas.map(([n,f,ruim])=>{
    const x=ma[f],y=mb[f],isP=f==='perc',dif=(x===null||y===null)?null:x-y,v=(x===null||y===null)?null:pct(x,y);
    const sf=q=>q===null?'—':(isP?fmt(q)+'%':(f==='rs'||f==='dRs'?RS(q):fmt(q)));
    return `<tr><td>${n}</td><td>${sf(x)}</td><td>${sf(y)}</td><td class="${varCls(dif,ruim)}">${dif===null?'—':(dif>0?'+':'')+(isP?fmt(dif)+' p.p.':(f==='rs'||f==='dRs'?RS(dif):fmt(dif)))}</td><td class="${varCls(v,ruim)}">${fp(v)}</td></tr>`}).join('');
  /* detalhamento */
  const dim=$('gCmpDim').value,key={planta:r=>r.pl,causa:r=>r.causa,motivo:r=>r.mot,cliente:r=>r.cli,peca:r=>(r.cod?r.cod+' — ':'')+r.pec}[dim];
  const ga=agrupar(R.filter(r=>r.k===a),key,['kg','rs']),gb=agrupar(R.filter(r=>r.k===b),key,['kg','rs']);
  const mp=new Map();ga.forEach(e=>mp.set(e.nome,{n:e.nome,a:e.kg,b:0,ra:e.rs,rb:0}));
  gb.forEach(e=>{const x=mp.get(e.nome)||{n:e.nome,a:0,b:0,ra:0,rb:0};x.b=e.kg;x.rb=e.rs;mp.set(e.nome,x)});
  const L=[...mp.values()].sort((x,y)=>Math.max(y.a,y.b)-Math.max(x.a,x.b)).slice(0,15);
  grupo('gCmpCv',L.slice(0,8).map(x=>x.n),L.slice(0,8).map(x=>x.a),L.slice(0,8).map(x=>x.b),lblM(a),lblM(b));
  $('gCmpHead').innerHTML='<th>'+({planta:'Planta',causa:'Causa',motivo:'Motivo',cliente:'Cliente',peca:'Peça'})[dim]+'</th><th>'+lblM(a)+' (kg)</th><th>'+lblM(b)+' (kg)</th><th>Diferença (kg)</th><th>Variação</th>'+(ok?'<th>Diferença (R$)</th>':'');
  $('gCmpDet').innerHTML=L.length?L.map(x=>{const d=x.a-x.b,v=pct(x.a,x.b);return `<tr><td>${esc(x.n)}</td><td>${fmt(x.a)}</td><td>${fmt(x.b)}</td><td class="${varCls(d,true)}">${d>0?'+':''}${fmt(d)}</td><td class="${varCls(v,true)}">${x.b?fp(v):(x.a?'novo':'—')}</td>${ok?`<td class="${varCls(x.ra-x.rb,true)}">${(x.ra-x.rb)>0?'+':''}${RS(x.ra-x.rb)}</td>`:''}</tr>`}).join(''):'<tr><td colspan="6" class="small" style="text-align:center">Sem dados nos períodos.</td></tr>';
}
window.gestCmpRapido=function(t){const a=$('gCmpA').value||hojeK();$('gCmpB').value=t==='ano'?addM(a,-12):addM(a,-1);compUi()};
function cruzUi(){
  const a=$('gCrA').value,b=$('gCrB').value;if(!a||!b)return;
  const ok=okCusto();
  let L=cruzar(a,b);const so=$('gCrSo').checked;
  const ambos=L.filter(x=>x.rKg>0&&x.dQtd>0);
  if(so)L=ambos;
  L.sort((x,y)=>(ok?(y.rRs+y.dRs)-(x.rRs+x.dRs):(y.rKg+y.dKg)-(x.rKg+x.dKg)));
  $('gCrKpi').innerHTML=`<div class="card"><div class="kpi-accent"></div><div class="label">Peças com refugo e devolução</div><div class="value">${fmt(ambos.length)}</div><div class="sub">reincidentes no período</div></div>
   <div class="card"><div class="kpi-accent"></div><div class="label">Refugo dessas peças</div><div class="value">${fmt(somar(ambos,x=>x.rKg))} kg</div><div class="sub">${ok?RS(somar(ambos,x=>x.rRs)):'valor restrito'}</div></div>
   <div class="card"><div class="kpi-accent"></div><div class="label">Devolução dessas peças</div><div class="value">${fmt(somar(ambos,x=>x.dQtd))} un.</div><div class="sub">${fmt(somar(ambos,x=>x.dKg))} kg${ok?' • '+RS(somar(ambos,x=>x.dRs)):''}</div></div>`;
  $('gCrHead').innerHTML='<tr><th>Código</th><th>Peça</th><th>Cliente</th><th>Refugo (kg)</th><th>Devol. (peças)</th><th>Devol. (kg)</th>'+(ok?'<th>Refugo (R$)</th><th>Devol. (R$)</th><th>Custo total (R$)</th>':'')+'</tr>';
  $('gCrBody').innerHTML=L.length?L.slice(0,200).map(x=>`<tr><td>${esc(x.cod)}</td><td style="white-space:normal;min-width:160px">${esc(x.pec)}</td><td>${esc(x.cli)}</td><td>${fmt(x.rKg)}</td><td>${fmt(x.dQtd)}</td><td>${fmt(x.dKg)}</td>${ok?`<td>${RS(x.rRs)}</td><td>${RS(x.dRs)}</td><td><b>${RS(x.rRs+x.dRs)}</b></td>`:''}</tr>`).join(''):`<tr><td colspan="9" class="small" style="text-align:center">Nenhuma peça encontrada no período.</td></tr>`;
}
function relUi(){
  const k=$('gRelMes').value||hojeK(),box=$('gRelPrev');
  try{box.innerHTML='<style>'+REPCSS+'</style>'+relCompleto(k,$('gRelNum').value,{edit:true})}catch(e){console.error(e);box.textContent='Erro ao montar o relatório: '+e.message;return}
  box.querySelectorAll('.txt[data-sec]').forEach(t=>{
    t.addEventListener('input',()=>{t._d=1});
    t.addEventListener('blur',()=>{if(!t._d)return;t._d=0;const h=limparHtml(t.innerHTML);gravarEdit(k,t.dataset.sec,h);relUiSuave(k)});
  });
  box.querySelectorAll('[data-restore]').forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault();if(!confirm('Voltar ao texto automático desta seção? Sua edição será descartada.'))return;gravarEdit(k,a.dataset.restore,null);relUi()}));
}
/* após editar, só atualiza a barra da seção (sem refazer os gráficos nem perder o foco) */
function relUiSuave(k){
  const box=$('gRelPrev');if(!box)return;
  box.querySelectorAll('.sec').forEach(s=>{
    const t=s.querySelector('.txt[data-sec]'),b=s.querySelector('.ed-bar');if(!t||!b)return;
    const ed=(lerEdits()[k]||{})[t.dataset.sec]!==undefined;
    b.innerHTML=(ed?'✎ texto editado por você — <a href="#" data-restore="'+t.dataset.sec+'">↺ restaurar texto automático</a>':'✎ clique no texto para editar — a análise acima foi gerada automaticamente');
    const a=b.querySelector('[data-restore]');if(a)a.addEventListener('click',ev=>{ev.preventDefault();if(!confirm('Voltar ao texto automático desta seção? Sua edição será descartada.'))return;gravarEdit(k,a.dataset.restore,null);relUi()});
  });
}
window.gestPdf=function(){try{localStorage.setItem('controle_refugos_2026_gestao_relnum',$('gRelNum').value)}catch(e){}gerarPdfRel($('gRelMes').value||hojeK())};
window.gestXlsx=function(){gerarXlsx($('gRelMes').value||hojeK())};
function render(){
  if(aba==='alertas')alertasUi();else if(aba==='comp')compUi();else if(aba==='cruz')cruzUi();else if(aba==='rel')relUi();else if(aba==='visao'){if(window.relUiInit)window.relUiInit('vg')}else{try{analysis()}catch(e){console.error(e)}}
}
window.gestAba=function(a){
  if(!built)return;aba=a;
  document.querySelectorAll('#gestRoot .g-tab').forEach(b=>b.classList.toggle('on',b.dataset.g===a));
  $('gAlertas').style.display=a==='alertas'?'':'none';$('gComp').style.display=a==='comp'?'':'none';
  $('gCruz').style.display=a==='cruz'?'':'none';$('gRel').style.display=a==='rel'?'':'none';$('gAnalise').style.display=a==='analise'?'':'none';$('gVisao').style.display=a==='visao'?'':'none';$('gRelOld').style.display=a==='relOld'?'':'none';
  render();
};
window.gestInit=function(){if(!built)build();gestAba(aba);badge()};
window.gestRefresh=function(){badge();const s=$('gestao');if(built&&s&&s.classList.contains('active'))render()};

/* ---------- classificar motivos por causa (Cadastro → Motivos) ---------- */
const CAUSAS=['Mão de obra','Máquina','Método','Material','Meio ambiente','Medição','Outros'];
function sugerirCausa(desc){
  const t=String(desc||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
  const tem=a=>a.some(w=>t.includes(w));
  if(tem(['PREPARACAO','PROGRAMACAO','MONTAGEM','ATENCAO','IDENTIFICACAO','FALHA NO CONTROLE','OPERADOR','ERRO','ESQUEC','REBARBACAO','ACABAMENTO','MANUSEIO','ARMAZENAMENTO','EMBALAGEM','AJUSTE']))return 'Mão de obra';
  if(tem(['MEDIDA','DIMENSIONAL','CALIBRACAO','INSTRUMENTO','PAQUIMETRO','LABORATORIO','ENSAIO','GABARITO']))return 'Medição';
  if(tem(['UMIDADE','TEMPERATURA AMBIENTE','CLIMA','POEIRA','AMBIENTE','ILUMINACAO']))return 'Meio ambiente';
  if(tem(['QUEBRA','FERRAMENT','DISPOSITIVO','MAQUINA','VIBR','BEDAME','INSERTO','MANUTENCAO','DESGASTE','EQUIPAMENTO','FORNO','PANE','ROLAMENTO','CNC','HIDRAUL']))return 'Máquina';
  if(tem(['AREIA','DUREZA','CARBONETO','INCLUSAO','COMPOSICAO','METAL','MATERIAL']))return 'Material';
  if(tem(['RECHUPE','POROSIDADE','VAZAMENTO','JUNTA FRIA','TRINCA','DUREZA','CARBONETO','INCLUSAO','CORRIDA','COMPOSICAO','GAS','CONTRACAO','MACHARIA']))return 'Método';
  return '';
}
function usoMotivos(){
  const ms=(cadastros&&Array.isArray(cadastros.motivos))?cadastros.motivos:[],byC=new Map(),byD=new Map();
  ms.forEach((x,i)=>{const c=String(x.codigo??'').trim().replace(/^0+(?=\d)/,'');if(c&&!byC.has(c))byC.set(c,i);const d=normalizeText(x.descricao);if(d&&!byD.has(d))byD.set(d,i)});
  const uso=ms.map(()=>({n:0,kg:0}));
  (Array.isArray(data)?data:[]).forEach(r=>{
    const mc=String(r['MOTIVO DO REFUGO']??r.motivo??'').trim().match(/^\d+/);
    let i=mc?byC.get(mc[0].replace(/^0+(?=\d)/,'')):undefined;
    if(i===undefined){const d=normalizeText(r['DESCRIÇÃO DO MOTIVO']??r.descricaoMotivo??'');if(d)i=byD.get(d)}
    if(i!==undefined){uso[i].n++;uso[i].kg+=kg(r)}
  });
  return uso;
}
function mcFecha(){const m=$('mcModal');if(m)m.remove()}
window.motCausaAbrir=function(){
  mcFecha();
  const ms=cadastros.motivos||[],uso=usoMotivos();
  const m=document.createElement('div');m.id='mcModal';
  m.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:14px';
  m.innerHTML=`<div style="background:var(--card,#fff);color:var(--text,#222);border-radius:14px;max-width:980px;width:100%;max-height:92vh;display:flex;flex-direction:column;padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">🏷 Classificar motivos por causa</b><button type="button" class="btn secondary" id="mcX">Fechar</button></div>
    <div class="small" id="mcResumo" style="margin:6px 0"></div>
    <div class="g-bar"><label><input type="checkbox" id="mcSo" checked> só motivos sem causa</label><input id="mcBusca" placeholder="Buscar código ou descrição…" style="min-width:200px">
      <button type="button" class="btn secondary" id="mcSug">💡 Sugerir pelas palavras da descrição</button><button type="button" class="btn primary" id="mcSalvar">✓ Salvar classificações</button></div>
    <div class="small">As sugestões são apenas um ponto de partida (não salvam sozinhas): confira cada linha antes de salvar. A lista vem ordenada pelo maior peso de refugo.</div>
    <div style="overflow:auto;margin-top:8px"><table style="width:100%"><thead><tr><th>Código</th><th>Descrição</th><th>Planta</th><th>Lanç.</th><th>Kg refugo</th><th>Causa</th></tr></thead><tbody id="mcBody"></tbody></table></div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)mcFecha()});$('mcX').onclick=mcFecha;
  const ordem=ms.map((x,i)=>i).sort((a,b)=>uso[b].kg-uso[a].kg);
  const pend={};
  const desenha=()=>{
    const so=$('mcSo').checked,q=normalizeText($('mcBusca').value);
    const itens=ordem.filter(i=>{const x=ms[i];if(so&&x.causa&&pend[i]===undefined)return false;if(so&&pend[i]===undefined&&x.causa)return false;return !q||normalizeText((x.codigo||'')+' '+(x.descricao||'')).includes(q)});
    $('mcBody').innerHTML=itens.length?itens.map(i=>{const x=ms[i],v=pend[i]!==undefined?pend[i]:(x.causa||'');return `<tr><td>${esc(x.codigo||'')}</td><td style="white-space:normal">${esc(x.descricao||'')}</td><td>${esc(x.planta||'')}</td><td>${fmt(uso[i].n)}</td><td>${fmt(uso[i].kg)}</td><td><select data-i="${i}"><option value="">— selecionar —</option>${CAUSAS.map(c=>`<option${v===c?' selected':''}>${c}</option>`).join('')}</select></td></tr>`}).join(''):'<tr><td colspan="6" class="small" style="text-align:center">Nenhum motivo para mostrar.</td></tr>';
    $('mcBody').querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{pend[s.dataset.i]=s.value}));
    const sem=ms.map((x,i)=>i).filter(i=>!(pend[i]!==undefined?pend[i]:ms[i].causa)),kgT=uso.reduce((a,u)=>a+u.kg,0),kgS=sem.reduce((a,i)=>a+uso[i].kg,0);
    $('mcResumo').innerHTML=`<b>${sem.length}</b> de ${ms.length} motivos ainda sem causa${kgT?` — representam <b>${fmt(kgS/kgT*100)}%</b> do refugo em kg`:''}.`;
  };
  $('mcSo').onchange=desenha;$('mcBusca').oninput=desenha;
  $('mcSug').onclick=()=>{let n=0;ms.forEach((x,i)=>{if(x.causa||pend[i]!==undefined)return;const s=sugerirCausa(x.descricao);if(s){pend[i]=s;n++}});desenha();alert(n+' sugestão(ões) preenchida(s). Revise e clique em "Salvar classificações".')};
  $('mcSalvar').onclick=()=>{
    let n=0;Object.keys(pend).forEach(i=>{const x=ms[i];if(!x)return;const v=pend[i];if(v){if(x.causa!==v){x.causa=v;n++}}else if(x.causa){delete x.causa;n++}});
    __causaVer++;saveCad();try{dashboardDirty=true;dashboardQtdDirty=true}catch(e){}
    try{renderCadastro()}catch(e){}try{window.gestRefresh&&window.gestRefresh()}catch(e){}
    mcFecha();alert(n+' motivo(s) atualizado(s).');
  };
  desenha();
};


/* ---------- produtos sem peso (Cadastro → Produtos) ---------- */
function pesoOk(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>0}
function psFecha(){const m=$('psModal');if(m)m.remove()}
window.pecaSemPesoAbrir=function(){
  psFecha();
  const pecas=(cadastros.pecas||[]),uso=new Map();
  (Array.isArray(data)?data:[]).forEach(r=>{const c=String(val(r,'codigo')||'').trim();if(c)uso.set(c,(uso.get(c)||0)+1)});
  const lista=pecas.map((x,i)=>({x,i,n:uso.get(String(x.codigo||'').trim())||0})).filter(o=>!['pesoPrincipal','pesoFundUsin','pesoUsinado','pesoArvore'].some(f=>pesoOk(o.x[f])));
  lista.sort((a,b)=>b.n-a.n);
  const m=document.createElement('div');m.id='psModal';
  m.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:14px';
  const usados=lista.filter(o=>o.n>0).length;
  m.innerHTML=`<div style="background:var(--card,#fff);color:var(--text,#222);border-radius:14px;max-width:980px;width:100%;max-height:92vh;display:flex;flex-direction:column;padding:16px">
   <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">⚖ Produtos sem peso</b><button type="button" class="btn secondary" id="psX">Fechar</button></div>
   <div class="small" style="margin:6px 0"><b>${lista.length}</b> de ${pecas.length} produtos não têm nenhum peso válido cadastrado (vazio, "SEM PESO" ou "COD USINAGEM" nos quatro campos); <b>${usados}</b> deles já têm lançamentos de refugo (saem com 0 kg). Ordenados pelos mais lançados.</div>
   <div style="overflow:auto"><table style="width:100%"><thead><tr><th>Código</th><th>Descrição</th><th>Cliente</th><th>Planta</th><th>Peso atual</th><th>Lanç.</th><th></th></tr></thead><tbody>${lista.slice(0,300).map(o=>`<tr><td>${esc(o.x.codigo||'')}</td><td style="white-space:normal">${esc(o.x.descricao||'')}</td><td>${esc(o.x.cliente||'—')}</td><td>${esc(o.x.planta||'')}</td><td>${esc(o.x.pesoPrincipal===''||o.x.pesoPrincipal==null?'(vazio)':o.x.pesoPrincipal)}</td><td>${fmt(o.n)}</td><td><button type="button" class="btn secondary" data-i="${o.i}">Editar</button></td></tr>`).join('')||'<tr><td colspan="7" class="small" style="text-align:center">Todos os produtos têm peso.</td></tr>'}</tbody></table>${lista.length>300?'<div class="small">Mostrando os 300 primeiros.</div>':''}</div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)psFecha();const b=e.target.closest&&e.target.closest('button[data-i]');if(b){psFecha();try{window.editPeca(Number(b.dataset.i))}catch(x){alert('Não foi possível abrir o produto.')}}});
  $('psX').onclick=psFecha;
};

/* ---------- QUADRO DE MESES (dashboard + apresentação) ---------- */
const qesc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const qf=(v,d)=>N(v).toLocaleString('pt-BR',{maximumFractionDigits:d==null?0:d,minimumFractionDigits:0});
const qnorm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const qpl=t=>{t=qnorm(t);return t.includes('FUND')&&t.includes('USIN')?'X':t.includes('FUND')?'F':t.includes('USIN')?'U':''};
let QCSS=false;
function quadroCss(){
  if(QCSS||document.getElementById('qdCss'))return;QCSS=true;const s=document.createElement('style');s.id='qdCss';
  s.textContent='.qd{--qc:var(--card,#fff);--qt:var(--text,#1d2733);--qb:var(--border,#e3e8ee);--qm:var(--muted,#64748b);--qo:#ff5a1a;color:var(--qt);font-family:inherit}'+
  '.qd.lt{--qc:#fff;--qt:#1d2733;--qb:#e3e8ee;--qm:#64748b}.qd.dk{--qc:#18222d;--qt:#e8eef4;--qb:#2a3846;--qm:#9fb0c2}'+
  '.qd .qyr{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.qd .qyr button{border:1px solid var(--qb);background:transparent;color:var(--qt);border-radius:999px;padding:5px 13px;font-weight:800;cursor:pointer;font-size:13px}.qd .qyr button.on{background:var(--qo);border-color:var(--qo);color:#fff}'+
  '.qd .qg{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:9px}'+
  '.qd .qt{position:relative;text-align:left;border:1px solid var(--qb);background:var(--qc);color:var(--qt);border-radius:12px;padding:10px 11px 12px;cursor:pointer;font:inherit;overflow:hidden;animation:qdIn .45s both;transition:transform .12s,box-shadow .12s,border-color .12s}'+
  '.qd .qt:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,.14);border-color:var(--qo)}.qd .qt.sel{border-color:var(--qo);box-shadow:0 0 0 2px var(--qo)}.qd .qt.vz{opacity:.45}'+
  '.qd .qt .qm{font-size:12px;font-weight:800;color:var(--qm);text-transform:uppercase;letter-spacing:.4px}.qd .qt .qv{font-size:21px;font-weight:900;line-height:1.15;margin-top:2px}.qd .qt .qu{font-size:11px;color:var(--qm)}'+
  '.qd .qt .qs{font-size:11px;margin-top:3px;min-height:14px;font-weight:700}.qd .qt .qbar{position:absolute;left:0;bottom:0;height:5px;background:var(--qo);border-radius:0 3px 0 0;transition:width .6s}'+
  '.qd .up{color:#dc2626}.qd .dn{color:#16a34a}.qd .mu{color:var(--qm)}'+
  '.qd .qdt{margin-top:12px;border:1px solid var(--qb);background:var(--qc);border-radius:14px;padding:14px;animation:qdIn .3s both}.qd .qdt h4{margin:0 0 10px;font-size:17px;color:var(--qo)}'+
  '.qd .qk{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px}.qd .qk div{border:1px solid var(--qb);border-radius:10px;padding:8px 10px}.qd .qk span{display:block;font-size:11px;color:var(--qm);font-weight:700}.qd .qk b{font-size:18px}'+
  '.qd .ql{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.qd .ql h5{margin:0 0 5px;font-size:12px;color:var(--qm);text-transform:uppercase;letter-spacing:.4px}.qd .ql table{width:100%;border-collapse:collapse;font-size:12.5px}.qd .ql td{padding:3px 0;border-bottom:1px solid var(--qb);vertical-align:top}.qd .ql td:last-child{text-align:right;font-weight:800;white-space:nowrap;padding-left:8px}'+
  '.qd .qh{font-size:12px;color:var(--qm);margin:2px 0 8px}@keyframes qdIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}#prOv .qd .qg{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}#prOv .qd .qt{padding:14px 14px 16px}#prOv .qd .qt .qv{font-size:clamp(24px,2.6vw,38px)}#prOv .qd .qt .qm{font-size:clamp(12px,1.2vw,17px)}#prOv .qd .qt .qs,#prOv .qd .qt .qu,#prOv .qd .qh{font-size:clamp(11px,1.05vw,15px)}#prOv .qd .qk b{font-size:clamp(18px,1.8vw,26px)}#prOv .qd .ql table{font-size:clamp(12px,1.15vw,16px)}@media(max-width:820px){.qd .qg{grid-template-columns:repeat(3,1fr)}.qd .qt .qv{font-size:18px}}@media(max-width:420px){.qd .qg{grid-template-columns:repeat(2,1fr)}}';
  document.head.appendChild(s);
}
/* dados de um conjunto de meses */
function quadroDados(cfg){
  const mt=cfg.mt==='qtd'?'qtd':'kg';
  const PL=Array.isArray(cfg.PL)?cfg.PL:[];
  const nm=s=>{try{return plantNormName(s)}catch(e){return String(s||'').toUpperCase()}};
  const PF=PL.length?PL.some(x=>nm(x)==='FUNDICAO'):cfg.f!==false,PU=PL.length?PL.some(x=>nm(x)==='USINAGEM'):cfg.u!==false;
  const keepN=s=>{if(!PL.length)return true;const v=nm(s);return PL.some(x=>nm(x)===v)};
  const both=PF&&PU,keep0=c=>c==='F'?PF:c==='U'?PU:c==='X'?both:both,keep=PL.length?null:keep0;
  const vv=r=>mt==='qtd'?N(r.qtd):N(r.kg);
  const R=refAll().filter(r=>PL.length?keepN(r.pl):keep(qpl(r.pl))),D=devAll().filter(r=>(PL.length?keepN(r.tipo):keep(qpl(r.tipo)))&&!(r.raw&&(r.raw.procede==='Não'||r.raw.disp==='Reclamação não procede')));
  let RT=[];try{RT=(typeof rtLoad==='function'?rtLoad():[]).filter(r=>r.dt)}catch(e){}
  let cu=false;try{cu=costAccessAllowed()}catch(e){}
  const rk=(rows,key,val,lim)=>{const m=new Map();rows.forEach(r=>{const k=String(key(r)||'').trim()||'Não informado';m.set(k,(m.get(k)||0)+val(r))});return [...m].map(([nome,v])=>({nome,v})).filter(e=>e.v>0).sort((a,b)=>b.v-a.v).slice(0,lim||5)};
  const out={};
  (cfg.ms||[]).forEach(k=>{
    const rr=R.filter(r=>r.k===k),dd=D.filter(r=>r.k===k),rt=RT.filter(r=>String(r.dt).slice(0,7)===k);
    const v=somar(rr,vv),prod=prodDe(k),kgF=somar(rr.filter(r=>qpl(r.pl)==='F'),r=>N(r.kg));
    out[k]={k,v,n:rr.length,pecas:somar(rr,r=>N(r.qtd)),rs:somar(rr,r=>N(r.rs)),prod,perc:(mt==='kg'&&(PL.length?PF:true)&&PF&&prod)?kgF/prod*100:null,
      dv:somar(dd,vv),dvQ:somar(dd,r=>N(r.qtd)),dvRs:somar(dd,r=>N(r.rs)),rtQ:somar(rt,r=>N(r.qtd)),rtN:rt.length,
      pF:somar(rr.filter(r=>qpl(r.pl)==='F'),vv),pU:somar(rr.filter(r=>qpl(r.pl)==='U'),vv),
      mot:rk(rr,r=>r.mot,vv),cli:rk(rr,r=>r.cli,vv),pec:rk(rr,r=>(r.cod?r.cod+' - ':'')+(r.pec||''),vv),causa:rk(rr,r=>r.causa,vv),dvCli:rk(dd,r=>r.cli,vv,3)};
  });
  return {mt,PF,PU,PL,mix:!PL.length||PL.length>1,cu,M:out,un:mt==='qtd'?'peças':'kg'};
}
function quadroHtml(cfg,sel,Q,anos,ano){
  const g=Q||quadroDados(cfg),ms=cfg.ms,un=g.un;
  const mx=Math.max(1,...ms.map(k=>g.M[k].v));
  let h='';
  if(cfg.chips){const L=[['','Filtro do painel'],['ALL','Todas'],['FUNDICAO','Fundição'],['FUNDICAO NA USINAGEM','Fundição na Usinagem'],['USINAGEM','Usinagem']],cur=cfg.qpl||'';h+='<div class="qyr qpc">'+L.map(a=>'<button type="button" data-pl="'+a[0]+'"'+(a[0]===cur?' class="on"':'')+'>'+a[1]+'</button>').join('')+'</div>'}
  if(anos&&anos.length>1)h+='<div class="qyr">'+anos.map(y=>'<button type="button" data-y="'+y+'"'+(y===ano?' class="on"':'')+'>'+y+'</button>').join('')+'</div>';
  h+='<div class="qh">Clique em um mês para ver os valores dele · '+(g.mt==='qtd'?'quantidade de peças refugadas':'kg de refugo')+(g.PL&&g.PL.length?' · filtro: '+g.PL.map(x=>String(x).replace(/FUNDICAO/g,'Fundição').replace(/USINAGEM/g,'Usinagem').replace(/NAO INFORMADO/,'Não informado').replace(/ NA /,' na ')).join(' + '):(g.PF&&g.PU?'':' ('+(g.PF?'Fundição':'Usinagem')+')'))+'</div><div class="qg">';
  ms.forEach((k,i)=>{
    const x=g.M[k],pk=ms[i-1]!=null?g.M[ms[i-1]]:null,vz=!(x.n>0||x.dv>0||x.rtQ>0);
    let st='<span class="mu">'+(vz?'sem lançamentos':x.perc!=null?qf(x.perc,2)+'% da produção':qf(x.n)+' lançamento(s)')+'</span>';
    if(!vz&&pk&&pk.v>0&&x.v>=0){const d=(x.v-pk.v)/pk.v*100;st=(d>0?'<span class="up">▲ +':'<span class="dn">▼ ')+qf(Math.abs(d),0)+'%</span> <span class="mu">vs mês ant.</span>'}
    h+='<button type="button" class="qt'+(vz?' vz':'')+(k===sel?' sel':'')+'" data-k="'+k+'" style="animation-delay:'+(i*45)+'ms"><div class="qm">'+qesc(lblM(k))+'</div><div class="qv">'+qf(x.v,g.mt==='qtd'?0:0)+'</div><div class="qu">'+un+' de refugo</div><div class="qs">'+st+'</div><i class="qbar" style="width:'+(x.v/mx*100).toFixed(1)+'%"></i></button>';
  });
  h+='</div><div class="qdet">'+quadroDet(cfg,sel,g)+'</div>';
  return h;
}
function quadroDet(cfg,k,g){
  if(!k||!g.M[k])return '';
  const x=g.M[k],un=g.un,lst=(t,a,u)=>'<div><h5>'+t+'</h5>'+(a.length?'<table>'+a.map(e=>'<tr><td>'+qesc(String(e.nome).slice(0,48))+'</td><td>'+qf(e.v,0)+' '+(u||un)+'<span class="mu"> · '+(x.v>0?qf(e.v/x.v*100,0):'0')+'%</span></td></tr>').join('')+'</table>':'<span class="mu">—</span>')+'</div>';
  let h='<div class="qdt"><h4>📅 '+qesc(lblM(k))+' — '+qesc(mesExt(k))+'</h4><div class="qk">'+
   '<div><span>Refugo ('+un+')</span><b>'+qf(x.v,g.mt==='qtd'?0:1)+'</b></div>'+
   '<div><span>Peças refugadas</span><b>'+qf(x.pecas)+'</b></div>'+
   (x.perc!=null?'<div><span>% da produção (Fundição)</span><b>'+qf(x.perc,2)+'%</b></div><div><span>Produção Fundição (kg)</span><b>'+qf(x.prod)+'</b></div>':'')+
   (g.mix&&g.PF&&g.PU?'<div><span>Fundição / Usinagem ('+un+')</span><b>'+qf(x.pF)+' / '+qf(x.pU)+'</b></div>':'')+
   '<div><span>Devolução procedente ('+un+')</span><b>'+qf(x.dv,g.mt==='qtd'?0:1)+'</b></div>'+
   '<div><span>Peças devolvidas</span><b>'+qf(x.dvQ)+'</b></div>'+
   '<div><span>Retrabalho (peças)</span><b>'+qf(x.rtQ)+'</b></div>'+
   (g.cu?'<div><span>Custo não qualidade (R$)</span><b>'+qf(x.rs+x.dvRs)+'</b></div>':'')+'</div>'+
   '<div class="ql">'+lst('Principais motivos',x.mot)+lst('Causas (6M)',x.causa)+lst('Clientes',x.cli)+lst('Peças',x.pec)+(x.dvCli.length?lst('Devolução por cliente',x.dvCli):'')+'</div></div>';
  return h;
}
/* monta o quadro dentro de um elemento; cfg:{ms|anos, mt, f, u, tema:'dk'|'lt'|'', sel} */
function quadroMontar(host,cfg0){
  if(!host)return;quadroCss();
  const cfg=Object.assign({},cfg0);
  cfg.qpl=host.__qpl||'';if(cfg.chips&&cfg.qpl)cfg.PL=cfg.qpl==='ALL'?[]:[cfg.qpl];
  let ano=null,anos=null;
  if(cfg.porAno){
    const all=new Set();try{refAll().forEach(r=>all.add(r.k.slice(0,4)));devAll().forEach(r=>{if(r.k)all.add(r.k.slice(0,4))})}catch(e){}
    anos=[...all].filter(Boolean).sort();ano=host.__qano&&anos.includes(host.__qano)?host.__qano:anos[anos.length-1]||String(new Date().getFullYear());
    cfg.ms=[];for(let m=1;m<=12;m++)cfg.ms.push(mkKey(ano,m));
  }
  const g=quadroDados(cfg);
  let sel=host.__qsel&&cfg.ms.includes(host.__qsel)?host.__qsel:(cfg.sel&&cfg.ms.includes(cfg.sel)?cfg.sel:null);
  if(!sel&&cfg.auto!==false){const com=cfg.ms.filter(k=>g.M[k].n>0);sel=com.length?com[com.length-1]:null}
  host.__qsel=sel;host.__qano=ano;
  host.classList.add('qd');host.classList.remove('dk','lt');if(cfg.tema)host.classList.add(cfg.tema);
  host.innerHTML=quadroHtml(cfg,sel,g,anos,ano);
  host.onclick=e=>{
    const pc=e.target.closest('[data-pl]');if(pc){host.__qpl=pc.dataset.pl;quadroMontar(host,cfg0);return}
    const y=e.target.closest('[data-y]');if(y){host.__qano=y.dataset.y;host.__qsel=null;quadroMontar(host,cfg0);return}
    const t=e.target.closest('.qt');if(!t)return;
    const k=t.dataset.k;host.__qsel=(host.__qsel===k&&cfg.toggle!==false)?null:k;
    host.querySelectorAll('.qt').forEach(b=>b.classList.toggle('sel',b.dataset.k===host.__qsel));
    const det=host.querySelector('.qdet');det.innerHTML=quadroDet(cfg,host.__qsel,g);
    if(host.__qsel&&cfg.scroll!==false)try{det.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(x){}
  };
}
/* versão estática (PDF da apresentação): mês escolhido já aberto */
function quadroEstatico(cfg,tema){
  const g=quadroDados(cfg);const com=cfg.ms.filter(k=>g.M[k].n>0),sel=com.length?com[com.length-1]:null;
  return '<div class="qd '+(tema||'lt')+'">'+quadroHtml(cfg,sel,g)+'</div>';
}
/* dashboards */
const QHOSTS=[['quadroMesesKg','kg'],['quadroMesesQtd','qtd']];
let QSIG={};
function qPlantaSel(){const v=(document.getElementById('filterPlant')||{}).value||'';const c=qpl(v);return{f:c!=='U',u:c!=='F'}}
function quadroAtualiza(force){
  QHOSTS.forEach(([id,mt])=>{
    const h=document.getElementById(id);if(!h||!h.offsetParent)return;
    const p=qPlantaSel();let PL=[];try{PL=plSel(mt==='qtd'?'qFilterPlant':'filterPlant')||[]}catch(e){}p.PL=PL;let sig='';
    try{sig=[(Array.isArray(data)?data.length:0),pesoTipo(),p.f,p.u,PL.join('+'),h.__qpl||'',mt,(window.devDados?window.devDados().length:0),(typeof rtLoad==='function'?rtLoad().length:0)].join('|')}catch(e){}
    if(!force&&QSIG[id]===sig&&h.firstChild)return;QSIG[id]=sig;
    try{quadroMontar(h,{porAno:true,chips:true,mt,f:p.f,u:p.u,PL})}catch(e){console.error(e)}
  });
}
window.__quadroRefresh=()=>quadroAtualiza(true);
setInterval(()=>quadroAtualiza(false),1500);
document.addEventListener('change',e=>{if(e.target&&/^(filterPlant|filterYear|filterMonth|filterPeso|qFilterPlant|qFilterYear|qFilterMonth)$/.test(e.target.id))setTimeout(()=>quadroAtualiza(true),50)});
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.tab'))setTimeout(()=>quadroAtualiza(false),150)});

/* para testes */
window.addEventListener('pesotipo',()=>{try{if(built)render()}catch(e){}});
window.__gestao={refAll,devAll,imgBar,imgStack,topo,baixar,limparHtml,addM,lblM,mesExt,pc1,cut,mkKey,sugerirCausa,relCompleto,REPCSS,calcAlertas,relatorio,cruzar,xlsxBlob,relSheets,metricasMes,crc32,quadroMontar,quadroEstatico,quadroDados};
css();
setTimeout(badge,3000);
window.addEventListener('resize',()=>{if(built&&(aba==='comp')&&$('gestao')?.classList.contains('active'))compUi()});
})();

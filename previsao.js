window.__V=window.__V||{};window.__V.previsao='v154';
/* ==================================================================
   VISÃO GERAL: filtro por período + PREVISÃO + APRESENTAÇÃO animada
   Lê os mesmos dados dos módulos (refugo, retrabalho, devolução).
   Depende de gestao.js (window.__gestao) e relatorios.js (relUiInit).
   ================================================================== */
(function(){
const $=id=>document.getElementById(id);
const G=()=>window.__gestao||{};
const N=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const F=v=>fmt(v),P=v=>fmt(v)+'%';
const INK='#2f3b47',OR='#ff5a00',BL='#1f5f99',GR='#16a34a',RD='#d32f2f',MUT='#6b7785';
const np=r=>r&&(r.procede==='Não'||r.disp==='Reclamação não procede');
const okCusto=()=>{try{return costAccessAllowed()}catch(e){return false}};
const PK='controle_refugos_2026_vgper';
const isoMes=d=>String(d||'').slice(0,7);
const hojeK=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
function range(a,b){const o=[];let k=a,i=0;while(k<=b&&i<36){o.push(k);k=G().addM(k,1);i++}return o}
function perLer(){try{const o=JSON.parse(localStorage.getItem(PK)||'null');if(o&&o.a&&o.b)return Object.assign({f:true,u:true,mt:'kg'},o)}catch(e){}const b=hojeK();return{a:G().addM(b,-5),b,f:true,u:true,mt:'kg'}}
function perGravar(o){try{localStorage.setItem(PK,JSON.stringify(o))}catch(e){}}

/* ---------- previsão (regressão linear com faixa de incerteza) ---------- */
function cdf(z){const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
function prever(vals,h,meta){
  const pts=[];vals.forEach((v,i)=>{if(v!=null&&isFinite(v))pts.push([i,v])});
  if(pts.length<4)return null;
  const n=pts.length,xm=sum(pts,p=>p[0])/n,ym=sum(pts,p=>p[1])/n,sxx=sum(pts,p=>(p[0]-xm)**2)||1,sxy=sum(pts,p=>(p[0]-xm)*(p[1]-ym));
  let b=sxy/sxx,a=ym-b*xm;
  const sse=sum(pts,p=>(p[1]-(a+b*p[0]))**2),sst=sum(pts,p=>(p[1]-ym)**2),r2=sst>0?Math.max(0,1-sse/sst):0;
  const sd=Math.sqrt(sse/Math.max(1,n-2));
  const tend=r2>=0.15; /* sem tendência clara → projeta a média dos últimos 3 pontos */
  const m3=sum(pts.slice(-3),p=>p[1])/Math.min(3,pts.length),sd0=Math.sqrt(sum(pts,p=>(p[1]-ym)**2)/Math.max(1,n-1));
  const out=[],last=vals.length-1,t=n<8?1.6:1.3;
  for(let k=1;k<=h;k++){
    const x=last+k,y=tend?a+b*x:m3,se=tend?sd*Math.sqrt(1+1/n+(x-xm)**2/sxx):sd0;
    const yh=Math.max(0,y);
    out.push({v:yh,lo:Math.max(0,y-t*se),hi:y+t*se,se:se||1e-9,pAbove:meta>0?1-cdf((meta-y)/(se||1e-9)):null});
  }
  return{pts:out,slope:tend?b:0,r2,n,tend,conf:r2>=0.5&&n>=6?'média':r2>=0.15?'baixa':'muito baixa'};
}

/* ---------- coleta de dados do período ---------- */
const plNorm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const plDe=t=>{t=plNorm(t);return t.includes('FUND')?'F':t.includes('USIN')?'U':''};
function plNome(pl){return pl.f&&pl.u?'Fundição + Usinagem':pl.f?'Fundição':'Usinagem'}
function collect(a,b,pl){
  pl=pl||perLer();let PF=pl.f!==false,PU=pl.u!==false;if(!PF&&!PU){PF=PU=true}const both=PF&&PU,mt=pl.mt==='qtd'?'qtd':'kg',un=mt==='qtd'?'peças':'kg',vv=r=>mt==='qtd'?N(r.qtd):r.kg;pl={f:PF,u:PU,mt};
  const keep=c=>c==='F'?PF:c==='U'?PU:both;
  const g=G(),R=g.refAll().filter(r=>keep(plDe(r.pl))),Dall=g.devAll().filter(r=>keep(plDe(r.tipo))),D=Dall.filter(r=>!np(r.raw)),RT=(typeof rtLoad==='function'?rtLoad():[]).filter(r=>r.dt&&keep(plDe((typeof setorInfo==='function'&&setorInfo(r.setor)||{}).planta)));
  const hk=hojeK();let notaParcial='';
  let bb=b;if(bb>=hk){bb=g.addM(hk,-1);notaParcial=g.mesExt(hk)+' (mês em andamento) não entra na previsão'}
  if(bb<a)bb=a;
  let aa=a;const minA=g.addM(bb,-5);let ext=false;if(aa>minA){aa=minA;ext=true}
  const ms=range(aa,bb),lab=ms.map(m=>g.lblM(m));
  const rfK=m=>R.filter(r=>r.k===m),dvK=m=>D.filter(r=>r.k===m),rtK=m=>RT.filter(r=>isoMes(r.dt)===m);
  const mm=ms.map(m=>{const x=g.metricasMes(m,R,D);if(!PF)x.perc=null;return x});
  const S={
    refKg:ms.map(m=>Math.round(sum(rfK(m),vv)*100)/100),
    refPerc:mm.map(x=>(mt==='qtd'||x.perc==null)?null:Math.round(x.perc*100)/100),
    rtQ:ms.map(m=>sum(rtK(m),r=>N(r.qtd))),
    dvKg:ms.map(m=>Math.round(sum(dvK(m),vv)*100)/100),
    dvPerc:ms.map((m,i)=>mt==='kg'&&PF&&mm[i].prod?Math.round(sum(dvK(m).filter(r=>r.tipo==='Fundição'),r=>r.kg)/mm[i].prod*10000)/100:null),
    custo:ms.map((m,i)=>Math.round(mm[i].rs+sum(dvK(m),r=>r.rs)))
  };
  const inP=m=>m>=a&&m<=bb,inPrev=(m)=>{const len=range(a,bb).length,pa=g.addM(a,-len),pb=g.addM(a,-1);return m>=pa&&m<=pb};
  const Rp=R.filter(r=>inP(r.k)),Dp=D.filter(r=>inP(r.k)),RTp=RT.filter(r=>inP(isoMes(r.dt)));
  const Rq=R.filter(r=>inPrev(r.k)),Dq=D.filter(r=>inPrev(r.k)),RTq=RT.filter(r=>inPrev(isoMes(r.dt)));
  const tot={refKg:sum(Rp,vv),dvKg:sum(Dp,vv),rtQ:sum(RTp,r=>N(r.qtd)),rs:sum(Rp,r=>r.rs)+sum(Dp,r=>r.rs)};
  const prev={refKg:sum(Rq,vv),dvKg:sum(Dq,vv),rtQ:sum(RTq,r=>N(r.qtd)),rs:sum(Rq,r=>r.rs)+sum(Dq,r=>r.rs)};
  const mPer=range(a,bb),prodP=sum(mPer,m=>g.metricasMes(m,R,D).prod),kgFP=sum(Rp.filter(r=>r.pl==='FUNDICAO'),r=>r.kg);
  tot.perc=mt==='kg'&&PF&&prodP?kgFP/prodP*100:null;
  const mPrev=range(g.addM(a,-mPer.length),g.addM(a,-1)),prodQ=sum(mPrev,m=>g.metricasMes(m,R,D).prod),kgFQ=sum(Rq.filter(r=>r.pl==='FUNDICAO'),r=>r.kg);
  prev.perc=mt==='kg'&&PF&&prodQ?kgFQ/prodQ*100:null;
  const rk=(rows,key,val,lim)=>{const m=new Map();rows.forEach(r=>{const k=String(key(r)||'').trim()||'Não informado';m.set(k,(m.get(k)||0)+val(r))});return[...m].map(([nome,v])=>({nome,v})).filter(e=>e.v>0).sort((x,y)=>y.v-x.v).slice(0,lim||10)};
  const causa=rk(Rp,r=>r.causa||'Sem causa',vv,8),motivo=rk(Rp,r=>r.mot,vv,10);
  const cl=new Map(),ac=(c,f,v)=>{const key=String(c||'').trim()||'Não informado',e=cl.get(key)||{rk:0,dk:0,rq:0};e[f]+=v;cl.set(key,e)};
  Rp.forEach(r=>ac(r.cli,'rk',vv(r)));Dp.forEach(r=>ac(r.cli,'dk',vv(r)));RTp.forEach(r=>ac(r.cli,'rq',N(r.qtd)));
  const clientes=[...cl].map(([nome,e])=>({nome,...e,v:e.rk+e.dk})).sort((x,y)=>y.v-x.v).slice(0,10);
  const it=new Map(),ai=(cod,nome,f,v)=>{cod=String(cod||'').trim();if(!cod)return;const e=it.get(cod)||{nome:nome||cod,rf:0,rt:0,dv:0};if(nome&&e.nome===cod)e.nome=nome;e[f]+=v;it.set(cod,e)};
  Rp.forEach(r=>ai(r.cod,r.pec,'rf',r.qtd));RTp.forEach(r=>ai(r.cod,r.prod,'rt',N(r.qtd)));Dp.forEach(r=>ai(r.cod,r.pec,'dv',r.qtd));
  const rec=[...it].map(([c,e])=>({c,...e,n:(e.rf>0)+(e.rt>0)+(e.dv>0),t:e.rf+e.rt+e.dv})).filter(e=>e.n>=2).sort((x,y)=>y.n-x.n||y.t-x.t).slice(0,10);
  const metaP=(mt==='kg'&&PF&&typeof meta!=='undefined'&&meta&&meta.perc>0)?meta.perc:0;
  const sc=Rp.filter(r=>!r.causa||r.causa==='Outros'||r.causa==='Sem causa'),semCausa=tot.refKg?sum(sc,vv)/tot.refKg*100:0;
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const pend=D.filter(r=>(r.disp||'Aguardando análise')==='Aguardando análise'&&r.data&&(hoje-new Date(r.data+'T00:00:00'))/864e5>15).length;
  const rtAb=RT.filter(r=>r.st!==RT_ST[2]&&rtAge(r)>3).length;
  const dp=RTp.filter(r=>rtMpp(r)!=null),mpp=dp.length?sum(dp,r=>rtDur(r))/sum(dp,r=>rtPecasTrab(r)):null;
  const fc={},H=3;
  fc.refKg=prever(S.refKg,H);fc.refPerc=prever(S.refPerc,H,metaP);fc.rtQ=prever(S.rtQ,H);fc.dvKg=prever(S.dvKg,H);fc.dvPerc=prever(S.dvPerc,H);if(okCusto())fc.custo=prever(S.custo,H);
  const fl=[1,2,3].map(i=>g.lblM(g.addM(bb,i)));
  return{pl,mt,un,pesoTxt:(mt==='kg'&&typeof PESO_CURTO!=='undefined')?PESO_CURTO[pesoTipo()]:'',plNome:plNome(pl),a,b:bb,aa,ms,lab,fl,S,fc,tot,prev,causa,motivo,clientes,rec,metaP,semCausa,pend,rtAb,mpp,notaParcial,ext,nPer:mPer.length,custo:okCusto()};
}

/* ---------- textos automáticos ---------- */
const P0=v=>v>=100?Math.round(v).toLocaleString('pt-BR')+'%':P(v);
const varTxt=(a,b)=>(!(b>0)||a==null)?'':(a>=b?'+':'−')+P(Math.abs((a-b)/b*100));
const seta=(a,b,pior)=>{if(!(b>0))return'';const up=a>b;const bad=pior==='up'?up:!up;return'<span style="color:'+(Math.abs(a-b)/b<0.02?MUT:bad?RD:GR)+'">'+(up?'▲ ':'▼ ')+P0(Math.abs((a-b)/b*100))+'</span>'};
function trendTxt(nome,vals,f,unid,fmtF){
  fmtF=fmtF||F;const pts=vals.filter(v=>v!=null);if(!pts.length)return'<p>Sem dados no período.</p>';
  const last=pts[pts.length-1],avg=sum(pts,x=>x)/pts.length;
  let s='<p><b>'+nome+'</b>: último mês completo '+fmtF(last)+' '+unid+'; média do período '+fmtF(avg)+' '+unid+'.</p>';
  if(!f)return s+'<p class="mut">Histórico insuficiente para prever (mínimo de 4 meses com dados).</p>';
  const p=f.pts;
  s+='<p>🔮 <b>Previsão</b>: '+f.pts.map((x,i)=>'<b>'+fmtF(x.v)+'</b>').join(' → ')+' '+unid+' nos próximos 3 meses ('+(f.tend?(f.slope>0?'tendência de alta de '+fmtF(Math.abs(f.slope))+' '+unid+'/mês':'tendência de queda de '+fmtF(Math.abs(f.slope))+' '+unid+'/mês'):'sem tendência clara — projeção pela média recente')+'). Confiança '+f.conf+'.</p>';
  return s;
}
function atencao(d){
  const at=[],g=G(),L=[];
  if(d.metaP&&d.tot.perc!=null&&d.tot.perc>d.metaP)at.push('Refugo da Fundição no período ('+P(d.tot.perc)+') acima da meta de '+P(d.metaP)+'.');
  const f=d.fc.refPerc;if(f&&d.metaP){const m=f.pts.findIndex(x=>x.pAbove>=0.5);if(m>=0)at.push('A projeção indica refugo da Fundição acima da meta em '+d.fl[m]+' (chance estimada de '+Math.round(f.pts[m].pAbove*100)+'%).')}
  [['refKg','refugo ('+d.un+')'],['rtQ','retrabalho (peças)'],['dvKg','devoluções ('+d.un+')']].forEach(([k,n])=>{const p=d.fc[k];if(p&&p.tend&&p.slope>0&&p.r2>=0.3)at.push('Tendência de <b>alta</b> em '+n+' (projeção aponta '+F(p.pts[2].v)+' em '+d.fl[2]+').')});
  [['refKg','refugo'],['dvKg','devoluções'],['rtQ','retrabalho']].forEach(([k,n])=>{if(d.prev[k]>0&&d.tot[k]>d.prev[k]*1.2)at.push('O '+n+' subiu '+P((d.tot[k]-d.prev[k])/d.prev[k]*100)+' em relação ao período anterior equivalente.')});
  if(d.rtAb)at.push(d.rtAb+' etiqueta(s) de retrabalho abertas há mais de 3 dias.');
  if(d.pend)at.push(d.pend+' devolução(ões) aguardando destino há mais de 15 dias.');
  if(d.semCausa>30)at.push(P(d.semCausa)+' do refugo ('+d.un+') sem causa definida — classifique os motivos por causa.');
  return at;
}
function acoes(d){
  const a=[];
  if(d.causa[0])a.push('Abrir plano de ação para a causa <b>'+esc(d.causa[0].nome)+'</b> ('+P(d.causa[0].v/Math.max(1,sum(d.causa,e=>e.v))*100)+' do refugo classificado).');
  if(d.motivo[0])a.push('Atacar o motivo <b>'+esc(d.motivo[0].nome)+'</b>, o maior em '+d.un+' no período.');
  if(d.clientes[0])a.push('Revisar o histórico do cliente <b>'+esc(d.clientes[0].nome)+'</b>, de maior impacto somado.');
  if(d.rec[0])a.push('Análise de causa raiz do item <b>'+esc(d.rec[0].c+' - '+d.rec[0].nome)+'</b> (aparece em '+d.rec[0].n+' frentes).');
  if(d.pend||d.rtAb)a.push('Dar destino às pendências abertas (retrabalho e devoluções).');
  return a;
}

/* ---------- gráficos animados (canvas) ---------- */
const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
function setup(cv,w,h){const d=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(w*d);cv.height=Math.round(h*d);cv.style.width=w+'px';cv.style.height=h+'px';cv._w=w;cv._h=h;cv._d=d}
const nice=m=>{if(!(m>0))return 1;const e=Math.pow(10,Math.floor(Math.log10(m))),f=m/e;return(f<=1?1:f<=2?2:f<=5?5:10)*e};
let TH={ink:INK,mut:MUT,grid:'#e3e8ee',pt:'#fff',serie:INK};
function setTH(dark){TH=dark?{ink:'#e8eef4',mut:'#9fb0c2',grid:'#2a3846',pt:'#18222d',serie:'#9fb3c8'}:{ink:INK,mut:MUT,grid:'#e3e8ee',pt:'#fff',serie:INK}}
const appDark=()=>document.documentElement.getAttribute('data-theme')==='dark';
const C=c=>c===INK?TH.serie:c;
function draw(cv,sp,p){
  const ctx=cv.getContext('2d'),W=cv._w,H=cv._h,d=cv._d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,W,H);
  ctx.font='12px Arial, sans-serif';
  const f=sp.f||(v=>F(v));
  if(sp.type==='hbar'){
    const L=sp.labels,n=L.length;if(!n)return;
    const lw=Math.min(W*0.38,Math.max(...L.map(s=>ctx.measureText(s).width))+10),pad=16,top=8,bw=(H-top-8)/n,mx=Math.max(...sp.values)||1;
    L.forEach((s,i)=>{
      const e=ease((p-i*0.06)/0.7),y=top+i*bw,w=(W-lw-pad-(sp.total?150:70))*(sp.values[i]/mx)*e;
      ctx.fillStyle=TH.ink;ctx.textAlign='right';ctx.textBaseline='middle';ctx.font='13px Arial';{let tx=s.length>34?s.slice(0,33)+'…':s;while(tx.length>3&&ctx.measureText(tx).width>lw-2)tx=tx.slice(0,-2)+'…';ctx.fillText(tx,lw,y+bw/2)}
      ctx.fillStyle=sp.cores?sp.cores[i%sp.cores.length]:C(sp.cor||OR);const bh=Math.min(bw*0.62,34);ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lw+8,y+(bw-bh)/2,Math.max(2,w),bh,4);else ctx.rect(lw+8,y+(bw-bh)/2,Math.max(2,w),bh);ctx.fill();
      if(e>0.6){ctx.fillStyle=TH.ink;ctx.textAlign='left';ctx.font='bold 13px Arial';ctx.globalAlpha=Math.min(1,(e-0.6)/0.4);{const tv=f(sp.values[i]);ctx.fillText(tv,lw+14+w,y+bw/2);if(sp.total>0){const pc=Math.round(sp.values[i]/sp.total*1000)/10;ctx.fillStyle=OR;ctx.fillText('· '+String(pc).replace('.',',')+'%',lw+14+w+ctx.measureText(tv).width+8,y+bw/2)}}ctx.globalAlpha=1}
    });return;
  }
  const pl=58,pr=26,pt=sp.legend===false?16:34,pb=40,iw=W-pl-pr,ih=H-pt-pb;
  const lab=sp.labels,n=lab.length,nAct=sp.nAct||n;
  let mx=0;sp.series.forEach(s=>{s.values.forEach(v=>{if(v!=null)mx=Math.max(mx,v)});if(s.fc)s.fc.hi.forEach(v=>mx=Math.max(mx,v))});if(sp.meta)mx=Math.max(mx,sp.meta*1.1);
  const ymax=mx>0?mx*1.12:1;
  const X=i=>pl+(sp.type==='bar'?(i+0.5)/n:(n<=1?0.5:i/(n-1)))*iw,Y=v=>pt+ih-(v/ymax)*ih;
  ctx.strokeStyle=TH.grid;ctx.lineWidth=1;ctx.fillStyle=TH.mut;ctx.textAlign='right';ctx.textBaseline='middle';ctx.font='11px Arial';
  for(let i=0;i<=4;i++){const v=ymax*i/4,y=Y(v);ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(W-pr,y);ctx.stroke();ctx.fillText(f(v),pl-8,y)}
  ctx.textAlign='center';ctx.textBaseline='top';const step=Math.ceil(n/(iw/58));
  lab.forEach((s,i)=>{if(i%step===0||i===n-1){ctx.fillStyle=i>=nAct?OR:TH.mut;ctx.fillText(s,X(i),H-pb+10)}});
  if(sp.meta){const y=Y(sp.meta);ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle=RD;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(W-pr,y);ctx.stroke();ctx.restore();ctx.fillStyle=RD;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.font='bold 11px Arial';ctx.fillText('Meta '+f(sp.meta),W-pr,y-3)}
  if(sp.legend!==false){let lx=pl;ctx.font='12px Arial';ctx.textBaseline='middle';ctx.textAlign='left';sp.series.forEach(s=>{ctx.fillStyle=C(s.cor);ctx.fillRect(lx,10,14,4);ctx.fillStyle=TH.ink;ctx.fillText(s.name,lx+20,12);lx+=ctx.measureText(s.name).width+48});
    if(sp.series.some(s=>s.fc)){ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle=OR;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lx,12);ctx.lineTo(lx+22,12);ctx.stroke();ctx.restore();ctx.fillStyle=TH.ink;ctx.fillText(W<520?'Previsão':'Previsão (faixa provável)',lx+28,12)}}
  if(sp.type==='bar'){
    const bw=Math.min(46,iw/n*0.62),nS=sp.series.length;
    sp.series.forEach((s,j)=>{s.values.forEach((v,i)=>{if(v==null)return;const e=ease((p-i*0.04)/0.7),x=X(i)-bw/2+(sp.stack?0:j*bw/nS),w=sp.stack?bw:bw/nS;let base=0;if(sp.stack)for(let q=0;q<j;q++)base+=sp.series[q].values[i]||0;
      const y0=Y(base),y1=Y(base+v*e);ctx.fillStyle=C(s.cor);ctx.fillRect(x,y1,w-1,y0-y1);if(!sp.stack&&e>0.9&&n<=12){ctx.fillStyle=TH.ink;ctx.font='11px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(f(v),x+w/2,y1-3)}})});
    return;
  }
  /* linhas: parte real de 0 a 70% do tempo; previsão de 70% a 100% */
  const pa=Math.min(1,p/0.7),pf=Math.max(0,(p-0.7)/0.3);
  sp.series.forEach(s=>{
    const idx=[];s.values.forEach((v,i)=>{if(v!=null)idx.push(i)});if(!idx.length)return;
    const reach=ease(pa)*(nAct-1);
    ctx.strokeStyle=C(s.cor);ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();let started=false,hx=null,hy=null;
    for(let q=0;q<idx.length;q++){const i=idx[q];if(i>reach+1e-9){const pi=idx[q-1];if(pi!=null&&reach>pi){const v0=s.values[pi],v1=s.values[i],t=(reach-pi)/(i-pi),vv=v0+(v1-v0)*t;ctx.lineTo(X(reach),Y(vv));hx=X(reach);hy=Y(vv)}break}
      const x=X(i),y=Y(s.values[i]);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);hx=x;hy=y}
    ctx.stroke();
    /* área suave */
    /* pontos */
    idx.forEach(i=>{if(i<=reach+1e-9){ctx.fillStyle=TH.pt;ctx.strokeStyle=C(s.cor);ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(X(i),Y(s.values[i]),4,0,7);ctx.fill();ctx.stroke();if(n<=14&&sp.rot!==false&&(sp.series.length===1||s===sp.series[0])){ctx.fillStyle=TH.ink;ctx.font='11px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(f(s.values[i]),X(i),Y(s.values[i])-9);const q0=idx.indexOf(i),pv=q0>0?s.values[idx[q0-1]]:null;if(pv>0&&sp.var!==false&&Math.abs((s.values[i]-pv)/pv*100)>=0.05){const vr=(s.values[i]-pv)/pv*100;ctx.font='bold 10px Arial';ctx.fillStyle=Math.abs(vr)<2?TH.mut:vr>0?RD:GR;ctx.fillText((vr>0?'▲':'▼')+String(Math.round(Math.abs(vr)*10)/10).replace('.',',')+'%',X(i),Y(s.values[i])-22)}}}});
    if(hx!=null&&pa<1){ctx.fillStyle=C(s.cor);ctx.globalAlpha=0.25;ctx.beginPath();ctx.arc(hx,hy,11,0,7);ctx.fill();ctx.globalAlpha=1;ctx.beginPath();ctx.arc(hx,hy,5.5,0,7);ctx.fill()}
    if(s.fc&&pf>0){
      const li=idx[idx.length-1],k=s.fc.v.length,xs=[li,...s.fc.v.map((_,q)=>li+1+q)],ys=[s.values[li],...s.fc.v],los=[s.values[li],...s.fc.lo],his=[s.values[li],...s.fc.hi];
      const reachF=ease(pf)*k;
      ctx.save();ctx.globalAlpha=0.18*Math.min(1,pf*2);ctx.fillStyle=OR;ctx.beginPath();
      const m=Math.min(k,Math.ceil(reachF));
      ctx.moveTo(X(xs[0]),Y(his[0]));for(let q=1;q<=m;q++)ctx.lineTo(X(xs[q]),Y(his[q]));for(let q=m;q>=0;q--)ctx.lineTo(X(xs[q]),Y(los[q]));ctx.closePath();ctx.fill();ctx.restore();
      ctx.save();ctx.setLineDash([7,5]);ctx.strokeStyle=OR;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(X(xs[0]),Y(ys[0]));
      for(let q=1;q<=k;q++){if(q<=reachF)ctx.lineTo(X(xs[q]),Y(ys[q]));else{const t=reachF-(q-1);if(t>0){ctx.lineTo(X(xs[q-1])+(X(xs[q])-X(xs[q-1]))*t,Y(ys[q-1]+(ys[q]-ys[q-1])*t))}break}}ctx.stroke();ctx.restore();
      for(let q=1;q<=k;q++)if(q<=reachF){ctx.fillStyle=OR;ctx.beginPath();ctx.arc(X(xs[q]),Y(ys[q]),5,0,7);ctx.fill();ctx.fillStyle=OR;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(f(ys[q]),X(xs[q]),Y(his[q])-5);if(ys[q-1]>0&&sp.var!==false&&Math.abs((ys[q]-ys[q-1])/ys[q-1]*100)>=0.05){const vr=(ys[q]-ys[q-1])/ys[q-1]*100;ctx.font='bold 10px Arial';ctx.fillStyle=Math.abs(vr)<2?TH.mut:vr>0?RD:GR;ctx.fillText((vr>0?'▲':'▼')+String(Math.round(Math.abs(vr)*10)/10).replace('.',',')+'%',X(xs[q]),Y(his[q])-18)}}
    }
  });
}
function lineSpec(d,key,name,cor,f,meta,fcKey){
  const fc=d.fc[fcKey||key],vals=d.S[key],lab=d.lab.concat(fc?d.fl:[]);
  return{type:'line',labels:lab,nAct:d.lab.length,meta:meta||0,f,series:[{name,cor,values:vals,fc:fc?{v:fc.pts.map(x=>x.v),lo:fc.pts.map(x=>x.lo),hi:fc.pts.map(x=>x.hi)}:null}]};
}

/* ---------- slides ---------- */
const fK=v=>F(Math.round(v*10)/10),f2=v=>String(Math.round(v*100)/100).replace('.',','),fP=v=>f2(v)+'%',fR=v=>'R$ '+F(Math.round(v));
function slides(d){
  const U=d.un,fU=d.mt==='qtd'?(v=>F(Math.round(v))):fK,tit=d.mt==='qtd'?'Quantidade no período (peças)':(d.pesoTxt||'Peso')+' no período (kg)';
  const g=G(),per=g.lblM(d.a)+' a '+g.lblM(d.b),S=[];
  const logo=(document.querySelector('.sidebar .brand img')||{}).src||'';
  S.push({k:'capa',logo,t:'Reunião de resultados — Qualidade',st:'Refugo • Retrabalho • Devolução • '+d.plNome+(d.pesoTxt?' • '+d.pesoTxt:''),per,nota:d.notaParcial+(d.ext?(d.notaParcial?' · ':'')+'período ampliado para 6 meses para permitir a previsão':'')});
  /* resumo */
  const kp=[['Refugo no período ('+U+')',d.tot.refKg,d.prev.refKg,U,fU,'up'],...(d.pl.f&&d.mt==='kg'?[['Refugo Fundição (% da produção)',d.tot.perc,d.prev.perc,'%',fP,'up']]:[]),['Retrabalho (peças)',d.tot.rtQ,d.prev.rtQ,'peças',v=>F(Math.round(v)),'up'],['Devoluções procedentes ('+U+')',d.tot.dvKg,d.prev.dvKg,U,fU,'up']];
  if(d.custo)kp.push(['Custo da não qualidade',d.tot.rs,d.prev.rs,'R$',fR,'up']);
  const at=atencao(d);
  S.push({k:'kpi',t:'Resumo executivo',st:per+' • '+d.plNome+(d.pesoTxt?' • '+d.pesoTxt:'')+' • comparado ao período anterior equivalente',kpis:kp.map(x=>({n:x[0],v:x[1],f:x[4],d:x[2]!=null&&x[2]>0&&x[1]!=null?seta(x[1],x[2],x[5]):'<span class="mut">sem base anterior</span>'})),
    txt:'<p>No período foram <b>'+fU(d.tot.refKg)+' '+U+'</b> de refugo'+(d.tot.perc!=null?' ('+fP(d.tot.perc)+' da produção da Fundição'+(d.metaP?(d.tot.perc>d.metaP?', <b style="color:'+RD+'">acima</b> da meta de '+fP(d.metaP):', dentro da meta de '+fP(d.metaP)):'')+')':'')+', <b>'+F(d.tot.rtQ)+' peças</b> em retrabalho'+(d.mpp!=null?' (média de '+f2(d.mpp)+' min/peça)':'')+' e <b>'+fU(d.tot.dvKg)+' '+U+'</b> de devoluções procedentes.</p>'});
  if(d.S.refPerc.some(v=>v!=null))S.push({k:'chart',t:'Refugo da Fundição — % da produção',st:'Evolução mensal e previsão para os próximos 3 meses',ch:[lineSpec(d,'refPerc','Refugo Fundição (%)',OR,fP,d.metaP)],txt:trendTxt('Refugo da Fundição',d.S.refPerc,d.fc.refPerc,'%',f2)+(d.fc.refPerc&&d.metaP?'<p>Risco de ultrapassar a meta: '+d.fc.refPerc.pts.map((x,i)=>d.fl[i]+' <b>'+Math.round(x.pAbove*100)+'%</b>').join(' • ')+'.</p>':'')});
  S.push({k:'chart',t:'Refugo total ('+U+')',st:d.plNome+' • evolução e previsão',ch:[lineSpec(d,'refKg','Refugo ('+U+')',INK,fU)],txt:trendTxt('Refugo',d.S.refKg,d.fc.refKg,U,fU)});
  S.push({k:'chart',t:'Retrabalho (peças)',st:'Peças em retrabalho por mês',ch:[lineSpec(d,'rtQ','Retrabalho (peças)',BL,v=>F(Math.round(v)))],txt:trendTxt('Retrabalho',d.S.rtQ,d.fc.rtQ,'peças',v=>F(Math.round(v)))+(d.mpp!=null?'<p>Tempo médio de retrabalho no período: <b>'+f2(d.mpp)+' min por peça</b>.</p>':'')});
  S.push({k:'chart',t:'Devoluções procedentes ('+U+')',st:'Reclamações que não procedem ficam de fora',ch:[lineSpec(d,'dvKg','Devolução ('+U+')',GR,fU)],txt:trendTxt('Devoluções',d.S.dvKg,d.fc.dvKg,U,fU)});
  if(d.S.refPerc.some(v=>v!=null))S.push({k:'chart',t:'Perda da Fundição: refugo × devolução',st:'Percentual do peso produzido',ch:[{type:'line',labels:d.lab,nAct:d.lab.length,f:fP,series:[{name:'Refugo (%)',cor:OR,values:d.S.refPerc},{name:'Devolução (%)',cor:BL,values:d.S.dvPerc}]}],
    txt:(()=>{const a=d.S.refPerc[d.S.refPerc.length-1],b2=d.S.dvPerc[d.S.dvPerc.length-1];return a==null?'<p>Sem produção lançada para calcular o percentual.</p>':'<p>No último mês completo, refugo e devolução somaram <b>'+fP(a+(b2||0))+'</b> da produção da Fundição (refugo '+fP(a)+' + devolução '+fP(b2||0)+').</p>'})()});
  if(d.causa.length)S.push({k:'chart',t:'Refugo por causa do motivo',st:tit,ch:[{type:'hbar',labels:d.causa.map(e=>e.nome),values:d.causa.map(e=>Math.round(e.v)),f:v=>F(Math.round(v))+' '+U,total:d.tot.refKg,cor:OR}],txt:'<p>A principal causa foi <b>'+esc(d.causa[0].nome)+'</b>, com '+P(d.causa[0].v/sum(d.causa,e=>e.v)*100)+' do refugo classificado.</p>'+(d.semCausa>15?'<p class="mut">'+P(d.semCausa)+' do refugo está sem causa definida.</p>':'')});
  if(d.motivo.length)S.push({k:'chart',t:'Principais motivos de refugo',st:tit,ch:[{type:'hbar',labels:d.motivo.map(e=>e.nome),values:d.motivo.map(e=>Math.round(e.v)),f:v=>F(Math.round(v))+' '+U,total:d.tot.refKg,cor:INK}],txt:'<p>Os 3 maiores motivos somam <b>'+P(sum(d.motivo.slice(0,3),e=>e.v)/Math.max(1,d.tot.refKg)*100)+'</b> do refugo total. O líder é <b>'+esc(d.motivo[0].nome)+'</b> ('+fU(d.motivo[0].v)+' '+U+').</p>'});
  if(d.clientes.length)S.push({k:'chart',t:'Clientes com maior impacto',st:'Refugo + devolução ('+U+')',ch:[{type:'hbar',labels:d.clientes.map(e=>e.nome),values:d.clientes.map(e=>Math.round(e.v)),f:v=>F(Math.round(v))+' '+U,total:d.tot.refKg+d.tot.dvKg,cor:BL}],txt:'<p><b>'+esc(d.clientes[0].nome)+'</b> concentra o maior impacto: '+fU(d.clientes[0].rk)+' '+U+' de refugo, '+fU(d.clientes[0].dk)+' '+U+' devolvidos e '+F(d.clientes[0].rq)+' peças em retrabalho.</p>'});
  if(d.rec.length)S.push({k:'tabela',t:'Itens recorrentes',st:'Com problema em mais de uma frente no período',cab:['Item','Refugo (pç)','Retrabalho (pç)','Devolução (pç)','Frentes'],rows:d.rec.map(e=>[e.c+' - '+e.nome,e.rf,e.rt,e.dv,e.n]),txt:'<p>Itens que escapam do refugo e voltam como retrabalho ou devolução pedem análise de causa raiz.</p>'});
  if(d.custo)S.push({k:'chart',t:'Custo estimado da não qualidade',st:'Refugo + devoluções (R$)',ch:[lineSpec(d,'custo','Custo (R$)',RD,fR)],txt:trendTxt('Custo',d.S.custo,d.fc.custo,'',fR)+'<p class="mut">O retrabalho não tem custo em R$ no sistema e não entra nesta soma.</p>'});
  /* previsão consolidada */
  const lin=[['Refugo ('+U+')','refKg',fU],['Refugo Fundição (%)','refPerc',f2],['Retrabalho (peças)','rtQ',v=>F(Math.round(v))],['Devoluções ('+U+')','dvKg',fU]];if(d.custo)lin.push(['Custo (R$)','custo',fR]);if(!d.pl.f||d.mt==='qtd')lin.splice(1,1);
  S.push({k:'tabela',t:'Previsão consolidada',st:'Projeção estatística (tendência linear dos meses completos)',cab:['Indicador','Último mês',d.fl[0],d.fl[1],d.fl[2],'Tendência','Confiança'],
    rows:lin.map(([n,k,ff])=>{const v=d.S[k].filter(x=>x!=null),fc=d.fc[k];return[n,v.length?ff(v[v.length-1]):'—',...(fc?fc.pts.map(x=>ff(x.v)):['—','—','—']),fc?(fc.tend?(fc.slope>0?'▲ alta':'▼ queda'):'● estável'):'—',fc?fc.conf:'—']}),
    txt:'<p class="mut">Previsão baseada apenas no histórico lançado — não considera mudanças de processo, sazonalidade ou paradas. Quanto menor a confiança, mais cuidado ao usar o número.</p>'});
  const ac=acoes(d);
  S.push({k:'lista',t:'Pontos de atenção e ações sugeridas',st:'Gerado automaticamente a partir dos dados',a:at,b:ac});
  return S;
}

/* ---------- renderização dos slides ---------- */
const CSS='#prOv{position:fixed;inset:0;z-index:100000;background:#10161d;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif;color:'+INK+'}#prOv .stage{flex:1;position:relative;overflow:hidden}#prOv .ps{position:absolute;inset:0;background:#f6f8fa;display:flex;flex-direction:column;opacity:0;transform:translateX(40px);transition:opacity .45s,transform .45s;pointer-events:none}#prOv .ps.on{opacity:1;transform:none;pointer-events:auto}#prOv .ps.out{transform:translateX(-40px)}'+
'.ps header{display:flex;align-items:center;gap:16px;padding:14px 3vw;background:'+INK+';color:#fff;border-bottom:5px solid '+OR+'}.ps header img{height:38px;background:#fff;border-radius:6px;padding:2px}.ps header .pt{font-size:clamp(18px,2.3vw,32px);font-weight:800}.ps header .ps2{font-size:clamp(11px,1.1vw,15px);opacity:.8}.ps header .pn{margin-left:auto;font-size:13px;opacity:.7}'+
'.ps .pb{flex:1;display:flex;gap:2vw;padding:2vh 3vw;min-height:0}.ps .pcard{flex:1.9;background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:12px;min-width:0;position:relative}.ps .pcard .cvw{position:absolute;inset:12px}.ps aside{flex:1;background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:2vh 1.6vw;font-size:clamp(13px,1.35vw,20px);line-height:1.5;overflow:auto;border-left:6px solid '+OR+'}.ps aside p{margin:0 0 .7em}.ps .mut{color:'+MUT+';font-size:.85em}'+
'.ps footer{padding:6px 3vw;font-size:11px;color:'+MUT+';display:flex;justify-content:space-between}.ps .kpis{flex:1.9;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.4vw;align-content:center}.ps .kpi{background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:2.2vh 1.4vw;border-top:6px solid '+OR+'}.ps .kpi .kn{font-size:clamp(12px,1.2vw,17px);color:'+MUT+';font-weight:700}.ps .kpi .kv{font-size:clamp(28px,3.6vw,54px);font-weight:900;margin:.2em 0}.ps .kpi .kd{font-size:clamp(12px,1.1vw,16px);font-weight:700}'+
'.ps .tb{width:100%;border-collapse:collapse;font-size:clamp(12px,1.25vw,18px)}.ps .tb th{background:'+INK+';color:#fff;text-align:left;padding:8px 10px}.ps .tb td{padding:8px 10px;border-bottom:1px solid #e3e8ee}.ps .tb tr:nth-child(even) td{background:#f6f8fa}.ps .tb td.n{text-align:right}'+
'.ps.capa{background:linear-gradient(135deg,'+INK+' 0%,#1c242d 100%);color:#fff;align-items:center;justify-content:center;text-align:center}.ps.capa img{height:22vh;background:#fff;border-radius:18px;padding:10px;margin-bottom:3vh}.ps.capa h1{font-size:clamp(28px,4.6vw,66px);margin:0 0 1vh}.ps.capa .b{font-size:clamp(16px,2vw,30px);color:'+OR+';font-weight:800}.ps.capa .per{margin-top:3vh;font-size:clamp(14px,1.6vw,24px);opacity:.9}.ps.capa .nt{margin-top:2vh;font-size:12px;opacity:.6}.ps.capa .line{width:0;height:5px;background:'+OR+';margin:2vh auto;transition:width 1.4s ease}.ps.capa.on .line{width:30vw}'+
'.ps ul{margin:0;padding-left:1.2em}.ps li{margin-bottom:.5em}.ps h3{margin:0 0 .6em;font-size:1.1em;color:'+OR+'}'+
'#prOv .bar{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#0b1015;color:#cfd8e1;font-size:13px}#prOv .bar button{background:#243140;color:#fff;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;font-weight:700}#prOv .bar button:hover{background:'+OR+'}#prOv .bar .pg{flex:1;height:5px;background:#243140;border-radius:4px;overflow:hidden}#prOv .bar .pg i{display:block;height:100%;background:'+OR+';width:0;transition:width .4s}'+
'#prPan .pp{background:var(--card,#fff);color:var(--text,#1d2733);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px}#prPan .pp table{width:100%;border-collapse:collapse;font-size:13px}#prPan .pp th,#prPan .pp td{padding:6px 8px;border-bottom:1px solid var(--border,#e3e8ee);text-align:left}#prPan .pp th{background:#2f3b47;color:#fff}#prPan .bar2{display:flex;flex-wrap:wrap;gap:8px;align-items:center}#prPan .bar2 label{font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}';
const DK='#prOv.dk{color:#e8eef4}#prOv.dk .ps:not(.capa){background:#0f1720;color:#e8eef4}#prOv.dk .ps header{background:#0a1118}#prOv.dk .ps .pcard,#prOv.dk .ps aside,#prOv.dk .ps .kpi{background:#18222d;box-shadow:none;border:1px solid #243140;border-top-color:'+OR+'}#prOv.dk .ps aside{border-left:6px solid '+OR+'}#prOv.dk .ps .mut,#prOv.dk .ps footer{color:#9fb0c2}#prOv.dk .ps .kpi .kn{color:#9fb0c2}#prOv.dk .ps .tb td{border-bottom-color:#243140}#prOv.dk .ps .tb tr:nth-child(even) td{background:#1d2935}';
const MOB='#prOv{height:100vh;height:100dvh}@media(max-width:820px),(max-height:520px){#prOv .ps header{padding:8px 12px;gap:10px;border-bottom-width:3px}#prOv .ps header img{height:28px}#prOv .ps header .pt{font-size:17px}#prOv .ps header .ps2{font-size:11px}#prOv .ps header .pn{display:none}#prOv .ps .pb{padding:8px 10px;gap:8px;overflow-y:auto;-webkit-overflow-scrolling:touch}#prOv .ps footer{display:none}#prOv .ps aside{font-size:14px;padding:10px 12px;border-left-width:4px;flex:none}#prOv .ps .kpis{grid-template-columns:repeat(2,1fr);gap:8px}#prOv .ps .kpi{padding:10px}#prOv .ps .kpi .kv{font-size:26px}#prOv .ps .tb{font-size:12px}#prOv .ps.capa img{height:16vh}#prOv .ps.capa h1{font-size:26px;padding:0 12px}#prOv .bar{flex-wrap:wrap;gap:6px;padding:6px 8px calc(6px + env(safe-area-inset-bottom))}#prOv .bar button{padding:9px 11px;min-height:40px;font-size:12px}#prOv .bar .pg{flex:1 1 100%;order:-1}#prOv .bar .ct{margin-left:auto}}@media(max-width:820px) and (orientation:portrait){#prOv .ps .pb{flex-direction:column}#prOv .ps .pcard{flex:none;height:44vh;min-height:260px}#prOv .ps .pcard[style*="overflow"]{height:auto;max-height:50vh}#prOv .ps .kpis{flex:none}}@media(max-height:520px) and (orientation:landscape){#prOv .ps aside{font-size:12px}#prOv .ps .pcard{flex:1.6}}';
const CSSX=CSS.replace(/(^|\})\.ps/g,'$1#prOv .ps')+DK+MOB;
function ensureCss(){if($('prCss'))return;const s=document.createElement('style');s.id='prCss';s.textContent=CSSX;document.head.appendChild(s)}
function slideHtml(s,i,n,per,static_){
  const hd='<header>'+(s.logo||logoSrc()?'<img src="'+(s.logo||logoSrc())+'" alt="">':'')+'<div><div class="pt">'+esc(s.t)+'</div><div class="ps2">'+esc(s.st||'')+'</div></div><div class="pn">'+(i+1)+' / '+n+'</div></header>';
  const ft='<footer><span>Controle de Refugos • '+esc(per)+'</span><span>Gerado em '+new Date().toLocaleDateString('pt-BR')+'</span></footer>';
  if(s.k==='capa')return'<section class="ps capa"><img src="'+s.logo+'" alt=""><h1>'+esc(s.t)+'</h1><div class="b">'+esc(s.st)+'</div><div class="line"></div><div class="per">'+esc(s.per)+'</div>'+(s.nota?'<div class="nt">'+esc(s.nota)+'</div>':'')+'</section>';
  let body='';
  if(s.k==='kpi')body='<div class="kpis">'+s.kpis.map((x,q)=>'<div class="kpi"><div class="kn">'+esc(x.n)+'</div><div class="kv" data-kv="'+q+'">'+(x.v==null?'—':x.f(x.v))+'</div><div class="kd">'+x.d+'</div></div>').join('')+'</div><aside>'+s.txt+'</aside>';
  else if(s.k==='chart')body='<div class="pcard"><div class="cvw">%%CH0%%</div></div><aside>'+s.txt+'</aside>';
  else if(s.k==='tabela')body='<div class="pcard" style="overflow:auto"><table class="tb"><thead><tr>'+s.cab.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+s.rows.map(r=>'<tr>'+r.map((c,q)=>'<td'+(q>0&&typeof c==='number'?' class="n"':'')+'>'+(typeof c==='number'?F(c):esc(c))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><aside>'+s.txt+'</aside>';
  else if(s.k==='lista')body='<div class="pcard" style="overflow:auto;font-size:clamp(13px,1.4vw,20px);line-height:1.5"><h3>⚠ Pontos de atenção</h3>'+(s.a.length?'<ul>'+s.a.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'<p>Nenhum ponto crítico identificado automaticamente.</p>')+'</div><aside><h3>✔ Ações sugeridas</h3>'+(s.b.length?'<ul>'+s.b.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'<p>Sem sugestões.</p>')+'<p class="mut">Sugestões automáticas a partir dos dados; valide em reunião.</p></aside>';
  return'<section class="ps">'+hd+'<div class="pb">'+body+'</div>'+ft+'</section>';
}
const logoSrc=()=>(document.querySelector('.sidebar .brand img')||{}).src||'';
let cur=null;
function abrir(a,b){
  ensureCss();fechar();
  const d=collect(a,b),S=slides(d),per=G().lblM(d.a)+' a '+G().lblM(d.b);
  const ov=document.createElement('div');ov.id='prOv';
  ov.innerHTML='<div class="stage">'+S.map((s,i)=>{const h=slideHtml(s,i,S.length,per);return h.replace('%%CH0%%','<canvas class="pc" data-i="'+i+'"></canvas>')}).join('')+'</div><div class="bar"><button data-a="prev">◀</button><button data-a="next">▶</button><div class="pg"><i></i></div><span class="ct"></span><button data-a="replay" title="Repetir animação (R)">⟲ Animar</button><button data-a="vel" title="Velocidade da animação">⏱ Lenta</button><button data-a="tema" title="Tema claro/escuro (T)">🌙 Tema</button><button data-a="auto" title="Avanço automático (A)">⏵ Auto</button><button data-a="pdf">📄 PDF</button><button data-a="fs" title="Tela cheia (F)">⛶</button><button data-a="x" title="Fechar (Esc)">✕</button></div>';
  document.body.appendChild(ov);
  (function(){const st=ov.querySelector('.stage');let x0=null,y0=0,t0=0;
    st.addEventListener('touchstart',e=>{if(e.touches.length!==1){x0=null;return}x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now()},{passive:true});
    st.addEventListener('touchend',e=>{if(x0==null||!cur)return;const t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5&&Date.now()-t0<900){e.preventDefault();ir(cur.i+(dx<0?1:-1))}},{passive:false});
    if(!ov.requestFullscreen&&!ov.webkitRequestFullscreen){const f=ov.querySelector('[data-a=fs]');if(f)f.style.display='none'}
  })();
  let tema='dk',vel=7000;try{tema=localStorage.getItem('controle_refugos_2026_prtema')||'dk';vel=+localStorage.getItem('controle_refugos_2026_prvel')||7000}catch(e){}
  cur={ov,S,d,i:-1,raf:0,auto:0,per,vel,tema};ov.classList.toggle('dk',tema==='dk');setTH(tema==='dk');
  ov.querySelector('.bar').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const a=t.dataset.a;if(a==='prev')ir(cur.i-1);else if(a==='next')ir(cur.i+1);else if(a==='replay')anim();else if(a==='vel')velo();else if(a==='tema')tema2();else if(a==='auto')auto();else if(a==='pdf')pdf();else if(a==='fs')tela();else if(a==='x')fechar()});
  ov.querySelector('.stage').addEventListener('click',e=>{if(e.target.closest('aside,.pcard,.kpi'))return;ir(cur.i+1)});
  document.addEventListener('keydown',tecla,true);window.addEventListener('resize',redim);
  ir(0);
}
function tecla(e){if(!cur)return;const k=e.key;if(k==='ArrowRight'||k==='PageDown'||k===' '||k==='Enter'){e.preventDefault();ir(cur.i+1)}else if(k==='ArrowLeft'||k==='PageUp'||k==='Backspace'){e.preventDefault();ir(cur.i-1)}else if(k==='Home')ir(0);else if(k==='End')ir(cur.S.length-1);else if(k==='Escape'){e.preventDefault();e.stopPropagation();fechar()}else if(k==='f'||k==='F')tela();else if(k==='r'||k==='R')anim();else if(k==='t'||k==='T')tema2();else if(k==='a'||k==='A')auto()}
const VEL=[[4000,'Normal'],[7000,'Lenta'],[11000,'Muito lenta']];
function velo(){const q=VEL.findIndex(x=>x[0]===cur.vel),n=VEL[(q+1)%VEL.length];cur.vel=n[0];try{localStorage.setItem('controle_refugos_2026_prvel',n[0])}catch(e){}cur.ov.querySelector('[data-a=vel]').textContent='⏱ '+n[1];anim()}
function tema2(){cur.tema=cur.tema==='dk'?'lt':'dk';cur.ov.classList.toggle('dk',cur.tema==='dk');setTH(cur.tema==='dk');try{localStorage.setItem('controle_refugos_2026_prtema',cur.tema)}catch(e){}anim()}
function tela(){const el=cur&&cur.ov;if(!el)return;try{if(document.fullscreenElement)document.exitFullscreen();else el.requestFullscreen&&el.requestFullscreen()}catch(e){}}
function auto(){if(!cur)return;if(cur.auto){clearInterval(cur.auto);cur.auto=0}else cur.auto=setInterval(()=>{if(cur.i>=cur.S.length-1){clearInterval(cur.auto);cur.auto=0}else ir(cur.i+1)},12000);const bt=cur.ov.querySelector('[data-a=auto]');bt.textContent=cur.auto?'⏸ Auto':'⏵ Auto'}
function redim(){if(!cur)return;const el=cur.ov.querySelectorAll('.ps')[cur.i];if(el)ajusta(el,1)}
function ajusta(el,p){const i=[...cur.ov.querySelectorAll('.ps')].indexOf(el),s=cur.S[i];el.querySelectorAll('canvas.pc').forEach(cv=>{const w=cv.parentElement;setup(cv,Math.max(50,w.clientWidth),Math.max(50,w.clientHeight));draw(cv,s.ch[0],p)})}
function ir(i){
  if(!cur)return;const n=cur.S.length;if(i<0||i>=n)return;
  const els=cur.ov.querySelectorAll('.ps');els.forEach((e,q)=>{e.classList.toggle('on',q===i);e.classList.toggle('out',q<i)});
  cur.i=i;cur.ov.querySelector('.pg i').style.width=((i+1)/n*100)+'%';cur.ov.querySelector('.ct').textContent=(i+1)+' / '+n;const vb=cur.ov.querySelector('[data-a=vel]');if(vb)vb.textContent='⏱ '+(VEL.find(x=>x[0]===cur.vel)||VEL[1])[1];
  setTimeout(()=>anim(),250);
}
function anim(){
  if(!cur)return;cancelAnimationFrame(cur.raf);const el=cur.ov.querySelectorAll('.ps')[cur.i],s=cur.S[cur.i];if(!el)return;
  const cvs=[...el.querySelectorAll('canvas.pc')],kv=[...el.querySelectorAll('[data-kv]')];
  cvs.forEach(cv=>{const w=cv.parentElement;setup(cv,Math.max(50,w.clientWidth),Math.max(50,w.clientHeight))});
  const dur=(s.k==='chart'?cur.vel:cur.vel*0.55),t0=performance.now(),myI=cur.i;
  const step=now=>{if(!cur||cur.i!==myI)return;const p=Math.min(1,(now-t0)/dur);cvs.forEach(cv=>draw(cv,s.ch[0],p));kv.forEach(e=>{const x=s.kpis[+e.dataset.kv];if(x.v!=null)e.textContent=x.f(x.v*ease(p))});if(p<1)cur.raf=requestAnimationFrame(step)};
  cur.raf=requestAnimationFrame(step);
}
function fechar(){if(!cur)return;cancelAnimationFrame(cur.raf);clearInterval(cur.auto);document.removeEventListener('keydown',tecla,true);window.removeEventListener('resize',redim);try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}cur.ov.remove();cur=null}
/* PDF: um slide por página, gráficos no estado final */
function pdf(){
  const c=cur&&cur.d?cur:null;let d,S,per;if(c){d=c.d;S=c.S;per=c.per}else{const p=perLer();d=collect(p.a,p.b);S=slides(d);per=G().lblM(d.a)+' a '+G().lblM(d.b)}
  ensureCss();const th0=TH;setTH(false);
  const pages=S.map((s,i)=>{let h=slideHtml(s,i,S.length,per);if(s.k==='chart'){const cv=document.createElement('canvas');setup(cv,900,500);draw(cv,s.ch[0],1);h=h.replace('%%CH0%%','<img src="'+cv.toDataURL('image/png')+'" style="width:100%;height:100%;object-fit:contain">')}return h.replace('class="ps','class="ps on pdfp').replace('class="ps on pdfp capa','class="ps on pdfp capa')});
  TH=th0;
  const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
  const w=f.contentWindow.document;w.open();w.write('<!doctype html><html><head><meta charset="utf-8"><title>Reunião de resultados '+esc(per)+'</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0}body{font-family:Arial,sans-serif;color:'+INK+';-webkit-print-color-adjust:exact;print-color-adjust:exact}.ps{position:relative!important;inset:auto!important;opacity:1!important;transform:none!important;width:297mm;height:209mm;page-break-after:always;break-after:page;overflow:hidden}.ps.capa .line{width:30vw!important}'+CSS.replace(/#prOv /g,'').replace(/#prPan[^}]*}/g,'')+'.ps .pcard .cvw{position:absolute;inset:12px}.ps header img{height:30px}.ps aside{font-size:12px!important}</style></head><body>'+pages.join('')+'</body></html>');w.close();
  Promise.all([...w.images].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=im.onerror=r}))).then(()=>setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){alert('Não foi possível abrir a impressão.')}setTimeout(()=>f.remove(),60000)},400));
}

/* ---------- painel na Visão geral (filtro + previsão + botões) ---------- */
function lerUIg(){const v=$('prPl').value;return{a:$('prA').value,b:$('prB').value,f:v!=='u',u:v!=='f',mt:$('prMt').value==='qtd'?'qtd':'kg'}}
function painel(){
  const host=$('gVisao');if(!host)return;ensureCss();
  let box=$('prPan');
  if(!box){box=document.createElement('div');box.id='prPan';host.insertBefore(box,host.firstChild);
    const p=perLer();
    box.innerHTML='<div class="pp"><div class="bar2"><strong>📅 Período da análise</strong><label>De <input type="month" id="prA"></label><label>Até <input type="month" id="prB"></label><label><strong>Planta</strong> <select id="prPl"><option value="fu">Fundição + Usinagem</option><option value="f">Fundição</option><option value="u">Usinagem</option></select></label><label><strong>Medir por</strong> <select id="prMt"><option value="kg">Peso (kg)</option><option value="qtd">Quantidade (peças)</option></select></label><label><strong>Tipo de peso</strong> <select id="prPs" onchange="setPesoTipo(this.value)"><option value="bruto">Bruto fracionado</option><option value="liquido">Líquido Fund. / bruto Usin.</option><option value="usinado">Usinado</option></select></label><span class="pesoAviso small" style="display:none;color:#d97706"></span>'+
    '<button class="btn secondary" type="button" data-pr="3">3 meses</button><button class="btn secondary" type="button" data-pr="6">6 meses</button><button class="btn secondary" type="button" data-pr="12">12 meses</button><button class="btn secondary" type="button" data-pr="ano">Ano</button>'+
    '<span style="flex:1"></span><button class="btn primary" type="button" id="prGo">🎬 Apresentar</button><button class="btn secondary" type="button" id="prPdf">📄 PDF da apresentação</button></div>'+
    '<div class="hint" style="margin-top:8px">O período vale para a <b>previsão</b> e para a <b>apresentação animada</b> (←/→ para navegar, F tela cheia, R repete a animação, A avança sozinho). O relatório mensal abaixo continua por mês. Para prever, o sistema precisa de pelo menos 4 meses e ignora o mês em andamento.</div></div>'+
    '<div class="pp" id="prFc"></div>';
    $('prA').value=p.a;$('prB').value=p.b;try{$('prPs').value=pesoTipo()}catch(e){}$('prPl').value=(p.f!==false&&p.u!==false)?'fu':(p.f!==false?'f':'u');$('prMt').value=p.mt==='qtd'?'qtd':'kg';
    const lerUI=lerUIg;
    const mud=()=>{const o=lerUI();if(o.a&&o.b&&o.a<=o.b){perGravar(o);prev();try{if(window.__relRefresh)window.__relRefresh()}catch(e){}}};
    $('prPl').addEventListener('change',mud);$('prMt').addEventListener('change',mud);
    $('prA').addEventListener('change',mud);$('prB').addEventListener('change',mud);
    box.querySelectorAll('[data-pr]').forEach(bt=>bt.addEventListener('click',()=>{const b=$('prB').value||hojeK(),k=bt.dataset.pr;let a;if(k==='ano'){a=b.slice(0,4)+'-01'}else a=G().addM(b,-(+k-1));$('prA').value=a;mud()}));
    $('prGo').addEventListener('click',()=>{const o=lerUI();if(!o.a||!o.b||o.a>o.b){alert('Escolha um período válido.');return}mud();abrir(o.a,o.b)});
    $('prPdf').addEventListener('click',()=>{const o=lerUI();if(!o.a||!o.b||o.a>o.b){alert('Escolha um período válido.');return}mud();cur=null;pdf()});
  }
  prev();
}
function prev(){
  const el=$('prFc');if(!el)return;
  let d;try{d=collect($('prA').value,$('prB').value,lerUIg())}catch(e){console.error(e);el.textContent='Erro ao calcular: '+e.message;return}
  const fU=d.mt==='qtd'?(v=>F(Math.round(v))):fK,lin=[['Refugo ('+d.un+')','refKg',fU],['Refugo Fundição (%)','refPerc',f2],['Retrabalho (peças)','rtQ',v=>F(Math.round(v))],['Devoluções ('+d.un+')','dvKg',fU]];if(d.custo)lin.push(['Custo (R$)','custo',fR]);if(!d.pl.f||d.mt==='qtd')lin.splice(1,1);
  el.innerHTML='<h3 style="margin:0 0 8px">🔮 Previsão para os próximos 3 meses</h3><div class="hint" style="margin-bottom:8px">'+d.plNome+' • Base: '+G().lblM(d.aa)+' a '+G().lblM(d.b)+(d.notaParcial?' • '+esc(d.notaParcial):'')+(d.ext?' • período ampliado para 6 meses':'')+'</div>'+
  '<div style="overflow:auto"><table><thead><tr><th>Indicador</th><th>Último mês</th>'+d.fl.map(x=>'<th>'+x+'</th>').join('')+'<th>Tendência</th><th>Confiança</th></tr></thead><tbody>'+
  lin.map(([n,k,ff])=>{const v=d.S[k].filter(x=>x!=null),fc=d.fc[k];return'<tr><td>'+n+'</td><td>'+(v.length?ff(v[v.length-1]):'—')+'</td>'+(fc?fc.pts.map(x=>'<td><b>'+ff(x.v)+'</b> <span style="color:#6b7785;font-size:11px">('+ff(x.lo)+'–'+ff(x.hi)+')</span></td>').join(''):'<td colspan="3">histórico insuficiente</td>')+'<td>'+(fc?(fc.tend?(fc.slope>0?'<span style="color:'+RD+'">▲ alta</span>':'<span style="color:'+GR+'">▼ queda</span>'):'● estável'):'—')+'</td><td>'+(fc?fc.conf:'—')+'</td></tr>'}).join('')+'</tbody></table></div>'+
  (d.fc.refPerc&&d.metaP?'<p style="margin:8px 0 0">Chance estimada de o refugo da Fundição passar da meta ('+fP(d.metaP)+'): '+d.fc.refPerc.pts.map((x,i)=>d.fl[i]+' <b>'+Math.round(x.pAbove*100)+'%</b>').join(' • ')+'.</p>':'')+
  '<div style="position:relative;height:260px;margin-top:10px"><canvas id="prCv"></canvas></div><div class="hint">Gráfico animado do '+(d.mt==='qtd'?'refugo (peças)':'refugo da Fundição (%)')+'. <a href="#" id="prRe">↺ repetir animação</a>. Estatística simples sobre o histórico lançado; não considera mudanças de processo, sazonalidade ou paradas.</div>';
  setTH(appDark());const cv=$('prCv'),sp=d.mt==='qtd'?lineSpec(d,'refKg','Refugo (peças)',OR,fU):lineSpec(d,'refPerc','Refugo Fundição (%)',OR,fP,d.metaP);
  const run=()=>{const w=cv.parentElement;if(!w.clientWidth)return;setup(cv,w.clientWidth,w.clientHeight);const t0=performance.now(),st=now=>{const p=Math.min(1,(now-t0)/6000);draw(cv,sp,p);if(p<1&&document.body.contains(cv))requestAnimationFrame(st)};requestAnimationFrame(st)};
  run();$('prRe').addEventListener('click',e=>{e.preventDefault();run()});
}
window.addEventListener('pesotipo',()=>{try{if($('prPan')){const e=$('prPs');if(e)e.value=pesoTipo();prev();if(window.__relRefresh)window.__relRefresh()}}catch(x){console.error(x)}});
window.__vgPatch=function(secs,k){
  const p=perLer(),d=collect(p.a,p.b,p),g=G(),per=g.lblM(d.a)+' a '+g.lblM(d.b),pla=(p.f!==false&&p.u!==false)?'Fundição + Usinagem':(p.f!==false?'Fundição':'Usinagem'),fU=d.mt==='qtd'?(v=>F(Math.round(v))):fK;
  const kp=[['Refugo ('+d.un+')',d.tot.refKg,d.prev.refKg,fU],...(d.mt==='kg'?[['Refugo Fundição (% da produção)',d.tot.perc,d.prev.perc,f2]]:[]),['Retrabalho (peças)',d.tot.rtQ,d.prev.rtQ,v=>F(Math.round(v))],['Devoluções procedentes ('+d.un+')',d.tot.dvKg,d.prev.dvKg,fU]];
  const tb='<table class="tb"><thead><tr><th>Indicador</th><th>'+esc(per)+'</th><th>Período anterior</th><th>Variação</th></tr></thead><tbody>'+kp.map(([n,a,b,ff])=>'<tr><td>'+n+'</td><td class="n">'+(a==null?'—':ff(a))+'</td><td class="n">'+(b==null?'—':ff(b))+'</td><td class="n">'+((a==null||!(b>0))?'—':(a>=b?'+':'−')+P(Math.abs((a-b)/b*100)))+'</td></tr>').join('')+'</tbody></table>';
  secs[0]={t:'Resumo executivo do período ('+per+' • '+pla+').',pre:tb,txt:'<p>No período foram <b>'+fU(d.tot.refKg)+' '+d.un+'</b> de refugo'+(d.tot.perc!=null?' ('+P(Math.round(d.tot.perc*100)/100)+' da produção da Fundição'+(d.metaP?(d.tot.perc>d.metaP?', acima da meta de '+P(d.metaP):', dentro da meta de '+P(d.metaP)):'')+')':'')+', <b>'+F(Math.round(d.tot.rtQ))+' peças</b> em retrabalho e <b>'+fU(d.tot.dvKg)+' '+d.un+'</b> de devoluções procedentes.</p>'+((p.f!==false&&p.u!==false)?'':'<p><i>Com uma só planta selecionada, o retrabalho considera apenas etiquetas com setor/máquina informado.</i></p>')};
  const at=atencao(d);
  secs[1]={t:'Pontos de atenção do período.',txt:at.length?'<ul>'+at.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'<p>Nenhum ponto crítico identificado automaticamente.</p>'};
  return secs;
};
const o=window.relUiInit;
window.relUiInit=function(c){if(typeof o==='function')o.apply(this,arguments);if(c==='vg'){try{painel()}catch(e){console.error('previsao',e)}}};
window.__previsao={prever,collect,slides,abrir,fechar,draw};
})();

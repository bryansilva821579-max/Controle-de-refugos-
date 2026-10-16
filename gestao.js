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
    out.push({k:mkKey(y,m),kg:kg(r),rs:cost(r),qtd:qty(r),pl:recordPlant(r),
      cli:canonicalClientName(val(r,'cliente'))||'Não informado',
      mot:motivoDescricao(r)||'Não informado',causa:causaPeloMotivo(r),
      cod:String(val(r,'codigo')||'').trim(),pec:String(val(r,'produto')||'').trim()});
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
  const prod=prodDe(k),kgR=somar(rr,r=>r.kg);
  return {k,prod,kg:kgR,rs:somar(rr,r=>r.rs),perc:prod?kgR/prod*100:null,
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
      const p=kgProj/mm.prod*100,r=p/meta.perc;
      if(r>1)add('crit','% de refugo acima da meta','Refugo '+(proj?'projetado ':'')+'de '+fmt(p)+'% contra meta de '+fmt(meta.perc)+'% ('+fmt(p-meta.perc)+' p.p. acima).');
      else if(r>=0.9)add('warn','% de refugo perto da meta','Refugo '+(proj?'projetado ':'')+'de '+fmt(p)+'% — meta de '+fmt(meta.perc)+'% (folga de '+fmt(100-r*100)+'%).');
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
  const kpis=[['Período',lblM(k)],['Produção da Fundição (kg)',fmt(mm.prod)],['Refugo total (kg)',fmt(mm.kg)],['% de refugo (refugo ÷ produção)',mm.perc===null?'—':fmt(mm.perc)+'%']];
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
    <button type="button" class="g-tab on" data-g="alertas" onclick="gestAba('alertas')">🔔 Alertas e metas</button>
    <button type="button" class="g-tab" data-g="comp" onclick="gestAba('comp')">⚖ Comparativo</button>
    <button type="button" class="g-tab" data-g="cruz" onclick="gestAba('cruz')">🔗 Refugo × Devolução</button>
    <button type="button" class="g-tab" data-g="rel" onclick="gestAba('rel')">📑 Relatório mensal</button>
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
      <button class="btn primary" type="button" onclick="gestPdf()">📄 Gerar PDF</button><button class="btn primary" type="button" onclick="gestXlsx()">📊 Baixar Excel (.xlsx)</button></div>
      <div class="hint">O PDF abre a janela de impressão (escolha “Salvar como PDF”). Os valores em R$ só entram com os custos liberados pela senha.</div>
      <div id="gRelPrev" class="g-prev"></div></div>
  </div>`;
  const mAtual=hojeK();
  ['gAlMes','gCmpA','gCrB','gRelMes'].forEach(id=>$(id).value=mAtual);
  $('gCmpB').value=addM(mAtual,-1);$('gCrA').value=addM(mAtual,-5);
  $('gCfgVar').value=cfg.var;$('gCfgMin').value=cfg.minKg;$('gCfgFat').value=cfg.fator;$('gCfgDias').value=cfg.diasPend;
  ['gAlMes'].forEach(id=>$(id).addEventListener('change',alertasUi));
  ['gCmpA','gCmpB','gCmpDim'].forEach(id=>$(id).addEventListener('change',compUi));
  ['gCrA','gCrB','gCrSo'].forEach(id=>$(id).addEventListener('change',cruzUi));
  $('gRelMes').addEventListener('change',relUi);
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
  const linhas=[['Produção da Fundição (kg)','prod',false],['Refugo (kg)','kg',true],['% de refugo','perc',true]];
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
function relUi(){const k=$('gRelMes').value||hojeK();$('gRelPrev').innerHTML=relHtml(relatorio(k))}
window.gestPdf=function(){gerarPdf($('gRelMes').value||hojeK())};
window.gestXlsx=function(){gerarXlsx($('gRelMes').value||hojeK())};
function render(){
  if(aba==='alertas')alertasUi();else if(aba==='comp')compUi();else if(aba==='cruz')cruzUi();else relUi();
}
window.gestAba=function(a){
  if(!built)return;aba=a;
  document.querySelectorAll('#gestRoot .g-tab').forEach(b=>b.classList.toggle('on',b.dataset.g===a));
  $('gAlertas').style.display=a==='alertas'?'':'none';$('gComp').style.display=a==='comp'?'':'none';
  $('gCruz').style.display=a==='cruz'?'':'none';$('gRel').style.display=a==='rel'?'':'none';
  render();
};
window.gestInit=function(){if(!built)build();gestAba(aba);badge()};
window.gestRefresh=function(){badge();const s=$('gestao');if(built&&s&&s.classList.contains('active'))render()};
/* para testes */
window.__gestao={calcAlertas,relatorio,cruzar,xlsxBlob,relSheets,metricasMes,crc32};
css();
setTimeout(badge,3000);
window.addEventListener('resize',()=>{if(built&&(aba==='comp')&&$('gestao')?.classList.contains('active'))compUi()});
})();

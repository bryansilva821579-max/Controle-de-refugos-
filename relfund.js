/* Relatório mensal de fundição (v237): custo de matéria-prima nodular × cinzento, resultados metalúrgicos e análise térmica.
   Lê o Boletim de Fusão e a planilha de Análise Térmica (.xlsx), guarda só os totais por mês, e abre um relatório editável para imprimir/salvar em PDF. */
(function(){
window.__V=window.__V||{};window.__V.relfund=window.APP_VERSION;
const KEY='controle_refugos_2026_relfund_v1',NOMES=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const OR='#ff6a1f',BL='#2b6cb0',GR='#6b7280';
const norm=t=>String(t==null?'':t).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fm=(v,d=2)=>v==null||!isFinite(v)?'—':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const rs=v=>'R$ '+fm(v,2);
/* matéria-prima: nome no relatório, colunas do boletim (normalizadas), preço padrão (R$/kg do relatório do laboratório de out/2026) */
const ITENS=[
 ['Gusa',['gusa'],3.10],['Retorno de ferro',['retornoferro'],1.90],['Sucata de aço',['sucatadeaco'],1.95],['Sucata de ferro (Lingoteira)',['sucatadeferro'],1.85],['Gotas',['gotas'],1.90],['Retorno de aço',['retornoaco'],null],
 ['Carbeto de silício',['carbetodesiliciosic'],14.74],['Flux VG-53',['fluxvg53'],6.80],['Grafite (inclui C)',['grafite','carburante','ckg'],9.45],['Silício 75%',['ferrosilicio75','sikg'],15.00],
 ['Manganês',['mnkg','ferromanganesac','ferromanganesmc','ferromanganesbc'],12.00],['Cobre',['cukg'],85.50],['Ferro-cromo',['ferrocromoac','ferrocromobc','crkg'],null],['Ferro-molibdênio',['ferromolibidenio','mokg'],null],['Níquel',['niquel','nikg'],null],['Nióbio',['niobio','nbkg'],null],['Cavaco',['cavaco'],null],
 ['Inoculante',['inoculantekg'],33.48],['Nodulizante',['nodularizantekg'],12.60]];
const tipo=m=>{m=String(m||'').toUpperCase().trim();return m.startsWith('GGG')?'N':m.startsWith('GG')?'C':'O'};
function ler(){try{const o=JSON.parse(localStorage.getItem(KEY)||'null');return o&&o.meses?o:{meses:{},ed:{},em:0}}catch(e){return{meses:{},ed:{},em:0}}}
function gravar(o,sync){o.em=Date.now();try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){alert('Sem espaço para guardar o relatório neste aparelho.')}if(sync!==false)agendar()}
/* ---------- sincronização (um documento próprio; vale o mais recente de cada mês) ---------- */
let busy=false,tmr=null;
function agendar(){clearTimeout(tmr);tmr=setTimeout(sync,1800)}
function mescla(L,R){let ch=false;['meses','ed'].forEach(s=>{Object.keys(R[s]||{}).forEach(k=>{const a=(L[s]||(L[s]={}))[k],b=R[s][k];if(!a||(+b.em||0)>(+a.em||0)){L[s][k]=b;ch=true}})});return ch}
async function sync(){
  if(busy||typeof firebaseDbOnline==='undefined'||!firebaseDbOnline||!firebaseOnlineConnected||typeof blobLerNome!=='function')return;busy=true;
  try{const L=ler(),R=await blobLerNome('relfund');let ch=false;if(R&&R.meses)ch=mescla(L,R);if(ch){localStorage.setItem(KEY,JSON.stringify(L));if(document.getElementById('rfOv'))render()}
    const tem=Object.keys(L.meses).length||Object.keys(L.ed).length;const difere=!R||JSON.stringify(Object.keys(L.meses).map(k=>L.meses[k].em))!==JSON.stringify(Object.keys((R&&R.meses)||{}).map(k=>R.meses[k].em))||JSON.stringify(Object.keys(L.ed).map(k=>L.ed[k].em))!==JSON.stringify(Object.keys((R&&R.ed)||{}).map(k=>R.ed[k].em));
    if(tem&&difere)await blobEnviar('relfund',L,true)}catch(e){console.warn('Relatório de fundição (nuvem):',e)}finally{busy=false}}
setInterval(()=>{try{if(!document.hidden)sync()}catch(e){}},300000);setTimeout(()=>{try{sync()}catch(e){}},15000);
/* ---------- leitura das planilhas ---------- */
const iso=v=>{if(typeof v==='number'&&v>20000&&v<80000)return new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5).toISOString().slice(0,10);const m=String(v||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):/^\d{4}-\d{2}-\d{2}/.test(String(v))?String(v).slice(0,10):null};
function cols(r0){const h={};Object.entries(r0).forEach(([k,v])=>{const t=norm(v);if(t&&!(t in h))h[t]=k});return h}
function colDe(h,a){if(a==='carbetodesiliciosic'){const k=Object.keys(h).find(t=>t.startsWith('carbetodesil'));return k?h[k]:null}if(a==='fluxvg53'){const k=Object.keys(h).find(t=>t.startsWith('fluxvg'));return k?h[k]:null}return h[a]||null}
const anoOk=(c,d)=>{const m=String(c||'').match(/\/\s*(\d{2})\s*$/);return !m||String(2000+Number(m[1]))===d.slice(0,4)};
const num=x=>typeof x==='number'&&isFinite(x)?x:null;
const add=(o,k,v)=>{if(v==null)return;const a=o[k]||(o[k]=[0,0]);a[0]+=v;a[1]++};
function aggCarreg(rows,out){
  const h=cols(rows[0]),cd=h.data,cc=h.corrida,cm=h.material,cg=h.carga;if(!cd||!cc||!cm)throw new Error('a aba “BOLETIM - Carregamento” não tem CORRIDA, DATA e MATERIAL');
  const seen=new Set(),meses={};
  rows.slice(1).forEach(r=>{const d=iso(r[cd]),c=String(r[cc]||'').trim(),m=String(r[cm]||'').trim().toUpperCase();if(!d||!c||!m||!anoOk(c,d))return;const k=d.slice(0,4)+'-'+c;if(seen.has(k))return;seen.add(k);
    const mes=d.slice(0,7),M=meses[mes]||(meses[mes]={}),C=M[m]||(M[m]={n:0,carga:0,q:{}});C.n++;C.carga+=num(r[h.carga])||0;
    ITENS.forEach(([nome,al])=>{let s=0;al.forEach(a=>{const col=colDe(h,a);if(col)s+=num(r[col])||0});if(s)C.q[nome]=(C.q[nome]||0)+s})});
  Object.keys(meses).forEach(mes=>{Object.values(meses[mes]).forEach(C=>{C.carga=Math.round(C.carga*100)/100;Object.keys(C.q).forEach(k=>C.q[k]=Math.round(C.q[k]*1000)/1000)});(out[mes]=out[mes]||{}).car=meses[mes];out[mes].carEm=Date.now()});
  return Object.keys(meses).length}
function aggResult(rows,out){
  const h=cols(rows[0]),cd=h.data,cm=h.material;if(!cd||!cm)throw new Error('a aba “BOLETIM - Comp. e Result.” não tem DATA e MATERIAL');
  const meses={};
  rows.slice(1).forEach(r=>{const d=iso(r[cd]),m=String(r[cm]||'').trim().toUpperCase();if(!d||!m||!anoOk(h.corrida&&r[h.corrida],d))return;const mes=d.slice(0,7),M=meses[mes]||(meses[mes]={}),C=M[m]||(M[m]={n:0,ce:[0,0],dur:[0,0],nod:[0,0],per:[0,0],fer:[0,0],g:{},t:{}});C.n++;
    [['ce',h.ce],['dur',h.durezahb],['nod',h.nodularizacao],['per',h.perlita],['fer',h.ferrita]].forEach(([k,col])=>{const v=col?num(r[col]):null;if(v!=null){C[k][0]+=v;C[k][1]++}});
    const g=h.tipodegrafita&&String(r[h.tipodegrafita]||'').trim(),t=h.tamanhodagrafita&&String(r[h.tamanhodagrafita]||'').trim();if(g)C.g[g]=(C.g[g]||0)+1;if(t)C.t[t]=(C.t[t]||0)+1});
  Object.keys(meses).forEach(mes=>{(out[mes]=out[mes]||{}).met=meses[mes];out[mes].metEm=Date.now()});return Object.keys(meses).length}
function aggTermica(rows,out){
  const h=cols(rows[0]),need=['data','corrida','material','etapaprocesso'];if(need.some(k=>!h[k]))throw new Error('a aba “Lançamentos” não tem Data, Corrida, Material e Etapa Processo');
  const meses={};
  rows.slice(1).forEach(r=>{const d=iso(r[h.data]),m=String(r[h.material]||'').trim().toUpperCase(),e=String(r[h.etapaprocesso]||'').trim(),co=String(r[h.corrida]||'').trim();if(!d||!m||!e||!anoOk(co,d))return;const t=tipo(m);if(t==='O')return;
    const mes=d.slice(0,7),M=meses[mes]||(meses[mes]={N:{cor:{},e:{}},C:{cor:{},e:{}},cef:{}}),T=M[t];T.cor[co]=1;const E=T.e[e]||(T.e[e]={});
    const g=k=>h[k]?num(r[h[k]]):null;add(E,'tse',g('tsec'));add(E,'tre',g('trec'));add(E,'tem',g('tem'));
    if(t==='N'){add(E,'a1',g('expgrafnda1'));add(E,'a3',g('expgrafnda3'))}else{add(E,'a1',g('expgrafcza1'));add(E,'a23',g('expgrafcza2a3'))}
    if(/^INP[123]I$/.test(e)){const ce=g('cemicro');if(ce!=null)add(M.cef,m,ce)}});
  Object.keys(meses).forEach(mes=>{const M=meses[mes];['N','C'].forEach(t=>{M[t].n=Object.keys(M[t].cor).length;delete M[t].cor});(out[mes]=out[mes]||{}).ter=M;out[mes].terEm=Date.now()});return Object.keys(meses).length}
async function importar(file,tipoArq){
  const R=ler();let msg='';
  try{
    if(tipoArq==='bol'){
      const a=await xlsxLerFolha(file,'BOLETIM - Carregamento');const nA=aggCarreg(a,R.meses);let nB=0;
      try{const b=await xlsxLerFolha(file,'BOLETIM - Comp. e Result.');nB=aggResult(b,R.meses)}catch(e){msg+='\nAviso: '+(e.message||e)}
      msg='Boletim lido: consumo de '+nA+' mês(es), resultados de '+nB+' mês(es).'+msg}
    else{const a=await xlsxLerFolha(file,'Lançamentos');const n=aggTermica(a,R.meses);msg='Análise térmica lida: '+n+' mês(es).'}
    Object.keys(R.meses).forEach(k=>R.meses[k].em=Date.now());gravar(R);
    const ks=Object.keys(R.meses).sort();if(ks.length&&!ST.mes)ST.mes=ks[ks.length-1];alert(msg);render();
  }catch(e){console.error(e);alert('Não consegui ler o arquivo: '+(e&&e.message||e))}
}
/* ---------- cálculo ---------- */
const ST={mes:null};
function precoApp(nome,mes){try{const al=ITENS.find(x=>x[0]===nome)[1],P=insLer().preco.v||{};for(const a of al){for(const k of Object.keys(P)){if(norm(k)===a||(a==='carbetodesiliciosic'&&norm(k).startsWith('carbetodesil'))||(a==='fluxvg53'&&norm(k).startsWith('fluxvg'))){const v=P[k][mes];if(v!=null&&isFinite(v)&&v>0)return+v}}}}catch(e){}return null}
function calc(mes){
  const R=ler(),M=R.meses[mes]||{},E=(R.ed[mes]||{}),car=M.car||{},cls=Object.keys(car).filter(c=>tipo(c)!=='O').sort((a,b)=>(tipo(a)!=='N')-(tipo(b)!=='N')||a.localeCompare(b));
  const P={},fonte={};ITENS.forEach(([nome,,def])=>{const o=E.p&&E.p[nome];if(o!=null&&isFinite(o)){P[nome]=+o;fonte[nome]='editado'}else{const a=precoApp(nome,mes);if(a!=null){P[nome]=a;fonte[nome]='insumos'}else if(def!=null){P[nome]=def;fonte[nome]='padrão'}else{P[nome]=0;fonte[nome]='sem preço'}}});
  const Q={N:{},C:{}},nc={N:0,C:0},carga={N:0,C:0};
  cls.forEach(c=>{const t=tipo(c);nc[t]+=car[c].n;carga[t]+=car[c].carga;Object.entries(car[c].q).forEach(([k,v])=>Q[t][k]=(Q[t][k]||0)+v)});
  const imp={N:Object.assign({},Q.N),C:Object.assign({},Q.C)};
  ['N','C'].forEach(t=>{Object.keys(E.q||{}).forEach(k=>{if(k[0]===t&&k[1]==='|'&&isFinite(E.q[k]))Q[t][k.slice(2)]=+E.q[k]})});
  const nomes=ITENS.map(x=>x[0]).filter(n=>(Q.N[n]||0)+(Q.C[n]||0)>0||(E.q&&(('N|'+n) in E.q||('C|'+n) in E.q)));
  const cN={},cC={};let TN=0,TC=0;nomes.forEach(n=>{cN[n]=(Q.N[n]||0)*P[n];cC[n]=(Q.C[n]||0)*P[n];TN+=cN[n];TC+=cC[n]});
  const rowsCls=cls.map(c=>{let cu=0;Object.entries(car[c].q).forEach(([k,v])=>cu+=v*(P[k]||0));return{c,n:car[c].n,carga:car[c].carga,cu}});
  return{R,M,E,car,cls,P,fonte,Q,imp,nc,carga,nomes,cN,cC,TN,TC,TT:TN+TC,rowsCls};
}
/* ---------- gráficos SVG ---------- */
function hstack(it,W){const rh=22,pl=170,h=it.length*rh+26,mx=Math.max(1,...it.map(x=>x.n+x.c));let s='<svg viewBox="0 0 '+W+' '+h+'" style="width:100%;max-width:'+W+'px">';
  it.forEach((x,i)=>{const y=i*rh+4,wn=(W-pl-70)*x.n/mx,wc=(W-pl-70)*x.c/mx;s+='<text x="'+(pl-6)+'" y="'+(y+13)+'" text-anchor="end" font-size="11" fill="#111">'+esc(x.nome)+'</text><rect x="'+pl+'" y="'+y+'" width="'+wn+'" height="16" fill="'+OR+'"/><rect x="'+(pl+wn)+'" y="'+y+'" width="'+wc+'" height="16" fill="'+BL+'"/><text x="'+(pl+wn+wc+4)+'" y="'+(y+13)+'" font-size="10.5" font-weight="700" fill="#111">'+fm(x.n+x.c,0)+'</text>'});
  s+='<rect x="'+pl+'" y="'+(h-16)+'" width="10" height="10" fill="'+OR+'"/><text x="'+(pl+14)+'" y="'+(h-7)+'" font-size="10" fill="#111">Nodular</text><rect x="'+(pl+80)+'" y="'+(h-16)+'" width="10" height="10" fill="'+BL+'"/><text x="'+(pl+94)+'" y="'+(h-7)+'" font-size="10" fill="#111">Cinzento</text>';return s+'</svg>'}
function donut(a,b){const t=a+b||1,r=52,c=2*Math.PI*r,da=c*a/t;return '<svg viewBox="0 0 150 150" style="width:100%;max-width:170px"><circle cx="75" cy="75" r="'+r+'" fill="none" stroke="'+BL+'" stroke-width="26"/><circle cx="75" cy="75" r="'+r+'" fill="none" stroke="'+OR+'" stroke-width="26" stroke-dasharray="'+da+' '+(c-da)+'" transform="rotate(-90 75 75)"/><text x="75" y="72" text-anchor="middle" font-size="11" fill="#111" font-weight="700">'+fm(a/t*100,0)+'% nodular</text><text x="75" y="86" text-anchor="middle" font-size="10" fill="#555">'+fm(b/t*100,0)+'% cinzento</text></svg>'}
function bars(titulo,lab,val,fmt,cor){const W=240,H=150,pb=22,pt=18,n=lab.length;if(!n)return'';const mx=Math.max(...val.map(v=>v||0),1e-9),bw=(W-10)/n;let s='<div class="rfbc"><div class="rfbt">'+esc(titulo)+'</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%">';
  val.forEach((v,i)=>{if(v==null)return;const h=(H-pb-pt)*v/mx,x=5+i*bw+bw*.15,y=H-pb-h;s+='<rect x="'+x+'" y="'+y+'" width="'+bw*.7+'" height="'+h+'" fill="'+cor+'" rx="2"/><text x="'+(x+bw*.35)+'" y="'+(y-3)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#111">'+fmt(v)+'</text>'});
  lab.forEach((l,i)=>s+='<text x="'+(5+i*bw+bw/2)+'" y="'+(H-7)+'" text-anchor="middle" font-size="10" fill="#111">'+esc(l)+'</text>');return s+'</svg></div>'}
function linhas(T,band,tit){const E=['MBC1','INP1I','INP2I','INP3I'],W=720,H=230,pl=40,pr=20,pt=34,pb=26,S=[['tse','TSE (°C)',BL],['tre','TRE (°C)',OR],['tem','TEM (°C)','#dc2626']];
  const ml=k=>E.map(e=>{const a=T.e[e]&&T.e[e][k];return a&&a[1]?a[0]/a[1]:null});const all=[];S.forEach(([k])=>ml(k).forEach(v=>v!=null&&all.push(v)));if(!all.length)return'<div class="rfmu">Sem dados de análise térmica neste mês.</div>';
  let lo=Math.min(...all,band?1140:1e9),hi=Math.max(...all,band?1150:-1e9);const pad=(hi-lo)*.12+2;lo-=pad;hi+=pad;const X=i=>pl+(W-pl-pr)*(i+.5)/4,Y=v=>pt+(H-pt-pb)*(1-(v-lo)/(hi-lo));
  let s='<div class="rfbt">'+esc(tit)+'</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%">';if(band)s+='<rect x="'+pl+'" y="'+Y(1150)+'" width="'+(W-pl-pr)+'" height="'+(Y(1140)-Y(1150))+'" fill="#16a34a" opacity=".1"/><text x="'+(pl+4)+'" y="'+(Y(1150)-3)+'" text-anchor="start" font-size="10" fill="#15803d">TSE ideal 1140–1150 °C</text>';
  for(let g=0;g<=4;g++){const v=lo+(hi-lo)*g/4,y=Y(v);s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="#e5e7eb"/><text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#555">'+fm(v,0)+'</text>'}
  S.forEach(([k,l,c],si)=>{const v=ml(k);let d='';v.forEach((q,i)=>{if(q!=null)d+=(d?'L':'M')+X(i)+' '+Y(q)});s+='<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2" '+(k==='tem'?'stroke-dasharray="6 4"':'')+'/>';v.forEach((q,i)=>{if(q!=null)s+='<circle cx="'+X(i)+'" cy="'+Y(q)+'" r="3.5" fill="'+c+'"/><text x="'+X(i)+'" y="'+(Y(q)+(k==='tse'?15:-8))+'" text-anchor="middle" font-size="10.5" font-weight="700" fill="'+c+'">'+fm(q,0)+'</text>'});s+='<rect x="'+(pl+si*100)+'" y="6" width="10" height="10" fill="'+c+'"/><text x="'+(pl+si*100+14)+'" y="15" font-size="10.5" fill="#111">'+l+'</text>'});
  E.forEach((e,i)=>s+='<text x="'+X(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="#111">'+e+'</text>');return s+'</svg>'}
function expo(T,k1,k2,l1,l2,tit){const E=['INP1I','INP2I','INP3I'],W=240,H=160,pb=24,pt=18,bw=(W-10)/3;const g=(e,k)=>{const a=T.e[e]&&T.e[e][k];return a&&a[1]?a[0]/a[1]*100:null};let s='<div class="rfbc"><div class="rfbt">'+esc(tit)+'</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%">',tem=false;
  E.forEach((e,i)=>[[k1,BL,0],[k2,OR,1]].forEach(([k,c,j])=>{const v=g(e,k);if(v==null)return;tem=true;const h=(H-pb-pt)*Math.min(v,100)/100,x=5+i*bw+bw*.1+j*bw*.38,y=H-pb-h;s+='<rect x="'+x+'" y="'+y+'" width="'+bw*.36+'" height="'+h+'" fill="'+c+'"/><text x="'+(x+bw*.18)+'" y="'+(y-3)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#111">'+fm(v,0)+'%</text>'}));
  E.forEach((e,i)=>s+='<text x="'+(5+i*bw+bw/2)+'" y="'+(H-9)+'" text-anchor="middle" font-size="10" fill="#111">'+e+'</text>');s+='<rect x="8" y="2" width="8" height="8" fill="'+BL+'"/><text x="19" y="10" font-size="9" fill="#111">'+l1+'</text><rect x="110" y="2" width="8" height="8" fill="'+OR+'"/><text x="121" y="10" font-size="9" fill="#111">'+l2+'</text></svg></div>';return tem?s:'<div class="rfbc"><div class="rfbt">'+esc(tit)+'</div><div class="rfmu">Sem expansão grafítica registrada.</div></div>'}
/* ---------- relatório ---------- */
const mean=a=>a&&a[1]?a[0]/a[1]:null;
function mesesDisp(){return Object.keys(ler().meses).filter(k=>ler().meses[k].car||ler().meses[k].met||ler().meses[k].ter).sort()}
function lblMes(k){const p=k.split('-');return NOMES[+p[1]]+' de '+p[0]}
function textoAuto(c,mes){
  const t=c.TT;if(!t)return'';const maior=c.nomes.map(n=>({n,v:c.cN[n]+c.cC[n]})).sort((a,b)=>b.v-a.v)[0];
  let s='Em '+lblMes(mes)+' foram vazadas '+c.nc.N+' corrida(s) de ferro nodular e '+c.nc.C+' de ferro cinzento. O custo de matéria-prima foi de '+rs(t)+': '+rs(c.TN)+' no nodular ('+fm(c.TN/t*100,0)+'%) e '+rs(c.TC)+' no cinzento ('+fm(c.TC/t*100,0)+'%).';
  if(c.nc.N&&c.nc.C)s+=' A média por corrida foi de '+rs(c.TN/c.nc.N)+' no nodular e '+rs(c.TC/c.nc.C)+' no cinzento.';
  if(maior)s+=' O maior item de custo foi '+maior.n.toLowerCase()+' ('+rs(maior.v)+', '+fm(maior.v/t*100,0)+'%).';return s}
function leituraTer(M){const T=M.ter;if(!T)return'';const o=[];['N','C'].forEach(t=>{const T2=T[t];if(!T2||!T2.n)return;const e=['INP1I','INP2I','INP3I'].map(x=>T2.e[x]&&mean(T2.e[x].tse)).filter(v=>v!=null);if(t==='N'&&e.length){const m=e.reduce((a,b)=>a+b,0)/e.length;o.push('Nodular: TSE médio após a inoculação de '+fm(m,0)+' °C ('+(m>=1140&&m<=1150?'dentro':'fora')+' da faixa ideal de 1140–1150 °C).')}});
  const N=T.N&&T.N.e;if(N){const a3=['INP1I','INP2I','INP3I'].map(x=>N[x]&&mean(N[x].a3)).filter(v=>v!=null);if(a3.length){const m=a3.reduce((a,b)=>a+b,0)/a3.length*100;o.push('Expansão grafítica A3 média de '+fm(m,0)+'% ('+(m>70?'acima':'abaixo')+' da meta de 70%).')}}return o.join(' ')}
function render(){
  let ov=document.getElementById('rfOv');const ms=mesesDisp();if(!ST.mes||(!ms.includes(ST.mes)&&ms.length))ST.mes=ms[ms.length-1]||ST.mes||null;
  const mes=ST.mes,c=mes?calc(mes):null,E=c?c.E:{};
  const ed=(k,def,ph)=>'<div class="rfed" contenteditable="true" data-t="'+k+'" data-ph="'+esc(ph||'Clique para escrever…')+'">'+esc((E.txt&&E.txt[k]!=null)?E.txt[k]:def)+'</div>';
  let h='<div class="rfbar"><button type="button" class="rfb1" id="rfPrint">🖨 Imprimir / salvar em PDF</button><select id="rfMes">'+ms.map(k=>'<option value="'+k+'"'+(k===mes?' selected':'')+'>'+lblMes(k)+'</option>').join('')+(ms.length?'':'<option>—</option>')+'</select><button type="button" id="rfImpB">📥 Boletim de Fusão (.xlsx)</button><button type="button" id="rfImpT">📥 Análise térmica (.xlsx)</button><button type="button" id="rfReset">↺ Restaurar valores do arquivo</button><button type="button" id="rfClose">✕ Fechar</button><input type="file" id="rfFB" accept=".xlsx" hidden><input type="file" id="rfFT" accept=".xlsx" hidden></div><div class="rfbody">';
  if(!mes||!c||(!Object.keys(c.car).length&&!(c.M.met)&&!(c.M.ter))){h+='<div class="rfpg"><h2>Relatório mensal de fundição</h2><p>Ainda não há dados. Use os botões acima: <b>Boletim de Fusão</b> (traz o consumo de matéria-prima e os resultados metalúrgicos) e <b>Análise térmica</b>. Cada mês lido fica guardado e sincroniza com os outros aparelhos.</p></div></div>'}
  else{
    const T=c.TT;
    h+='<div class="rfpg"><div class="rfhd"><img src="logo.png" alt="" onerror="this.style.display=\'none\'"><div><h2 contenteditable="true" data-t="titulo">'+esc((E.txt&&E.txt.titulo)||('Relatório mensal de fundição – '+lblMes(mes)))+'</h2><div class="rfmu">Consumo e custo de matéria-prima por tipo de material, resultados metalúrgicos e análise térmica</div></div></div>';
    h+='<div class="rfk"><div><span>Custo total de matéria-prima</span><b>'+rs(T)+'</b><small>'+(c.nc.N+c.nc.C)+' corridas · '+fm(c.carga.N+c.carga.C,0)+' kg de carga</small></div><div><span>Ferro nodular</span><b>'+rs(c.TN)+'</b><small>'+c.nc.N+' corridas · '+fm(T?c.TN/T*100:0,0)+'% do custo</small></div><div><span>Ferro cinzento</span><b>'+rs(c.TC)+'</b><small>'+c.nc.C+' corridas · '+fm(T?c.TC/T*100:0,0)+'% do custo</small></div><div><span>Custo por corrida</span><b>N: '+(c.nc.N?rs(c.TN/c.nc.N):'—')+'</b><small>C: '+(c.nc.C?rs(c.TC/c.nc.C):'—')+'</small></div></div>';
    h+='<h3>Resumo</h3>'+ed('intro',textoAuto(c,mes),'Escreva o resumo do mês…');
    h+='<h3>1. Custo por tipo de material</h3><table class="rft"><thead><tr><th>Tipo</th><th>Corridas</th><th>Carga (kg)</th><th>Custo (R$)</th><th>% do custo</th><th>R$ / corrida</th><th>R$ / kg carga</th></tr></thead><tbody>'+
      [['Ferro nodular (GGG)','N',c.TN],['Ferro cinzento (GG)','C',c.TC]].map(([l,t,v])=>'<tr><td>'+l+'</td><td>'+c.nc[t]+'</td><td>'+fm(c.carga[t],0)+'</td><td>'+fm(v)+'</td><td>'+fm(T?v/T*100:0,1)+'%</td><td>'+(c.nc[t]?fm(v/c.nc[t]):'—')+'</td><td>'+(c.carga[t]?fm(v/c.carga[t],3):'—')+'</td></tr>').join('')+
      '<tr class="rftt"><td>TOTAL</td><td>'+(c.nc.N+c.nc.C)+'</td><td>'+fm(c.carga.N+c.carga.C,0)+'</td><td>'+fm(T)+'</td><td>100,0%</td><td>'+(c.nc.N+c.nc.C?fm(T/(c.nc.N+c.nc.C)):'—')+'</td><td>'+(c.carga.N+c.carga.C?fm(T/(c.carga.N+c.carga.C),3):'—')+'</td></tr></tbody></table>';
    h+='<table class="rft" style="margin-top:8px"><thead><tr><th>Classe</th><th>Corridas</th><th>Carga (kg)</th><th>Custo (R$)</th><th>R$ / corrida</th><th>R$ / kg carga</th></tr></thead><tbody>'+c.rowsCls.map(x=>'<tr><td>'+esc(x.c)+'</td><td>'+x.n+'</td><td>'+fm(x.carga,0)+'</td><td>'+fm(x.cu)+'</td><td>'+fm(x.cu/x.n)+'</td><td>'+(x.carga?fm(x.cu/x.carga,3):'—')+'</td></tr>').join('')+'</tbody></table>';
    h+='<h3>2. Matéria-prima: consumo e custo, nodular × cinzento</h3><div class="rfmu rfno">Os campos em destaque são editáveis: preço (R$/kg) e quantidades (kg). O custo é recalculado ao sair do campo.</div><div class="rfw"><table class="rft"><thead><tr><th>Matéria-prima</th><th>R$/kg</th><th>Nodular kg</th><th>Nodular R$</th><th>Cinzento kg</th><th>Cinzento R$</th><th>Total R$</th><th>% custo</th></tr></thead><tbody>'+
      c.nomes.map(n=>'<tr><td>'+esc(n)+(c.fonte[n]==='sem preço'?' <span class="rfwarn">sem preço</span>':'')+'</td><td><input class="rfin" data-p="'+esc(n)+'" value="'+fm(c.P[n])+'" title="Origem do preço: '+c.fonte[n]+'"></td><td><input class="rfin" data-q="N|'+esc(n)+'" value="'+fm(c.Q.N[n]||0)+'"></td><td>'+fm(c.cN[n])+'</td><td><input class="rfin" data-q="C|'+esc(n)+'" value="'+fm(c.Q.C[n]||0)+'"></td><td>'+fm(c.cC[n])+'</td><td>'+fm(c.cN[n]+c.cC[n])+'</td><td>'+fm(T?(c.cN[n]+c.cC[n])/T*100:0,1)+'%</td></tr>').join('')+
      '<tr class="rftt"><td>TOTAL</td><td></td><td>'+fm(c.nomes.reduce((a,n)=>a+(c.Q.N[n]||0),0))+'</td><td>'+fm(c.TN)+'</td><td>'+fm(c.nomes.reduce((a,n)=>a+(c.Q.C[n]||0),0))+'</td><td>'+fm(c.TC)+'</td><td>'+fm(T)+'</td><td>100,0%</td></tr></tbody></table></div>';
    h+='<div class="rfmu">Consumo: aba “BOLETIM – Carregamento” (soma das cargas das corridas do mês; GGG = nodular, GG = cinzento). Grafite inclui carburante e o C em kg; silício 75% inclui o Si em kg; manganês soma as ligas de Mn. Preço: o editado aqui, senão o do cadastro de insumos do mês, senão o padrão do relatório do laboratório (out/2026).</div></div>';
    h+='<div class="rfpg"><h3>3. Distribuição do custo</h3><div class="rfg2"><div>'+hstack(c.nomes.map(n=>({nome:n,n:c.cN[n],c:c.cC[n]})).sort((a,b)=>(a.n+a.c)-(b.n+b.c)).reverse(),620)+'</div><div style="text-align:center">'+donut(c.TN,c.TC)+'<div class="rfmu">Nodular '+rs(c.TN)+'<br>Cinzento '+rs(c.TC)+'</div></div></div>';
    const met=(c.M.met||{}),mc=Object.keys(met).filter(x=>tipo(x)!=='O').sort((a,b)=>(tipo(a)!=='N')-(tipo(b)!=='N')||a.localeCompare(b)),cef=(c.M.ter&&c.M.ter.cef)||{};
    if(mc.length||Object.keys(cef).length){const lab=mc.length?mc:Object.keys(cef);
      h+='<h3>4. Resultados metalúrgicos</h3><div class="rfg3">'+bars('CE químico (boletim)',lab,lab.map(m=>met[m]?mean(met[m].ce):null),v=>fm(v,2),BL)+bars('CE físico (análise térmica)',lab,lab.map(m=>cef[m]?mean(cef[m]):null),v=>fm(v,2),OR)+bars('Dureza HB (média)',lab,lab.map(m=>met[m]?mean(met[m].dur):null),v=>fm(v,1),GR)+'</div>';
      const top=o=>{const e=Object.entries(o||{}).sort((a,b)=>b[1]-a[1]);return e.length?e[0][0]:'—'};
      h+='<table class="rft"><thead><tr><th>Classe</th><th>Corridas</th><th>Grafita</th><th>Tamanho</th><th>Nodul. %</th><th>Perlita %</th><th>Ferrita %</th><th>CE quím.</th><th>CE fís.</th><th>HB</th></tr></thead><tbody>'+lab.map(m=>{const x=met[m]||{},n=tipo(m)==='N';return '<tr><td>'+esc(m)+'</td><td>'+(x.n||'—')+'</td><td>'+top(x.g)+'</td><td>'+top(x.t)+'</td><td>'+(n&&x.nod?fm(mean(x.nod),0):'—')+'</td><td>'+(n&&x.per?fm(mean(x.per),0):'—')+'</td><td>'+(n&&x.fer?fm(mean(x.fer),0):'—')+'</td><td>'+(x.ce?fm(mean(x.ce),2):'—')+'</td><td>'+(cef[m]?fm(mean(cef[m]),2):'—')+'</td><td>'+(x.dur?fm(mean(x.dur),1):'—')+'</td></tr>'}).join('')+'</tbody></table><div class="rfmu">Médias do mês: aba “BOLETIM – Comp. e Result.”; CE físico = média do CE (%) das etapas INP1I–INP3I da análise térmica. Perlita/ferrita só para o nodular.</div>'}
    if(c.M.ter){const Tn=c.M.ter.N,Tc=c.M.ter.C;
      h+='</div><div class="rfpg"><h3>5. Análise térmica – ferro nodular ('+(Tn.n||0)+' corridas)</h3>'+linhas(Tn,true,'Nucleação e crescimento (média por etapa)')+'<h3>6. Análise térmica – ferro cinzento ('+(Tc.n||0)+' corridas)</h3>'+linhas(Tc,false,'Média por etapa')+'<h3>7. Expansão grafítica</h3><div class="rfg2b">'+expo(Tn,'a1','a3','A1 (meta <1%)','A3 (meta >70%)','Nodular')+expo(Tc,'a1','a23','A1','A2+A3','Cinzento')+'</div>'+ed('lter',leituraTer(c.M),'Leitura da análise térmica…')}
    h+='<h3>Observações e ações</h3>'+ed('obs','','Clique para escrever observações, problemas do mês e ações combinadas…')+'</div>';
    h+='</div>';
  }
  if(!ov){ov=document.createElement('div');ov.id='rfOv';document.body.appendChild(ov);css();document.body.style.overflow='hidden'}
  ov.innerHTML=h;ligar(ov);
}
function css(){if(document.getElementById('rfCss'))return;const s=document.createElement('style');s.id='rfCss';s.textContent=
'#rfOv{position:fixed;inset:0;z-index:100000;overflow:auto;background:#eef1f5;color:#111;font:14px/1.45 system-ui,Arial,sans-serif}#rfOv *{box-sizing:border-box}'+
'.rfbar{position:sticky;top:0;z-index:3;display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:#fff;border-bottom:1px solid #d0d5dd}.rfbar button,.rfbar select{border:1px solid #c7ccd4;background:#f4f5f7;color:#111;border-radius:8px;padding:8px 12px;font:inherit;font-weight:600;cursor:pointer}.rfbar .rfb1{background:#ff6a1f;border-color:#ff6a1f;color:#fff}'+
'.rfbody{max-width:980px;margin:14px auto;padding:0 10px}.rfpg{background:#fff;border:1px solid #d9dde3;border-radius:10px;padding:22px 26px;margin-bottom:14px}.rfpg h2{margin:0;font-size:21px;outline:none}.rfpg h3{margin:18px 0 6px;font-size:15px;color:#ff6a1f}'+
'.rfhd{display:flex;gap:12px;align-items:center;border-bottom:3px solid #ff6a1f;padding-bottom:10px;margin-bottom:12px}.rfhd img{width:52px;height:52px;object-fit:contain}.rfmu{color:#6b7280;font-size:12px}.rfwarn{color:#b91c1c;font-size:11px;font-weight:700}'+
'.rfk{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0}.rfk div{border:1px solid #d0d7e2;border-radius:8px;padding:8px 10px;background:#f8fafc}.rfk span{display:block;font-size:10px;text-transform:uppercase;color:#6b7280}.rfk b{display:block;font-size:18px}.rfk div:first-child b{color:#ff6a1f}.rfk small{color:#6b7280;font-size:11px}'+
'.rft{width:100%;border-collapse:collapse;font-size:12.5px}.rft th{background:#1e3a5f!important;color:#fff!important;text-align:right;padding:5px 7px;border:0!important;text-shadow:none!important}#rfOv .rft td,#rfOv .rfk b,#rfOv .rfk small,#rfOv h2,#rfOv p,#rfOv .rfed,#rfOv .rfbt{color:#111!important}#rfOv .rfk div:first-child b{color:#ff6a1f!important}#rfOv .rfmu,#rfOv .rfk span,#rfOv .rfk small{color:#6b7280!important}#rfOv h3{color:#ff6a1f!important}#rfOv table{background:#fff!important;border-radius:0!important;box-shadow:none!important}#rfOv .rft tbody tr:nth-child(odd){background:#fff!important}#rfOv .rft tbody tr:nth-child(even){background:#f3f6fa!important}#rfOv .rft .rftt td{background:#dbe4f0!important}.rft th:first-child,.rft td:first-child{text-align:left}.rft td{text-align:right;padding:4px 7px;border-bottom:1px solid #d0d7e2}.rft tbody tr:nth-child(even){background:#f3f6fa}.rft .rftt td{background:#dbe4f0;font-weight:700}.rfw{overflow-x:auto}'+
'.rfin{width:96px;text-align:right;border:1px solid #ffd2b8;background:#fff6ef;border-radius:5px;padding:2px 5px;font:inherit;color:#111}.rfin:focus{outline:2px solid #ff6a1f}'+
'.rfed{min-height:40px;border:1px dashed #cbd2dc;border-radius:8px;padding:8px 10px;background:#fcfdff;white-space:pre-wrap;outline:none}.rfed:focus{border-color:#ff6a1f;background:#fff}.rfed:empty:before{content:attr(data-ph);color:#9aa3af}'+
'.rfg2{display:grid;grid-template-columns:1.9fr 1fr;gap:12px;align-items:center}.rfg2b{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rfg3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}.rfbt{font-weight:700;font-size:12.5px;margin:4px 0}'+
'@media(max-width:700px){.rfpg{padding:14px 12px}.rfk{grid-template-columns:1fr 1fr}.rfg2,.rfg2b,.rfg3{grid-template-columns:1fr}.rfin{width:76px}.rft{font-size:11.5px}}'+
'@media print{@page{size:A4;margin:10mm}body.rfmode>*:not(#rfOv){display:none!important}body.rfmode #rfOv{position:static!important;overflow:visible!important;background:#fff}#rfOv .rfbar,#rfOv .rfno{display:none!important}#rfOv .rfbody{max-width:none;margin:0;padding:0}#rfOv .rfpg{border:0;padding:0;margin:0;break-after:page}#rfOv .rfpg:last-child{break-after:auto}#rfOv .rfed,#rfOv .rfin{border:0!important;background:transparent!important;padding:0}#rfOv .rfin{width:auto;text-align:right}#rfOv .rfed:empty{display:none}#rfOv .rfpg h3{break-after:avoid}#rfOv table,#rfOv svg,#rfOv .rfk{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';document.head.appendChild(s)}
function salvaEd(mes,fn){const R=ler(),e=R.ed[mes]||(R.ed[mes]={});fn(e);e.em=Date.now();gravar(R)}
function ligar(ov){
  const $=id=>ov.querySelector('#'+id),mes=ST.mes;
  $('rfClose').onclick=()=>{ov.remove();document.body.classList.remove('rfmode');document.body.style.overflow=''};
  $('rfMes').onchange=e=>{ST.mes=e.target.value;render()};
  $('rfImpB').onclick=()=>$('rfFB').click();$('rfImpT').onclick=()=>$('rfFT').click();
  $('rfFB').onchange=e=>{const f=e.target.files[0];if(f)importar(f,'bol')};$('rfFT').onchange=e=>{const f=e.target.files[0];if(f)importar(f,'ter')};
  $('rfPrint').onclick=()=>{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();document.body.classList.add('rfmode');setTimeout(()=>{try{window.print()}catch(e){}setTimeout(()=>document.body.classList.remove('rfmode'),600)},150)};
  $('rfReset').onclick=()=>{if(!mes||!confirm('Descartar as edições de preços, quantidades e textos de '+lblMes(mes)+'?'))return;const R=ler();R.ed[mes]={em:Date.now()};gravar(R);render()};
  if(!mes)return;
  ov.querySelectorAll('.rfin').forEach(i=>i.addEventListener('change',()=>{const v=parseFloat(String(i.value).replace(/\./g,'').replace(',','.'));if(!isFinite(v)||v<0){render();return}
    salvaEd(mes,e=>{if(i.dataset.p){(e.p=e.p||{})[i.dataset.p]=v}else{(e.q=e.q||{})[i.dataset.q]=v}});render()}));
  ov.querySelectorAll('.rfed,[data-t="titulo"]').forEach(d=>d.addEventListener('blur',()=>{const t=d.dataset.t,v=d.innerText.replace(/\n+$/,'');salvaEd(mes,e=>{(e.txt=e.txt||{})[t]=v})}));
}
window.relFund={abrir(mes){if(mes&&/^\d{4}-\d{2}$/.test(mes)&&ler().meses[mes])ST.mes=mes;render()},sync,_calc:calc,_ler:ler,_importar:importar};
})();

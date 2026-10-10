/* ==================================================================
   APLICAÇÃO PRINCIPAL
   Lançamentos, histórico, dashboards, cadastros, Firebase e relatórios.
   ================================================================== */
const KEY='controle_refugos_2026_v2';
const OLD_KEY='controle_refugos_2026_v1';
const PROD_KEY='controle_refugos_2026_producao_fundicao_v1';

const FIREBASE_CONFIG_KEY='controle_refugos_2026_firebase_config_v2';
const FIREBASE_SYNC_KEY='controle_refugos_2026_firebase_sync_v1';
const FIREBASE_ROOT=['apps','controleRefugos2026'];
const FIREBASE_CHUNK_SIZE=100;
let firebaseAppOnline=null,firebaseAuthOnline=null,firebaseDbOnline=null,firebaseOnlineConnected=false,firebaseApplyingRemote=false,firebasePushTimer=null;
function getFirebaseConfig(){try{const raw=localStorage.getItem(FIREBASE_CONFIG_KEY);if(raw)return JSON.parse(raw);const e=window.EMBEDDED_FIREBASE_CONFIG;return(e&&e.apiKey&&e.projectId)?e:null}catch{return null}}
function firebaseCfgFields(){const g=id=>document.getElementById(id)?.value.trim()||'';return{apiKey:g('fbApiKey'),authDomain:g('fbAuthDomain'),projectId:g('fbProjectId'),storageBucket:g('fbStorageBucket'),messagingSenderId:g('fbMessagingSenderId'),appId:g('fbAppId')}}
function fillFirebaseFields(cfg){if(!cfg)return;['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'].forEach(k=>{const el=document.getElementById('fb'+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.value=cfg[k]||''})}
function setFirebaseStatus(text,cls=''){const ids=['firebaseStatus','onlineStatus','dataOnlineStatus'];const online=cls==='ok';for(const id of ids){const el=document.getElementById(id);if(!el)continue;if(id==='firebaseStatus'){el.textContent=text;el.className='firebase-status '+cls}else{el.textContent=online?'● Online':cls==='err'?'● Erro':'● Offline';el.className='online-status '+(online?'online':cls==='err'?'error':'offline')}}}
function parseFirebaseConfigText(text){let t=String(text||'').trim();if(!t)return null;t=t.replace(/^\s*(const|let|var)\s+firebaseConfig\s*=\s*/i,'').replace(/;\s*$/,'').trim();try{const j=JSON.parse(t);if(j&&j.projectId)return j}catch{}const keys=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];const out={};for(const k of keys){const re=new RegExp(k+'\\s*:\\s*[\\\"\\\']([^\\\"\\\']+)[\\\"\\\']');const m=t.match(re);if(m)out[k]=m[1]}return out.projectId?out:null}
function copyFirebaseRules(){const t=document.getElementById('firebaseRulesText')?.value||'';if(navigator.clipboard?.writeText){navigator.clipboard.writeText(t).then(()=>setFirebaseStatus('Regras copiadas para a área de transferência.','ok')).catch(()=>{setFirebaseStatus('Não foi possível copiar automaticamente. Selecione o texto manualmente.','err')})}else{setFirebaseStatus('Selecione manualmente as regras para copiar.','err')}}
function applyFirebasePaste(){try{const cfg=parseFirebaseConfigText(document.getElementById('firebaseConfigPaste').value);if(!cfg)throw new Error('Não encontrei um firebaseConfig válido.');fillFirebaseFields(cfg);setFirebaseStatus('Configuração preenchida. Clique em Salvar e conectar.','ok')}catch(e){setFirebaseStatus(e.message||String(e),'err')}}
function openFirebaseModal(){const ov=document.getElementById('firebaseOverlay');if(!ov)return;ov.classList.add('open');ov.setAttribute('aria-hidden','false');const cfg=getFirebaseConfig();if(cfg){fillFirebaseFields(cfg);const p=document.getElementById('firebaseConfigPaste');if(p)p.value='const firebaseConfig = '+JSON.stringify(cfg,null,2)+';';const auto=document.getElementById('firebaseAutoSync');if(auto)auto.checked=localStorage.getItem(FIREBASE_SYNC_KEY)!=='false';setFirebaseStatus(firebaseOnlineConnected?'Firebase conectado.':'Configuração carregada.',''+(firebaseOnlineConnected?'ok':''))}}
function closeFirebaseModal(){const ov=document.getElementById('firebaseOverlay');if(!ov)return;ov.classList.remove('open');ov.setAttribute('aria-hidden','true')}
window.openFirebaseModal=openFirebaseModal;window.closeFirebaseModal=closeFirebaseModal;
async function ensureFirebaseSDK(){if(window.firebase?.firestore&&window.firebase?.auth)return;throw new Error('Bibliotecas Firebase não carregadas. Verifique a internet e abra o sistema novamente.')}
async function connectFirebase(cfg,show=true){try{await ensureFirebaseSDK();if(!firebaseAppOnline){firebaseAppOnline=window.firebase.apps?.length?window.firebase.app():window.firebase.initializeApp(cfg)}firebaseAuthOnline=window.firebase.auth();firebaseDbOnline=window.firebase.firestore();if(!firebaseAuthOnline.currentUser)await firebaseAuthOnline.signInAnonymously();firebaseOnlineConnected=true;setFirebaseStatus('Firebase conectado.','ok');try{startFirebaseListener()}catch(e){console.error(e)}if(show)alert('Conectado ao Firebase com sucesso.\n\nUse “Enviar dados locais” para publicar esta base ou “Baixar do Firebase” para carregar a base online.')}catch(e){firebaseOnlineConnected=false;setFirebaseStatus('Não foi possível conectar: '+(e?.message||e),'err');if(show)alert('Não foi possível conectar ao Firebase.\n\n'+(e?.message||e)+'\n\nConfira Authentication > Anonymous e as regras do Firestore.')}}
async function saveAndConnectFirebase(){const cfg=firebaseCfgFields();if(!cfg.apiKey||!cfg.authDomain||!cfg.projectId||!cfg.appId){setFirebaseStatus('Preencha pelo menos API Key, Auth Domain, Project ID e App ID.','err');return}localStorage.setItem(FIREBASE_CONFIG_KEY,JSON.stringify(cfg));localStorage.setItem(FIREBASE_SYNC_KEY,String(document.getElementById('firebaseAutoSync')?.checked!==false));await connectFirebase(cfg,true)}
async function testFirebaseConnection(){const cfg=firebaseCfgFields();if(!cfg.projectId){setFirebaseStatus('Informe a configuração primeiro.','err');return}await connectFirebase(cfg,false)}
function firebaseRoot(){return firebaseDbOnline.collection(FIREBASE_ROOT[0]).doc(FIREBASE_ROOT[1])}
/* Firestore recusa nomes de campo que começam e terminam com "__" e valores undefined.
   fsSanitize ajusta antes de enviar; fsDesanitize desfaz ao baixar. */
function fsBadKey(k){return k.length>=2&&k.slice(0,2)==='__'&&k.slice(-2)==='__'}
function fsSanitize(v){
  if(v===undefined)return null;
  /* Firestore não aceita array dentro de array: o array interno vira {fsNestedArray:[...]} */
  if(Array.isArray(v))return v.map(x=>Array.isArray(x)?{fsNestedArray:fsSanitize(x)}:fsSanitize(x));
  if(v&&typeof v==='object'){
    const p=Object.getPrototypeOf(v);
    if(p!==Object.prototype&&p!==null)return v;
    const o={};
    Object.keys(v).forEach(k=>{o[fsBadKey(k)?'fs'+k:k]=Array.isArray(v[k])?fsSanitize(v[k]):fsSanitize(v[k])});
    return o;
  }
  return v;
}
function fsDesanitize(v){
  if(Array.isArray(v))return v.map(fsDesanitize);
  if(v&&typeof v==='object'){
    const p=Object.getPrototypeOf(v);
    if(p!==Object.prototype&&p!==null)return v;
    const ks=Object.keys(v);if(ks.length===1&&ks[0]==='fsNestedArray'&&Array.isArray(v.fsNestedArray))return fsDesanitize(v.fsNestedArray);
    const o={};
    Object.keys(v).forEach(k=>{o[(k.slice(0,2)==='fs'&&fsBadKey(k.slice(2)))?k.slice(2):k]=fsDesanitize(v[k])});
    return o;
  }
  return v;
}


/* ===== Proteções de sincronização (v86) ===== */
/* v84/v85 guardavam uma cópia dos dados no navegador (ocupa espaço). Salva essa cópia em arquivo e libera o espaço. */
window.addEventListener('load',function(){try{
  const BK='controle_refugos_2026_backup_antes_sync',raw=localStorage.getItem(BK);
  if(!raw)return;
  let arr=null;try{const o=JSON.parse(raw);arr=Array.isArray(o)?o:(o&&o.data)}catch(e){}
  if(Array.isArray(arr)&&arr.length){
    const blob=new Blob([JSON.stringify(arr)],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='backup-dados-antes-da-sincronizacao.json';document.body.appendChild(a);a.click();a.remove();
  }
  localStorage.removeItem(BK);
}catch(e){}});
let firebaseSyncPaused=false,firebaseFirstPullDone=false;
function fsKgTotal(arr){let t=0;(arr||[]).forEach(r=>{try{t+=Number(typeof kg==='function'?kg(r):0)||0}catch(e){}});return t}
function fsFmt(n){return Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}
/* Junta os pedaços (chunks) da nuvem só se pertencerem ao MESMO envio; evita misturar dados de dois computadores */
function fsAssemble(cfgSnap,chunkSnap){
  const cloudState=cfgSnap.exists?fsDesanitize(cfgSnap.data()):{};
  let docs=chunkSnap.docs.slice().sort((a,b)=>(a.data().index||0)-(b.data().index||0));
  if(cloudState.dataId){
    docs=docs.filter(d=>d.data().uploadId===cloudState.dataId);
    if(cloudState.totalChunks&&docs.length!==cloudState.totalChunks)return{ok:false,cloudState,remote:[]};
  }
  const remote=[];
  docs.forEach(d=>{const rs=fsDesanitize(d.data()?.records);if(Array.isArray(rs))remote.push(...rs)});
  return{ok:true,cloudState,remote};
}
/* ===== Atualização em tempo real: escuta mudanças feitas por outros computadores ===== */
let firebaseUnsub=[],firebasePullTimer=null,firebasePushPending=false,firebasePulling=false;
function fsStable(v){
  if(v===undefined||v===null)return 'null';
  if(Array.isArray(v))return '['+v.map(fsStable).join(',')+']';
  if(typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+fsStable(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function stopFirebaseListener(){try{rtUnlisten()}catch(e){}firebaseUnsub.forEach(u=>{try{u()}catch(e){}});firebaseUnsub=[];clearTimeout(firebasePullTimer)}
function startFirebaseListener(){
  stopFirebaseListener();
  if(localStorage.getItem(FIREBASE_SYNC_KEY)==='false'||!firebaseDbOnline)return;
  const root=firebaseRoot();
  const onChange=snap=>{
    if(snap&&snap.metadata&&snap.metadata.hasPendingWrites)return; /* escrita local, ainda não confirmada */
    clearTimeout(firebasePullTimer);
    firebasePullTimer=setTimeout(pullRemoteQuiet,700);
  };
  const onErr=e=>{console.error('Escuta Firebase:',e);setFirebaseStatus('Erro na atualização em tempo real: '+(e?.message||e),'err')};
  firebaseUnsub.push(root.collection('lancamentos').onSnapshot(onChange,onErr));try{rtListen()}catch(e){console.error(e)}
  firebaseUnsub.push(root.collection('config').doc('estado').onSnapshot(onChange,onErr));
}
async function pullRemoteQuiet(){
  if(firebasePulling||!firebaseDbOnline||firebaseSyncPaused)return;
  if(firebasePushPending){clearTimeout(firebasePullTimer);firebasePullTimer=setTimeout(pullRemoteQuiet,1500);return} /* há mudança local a enviar */
  firebasePulling=true;
  try{
    const root=firebaseRoot();
    const cfgSnap=await root.collection('config').doc('estado').get();
    const chunkSnap=await root.collection('lancamentos').orderBy('index').get();
    const asm=fsAssemble(cfgSnap,chunkSnap);
    if(!asm.ok)return; /* nuvem sendo atualizada por outro computador: espera o próximo aviso */
    const remote=asm.remote,cloudState=asm.cloudState;
    if(!remote.length)return; /* nuvem vazia: não apaga dados locais */
    const mesmoData=fsStable(remote)===fsStable(data);
    const mesmoMeta=!cloudState.meta||fsStable(cloudState.meta)===fsStable(meta);
    const mesmoCad=!cloudState.cadastros||fsStable(cloudState.cadastros)===fsStable(cadastros);
    const mesmoProd=!Array.isArray(cloudState.producaoFundicao)||fsStable(cloudState.producaoFundicao)===fsStable(producaoFundicao);
    if(mesmoData&&mesmoMeta&&mesmoCad&&mesmoProd)return;
    if(!firebaseFirstPullDone){
      firebaseFirstPullDone=true;
      if(data.length>0){
        const ok=confirm('Os dados da NUVEM são diferentes dos dados deste computador.\n\nNuvem: '+remote.length.toLocaleString('pt-BR')+' lançamentos, '+fsFmt(fsKgTotal(remote))+' kg\nEste computador: '+data.length.toLocaleString('pt-BR')+' lançamentos, '+fsFmt(fsKgTotal(data))+' kg\n\nOK = usar os dados da nuvem neste computador.\nCancelar = manter os dados deste computador e PAUSAR a sincronização.');
        if(!ok){firebaseSyncPaused=true;setFirebaseStatus('Sincronização pausada neste computador. Use "Enviar dados locais" ou "Baixar do Firebase" para decidir.','err');return}
      }
    }
    firebaseApplyingRemote=true;
    try{
      data=remote;
      if(cloudState.meta)meta=cloudState.meta;
      if(Array.isArray(cloudState.producaoFundicao))producaoFundicao=cloudState.producaoFundicao;
      if(cloudState.cadastros)cadastros=cloudState.cadastros;
      if(Array.isArray(cloudState.reunioes)){window.reunioes=cloudState.reunioes;localStorage.setItem('controle_refugos_2026_reunioes',JSON.stringify(window.reunioes))}
      if(cloudState.historicoFonte){try{localStorage.setItem(FONTE_HIST_KEY,JSON.stringify(cloudState.historicoFonte))}catch(e){}}
      producaoFundicao=(Array.isArray(producaoFundicao)?producaoFundicao:[]).map(x=>({...x,custoKg:2.6}));
      localStorage.setItem(PROD_KEY,JSON.stringify(producaoFundicao));
      salvarHistoricoFonte();
      localStorage.setItem(KEY,JSON.stringify(data));
      localStorage.setItem(KEY+'_meta',JSON.stringify(meta));
      saveCad();
      refresh();
    }finally{firebaseApplyingRemote=false}
    firebaseFirstPullDone=true;setFirebaseStatus('Atualizado em tempo real às '+new Date().toLocaleTimeString('pt-BR')+'.','ok');
  }catch(e){console.error('Atualização remota:',e)}
  finally{firebasePulling=false}
}
async function uploadLocalToFirebase(showMessage=true){try{const cfg=getFirebaseConfig()||firebaseCfgFields();if(!cfg.projectId){openFirebaseModal();setFirebaseStatus('Informe e salve a configuração primeiro.','err');return}if(!firebaseOnlineConnected)await connectFirebase(cfg,false);if(!firebaseDbOnline)return;setFirebaseStatus('Enviando dados locais para o Firebase...');const root=firebaseRoot();const fonteHistorico={versao:'v79',custoRefugoKg:2.60,producaoFundicao:Array.isArray(producaoFundicao)?producaoFundicao.map(x=>({...x,custoKg:2.6})):[],reunioes:Array.isArray(window.reunioes)?window.reunioes:[]};if(showMessage){const _c=await root.collection('config').doc('estado').get();const _k=await root.collection('lancamentos').orderBy('index').get();const _a=fsAssemble(_c,_k);if(_a.ok&&_a.remote.length&&(_a.remote.length!==data.length||Math.abs(fsKgTotal(_a.remote)-fsKgTotal(data))>0.5)){if(!confirm('ATENÇÃO: a nuvem já tem dados DIFERENTES dos deste computador.\n\nNuvem: '+_a.remote.length.toLocaleString('pt-BR')+' lançamentos, '+fsFmt(fsKgTotal(_a.remote))+' kg\nEste computador: '+data.length.toLocaleString('pt-BR')+' lançamentos, '+fsFmt(fsKgTotal(data))+' kg\n\nSubstituir os dados da nuvem pelos deste computador?')){setFirebaseStatus('Envio cancelado. A nuvem não foi alterada.','');return}}}
const dataId=Date.now().toString(36)+Math.random().toString(36).slice(2,8);const metaPayload={meta,producaoFundicao,cadastros,reunioes:window.reunioes||[],historicoFonte:fonteHistorico,dataId,totalRecords:data.length,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()};const chunks=[];for(let i=0;i<data.length;i+=FIREBASE_CHUNK_SIZE)chunks.push({index:Math.floor(i/FIREBASE_CHUNK_SIZE),records:data.slice(i,i+FIREBASE_CHUNK_SIZE),uploadId:dataId,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()});metaPayload.totalChunks=chunks.length;for(let i=0;i<chunks.length;i+=20){const batch=firebaseDbOnline.batch();chunks.slice(i,i+20).forEach(ch=>batch.set(root.collection('lancamentos').doc('chunk_'+String(ch.index).padStart(4,'0')),fsSanitize(ch)));await batch.commit()}const existing=await root.collection('lancamentos').get();const valid=new Set(chunks.map(ch=>'chunk_'+String(ch.index).padStart(4,'0')));let batch=firebaseDbOnline.batch(),count=0;existing.docs.forEach(d=>{if(!valid.has(d.id)){batch.delete(d.ref);count++}});if(count)await batch.commit();await root.collection('config').doc('estado').set(fsSanitize(metaPayload),{merge:true});firebaseSyncPaused=false;firebaseFirstPullDone=true;setFirebaseStatus('Dados locais enviados para o Firebase.','ok');if(showMessage)alert('Sincronização concluída: '+data.length.toLocaleString('pt-BR')+' lançamento(s).')}catch(e){console.error(e);setFirebaseStatus('Erro ao enviar: '+(e?.message||e),'err');alert('Erro ao enviar os dados para o Firebase.\n\n'+(e?.message||e))}}
async function downloadFromFirebase(){try{const cfg=getFirebaseConfig()||firebaseCfgFields();if(!cfg.projectId){openFirebaseModal();setFirebaseStatus('Informe e salve a configuração primeiro.','err');return}if(!firebaseOnlineConnected)await connectFirebase(cfg,false);if(!firebaseDbOnline)return;setFirebaseStatus('Baixando dados do Firebase...');const root=firebaseRoot();const cfgSnap=await root.collection('config').doc('estado').get();const chunkSnap=await root.collection('lancamentos').orderBy('index').get();if(!cfgSnap.exists&&!chunkSnap.size){throw new Error('Não existem dados publicados neste Firebase para este sistema.')}
 const _asm=fsAssemble(cfgSnap,chunkSnap);if(!_asm.ok)throw new Error('A nuvem está sendo atualizada por outro computador. Tente de novo em alguns segundos.');const cloudState=_asm.cloudState;const remote=_asm.remote;if(!remote.length&&!data.length)throw new Error('O Firebase está conectado, mas não há lançamentos para baixar.');if(remote.length){data=remote;if(cloudState.meta)meta=cloudState.meta;if(Array.isArray(cloudState.producaoFundicao))producaoFundicao=cloudState.producaoFundicao;if(cloudState.cadastros)cadastros=cloudState.cadastros;if(Array.isArray(cloudState.reunioes)){window.reunioes=cloudState.reunioes;localStorage.setItem('controle_refugos_2026_reunioes',JSON.stringify(window.reunioes))}if(cloudState.historicoFonte){try{localStorage.setItem(FONTE_HIST_KEY,JSON.stringify(cloudState.historicoFonte))}catch(e){}}producaoFundicao=(Array.isArray(producaoFundicao)?producaoFundicao:[]).map(x=>({...x,custoKg:2.6}));localStorage.setItem(PROD_KEY,JSON.stringify(producaoFundicao));salvarHistoricoFonte();localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem(KEY+'_meta',JSON.stringify(meta));localStorage.setItem(PROD_KEY,JSON.stringify(producaoFundicao));saveCad();refresh();}firebaseSyncPaused=false;firebaseFirstPullDone=true;setFirebaseStatus('Dados do Firebase carregados neste navegador.','ok');alert('Dados do Firebase carregados: '+remote.length.toLocaleString('pt-BR')+' lançamento(s).')}catch(e){console.error(e);setFirebaseStatus('Erro ao baixar: '+(e?.message||e),'err');alert('Erro ao baixar os dados do Firebase.\n\n'+(e?.message||e))}}
function disconnectFirebase(){try{stopFirebaseListener();if(firebaseAuthOnline)firebaseAuthOnline.signOut();if(firebaseAppOnline&&firebaseAppOnline.delete)firebaseAppOnline.delete()}catch{}firebaseOnlineConnected=false;firebaseAuthOnline=null;firebaseDbOnline=null;firebaseAppOnline=null;localStorage.removeItem(FIREBASE_CONFIG_KEY);localStorage.removeItem(FIREBASE_SYNC_KEY);setFirebaseStatus('Desconectado. O sistema voltou para o modo local.','')}
function scheduleFirebasePush(){if(!firebaseOnlineConnected||firebaseApplyingRemote||firebaseSyncPaused||localStorage.getItem(FIREBASE_SYNC_KEY)==='false')return;clearTimeout(firebasePushTimer);firebasePushPending=true;firebasePushTimer=setTimeout(()=>{uploadLocalToFirebase(false).catch(()=>{}).finally(()=>{firebasePushPending=false})},800)}
window.addEventListener('load',()=>{const cfg=getFirebaseConfig();if(cfg)setTimeout(()=>connectFirebase(cfg,false),700)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFirebaseModal()});document.getElementById('firebaseOverlay')?.addEventListener('click',e=>{if(e.target.id==='firebaseOverlay')closeFirebaseModal()});
document.getElementById('firebaseConfigBtn')?.addEventListener('click',e=>{e.preventDefault();window.openFirebaseModal();});
document.getElementById('firebaseConfigPaste')?.addEventListener('input',()=>{});
const storedV2=JSON.parse(localStorage.getItem(KEY)||'null');
const storedV1=JSON.parse(localStorage.getItem(OLD_KEY)||'null');
function recordSignature(r){
 const v=k=>String(r?.[k]??'').trim().toUpperCase();
 return [v('CLIENTE'),v('CÓDIGO SISTEMA'),v('OF'),String(r?.[cols.data] ?? r?.['DATA DO REFUGO/ DATA DA APROVAÇÃO'] ?? '').trim().toUpperCase(),v('MOTIVO DO REFUGO'),v('QUANTIDADE'),v('Kg  S/CANAL REFUGADOS')].join('|');
}
function mergeSeedWithPrevious(seed,previous){
 const out=Array.isArray(seed)?seed.slice():[];
 if(!Array.isArray(previous)) return out;
 const seen=new Set(out.map(recordSignature));
 previous.forEach(r=>{
   const s=recordSignature(r);
   if(!seen.has(s)){out.push(r);seen.add(s)}
 });
 return out;
}
let data=Array.isArray(storedV2) ? storedV2 : mergeSeedWithPrevious(initialData,storedV1);
// Migra o nome antigo do campo de data para 'DATA DO REFUGO', preservando os registros existentes.
(function migrarCampoDataRefugo(){
  let changed=false;
  data=data.map(r=>{
    if(!r||typeof r!=='object')return r;
    const oldVal=r['DATA DO REFUGO/ DATA DA APROVAÇÃO'];
    if((r['DATA DO REFUGO']===undefined || r['DATA DO REFUGO']===null || r['DATA DO REFUGO']==='') && oldVal!==undefined && oldVal!==null && oldVal!==''){
      changed=true;
      const copy={...r};
      copy['DATA DO REFUGO']=oldVal;
      delete copy['DATA DO REFUGO/ DATA DA APROVAÇÃO'];
      return copy;
    }
    if(r['DATA DO REFUGO/ DATA DA APROVAÇÃO']!==undefined){
      changed=true;
      const copy={...r};
      delete copy['DATA DO REFUGO/ DATA DA APROVAÇÃO'];
      return copy;
    }
    return r;
  });
  if(changed) localStorage.setItem(KEY,JSON.stringify(data));
})();
// Sincroniza a base histórica com a planilha oficial removendo dois registros de exemplo
// que existiam na versão antiga do HTML, mas não existem na planilha.
function removerRegistrosForaDaPlanilha(){
 const exemplos=[
  ['PRISMEC','67156','440/26','2026-05-13','34','315',162.75000000000003,'FUNDICAO'],
  ['MEG','66621','603/26','2026-07-07','27','2',1.445,'FUNDICAO']
 ];
 const antes=data.length;
 data=data.filter(r=>!exemplos.some(e=>
  String(r?.CLIENTE??'').trim()===e[0] &&
  String(r?.['CÓDIGO SISTEMA']??'').trim()===e[1] &&
  String(r?.OF??'').trim()===e[2] &&
  String(r?.['DATA DO REFUGO'] ?? r?.['DATA DO REFUGO/ DATA DA APROVAÇÃO'] ?? '').trim()===e[3] &&
  String(r?.['MOTIVO DO REFUGO']??'').trim()===e[4] &&
  String(r?.QUANTIDADE??'').trim()===e[5] &&
  Math.abs(Number(r?.['Kg  S/CANAL REFUGADOS'])-Number(e[6]))<0.000001 &&
  String(r?.PLANTA??'').trim().toUpperCase()===e[7]
 ));
 if(data.length!==antes) localStorage.setItem(KEY,JSON.stringify(data));
}
removerRegistrosForaDaPlanilha();
// Consolidação dos nomes de clientes na base histórica: apenas o nome é corrigido;
// os lançamentos individuais permanecem preservados.
const CLIENTES_HIST_VERSION='2026-09-29-historico-clientes-consolidado-v2';
const clientesHistSavedVersion=localStorage.getItem(KEY+'_clientes_historico_version');
data=data.map(r=>({...r,CLIENTE:canonicalClientName(r?.CLIENTE)}));
if(clientesHistSavedVersion!==CLIENTES_HIST_VERSION){
  localStorage.setItem(KEY,JSON.stringify(data));
  localStorage.setItem(KEY+'_clientes_historico_version',CLIENTES_HIST_VERSION);
}
// Remove registros vazios/zerados que foram gravados no histórico por versões anteriores.
// Mantém lançamentos reais que tenham código, cliente, produto, OF ou data.
function limparRegistrosZeradosHistorico(){
  const antes=data.length;
  data=data.filter(r=>{
    const q=Number(String(r?.['QUANTIDADE']??'').replace(',','.'));
    const kg=Number(String(r?.['Kg  S/CANAL REFUGADOS']??'').replace(',','.'));
    const semCamposPrincipais=[
      r?.['CLIENTE'],r?.['CÓDIGO SISTEMA'],r?.['DESCRIÇÃO DO PRODUTO'],r?.['OF'],
      r?.['DATA DO REFUGO/ DATA DA APROVAÇÃO'],r?.['RESPONSÁVEL PELA ETIQUETA']
    ].every(v=>String(v??'').trim()==='');
    const zerado=(String(r?.['QUANTIDADE']??'').trim()==='' || (Number.isFinite(q)&&q<=0)) &&
                 (String(r?.['Kg  S/CANAL REFUGADOS']??'').trim()==='' || (Number.isFinite(kg)&&kg<=0));
    return !(zerado && semCamposPrincipais);
  });
  if(data.length!==antes){
    localStorage.setItem(KEY,JSON.stringify(data));
  }
}
limparRegistrosZeradosHistorico();
let meta=JSON.parse(localStorage.getItem(KEY+'_meta')||'null') || {perc:2,kg:0};
let producaoFundicao=JSON.parse(localStorage.getItem(PROD_KEY)||'null') || [];
producaoFundicao=(Array.isArray(producaoFundicao)?producaoFundicao:[]).map(x=>({...x,custoKg:x?.custoKg==null?'':x.custoKg}));
(function seedProducaoFundicao2026(){const dados=[{mes:1,kg:44100},{mes:2,kg:36200},{mes:3,kg:51800},{mes:4,kg:35500},{mes:5,kg:44700},{mes:6,kg:44400},{mes:7,kg:37100},{mes:8,kg:44500},{mes:9,kg:52600}];let alterado=false;dados.forEach(d=>{const idx=producaoFundicao.findIndex(x=>Number(x.ano)===2026&&Number(x.mes)===d.mes);const registro={ano:2026,mes:d.mes,kg:d.kg,custoKg:2.6,observacao:'Produção mensal da Fundição'};if(idx>=0){const atual=producaoFundicao[idx]||{};const atualizado={...atual,ano:2026,mes:d.mes,kg:d.kg,custoKg:2.6,observacao:atual.observacao||registro.observacao};if(JSON.stringify(atual)!==JSON.stringify(atualizado)){producaoFundicao[idx]=atualizado;alterado=true}}else{producaoFundicao.push(registro);alterado=true}});if(alterado)localStorage.setItem(PROD_KEY,JSON.stringify(producaoFundicao));})();
const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const cols={cliente:'CLIENTE',codigo:'CÓDIGO SISTEMA',produto:'DESCRIÇÃO DO PRODUTO',of:'OF',quantidade:'QUANTIDADE',pesoArvore:'PESO ARVORE',pesoCanal:'PESO S/CANAL',kgArvore:'Kg TOTAL ARVORE',kgFundUsin:'Kg LIQUIDO FUNDICAO / BRUTO USINAGEM',kgRefugo:'Kg  S/CANAL REFUGADOS',motivo:'MOTIVO DO REFUGO',descricaoMotivo:'DESCRIÇÃO DO MOTIVO',planta:'PLANTA',material:'MATERIAL',data:'DATA DO REFUGO',responsavel:'RESPONSÁVEL PELA ETIQUETA',observacao:'OBSERVAÇÃO',dataLancamento:'DATA DO LANÇAMENTO',produzidoKg:'TOTAL PRODUZIDO (KG)',custoKg:'CUSTO DO REFUGO (R$/KG)'};
const MOTIVOS_VERSION='2026-09-30-motivos-v1';
const DEFAULT_MOTIVOS=[{"codigo":"2","planta":"FUNDICAO","descricao":"COMP. QUIMICA FORA DO ESPECIFICADO"},{"codigo":"3","planta":"FUNDICAO","descricao":"DESLOCAMENTO DO MACHO"},{"codigo":"4","planta":"FUNDICAO","descricao":"DESLOCAMENTO DO MOLDE"},{"codigo":"5","planta":"FUNDICAO","descricao":"DUREZA FORA DO ESPECIFICADO"},{"codigo":"6","planta":"FUNDICAO","descricao":"EMPENAMENTO"},{"codigo":"7","planta":"FUNDICAO","descricao":"ESTRUTURA METALOGRAFICA REPROVADA"},{"codigo":"8","planta":"FUNDICAO","descricao":"FALHA DE ACABAMENTO"},{"codigo":"9","planta":"FUNDICAO","descricao":"FALHA DE IDENTIFICACAO"},{"codigo":"10","planta":"FUNDICAO","descricao":"FALHA NA DESMOLDAGEM"},{"codigo":"11","planta":"FUNDICAO","descricao":"FALHA NO DIMENSIONAL"},{"codigo":"12","planta":"FUNDICAO","descricao":"FALHA NA MACHARIA"},{"codigo":"13","planta":"FUNDICAO","descricao":"FALHA NA MOLDAGEM"},{"codigo":"14","planta":"FUNDICAO","descricao":"FALHA NA QUEBRA DOS CANAIS"},{"codigo":"15","planta":"FUNDICAO","descricao":"FALHA NO CORTE"},{"codigo":"16","planta":"FUNDICAO","descricao":"FALHA NO MANUSEIO"},{"codigo":"17","planta":"FUNDICAO","descricao":"FALHA NO TRANSPORTE/MOVIMENTACAO"},{"codigo":"18","planta":"FUNDICAO","descricao":"FALHA NO VAZAMENTO"},{"codigo":"19","planta":"FUNDICAO","descricao":"FALTA DE IDENTIFICACAO"},{"codigo":"20","planta":"FUNDICAO","descricao":"FALTA DE METAL"},{"codigo":"21","planta":"FUNDICAO","descricao":"INCLUSAO DE AREIA"},{"codigo":"22","planta":"FUNDICAO","descricao":"NCLUSAO DE ESCORIA"},{"codigo":"23","planta":"FUNDICAO","descricao":"INCLUSAO DE GAS"},{"codigo":"24","planta":"FUNDICAO","descricao":"JUNTA FRIA"},{"codigo":"25","planta":"FUNDICAO","descricao":"MACHO QUEBRADO"},{"codigo":"26","planta":"FUNDICAO","descricao":"MATERIAL FRIO"},{"codigo":"27","planta":"FUNDICAO","descricao":"MOLDE QUEBRADO"},{"codigo":"28","planta":"FUNDICAO","descricao":"OUTROS"},{"codigo":"29","planta":"FUNDICAO","descricao":"OXIDACAO"},{"codigo":"30","planta":"FUNDICAO","descricao":"PENETRACAO METALICA"},{"codigo":"31","planta":"FUNDICAO","descricao":"POROSIDADE"},{"codigo":"32","planta":"FUNDICAO","descricao":"PROPRIEDADE MECANICA"},{"codigo":"33","planta":"FUNDICAO","descricao":"REACAO COM TINTA"},{"codigo":"34","planta":"FUNDICAO","descricao":"RECHUPE"},{"codigo":"35","planta":"FUNDICAO","descricao":"SINTERIZACAO"},{"codigo":"36","planta":"FUNDICAO","descricao":"SUJEIRA NO MOLDE"},{"codigo":"37","planta":"FUNDICAO","descricao":"VAZAMENTO DE METAL DO MOLDE"},{"codigo":"38","planta":"FUNDICAO","descricao":"VEIOS"},{"codigo":"39","planta":"FUNDICAO","descricao":"FALHA DE PROJETO/DESENVOLVIMENTO"},{"codigo":"40","planta":"FUNDICAO","descricao":"MOLDE EMPENADO"},{"codigo":"41","planta":"FUNDICAO","descricao":"REBARBACAO EXCESSIVA"},{"codigo":"42","planta":"FUNDICAO","descricao":"LUVA INSERIDA NA PECA"},{"codigo":"43","planta":"FUNDICAO","descricao":"PECA MANCHADA"},{"codigo":"44","planta":"FUNDICAO","descricao":"INCLUSAO DE FILTRO NA PECA"},{"codigo":"45","planta":"FUNDICAO","descricao":"ANALISE DE SANIDADE DO FUNDIDO"},{"codigo":"46","planta":"FUNDICAO","descricao":"FLUIDEZ PREJUDICADA"},{"codigo":"47","planta":"FUNDICAO","descricao":"FLUIDEZ PREJUDICADA / ALIMENTACAO"},{"codigo":"48","planta":"FUNDICAO","descricao":"ALIMENTA€ÇO INSUFICIENTE"},{"codigo":"49","planta":"FUNDICAO","descricao":"COPO DE VAZAMENTO INCOMPATIVEL COM O PESO DA"},{"codigo":"50","planta":"FUNDICAO","descricao":"BAIXA RESISTENCIA DO MOLDE (RACHADURA)"},{"codigo":"51","planta":"FUNDICAO","descricao":"FALHA NA COLAGEM DOS COPOS"},{"codigo":"52","planta":"FUNDICAO","descricao":"PEÇA COM INCHAMENTO"},{"codigo":"53","planta":"FUNDICAO","descricao":"MOLDE TRINCADO"},{"codigo":"54","planta":"FUNDICAO","descricao":"PEÇA QUEBRADA"},{"codigo":"55","planta":"FUNDICAO","descricao":"BAIXA TEMPERATURADE VAZAMENTO"},{"codigo":"56","planta":"FUNDICAO","descricao":"BAIXA RESISTENCIA MECANICA DO COPO"},{"codigo":"57","planta":"FUNDICAO","descricao":"EXCESSO DE DESMOLDANTE"},{"codigo":"58","planta":"FUNDICAO","descricao":"FALTA DE MACHO"},{"codigo":"59","planta":"FUNDICAO","descricao":"FERVURA"},{"codigo":"101","planta":"FUNDICAO NA USINAGEM","descricao":"COLA NA PECA"},{"codigo":"102","planta":"FUNDICAO NA USINAGEM","descricao":"COMP QUIM FORA ESPECIF"},{"codigo":"103","planta":"FUNDICAO NA USINAGEM","descricao":"DESLOCAMENTO DO MACHO"},{"codigo":"104","planta":"FUNDICAO NA USINAGEM","descricao":"DESLOCAMENTO DO MOLDE"},{"codigo":"105","planta":"FUNDICAO NA USINAGEM","descricao":"DUREZA FORA DO ESPECIF"},{"codigo":"106","planta":"FUNDICAO NA USINAGEM","descricao":"EMPENAMENTO"},{"codigo":"107","planta":"FUNDICAO NA USINAGEM","descricao":"ESTR METALOGR REPROVAD"},{"codigo":"108","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA DE ACABAMENTO"},{"codigo":"109","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA DE IDENTIFICACAO"},{"codigo":"110","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NA DESMOLDAGEM"},{"codigo":"111","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NO DIMENSIONAL"},{"codigo":"112","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NA MACHARIA"},{"codigo":"113","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NA MOLDAGEM"},{"codigo":"114","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NA QBRA CANAIS"},{"codigo":"115","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NO CORTE"},{"codigo":"116","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NO MANUSEIO"},{"codigo":"117","planta":"FUNDICAO NA USINAGEM","descricao":"ALHA NO TRANSP/MOVIM"},{"codigo":"118","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA NO VAZAMENTO"},{"codigo":"119","planta":"FUNDICAO NA USINAGEM","descricao":"FALTA DE IDENTIFICACAO"},{"codigo":"120","planta":"FUNDICAO NA USINAGEM","descricao":"FALTA DE METAL"},{"codigo":"121","planta":"FUNDICAO NA USINAGEM","descricao":"INCLUSAO DE AREIA"},{"codigo":"122","planta":"FUNDICAO NA USINAGEM","descricao":"INCLUSAO DE ESCORIA"},{"codigo":"123","planta":"FUNDICAO NA USINAGEM","descricao":"INCLUSAO DE GAS"},{"codigo":"124","planta":"FUNDICAO NA USINAGEM","descricao":"JUNTA FRIA"},{"codigo":"125","planta":"FUNDICAO NA USINAGEM","descricao":"MACHO QUEBRADO"},{"codigo":"126","planta":"FUNDICAO NA USINAGEM","descricao":"MATERIAL FRIO"},{"codigo":"127","planta":"FUNDICAO NA USINAGEM","descricao":"MOLDE QUEBRADO"},{"codigo":"128","planta":"FUNDICAO NA USINAGEM","descricao":"OUTROS"},{"codigo":"129","planta":"FUNDICAO NA USINAGEM","descricao":"OXIDACAO"},{"codigo":"130","planta":"FUNDICAO NA USINAGEM","descricao":"PENETRACAO METALICA"},{"codigo":"131","planta":"FUNDICAO NA USINAGEM","descricao":"POROSIDADE"},{"codigo":"132","planta":"FUNDICAO NA USINAGEM","descricao":"PROPRIEDADE MECANICA"},{"codigo":"133","planta":"FUNDICAO NA USINAGEM","descricao":"REACAO COM TINTA"},{"codigo":"134","planta":"FUNDICAO NA USINAGEM","descricao":"RECHUPE"},{"codigo":"135","planta":"FUNDICAO NA USINAGEM","descricao":"SINTERIZACAO"},{"codigo":"136","planta":"FUNDICAO NA USINAGEM","descricao":"SUJEIRA NO MOLDE"},{"codigo":"137","planta":"FUNDICAO NA USINAGEM","descricao":"VAZAMENTO DE METAL DO"},{"codigo":"138","planta":"FUNDICAO NA USINAGEM","descricao":"VEIOS"},{"codigo":"139","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA DE PROJ/DESENV"},{"codigo":"140","planta":"FUNDICAO NA USINAGEM","descricao":"MOLDE EMPENADO"},{"codigo":"141","planta":"FUNDICAO NA USINAGEM","descricao":"REBARBACAO EXCESSIVA"},{"codigo":"142","planta":"FUNDICAO NA USINAGEM","descricao":"LUVA INSERIDA NA PECA"},{"codigo":"143","planta":"FUNDICAO NA USINAGEM","descricao":"PECA MANCHADA"},{"codigo":"144","planta":"FUNDICAO NA USINAGEM","descricao":"INCLUSAO DE FILTRO NA PEÇA"},{"codigo":"145","planta":"FUNDICAO NA USINAGEM","descricao":"ANALISE DE SANIDADE DO FUNDIDO"},{"codigo":"146","planta":"FUNDICAO NA USINAGEM","descricao":"FLUIDEZ PREJUDICADA"},{"codigo":"147","planta":"FUNDICAO NA USINAGEM","descricao":"FLUIDEZ  PREJUDICADA / ALIMENTAÇÃO"},{"codigo":"148","planta":"FUNDICAO NA USINAGEM","descricao":"ALIMENTAÇÃO INSUFICIENTE"},{"codigo":"149","planta":"FUNDICAO NA USINAGEM","descricao":"COPO DE VAZAMENTO INCOMPATIVEL"},{"codigo":"150","planta":"FUNDICAO NA USINAGEM","descricao":"BAIXA RESISTENCIA DO MOLDE (RACHADURA)"},{"codigo":"151","planta":"FUNDICAO NA USINAGEM","descricao":"FALHA COL. DOS COPOS"},{"codigo":"152","planta":"FUNDICAO NA USINAGEM","descricao":"PEÇA COM INCHAMENTO"},{"codigo":"153","planta":"FUNDICAO NA USINAGEM","descricao":"MOLDE TRINCADO"},{"codigo":"154","planta":"FUNDICAO NA USINAGEM","descricao":"PEÇA QUEBRADA"},{"codigo":"155","planta":"FUNDICAO NA USINAGEM","descricao":"BAIXA TEMPERATURADE VAZAMENTO"},{"codigo":"156","planta":"FUNDICAO NA USINAGEM","descricao":"BAIXA RESISTENCIA MECANICA DO COPO"},{"codigo":"157","planta":"FUNDICAO NA USINAGEM","descricao":"EXCESSO DE DESMOLDANTE"},{"codigo":"158","planta":"FUNDICAO NA USINAGEM","descricao":"FALTA DE MACHO"},{"codigo":"159","planta":"FUNDICAO NA USINAGEM","descricao":"FERVURA"},{"codigo":"201","planta":"USINAGEM","descricao":"DEFEITO DE FUNDICAO"},{"codigo":"202","planta":"USINAGEM","descricao":"FALHA NA CONTAGEM"},{"codigo":"203","planta":"USINAGEM","descricao":"FALHA NA INSPECAO"},{"codigo":"204","planta":"USINAGEM","descricao":"FALHA NA MONTAGEM"},{"codigo":"205","planta":"USINAGEM","descricao":"FALHA NA PREPARACAO DA MAQUINA"},{"codigo":"206","planta":"USINAGEM","descricao":"FALHA NA PREPARACAO INSTR. MEDICAO"},{"codigo":"207","planta":"USINAGEM","descricao":"FALHA NA PRESERVACAO"},{"codigo":"208","planta":"USINAGEM","descricao":"FALHA NA PROGRAMACAO DA MAQUINA"},{"codigo":"209","planta":"USINAGEM","descricao":"FALHA NO CONTROLE DIMENSIONAL"},{"codigo":"210","planta":"USINAGEM","descricao":"FALHA NO REGISTRO DE MANUTENCAO"},{"codigo":"211","planta":"USINAGEM","descricao":"FALHA NO REGISTRO DE PRODUCAO"},{"codigo":"212","planta":"USINAGEM","descricao":"FALHA NO REGISTRO DE RECEBIMENTO"},{"codigo":"213","planta":"USINAGEM","descricao":"FALHA NO TRANSPORTE/MOVIMENTACAO"},{"codigo":"214","planta":"USINAGEM","descricao":"FALTA DE ATENCAO DO COLABORADOR"},{"codigo":"215","planta":"USINAGEM","descricao":"FALTA DE IDENTIFICACAO"},{"codigo":"216","planta":"USINAGEM","descricao":"MAQUINA COM DEFEITO"},{"codigo":"217","planta":"USINAGEM","descricao":"OUTROS"},{"codigo":"218","planta":"USINAGEM","descricao":"FALHA DE PROJETO/DESENVOLVIMENTO"},{"codigo":"219","planta":"USINAGEM","descricao":"PEÇA COM VIBRAMENTO"},{"codigo":"220","planta":"USINAGEM","descricao":"REPROVADA NO TESTE/ POKA YOKE"},{"codigo":"221","planta":"USINAGEM","descricao":"FERRAMENTAL SOLTO / SOLTOU"},{"codigo":"222","planta":"USINAGEM","descricao":"FERRAMENTAL QUEBROU"},{"codigo":"301","planta":"GERAL","descricao":"RECLAMACAO NAO PROCEDE"},{"codigo":"302","planta":"GERAL","descricao":"OUTROS"},{"codigo":"303","planta":"SISTEMA","descricao":"FALHA MEGATRON (DIF. QUANT. PROD.)"}];
const CADKEY='controle_refugos_2026_cadastros_v1';
let cadastros=JSON.parse(localStorage.getItem(CADKEY)||'null');
const SEM_CLIENTE='SEM CLIENTE CADASTRO';
function clienteOptionsHtml(list,placeholder){
  const itens=(Array.isArray(list)?list:[]).filter(x=>String(x||'').trim().toUpperCase()!==SEM_CLIENTE);
  return '<option value="">'+(placeholder||'Selecione o cliente')+'</option>'
    +itens.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')
    +`<option value="${SEM_CLIENTE}">Sem cliente cadastro</option>`;
}
function canonicalClientName(v){
  const raw=String(v??'').trim();
  const key=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
  if(key==='NADIR' || key==='NADIR FIGUEIREDO') return 'NADIR';
  if(key==='MAGUINIVISAO') return 'MAGUINIVISÃO';
  if(key==='JBS' || key==='JBS/FROTA') return 'JBS';
  if(key==='ALL PRINT') return 'ALL PRINT';
  return raw;
}

function normalizeClientList(list){
  return [...new Map((Array.isArray(list)?list:[]).map(x=>canonicalClientName(x)).filter(Boolean).filter(x=>String(x).trim().toUpperCase()!==SEM_CLIENTE).map(x=>[x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),x])).values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

const CADASTRO_EXCEL_SEED_VERSION='2026-10-06-cadastro-peso-unitario-bruto-v74';
// Fonte oficial de PESO PRINCIPAL / PESO BRUTO FRACIONADO: última planilha enviada (aba LANÇAMENTOS / PESO UNITARIO BRUTO).
// Os produtos encontrados na planilha têm prioridade sobre valores antigos guardados no localStorage.
// A versão do seed é renovada para forçar a atualização do cadastro existente neste navegador.
const CADASTRO_EXCEL_SEED=(function(K,R){return R.map(function(v){var o={};K.forEach(function(k,i){o[k]=v[i]===undefined?null:v[i]});return o})})(["cliente","codigo","descricao","planta","material","pesoPrincipal","pesoArvore","pesoFundUsin","pesoUsinado","_origemExcel"],[["","62480","W19.05 ANEL J.895.226.362.4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66371","172246 ANEL GUIA BI-PARTIDO 0455-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66623","ANEL COMPRESSÃO 0,10 65,25MM 085.001.090","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66625","ANEL RASPA 0,10 62,25MM 086.001.090","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66823","085.009.081 ANEL COMPRESSÃO STD 75,75MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66824","086.009.081 ANEL RASPA 75,75MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66825","085.009.082 ANEL COMPRESSÃO 0,10 76,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66826","086.009.082 ANEL RASPA 0,10 76,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66827","085.009.083 ANEL COMRPESSÃO 0,20 76,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66828","086.009.083 ANEL RASPA 0,20 76,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62034","634.674 ANEL BIPARTIDO 6,74","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62097","636.700 ANEL BIPARTIDO 7,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62116","636.736 ANEL BIPARTIDO 7,36","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62082","635.715 ANEL DO CUBO TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62052","635.210 ANEL BIPARTIDO 10,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62039","634.684 ANEL BIPARTIDO 6,84","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62072","635.250 ANEL BIPARTIDO  10,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63916","604.084 ANEL DESENGATE DA EMBREAGEM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60580","634.708 ANEL BIPARTIDO 7,08","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63497","604.069 ANEL DISTANCIADOR ROLAMENTO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60737","1678 REPARO CABEÇOTE INTEGRADO GERAL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60550","12108057 ANEL 1.1/2\" X 1/8\" X 1/16\" BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62537","12113379 PISTON RING 1-11-91","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60488","ANEL SEGMENTO 1.1/4\" X 1/8\" X 1/16\" BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63794","604.075 ANEL PISTA BALANÇA TRUCK","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62206","635.701 ANEL DO CUBO TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62207","635.702 ANEL DO CUBO TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62081","635.710 ANEL DO CUBO TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62083","635.716 ANEL DO CUBO TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62159","726.023 PORCA EIXO ENTALHADO M28X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62161","726.700 PORCO DO PILOTO M45X1,5 ESQ","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62167","733.040 PORCA DO PILOTO M32X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62170","735.143 PORCA REGUL DA COROA M155X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62172","735.703 PORCO DO PINHAO M40X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62176","735.707 PORCA DA CARCAÇA M65X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62178","735.709 PORCA DA CARCAÇA M75X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62880","VV-2884 ANEL DE PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66595","ANEL BAIONETA 3\"X6,00X3,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66596","ANEL BAIONETA 4\"X6,00X3,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66597","ANEL BAIONETA 5\"X6,00X3,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66598","ANEL BAIONETA 6\"X6,00X6,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66599","ANEL BAIONETA 7\"X3/8X8,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62098","ANEL BIPARTIDO 636.702 7,02","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66815","ANEL DIÂMETRO EXTERNO 33,40MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66816","ANEL DIÂMETRO EXTERNO 16,30MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66817","ANEL DIÂMETRO EXTERNO 90MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66830","SEI052SUB ANEL DESGASTE 86S1003Z09A21","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66456","171823 ANEL GUIA SECCIONADO DES 343-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66372","172247 ANEL GUIA BI-PARTIDO DES 455-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66373","172248 ANEL GUIA SECCIONADO BI-PARTIDO DES 455-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66374","172249 ANEL GUIA SECCIONADO BI-PARTIDO DES 454-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66772","172276 ANEL GUIA SECCIONADO BI-PARTIDO DES 454-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66624","085.001.122 ANEL COMPRESSÃO 0,10 75,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66626","086.001.122 ANEL RASPA 0,10 75,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66618","085.001.114 ANEL COMPRESSÃO 0,10 70,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66627","086.001.114 ANEL RASPA 0,10 70,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63851","704.174 PORCA CARDAN AUTOTR. 1.1/4X18 FPP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62635","C 2.800.891","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62488","C 208.768","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61808","0830020000 ANEL DO PISTÃO AM 20-83","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.004",true],["","61810","08300240000 ANEL DO PISTÃO AM 24-83","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.0018",true],["","61812","08300090000 ANEL DO PISTÃO AM 9-83","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62056","635.218 ANEL BIPARTIDO 10,18","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62404","638.674 ANEL BIPARTIDO 6,74","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62406","638.678 ANEL BIPARTIDO 6,78","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62423","638.736 ANEL BIPARTIDO 7,36","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62529","637.660 ANEL BIPARTIDO 6,60","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62673","637.664 ANEL BIPARTIDO 6,64","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66644","085.001.130 ANEL COMPRESSÃO 010 82,25 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66645","086.001.130 ANEL RASPA 0,10 82,25MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66537","171818 ANEL GUIA BIPARTIDO DES. 0344-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60767","VE-695 ANEL DE PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62652","2756 ANEL SEGMENTO DES. 191-0132","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63897","13814 ANEL DE PISTÃO DESE. VV-6208","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62464","635.212 ANEL BIPARTIDO 10,12","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62057","635.220 ANEL BIPARTIDO 10,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62062","635.230 ANEL BIPARTIDO 10,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62067","635.240 ANEL BIPARTIDO 10,40","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66834","ANEL RETO 95X87X3","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66543","171817 ANEL GUIA BI-PARTIDO DES 0344-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66376","171819 ANEL GUIA BI-PARTIDO DES. 0344-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66433","171820 ANEL GUIA SECCIONADO DES. 0343-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66455","171821 ANEL GUIA SECCIONADO DES. 0343-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66377","171822 ANEL GUIA SECCIONADO DES. 0343-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66375","172275 ANEL GUIA SECCIONADO DES. 0454-TAB","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66840","ANEL BAIONETA 342,00X330,00X6,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60692","VE-675 ANEL DE PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62214","VV2885 ANEL DE PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63559","ANEL VV- 405","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61080","ANEL TRAVA 30X2.0","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61079","ANEL TRAVA 35X2.50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60646","ANEL BAIONETA 2''1/2X3/16X7.64","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","ITEM NOVO","ANEL BAIONETA 6\"X5/16X3/16","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60690","ANEL BAIONETA 2''3/4X3/16X1/8 CORTE 45º","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62054","635.214 ANEL BIPARTIDO 10,14","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62467","636.680 ANEL BIPARTIDO 6,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65514","ANEL 83300155 D158,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65515","ANEL 83300175 D179,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65527","ANEL 83310098 D107,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65528","ANEL 83310116 D125,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65529","ANEL 83310135 D145,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65530","ANEL 83310155 D165,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65531","ANEL 83310175 D185,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65532","ANEL 83310197 D207,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65523","ANEL 83320176 D179,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65510","ANEL 83300080 D84,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65511","ANEL 83300098 D102,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65512","ANEL 83300116 D120,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65513","ANEL 83300135 D139,40","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65516","ANEL 83300197 D201,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65526","ANEL 83310080 D89,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65518","ANEL 83320080 D84,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65524","ANEL 8332197 D201,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62107","636.720 ANEL BIPARTIDO 7,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63301","BUCHA DO ROLO BD201L","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66842","ANEL 60X55,80X3,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66843","ANEL 60X55,80X2,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62065","635236 ANEL BIPARTIDO-10,36","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63696","CONJ ABRAÇADEIRAS FIXA 5´´.1/2","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63697","CONJ ABRAÇADEIRAS RAPIDA 5´´.1/2","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61580","ANEL 4137.4407.40 D134,77","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62879","PET 043 CAMISA2.1/2","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64515","ANEL 4137.0000.38 D243,82","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","64295","ANEL 4137.0000.39 D269,77","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61578","ANEL 4137.4107.40 D115.77","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61582","ANEL 4137.4707.40 D153,77","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61584","ANEL 4137.5007.40 D173,77","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61588","ANEL 4137.5407.40 D195,77","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61591","ANEL 4137.5707.40 D218,82 REV01","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62242","ANEL 4147.0000.16 D238,90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","64294","ANEL 4147.0000.37 D264,90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61603","ANEL 4147.5103.40 D168,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61605","ANEL 4147.5403.40 D190.90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61607","ANEL 4147.5703.40 D213,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62248","ANEL C246.693","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62690","ANEL C220.596","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65990","HB 158 ANEL D158 X 8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66837","HB 178 ANEL D178 X 8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62708","HB 201 ANEL D201 X 8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66838","HB 225 ANEL D225 X 8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62675","637.700 ANEL BIPARTIDO 7,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63808","704.062 PORCA DE REGULAGEM DA COROA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.36",true],["","637696","638.696 ANEL BIPARTIDO 6,96","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66378","16894 -ANEL DE SEGMENTO 85,70X80,50X3,15","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66359","16794 -ANEL DE SEGMENTO 92,25X89,45X3,15","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62369","CONJ ABRAÇADEIRAS 3''","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62041","636.688 ANEL BIPARTIDO 6,88","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62049","638.684 ANEL BIPARTIDO 6,84","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62066","635.238 ANEL BIPARTIDO 10,38","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62113","636.730 ANEL BIPARTIDO 7,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62416","638.702 ANEL BIPARTIDO 7,02","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62418","638.710 ANEL BIPARTIDO 7,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62424","638.742 ANEL BIPARTIDO 7,42","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65414","ANEL 114,40X104,40X24 DES-03275-026","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65412","ANEL 133,40X123,40X24 DES-03275-025","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65410","ANEL 153,40X143,40X24 DES-03275-024","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66612","ANEL 174,40X163,40X24","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66344","ANEL 196,40X185,40X24","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60483","ANEL BAIONETA-75,0X3,0X3,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62409","638.684 ANEL BIPARTIDO 6,84","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.12",true],["","61876","ANEL RETO-60X2,50X2,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60766","ANEL DE PISTAO - VE 692","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65843","PET 349 -  GUIA DA VALVULA DE ENTRADA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65845","PET 351 -  GUIA DA VALVULA DE SAIDA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62410","638.686 ANEL BIPARTIDO 6,86","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60479","ANEL BAIONETA 2X3/16X3/32","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60480","ANEL BAIONETA 3X1/4X1/8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61077","ANEL TRAVA 45X2,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62038","634.682 ANEL BIPARTIDO -6,82","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62095","636.696 ANEL BIPARTIDO -6,96","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62099","636.704 ANEL BIPARTIDO -7,04","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62676","637.710 ANEL BIPARTIDO -7,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62058","635.222 ANEL BIPARTIDO 10,22","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62046","634.698 ANEL BIPARTIDO 6,98","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62089","636.684 ANEL BIPARTIDO 6,84","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65519","ANEL 83320098 D102,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65520","ANEL 83320116 D120,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65521","ANEL 83320135 D139,40","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65522","ANEL 83320155 D158,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61737","ANEL BAIONETA 50X45X2,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62064","635.234 ANEL BIPARTIDO 10,34","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62055","635.216 ANEL BIPARTIDO 10,16","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62465","635224 ANEL BIPARTIDO 10,24","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62061","635228 ANEL BIPARTIDO 10,28","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62040","634.686 ANEL BIPARTIDO 6,86","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62104","636.714 ANEL BIPARTIDO 7,14","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63009","2520-60 ANEL DE SEGMENTO 1.3/4X1/8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66876","ANEL 6X5/16X7/32 CORTE 45","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66877","ANEL 7.1/2X3/8X9X","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65887","ANEL 83320099 D 99","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.22",true],["","65888","ANEL 83320120 D 120","USINAGEM","","COD USINAGEM","COD USINAGEM","0.81","0.26",true],["","62275","CONJ ABRAÇADEIRAS 4´´","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61105","CONJ ABRAÇADEIRAS 5´´","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66864","ANEL RASPA STD 086.009.037 -68,28 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66865","ANEL COMPRESSAO STD 085.009.037 -68,28 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66866","ANEL COMPRESSAO  085.009.038 -68,35 MM 0,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66867","ANEL RASPA 086.009.038 -68,35MM 0,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66868","ANEL RASPA 086.009.039 -68,78 MM 0,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66869","ANEL COMPRESSAO  086.009.039 -68,78 0,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66870","ANEL RASPA STD 086.009.041-74,71MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66871","ANEL COMPRESSAO STD 086.009.041-74,71MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66872","ANEL RASPA  086.009.042-74,95MM 0,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66873","ANEL COMPRESAO  086.009.042-74,95 0,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66874","ANEL RASPA  086.009.043-75,20MM 0,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66875","ANEL COMPRESSAO 085.009.043-75,20MM 0,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60842","ANEL SEGMENTO 7.1/2X3/8X9/32 45 GRAUS","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66878","ANEL SEGMENTO 859-81-9 45 GRAUS","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66879","ANEL SEGMENTO 1-2-72 45 GRAUS","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62466","635.210 ANEL BIPARTIDO-10,26","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62070","635.246 ANEL BIPARTIDO-10,46","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62050","634.706ANEL BIPARTIDO-7,06","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62109","636.724 ANEL BIPARTIDO- 7,24","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63092","ANEL DE  SEGMENTO 2520-270 5.1/4X5/16","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62449","ANEL PISTAO CONF DESENHO 2520-90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62093","636.692 ANEL BIPARTIDO 6,92","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62101","636.708 ANEL BIPARTIDO 7,08","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66446","ANEL RETO 80,00X73,30 ALTURA 2,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66247","P0531200 ANEL BATENTE HASTE DIAM 254","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66249","P0531206 ANEL BATENTE HASTE DIAM 224","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66251","P0531208 ANEL BATENTE HASTE DIAM 194","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66403","P0531250 ANEL BATENTE HASTE DIAM 284","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66401","P0531258 ANEL BATENTE HASTE DIAM 168","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62068","635.242 ANEL BIPARTIDO 10,42","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61600","ANEL 4147.4503.40 D130,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65890","ANEL 83320162 D.162","USINAGEM","","COD USINAGEM","COD USINAGEM","1.11","0.34",true],["","65891","ANEL 83320183 D 183","USINAGEM","","COD USINAGEM","COD USINAGEM","1.22","0.407",true],["","65880","ANEL 83310126 D120","USINAGEM","","COD USINAGEM","COD USINAGEM","0.49","0.14",true],["","65881","ANEL 83310147 D 141","USINAGEM","","COD USINAGEM","COD USINAGEM","0.64","0.2",true],["","65882","ANEL 83310168 D162","USINAGEM","","COD USINAGEM","COD USINAGEM","0.72","0.2",true],["","65883","ANEL 83310189 D 183","USINAGEM","","COD USINAGEM","COD USINAGEM","1.22","0.26",true],["","65884","ANEL 83310214 D 207","USINAGEM","","COD USINAGEM","COD USINAGEM","1","0.31",true],["","65879","ANEL 83310105 D 99","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65871","ANEL 83300099 D 99","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.209",true],["","65873","ANEL 83300141 D 141","USINAGEM","","COD USINAGEM","COD USINAGEM","0.92","0.3",true],["","65874","ANEL 83300162 D 162","USINAGEM","","COD USINAGEM","COD USINAGEM","1.11","0.36",true],["","65876","ANEL 8300207 D 207","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.49",true],["","64067","ANEL PISTON RING DES. 2520-160","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66889","ANEL BATENTE 153,40X143,40X24,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.32",true],["","66890","ANEL BATENTE 174,40X163,40X24,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","1.23","0.4",true],["","66891","ANEL BATENTE 196,40X185,40X24,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","1.37","0",true],["","66892","ANEL BATENTE 219,40X408,40X24,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66619","085.001.123 ANEL COMPRESSÃO  0,20 75,50 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66628","086.001.123 ANEL RASPA 0,20 75,50 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66744","085.005.034 ANEL COMPRESSÃO 0,10 68,45 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66743","086.005.034 ANEL RASPA 0,10 68,45 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63093","2520-240 ANEL DE SEGMENTO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63089","2505-190 ANEL SEGMENTO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66903","ANEL DIAM 181,20XALT 7,90XRAD 7,10 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64372","604.082  ANEL PISTA TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63798","638.696 ANEL BIPARTIDO 6,96","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.12",true],["","62078","635.700 ANEL DO CUBO TRASEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63104","637.740 ANEL BI PARTIDO 7,40","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63730","C 215. 183 R ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65034","PV071133 ANEL COD PV019441","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65321","PV078713 ANEL COD PV072064","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63674","638.700 ANEL BIPARTIDO 7,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.12",true],["","62162","726.701 PORCA DO PILOTO M 60X1,5 ESQ","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63613","704.074 PORCA PONTEIRA CARDAN M 32X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63812","704.040 PORCA MANGA EIXO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62181","741.013 PORCA DO EIXO CARDAN M28X 1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62420","638.718 ANEL BIPARTIDO 7,18","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60758","ANEL PISTÃO CONFORME 2520-549","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66910","ANEL DE SEGMENTO 185,80X150,.0X5,0MM","USINAGEM","","COD USINAGEM","COD USINAGEM","0.86","0.3",true],["","62035","634.676 ANEL BIPARTIDO 6,76","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","64548","637.688 ANEL BIPARTIDO 6,88","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.34",true],["","62047","634.700 ANEL BIPARTIDO 7,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62063","635.232 ANEL BIPARTIDO 10,32","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60828","PISTON RING 1-9-52 BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62413","638.690 ANEL BIPARTIDO 6,90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63700","704.054 PORCA CARDAN","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65872","ANEL 83300120 D.120","USINAGEM","","COD USINAGEM","COD USINAGEM","0.81","0.26",true],["","65875","ANEL 83300183 D.183","USINAGEM","","COD USINAGEM","COD USINAGEM","1.22","0.4",true],["","65889","ANEL 83320141 D.141","USINAGEM","","COD USINAGEM","COD USINAGEM","0.92","0",true],["","64401","PET205 TAMPA CARTER DIANT.PET","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62048","634.702 ANEL BIPARTIDO 7,02","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62036","634.678 ANEL BIPARTIDO 6,78","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65323","PV047827 ANEL COD PV019443","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65324","PV078716 ANEL COD PV019439","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66922","ANEL DE SEGMENTO 90MMX2,5MM ALT. X 3,8MM RAD.","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62357","CONJUNTO ABRAÇADEIRA FIXA 5''","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63811","604.107 ANEL ENCOSTO EMBREAGEM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62102","636.710 ANEL BIPARTIDO 7,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66925","INSERTO SUPERIOR 066167","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66926","LUVA DA SEDE  066086","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62877","010756 ANEL DE PISTÃO DES VV 6018","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62398","638.730 ANEL BIPARTIDO 7,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62527","637.668 ANEL BIPARTIDO 6,68","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66757","151610-0308 N ANEL DE SEGMENTO 50MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66758","151620-0308N ANEL DE SEGMENTO 64 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65035","PV029846 ANEL COD PV019436","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65036","PV071134 ANEL COD PV023293","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65038","PV071136 ANEL COD PV019437","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61602","ANEL 4147.4803.40 D149,80","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62043","634.692 ANEL BIPARTIDO 6,92","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62674","637.678 ANEL BIPARTIDO 6,78","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62677","637.720 ANEL BIPARTIDO 7,20","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61020","11920 ANEL DIAM EXT 115,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61022","13920 ANEL DIAM EXT 135,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61021","12911 ANEL DIAM EXT 120,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66356","HG115 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66178","HG134 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66179","HG153 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62218","HG167 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66936","HG192 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66937","HG219 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66938","HB175 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61590","4137.5705.41/07 ANEL GUIA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61583","4137.4905.41/05 ANEL GUIA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61587","4137.5305.41/06 ANEL GUIA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62029","633.709 ANEL DO CUBO DIANTEIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66955","ANEL SEGTO DIAM 69,85 MM DES 421-220460","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66957","520201.42520.025 ANEL SEGTO EXT 57,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64064","010318 ANEL DE PISTÃO DESEMHO VV-131","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62069","635.244 ANEL BIPARTIDO 10,44","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66962","SEG.4016 ANEL BAIONETA 65X60X4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66963","SEG.4014 ANEL BAIONETA 55X50,60X3,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66964","SEG.4020 ANEL BAIONETA 100X92,80X4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66965","SEG 4021 ANEL BAIONETA 95X87,80X4,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66966","SEG.4018 ANEL BAIONETA 75X69,30X4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66967","SEG.4017 ANEL BAIONETA 60X55,30X4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60691","15508307 ANEL SEGTO41,75X2X1,90 BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60478","15501809 ANEL SEGTO 1X1/8X3/64 45 GR","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","65370","15508390 ANEL  SEGMENTO 59-86504","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63184","012543 ANEL PISTÃO DES. 2520-195","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62878","010155 ANEL PISTÃO DES. 2520-110","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60299","012542 ANEL PISTÃO DES. 20520-152","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66469","83320063 ANEL BATENTE EXT D 67,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66467","83300063 ANEL GUIA D 67,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66468","83310063 ANEL BATENTE INT D 72,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66950","ANEL 100X91X4,5X2,95 MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62397","638.726 ANEL BIPARTIDO 7,26","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63070","637.730 ANEL BIPARTIDO 7,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66953","ANEL AÇO 137,00X128,20X7,90MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66952","ANEL AÇO 160,00X148,20X9,80MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66954","ANEL AÇO 138,00X126,00X6,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61779","PISTON RING 1-6-72","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35571","WNMG080408 - RK MC 5005","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35479","WNMG 080408 MK NC 6315","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35138","CHIPS ABR CERAMICO TRIAN.CHANF 30X30X30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35098","COMPOSTO ANTIOXIDANTE","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35348","MANTA B-145S 700X400MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35656","REBOLO SCG120 QUAD. 10X10X87 TOPBRA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35386","TQJ 27 TT9080 - 0,75 - 0,10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35489","CAPA COM GOLA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35290","OLEO YUSHIRO KEN SS - 370","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35643","OLEO LUBRIFICANTE ANTIGOTEJANTE BR 68 YU","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35645","OLEO LUBRIFICANTE HIDRAULICO OIL MH68 YU","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35311","OLEO DESENGRAXANTE ALCALINO CLEANER W90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","1254","SERRA 80X22X0,8 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","1500","KIT CVS BENEFICIO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35415","CCMT 09T304-C25 NC6010","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35572","WNMG 080404 - MA MC 5015","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35425","PASTILHA HNPJ0905ANSNHDKCPK30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60490","75MM ANEL 75X2,5X2,5MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66970","ANEL 293807/186.581 DIAM EXT 38,07","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66972","ANEL BATENTE 243,40X232,40X24,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66971","LUVA SLEEVE DESENHO NR 21","USINAGEM","","COD USINAGEM","COD USINAGEM","1.57","0",true],["","66978","SEG. 4025 ANEL BAIONETA 111,50X120X5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66979","SEG. 4030 ANEL BAIONETA 64,60X70X4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35639","OLEO PROTETIVO P-345","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35456","INCERTO METAL DURO IMP PENTA 34N200C020","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61199","ROLO DE APOIO MEDIO FUNDIDO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62239","429 ANEL SEGMENTO 32,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63525","693 ANEL SEGMENTO 27,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62071","635.248 ANEL BIPARTIDO 10,48","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62042","634.690 ANEL BIPARTIDO 6,90","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62044","634.694 ANEL BIPARTIDO 6,94","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62111","636.726 ANEL BIPARTIDO 7,26","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62408","638.682 ANEL BIPARTIDO 6,82","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62415","638.698 ANEL BIPARTIDO 6,98","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62417","638.706 ANEL BIPARTIDO 7,06","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62421","638.722 ANEL BIPARTIDO 7,22","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62903","637.672 ANEL BIPARTIDO 6,72","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35423","CCMT 09T304-MP NC6315","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35338","XNKT 060408 PNER-ML PC5300","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35448","PASTILHA BEDAME PENTA 24N200J020 IC908","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35362","WNMG 080404 HM - NC 6215","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35531","MACHO INTERCAMBIAVEL T820M080","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66987","SEG 4028 ANEL BAIONETA 82,80X90X4,5 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66988","SEG.4022 ANEL BAIONETA 130,60X140X4","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66989","ANEL TEREX 110X100,8X3MM DUOLOP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66990","ANEL TEREX 110X102,3X6,32MM DUOLOP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35682","PASTILHA LNPU110408SRGE","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","1487","KIT CVS BENEFICIO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66992","VC654355 ANEL TRAVA 30,0X1,20X2,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","35631","BROCA B966A06800KC7315 KENNA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","1857","CX. PAP. ONDULADO 245 X 105 X 210","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35527","WNMG 080412 MW UC5105","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","537","TDC 2 TT 9030","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","6003119","penta 24n200J020 IC1008","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61925","634.688 ANEL BIPARTIDO 6,88","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35397","PASTILHA BEDAME PENTA 24N100J0006 IC1008","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66991","5659201 ANEL BAIONETA 110X100,8X3MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60733","1675 CABEÇOTE COMPRESSOR 94 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60560","1075 CABEÇOTE COMPRESSOR 77 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61760","1676 CILINDRO COMPRESSOR 94 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63001","c 220.079 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67001","ANEL TEREX 120X110X3 MM DUOLAP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67002","ANEL TEREX 120X111,60XX6,35 MM DUOLAP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67003","ANEL TEREX 130X119,40X4MM DUOLAP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67004","ANEL TEREX 130X121,10X6,30MM DUOLAP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62904","637.736 ANEL BIPARTIDO 7,36","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62414","638.694 ANEL BIPARTIDO 6,94","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67006","VC601105 ANAEL TRAVA 38,00X1,45X2,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67009","SEG.4023 ANEL BAIONETA 1,40X45X3 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67010","SEG.4024 ANEL BAIONETA 46X50X3,50 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67011","SEG.4027 ANEL BAIONETA  121X130X6 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67012","SEG.4029 ANEL BAIONETA 168X180X7 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62487","C 209.560 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62437","C 215.183 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62901","C 222.104 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62438","C 223.085 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62486","C 224.771 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63004","C 224.771 ANEL 0,20MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63003","C 224.771 ANEL 0,40MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60841","15500969 PISTON RING 1.3/4''X1/8''X5/64'' B","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67031","SEG. 4034 ANEL BAIONETA 262X280X9","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66829","ANEL BAIONETA 7''X6.3/8''X8,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67040","ANEL SEGMENTO 51X55X1,5MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67051","ANEL DIAM.EXT.58,70 C/BANHO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67054","VV-11154 ANEL PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67053","VV-11155 ANEL PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65362","HG173 ANEL DIAM 173X18,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67058","ANEL DIAM 903X842X14MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67056","ANEL 80,00X73,00X3,00MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67057","ANEL 90,00X82,20X3,00MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63006","C 209.387 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65322","PV078715 ANEL COD.PV068810","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67059","ANEL TRAVA CAMBIO REF 01071333 D.104,77B","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63855","704.071 PORCA PINHÃO DIFER.MODERNA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64115","505.125 ANEL PL84","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62164","732.027 PORCA CASTELO TRUCK M39X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62166","732.071 PORCA CASTELO ESTAB M28X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63498","604.035 ANEL ESPAÇADOR PINHÃO 15,50M","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63859","604.078 ANEL PISTA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63809","604.081 PORCA REGULAGEM LATERAL COROA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63914","605.115 ANEL ENCOSTO DA EMBRAGEM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62005","603.021 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62028","632.708 ANEL EXTERNO TRUCK","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62462","632.707 ANEL INTERNO TRUCK","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62030","633.710 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62032","633.712 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62165","PORCA CASTELO ESTAB M30X1,5M","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62031","633.711 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62033","633.713  ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62085","635.718 ANEL DO CUBO RANDON","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62086","635.719 ANEL DO CUBO DA CARRETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66019","702.004 PORCA SEXTAVADA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63862","702.011 PORCA SEXTAVADA EIXO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62158","641.030 LUVA CARDAM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62157","641.004 LUVA DO CARDAM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63608","704.068 PORCA MANGA EIXO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62463","603.002 ANEL DO VIRABREQUIM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62175","735.706 PORCA DA COROA M65X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62160","726.056 PORCA DO ENTALHADO M24X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67060","ANEL SEGMENTO 62,90X57,70X2,50 TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62163","726.800 PORCA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62182","742.700 PORCA FREIO DE MÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62169","735.142 PORCA DE REGULAGEM DA COROA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62179","735.713 PORCA DA CARCAÇA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62177","735.708 PORCA DA CARCAÇA M52X1,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62174","735.705 PORCA DA CARCAÇA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62183","746.012 PORCA CASTELO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62184","746.029 PORCA CASTELO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64099","GUARNICAO 5''","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62238","C .221.653","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63057","C 222.079","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63002","C 223.570","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62485","C 208.745","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60843","C 209.304","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61887","C 209.791","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","60484","C 211.616","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64053","C 217.361","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63000","C 217.411","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64049","C 222.209","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63333","C 224.281","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64437","C 234.076","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62999","C 215.183 A","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67064","5659101 ANEL BAIONETA 110X101X4,OMM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66298","ANEL BAIONETA 130X120XALT15,15","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67068","VC060932 ANEL TRAVA 34,89X1,70X2,35MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67067","VC1069474 ANEL TRAVA 50X1,80X2,50MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67069","ANEL 70,00X66,00X3,40 ALTURA TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67070","ANEL DIAM 50MM (RBS 46)","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67071","ANEL DIAM 65MM (RBS 55)","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67072","ANEL DIAM 75MM (RBS 86)","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67073","ANEL DE SEGTO DIAM 70X2,50MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67075","ANEL DIAM 99,50MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67074","ANEL SEGTO BAIONEETA 333X355X11","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62419","638.714 ANEL BIPARTIDO 7,14","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","66576","181975 ANEL GUIA BI-PARTIDO DES7962-49","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67084","ANEL BAIONETA 128X3,5X5,3 BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63919","ROLO DE APOIO MEDIO ABAULADO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61598","4147.4203.40 ANEL BATENTE","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67087","ANEL SEGTO.36,4MM COD.2748","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67088","ANEL SEGTO DIAM.40,4MM COD.2824","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67089","ANEL SEGTO DIAM.44MM COD.2823","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67090","ANEL SEGTO DIAM 47,3MM COD.2746","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67091","ANEL SEGTO DIAM.56,4MM COD.2746","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67092","ANEL SEGTO DIAM.76,20MM COD.2702","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67093","ANEL SEGTO DIAM.85,72MM COD.2747","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35503","WNMG 080404 GN IC5010","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35495","WNMG 080408 - GNIC5010 METAL DURO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67096","ANEL RASPADOR 4620291 DUALAP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62634","C 2.796.491 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67094","CJ.03 ANEIS 220MM STD (OLEO/RASPA/COMP)","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67095","CJ.03 ANEIS 220MM 0,50 (OLEO/RASPA/COMP)","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","DIVERSOS","PEÇAS DIVERSAS","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67100","SEG.4000 ANEL BAIONETA 63,80X70X2,5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67101","SEG.4035 ANEL BAIONETA 167,70X182,70X3","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67102","SEG.4036 ANEL BAIONETA 182,60X190X3,50","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67106","ANEL SEGTO EXT 52X INT 48 X 1,98MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35678","FRESA DE TOPO 4CH0600MR016A KC633M","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67111","ANEL SEGTO 32X29X1,5MM ALTURA RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67112","ANEL 220X211X4,5MM BAIONETA DES4B120","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67117","ANEL DE SEGTO 45,05MM COD.3846","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67118","ANEL DE SEGTO 60MM COD.1900","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67121","ANEL SEGTO 46X1,90X2,50MM TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67122","ANEL SEGTO 55X1,90X2,50MM TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67123","ANEL SEGTO 60X1,90X2,50MM TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62649","010517 ANEL PISTÃO DES.VV-4230","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67127","15500896 PISTON RING 2530-131 BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67137","SEG.4015 ANEL BAIONETA 102X110X5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67139","12508055 ANEL 1.1/2''X3/16''X1/16 BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63012","2520-40 ANEL 1.1/2X1/8","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67143","PISTON RING DES. K 00 022 575 2","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67144","40356074 ORING DIAM 34,98 TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67145","40029193 ANEL O-RING DIAM 25,13 TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67124","ANEL RASPADOR COD CF 988058","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61606","4147.5404.40/06 ANEL BATENTE D.201,30","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67153","ANEL 260X251X4,9 ALT DES4B669","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67151","ANEL 120X111X2,9 ALT DES4B012","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67152","ANEL 170X161X2,9 ALT DES4B051","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61782","561012.42520.025 ANEL SEGMENTO 858-114-2","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","64098","GUARNOÇÃO 4'' CALIFORNIA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67150","ANEL 30,25X26,25X2,2 TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67154","ANEL 40,40X36,40X2,75 ALT TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66985","ANEL EVO CF T6 196,10X189,65X34,03MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66986","ANEL EVO JC T6 243,70X196,16X3,17MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67168","ANEL 270X253,60X6MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67169","ANEL 215X198,60X5MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67170","SEG.4026 ANEL BAIONETA 176X190X7","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67171","SEG.4019 ANEL BAIONETA 158X170X6","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67181","ANEL SEGTO 51X55X3,95MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67182","ANEL SEGTO 58,50X63,90X4,45MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67188","ANEL SEGTO TRAVA 65,05 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67183","ANEL SEGTO 20,50X18,70X1,59 MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66606","ANEL TRAVA 35,02 X 2,40 X 1,60 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67189","CJ.03 ANEIS 230 STD (1-OLEO/2-COMP) BR400","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67190","CJ.03 ANEIS 230 0,50 (1-OLEO/2-COMP) BR400","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67191","12508128 ANEL 4X1/4''X3/16'' BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67192","12508136 ANEL 4.1/2'' X3/16'' X 5/32'' CORTE 45°","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62045","634.696 ANEL BIPARTIDO 6,96","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67207","SER109 USINAGEM C/CANAL PET043R","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67208","ANEL SEGTO 90X83X6MM ALTURA BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67209","ANEL VEDAÇÃO EXTRATORES 63,5MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67210","ANEL VEDAÇÃO EXTRATORES 35MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","62440","G 130 ANEL D3007","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67227","ANEL CAMISA 155X149X12MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67228","ANEL CAMISA 156X148X12MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67231","AM000075 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67232","AM000076 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","62448","ANEL PISTÃO DES. 2520-260","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67240","CJ.03 ANEIS 220 STD(1-OLEO/2 COMP) BR300","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67241","CJ.03 ANEIS 220 0,50(1-OLEO/2 COMP) BR300","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67243","ANEL 20,20X18,40X 1,58MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67244","ANEL DIAM.1003X951X19MM BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35777","BEDAME PENTA 17N075P000LS IC 1008+TIXCO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67249","0580550-2 ANEL VEDAÇÃO C/FURO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35763","PASTILHA CERAMICA SPHX1205PCTRGPBK KY350","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35770","CCMT09T304F K10P","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35545","PASTILHA BEDAME PENTA 24N080J000 IC908","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35235","TPMC 43 NV60 SW350","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35404","CCMT 120408 MT TT 5080 2024","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35472","TDC 4 TT8020","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35097","COMPOSTO LIQ GV100 P/ REB E LIMP","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35586","WNMG 080408 MW KCK 15B","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61811","830501000 ANEL DE PISTÃO AM 501-83","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0.0014",true],["","67257","ANEL 95X87X3,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67258","ANEL 95X88,4X4,50 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66983","ANEL EVO CF T3 140,35X135,85X17,27MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","66984","ANEL EVO JC T3 169,80X140,45X5,00MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67134","013497 ANEL PISTÃO PISTÃO DES. 48-60606","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67259","ANEL 45X2X2MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35301","WGE 20 GH 730","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","65437","ROLO DE APOIO MEDIO / FUNDIDO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35474","PASTILHA DE METAL DURO IMPORTA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67267","ANEL SEGTO 24,2X28X1,6MM RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35814","TPMT 160308 IC830","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67266","ANEL SEGTO 110X101X4MM CORTE 45","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67268","ANEL 185X176X2,9 ALT DES.B045","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67273","T-91 TAMPA USINADA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67274","ANEL CAMISA 155,50X149,00X12,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67280","ANEL CAMISA 155,80X149,00X12,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67281","ANEL CAMISA 45,60X40X28,00 MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35377","SNMG 120404 NC 6215","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67290","SEG.4038 ANEL BAIONETA 300X320X10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67292","HG169 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","61466","12508144 ANEL SEGMENTO 5X1/4X3/16","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67296","ANEL BAIONETA 58,50X52,60X3MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67298","ANEL RETO 52 X 47,30 X 3,00","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67300","ANEL 40 X 37,20 X 2,50 ALT TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67301","ANEL 45 X 41,80 X 2,50 ALT TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63005","586.857 ANEL","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63682","G 228 ANEL D.5253","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67313","AN02- ANEL RASPADOR DO PISTÃO 46X2X2","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67324","ANEL DE SEGTO 46,5X42,5X2,5MM TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67325","ANEL DE SEGTO 58,3X54,3X2,5MM TRAVA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67314","TP-07 TAMPA ABERTO P/M535D DE.5750003088","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67315","TP-07 TAMPA FECHADO P/M535D DE.5750003089","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67316","TP-07 TAMPA ABERTO P/M535B DE.5750003855","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67317","TP-90 TAMPA FECHADA USINADO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67318","MC-535D MANCAL FECHADO USINADO","USINAGEM","","COD USINAGEM","COD USINAGEM","1.82","0",true],["","67319","MC-535D MANCAL ABERTO USINADO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67321","RD-06 ROLDANA DIAM.INTERNO 1.1/4 USINADO","USINAGEM","",2.1075,"8.43","6.8","0",true],["","67322","PNI-535 PANELA USINADO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67323","TP-21 TAMPA USINADO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67303","ANEL 53,96X49,26X3,00 ALT BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67326","ANEL 75X68,60X3,00MM ALTURA RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67329","ANEL SEGTO 35X32X2MM ALTURA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67330","ANEL SEGTO 40X37X2MM ALTURA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67331","ANEL SEGTO 75,00 X 69,00 X 2,50 ALT. RETO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67333","DB103-0535 P300-ANEL P/PISTÃO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67334","ANEL BAIONETA 163X151X10 (USR-13841)","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67338","ANEL 75,00X3,00X3,00 MM BAIONETA","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67341","ABERT.CIL.P/ ENCAMISAR + USIN. C/CANAL-043","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67342","ABERT.CIL.P/ ENCAMISAR + USIN. S/CANAL-043","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67343","SER109 USINAGEM S/CANAL PET043R","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67348","DES.931-142 ANEL SEGMENTO 30,0MM","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67350","CAMISA P/ENCAMISAR+ US.C/CANAL-016 P/043","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67351","CAMISA P/ENCAMISAR+ US.S/CANAL-016 P/043","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","43","PROTETOR AURICULAR EM SILICONE","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35819","LUVA NITRILICA KALIPSO CA 50279","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","52","OCULOS INCOLOR TIPO LEOPARDO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67359","DB102-0535 P200-ANEL P/PISTÃO BAIONETA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","35687","PASTILHA METAL DURO A4G0305M03U04GMN-KC5","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","6","PANOS PARA FABRICA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","7","PRODUTOS DE HIGIENE","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","1910","CX. PAX. TRIPLEX IGARATIBA RECICLADA","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35376","WNMG 080408 HM NC 6215","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67362","ANEL 59,60X55,40X3,00 ALT TRAVA","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","35837","OLEO KEN FGS- 660 - YUSHIRO","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67360","CAMISA CILINDRO DIAM.EXT.91 PCC251011000","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67361","CAMISA CILINDRO DIAM.EXT.89,50 PCC251012000","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","1906","CX. PAP. ONDULADO 260X260X160","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67374","PET043R CILINDRO 2.1/2 REVISADO","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67376","ANEL 38,10X35,10X3,20 ALT BAIONETA","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67339","BUCHA FUNDIDA E USINADA (XICRINHA)","USINAGEM","GGG50","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","60539","ANEL BAIONETA 2520-195","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67377","SEG.4012 ANEL BAIONETA 100,80X110,00X3,00","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67381","USINAGEM S/CANAL PET016 P/PET043R","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67383","CJ.04 ANÉIS FIAM.122 (COMP/RASPA/2 ÓLEO)","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","63007","586.857 ANEL","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67384","ANEL OLEO 120,10X112,70X5,10 ALT. RETO","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67385","ANEL OLEO 120,10X111,90X5,10 ALT. RETO","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61581","4137.4605.41/04 ANEL GUIA D. 145,87","USINAGEM","FC300","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67378","CORPO FUNDIDO (TIBURCIO)","USINAGEM","GGG40",3.735,"14.94","10.56","SEM PESO",true],["","67386","PET043 R-2 CAMISA 2.1/2 USINAGEM S/CANAL","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","10.98",true],["","66536","CONJUNTO ABRAÇADEIRAS 4'' ENPASA","USINAGEM","GGG40","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","61488","RODA P/ DESLIZANTE C/ FURO","FUNDIÇÃO","","8.64","8.64","7.6","SEM PESO",true],["","61187","ROLO DE APOIO MAIOR","FUNDIÇÃO","","","33.28","28.7","SEM PESO",true],["","65855","LINGUETA ESQUERDA FC SL 20.147","FUNDIÇÃO","","","3.98","2.31","SEM PESO",true],["","65854","LINGUETA DIREITA 20.146","FUNDIÇÃO","","","3.98","2.31","SEM PESO",true],["","65856","LINGUETA DIREITA FC SP 20.144","FUNDIÇÃO","","","3.98","2.31","SEM PESO",true],["","65857","LINGUETA ESQUERDA FC SP 20.145","FUNDIÇÃO","","","3.98","2.31","SEM PESO",true],["","65930","ROLO DE APOIO MEDIO","FUNDIÇÃO","",25.86,"25.86","21.12","0",true],["","63604","POLIA C-102","FUNDIÇÃO","",1.708333333,"10.25","1.4","0",true],["","63997","BUCHA DO CABEÇOTE 2216/18","FUNDIÇÃO","","","7.09","5.6","SEM PESO",true],["","64486","MANCAL MC-6207","FUNDIÇÃO","",2.045,"8.18","5.66","SEM PESO",true],["","64233","BASE DO SUPORTE","FUNDIÇÃO","","","23.44","18.2","SEM PESO",true],["","62598","MANCAL MC-535","FUNDIÇÃO","",2.945,"11.78","4.8","SEM PESO",true],["","63868","SAPATA TEM 652","FUNDIÇÃO","","","16.55","13.5","SEM PESO",true],["","65540","PESO INERCIAL A40 189-092-0-2","FUNDIÇÃO","",17.52,"17.52","12.8","0",true],["","66338","ESPAÇADOR 144-13012 22602712","FUNDIÇÃO","","","15.54","8.54","SEM PESO",true],["","65268","BUCHA SOP D153","FUNDIÇÃO","",2.345,"4.69","2","SEM PESO",true],["","66355","ESPAÇADOR FUNDIDO 23K.201.104A","FUNDIÇÃO","","","98","20","SEM PESO",true],["","63664","PLACA MIL 45","FUNDIÇÃO","","","5.6","1.4","SEM PESO",true],["","65182","TUBULAR OEF 10261","FUNDIÇÃO","","","11.7","7.35","SEM PESO",true],["","63814","PLACA MIL71","FUNDIÇÃO","","","3.3","1.92","SEM PESO",true],["","61667","CUBO 05","FUNDIÇÃO","","","11.76","8","SEM PESO",true],["","62445","TAMPÃO SEXTAVADO PET 096","FUNDIÇÃO","",1.891666667,"11.35","1.9","0",true],["","65664","PLATO N. 3","FUNDIÇÃO","","","8.48","6.7","SEM PESO",true],["","65946","TAMPA ROL VIMOT E-11 224-005-0-2","FUNDIÇÃO","","","9.24","9.26","SEM PESO",true],["","62941","MANCAL 7515","FUNDIÇÃO","","2.6","10.4","6.64","SEM PESO",true],["","63576","PLACA MIL 67","FUNDIÇÃO","","","4.42","2.2395","SEM PESO",true],["","62342","CUBO BRUTO 650","FUNDIÇÃO","","","11.28","6.4","SEM PESO",true],["","63920","PLACA MIL 83","FUNDIÇÃO","","","1.44","1.2","SEM PESO",true],["","63429","BUCHA MIL 80 X 60 MM","FUNDIÇÃO","","","11.16","7.6","SEM PESO",true],["","63650","CABEÇOTE NOVO AP PET 141","FUNDIÇÃO","",30.98,"30.98","25.96","24.1",true],["","65721","BALL RACE LOWER 444-8523","FUNDIÇÃO","","","16.23","14.3","SEM PESO",true],["","63625","PLACA MIL 60","FUNDIÇÃO","",0.33,"1.32","0.68","SEM PESO",true],["","65786","MANCAL P/ VIMOT A41 222-007-0-1","FUNDIÇÃO","","","35.68","27.75","SEM PESO",true],["","62900","BASE DO ESTICADOR RE 4I-031122","FUNDIÇÃO","","","5.76","4","SEM PESO",true],["","62255","DISCO PB150 MPO 74115","FUNDIÇÃO","","","4.86","3.4","SEM PESO",true],["","62792","CUNHA","FUNDIÇÃO","","","8","5.75","SEM PESO",true],["","61663","CUBO 01","FUNDIÇÃO","","","14.46","10.8","SEM PESO",true],["","62599","MANCAL MC-535D","FUNDIÇÃO","",2.475,"9.9","1.82","SEM PESO",true],["","62701","TAMPA CABEÇOTE DUPLO PET 072","FUNDIÇÃO","","","13","10.47","SEM PESO",true],["","63555","SUPORTE TCI PTM-0201-E064","FUNDIÇÃO","","","19.72","16.9","SEM PESO",true],["","63166","CORPO MD250 MPO 74110","FUNDIÇÃO","","","8.6","6","SEM PESO",true],["","64045","POLIA 162 C/ FURO","FUNDIÇÃO","",4.38,"8.76","3.34","0",true],["","63995","POLIA 162 C/ FURO P/ ROLAMENTO","FUNDIÇÃO","",4.235,"8.47","7.28","0",true],["","63796","BUCHA DO ROLO MENOR","FUNDIÇÃO","",2.23,"8.92","7.2","SEM PESO",true],["","61205","ROLO DE APOIO MENOR","FUNDIÇÃO","","","26","18.7","SEM PESO",true],["","62330","ESTICADOR 225219","FUNDIÇÃO","",0.708,"7.08","5.4","SEM PESO",true],["","61664","CUBO 02","FUNDIÇÃO","","","15.3","10.43","SEM PESO",true],["","63439","DISCO IR-023","FUNDIÇÃO","","","3.6","2.6","SEM PESO",true],["","63270","CABEÇOTE VÁLVULA AP PET 046","FUNDIÇÃO","","9.12","18.24","17.32","0",true],["","65696","DISCO MEGA KART MAIOR NOVO TRAZEIRO","FUNDIÇÃO","","","2.82","1.78","SEM PESO",true],["","63358","PLATOR N.10","FUNDIÇÃO","","","7.82","7.28","SEM PESO",true],["","61670","CUBO 10 CONF. MOD.","FUNDIÇÃO","",1.005,"8.04","5.1188","SEM PESO",true],["","65509","FERRO FUNDIDO 444-8527-A","FUNDIÇÃO","","","34.8","18.92","SEM PESO",true],["","63385","PLATOR N 0 27-1-11","FUNDIÇÃO","","","5","3","SEM PESO",true],["","62717","BIELA INTERMEDIARIA","FUNDIÇÃO","","","3.54","2.76","SEM PESO",true],["","62653","BIELA INTERMEDIARIA PET 103","FUNDIÇÃO","",0.81125,"6.49","2.76","SEM PESO",true],["","62600","TAMPA TP-07","FUNDIÇÃO","",0.943703704,"7.28","4.8","SEM PESO",true],["","63557","CAMISA TCI PTM 0201-B020","FUNDIÇÃO","","","9.46","7.61","SEM PESO",true],["","63465","ALAVANCA 4\"","FUNDIÇÃO","",1.22,"4.88","2.62","SEM PESO",true],["","62940","MANCAL M-80","FUNDIÇÃO","",2.55,"5.1","3.67","SEM PESO",true],["","66320","ADAPTER 878-24","FUNDIÇÃO","","","12.22","9.28","SEM PESO",true],["","64582","PORCA T","FUNDIÇÃO","","","4.08","2.03","SEM PESO",true],["","62578","MESA TCI PTM 0201-C033","FUNDIÇÃO","","","119","110","SEM PESO",true],["","66122","CARRO MH-2","FUNDIÇÃO","","","13.04","9.93","SEM PESO",true],["","65852","CASTANHA RD 20.083","FUNDIÇÃO","","","3.39","1.8","SEM PESO",true],["","64360","TAMPA TRASEIRA PET 190","FUNDIÇÃO","","","9.62","6.2","SEM PESO",true],["","66120","CORPO MH-2","FUNDIÇÃO","","","45.42","37.95","SEM PESO",true],["","65966","MANCAL GARRA SUPERIOR 827-4-7","FUNDIÇÃO","","","6.5","4.9","SEM PESO",true],["","65978","BUCHA COR D124","FUNDIÇÃO","","3.065","6.13","4.54","SEM PESO",true],["","65983","BUCHA COR D131","FUNDIÇÃO","","2.66","5.32","3.96","SEM PESO",true],["","65849","ENGATE DA LINGUETA FC SP 20.148","FUNDIÇÃO","","","6.68","4.4","SEM PESO",true],["","61675","CUBO 18","FUNDIÇÃO","","","6.69","4.2","SEM PESO",true],["","62544","BASE FF36090100A","FUNDIÇÃO","",5.49,"10.98","9.6","SEM PESO",true],["","65639","TERMINAL PADRÃO MAIOR 0-02 03","FUNDIÇÃO","","","9.36","7.118","SEM PESO",true],["","63536","CORPO 56 C 4N-9508672","FUNDIÇÃO","","","64.49","55","SEM PESO",true],["","65593","MANCAL ACION. WA 3000 192-024-0-3","FUNDIÇÃO","","","78.3","63.76","SEM PESO",true],["","65792","ANEL FOFO 930 MM","FUNDIÇÃO","","","262","237.8","SEM PESO",true],["","65948","BUCHA COR D102","FUNDIÇÃO","",2.365,"9.46","0.57","SEM PESO",true],["","62208","DISCO PCA150 MPO 74100","FUNDIÇÃO","",2.84,"5.68","4.44","SEM PESO",true],["","65850","ENGATE DA LINGUETA FC SL 20.149","FUNDIÇÃO","","","5.78","4.1","SEM PESO",true],["","64202","BUCHA MIL NR 72 ( 120 X 100 MM )","FUNDIÇÃO","","","11.6","9.6","SEM PESO",true],["","62292","MANCAL MC-90B","FUNDIÇÃO","","","4.24","2.31","SEM PESO",true],["","62597","MANCAL M-760 FECHADO","FUNDIÇÃO","",6.36,"12.72","10.6","SEM PESO",true],["","61016","PERNA (MENOR) BR21620002-11","FUNDIÇÃO","","2","8","5.2","SEM PESO",true],["","65258","PLACA MIL 94","FUNDIÇÃO","","","4.88","3.6","SEM PESO",true],["","62259","BUCHA FUNDIDA E USINADA","FUNDIÇÃO","","","4.88","3.6","SEM PESO",true],["","63658","BUCHA 65X50","FUNDIÇÃO","","","9.58","7.2","SEM PESO",true],["","62842","CAMISA 73 MM  PET 016","FUNDIÇÃO","",15.3,"15.3","13.2","10.9",true],["","62828","PISTÃO 73 MM PET 023","FUNDIÇÃO","","3.09","6.18","3.8","SEM PESO",true],["","65896","GUIA DA VÁLVULA PET 348/349","FUNDIÇÃO","","","9.84","5.4","SEM PESO",true],["","65395","BUCHA SOP D96","FUNDIÇÃO","","","5.7","4.55","SEM PESO",true],["","65949","BUCHA COR D120","FUNDIÇÃO","",2.57,"5.14","3.65","SEM PESO",true],["","65497","MANCAL P/ VIMOT S21 198-062-0-1","FUNDIÇÃO","","","25.28","17.11","SEM PESO",true],["","64461","TAMPA CARTER PET 205","FUNDIÇÃO","","","7.22","6.61","SEM PESO",true],["","63516","MORSA TCI PTM-0201-D047","FUNDIÇÃO","","","10.52","8.72","SEM PESO",true],["","62830","PISTÃO AP PET 088F 2.1/2","FUNDIÇÃO","","","12.06","11.51","SEM PESO",true],["","63751","BUCHA MIL 54 X 40","FUNDIÇÃO","",2.0,"8","3.2","SEM PESO",true],["","65640","TERMINAL PADRÃO MENOR 0-02 01","FUNDIÇÃO","","","8.52","6.4","SEM PESO",true],["","65661","POLIA EMBREAGEM FAPINHA","FUNDIÇÃO","",4.37,"8.74","6.12","0",true],["","66191","POLIA EMBR. FAPINHA CANAL B","FUNDIÇÃO","",4.37,"8.74","6.12","1.42",true],["","61672","CUBO 13","FUNDIÇÃO","","","7.98","4.2","SEM PESO",true],["","64061","TAMPA TP-15","FUNDIÇÃO","","","5.92","4.57","SEM PESO",true],["","65692","DISCO PBL - 20E MPO 74262","FUNDIÇÃO","","","9.16","7.1","SEM PESO",true],["","63425","PLACA MIL 36","FUNDIÇÃO","","","4.2","1.68","SEM PESO",true],["","66353","DISCO DE FREIO","FUNDIÇÃO","","","54.6","45.4","SEM PESO",true],["","60569","TAMPA PU DES. 999.046","FUNDIÇÃO","","","7.48","4.52","SEM PESO",true],["","62491","TAMPA TP-90","FUNDIÇÃO","","3.9","3.9","2.8","SEM PESO",true],["","65499","TAMPA CX LIG VIMOT S21 198-069-0-4","FUNDIÇÃO","","1.32375","10.59","8.24","0.92",true],["","65294","BUCHA SOP D115","FUNDIÇÃO","",1.75,"7","5.75","SEM PESO",true],["","63388","FLANGE CY4","FUNDIÇÃO","",0.69,"5.52","3.359","0",true],["","64392","BUCHA MIL 22X13X132 WABCO","FUNDIÇÃO","","","3.22","2","SEM PESO",true],["","65979","BUCHA COR D146","FUNDIÇÃO","",3.98,"7.96","5.52","SEM PESO",true],["","65984","BUCHA COR D152","FUNDIÇÃO","",3.305,"6.61","2.62","SEM PESO",true],["","64433","CABEÇOTE AP BOOSTER PET 192","FUNDIÇÃO","","","16.83","11.9","SEM PESO",true],["","63752","BUCHA MIL 47 X 35","FUNDIÇÃO","","","7.8","5.2","SEM PESO",true],["","63760","PLACA MIL 28","FUNDIÇÃO","","","5.89","3.35","SEM PESO",true],["","64206","RODA P/ DESLIZANTE C/ PINO","FUNDIÇÃO","","","11.82","9.2","SEM PESO",true],["","62821","PLACA INBRAS 3I-000158","FUNDIÇÃO","",1.335,"2.67","1.43","SEM PESO",true],["","65950","BUCHA COR D139","FUNDIÇÃO","",2.975,"5.95","4.72","SEM PESO",true],["","63704","PLACA MIL 5","FUNDIÇÃO","","","5.29","3.11","SEM PESO",true],["","62934","TAMPA TP-753 ABERTO","FUNDIÇÃO","","","6.86","5.83","SEM PESO",true],["","63300","BUCHA MAIOR FUNDIDA D256C/D209C","FUNDIÇÃO","","","10.2","7.8","SEM PESO",true],["","66316","PEÇA 42800","FUNDIÇÃO","","","13.8","10.7","SEM PESO",true],["","61680","PERNA BR2162000-10","FUNDIÇÃO","","2.73","8.19","4.5","SEM PESO",true],["","65980","BUCHA COR D167","FUNDIÇÃO","",4.37,"8.74","6.63","SEM PESO",true],["","63476","CORPO 15A 4N-713688","FUNDIÇÃO","",8.41,"8.41","5.95","SEM PESO",true],["","65275","BUCHA SOP D134","FUNDIÇÃO","",2.095,"4.19","1.7","SEM PESO",true],["","64591","PLACA 04 8BK","FUNDIÇÃO","","","6.56","4.95","SEM PESO",true],["","62596","MANCAL M-760 ABERTO","FUNDIÇÃO","","","11.14","9.47","SEM PESO",true],["","65895","SEDE DA VÁLVULA PET 351","FUNDIÇÃO","","","6.33","3.6","SEM PESO",true],["","64305","CARTER PET 159 ( 3 CILINDROS )","FUNDIÇÃO","",51.0,"51","38","35",true],["","62935","TAMPA TP-753 FECHADO","FUNDIÇÃO","","","7.2","5.3","SEM PESO",true],["","63428","PLACA MIL 3","FUNDIÇÃO","","","7.56","1","SEM PESO",true],["","64254","BUCHA MIL 330 X 295","FUNDIÇÃO","","","32.6","23","SEM PESO",true],["","65787","TAMPA P/ ROL A41 222-008-0-3","FUNDIÇÃO","","","7.16","5.9","SEM PESO",true],["","65439","CHAPINHA RÁPIDA 5.1/2","FUNDIÇÃO","","","4.49","2.57","SEM PESO",true],["","60174","CUBO 08","FUNDIÇÃO","","1.15125","9.21","5.91","SEM PESO",true],["","65726","SUPORTE GUIA 444-8501","FUNDIÇÃO","","","9.85","8.47","SEM PESO",true],["","62490","TAMPA TP-21","FUNDIÇÃO","",5.28,"5.28","4.24","SEM PESO",true],["","65566","CONTRA MOLDE N. 5","FUNDIÇÃO","","","12.18","9.52","SEM PESO",true],["","61904","VERARDI SHELL NR6","FUNDIÇÃO","","","3.64","2.039","SEM PESO",true],["","66062","CARCAÇA 1342761192GO","FUNDIÇÃO","","","27.8","18.7","SEM PESO",true],["","64117","BUCHA 90X70","FUNDIÇÃO","","","11","6.6","SEM PESO",true],["","66350","ROTOR TURISTICA FUNDIDO","FUNDIÇÃO","","","2.2","1.1","SEM PESO",true],["","65415","MANCAL MOTOR HIDRAULIC MC-900","FUNDIÇÃO","","","5.4","3.51","SEM PESO",true],["","63433","BUCHA MIL 85 X 70 MM","FUNDIÇÃO","","","12.1","5.4","SEM PESO",true],["","66276","SUPORTE FUNDIDO 23B.253.319.K","FUNDIÇÃO","","","28.08","21.95","SEM PESO",true],["","65479","CAMISA BP 3CDC TR040","FUNDIÇÃO","","","39.6","34.2","SEM PESO",true],["","65777","LINGUETA ESQUERDA 20.056","FUNDIÇÃO","","","4.54","3","SEM PESO",true],["","64274","BERÇO 3\" DES. 018.040","FUNDIÇÃO","","","11.2","7.1","SEM PESO",true],["","62212","DISCO ALETADO MD350 MPO 74109","FUNDIÇÃO","","24.09","24.09","20.22","SEM PESO",true],["","65600","CORPO VÁLVULA FUNDO LINHA 3X2","FUNDIÇÃO","",13.64,"13.64","11.6","SEM PESO",true],["","64234","APOIO DAS MOLAS CVI001.01.00.02","FUNDIÇÃO","","","5.8","4.23","SEM PESO",true],["","62898","CAMISA 4.3/4 QUADRADA PET 101","FUNDIÇÃO","",13.8,"13.8","10.55","0",true],["","65778","LINGUETA DIREITA 20.057","FUNDIÇÃO","","","4.64","3","SEM PESO",true],["","61682","GUIA BR21850001-3","FUNDIÇÃO","","3.55","7.1","3.43","SEM PESO",true],["","63994","CUBO C-91","FUNDIÇÃO","",11.64,"11.64","10.6","0",true],["","65951","BUCHA COR  D158","FUNDIÇÃO","",3.265,"6.53","5.4","SEM PESO",true],["","65259","BUCHA SOP D173","FUNDIÇÃO","",2.93,"5.86","4.92","SEM PESO",true],["","63797","BUCHA 100X80","FUNDIÇÃO","","","12.5","9.4","SEM PESO",true],["","65788","TAMPA CX LIG A41 222-005-0-4","FUNDIÇÃO","","1.85","3.7","2.46","0",true],["","65369","BUCHA SOP D 82","FUNDIÇÃO","","","3.92","2.32","SEM PESO",true],["","65286","BUCHA SOP D158","FUNDIÇÃO","",2.076923077,"4.05","3.2","SEM PESO",true],["","63522","DISCO BIREL","FUNDIÇÃO","",2.98,"2.98","2","0",true],["","63287","MANCAL MC 6205","FUNDIÇÃO","",0.816666667,"4.9","2.88","SEM PESO",true],["","62794","TIRANTE 3/8\"","FUNDIÇÃO","","","6.8","3.6","SEM PESO",true],["","62607","MANCAL MC-753","FUNDIÇÃO","",8.325,"16.65","13.22","SEM PESO",true],["","65955","BUCHA COR D107","FUNDIÇÃO","",1.905,"3.81","2.515","SEM PESO",true],["","62432","RODA GUIA DIAM. 480 MM C/ FURO","FUNDIÇÃO","","","28.28","19.57","SEM PESO",true],["","65500","ESTRADO","FUNDIÇÃO","","","32","25.5","SEM PESO",true],["","66050","PC06.056.37 RETAINER-BLANK FUNDIDO","FUNDIÇÃO","",6.1,"6.1","4.22","SEM PESO",true],["","62362","PEÇA MENOR P 65","FUNDIÇÃO","","","3.72","1.44","SEM PESO",true],["","66034","ANEL DESGASTE PP66 DES216175","FUNDIÇÃO","","","4.28","3.12","SEM PESO",true],["","62897","PET043 CAMISA 2.1/2","FUNDIÇÃO","",15.19,"15.19","14.42","0",true],["","66368","EXCENTRICO PET381","FUNDIÇÃO","","10.44","10.44","6.3","SEM PESO",true],["","61684","PLACA BR54850002-18","FUNDIÇÃO","",4.89,"4.89","4","SEM PESO",true],["","64062","MANCAL M-26","FUNDIÇÃO","",1.59,"6.36","4.8","SEM PESO",true],["","65408","BUCHA SOP D250","FUNDIÇÃO","",7.35,"7.35","4.58","SEM PESO",true],["","63642","CORPO VÁLVULA FUNDO LINHA 4X3","FUNDIÇÃO","",21.94,"21.94","18.88","SEM PESO",true],["","64264","EXCENTRICO BOOSTER 2 CL PET160","FUNDIÇÃO","",8.78,"8.78","6.61","SEM PESO",true],["","65782","TAMPA INFERIOR 832827R","FUNDIÇÃO","","","5.8","4.17","SEM PESO",true],["","63556","TAMPA SUPORTE TCI PTM 0201-E067","FUNDIÇÃO","","","8.6","5.6","SEM PESO",true],["","65785","CARCAÇA P/ VIMOT A41 222-002-0-1","FUNDIÇÃO","","","141.8","107","SEM PESO",true],["","65969","TAMPA P/ ROL G-06 225-005-0-3","FUNDIÇÃO","",2.845,"5.69","4.56","0",true],["","65287","BUCHA SOP D178","FUNDIÇÃO","",2.287179487,"4.46","3.8","SEM PESO",true],["","65981","BUCHA COR D188","FUNDIÇÃO","","4.923185840707965","4.88","3.66","SEM PESO",true],["","64012","BUCHA MIL 55 X 44 MM","FUNDIÇÃO","","","6.6","4.23","SEM PESO",true],["","65945","CARCAÇA P/ VIMOT E11 224-002-0-1","FUNDIÇÃO","",35.7,"35.7","30.6","0",true],["","61676","CUBO 21","FUNDIÇÃO","","","6.9","4.8","SEM PESO",true],["","65681","PORTA TUBO 444-8522","FUNDIÇÃO","","","29.1","24.92","SEM PESO",true],["","65662","PLATO FAPINHA","FUNDIÇÃO","",2.245,"4.49","2.4","0.88",true],["","65096","ANEL GRANDE","FUNDIÇÃO","",0.66,"2.64","1.43986","0",true],["","64189","PULMÃO DESCARGA BOOSTER PET 157","FUNDIÇÃO","","","3.11","2.21","SEM PESO",true],["","64438","ALAVANCA ABRAÇADEIRA 3","FUNDIÇÃO","",1.58,"3.16","2.16","SEM PESO",true],["","62194","BASE PU DES. ACN-211","FUNDIÇÃO","","","6.54","4.2","SEM PESO",true],["","62787","CAMISA BP 95 MM VV029 VV120","FUNDIÇÃO","","","7.82","5.77","SEM PESO",true],["","65892","83320207 ( COR 213 )","FUNDIÇÃO","GG 25","","10.88","10.06","0.49",true],["","65982","BUCHA COR 213","FUNDIÇÃO","","5.892688172043011","5.83","4.54","SEM PESO",true],["","65267","BUCHA SOP D192,85","FUNDIÇÃO","","","6.8","5.06","SEM PESO",true],["","61677","CUBO 22","FUNDIÇÃO","","","5.64","3.48","SEM PESO",true],["","65985","BUCHA COR D172","FUNDIÇÃO","","4.0229333333333335","7.94","5.76","SEM PESO",true],["","65240","BUCHA SOP D195","FUNDIÇÃO","",4.035,"8.07","5.48","SEM PESO",true],["","61817","FLANGE TURBO GE AC44","FUNDIÇÃO","","","47.3","32.46","SEM PESO",true],["","60802","MANCAL","FUNDIÇÃO","","","3.49","2.16","SEM PESO",true],["","63480","BUCHA MIL ANEL 224.771","FUNDIÇÃO","",3.28,"6.56","4.92","SEM PESO",true],["","65970","TAMPA CX LIG G-06","FUNDIÇÃO","",1.340833333,"8.045","6.36","0",true],["","63833","PLACA MIL 82","FUNDIÇÃO","","","3","2","SEM PESO",true],["","65291","BUCHA SOP D219","FUNDIÇÃO","","","8.7","6.9","SEM PESO",true],["","66357","FLANGE C-DB-0197(P014-19)","FUNDIÇÃO","",0.471,"4.71","2.2","SEM PESO",true],["","65311","BUCHA MIL 150 X 125 MM ( 150 X 114 )","FUNDIÇÃO","","","14.44","6.38","SEM PESO",true],["","65682","TUBE CHUCK RACE 2-313","FUNDIÇÃO","","","25.06","21.72","SEM PESO",true],["","66410","FLANGE FUNDIDA E USINADA TEM 548","FUNDIÇÃO","","","9.24","3","SEM PESO",true],["","62313","EXCENTRICO AP PET 060","FUNDIÇÃO","","","7.5","5.73","SEM PESO",true],["","65586","BUCHA MIL 368 X 340","FUNDIÇÃO","","","37.2","20.9","SEM PESO",true],["","65968","MP2486 CARCAÇA P/VIMOT G-15 225-034-0-1","FUNDIÇÃO","",19.8,"19.8","16.6","0",true],["","61597","ANEL BATENTE 112","FUNDIÇÃO","","","5.24","4.88","SEM PESO",true],["","65846","MP 2466 CARCAÇA VIMOT M-13 223-002-0-1","FUNDIÇÃO","","","13.16","9.88","0",true],["","65834","CRUZAMENTO RIGIDO T30","FUNDIÇÃO","","","7.38","4.9","SEM PESO",true],["","65986","BUCHA COR D194","FUNDIÇÃO","",4.432153846,"8.73","6.72","SEM PESO",true],["","65381","CAMISA AP 3 CDC TR039","FUNDIÇÃO","","","40.4","34.7","SEM PESO",true],["","65261","BUCHA SOP D201,17","FUNDIÇÃO","",3.729375,"6.63","4.8","SEM PESO",true],["","63391","MB-1150-B-F/ COXIM TRASEIRO","FUNDIÇÃO","","","6.77","4.15","SEM PESO",true],["","65335","BUCHA SOP D243,77","FUNDIÇÃO","",4.75,"4.75","3.76","SEM PESO",true],["","65987","BUCHA COR219","FUNDIÇÃO","",4.86,"4.86","4","SEM PESO",true],["","64213","DISCO DE FREIO KD081-B","FUNDIÇÃO","",1.82,"3.64","1","0",true],["","63592","FUNDIDO 103200-01L","FUNDIÇÃO","","","11.3","8","SEM PESO",true],["","63470","ABRAÇADEIRA DE 3\"","FUNDIÇÃO","",1.65,"3.3","2.2","SEM PESO",true],["","66065","TAMPA 1342761170GO","FUNDIÇÃO","","","26.6","19.17","SEM PESO",true],["","65297","SUPORTE FE F147-1179","FUNDIÇÃO","",0.69125,"5.53","3.84","SEM PESO",true],["","65738","CASTANHA LONGA","FUNDIÇÃO","","","4.4","2.8","SEM PESO",true],["","63949","TAMPA T-91","FUNDIÇÃO","",0.61625,"4.93","4.08","SEM PESO",true],["","65729","CAIXA CAME DIREITO 20.042","FUNDIÇÃO","","","4.17","2.23","SEM PESO",true],["","65728","CAIXA CAME ESQUERDO 20.041","FUNDIÇÃO","","","4.17","2.23","SEM PESO",true],["","65952","BUCHA COR D179","FUNDIÇÃO","",4.14,"8.28","6.62","SEM PESO",true],["","66119","ELEMENTO ROSCADO MH-2","FUNDIÇÃO","","","11.2","6.5","SEM PESO",true],["","63830","PLACA MIL 70","FUNDIÇÃO","",1.0676,"6.28","3.6","SEM PESO",true],["","66192","4037 SUPERIOR FUNDIDO","FUNDIÇÃO","","","4.68","2.8","SEM PESO",true],["","66218","DISCO ALETADO 250 mm","FUNDIÇÃO","","15.28","15.28","10.3","SEM PESO",true],["","65347","PISTAO AP 3 CDC TR014","FUNDIÇÃO","","","12.18","7.9","SEM PESO",true],["","65498","TAMPA ROL VIMOT S21 198-065-0-3","FUNDIÇÃO","","","4.48","3.07","SEM PESO",true],["","63273","MANGOTE 3\"","FUNDIÇÃO","","","5.64","3.1","SEM PESO",true],["","62609","CORPO ALG-050-084-004","FUNDIÇÃO","","","7.24","4.28","SEM PESO",true],["","65958","BUCHA COR D165","FUNDIÇÃO","",2.965,"5.93","5","SEM PESO",true],["","63887","ALAVANCA RÁPIDA 5.1/2\"","FUNDIÇÃO","","","3.12","2.22","SEM PESO",true],["","65416","BUCHA SOP D264","FUNDIÇÃO","",9.99,"9.99","7.58","SEM PESO",true],["","64640","PONTEIRO FUN 055A 059.070","FUNDIÇÃO","","","6.3","4.2","SEM PESO",true],["","66325","FLANGE FU00.13.111.0","FUNDIÇÃO","","","19.82","13.05","SEM PESO",true],["","66102","PEÇA EM BRUTO 4050-1-10A-1A","FUNDIÇÃO","","","13","11.3","SEM PESO",true],["","63586","EIXO EX-90","FUNDIÇÃO","",4.8,"4.8","3.4","SEM PESO",true],["","62790","CRC - 25 CARCAÇA","FUNDIÇÃO","",12.1,"12.1","9.52","SEM PESO",true],["","63611","INJETOR DIRECIONAL 1.1/2\"","FUNDIÇÃO","",2.33,"4.66","3","SEM PESO",true],["","62446","PICADEIRA DE SOLDA","FUNDIÇÃO","","","5.34","3.4","SEM PESO",true],["","66270","SUPORTE 23B.253.319.J","FUNDIÇÃO","","","20","17.8","SEM PESO",true],["","64304","CARTER 2 CIL PET 189","FUNDIÇÃO","","","40","33.65","SEM PESO",true],["","64541","ESTICADOR DO MOTOR BOOSTER PET 255","FUNDIÇÃO","","","6.54","4.4","SEM PESO",true],["","64473","CARTER 4 CIL PET 216 ( 4 CILINDROS )","FUNDIÇÃO","","67.78","67.78","58.78","0",true],["","65245","BUCHA SOP D218","FUNDIÇÃO","",6.83,"6.83","3.12","SEM PESO",true],["","66193","4038 INFERIOR 128 mm","FUNDIÇÃO","","","3.77","2.56","SEM PESO",true],["","65858","ALAVANCA FC C/ FECHAMENTO 20.150","FUNDIÇÃO","","","6.16","3.6","SEM PESO",true],["","64479","NR 84 BUCHA MIL 200 X 173 MM","FUNDIÇÃO","","","15.7","12.8","SEM PESO",true],["","66308","ESPAÇADOR LD 23K.201.562.A","FUNDIÇÃO","","","35.22","17.16","SEM PESO",true],["","65262","BUCHA SOP 225","FUNDIÇÃO","",3.96,"3.96","2.96","SEM PESO",true],["","65306","CABEÇA DO ISOLADOR","FUNDIÇÃO","","","5.08","3.6","SEM PESO",true],["","60611","ABRAÇADEIRA RAPIDA 5.1/2\"","FUNDIÇÃO","","","5.5","3.6","SEM PESO",true],["","63637","PLACA MIL 68","FUNDIÇÃO","","","6.4","3.51","SEM PESO",true],["","63969","CURVA NR 1","FUNDIÇÃO","","15.42","15.42","10.7","SEM PESO",true],["","65470","CUBO 23","FUNDIÇÃO","","","8.73","6.1","SEM PESO",true],["","62606","ROLDANA RD-6","FUNDIÇÃO","",2.1075,"8.43","6.8","0",true],["","61673","CUBO 14","FUNDIÇÃO","","","8.16","4.8","SEM PESO",true],["","65480","CACHIMBO FUNDIDO","FUNDIÇÃO","",2.21,"8.84","6.52","SEM PESO",true],["","65909","PEÇA FERRO FUNDIDO PROVIDA 2327053271K1","FUNDIÇÃO","","","6.88","3.84","SEM PESO",true],["","63501","PLACA MIL 66","FUNDIÇÃO","","","3.11","1.27","SEM PESO",true],["","62887","CUBO 03","FUNDIÇÃO","","","5.19","2.64","SEM PESO",true],["","62331","CASTANHA 225218","FUNDIÇÃO","",0.213,"4.26","2.2","SEM PESO",true],["","65596","RODA DE APOIO 856-15","FUNDIÇÃO","","","7.22","5.72","SEM PESO",true],["","63960","CONTRA PESO FARO","FUNDIÇÃO","","","3.2","2","SEM PESO",true],["","62786","CAMISA AP 75 MM VV028 VV120","FUNDIÇÃO","",5.6,"5.6","4.07","0",true],["","65833","PEÇA NR 3","FUNDIÇÃO","","","4.02","2.8","SEM PESO",true],["","60563","CILINDRO COMPRESSOR 77MM 1076","FUNDIÇÃO","","","5.7","4","SEM PESO",true],["","66312","MANGA EMBUCHAMENTO DISCO ESQUERDA/DIREITA","FUNDIÇÃO","","4.9","9.8","6.76","SEM PESO",true],["","65936","ENGATE DA LINGUETA 20.221","FUNDIÇÃO","","","6.2","2.75","SEM PESO",true],["","65431","BUCHA FUNDIDA E USINADA TEM 1618","FUNDIÇÃO","","","8.81","6.8","SEM PESO",true],["","66283","SUPORTE","FUNDIÇÃO","","","21.14","14.65","SEM PESO",true],["","65831","PEÇA NR 1","FUNDIÇÃO","","","3.58","1.7","SEM PESO",true],["","63595","FUNDIDO 103200-01O","FUNDIÇÃO","","","6.26","3.82","SEM PESO",true],["","65483","BUCHA MIL 65 X 54 MM","FUNDIÇÃO","","","7.69","3.84","SEM PESO",true],["","60264","4038 INFERIOR 128 mm","FUNDIÇÃO","","","3.5","2.24","SEM PESO",true],["","62209","DISCO MD-250 MPO 74103","FUNDIÇÃO","","13.06","13.06","10.94","SEM PESO",true],["","65959","BUCHA COR D185","FUNDIÇÃO","",3.995,"7.99","7","SEM PESO",true],["","64530","CURVA NR 4","FUNDIÇÃO","","8.6","8.6","7.87","SEM PESO",true],["","65684","MANGA PIVO TAMBOR/PANELA","FUNDIÇÃO","","4.81","9.62","7.47","SEM PESO",true],["","62279","Y452 FUNDIDO PIR 2384","FUNDIÇÃO","",0.745,"5.96","2.88","0",true],["","63593","FUNDIDO 103200-01M","FUNDIÇÃO","","","4.84","2.95","SEM PESO",true],["","62201","CARCAÇA CRC-45","FUNDIÇÃO","","14.38","14.38","12.6","SEM PESO",true],["","65832","PEÇA NR 2","FUNDIÇÃO","","","3.62","1.6","SEM PESO",true],["","66337","CARCAÇA PEQUENA","FUNDIÇÃO","","","6.38","4.45","SEM PESO",true],["","65725","BASE TRINCO BEBIDA 20.212","FUNDIÇÃO","","","7.78","4.8","SEM PESO",true],["","65496","CARCAÇA P/ VIMOT S21 198-060-0-1","FUNDIÇÃO","",70.04,"70.04","61.48","53.56",true],["","65154","CARTER 1 CIL PET 250 ( 1 CILINDRO )","FUNDIÇÃO","",25.0,"25","20","0",true],["","65433","BUCHA TEM 738","FUNDIÇÃO","","","7.22","5","SEM PESO",true],["","66257","MANGA EMBUCHAMENTO 4 FUROS","FUNDIÇÃO","",4.37,"8.74","6.52","SEM PESO",true],["","63426","PLACA MIL 25","FUNDIÇÃO","","","2.34","1.5","SEM PESO",true],["","63397","MANCAL TDP-90B","FUNDIÇÃO","","2.713","5.426","4.6","SEM PESO",true],["","61893","VERARDI SHELL NR4","FUNDIÇÃO","","","2.34","0.7178","SEM PESO",true],["","61894","VERARDI SHELL NR5","FUNDIÇÃO","","","2.46","0.71786","SEM PESO",true],["","66286","BOCAL FIXO ATC832","FUNDIÇÃO","","","14.62","13.16","SEM PESO",true],["","65572","TAMPA NECKRING 870-1031","FUNDIÇÃO","","","10.5","7.36","SEM PESO",true],["","62211","SUPORTE MD-250 MPO 74104","FUNDIÇÃO","","","8.72","6.3","SEM PESO",true],["","66046","PLACA THORCO GRANDE","FUNDIÇÃO","","","3.84","1.8","SEM PESO",true],["","65731","CAME DIREITO 20.047","FUNDIÇÃO","","","1.767","0.9","SEM PESO",true],["","65730","CAME ESQUERDO 20.046","FUNDIÇÃO","","","1.767","0.9","SEM PESO",true],["","64590","PLACA 2 15BK","FUNDIÇÃO","","","7.94","4.4","SEM PESO",true],["","65628","MANGA EMBUCHAMENTO TAMBOR 5 FUROS","FUNDIÇÃO","",3.97,"7.94","5.76","SEM PESO",true],["","61911","BASE DA BOBINA","FUNDIÇÃO","","","8.78","6.6","SEM PESO",true],["","61017","MANCAL (ARANHA) BR21620002-9","FUNDIÇÃO","",10.24,"10.24","8.1","SEM PESO",true],["","62293","CARCAÇA CRC-753","FUNDIÇÃO","","16.1","16.1","11.95","SEM PESO",true],["","63759","CURVA NR2","FUNDIÇÃO","","","19.46","13.9","SEM PESO",true],["","66047","PLACA THORCO PEQUENA","FUNDIÇÃO","","","3.5","1.83","SEM PESO",true],["","66051","RETENTOR 4234627180SG","FUNDIÇÃO","",5.87,"11.74","8.44","SEM PESO",true],["","62203","CARCAÇA CRC-90","FUNDIÇÃO","",8.15,"8.15","6.479","SEM PESO",true],["","66219","PISTAO BP 3CDC TR038","FUNDIÇÃO","","","18.52","15.35","SEM PESO",true],["","62604","MANGA PINO DISCO DIREITA","FUNDIÇÃO","","","5.98","4.44","SEM PESO",true],["","63412","PLACA MIL46","FUNDIÇÃO","",0.37,"1.48","0.9","SEM PESO",true],["","62783","GARRA J 395 5/8","FUNDIÇÃO","","0.5091666666666667","6.11","3.6","SEM PESO",true],["","65903","TAMPA DE FERRO FUND. 1341261112GO","FUNDIÇÃO","","","26.26","19.88","SEM PESO",true],["","61768","PANELA PN-535","FUNDIÇÃO","",7.34,"7.34","6","SEM PESO",true],["","65853","ENGATE DA LINGUETA 20.215","FUNDIÇÃO","","","7.1","4.4","SEM PESO",true],["","64624","DESV.ELET.12G.LA.ES.MP15404","FUNDIÇÃO","","","15.97","7.9","SEM PESO",true],["","66326","FLANGE FU00.13.112.0","FUNDIÇÃO","","","11.6","6.93","SEM PESO",true],["","64323","FERRO MB-266","FUNDIÇÃO","","","7.56","2.64","SEM PESO",true],["","66071","PROTEÇÃO MOLDADA 1341271210GO","FUNDIÇÃO","","","24.9","21.033","SEM PESO",true],["","64625","DESV. ELET. 12G LA. DI.","FUNDIÇÃO","","","15.53","8.3","SEM PESO",true],["","62605","MANGA PINO DISCO ESQUERDA","FUNDIÇÃO","","","5.98","4.24","SEM PESO",true],["","62965","CARTER PET 120","FUNDIÇÃO","",73.6,"73.6","55.26","0",true],["","63845","TAMPA TP-760 FECHADO","FUNDIÇÃO","",9.18,"9.18","7","SEM PESO",true],["","65624","CORPO P/ SEG CURVA TIPO C 06300181","FUNDIÇÃO","","","5.84","3.57","SEM PESO",true],["","66281","SUPORTE 23F.253.319","FUNDIÇÃO","","","20","19.8","SEM PESO",true],["","63313","TAMPA TP-34","FUNDIÇÃO","","","3.78","2.4","SEM PESO",true],["","65763","BASE ENGATE ALAVANCA 20.219","FUNDIÇÃO","","","5.52","3.04","SEM PESO",true],["","64544","DISCO MEGA KART TRASEIRO NOVO","FUNDIÇÃO","",3.0,"3","2","SEM PESO",true],["","65426","CARTER PET 334 ( 2 CILINDROS )","FUNDIÇÃO","",33.18,"33.18","28","0",true],["","63471","ABRAÇADEIRA DE 4\"","FUNDIÇÃO","",1.815,"3.63","2.4","SEM PESO",true],["","65835","CRUZAMENTO RIGIDO T23","FUNDIÇÃO","","","9.16","6.125","SEM PESO",true],["","66370","CORPO CONTATOR DE CORRENTE","FUNDIÇÃO","","","5.62","3","SEM PESO",true],["","66157","ENGRENAGEM CENTRAL MAQ. 550T","FUNDIÇÃO","","","187","131.3","SEM PESO",true],["","61880","BRAÇO ALAVANCA ALIMENTAÇÃO 06.300530","FUNDIÇÃO","","","5.14","1.78","SEM PESO",true],["","65505","CAPA DA CORRENTE M-753","FUNDIÇÃO","",34.7,"34.7","19.9","0",true],["","63373","TAMPA PE DES. 999.020","FUNDIÇÃO","","","6.54","3.9","SEM PESO",true],["","66111","ALAVANCA FC S/  FECHAM. 20.216","FUNDIÇÃO","","","5.5","2.8","SEM PESO",true],["","63624","PLACA MIL 58","FUNDIÇÃO","","","1.402","0.96","SEM PESO",true],["","66067","TAMPA 1241251110K1","FUNDIÇÃO","","","22.1","17.1","SEM PESO",true],["","62547","BASE FF4009000001","FUNDIÇÃO","","","7.1","5.88","SEM PESO",true],["","61818","CARCAÇA TURBO GE AC44 714295R","FUNDIÇÃO","","","26.72","20.62","SEM PESO",true],["","63411","PLACA MIL 57","FUNDIÇÃO","","","2.04","1.12","SEM PESO",true],["","63410","PLACA MIL 01","FUNDIÇÃO","","","1.74","1.2","SEM PESO",true],["","64480","BUCHA MIL 225X195","FUNDIÇÃO","","","5","3","SEM PESO",true],["","65756","ALAVANCA TRINCO WPR 20.201","FUNDIÇÃO","",1.8775,"3.755","2.46","SEM PESO",true],["","66349","COLETOR TURISTICA FUNDIDO","FUNDIÇÃO","","","5.63","2.91","SEM PESO",true],["","66280","TAMPA TMS","FUNDIÇÃO","","","7","4","SEM PESO",true],["","66048","RODA DO CARRINHO","FUNDIÇÃO","","","8","4","SEM PESO",true],["","65399","BUCHA SOP D167","FUNDIÇÃO","","2.7560000000000002","5.3","3.75","SEM PESO",true],["","64511","ABRAÇADEIRA FIXA 5.1/2","FUNDIÇÃO","","","7.2","5.6","SEM PESO",true],["","66258","BUCHA ANEL DO PISTÃO AM 20-83","FUNDIÇÃO","",0.675555556,"6.08","3.96","SEM PESO",true],["","66279","BUCHA ANEL DO PISTÃO AM 24-83","FUNDIÇÃO","",0.377056277,"6.03","4.8","SEM PESO",true],["","66156","BUCHA 27,02 MM","FUNDIÇÃO","",0.306935414,"7.3","6","SEM PESO",true],["","65244","BUCHA SOP D269,77","FUNDIÇÃO","",5.17,"5.17","3.9","SEM PESO",true],["","66391","DISCO MOEDOR","FUNDIÇÃO","","","1.8","1.2","SEM PESO",true],["","66408","VALVULA RETENÇÃO BSCW30","FUNDIÇÃO","","","5.78","3.8","SEM PESO",true],["","65088","PRESILHA SUSPENSÃO TANGENTE","FUNDIÇÃO","","","3.78","2.15","SEM PESO",true],["","65087","BASE P SUSPENSÃO TANGENTE","FUNDIÇÃO","","","3.31","3","SEM PESO",true],["","65812","GRAMPO DE SUSPENSÃO PENDULAR","FUNDIÇÃO","","","5.38","3.08","SEM PESO",true],["","65089","BRAQUETE SUSPENSÃO TANGENTE","FUNDIÇÃO","","","7.28","1.35","SEM PESO",true],["","66264","GUIA DA ESTUFA","FUNDIÇÃO","",0.762,"7.62","5.4","SEM PESO",true],["","66428","PEÇA DULONG NR 3","FUNDIÇÃO","","","23","18.7","SEM PESO",true],["","66427","PEÇA DULONG NR 2","FUNDIÇÃO","","","52","47.9","SEM PESO",true],["","66426","PEÇA DULONG NR 1","FUNDIÇÃO","","","36","32.3","SEM PESO",true],["","66431","TREMPE CENTRAL 1403","FUNDIÇÃO","","","1.1","0.8","SEM PESO",true],["","65838","BUCHA MIL 385 X 350 MM","FUNDIÇÃO","","","48.5","44.68","SEM PESO",true],["","66163","TUBULAR OEF 13220","FUNDIÇÃO","","","12","7.6","SEM PESO",true],["","66453","SUPORTE BASCULAMENTO 2V3.899.355","FUNDIÇÃO","","","13.6","10","SEM PESO",true],["","66454","SAPATA DO FREIO","FUNDIÇÃO","","","8.3","6","SEM PESO",true],["","66285","SAPATA PORTA MOLDE","FUNDIÇÃO","","","4.55","2.8","SEM PESO",true],["","61604","ANEL BATENTE D 175,30","FUNDIÇÃO","","","6.4","5.4","SEM PESO",true],["","66458","CONJUNTO KK900","FUNDIÇÃO","","","2.05","0.6","SEM PESO",true],["","66457","CONJUNTO BG1200","FUNDIÇÃO","","","1.62","0.4","SEM PESO",true],["","65848","MP 2468 TAMPA CX LIGAÇÃO M-13 ( M04 )","FUNDIÇÃO","","","1.88","4.8","0",true],["","65847","MP 2467 TAMPA ROL. VIMOT M-13 ( M04 )","FUNDIÇÃO","","","4.54","3.25","0",true],["","66390","PRESILHA SUSPENSÃO TANGENTE","FUNDIÇÃO","","","3.78","2.15","SEM PESO",true],["","66240","CONCHA ALAVANCA ALIMENT.","FUNDIÇÃO","","","1.3","1","SEM PESO",true],["","65737","DISCO MINE NOVO QM 119","FUNDIÇÃO","","","2.34","1.53","SEM PESO",true],["","66277","SUPORTE FUDIDO JNV 411.207.E/F","FUNDIÇÃO","","","33.2","12","SEM PESO",true],["","66307","ESPAÇADOR 23K.201.561.A/562.6","FUNDIÇÃO","","","35.22","12","SEM PESO",true],["","66439","BASE DULONG","FUNDIÇÃO","","","31.16","19.21","SEM PESO",true],["","64161","BUCHA MIL 70x50","FUNDIÇÃO","","","15","2.3","SEM PESO",true],["","66474","SAPATA JF FUNDIDA","FUNDIÇÃO","","","4.41","3.1","SEM PESO",true],["","66494","TAMPA TP-25","FUNDIÇÃO","","","5.9","3.6","SEM PESO",true],["","65187","ESTRUTURA PRINCIPAL J","FUNDIÇÃO","","","51.48","42","SEM PESO",true],["","66512","DISCO DE FREIO ITALIANO TRASEIRO","FUNDIÇÃO","","","2.8","2","SEM PESO",true],["","66348","PEÇA VILHENA NR2","FUNDIÇÃO","","","4","3","SEM PESO",true],["","66347","PEÇA VILHENA NR1","FUNDIÇÃO","","","5.4","3","SEM PESO",true],["","65941","DISCO DE FREIO NOVO QM118","FUNDIÇÃO","",3.74,"3.74","2.36","SEM PESO",true],["","62576","CABEÇOTE VÁLVULA BP PET 100 ( MODELO PET046 )","FUNDIÇÃO","",9.12,"18.24","8.1","0",true],["","66236","BASE INFERIOR V-11082-6","FUNDIÇÃO","","","12.36","11","SEM PESO",true],["","66235","CARCAÇA","FUNDIÇÃO","","","17.36","12.62","SEM PESO",true],["","66381","BASE FUNDIDA","FUNDIÇÃO","","","14.07","10.4","SEM PESO",true],["","66382","TUBO FUNDIDO","FUNDIÇÃO","","","8.32","6.24","SEM PESO",true],["","66383","QUEIMADOR FUNDIDO","FUNDIÇÃO","","","2.375","1.4","SEM PESO",true],["","66384","RESISTENCIA KK1412-E-80065","FUNDIÇÃO","","","5","2","SEM PESO",true],["","66386","TAMPA FUNDIDA","FUNDIÇÃO","","","4.23","10","SEM PESO",true],["","66385","FLANGE FUNDIDA","FUNDIÇÃO","","","12","8","SEM PESO",true],["","66387","POLIA ENCAIXE DO MOTOR","FUNDIÇÃO","","","3.6","1.2","SEM PESO",true],["","66054","TARUGO 30X500","FUNDIÇÃO","","3","9","6.76","SEM PESO",true],["","66053","TARUGO 22X500","FUNDIÇÃO","","2.5","7.5","3.6","SEM PESO",true],["","66052","TARUGO 16X500","FUNDIÇÃO","",1.33,"3.99","1.9","SEM PESO",true],["","66396","FLANGE FUNDIDA E USINADA 1217","FUNDIÇÃO","","","7.85","4.8","SEM PESO",true],["","66405","BASE VERARDI FUNDIDA","FUNDIÇÃO","","","4.6","4","SEM PESO",true],["","66406","BUCHA CAMARA MOAGEM","FUNDIÇÃO","","","13.88","4","SEM PESO",true],["","66407","DISCO CAMARA MOAGEM","FUNDIÇÃO","","","14.28","5","SEM PESO",true],["","66272","SUPORTE FUNDIDO JNV. 422.553.B","FUNDIÇÃO","","","26.2","16.86","SEM PESO",true],["","66284","CORPO VÁLV FUNDO 2X1.1/2 PORTA","FUNDIÇÃO","","","13","11","SEM PESO",true],["","62612","DISCO FRONTAL MPO 74105","FUNDIÇÃO","","","5.18","3.6","SEM PESO",true],["","62683","TAMPA CABEÇOTE BP (DUPLO) PET 085","FUNDIÇÃO","","1.865","7.46","6.8","0",true],["","63745","CILINDRO 3.1/4 PET 144 / CAMISA PET 016","FUNDIÇÃO","","","15.3","10.2","SEM PESO",true],["","66412","TAMPA TEM 1712","FUNDIÇÃO","","","23.58","18.1","SEM PESO",true],["","66417","TAMPA DO ROLAMENTO PET394","FUNDIÇÃO","","","2.24","1.2","0",true],["","66416","TAMPA INFERIOR PET393","FUNDIÇÃO","",7.84,"7.84","5.74","3.88",true],["","63513","ADAPTADOR 48A 2N-8122030","FUNDIÇÃO","","","3.32","1.2","SEM PESO",true],["","63475","CORPO 48A 4N-872203","FUNDIÇÃO","","","31.82","26.6","SEM PESO",true],["","66418","CAMARA INTERNA","FUNDIÇÃO","","","8.6","6.85","SEM PESO",true],["","66419","ROSCA TRANSPORTADORA","FUNDIÇÃO","","","2.86","1.62","SEM PESO",true],["","66423","RESISTENCIA KK1412-E-80065","FUNDIÇÃO","","","4.48","2.26","SEM PESO",true],["","66420","MP1617 POLIA FOFO DIAM 462 MM 5 CANAIS B","FUNDIÇÃO","",82.92,"82.92","68.72","0",true],["","66421","MP1618 POLIA FOFO DIAM 194 MM 5 CANAIS B","FUNDIÇÃO","","32.26","32.26","26.5","SEM PESO",true],["","66392","FLANGE FUNDIDA E USINADA","FUNDIÇÃO","","","4.92","3.56","SEM PESO",true],["","66393","TAMPA FUNDIDA","FUNDIÇÃO","","","4.23","2.74","SEM PESO",true],["","63517","CARRINHO PKY1-4 S-150","FUNDIÇÃO","","","8.16","6.6","SEM PESO",true],["","66430","TAMBOR DE FREIO","FUNDIÇÃO","","","9","6.06","SEM PESO",true],["","66429","DEGRAU 6027 FUNDIDO","FUNDIÇÃO","","","34.48","25.95","SEM PESO",true],["","62210","DISCO ALETADO MPO74106","FUNDIÇÃO","","","5","3.6","SEM PESO",true],["","66450","PEÇA 23B.411.379A","FUNDIÇÃO","","","19.58","12.36","SEM PESO",true],["","66451","PEÇA 23B.411.380A","FUNDIÇÃO","","","12.76","7.1","SEM PESO",true],["","66452","PEÇA 23B.511.716D","FUNDIÇÃO","","","14.92","9.98","SEM PESO",true],["","66411","ALAVANCA","FUNDIÇÃO","","","0.5","0.35","SEM PESO",true],["","66389","BASE P SUSPENSÃO TANGENTE","FUNDIÇÃO","","","3.31","3","SEM PESO",true],["","64641","PONTEIRO 059.069","FUNDIÇÃO","","","8.94","5.25","SEM PESO",true],["","66282","SUPORTE CAIXA DE DIREÇÃO 23F.419.087","FUNDIÇÃO","","","12","10.54","SEM PESO",true],["","66475","CARTER 6 CIL BSCW NOVO PET 391","FUNDIÇÃO","",76.0,"76","67.4","0",true],["","66476","TAMPA CARTER DIANT. PET 392","FUNDIÇÃO","",9.5,"9.5","7.83","0",true],["","66489","BASE SUPORTE ALCOOL","FUNDIÇÃO","","","5.03","3.2","SEM PESO",true],["","66269","PLATO FUNDIDO","FUNDIÇÃO","","","8.6","5.34","SEM PESO",true],["","66490","SUPORTE CAIXA DE DIREÇÃO JNV.422.553.L","FUNDIÇÃO","","","19.66","14","SEM PESO",true],["","66491","POLIA FUNDIDA 07W.260.810.J","FUNDIÇÃO","","","11.42","7.5","SEM PESO",true],["","63947","CORPO S-150 PKY1-1","FUNDIÇÃO","","","44.8","33.64","SEM PESO",true],["","63948","GAVETA S-150 PKY1-5","FUNDIÇÃO","","","13.8","11.8","SEM PESO",true],["","66508","ALAVANCA EMPASA","FUNDIÇÃO","","0.7125","2.85","2.9","SEM PESO",true],["","66509","ABRAÇAEIRA EMPASA","FUNDIÇÃO","",1.385,"5.54","5.1","SEM PESO",true],["","66504","CARCAÇA","FUNDIÇÃO","","","7.88","6.3","SEM PESO",true],["","66502","TAMPA/MANETE","FUNDIÇÃO","","","3.63","2.9","SEM PESO",true],["","62655","CABEÇOTE BP PET84","FUNDIÇÃO","","","28.68","23.26","SEM PESO",true],["","63843","BUCHA MIL 110 X 85","FUNDIÇÃO","","","14.08","6.36","SEM PESO",true],["","66501","ANCINHO","FUNDIÇÃO","","","6.34","3","SEM PESO",true],["","66511","BIELA QUALITY AIR","FUNDIÇÃO","","","15.98","13.77","SEM PESO",true],["","62668","BASE PE DES. ACN-003","FUNDIÇÃO","","","8.3","6.2","SEM PESO",true],["","65638","TERMINAL PADRÃO MEDIO","FUNDIÇÃO","","","9.52","7.4","SEM PESO",true],["","65573","GARRA DIREITA 4050-1-7D-1A","FUNDIÇÃO","","","6.88","4.48","SEM PESO",true],["","65574","GARRA ESQUERDA 4050-1-7D-2A","FUNDIÇÃO","","","7.12","4.7","SEM PESO",true],["","62661","CARCAÇA M-45","FUNDIÇÃO","","","13","9.3","SEM PESO",true],["","65260","BUCHA SOP D139","FUNDIÇÃO","","","6.88","5.72","SEM PESO",true],["","62793","TIRANTE 1/2","FUNDIÇÃO","","","7.23","3.3","SEM PESO",true],["","66133","MANCAL P/ VIMOT P-11 226-005-0-3","FUNDIÇÃO","",1.305,"2.61","1.73","0",true],["","66132","CARCAÇA P/ VIMOT P-11 226-002-0-1","FUNDIÇÃO","",9.01,"9.01","6.9","0",true],["","66134","TAMPA CX LIG VIMOT P-11 226-004-0-4","FUNDIÇÃO","",1.049361702,"2.055","1.02","0",true],["","66532","CARTER NOVO 4 CIL PET216A","FUNDIÇÃO","","","60","46.1","SEM PESO",true],["","66535","POTE MENOR FUNDIDO","FUNDIÇÃO","",0.711666667,"4.27","2.16","SEM PESO",true],["","66526","OITAVADA 2\"","FUNDIÇÃO","","","6","3.9","SEM PESO",true],["","66527","BUCHA 1\"","FUNDIÇÃO","","","6.18","4.8","SEM PESO",true],["","66528","BUCHA 2\"","FUNDIÇÃO","","","6.4","5.1","SEM PESO",true],["","66542","PET 451 TAMPA DIAM BSCI5_7","FUNDIÇÃO","","","4.22","2.1","0",true],["","66541","PET 452 TAMPA TRASE BSCI5_7","FUNDIÇÃO","","5.46","5.46","4.12","3.2",true],["","64329","BUCHA MIL 28 X 18","FUNDIÇÃO","","","6.4","4","SEM PESO",true],["","66558","GRPN GIRO P/ PUXADOR NACIONAL","FUNDIÇÃO","",0.455,"5.46","3.6","SEM PESO",true],["","65421","BUCHA SOP D95","FUNDIÇÃO","","","5.24","2","SEM PESO",true],["","66539","CUBO C-91","FUNDIÇÃO","","12.6","12.6","10.25","SEM PESO",true],["","66538","POLIA 162","FUNDIÇÃO","","","8.76","6.63","SEM PESO",true],["","66525","POLIA C-102","FUNDIÇÃO","","","13.68","9.48","SEM PESO",true],["","65956","BUCHA COR D125","FUNDIÇÃO","","2.055","4.11","3.28","SEM PESO",true],["","65957","BUCHA COR D145","FUNDIÇÃO","","2.63","5.26","4.24","SEM PESO",true],["","65953","BUCHA COR D201","FUNDIÇÃO","",8.87,"8.87","7.61","SEM PESO",true],["","66180","RODA TRAÇÃO 630","FUNDIÇÃO","","","36.8","26.91","SEM PESO",true],["","66130","TAMPA FUNDIDA C088","FUNDIÇÃO","","","10.96","8.03","SEM PESO",true],["","66131","CARCAÇA C0319","FUNDIÇÃO","","","21.18","18.4","SEM PESO",true],["","63943","GARFO FUNDIDO TD2-0508","FUNDIÇÃO","","","3.5","2.8","SEM PESO",true],["","66560","TAMPÃO FIXADOR DE VÁLVULA PET 423","FUNDIÇÃO","",1.583333333,"9.5","5.66","0",true],["","64420","CORPO CADEADO CHÃO GLOBAL-LOCK","FUNDIÇÃO","","","9.68","5.6","SEM PESO",true],["","65761","GATILHO BASE ENGATE 20.222","FUNDIÇÃO","","","1.56","0.96","SEM PESO",true],["","65925","TARUGO 55 x 610","FUNDIÇÃO","","11.43","34.29","31.71","SEM PESO",true],["","66531","TAMPA CARTER TRASEIRA PET 392T","FUNDIÇÃO","","","9.5","7.83","SEM PESO",true],["","65924","TARUGO 45X610","FUNDIÇÃO","",8.166666667,"24.5","21.24","SEM PESO",true],["","65923","TARUGO 35X610","FUNDIÇÃO","",5.406666667,"16.22","12.84","SEM PESO",true],["","63502","BRAÇO PTM3-4-3","FUNDIÇÃO","","","1.18","0.36","SEM PESO",true],["","66545","BIELA EMPLACADA","FUNDIÇÃO","","","4.26","2.46","SEM PESO",true],["","66544","VOLANTE EMPLACADO","FUNDIÇÃO","","","35.2","25.2","SEM PESO",true],["","65757","BALANCIN 20.208/ TRAVA 20.202","FUNDIÇÃO","","1.26","5.04","2.84","SEM PESO",true],["","63594","CONF. DES. 103200-01P","FUNDIÇÃO","","","7.74","4.78","SEM PESO",true],["","63597","CONF. DES. 103200-01X","FUNDIÇÃO","","","5.26","3.8","SEM PESO",true],["","63596","CONF. DES. 103200-01S FUNDIDO","FUNDIÇÃO","","","6.98","4.6","SEM PESO",true],["","62542","BASE 36030200","FUNDIÇÃO","",3.81,"7.62","5.6","SEM PESO",true],["","66575","PEÇA NR5 VOL IMPORTS","FUNDIÇÃO","","","7.6","5.1","SEM PESO",true],["","66580","PEÇA NR4 VOL IMPORTS","FUNDIÇÃO","","","8.9","6.9","SEM PESO",true],["","66579","PEÇA NR3 VOL IMPORTS","FUNDIÇÃO","","","8.3","6.8","SEM PESO",true],["","66578","PEÇA NR2 VOL IMPORTS","FUNDIÇÃO","","","8","6.3","SEM PESO",true],["","66577","PEÇA NR1 VOL IMPORTS","FUNDIÇÃO","","","4.6","3.8","SEM PESO",true],["","66044","TUBULAR OEF 13074/13403","FUNDIÇÃO","","","35","16.5","SEM PESO",true],["","66045","TUBULAR 13075/13404","FUNDIÇÃO","","","35","16.3","SEM PESO",true],["","66010","CASTANHA CURTA 20.069","FUNDIÇÃO","","","3.64","2.58","SEM PESO",true],["","64507","ABRAÇADEIRA FIXA 5\"","FUNDIÇÃO","","","4.95","3.64","SEM PESO",true],["","64444","ABRAÇADEIRA RAPIDA 5 MACHO","FUNDIÇÃO","","2.31","4.62","2","SEM PESO",true],["","63464","ABRAÇADEIRA RAPIDA 5\" FEMEA","FUNDIÇÃO","","2.48","4.96","3.8","SEM PESO",true],["","61247","ALAVANCA RAPIDA 5","FUNDIÇÃO","",1.02,"3.4","2.32","SEM PESO",true],["","61230","CHAPINHA RAPIDA 5\"","FUNDIÇÃO","","0.229","4.58","3.2","SEM PESO",true],["","65296","BUCHA SOP D120","FUNDIÇÃO","","","5.98","3.97","SEM PESO",true],["","65630","SUPORTE VR-08 FUNDIDO","FUNDIÇÃO","","","6.24","4","SEM PESO",true],["","65633","SUPORTE VR-07 FUNDIDO","FUNDIÇÃO","","","8.1","4.4","SEM PESO",true],["","66559","ALAVANCA 5\"","FUNDIÇÃO","","","3.66","2.9","SEM PESO",true],["","65360","BUCHA SOP D77","FUNDIÇÃO","","0.44000000000000006","4.4","3.18","SEM PESO",true],["","66584","BARRINHA PARA ABRAÇADEIRA RAPIDAS","FUNDIÇÃO","","0.386","3.86","2.8","SEM PESO",true],["","65430","BUCHA MIL 125 X 105 MM","FUNDIÇÃO","","","16","7","SEM PESO",true],["","63842","BUCHA MIL 115 X 85 MM NR 70","FUNDIÇÃO","","","9.5","6","SEM PESO",true],["","65285","BUCHA SOP D124","FUNDIÇÃO","","","7.58","6","SEM PESO",true],["","65333","BUCHA MIL 140 X 110 MM","FUNDIÇÃO","","","12.44","10","SEM PESO",true],["","66587","CAST. REFT 1/2X3/4","FUNDIÇÃO","",1.08125,"8.65","5.6","SEM PESO",true],["","65899","SUPORTE 23B7355160GO","FUNDIÇÃO","","","17.1","11.36","SEM PESO",true],["","64481","BUCHA NR-74 MIL 130 X 105","FUNDIÇÃO","","","8.5","6.8","SEM PESO",true],["","66588","SUPORTE CAIXA DIREÇÃO JNV 422.553","FUNDIÇÃO","","","28.78","24","SEM PESO",true],["","66589","SUPORTE CAIXA BATERIA 23H 915 345","FUNDIÇÃO","","","22.3","11","SEM PESO",true],["","63180","PLACA DE DESLIZAMENTO 230-4-3-A","FUNDIÇÃO","",0.3425,"2.74","1.44","SEM PESO",true],["","66586","CAST.REFT 1X1.1/4","FUNDIÇÃO","","","12.82","10","SEM PESO",true],["","62865","CORPO VALVULA FUNDO LINHA 6X4","FUNDIÇÃO","","","42.42","26.06","SEM PESO",true],["","62874","DISCO DE FREIO","FUNDIÇÃO","","","2.92","2","SEM PESO",true],["","64152","GAVETA S - 100","FUNDIÇÃO","","","7.4","4.48","SEM PESO",true],["","64153","CARRINHO S - 100","FUNDIÇÃO","","","5.28","3.84","SEM PESO",true],["","64151","CORPO S - 100","FUNDIÇÃO","","","20.18","15.96","SEM PESO",true],["","66145","PISTAO COMPRESSOR GARDENER","FUNDIÇÃO","","","13","8","SEM PESO",true],["","66188","COMPR GARDENER DENVER","FUNDIÇÃO","","","27.6","22.1","SEM PESO",true],["","66602","TAMPA DO MOTOR","FUNDIÇÃO","","","72","60","SEM PESO",true],["","66592","VOLANTE 1.1/2\" A 3\"","FUNDIÇÃO","",1.6,"6.4","0.96","SEM PESO",true],["","66593","VOLANTE 1\" A 1.1/4\"","FUNDIÇÃO","","","4.12","5.1","SEM PESO",true],["","66594","VOLANTE 4\" A 6\"","FUNDIÇÃO","","","4.8","2.82","SEM PESO",true],["","66213","BATENTE FUNDIDO","FUNDIÇÃO","","","5.52","2.3","SEM PESO",true],["","66223","DOBRADICA DIREITA FUND/USIN","FUNDIÇÃO","","","5.52","3.4","SEM PESO",true],["","66212","DOBRADICA ESQUERDA FUND/USINADA","FUNDIÇÃO","","","5.52","3.4","SEM PESO",true],["","65463","CARCACA REC FUNDIDA","FUNDIÇÃO","","","62.6","42.73","SEM PESO",true],["","66607","463515580 MASSA AMORTEC COMANDO CAMBIO","FUNDIÇÃO","",0.848,"8.48","0.64","0.64",true],["","66603","BASE REVESLAM","FUNDIÇÃO","","","13","10.5","SEM PESO",true],["","66601","REDUÇÃO CONCENTRICA","FUNDIÇÃO","","","11","7","SEM PESO",true],["","66604","PET440F VOLANTE 520MM BISSTER","FUNDIÇÃO","","70","70","64.6","SEM PESO",true],["","65954","BUCHA COR D89","FUNDIÇÃO","",1.455,"5.82","4","SEM PESO",true],["","65960","BUCHA COR D207","FUNDIÇÃO","","3.82","7.64","6.36","SEM PESO",true],["","66610","CORPO RETO 4\"","FUNDIÇÃO","","","22","16","SEM PESO",true],["","66620","POTE MEDIO FUNDIDO","FUNDIÇÃO","",0.811666667,"4.87","3.2","SEM PESO",true],["","66605","CUBO DE RODA TROLLER","FUNDIÇÃO","","","26.28","12","SEM PESO",true],["","66117","ELEMENTO ROSCADO MH-1","FUNDIÇÃO","","","11.2","6.7","SEM PESO",true],["","66118","CORPO MH-1","FUNDIÇÃO","","","23.58","18.35","SEM PESO",true],["","66123","CARRO MH-1 DUPLO","FUNDIÇÃO","","","16.66","10.76","SEM PESO",true],["","66186","TAMPA ATUADOR NL 17 50867-1","FUNDIÇÃO","","47.7","47.7","38.6","SEM PESO",true],["","66187","BASE ATUADOR NL 17 50869-1","FUNDIÇÃO","","57.8","57.8","45.64","SEM PESO",true],["","65432","CUBO TEM 1668","FUNDIÇÃO","","","23.06","17","SEM PESO",true],["","66315","PEÇA TEM 2435","FUNDIÇÃO","","","5","3.8","SEM PESO",true],["","66621","SUSPENSAO FIXA CABO 031383","FUNDIÇÃO","",0.7225,"2.89","1.6","SEM PESO",true],["","66622","GARRA DE SUSPENSAO 031383G","FUNDIÇÃO","",0.218,"2.18","1","SEM PESO",true],["","66614","SUPORTE 23L.701.157","FUNDIÇÃO","","","19.84","14","SEM PESO",true],["","66615","SUPORTE 23L.701.157A","FUNDIÇÃO","","","19.84","14","SEM PESO",true],["","66616","SUPORTE 23H.803.934","FUNDIÇÃO","","","25.5","17","SEM PESO",true],["","66617","SUPORTE 23P.422.553","FUNDIÇÃO","","","21.58","14","SEM PESO",true],["","66633","MANCAL P/ VIMOT 221-032-0-1","FUNDIÇÃO","","","23.62","19.83","SEM PESO",true],["","66634","MANCAL P/ VIMOT 222-021-0-1","FUNDIÇÃO","","","41.4","35.11","SEM PESO",true],["","66631","SUPORTE FUNDIDO 23M.199.091.E","FUNDIÇÃO","","","29.8","17.2","SEM PESO",true],["","63402","PLACA 62","FUNDIÇÃO","","","5.6","4","SEM PESO",true],["","66210","LASTRO FORNO A GÁS","FUNDIÇÃO","","","12.46","9.7","SEM PESO",true],["","66640","ANEL FEIJÃO","FUNDIÇÃO","","","5.1","0.96","SEM PESO",true],["","66651","BIELA INTERMEDIARIA PET 431","FUNDIÇÃO","","","3.54","2.76","SEM PESO",true],["","66646","FRIGIDEIRA","FUNDIÇÃO","","","3.66","1.31","SEM PESO",true],["","66641","CHAPA OCULOS","FUNDIÇÃO","","","32.05","24.5","SEM PESO",true],["","66039","ANEL DESGASTE PP 1212","FUNDIÇÃO","","","26.76","20.46","SEM PESO",true],["","66036","ANEL DESGASTE PP 86","FUNDIÇÃO","","","12.87","9.06","SEM PESO",true],["","66652","POLIA 23F105253","FUNDIÇÃO","","","27.92","23.96","SEM PESO",true],["","66171","BISCATE 60 KG","FUNDIÇÃO","","60","60","50","SEM PESO",true],["","66656","CARCAÇA INFERIOR TTREC 0,5","FUNDIÇÃO","","","3.63","25","SEM PESO",true],["","66657","CARCAÇA SUPERIOR TTREC 0,5","FUNDIÇÃO","","","46.85","35","SEM PESO",true],["","66648","VIRABREQUIM PEÇA SOBRE PEÇA","FUNDIÇÃO","","","24.5","19.6","SEM PESO",true],["","66653","MANGA PINO DISCO DIREITA/ESQUERDA","FUNDIÇÃO","",5.33,"10.66","6.76","SEM PESO",true],["","66650","CAM LEVER 28-1757","FUNDIÇÃO","","","7.86","5.12","SEM PESO",true],["","66647","QUEIMADOR GREENCOL","FUNDIÇÃO","","","3.14","1.68","SEM PESO",true],["","66639","FLANGE 23220707530040","FUNDIÇÃO","","","9.28","6.52","SEM PESO",true],["","66649","CASTELO 4\"","FUNDIÇÃO","","","15.22","9.3","SEM PESO",true],["","63863","CONTRA PESO PTM 240","FUNDIÇÃO","","","9.38","7.4","SEM PESO",true],["","62664","MANCAL PTM 2-031","FUNDIÇÃO","","","5.8","3.2","SEM PESO",true],["","65947","BUCHA COR 84","FUNDIÇÃO","","1.71","6.84","4","SEM PESO",true],["","62665","BIELA PTM 2-03A","FUNDIÇÃO","","","13.82","10.88","SEM PESO",true],["","66680","POLIA CABO AÇO","FUNDIÇÃO","","","11.71","7.7","SEM PESO",true],["","65364","1A TRAVA PAREDE C/ ROSCA","FUNDIÇÃO","","","3.24","3.24","SEM PESO",true],["","65506","1B TRAVA PAREDE PASSANTE","FUNDIÇÃO","","","3.24","3.24","SEM PESO",true],["","65365","2A TRAVA PAREDE C/ ROSCA","FUNDIÇÃO","","","5.04","5.04","SEM PESO",true],["","65539","2B TRAVA PAREDE PASSANTE","FUNDIÇÃO","","","5.04","5.04","SEM PESO",true],["","65095","ANEL PEQUENO","FUNDIÇÃO","",0.445,"1.78","0.56","0",true],["","65082","CY3 FLANGE","FUNDIÇÃO","",0.97625,"7.81","0.48","0",true],["","63271","CY2 FLANGE","FUNDIÇÃO","","","0.36","0.65","SEM PESO",true],["","66659","CARCAÇA TTEMB","FUNDIÇÃO","","","210","167","SEM PESO",true],["","66517","JB 132 ANEL","FUNDIÇÃO","","","3.22","1.64","SEM PESO",true],["","66516","JB 335 ANEL","FUNDIÇÃO","","","1.429","0.73","SEM PESO",true],["","66637","CUBO MENOR DIANTEIRO","FUNDIÇÃO","","2.155","4.31","1.55","SEM PESO",true],["","66638","CUBO MAIOR TRASEIRO","FUNDIÇÃO","","5.96","5.96","3.3","SEM PESO",true],["","66658","CARCÇA D 100.003396","FUNDIÇÃO","","","160","124","SEM PESO",true],["","66678","TARUGO 19 X 500","FUNDIÇÃO","","1.4800000000000002","4.44","1.95","SEM PESO",true],["","66679","TARUGO 26 X 500","FUNDIÇÃO","","3.61","10.83","1.97","SEM PESO",true],["","66681","TARUGO 22 X 500","FUNDIÇÃO","","","2.5","1.35","SEM PESO",true],["","66683","LASTRO PAULISTANO","FUNDIÇÃO","",12.23,"12.23","11.06","SEM PESO",true],["","66435","JB 150 ANEL","FUNDIÇÃO","","","1.75","0.71","SEM PESO",true],["","66540","JB 163 ANEL","FUNDIÇÃO","","","3.3","1.72","SEM PESO",true],["","66436","JB 187 ANEL","FUNDIÇÃO","","","1.58","0.86","SEM PESO",true],["","66686","ANEL DO FREIO","FUNDIÇÃO","",1.39,"2.78","0.88","SEM PESO",true],["","65931","PORCA WPR ESQUERDA","FUNDIÇÃO","","","4.43","2.2","SEM PESO",true],["","65932","PORCA WPR DIREITA","FUNDIÇÃO","","","4.43","2.2","SEM PESO",true],["","65627","BRAÇO FUNDIDO","FUNDIÇÃO","",8.07,"8.07","5.07","SEM PESO",true],["","64296","FUN054 PONTEIRO TAM40","FUNDIÇÃO","","2.6","5.2","3.4","SEM PESO",true],["","66684","TAMPA FUNDIDA","FUNDIÇÃO","","","31.84","25.4","SEM PESO",true],["","66685","ARO FUNDIDO","FUNDIÇÃO","","","84.68","75.3","SEM PESO",true],["","66189","CIL AP GARDENER DENVER","FUNDIÇÃO","","","20.58","17.4","SEM PESO",true],["","66636","TAMPA 6012","FUNDIÇÃO","","","5.2","3.8","SEM PESO",true],["","63935","BUCHA 95 X 70","FUNDIÇÃO","","","11","7","SEM PESO",true],["","66635","TAMPA 6010","FUNDIÇÃO","","","5.22","4","SEM PESO",true],["","66691","CUBO LIMITADOR","FUNDIÇÃO","","","7.64","5.82","SEM PESO",true],["","66695","MANCAL","FUNDIÇÃO","","","8.34","5.1","SEM PESO",true],["","66696","ALÇA","FUNDIÇÃO","","","9.64","9.52","SEM PESO",true],["","66697","BIELA PEQUENA","FUNDIÇÃO","","","3.22","1.3","SEM PESO",true],["","66698","BASE 1","FUNDIÇÃO","","","30.21","24.98","SEM PESO",true],["","66699","BIELA GRANDE","FUNDIÇÃO","","","4.42","2.1","SEM PESO",true],["","66700","VOLANTE","FUNDIÇÃO","","","53.6","43.82","SEM PESO",true],["","66701","BASE 2","FUNDIÇÃO","","","49.69","37.25","SEM PESO",true],["","66694","SUSPENSAO EM V","FUNDIÇÃO","","","3.84","2.3","SEM PESO",true],["","66703","SUSPENSAO EM V ASSIMETRICA","FUNDIÇÃO","","","5.14","3.5","SEM PESO",true],["","66693","GAVETA PTM25-04","FUNDIÇÃO","","","11.2","8.5","SEM PESO",true],["","63820","PLACA MIL 2","FUNDIÇÃO","","","6.18","4.38","SEM PESO",true],["","63688","PLACA MIL 75","FUNDIÇÃO","",0.455625,"7.29","4.16","SEM PESO",true],["","63424","PLACA MIL 26","FUNDIÇÃO","","","4.27","3.08","SEM PESO",true],["","63416","PLACA MIL 41","FUNDIÇÃO","","","5.18","2.8","SEM PESO",true],["","66704","PLACA 151","FUNDIÇÃO","","","10.55","8.52","SEM PESO",true],["","66706","CAMISA 020","FUNDIÇÃO","","","5.68","4.22","SEM PESO",true],["","66705","PLACA 223","FUNDIÇÃO","","","10.96","10.4","SEM PESO",true],["","66707","CORPO VALVULA FUNDO LINHA 2X1.1X/2","FUNDIÇÃO","","","9.4","7.5","SEM PESO",true],["","66719","PEÇA CLORANDO 1-1","FUNDIÇÃO","","","4.27","1.28","SEM PESO",true],["","66718","PEÇA  CLORANDO 1","FUNDIÇÃO","","","11.04","5.52","SEM PESO",true],["","66717","PEÇA CLORANDO 2-2","FUNDIÇÃO","","","7.32","2.2","SEM PESO",true],["","66716","PEÇA CLORANDO 2-2","FUNDIÇÃO","","","7.52","3.76","SEM PESO",true],["","66702","VOLANTE TIPO Y 300M","FUNDIÇÃO","","","7.14","5","SEM PESO",true],["","66708","NR 15 BUCHA 310 X 295 X 110","FUNDIÇÃO","","","18.7","13.12","SEM PESO",true],["","64289","NR 13 BUCHA 270 X 240","FUNDIÇÃO","","","25.08","32.4","SEM PESO",true],["","64289/02","NR 13 BUCHA 270 X 240","FUNDIÇÃO","","","23.1","16.2","SEM PESO",true],["","64516","NR 88 BUCHA 235 X 207","FUNDIÇÃO","","","18.14","29.8","SEM PESO",true],["","66137","NR 11 BUCHA 250 X 220","FUNDIÇÃO","","","30","20","SEM PESO",true],["","64495","NR 08 BUCHA 215 X 190","FUNDIÇÃO","","","17.9","14.7","SEM PESO",true],["","65595","NR 05 BUCHA 190 X 160","FUNDIÇÃO","","","8.36","11.42","SEM PESO",true],["","66724","DISCO FREIO ITALIANO DIANTEIRO","FUNDIÇÃO","","","6.56","4.2","SEM PESO",true],["","66437","JB 253 ANEL FUNDIDO","FUNDIÇÃO","","","1.88","0.6","SEM PESO",true],["","66721","1524 PUXADOR EM V 4.81.10VX/602-060","FUNDIÇÃO","","","3.18","1.06","SEM PESO",true],["","66722","1525 BASTAO PUX 4.81.10.VX","FUNDIÇÃO","","","4.14","2.24","SEM PESO",true],["","66731","CORPO 1 FUNDIDO","FUNDIÇÃO","","","17.7","3.4","SEM PESO",true],["","66730","DISCO 8 FUROS FUNDIDO","FUNDIÇÃO","","","20.2","3.4","SEM PESO",true],["","66729","CORPO T FUNDIDO","FUNDIÇÃO","","","36.86","6.35","SEM PESO",true],["","66728","CORPO 2 FUNDIDO","FUNDIÇÃO","","","24.16","4.6","SEM PESO",true],["","65561","NR 82 BUCHA MIL 175 X 148 MM","FUNDIÇÃO","","","15.94","11.74","SEM PESO",true],["","65562","NR 85 BUCHA MIL 208 X 180 MM","FUNDIÇÃO","","","17.52","12.92","SEM PESO",true],["","66726","PEÇA V MINI FUNDIDA","FUNDIÇÃO","","","11.26","0.95","SEM PESO",true],["","61608","ANEL BATENTE D.228,30","FUNDIÇÃO","",8.32,"8.32","6.52","0",true],["","66734","PLACA VALVULA 247 FUNDIDA","FUNDIÇÃO","","","4.44","3.34","SEM PESO",true],["","66735","PLACA VALVULA 159 FUNDIDA","FUNDIÇÃO","","","6.86","5.7","SEM PESO",true],["","66720","VOLANTE TIPO Y -T10 DIAM.500","FUNDIÇÃO","","","10.56","7","SEM PESO",true],["","65454","SACADOR DE EMBREAGEM","FUNDIÇÃO","","","8.32","6.2","SEM PESO",true],["","66750","CASTELO PARA REFRIG 5\"&6\" BRUTO","FUNDIÇÃO","","","23.22","17.4","SEM PESO",true],["","66748","CASTELO PARA REFRIG 2.1/2 \"&3\" BRUTO","FUNDIÇÃO","","","28.26","19.48","SEM PESO",true],["","66747","CASTELO PARA REFRIG 1.1/2 \"&2\" BRUTO","FUNDIÇÃO","","","17.4","12.48","SEM PESO",true],["","62316","NR 17 BUCHA MIL 320 X 280 MM","FUNDIÇÃO","","","36.2","25.92","SEM PESO",true],["","66751","DISCO KD 90","FUNDIÇÃO","",1.73,"3.46","2","SEM PESO",true],["","63893","PLACA MIL 91","FUNDIÇÃO","","","2.88","1.68","SEM PESO",true],["","66756","PET 430 TAMPA CABEÇOTE DUPLO","FUNDIÇÃO","",3.6225,"14.49","3.4","0",true],["","66752","TAMPAO CEGO COD.324 COPELAND","FUNDIÇÃO","","","8.8","4.4","SEM PESO",true],["","66753","TAMPAO CEGO COD.325 BOCK","FUNDIÇÃO","","","5.8","2.9","SEM PESO",true],["","66755","TAMPAO CEGO COD.326 BITZER","FUNDIÇÃO","","","6.68","3.14","SEM PESO",true],["","66233","COLETOR MAIOR FUNDIDO","FUNDIÇÃO","","","20.61","11.48","SEM PESO",true],["","66759","GIRO P/ PUXADOR DE CORDA","FUNDIÇÃO","","","5.77","2.64","SEM PESO",true],["","64201","NR 61 BUCHA MIL 75 X 55 MM","FUNDIÇÃO","","","11.55","8.94","SEM PESO",true],["","64466","NR 79 BUCHA MIL 157 X 130 MM","FUNDIÇÃO","","","11.25","9.56","SEM PESO",true],["","66770","MANCHETA ML NR 01 FUNDIDA","FUNDIÇÃO","","","17.7","13.98","SEM PESO",true],["","61744","2A BASE FIXA MBB 550/800A MBB004","FUNDIÇÃO","","","4.9","3","SEM PESO",true],["","61743","1A BASE FIXA MBB1000/1850A BB013","FUNDIÇÃO","","","5.14","3.78","SEM PESO",true],["","66237","COTOVELO SAE J431C G300","FUNDIÇÃO","","","6.56","4.64","SEM PESO",true],["","COPO GRANDE","COPO GRANDE","FUNDIÇÃO","","","0","0","SEM PESO",true],["","COPOS M E P","COPOS M E P","FUNDIÇÃO","","","0","0","SEM PESO",true],["","66761","PLACA VALV.COD.205 CARRIER","FUNDIÇÃO","","","4.34","2.59","SEM PESO",true],["","66768","TAMPAO CEGO FERRO COD.327","FUNDIÇÃO","","","4.45","1.77","SEM PESO",true],["","63643","VOLANTE INF.VALVULA FUNDO 3X2","FUNDIÇÃO","","2.86","2.86","1.36","SEM PESO",true],["","62379","PL0399011 INJETOR DIRECIONAL 2","FUNDIÇÃO","","3.3","6.6","2.08","SEM PESO",true],["","65762","LINGUETA RF/RD MOLDE 205.041","FUNDIÇÃO","","","8.81","4.32","SEM PESO",true],["","66764","PLACA VALV.COD.180 COPELAND","FUNDIÇÃO","","","8.9","6.74","SEM PESO",true],["","66769","TAMPA VISOR COD.COPELAND 3D","FUNDIÇÃO","","","10.42","5.76","SEM PESO",true],["","66766","PLACA VALV.COD.176 BLOCO V","FUNDIÇÃO","","","8.72","7.1","SEM PESO",true],["","66765","PLACA VALV.COD.171 COPELAND","FUNDIÇÃO","","","8.5","6.62","SEM PESO",true],["","66763","PLACA LIG.COD.214 COPELAND","FUNDIÇÃO","","","4.96","3.66","SEM PESO",true],["","66762","PLACA VALV.COD.159 A BITZER","FUNDIÇÃO","","","8.28","7.34","SEM PESO",true],["","66767","CAMISA COD.128 BITZER","FUNDIÇÃO","","","4.06","3.56","SEM PESO",true],["","66778","POTE DE 10 FUNDIDO","FUNDIÇÃO","","","4.57","4","SEM PESO",true],["","66784","TP-90 TAMPA FECHADA","FUNDIÇÃO","",4.36,"4.36","3.72","SEM PESO",true],["","65403","BUCHA SOP D175","FUNDIÇÃO","","","6.4","5.4","SEM PESO",true],["","66335","NR 90 BUCHA MIL 295 X 245 MM","FUNDIÇÃO","","","34","33.48","SEM PESO",true],["","66787","M30019 MOLDE Q-355B TAMPA FRONTAL","FUNDIÇÃO","","","4.66","3.4","SEM PESO",true],["","66785","M30018 MOLDE Q-355B ANEL DO ROTOR","FUNDIÇÃO","","","4.72","2.28","SEM PESO",true],["","66786","M30020 MOLDE Q-355B BASE","FUNDIÇÃO","","","5.4","3","SEM PESO",true],["","62851","Y4046BR BASE FUNDIDA","FUNDIÇÃO","",1.02,"6.12","3.36","SEM PESO",true],["","66167","BISCATE 10 KG","FUNDIÇÃO","",5.41,"5.41","4.05","SEM PESO",true],["","63302","D209C ROLO DE APOIO MENOR","FUNDIÇÃO","","","24.32","18.9","SEM PESO",true],["","63841","NR 71 BUCHA MIL ( 115 X 95 MM )","FUNDIÇÃO","","3.62","7.24","1","SEM PESO",true],["","66794","301G50000031 VOLANTE 1/2 A 3/4 BRUTO","FUNDIÇÃO","","","5.32","3","SEM PESO",true],["","66804","46353348 MASSA AMORTEC COMANDO CAMBIO","FUNDIÇÃO","",0.554,"5.54","0.42","0.42",true],["","66727","PEÇA V MAIOR","FUNDIÇÃO","","","5.57","2.4","SEM PESO",true],["","66805","MANCHETA ML N2 FUNDIDA","FUNDIÇÃO","","","23.8","18.2","SEM PESO",true],["","66782","PLACA VALV. COD. 118B 549.005.080","FUNDIÇÃO","","","0","0","SEM PESO",true],["","66783","CAMISA COD. 126 BITZER","FUNDIÇÃO","","","5.32","3.52","SEM PESO",true],["","66807","PEÇA Q-3655.001 ( M30016 PANELA - Q292A )","FUNDIÇÃO","","","4.42","3","SEM PESO",true],["","66813","BUCHA NR92 BUCHA MIL 360X315MM","FUNDIÇÃO","","","47.2","35.4","SEM PESO",true],["","66808","46349362 LEVA COMANDO","FUNDIÇÃO","",0.32,"3.84","2.52","0.16",true],["","66809","46353119 MASSA SMORZANTE","FUNDIÇÃO","","0.9630000000000001","9.63","7.3","SEM PESO",true],["","66810","46353120 MASSA SMORZANTE","FUNDIÇÃO","","","8.98","5.3","SEM PESO",true],["","66812","BUCHA MIL","FUNDIÇÃO","","","15.76","12.36","SEM PESO",true],["","66800","VOLANTE TIPO Y-T10 DIAM 400MM","FUNDIÇÃO","","","4.86","4.21","SEM PESO",true],["","63415","PLACA MIL 4","FUNDIÇÃO","","","2.36","1.44","SEM PESO",true],["","63892","PLACA MIL 95","FUNDIÇÃO","","","1.95","0.99","SEM PESO",true],["","66798","TAMPA - C0133","FUNDIÇÃO","",5.51,"22.04","17.64","SEM PESO",true],["","66799","CARCAÇA -C0070","FUNDIÇÃO","","","24.78","14","SEM PESO",true],["","66802","ALAVANCA VALV.ESF M3 3-1/8 3M","FUNDIÇÃO","","","7.82","8","SEM PESO",true],["","64436","224HPB CASQUILHO","FUNDIÇÃO","","","4.68","3.6","SEM PESO",true],["","62777","227DA SUPORTE FUNDIDO","FUNDIÇÃO","",4.8375,"19.35","16.36","SEM PESO",true],["","66811","301G50000009 CAST.REFR.8\" & 10\" BRUTO","FUNDIÇÃO","","","57.94","44.73","SEM PESO",true],["","66788","PEÇA 32-87-0-002","FUNDIÇÃO","","","27.5","23.06","SEM PESO",true],["","66779","VOLANTE 700 60468","FUNDIÇÃO","","","18.72","15.6","SEM PESO",true],["","62630","00170AC ALAVANCA","FUNDIÇÃO","","","5.59","4.32","SEM PESO",true],["","66803","VOLANTE CIRCULAR DIAM 560","FUNDIÇÃO","","","16.28","12.6","SEM PESO",true],["","66169","BISCATE","FUNDIÇÃO","","","18.34","21.57","SEM PESO",true],["","66780","VOLANTE 860 59714 FUNDIDO VE 5-1/8","FUNDIÇÃO","","","25.4","18","SEM PESO",true],["","65625","GARRA PLACA SEGTO CURVA TIPO C 06300182","FUNDIÇÃO","","","2.73","1.12","SEM PESO",true],["","60406","PL0306005 VOLANTE SUP.P/VALV.3X2 E 4X3","FUNDIÇÃO","","0.855","3.42","2","SEM PESO",true],["","60263","4037 SUPERIOR 80 mm","FUNDIÇÃO","","","2.12","1.12","SEM PESO",true],["","65851","LINGUETA RD 20.082","FUNDIÇÃO","","","3.39","1.35","SEM PESO",true],["","66831","CRUZAMENTO RIGIDO DE 45°","FUNDIÇÃO","","","7.38","4.92","SEM PESO",true],["","66833","DISCO TRAZEIRO THUNDER FUNDIDO E USINADO","FUNDIÇÃO","","","3.36","2","SEM PESO",true],["","62735","CORPO DA BOMBA P/GLP","FUNDIÇÃO","","","9.78","7.34","SEM PESO",true],["","66099","BUCHA COR D124","FUNDIÇÃO","","","5.79","4.84","SEM PESO",true],["","63831","PLACA MIL 80","FUNDIÇÃO","","","6.58","4.4","SEM PESO",true],["","63587","PLACA MIL 20","FUNDIÇÃO","","","8.8","7.6","SEM PESO",true],["","63821","PLACA MIL 11","FUNDIÇÃO","","","6.36","3.6","SEM PESO",true],["","63867","PLACA MIL 33","FUNDIÇÃO","","","4.35","1.68","SEM PESO",true],["","66822","TEM 2707 PISTAO DE FREIO","FUNDIÇÃO","","","10.28","7.2","SEM PESO",true],["","66835","CHAPA TRASEIRA","FUNDIÇÃO","","2.69","5.38","3.08","SEM PESO",true],["","66836","PLACA MOVEL-IRMAO","FUNDIÇÃO","","0.35","3.5","1.6","SEM PESO",true],["","65467","224HR PEÇA","FUNDIÇÃO","","","10.32","6.66","SEM PESO",true],["","62632","00227GS GARFO DE EMBREAGEM","FUNDIÇÃO","","","3.23","1.28","SEM PESO",true],["","66819","TEM PLACA 274","FUNDIÇÃO","","","13.54","5.7","SEM PESO",true],["","66841","OEF 8304 TUBULAR","FUNDIÇÃO","","","16.14","11.3","SEM PESO",true],["","65394","NR 80 BUCHA MIL 157 X 132 mm","FUNDIÇÃO","","","13.86","9.56","SEM PESO",true],["","66846","BUCHA 545 X 102 FOFO","FUNDIÇÃO","","","79.8","59.82","SEM PESO",true],["","66844","SUPORTE 23R422553","FUNDIÇÃO","","","39.84","26","SEM PESO",true],["","66849","OEF 13074 (13898) TUBULAR","FUNDIÇÃO","","","30","16.66","SEM PESO",true],["","66850","OEF 13075 (13899) TUBULAR","FUNDIÇÃO","","","30","16.66","SEM PESO",true],["","62274","22599 BUCHA","FUNDIÇÃO","",0.378571429,"5.3","2.24","SEM PESO",true],["","66851","IN-713692 ADAPATADOR 15A","FUNDIÇÃO","","","5.72","4","SEM PESO",true],["","65808","03.315 CURVA PARA  TUBO 3/4\" PARTE 1","FUNDIÇÃO","","","3.53","2.24","SEM PESO",true],["","65809","30316 GANCHO PARA TUBO 3/4\" PARTE 2","FUNDIÇÃO","","","3.07","1.92","SEM PESO",true],["","66853","TAMPA TMS FUNDIDA","FUNDIÇÃO","","","8.5","5","SEM PESO",true],["","65032","PTM25-01 CORPO S-200","FUNDIÇÃO","","","47.52","39.64","SEM PESO",true],["","63331","PTM2-C1 BUCHA","FUNDIÇÃO","","","6.9","5.2","SEM PESO",true],["","66855","SAPATAS FUNDIDAS","FUNDIÇÃO","","","2.74","10","SEM PESO",true],["","66847","SUPORTE 23G.422.553.D","FUNDIÇÃO","","","14.9","9","SEM PESO",true],["","66848","SUPORTE 23G.422.553.E","FUNDIÇÃO","","","79.72","44","SEM PESO",true],["","66856","LINGOTEIRA FERRO","FUNDIÇÃO","","","27","16","SEM PESO",true],["","66318","PONTEIRA ESPACADORA ISOLADOR 04.0023","FUNDIÇÃO","",1.82,"3.64","2","SEM PESO",true],["","65404","BUCHA SOP D175","FUNDIÇÃO","","","6.4","5.4","SEM PESO",true],["","66858","3N-691730 PEÇA FUNDIDA","FUNDIÇÃO","","","7.7","5.28","SEM PESO",true],["","66859","SUPORTE GAS BOX 23R253319 D/E","FUNDIÇÃO","","","26","16.2","SEM PESO",true],["","66319","PONTE PARA MANHOLE NR3","FUNDIÇÃO","","","7.52","4.7","SEM PESO",true],["","65033","PTM28-04 GAVETA S-200","FUNDIÇÃO","","","10.74","8.78","SEM PESO",true],["","66860","3N-59804 PEÇA FUNDIDA CONFORME MODELO","FUNDIÇÃO","","","14.37","9.34","SEM PESO",true],["","66861","MP-154-050 CORREDIÇA LG ESQUERDA 178mm","FUNDIÇÃO","","","4.32","2.6","SEM PESO",true],["","64026","CLIP PARA GUIA T161 001674","FUNDIÇÃO","","","5.14","2.6","SEM PESO",true],["","66881-3","PEÇA Nº1","FUNDIÇÃO","","","7.03","4.92","SEM PESO",true],["","66881-4","PEÇA Nº2","FUNDIÇÃO","","","8.43","5.9","SEM PESO",true],["","66881-1","PEÇA N°01","FUNDIÇÃO","","","13.53","0","SEM PESO",true],["","66882","PET457  ESTICADOR DE CORREIA FU/US MOD NOVO","FUNDIÇÃO","",2.035,"8.14","5.68","1.58",true],["","64490","NR 06 BUCHA MIL 200 X 170 MM","FUNDIÇÃO","","","9.17","7.52","SEM PESO",true],["","64467","NR 07 BUCHA MIL 210 X 189 MM","FUNDIÇÃO","","","19.88","11.93","SEM PESO",true],["","64478","NR 04 BUCHA MIL 175 X 150 MM","FUNDIÇÃO","","","19.1","14.1","SEM PESO",true],["","66880","22600094 FOFO B77-12(12602264 HAND)","FUNDIÇÃO","","","4.08","2.4","SEM PESO",true],["","66515","BISCATE 90KG","FUNDIÇÃO","","72.86","72.86","51","SEM PESO",true],["","66884","NR 16 BUCHA 315 X 285 X 190","FUNDIÇÃO","","","28","19.6","SEM PESO",true],["","66885","NR 93 BUCHA 164 X 132 X 225","FUNDIÇÃO","","","17.43","12.2","SEM PESO",true],["","65330","ANCORA 134-65A","FUNDIÇÃO","","","4.82","2.96","SEM PESO",true],["","65331","CASTANHA ANCORA ESQ 134-68","FUNDIÇÃO","","","5.64","1.36","SEM PESO",true],["","65332","CASTANHA ANCORA DIR 134-66A","FUNDIÇÃO","","","2.82","0.68","SEM PESO",true],["","66893","MANCAL MONOBLOCO TIPO FLANGE","FUNDIÇÃO","","","5.16","3.6","SEM PESO",true],["","65575","DISCO MEGA SIX SPEED","FUNDIÇÃO","","","4.17","3","SEM PESO",true],["","66294","BRN -2019-007-001 BASE FUNDIDA","FUNDIÇÃO","","","107.4","80","SEM PESO",true],["","63528","80-014-3 CANAL DA SERPENTINA( CARCAÇA)","FUNDIÇÃO","",6.01,"12.02","7.64","SEM PESO",true],["","63100","80-007-3 CANAL DE SERPENTINA ( CAIXA AR)","FUNDIÇÃO","","1.88","7.52","5.2","SEM PESO",true],["","66899","80-006-3 CANAL DE SERPENTINA( CARCAÇA)","FUNDIÇÃO","",4.66,"9.32","5.46","SEM PESO",true],["","66881","BISCATE 5 KG","FUNDIÇÃO","","5","5","13","SEM PESO",true],["","66894","80-015-3 CANAL DA SERPENTINA ( CAIXA AR)","FUNDIÇÃO","",3.54,"7.08","2.4","SEM PESO",true],["","66300","ANEL DE SEGMENTO 150,60X144,80X18,20MM","FUNDIÇÃO","","","18.5","0.25","0.18",true],["","63846","MC-6004 MANCAL","FUNDIÇÃO","","","4.2","3.2","SEM PESO",true],["","66896","80-003-3 CANAL DE SERPENTINA ( CAIXA AR)","FUNDIÇÃO","",1.3825,"5.53","3.6","SEM PESO",true],["","63689","80-004-3 CANAL DE SERPENTINA ( CARCAÇA)","FUNDIÇÃO","",3.22,"6.44","3.6","SEM PESO",true],["","66906","DISCO ALETADO 150 mm 30P0005007-02","FUNDIÇÃO","","","3.41","2","SEM PESO",true],["","66907","SUPORTE P/ FREIO WFM-250 30P0004001-03","FUNDIÇÃO","","10.23","10.23","6.14","SEM PESO",true],["","66902","80-012-3 CANAL DE SERPENTINA (DIVISAO)","FUNDIÇÃO","","","4.44","2","SEM PESO",true],["","66900","80-009-3 CANAL DE SERPENTINA (CARCAÇA)","FUNDIÇÃO","","","5.12","2.2","SEM PESO",true],["","66901","80-011-3 CANAL DE SERPENTINA (CARCAÇA)","FUNDIÇÃO","","","8.87","5.92","SEM PESO",true],["","63793","PLACA MIL 74","FUNDIÇÃO","","","8.7","2.68","SEM PESO",true],["","63399","PLACA MIL 29","FUNDIÇÃO","","","1.8","1.2","SEM PESO",true],["","66904","44076-1 TAMPA ATUADOR NV12 FUNDIDA","FUNDIÇÃO","","","22.3","17.06","SEM PESO",true],["","66905","44078-1 BASE ATUADOR NV12 FUNDIDA","FUNDIÇÃO","","","24.38","19.12","SEM PESO",true],["","66897","80-010-3 CANAL DA SERPENTINA ( CAIXA AR )","FUNDIÇÃO","",5.0,"10","5","SEM PESO",true],["","66898","80-002-3 CANAL DE SERPENTINA ( CARCAÇA )","FUNDIÇÃO","","","4.2","1.7","SEM PESO",true],["","66881-5","MODELO 02.008.0","FUNDIÇÃO","","","18","0","SEM PESO",true],["","66881-6","MODELO 02.007.0","FUNDIÇÃO","","","18","0","SEM PESO",true],["","66895","80-001-3 CANAL DE SERPENTINA(CAIXA AR)","FUNDIÇÃO","","","6.8","3.4","SEM PESO",true],["","66862","CARCAÇA RAILTEC","FUNDIÇÃO","","","7.88","5.43","SEM PESO",true],["","66863","MAENTE/TAMPA RAILTEC","FUNDIÇÃO","","","3.63","1.86","SEM PESO",true],["","64614","MP-156-011 GRAMPO DE SUSPENSAO PARA FIO","FUNDIÇÃO","",1.048837209,"2.05","1.32","SEM PESO",true],["","63822","PLACA MIL 7","FUNDIÇÃO","","","4.68","3","SEM PESO",true],["","63776","PLACA MIL 27","FUNDIÇÃO","","","3.18","1.8","SEM PESO",true],["","63607","704.051 PORCA MANGA EIXO FREIORAR M39X1,5","FUNDIÇÃO","",0.448333333,"5.38","2.24","0.22",true],["","66909","CHAPA FUNDIDA 12,7X100X300 mm","FUNDIÇÃO","","","4.8","2.86","SEM PESO",true],["","66911","BUCHA DIAM 185- EVOLUTION","FUNDIÇÃO","",7.02,"7.02","4.3","SEM PESO",true],["","66913","02-007-0 CARCAÇA","FUNDIÇÃO","",5.76,"5.76","4.31","SEM PESO",true],["","66914","02-008-0 CARCAÇA","FUNDIÇÃO","","5.8","5.8","4.1","SEM PESO",true],["","66915","20.240 ALAVANCA TRAVA PISO DOUBLE DECK","FUNDIÇÃO","","","5.01","23.2","SEM PESO",true],["","66908","PET480F VOLANTE 520mm BOOSTER","FUNDIÇÃO","","57.2","57.2","44.08","SEM PESO",true],["","66912","DISCO DE FREIO WFM-20F","FUNDIÇÃO","","6.97","6.97","5.6","SEM PESO",true],["","65791","GRAMPO MENOR DE SUSPENÇÃO PARA FIO","FUNDIÇÃO","",0.2575,"1.03","1","SEM PESO",true],["","66916","110G3 - CONTRA PESO","FUNDIÇÃO","","","4.06","0.11","SEM PESO",true],["","66564","CASTELO AQUECIMENTO VBVO 1 1.2 E 2","FUNDIÇÃO","","","17.24","14.92","SEM PESO",true],["","66917","MANCAL MENOR FUNDIDO","FUNDIÇÃO","","","6.51","4.12","SEM PESO",true],["","66918","MANCAL MAIOR FUNDIDO","FUNDIÇÃO","","","8.84","6.22","SEM PESO",true],["","65243","BUCHA SOP D250","FUNDIÇÃO","","","5.41","9.16","SEM PESO",true],["","65773","CALOTA PROTETORA DES. FE-0359","FUNDIÇÃO","","","3.78","2.13","SEM PESO",true],["","65772","BASE ISOLADOR DES. FE-0358","FUNDIÇÃO","","","5.62","4.38","SEM PESO",true],["","66920","FUNDIDO DE CARCAÇA","FUNDIÇÃO","","","17.76","13","SEM PESO",true],["","66921","FLANGE MH-1 E MH-2","FUNDIÇÃO","","","7.38","3.76","SEM PESO",true],["","66919","VOLANTE TIPO Y 400 25252-2","FUNDIÇÃO","","","5.1","3.3","SEM PESO",true],["","66927","PET 463F FUND PISTAO 73MM BSCW40","FUNDIÇÃO","","","6.18","3.98","SEM PESO",true],["","66928","PET 482F FUND PISTAO AP 2.1/2 ALT MAIOR","FUNDIÇÃO","","","12.06","9.44","SEM PESO",true],["","62256","MPO74108 DISCO PBA-155 Z133016","FUNDIÇÃO","","","6.54","9.5","SEM PESO",true],["","62311","BUCHA DO ROLO MAIOR","FUNDIÇÃO","","","13","1.98","SEM PESO",true],["","66930","BASE DO POSTE","FUNDIÇÃO","","","8.92","5","SEM PESO",true],["","66931","CORPO DE ADMISSAO 001-305627","FUNDIÇÃO","","","10","3","SEM PESO",true],["","66923","PISTAO 73 MM","FUNDIÇÃO","","","5","1.8","SEM PESO",true],["","66929","PISTAO 100 MM","FUNDIÇÃO","","","7.84","2.65","SEM PESO",true],["","66924","PLACA DISSIPADORA DE CALOR -915-143","FUNDIÇÃO","","","5.45","3","SEM PESO",true],["","63844","VV 130 BIELA VV 160 3 CILINDROS","FUNDIÇÃO","","","1.6","1","SEM PESO",true],["","66932","SINO/BADALO","FUNDIÇÃO","","","3.72","2","SEM PESO",true],["","63772","VV112 BLOCO CILINDRO VV160","FUNDIÇÃO","","","21.47","19.1","SEM PESO",true],["","66934","COLETOR FUNDIDO","FUNDIÇÃO","","","6.9","4.68","SEM PESO",true],["","66935","LINGOTEIRA WORK METAL","FUNDIÇÃO","",25.51,"25.51","23.64","SEM PESO",true],["","64273","VV139 VIRABREQUIM VV160","FUNDIÇÃO","","","21.84","13","SEM PESO",true],["","66168","BISCATE 20 KG","FUNDIÇÃO","","14.13","14.13","10.6","SEM PESO",true],["","66940","POLIA  07W260810M","FUNDIÇÃO","","","16.28","11.4","SEM PESO",true],["","66939","MANCAL D13 FUNDIDA","FUNDIÇÃO","",7.31,"14.62","5.25","SEM PESO",true],["","66941","PANELA - FUNDO","FUNDIÇÃO","","","2.72","1.76","SEM PESO",true],["","66942","PANELA-TAMPA","FUNDIÇÃO","","","2.74","1.76","SEM PESO",true],["","66943","PRESILHA PARA TRILHO A75","FUNDIÇÃO","","","12.87","8","SEM PESO",true],["","66947","DISCO DE FRENAGEM WFM-20SH","FUNDIÇÃO","","","5.39","3.92","SEM PESO",true],["","66946","PET471 FLANGE ROLAMENTO CARTER BSCW40","FUNDIÇÃO","",1.965,"3.93","1.19","0.6",true],["","66945","PET470 TAMPA TRASEIRA BSCW40","FUNDIÇÃO","",9.5,"9.5","7.84","0",true],["","2","FF36030100 BASE INFERIOR","FUNDIÇÃO","","","21.18","18.2","SEM PESO",true],["","66948","PRESILHA PARA TRILHO TR25","FUNDIÇÃO","","","5.167","3.75","SEM PESO",true],["","65807","22101322 CABEÇA DE SOPRO 4050-1-3-28","FUNDIÇÃO","","","5.6","3.5","SEM PESO",true],["","66951","MANCAL K-19 CUMMINS","FUNDIÇÃO","","","22.18","16.42","SEM PESO",true],["","66949","PRESILHA PARA TRILHO 45/50/57/60/68","FUNDIÇÃO","","","10.66","7.6","SEM PESO",true],["","65405","BUCHA SOP D195","FUNDIÇÃO","","","6.5","5.48","SEM PESO",true],["","66845","ANEL DE SEGMENTO","FUNDIÇÃO","","","4.63","1.85","0",true],["","66958","1690 0003 MANCAL 1.1/2\" - 2\"","FUNDIÇÃO","","","7.36","4.8","SEM PESO",true],["","66959","1690 0004 MANCAL 2.1/2\" - 3\"","FUNDIÇÃO","","","9.82","6.8","SEM PESO",true],["","66960","1690 0016 MANCAL 4\"","FUNDIÇÃO","","","18.5","13.2","SEM PESO",true],["","66968","MP05.00063 SUPORTE DA CALHA DES 3N-57697","FUNDIÇÃO","","","4","2.36","SEM PESO",true],["","66956","ESPIRAL","FUNDIÇÃO","","1.7","1.7","1.02","SEM PESO",true],["","66961","CARREGADOR DE FACAS \"PALLMANN\"","FUNDIÇÃO","","","23.48","18.54","SEM PESO",true],["","63157","2IN-111486 SUPORTE BASCULANTE DO DISCO","FUNDIÇÃO","","","73.8","53","SEM PESO",true],["","63156","2IN-111457 SUPORTE DIO REDUO","FUNDIÇÃO","","","31.24","21.87","SEM PESO",true],["","66973","CARCAÇA C-2320-0000200-0214","FUNDIÇÃO","","","62.6","42.73","SEM PESO",true],["","66975","TAMPA DO MANCAL M 440 DES.722-2-058-R1","FUNDIÇÃO","","","10.08","9","SEM PESO",true],["","66976","PA REGISTRO AXIAL DES-E-026-1-N1-114-85","FUNDIÇÃO","","","9.88","7.82","SEM PESO",true],["","66974","CORPO DO MANCAL M 440 DES 000-2-055-R","FUNDIÇÃO","","","96.76","75","SEM PESO",true],["","66981","CASTELO AQUECIMENTO 4\"","FUNDIÇÃO","","","26.34","10.17","SEM PESO",true],["","66982","CAIXA DE ROLAMENTO B7696","FUNDIÇÃO","","","5.5","3.48","SEM PESO",true],["","64642","CH774-A DISCO DE FREIO ANTIGO","FUNDIÇÃO","","","4.2","2.3","SEM PESO",true],["","66980","MANCAL D26 VM FUNDIDO","FUNDIÇÃO","",4.8,"9.6","7.38","SEM PESO",true],["","66977","PA RESGITRO AXIAL DES.E-029-1-N1-125-89","FUNDIÇÃO","","","6.32","3.4","SEM PESO",true],["","61173","PEÇA FUND CONF.MOD AMOSTRA","FUNDIÇÃO","","","57.3","40","SEM PESO",true],["","62540","FF3618000004 BASE","FUNDIÇÃO","",12.37,"24.74","18.4","SEM PESO",true],["","64416","MANGOTE 4\"","FUNDIÇÃO","","","7.45","5.2","SEM PESO",true],["","66969","REFORÇO ADAPTAVEL PARA MOLDES","FUNDIÇÃO","","","5.54","3.5","SEM PESO",true],["","66993","LONGARINA SPOT DIREITA","FUNDIÇÃO","","","12.46","4.28","SEM PESO",true],["","66994","LONGARINA SPOT ESQUERDA","FUNDIÇÃO","","","12.46","4.28","SEM PESO",true],["","66995","TRILHO EM FERRO PRD17617","FUNDIÇÃO","","","6.81","2.95","SEM PESO",true],["","66996","PESO DO LASTRO","FUNDIÇÃO","","","21.28","19","SEM PESO",true],["","63615","MP05.00079 DODY CASTIN 46 DESN4N-9610369","FUNDIÇÃO","",40.62,"40.62","31","SEM PESO",true],["","63909","MP05.00091 CORPO 26C DES 4N-9708023","FUNDIÇÃO","","","16.86","11.53","SEM PESO",true],["","67000","BIELA FUNDIDA","FUNDIÇÃO","","","7.67","5.38","SEM PESO",true],["","66997","ELEMENTO ROSCADO MH-0","FUNDIÇÃO","","","7.97","6","SEM PESO",true],["","66999","CARRO MH-0","FUNDIÇÃO","","","7.85","5.4","SEM PESO",true],["","65468","224 HPA PEÇA","FUNDIÇÃO","","","8.22","6.28","SEM PESO",true],["","67005","BUCHA DIAM 250 - RETIFICA ITATIBA","FUNDIÇÃO","",4.29,"4.29","2.29","SEM PESO",true],["","66998","CORPO MH-0","FUNDIÇÃO","","","12.96","10","SEM PESO",true],["","63961","REDUÇAO 5.1/2\" X 4' ( PEQUENA)","FUNDIÇÃO","","","22","20.3","SEM PESO",true],["","63962","REDUÇÃO 5\" X 3\" ( GRANDE )","FUNDIÇÃO","","","29.5","25.54","SEM PESO",true],["","64130","REDUÇÃO 6\" ( GRANDE )","FUNDIÇÃO","","","38.58","0","SEM PESO",true],["","67007","CORAÇAO BASE POSTE","FUNDIÇÃO","","","3.2","2.54","SEM PESO",true],["","67008","CHAPA BASE POSTE 14MTS","FUNDIÇÃO","",12.71,"12.71","9.97","SEM PESO",true],["","67013","TEM 2734 TAMBOR DE FREIO FUND/USINADO","FUNDIÇÃO","","","4.57","3.1","SEM PESO",true],["","67028","CONJUNTO BI PARTIDO","FUNDIÇÃO","",8.34,"8.34","7","0",true],["","67015","44076-1 RP TAMPA ATUADOR NV12","FUNDIÇÃO","","","22.3","16.96","SEM PESO",true],["","67016","44078 -1 RP BASE ATUADOR NV12","FUNDIÇÃO","","","24.38","18.86","SEM PESO",true],["","67017","25252-2 RP VOLANTE TIPO Y DIAM. 400","FUNDIÇÃO","","","4.76","3.02","SEM PESO",true],["","67026","SINO","FUNDIÇÃO","","","3.72","1.8","SEM PESO",true],["","67027","BADALO","FUNDIÇÃO","","","2.34","1.2","SEM PESO",true],["","67036","CASTELO AQUECIMENTO 2,1/2 E 3\"","FUNDIÇÃO","","","14.74","12.92","SEM PESO",true],["","67041","NR 91 BUCHA MIL 160 X 140 X 80 MM","FUNDIÇÃO","","","5.57","4","SEM PESO",true],["","67039","NR 96 BUCHA MIL 190 X 160 X 96 MM","FUNDIÇÃO","","","9.71","6.8","SEM PESO",true],["","67038","NR 95 BUCHA MIL 286 X 260 MM","FUNDIÇÃO","","","11.81","10","SEM PESO",true],["","67037","MP3007 MANCAL P/ VIMOT A 41 222-034-0-1","FUNDIÇÃO","","","26.4","22.12","SEM PESO",true],["","67029","CORPO DE PROVA METALOGRAFICO","FUNDIÇÃO","","2.28","2.28","1.18","SEM PESO",true],["","67052","BUCHA 167 X 146 X 65","FUNDIÇÃO","","","4.83","3.6","SEM PESO",true],["","67050","PET 461F EXCENTRICO BSCW40 ( PET 381 )","FUNDIÇÃO","",10.44,"10.44","7.4","SEM PESO",true],["","62543","FF36030100 BASE INFERIOR","FUNDIÇÃO","",20.26,"20.26","18.2","SEM PESO",true],["","67055","NR 97 BUCHA MIL 138 X 118 MM","FUNDIÇÃO","","","4.59","3.9","SEM PESO",true],["","65183","VV138 VIRABREQUIM VV120","FUNDIÇÃO","","","11.41","7.5","SEM PESO",true],["","67063","BUCHA DIAM 900 X 842","FUNDIÇÃO","","","220","175.1","SEM PESO",true],["","67062","BUCHA 215.183","FUNDIÇÃO","",0.62,"5.58","1.72","SEM PESO",true],["","66170","BISCATE 40 KG","FUNDIÇÃO","","40","40","26","SEM PESO",true],["","63790","CABEÇOTE VV160","FUNDIÇÃO","","","30","21.7","SEM PESO",true],["","67042","PEÇA MIL 300-04","FUNDIÇÃO","","","4.18","2.72","SEM PESO",true],["","67043","PEÇA MIL 300-05","FUNDIÇÃO","","","6.92","4.5","SEM PESO",true],["","67044","PEÇA MIL 300-07","FUNDIÇÃO","","","13.38","8.7","SEM PESO",true],["","67045","PEÇA MIL 300-08","FUNDIÇÃO","","","13.38","8.7","SEM PESO",true],["","67046","PEÇAS MIL 300-06","FUNDIÇÃO","","","9.42","6.12","SEM PESO",true],["","67047","TORRE MIL JATO","FUNDIÇÃO","","","4.12","4.68","SEM PESO",true],["","67048","CARCAÇA MIL JATO","FUNDIÇÃO","","","42.86","31.45","SEM PESO",true],["","67049","GARFO MIL JATO","FUNDIÇÃO","","","5.08","2.48","SEM PESO",true],["","67065","MP3004 CARCAÇA P/VIMOT A-41 222-036-0-1","FUNDIÇÃO","","141.65","141.65","117.8","SEM PESO",true],["","67066","MP3005 MANCAL P/VIMOT A-41 222-034-0-1","FUNDIÇÃO","",26.4,"26.4","22.12","SEM PESO",true],["","67077","ABRIDOR REDONDO","FUNDIÇÃO","","","1.6","0.12","SEM PESO",true],["","67076","ABRIDOR QUADRADO","FUNDIÇÃO","","","1.56","0.12","SEM PESO",true],["","67080","ELOS DO JATO","FUNDIÇÃO","","","4.8","0.196","SEM PESO",true],["","67081","BLINDAGEM MENOR","FUNDIÇÃO","","15.42","15.42","10.79","SEM PESO",true],["","67079","PRESILHA GG 50 TR 25 A TR 45","FUNDIÇÃO","","","4.78","3.9","SEM PESO",true],["","67078","MP3028 MANCAL P/ VIMOT E-11","FUNDIÇÃO","",8.36,"16.72","13.44","0",true],["","67082","CONTRA PESO BSCRN","FUNDIÇÃO","","","9.14","4","SEM PESO",true],["","67083","MP3029 MANCAL P/VIMOT S-21 221-060-0-1","FUNDIÇÃO","",19.06,"19.06","13.5","9.44",true],["","67085","M03.2029 FIXAÇAO DO PUXADOR CONF.DES","FUNDIÇÃO","","","2.25","1.4","SEM PESO",true],["","67086","PET511F EXCENTRICO I-5_7L10_15","FUNDIÇÃO","",8.78,"8.78","6.61","SEM PESO",true],["","67099","PRESILHA GG50 - TRILHO 01","FUNDIÇÃO","","","8.18","7.2","SEM PESO",true],["","67097","FU-F-21-E CORPO P/ F-12","FUNDIÇÃO","",1.696666667,"10.18","5.82","SEM PESO",true],["","65288","GRAMPO TERMINAL CABO 9/16","FUNDIÇÃO","","","7.6","5","SEM PESO",true],["","65289","CUNHA TERMINAL CABO 9/16","FUNDIÇÃO","","","3.9","2","SEM PESO",true],["","67098","FU-F-21-E CORPO P/ F-12","FUNDIÇÃO","","","10.18","5.82","SEM PESO",true],["","67104","LINGOTEIRA FBM LIGA MO","FUNDIÇÃO","","20.3","20.3","16.03","SEM PESO",true],["","67105","LINGOTEIRA FBM  MENOR","FUNDIÇÃO","",19.92,"19.92","16.03","SEM PESO",true],["","67103","LINGOTEIRA MANUAL LIGA MO","FUNDIÇÃO","","","25.18","20.84","SEM PESO",true],["","67107","MEG 05.0211 HASTE LIG CASTANHA DELTA","FUNDIÇÃO","","","7.38","5.76","SEM PESO",true],["","67113","PET 512 CONTRA PESO","FUNDIÇÃO","","","9.14","3.5","SEM PESO",true],["","67114","CONTRA PESO MENOR","FUNDIÇÃO","",1.0,"4","0.5","SEM PESO",true],["","67108","FU-53101 -E CORPO P/VSA-F-13-FU-53101-E","FUNDIÇÃO","","2.155","8.62","6.72","SEM PESO",true],["","67109","FU-53102-E CORPO DO REGISTRO P/ VSD-13","FUNDIÇÃO","","","5.55","4.04","SEM PESO",true],["","67110","FU-53001-E CORPO P/ VFO/VFE","FUNDIÇÃO","","2.315","9.26","7.32","SEM PESO",true],["","65328","NR 57 BUCHA MIL 61 X 47 MM ( 70 X 44 )","FUNDIÇÃO","","","13.86","7.04","SEM PESO",true],["","67115","DISCO DE CONTEÇAO SKB0311023PP7","FUNDIÇÃO","","","33.96","30.03","SEM PESO",true],["","67116","PRATO SKB031023PP6","FUNDIÇÃO","","","163.3","148.02","SEM PESO",true],["","67119","CORPO DA BOMBA MOLELO 100 1/4\"","FUNDIÇÃO","","","3.9","0.68","SEM PESO",true],["","67120","CASTANHA","FUNDIÇÃO","","","4.16","2.8","SEM PESO",true],["","67126","MEG05.0206 ABRAÇADEIRA OLHAL P/ BRAÇO","FUNDIÇÃO","","","9.18","7.5","SEM PESO",true],["","67128","ABRAÇADEIRA FIXA MEG 1 ( 05.0205 )","FUNDIÇÃO","","","7.56","6.12","SEM PESO",true],["","67129","ABRAÇADEIRA FIXA MEG 2 ( 05.0205 )","FUNDIÇÃO","","","6.96","5.58","SEM PESO",true],["","67130","GRAMPO","FUNDIÇÃO","","","2.88","0.14","SEM PESO",true],["","65372","NR 136 BUCHA MIL 140 X 118 MM","FUNDIÇÃO","","4.59","4.59","6.98","SEM PESO",true],["","62444","PET017 VALVULA GARFO ( 19041 ) FUND/USIN","FUNDIÇÃO","","","9.18","6","SEM PESO",true],["","67131","FU-F-45-E CORPO P/ F-25","FUNDIÇÃO","","","6.93","5.2","SEM PESO",true],["","67132","MEG.05.213 SUPORTE LONGO P/PUX.EM TUBO","FUNDIÇÃO","","","12.2","9.28","SEM PESO",true],["","67133","MEG 05.0208 MANCAL ARTICULADO","FUNDIÇÃO","","","10.5","7.02","SEM PESO",true],["","65092","M06.300062 SUPORTE PRENDEDOR DO CABO","FUNDIÇÃO","","","4.35","3.06","SEM PESO",true],["","65090","M06. 300063 PRENDEDOR CABO","FUNDIÇÃO","","","5.56","4.14","SEM PESO",true],["","67135","CONJUNTO PINÇA DE FREIO ( PEÇA 1 E PEÇA 2 )","FUNDIÇÃO","","","26.4","9.88","SEM PESO",true],["","67136","FU-53103-E TAMPA DO REGISTRO P/VSD-13","FUNDIÇÃO","","","5.42","1.6","SEM PESO",true],["","67138","FU-200764-H VOLANTE FUNDIDO DIAM 315 MM","FUNDIÇÃO","","","10.28","7.2","SEM PESO",true],["","65435","ESTRADO DE FERRO FUNDIDO","FUNDIÇÃO","",29.4,"29.4","26.2","SEM PESO",true],["","67148","M06.300192 BRAQUETE DE SUSPENSAO","FUNDIÇÃO","","","1.823","1.8","SEM PESO",true],["","67146","PTM0101-13 MANIVELA","FUNDIÇÃO","","","2.36","0.72","SEM PESO",true],["","67141","TAMPA DE POSTE ORNAMENTAL GRANDE LISA","FUNDIÇÃO","","","6","4","SEM PESO",true],["","67142","TAMPA DE POSTE ORNAMENTAL MENOR ONDULADA","FUNDIÇÃO","",5.0,"5","3","SEM PESO",true],["","67149","PEÇA A6503-FUNDIDA","FUNDIÇÃO","","","5.92","2.03","SEM PESO",true],["","67157","CARCAÇA 1\" E 3/4\"","FUNDIÇÃO","","","4.65","1.44","SEM PESO",true],["","67158","CARCAÇA 1.1/2\"","FUNDIÇÃO","","","10.71","7.5","SEM PESO",true],["","67159","FLANGE 1.1/2\"","FUNDIÇÃO","","","11.4","2","SEM PESO",true],["","67160","CARCAÇA 2\"","FUNDIÇÃO","","","13.5","8.5","SEM PESO",true],["","67161","FLANGE 2\"","FUNDIÇÃO","","","8.56","3","SEM PESO",true],["","67162","CARCAÇA 3\"","FUNDIÇÃO","","","23","18","SEM PESO",true],["","67163","FLANGE 3\"","FUNDIÇÃO","","","9.28","6.5","SEM PESO",true],["","67164","CORPO","FUNDIÇÃO","","","10.46","7.1","SEM PESO",true],["","67165","MISTURADOR","FUNDIÇÃO","","","2.16","0.98","SEM PESO",true],["","67156","PEÇA FREIO FUNDIDO","FUNDIÇÃO","",0.516666667,"6.2","5.04","SEM PESO",true],["","61978","NR 83 BUCHA MIL 180 X 155 MM","FUNDIÇÃO","","","7.12","3","SEM PESO",true],["","67155","PTM0301-C018 CARCAÇA CONF. PTM15-C28","FUNDIÇÃO","","","40.32","32","SEM PESO",true],["","67166","LASTRO PAULISTANO 450 MM FUNDIDO","FUNDIÇÃO","",13.51,"13.51","11.2","SEM PESO",true],["","67167","CASTANHA FUNDIDA","FUNDIÇÃO","",0.217,"2.17","1.4","SEM PESO",true],["","65663","M06.300041 PARTE INFERIOR CRUZ.AJUSTAVEL","FUNDIÇÃO","","","4.38","2.94","SEM PESO",true],["","67173","CAMISA PARA EMBUCHAMENTO DO PET043","FUNDIÇÃO","",3.045,"6.09","4.84","SEM PESO",true],["","67172","BUCHA EVOLUTION 248 X 195","FUNDIÇÃO","","","10.05","8","SEM PESO",true],["","63765","LINGOTEIRA","FUNDIÇÃO","","25","25","20.62","SEM PESO",true],["","64116","BUCHA DO ACIONADOR","FUNDIÇÃO","","","6.5","5.4","SEM PESO",true],["","66513","BISCATE 45 KG","FUNDIÇÃO","","","43","32","SEM PESO",true],["","67174","COLAR FLANGEADO DIAM 50 MM","FUNDIÇÃO","","","10.8","6.1","SEM PESO",true],["","67175","COLAR FLANGEADO DIAM 80 MM","FUNDIÇÃO","","","15.12","9","SEM PESO",true],["","67176","COLAR FLANGEADO DIAM 100 MM","FUNDIÇÃO","","","18.22","10.7","SEM PESO",true],["","67177","TRAVA PARA MOLDES","FUNDIÇÃO","","","11.43","8","SEM PESO",true],["","67178","MANOPLA TENSIONADORA DE CORRENTE","FUNDIÇÃO","","","7.72","1.35","SEM PESO",true],["","67179","GANCHO TENSIONADORA DE CORRENTE","FUNDIÇÃO","","","1.32","0.92","SEM PESO",true],["","67180","GRAMPO FIXADOR DE CORRENTE","FUNDIÇÃO","","","1.24","0.88","SEM PESO",true],["","67184","ACOPLAMENTO GVC","FUNDIÇÃO","","","14.58","11.14","SEM PESO",true],["","67185","CARCAÇA 2 GVC","FUNDIÇÃO","","","23.76","18.48","SEM PESO",true],["","67186","TAMPA GVC","FUNDIÇÃO","","","33.72","28.2","SEM PESO",true],["","67187","CORPO DA BOMBA GVC","FUNDIÇÃO","","","94.6","78.4","SEM PESO",true],["","67197","CORPO DE MANIVELA","FUNDIÇÃO","","","1","0.66","SEM PESO",true],["","67198","TRAVA PARA MOLDE 1000 MM","FUNDIÇÃO","","","10.21","8.14","SEM PESO",true],["","67199","PRATO DE PROTEÇAO DO JATO","FUNDIÇÃO","","42.99","42.99","32.24","SEM PESO",true],["","67206","CALIBRADOR PARA BUCHA DIAM.300 MM","FUNDIÇÃO","","","18.78","13.15","SEM PESO",true],["","67205","CALIBRADOR PARA BUVHA DIAM.250 MM","FUNDIÇÃO","","","13.1","9.17","SEM PESO",true],["","67202","CALIBRADOR PARA BUCHA DIAM.100 MM","FUNDIÇÃO","","","2.08","1.46","SEM PESO",true],["","67201","CALIBRADOR PARA BUCHA DIAM.75 MM","FUNDIÇÃO","","","1.18","0.83","SEM PESO",true],["","67200","CALIBRADOR PARA BUCHA DIAM.50 MM","FUNDIÇÃO","","","0.53","0.37","SEM PESO",true],["","67203","CALIBRADOR PARA BUCHA DIAM.150 MM","FUNDIÇÃO","","","4.72","3.31","SEM PESO",true],["","67204","CALIBRADOR PARA BUCHA DIAM.200 MM","FUNDIÇÃO","","","8.34","5.84","SEM PESO",true],["","67211","M03.2146 BRACADEIRA SUSP. ANTIB. ADF38208","FUNDIÇÃO","","","3.23","2.4","SEM PESO",true],["","67212","M03.2147 BRACAD. FIXAC. ANT.BRACO","FUNDIÇÃO","","","3.38","2.8","SEM PESO",true],["","67213","M03.2148 BRACADEIRA.SUSP BRACO ADF38245","FUNDIÇÃO","","","4.36","5.2","SEM PESO",true],["","67214","M03.2155 CJ FIX. PUX.R. TUBO 1.1/4 ADF38211","FUNDIÇÃO","","","6.4","4.8","SEM PESO",true],["","67215","M03.2156 BRAC.TI.PONT.BRA.SU.MR ADF38205","FUNDIÇÃO","","","2.6","2.6","SEM PESO",true],["","67216","M03.2157 GANC.SU.FER.CAB.REC/126/059","FUNDIÇÃO","","","2.39","1.56","SEM PESO",true],["","67217","M03.2159 BRACAD.FIX.ANTIB.BRACO ADF38204","FUNDIÇÃO","","","3.2","2.4","SEM PESO",true],["","65588","BRN 2016.09.001-01 CORPO QUEIMADOR","FUNDIÇÃO","","","26.74","20.9","SEM PESO",true],["","67218","BUCHA LIEBHER 162","FUNDIÇÃO","",4.26,"8.52","6.4","0",true],["","65558","BRN-2016.09.002-01 CORPO QUEIMADOR","FUNDIÇÃO","","","19.42","14.22","SEM PESO",true],["","67221","M03.2169 GANCHO SUSP CABO MEN D216/059","FUNDIÇÃO","","","6.31","3.84","SEM PESO",true],["","67219","POLIA SUPERIOR DO ELEVADOR DE CANENCAS","FUNDIÇÃO","","","12.5","10","SEM PESO",true],["","67220","POLIA INFERIROS DO ELEVADOR DE CANECAS","FUNDIÇÃO","","","30","24","SEM PESO",true],["","67222","TRAVA UNIVERSAL PARA MOLDES","FUNDIÇÃO","","","6.7","5","SEM PESO",true],["","67223","BARRA DE TRAVAMENTO 1000 mm","FUNDIÇÃO","","","11.05","5.84","SEM PESO",true],["","67224","BARRA DE TRAVAMENTO 500 mm","FUNDIÇÃO","","","5.12","5.84","SEM PESO",true],["","67225","BARRA DE TRAVAMENTO 250 mm","FUNDIÇÃO","","","2.82","2.92","SEM PESO",true],["","67226","MANOPLA TENSIONADORA TRAVA UNIVERSAL","FUNDIÇÃO","","","1.64","1.24","SEM PESO",true],["","67230","DISCO MARCOS FUNDIDO","FUNDIÇÃO","","","3.36","2.4","SEM PESO",true],["","67234","TAMPA COD.7800960-2","FUNDIÇÃO","","","5.42","3.5","SEM PESO",true],["","67235","BASE  COD.7800960-2","FUNDIÇÃO","","","4.55","3","SEM PESO",true],["","67242","FLG- FLANGE-SIPORTE DA MANGA DE EIXO","FUNDIÇÃO","","","16.96","12.5","SEM PESO",true],["","67236","FU-PPC-22-E TAMPA FUNDIDO P/ PPC-10","FUNDIÇÃO","",2.436666667,"14.62","11.16","SEM PESO",true],["","67237","FU-M-221-E CORPO FUNDIDO P/ PPC-10","FUNDIÇÃO","","","7.2","7.04","SEM PESO",true],["","67238","FU-CPS-31-E CORPO P/ CPS-100","FUNDIÇÃO","","","9.72","7.78","SEM PESO",true],["","67239","FU-CPS-71-E CORPO P/ CPS-70 FUNDIDO","FUNDIÇÃO","","","15.04","6.74","SEM PESO",true],["","67229","SER110 CAMISA P/ EMBUHAMENTO PET016R ( NR62 )","FUNDIÇÃO","","3.78","7.56","1.58","2.54",true],["","67247","LONGARINA SPOT DIREITA TYPO 9","FUNDIÇÃO","",3.58,"7.16","6.08","SEM PESO",true],["","67248","LONGARINA SPOT ESQUERDA TYPO 9","FUNDIÇÃO","",3.58,"7.16","6.08","SEM PESO",true],["","67245","PEÇA GVC JCL 100","FUNDIÇÃO","","","3.6","1.5","SEM PESO",true],["","67246","PEÇA GVC JCL 102","FUNDIÇÃO","","","6.6","2","SEM PESO",true],["","67250","CANECAS DO ELVADOR DE GRANALHA","FUNDIÇÃO","","","3.76","2.2","SEM PESO",true],["","67253","BUCHA WTT DIAM .1003 MM","FUNDIÇÃO","","","263.62","329.5","SEM PESO",true],["","64607","M06.300210 CORREDIÇA CURVA TIPO LIG ( DIR )","FUNDIÇÃO","","","3.9","2.3","SEM PESO",true],["","64606","M06.300200 CORREDIÇA CURVA TIPO LIG ( ESQ )","FUNDIÇÃO","","","3.9","2.3","SEM PESO",true],["","67254","BUCHA P/ ANEL DIAM 647,70","FUNDIÇÃO","","","79.49","67.53","SEM PESO",true],["","63966","NR 51 BUCHA MIL 45 X 23 MM","FUNDIÇÃO","","","6","3","SEM PESO",true],["","67255","ADAPTADOR DE RODA","FUNDIÇÃO","","","3.36","2.2","SEM PESO",true],["","67256","ADAPTADOR 4 X 4","FUNDIÇÃO","","","3.42","2.4","SEM PESO",true],["","67260","PESO INERCIAL A-41 DES 222-032-0-2","FUNDIÇÃO","","18.48","18.48","15.28","0",true],["","63729","NR 55 BUCHA MIL 58 X 45 mm","FUNDIÇÃO","","","3.9","3","SEM PESO",true],["","67272","PALETE METALICO","FUNDIÇÃO","","141.6","141.6","124.4","SEM PESO",true],["","67264","PROLONGADOR DE CORRENTE MAIOR","FUNDIÇÃO","","","3.58","1.6","SEM PESO",true],["","67265","PROLONGADOR DE CORRENTE MENOR","FUNDIÇÃO","","","3.58","1.3","SEM PESO",true],["","67269","FU-95341-E CORPO FUNDIDO P/VSA-R-13","FUNDIÇÃO","","","3.22","1.6","SEM PESO",true],["","67270","FU-95396-E CORPO FU P/VSA-R16 E VSA-R20","FUNDIÇÃO","","","4.92","2.4","SEM PESO",true],["","67261","PESO INERCIAL S -21 DES.221-054-0-3","FUNDIÇÃO","",12.29,"12.29","9.74","9.02",true],["","67262","MP3205 PESO INERC. E-11 -6 DES.224-033-0-3","FUNDIÇÃO","",7.12,"7.12","5.36","0",true],["","67263","PESO INERCIAL G-15 DES 225-030-0-4","FUNDIÇÃO","",3.845,"7.69","5.46","SEM PESO",true],["","67275","DISCO MARCOS TRAZEIRO","FUNDIÇÃO","","","2.57","1.3","SEM PESO",true],["","63810","704.080 PORCA REGULAGEM PINHAO DIFHD4/21","FUNDIÇÃO","","","4","3","0",true],["","67279","CARCAÇA DE FREIO DO MOTOR RP1004","FUNDIÇÃO","","","21.44","16.24","SEM PESO",true],["","67276","CLG M - MANCAL","FUNDIÇÃO","","","23.76","18.48","SEM PESO",true],["","67277","CLG TP - TAMPA","FUNDIÇÃO","","33.72","33.72","28.2","SEM PESO",true],["","67278","CLG - CAIXA DE ROLAMENTO","FUNDIÇÃO","","","14.58","11.14","SEM PESO",true],["","66565","301G40000001 CASTELO AQUEC 1\" & 1.1/4\"","FUNDIÇÃO","","","12.07","9.6","SEM PESO",true],["","67283","FLGGXT FLANGE GAXETA","FUNDIÇÃO","","","53.78","43.92","SEM PESO",true],["","67286","M03.2306 SUPORTE CINTA P/ POSTE CIRCULAR","FUNDIÇÃO","","","6.74","5.7","SEM PESO",true],["","67287","M03.2227 SUPORTE PONT.AO BRAC.TRI.FERROVIA","FUNDIÇÃO","","","5.26","4.44","SEM PESO",true],["","67288","M03,2228 MANCAL DO BRAC.TRIANG.FERROVIA","FUNDIÇÃO","","0.9333333333333332","5.6","4.74","SEM PESO",true],["","67289","M03.2229 MANCAL DO PONT.TRIANG.FERROVIA","FUNDIÇÃO","","","5.19","4.38","SEM PESO",true],["","62354","22519 FECHADURA MIOLO MAIOR","FUNDIÇÃO","","","7.46","5","SEM PESO",true],["","67293","C045 CARCAÇA FUNDIDA","FUNDIÇÃO","","","15.71","13.14","SEM PESO",true],["","67294","26302 SUPORTE ESPELHO RODA","FUNDIÇÃO","","","10.42","7.2","SEM PESO",true],["","67295","32172 SAPATA DE FREIO","FUNDIÇÃO","","","14.53","8.5","SEM PESO",true],["","67291","BUCHA DO ITEM LUVA SLEEVE NR21","FUNDIÇÃO","",4.335,"8.67","4.28","SEM PESO",true],["","67297","COLETOR - LUCAS TURBO","FUNDIÇÃO","",10.54,"10.54","8.7","SEM PESO",true],["","65594","NR03 BUCHA MIL 170 X 145 MM","FUNDIÇÃO","","","11.5","4","SEM PESO",true],["","67304","CAMISA SILAS","FUNDIÇÃO","","","26.42","22.2","SEM PESO",true],["","67305","VIRABREQUIM SILAS","FUNDIÇÃO","","","26.2","22.64","SEM PESO",true],["","67302","BUCHA 228 - LUVA DA SEDE","FUNDIÇÃO","","","5.17","8.2","SEM PESO",true],["","67306","MP0974 TAMPA CAIXA DE LIGAÇÃO E - 11/S","FUNDIÇÃO","",1.048333333,"6.29","0.83","0",true],["","67307","TAMPA EF - 2500","FUNDIÇÃO","",10.94,"10.94","9.3","SEM PESO",true],["","67308","FLANGE ACOPLAMENTO EF - 2500","FUNDIÇÃO","",14.02,"14.02","12.48","SEM PESO",true],["","67309","FLANGE SEPARADORA EF - 2500","FUNDIÇÃO","",6.21,"6.21","5.34","SEM PESO",true],["","67311","DISCO DE LONA EF - 2500","FUNDIÇÃO","",4.06,"8.12","6.5","SEM PESO",true],["","67310","ANCORA EF - 2500","FUNDIÇÃO","",8.08,"8.08","6.87","SEM PESO",true],["","67320","RD-06 ROLDANA","FUNDIÇÃO","",2.1075,"8.43","6.8","0",true],["","65712","20.246 EIXO CATRACA RD 68 MOLDE 205.055","FUNDIÇÃO","","","8.335","5.04","SEM PESO",true],["","65545","1430010085 CARCAÇA DA CHAVE-FU","FUNDIÇÃO","","","9.18","7","SEM PESO",true],["","67335","COLUNA QUADRADA FERRO","FUNDIÇÃO","","253.4","253.4","225.6","SEM PESO",true],["","67337","MO6.300031 CORPO DO SUPORTEP/ BRACO","FUNDIÇÃO","","","3.98","1.36","SEM PESO",true],["","67340","SUPORTE CELULAR","FUNDIÇÃO","",0.65,"1.3","0.72","SEM PESO",true],["","67344","CORPO DE-PJ-2025-0166","FUNDIÇÃO","",2.411428571,"4.22","3.38","SEM PESO",true],["","67345","TAMPA DE -PJ-2025-0167","FUNDIÇÃO","",1.95,"3.9","3.12","SEM PESO",true],["","67346","ROLDANA FROTA DIAM.100 SIMPLES","FUNDIÇÃO","",1.65875,"13.27","10.08","0",true],["","67347","ROLDANA FROTA DIAM.100 TRIPLA","FUNDIÇÃO","",2.6225,"20.98","16.08","0",true],["","64417","MANGOTE 5\"","FUNDIÇÃO","","","10.35","7.2","SEM PESO",true],["","67354","ANCORA EF300","FUNDIÇÃO","","2.135","4.27","3.6","SEM PESO",true],["","67355","FLANGE EF300","FUNDIÇÃO","","3.255","6.51","5.9","SEM PESO",true],["","67356","TAMPA EF300","FUNDIÇÃO","","3.575","7.15","6.22","SEM PESO",true],["","67357","DISCO EF300","FUNDIÇÃO","","1.49","4.47","2.38","SEM PESO",true],["","67358","LASTRO PAULISTANO 350 mm","FUNDIÇÃO","",6.57,"6.57","5.26","SEM PESO",true],["","67375","SUPORTE DE CELULAR V4","FUNDIÇÃO","","0.65","1.3","0.72","SEM PESO",true],["","67367","CORPO 2\" DE-PJ-2025-0201","FUNDIÇÃO","","8.8","17.6","14.44","SEM PESO",true],["","67368","TAMPA 1.1/2\" DE-PJ-2025-0152","FUNDIÇÃO","",7.12,"14.24","10","SEM PESO",true],["","67369","TAMPA 1.1/4\" DE-PJ-2025-0291","FUNDIÇÃO","","5.42","10.84","3","SEM PESO",true],["","67352","PL2204856-FD CAIXA DE SELO 3,1/2\"","FUNDIÇÃO","","29.24","29.24","23.53","SEM PESO",true],["","67353","PL22004739E - FD CAIXA DE SELO 5.1/2\"","FUNDIÇÃO","","58.84","58.84","52.86","SEM PESO",true],["","67363","PRESILHA 1.1/2 DE-PJ-2025-0154","FUNDIÇÃO","",0.286666667,"1.72","0.4","0",true],["","67364","FLANGE 2\" DE-PJ-2025-0204","FUNDIÇÃO","","2.01","4.02","2.8","SEM PESO",true],["","67365","TAMPA 2\" DE-PJ-2025-0202","FUNDIÇÃO","","8.17","16.34","12.72","SEM PESO",true],["","67366","CORPO 1.1/2\" DE-PJ-2025-0151","FUNDIÇÃO","",7.72,"15.44","4","SEM PESO",true],["","67370","CORPO 1.1/4\" DE-PJ-2025-0209","FUNDIÇÃO","",5.44,"10.88","5","SEM PESO",true],["","67371","FLANGE 1.1/2\" DE-PJ-2025-153","FUNDIÇÃO","",1.28,"2.56","1.8","SEM PESO",true],["","67372","FLANGE DE APERTO 2\" DE-PJ-2025-0205","FUNDIÇÃO","","1.8","3.6","0.6","SEM PESO",true],["","67373","FLANGE 1.1/4\" DE-PJ-2025-0293","FUNDIÇÃO","","1.28","2.56","1.6","SEM PESO",true],["","67379","CUNHA  FUNDIDA","FUNDIÇÃO","","0.545","4.36","2.48","SEM PESO",true],["","67380","BASE ORNAMENTAL - XIII","FUNDIÇÃO","","25.42","25.42","20.34","SEM PESO",true],["","66147","1230010980 ROTOR IMPULSOR FU","FUNDIÇÃO","",3.67,"7.34","4.2","SEM PESO",true],["","65308","BUCHA SOP D145","FUNDIÇÃO","","2.5428","4.89","7","SEM PESO",true],["","1","ANÉIS BI-PARTIDOS","ADM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","3","ANÉIS SAUR","ADM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","4","ANÉIS HIDROMAS","ADM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","5","PEÇAS FUNDIDAS","ADM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","8","DIVERSOS","ADM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67389","CJ. 03 ANÉIS 220 STD (1-OLEO/2RASPA) HUGO","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67392","ANEL 50,80X47,20X3,17MM ALT BAIONETA","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67394","ANEL 200 X 182 X 5 ALT BAIONETA","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67382","USINAGEM C/CANAL PET016 P/ PET043R","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67397","9006740 ANEL 3.1/2 X 2,1 X 3/16 BAIONETA","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67401","USINAGEM C/CANAL PET043R P/ PET016","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","63910","MP05.00092 CORPO 36C DES. 4N-9804790","USINAGEM","",30.24,"30.24","24.16","SEM PESO",true],["","67403","ANEL 65 X 59,10 X 3 MM","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67404","ANEL 90 X 82,70 X 3,50 MM","USINAGEM","GG25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67405","CRC-25 CARCAÇA USINADO","USINAGEM","GG 20","COD USINAGEM","COD USINAGEM","SEM PESO","8.1",true],["","67406","CRC-90 CARCAÇA  P/ M-90","USINAGEM","GG 20","COD USINAGEM","COD USINAGEM","SEM PESO","6.02",true],["","67407","CRC-90 CARCAÇA  P/ M-353B","USINAGEM","GG 20","COD USINAGEM","COD USINAGEM","SEM PESO","5.54",true],["","67411","VC353525 ANEL DIAM 35 X 32,50 X 2,50","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67412","ANEL 79 X 72 X 3 ANEL RETO","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67408","4137-006 ANEL B133,40 X 123,40 X 24 MM","USINAGEM","GGG 42","COD USINAGEM","COD USINAGEM","SEM PESO","0",true],["","67409","4137-007 ANEL B114,40 X 104,40 X 24 MM","USINAGEM","GGG 42","COD USINAGEM","COD USINAGEM","SEM PESO","0.24",true],["","35849","FRESA MD RETA 4C 45HRC 10X40X100 H10","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35850","FRESA MD RETA 4C 45HRC 12X45X100 H12","USINAGEM","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67413","451491 ANEL SEGT DIAM 101,65 DUOLAP","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67419","PET16R-4 EMBUCHAR + US S/CANAL PET043R","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67418","PET016R-3 EMBUCHAR + US. COMPLETA PET043R","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67417","ANEL 65,05 X 58,95 X 3 BAIONETA","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67312","DISCO BIREL FUNDIDO","FUNDIÇÃO","GG25",2.28,"2.28","1.86","SEM PESO",true],["","BT06032","CONE MODULAR BT 40X CBH4-205","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","BT06075","CABEÇOTE CENTESIMAL CBH4X CAPAC 41X74MM","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","BT06090","CAPSULA PARA CABEÇOTE CENTESIMAL BHF 41X74","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","5504410","TPGX 110304-L IC20N","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","BT06058","CABEÇOTE DESBASTE CBH4 X CAPACIDADE 40 X 55MM","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","5550221","CCMT 09T308- SM IC807","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67420","ANEL BAIONETA 150,05 CONF DES.47937","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67416","ANEL DO PISTAO REBITADEIRA DUOLPA","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","35702","REBOLO 157,97,34MM CODA2416","FERRAMENTA","","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67424","ANEL 60 X 55,80 X 3,50 MM","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67425","ANEL 60 X 54,90 X 2,50 MM","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67423","CJ.03 ANEIS 230,30 ( 01-OLEO / 02 - COMPRESSAO )","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67427","CJ.03 ANEIS 230,15 ( 01- OLEO / 02 - COMPRESSAO )","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","SEM PESO","SEM PESO",true],["","67429","ANEL 100,00 X 93,00 X 4 MM BAIONETA","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","COD USINAGEM","SEM PESO",true],["","66379","34709 ANEL 315 X 295 X 8 MM","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","COD USINAGEM","SEM PESO",true],["","67430","ANEL 79,75 X 72,75 X 3 MM","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","COD USINAGEM","SEM PESO",true],["","67431","ANEL 120 X 110,20 X 3 BAIONETA","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","COD USINAGEM","SEM PESO",true],["","67434","ANEL BAIONETA 111,50 X 116,50 X 3 MM","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","COD USINAGEM","SEM PESO",true],["","67435","ANEL RETO 107,60 X 111,00 X 6,00 MM","USINAGEM","GG 25","COD USINAGEM","COD USINAGEM","COD USINAGEM","SEM PESO",true]]);
// Índice oficial de produtos: usado diretamente pelos lançamentos, independente do localStorage.
window.__PRODUTOS_CADASTRO_OFICIAL__ = Array.isArray(CADASTRO_EXCEL_SEED) ? CADASTRO_EXCEL_SEED.slice() : [];
window.__NORMALIZAR_CODIGO__ = function(v){
  const t=String(v??'').trim().toUpperCase();
  if(!t) return '';
  if(/^\d+$/.test(t)) return String(Number(t));
  return t.replace(/\s+/g,'');
};
window.__BUSCAR_PRODUTO_OFICIAL__ = function(codigo){
  const key=window.__NORMALIZAR_CODIGO__(codigo);
  if(!key) return null;
  const list=window.__PRODUTOS_CADASTRO_OFICIAL__;
  return list.find(x=>window.__NORMALIZAR_CODIGO__(x?.codigo)===key) || null;
};

function normalizeCad(){
  if(!cadastros || typeof cadastros!=='object') cadastros={motivos:[],pecas:[],clientes:[],responsaveis:[]};
  cadastros.motivos=Array.isArray(cadastros.motivos)?cadastros.motivos:[];
  cadastros.pecas=Array.isArray(cadastros.pecas)?cadastros.pecas:[];
  cadastros.clientes=Array.isArray(cadastros.clientes)?cadastros.clientes:[];
  cadastros.responsaveis=Array.isArray(cadastros.responsaveis)?cadastros.responsaveis:[];
  // Peso principal / bruto fracionado oficial da última planilha: coluna H (PESO UNITARIO BRUTO),
  // indexado pelo código interno. Em caso de cadastro local antigo, a planilha tem prioridade.
  const PESO_BRUTO_PLANILHA_V74={"65968":19.8,"66476":9.5,"66133":1.305,"65245":6.83,"62490":5.28,"63625":0.33,"66156":0.306935414,"66804":0.554,"65262":3.96,"65259":2.93,"65268":2.345,"65416":9.99,"65930":25.86,"66683":12.23,"61684":4.89,"67248":3.58,"67247":3.58,"67105":19.92,"65408":7.35,"64544":3.0,"67344":2.411428571,"65287":2.287179487,"67114":1.0,"62540":12.37,"62544":5.49,"67347":2.6225,"66882":2.035,"67346":1.65875,"62898":13.8,"62842":15.3,"62897":15.19,"67320":2.1075,"65924":8.166666667,"65923":5.406666667,"66357":0.471,"62599":2.475,"66258":0.675555556,"63995":4.235,"62542":3.81,"63522":2.98,"65244":5.17,"65335":4.75,"65240":4.035,"65949":2.57,"67236":2.436666667,"66475":76.0,"64486":2.045,"66935":25.51,"67311":4.06,"66980":4.8,"67297":10.54,"67261":12.29,"67097":1.696666667,"62653":0.81125,"67358":6.57,"65941":3.74,"66751":1.73,"65480":2.21,"63949":0.61625,"63604":1.708333333,"66279":0.377056277,"65627":8.07,"65261":3.729375,"66558":0.455,"66134":1.049361702,"63528":6.01,"63689":3.22,"67306":1.048333333,"62965":73.6,"66560":1.583333333,"67078":8.36,"62445":1.891666667,"66191":4.37,"66899":4.66,"66939":7.31,"62203":8.15,"63994":11.64,"65661":4.37,"62279":0.745,"66050":6.1,"66051":5.87,"66896":1.3825,"66808":0.32,"66894":3.54,"63470":1.65,"66535":0.711666667,"65435":29.4,"65496":70.04,"65945":35.7,"65426":33.18,"66607":0.848,"67083":19.06,"61608":8.32,"67218":4.26,"64614":1.048837209,"62274":0.378571429,"63650":30.98,"66945":9.5,"65791":0.2575,"66620":0.811666667,"65662":2.245,"66784":4.36,"65600":13.64,"67309":6.21,"64438":1.58,"67308":14.02,"66686":1.39,"62790":12.1,"62600":0.943703704,"63607":0.448333333,"66653":5.33,"67310":8.08,"66911":7.02,"64213":1.82,"63480":3.28,"62208":2.84,"62598":2.945,"67307":10.94,"65275":2.095,"67345":1.95,"67378":3.735,"63830":1.0676,"67166":13.51,"64045":4.38,"64264":8.78,"61017":10.24,"61768":7.34,"62851":1.02,"62821":1.335,"62330":0.708,"66318":1.82,"65294":1.75,"67008":12.71,"65286":2.076923077,"61670":1.005,"67173":3.045,"62576":9.12,"66946":1.965,"63796":2.23,"67050":10.44,"67028":8.34,"67167":0.217,"62331":0.213,"66509":1.385,"66420":82.92,"63688":0.455625,"65095":0.445,"66052":1.33,"66416":7.84,"63388":0.69,"67156":0.516666667,"63287":0.816666667,"62597":6.36,"66264":0.762,"64062":1.59,"65959":3.995,"65952":4.14,"66897":5.0,"66132":9.01,"63465":1.22,"65953":8.87,"65951":3.265,"65979":3.98,"65954":1.455,"65987":4.86,"62543":20.26,"65505":34.7,"67321":2.1075,"63471":1.815,"65955":1.905,"65948":2.365,"67366":7.72,"67363":0.286666667,"63586":4.8,"63845":9.18,"63615":40.62,"63910":30.24,"66756":3.6225,"67262":7.12,"65950":2.975,"66587":1.08125,"66798":5.51,"67340":0.65,"67142":5.0,"65980":4.37,"67368":7.12,"67005":4.29,"65958":2.965,"67370":5.44,"62940":2.55,"62786":5.6,"61247":1.02,"67371":1.28,"66592":1.6,"66621":0.7225,"65969":2.845,"65082":0.97625,"65096":0.66,"65540":17.52,"63476":8.41,"62606":2.1075,"66913":5.76,"63642":21.94,"67291":4.335,"67263":3.845,"67062":0.62,"66147":3.67,"66622":0.218,"65984":3.305,"67066":26.4,"65986":4.432153846,"65756":1.8775,"65970":1.340833333,"67312":2.28,"62607":8.325,"67086":8.78,"65297":0.69125,"66257":4.37,"65628":3.97,"63412":0.37,"66167":5.41,"64305":51.0,"63180":0.3425,"62777":4.8375,"65154":25.0,"63751":2.0,"63611":2.33};
  // Carrega a planilha CADASTRO fornecida como base inicial. Registros manuais existentes são preservados.
  if(localStorage.getItem(CADKEY+'_cadastro_excel_seed_version')!==CADASTRO_EXCEL_SEED_VERSION){
    const productKey=x=>String(x?.codigo??'').trim()+'|'+String(x?.descricao??'').trim().toUpperCase();
    const pm=new Map(cadastros.pecas.map(x=>[productKey(x),x]));
    CADASTRO_EXCEL_SEED.forEach(x=>{const k=productKey(x),old=pm.get(k);pm.set(k,old?{...old,...x,cliente:old.cliente||x.cliente||''}:{...x})});
    // Correção forçada de peso pelo código interno: evita que um localStorage antigo prevaleça.
    cadastros.pecas=[...pm.values()].map(p=>{
      const k=codigoKey(p.codigo);
      return Object.prototype.hasOwnProperty.call(PESO_BRUTO_PLANILHA_V74,k)
        ? {...p,pesoPrincipal:PESO_BRUTO_PLANILHA_V74[k],_pesoPrincipalFonte:'PESO UNITARIO BRUTO - planilha v74'}
        : p;
    });
    localStorage.setItem(CADKEY+'_cadastro_excel_seed_version',CADASTRO_EXCEL_SEED_VERSION);
    try{localStorage.setItem(CADKEY+'_peso_principal_planilha_v74_aplicado','1')}catch{}
  }

  // A aba CADASTRO do Excel é a fonte oficial dos pesos dos produtos.
  // IMPORTANTE: não usamos initialData/LANÇAMENTOS para preencher o cadastro de produtos,
  // pois um produto pode ter registros históricos com pesos diferentes. Ex.: 65887.
  const PESOS_PRODUTO_VERSION='2026-09-29-produtos-pesos-v4-cadastro-oficial';
const AUTO_CADASTRO_VERSION='2026-09-30-auto-codigo-v37';
if(localStorage.getItem(KEY+'_auto_cadastro_version')!==AUTO_CADASTRO_VERSION){ localStorage.setItem(KEY+'_auto_cadastro_version',AUTO_CADASTRO_VERSION); }
  if(localStorage.getItem(CADKEY+'_produtos_pesos_version')!==PESOS_PRODUTO_VERSION){
    const productKey=x=>String(x?.codigo??'').trim()+'|'+String(x?.descricao??'').trim().toUpperCase();
    const seedMap=new Map(CADASTRO_EXCEL_SEED.map(x=>[productKey(x),x]));
    cadastros.pecas=cadastros.pecas.map(x=>{
      const seed=seedMap.get(productKey(x));
      if(!seed) return x;
      // Atualiza exatamente conforme a aba CADASTRO, inclusive quando o Excel informa
      // "COD USINAGEM" ou "SEM PESO". Nesses casos não convertemos para peso numérico.
      return {
        ...x,
        planta: seed.planta ?? x.planta ?? '',
        material: seed.material ?? x.material ?? '',
        pesoPrincipal: seed.pesoPrincipal ?? '',
        pesoArvore: seed.pesoArvore ?? '',
        pesoFundUsin: seed.pesoFundUsin ?? '',
        pesoUsinado: seed.pesoUsinado ?? '',
        _origemExcel: true
      };
    });
    localStorage.setItem(CADKEY+'_produtos_pesos_version',PESOS_PRODUTO_VERSION);
  }

  if(localStorage.getItem(CADKEY+'_motivos_version')!==MOTIVOS_VERSION){
    const oldDefaultCodes=new Set(["1","10","101","102","103","104","105","106","107","108","109","11","110","111","112","113","114","115","116","117","118","119","12","120","121","122","123","124","125","126","127","128","129","13","130","131","132","133","134","135","136","137","138","139","14","140","141","142","143","144","145","146","147","148","149","15","150","151","152","153","154","155","156","157","158","159","16","17","18","19","2","20","201","202","203","204","205","206","207","208","209","21","210","211","212","213","214","215","216","217","218","219","22","220","221","222","23","24","25","26","27","28","29","3","30","301","302","303","31","32","33","34","35","36","37","38","39","4","40","41","42","43","44","45","46","47","48","49","5","50","51","52","53","54","55","56","57","58","59","6","7","8","9"]);
    const personalizados=cadastros.motivos.filter(x=>!oldDefaultCodes.has(motivoCodeKey(x?.codigo)));
    cadastros.motivos=[...DEFAULT_MOTIVOS,...personalizados];
    localStorage.setItem(CADKEY+'_motivos_version',MOTIVOS_VERSION);
  }

  cadastros.motivos=cadastros.motivos.filter(x=>x && (x.codigo||x.descricao));
  {const __seenM=new Set();cadastros.motivos=cadastros.motivos.filter(x=>{const k=motivoCodeKey(x.codigo);if(__seenM.has(k))return false;__seenM.add(k);return true});}
  cadastros.pecas=cadastros.pecas.map(x=>({
    ...x,
    cliente:canonicalClientName(x?.cliente),
    codigo:String(x?.codigo??''),
    descricao:String(x?.descricao??''),
    pesoPrincipal:x?.pesoPrincipal==null?'':x.pesoPrincipal,
    pesoArvore:x?.pesoArvore==null?'':x.pesoArvore,
    pesoFundUsin:x?.pesoFundUsin==null?'':x.pesoFundUsin,
    pesoUsinado:x?.pesoUsinado==null?'':x.pesoUsinado
  })).filter(x=>x && (x.codigo||x.descricao)).filter((()=>{const seen=new Set();return x=>{const k=String(x.codigo)+'\u0001'+String(x.cliente).toUpperCase()+'\u0001'+String(x.descricao).toUpperCase();if(seen.has(k))return false;seen.add(k);return true}})());
  // Garante que todos os clientes existentes nos lançamentos históricos também
  // estejam disponíveis no campo Cliente do formulário de Novo lançamento.
  const clientesHistorico=Array.isArray(data)?[...new Set(data.map(r=>String(r?.CLIENTE??'')))].map(canonicalClientName).filter(Boolean):[];
  cadastros.clientes=normalizeClientList([...(cadastros.clientes||[]),...clientesHistorico]);
  const responsaveisHistorico=Array.isArray(data)?[...new Set(data.map(r=>String(r?.['RESPONSÁVEL PELA ETIQUETA']??'').trim()).filter(Boolean))]:[];
  if(!Array.isArray(cadastros.participantes))cadastros.participantes=['Ryan','Jambres','Gabriel','Antonio','Jose Raimundo','Josemario','Johnny','Christoffer','Fabio R.','Tiago B.','Thiago M.'].map(n=>({nome:n,email:''}));
  {const seenP=new Set();cadastros.participantes=cadastros.participantes.map(x=>typeof x==='string'?{nome:x.trim(),email:''}:{nome:String(x?.nome??'').trim(),email:String(x?.email??'').trim()}).filter(x=>{if(!x.nome)return false;const k=x.nome.toUpperCase();if(seenP.has(k))return false;seenP.add(k);return true})}
  cadastros.responsaveis=[...(cadastros.responsaveis||[]),...responsaveisHistorico]
    .map(x=>String(x).trim()).filter(Boolean)
    .filter((()=>{const seen=new Set();return x=>{const k=x.toUpperCase();if(seen.has(k))return false;seen.add(k);return true}})())
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

function saveCad(){localStorage.setItem(CADKEY,JSON.stringify(cadastros));}
function renderCadastro(){
 // Não reinsere a lista-base ao renderizar: isso permite excluir motivos de forma permanente.
 if(!cadastros || typeof cadastros!=='object') cadastros={motivos:[],pecas:[],clientes:[],responsaveis:[]};
 const mv=document.getElementById('motivosListView'),pv=document.getElementById('pecasListView'),cv=document.getElementById('clientesListView'),rv=document.getElementById('responsaveisListView');
 if(mv)mv.innerHTML=cadastros.motivos.map((x,i)=>`<div class="cad-item"><div class="cad-main"><div class="cad-title">${esc(x.codigo||'—')} — ${esc(x.descricao||'Sem descrição')}</div><div class="cad-sub">Planta: ${esc(x.planta||'—')}</div></div><div class="cad-actions"><button class="btn secondary cad-edit" onclick="editMotivo(${i})">Editar</button><button class="btn danger cad-delete" onclick="removeMotivo(${i})">Excluir</button></div></div>`).join('')||'<div class="small">Nenhum motivo cadastrado.</div>';
 if(pv)pv.innerHTML=cadastros.pecas.map((x,i)=>`<div class="cad-item"><div class="cad-main"><div class="cad-title">${esc(x.descricao||'Sem descrição')}</div><div class="cad-sub">Cliente: ${esc(x.cliente||'—')} • Código: ${esc(x.codigo||'—')} • Planta: ${esc(x.planta||'—')}</div><div class="product-card-weight">Peso principal / bruto fracionado: ${x.pesoPrincipal!==''&&x.pesoPrincipal!=null?fmt(x.pesoPrincipal)+' kg':'Não informado'}</div><div class="product-card-other"><b>Pesos:</b> Árvore ${x.pesoArvore!==''&&x.pesoArvore!=null?fmt(x.pesoArvore)+' kg':'—'} • Líquido Fund./Bruto Usin. ${x.pesoFundUsin!==''&&x.pesoFundUsin!=null?fmt(x.pesoFundUsin)+' kg':'—'} • Usinado ${x.pesoUsinado!==''&&x.pesoUsinado!=null?fmt(x.pesoUsinado)+' kg':'—'}</div></div><div class="cad-actions"><button class="btn secondary cad-edit" onclick="editPeca(${i})">Editar</button><button class="btn danger cad-delete" onclick="removePeca(${i})">Excluir</button></div></div>`).join('')||'<div class="small">Nenhuma peça cadastrada.</div>';
 if(cv)cv.innerHTML=cadastros.clientes.map((x,i)=>`<div class="cad-item"><div class="cad-main"><div class="cad-title">${esc(x)}</div></div><div class="cad-actions"><button class="btn secondary cad-edit" onclick="editCliente(${i})">Editar</button><button class="btn danger cad-delete" onclick="removeCliente(${i})">Excluir</button></div></div>`).join('')||'<div class="small">Nenhum cliente cadastrado.</div>';
 if(rv)rv.innerHTML=cadastros.responsaveis.map((x,i)=>`<div class="cad-item"><div class="cad-main"><div class="cad-title">${esc(x)}</div></div><div class="cad-actions"><button class="btn secondary cad-edit" onclick="editResponsavel(${i})">Editar</button><button class="btn danger cad-delete" onclick="removeResponsavel(${i})">Excluir</button></div></div>`).join('')||'<div class="small">Nenhum responsável cadastrado.</div>';
 document.getElementById('motivosCount')?.replaceChildren(document.createTextNode(`${cadastros.motivos.length} motivo(s)`));
 document.getElementById('pecasCount')?.replaceChildren(document.createTextNode(`${cadastros.pecas.length} peça(s)`));
 document.getElementById('clientesCount')?.replaceChildren(document.createTextNode(`${cadastros.clientes.length} cliente(s)`));
 document.getElementById('responsaveisCount')?.replaceChildren(document.createTextNode(`${cadastros.responsaveis.length} responsável(is)`));
  const pav=document.getElementById('participantesListView');
  if(pav)pav.innerHTML=(cadastros.participantes||[]).map((x,i)=>`<div class="cad-item"><div class="cad-main"><div class="cad-title">${esc(x.nome)}</div><div class="cad-sub">${x.email?'✉ '+esc(x.email):'Sem e-mail cadastrado'}</div></div><div class="cad-actions"><button class="btn secondary cad-edit" onclick="editParticipante(${i})">Editar</button><button class="btn danger cad-delete" onclick="removeParticipante(${i})">Excluir</button></div></div>`).join('')||'<div class="small">Nenhum participante cadastrado.</div>';
  document.getElementById('participantesCount')?.replaceChildren(document.createTextNode(`${(cadastros.participantes||[]).length} participante(s)`));
 const ml=document.getElementById('motivosList'),mdl=document.getElementById('motivosDescList'),pl=document.getElementById('pecasList');
 if(ml)ml.innerHTML=cadastros.motivos.map(x=>`<option value="${esc(x.codigo)}">${esc(x.descricao)}${x.planta?' — '+esc(x.planta):''}</option>`).join('');
 if(mdl)mdl.innerHTML=cadastros.motivos.map(x=>`<option value="${esc(x.descricao)}">${esc(x.codigo)}${x.planta?' — '+esc(x.planta):''}</option>`).join('');
 if(pl)pl.innerHTML=cadastros.pecas.map(x=>`<option value="${esc(x.descricao)}">${esc(x.cliente||'')} • ${esc(x.codigo||'')}</option>`).join('');
 const cl=document.getElementById('clientesList');
 if(cl){ cl.innerHTML=cadastros.clientes.map(x=>`<option value="${esc(x)}"></option>`).join(''); }
 const clienteSelect=document.getElementById('cliente');
 if(clienteSelect){
   if(!String(document.getElementById('codigo')?.value||'').trim()){
     const atual=String(clienteSelect.value||'').trim();
     clienteSelect.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
     if(atual && (cadastros.clientes.includes(atual)||atual===SEM_CLIENTE)) clienteSelect.value=atual;
   }
 }
 const responsavelSelect=document.getElementById('responsavel');
 if(responsavelSelect){
   const atual=String(responsavelSelect.value||'').trim();
   responsavelSelect.innerHTML='<option value="">Selecione o responsável</option>'+cadastros.responsaveis.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
   if(atual && cadastros.responsaveis.some(x=>x.toUpperCase()===atual.toUpperCase())){
     const exato=cadastros.responsaveis.find(x=>x.toUpperCase()===atual.toUpperCase());
     responsavelSelect.value=exato;
   }
 }
}
function popularCamposLancamento(){try{ltMatPop()}catch(e){}
  // Preenche responsáveis, motivos e clientes do formulário de Lançamento
  // sem depender de a aba Cadastro (protegida) ter sido aberta antes.
  try{
    normalizeCad();
    const ml=document.getElementById('motivosList'),mdl=document.getElementById('motivosDescList'),cl=document.getElementById('clientesList');
    if(ml)ml.innerHTML=cadastros.motivos.map(x=>`<option value="${esc(x.codigo)}">${esc(x.descricao)}${x.planta?' — '+esc(x.planta):''}</option>`).join('');
    if(mdl)mdl.innerHTML=cadastros.motivos.map(x=>`<option value="${esc(x.descricao)}">${esc(x.codigo)}${x.planta?' — '+esc(x.planta):''}</option>`).join('');
    if(cl)cl.innerHTML=cadastros.clientes.map(x=>`<option value="${esc(x)}"></option>`).join('');
    const rs=document.getElementById('responsavel');
    if(rs){
      const atual=String(rs.value||'').trim();
      rs.innerHTML='<option value="">Selecione o responsável</option>'+cadastros.responsaveis.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      if(atual){const ex=cadastros.responsaveis.find(x=>x.toUpperCase()===atual.toUpperCase());if(ex)rs.value=ex;}
    }
    const cs=document.getElementById('cliente'),cod=document.getElementById('codigo');
    if(cs&&cod&&!String(cod.value||'').trim()&&!cs.value) cs.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
  }catch(err){console.warn('Falha ao popular campos do lançamento:',err)}
}
function filtrarProdutosPorCodigo(){
  const input=document.getElementById('searchProdutoCodigo');
  const box=document.getElementById('pecasListView');
  const count=document.getElementById('produtoSearchCount');
  if(!input || !box) return;
  const termo=String(input.value||'').trim().toUpperCase();
  const cards=[...box.querySelectorAll('.cad-item')];
  let visiveis=0;
  cards.forEach(card=>{
    const text=String(card.textContent||'').toUpperCase();
    // O código aparece no texto do card; permite pesquisar exatamente ou por parte do código.
    const m=termo==='' || text.includes(termo);
    card.style.display=m?'':'none';
    if(m) visiveis++;
  });
  if(count) count.textContent=termo?`${visiveis} produto(s) encontrado(s)`:'';
}

document.getElementById('searchProdutoCodigo')?.addEventListener('input',filtrarProdutosPorCodigo);
document.getElementById('searchProdutoCodigo')?.addEventListener('change',filtrarProdutosPorCodigo);

function motivoCodeKey(v){return String(v??'').trim().replace(/^0+(?=\d)/,'');}
function findMotivoByCode(v){
 const key=motivoCodeKey(v);
 return cadastros.motivos.find(x=>motivoCodeKey(x.codigo)===key);
}
function findMotivoByDesc(v){
 const key=String(v??'').trim().toUpperCase();
 return cadastros.motivos.find(x=>String(x.descricao??'').trim().toUpperCase()===key);
}
function syncMotivoFromCode(){
 const input=document.getElementById('motivo'), desc=document.getElementById('descricaoMotivo'), planta=document.getElementById('planta');
 const item=findMotivoByCode(input?.value);
 if(item){
   if(desc) desc.value=item.descricao||'';
   if(planta && !String(planta.value||'').trim()) planta.value=item.planta||'';
 }
}
function syncMotivoFromDescription(){
 const input=document.getElementById('motivo'), desc=document.getElementById('descricaoMotivo'), planta=document.getElementById('planta');
 const item=findMotivoByDesc(desc?.value);
 if(item){
   if(input) input.value=item.codigo||'';
   if(planta && !String(planta.value||'').trim()) planta.value=item.planta||'';
 }
}
document.getElementById('motivo')?.addEventListener('input',syncMotivoFromCode);
document.getElementById('motivo')?.addEventListener('change',syncMotivoFromCode);
document.getElementById('descricaoMotivo')?.addEventListener('input',syncMotivoFromDescription);
document.getElementById('descricaoMotivo')?.addEventListener('change',syncMotivoFromDescription);

function switchCadTab(tab){
 const tabs=document.querySelectorAll('.cad-tab');
 tabs.forEach(b=>b.classList.toggle('active',b.dataset.cadTab===tab));
 document.getElementById('cadTabMotivos')?.classList.toggle('active',tab==='motivos');
 document.getElementById('cadTabProdutos')?.classList.toggle('active',tab==='produtos');
 document.getElementById('cadTabClientes')?.classList.toggle('active',tab==='clientes');
 document.getElementById('cadTabResponsaveis')?.classList.toggle('active',tab==='responsaveis');
 document.getElementById('cadTabParticipantes')?.classList.toggle('active',tab==='participantes');
 document.getElementById('cadTabMetas')?.classList.toggle('active',tab==='metas');
 document.getElementById('cadTabMateriais')?.classList.toggle('active',tab==='materiais');if(tab==='materiais')cadMatLoad();
}
function editMotivo(i){
 const item=cadastros.motivos[i]; if(!item)return;
 const c=prompt('Código do motivo:',String(item.codigo??'')); if(c===null)return;
 const d=prompt('Descrição do motivo:',String(item.descricao??'')); if(d===null)return;
 const code=c.trim(),desc=d.trim();
 if(!code&&!desc)return alert('Informe o código ou a descrição do motivo.');
 const duplicate=cadastros.motivos.some((x,idx)=>idx!==i&&motivoCodeKey(x.codigo)===motivoCodeKey(code)&&String(x.descricao??'').trim().toUpperCase()===desc.toUpperCase());
 if(duplicate)return alert('Esse motivo já está cadastrado.');
 cadastros.motivos[i]={...item,codigo:code,descricao:desc}; saveCad(); renderCadastro();
}
function editPeca(i){
 const item=cadastros.pecas[i];
 if(!item)return;
 switchCadTab('produtos');
 const fields={
   cadPecaEditIndex:i,
   cadPecaCliente:item.cliente||'',
   cadPecaCode:item.codigo||'',
   cadPecaPlanta:item.planta||'',
   cadPecaDesc:item.descricao||'',
   cadPecaPesoPrincipal:item.pesoPrincipal??'',
   cadPecaPesoArvore:item.pesoArvore??'',
   cadPecaPesoFundUsin:item.pesoFundUsin??'',
   cadPecaPesoUsinado:item.pesoUsinado??''
 };
 Object.entries(fields).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val});
 const saveBtn=document.getElementById('cadPecaSaveBtn');if(saveBtn)saveBtn.textContent='✓ Atualizar produto';
 const cancelBtn=document.getElementById('cadPecaCancelBtn');if(cancelBtn)cancelBtn.style.display='block';
 const form=document.getElementById('cadPecaCliente');form?.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelEditPeca(){
 const ids=['cadPecaEditIndex','cadPecaCliente','cadPecaCode','cadPecaPlanta','cadPecaDesc','cadPecaPesoPrincipal','cadPecaPesoArvore','cadPecaPesoFundUsin','cadPecaPesoUsinado'];
 ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
 const saveBtn=document.getElementById('cadPecaSaveBtn');if(saveBtn)saveBtn.textContent='+ Adicionar produto';
 const cancelBtn=document.getElementById('cadPecaCancelBtn');if(cancelBtn)cancelBtn.style.display='none';
}
function editResponsavel(i){
 const atual=String(cadastros.responsaveis[i]??''); if(!atual)return;
 const d=prompt('Nome do responsável:',atual); if(d===null)return;
 const novo=d.trim(); if(!novo)return alert('Informe o nome do responsável.');
 const duplicate=cadastros.responsaveis.some((x,idx)=>idx!==i&&String(x).trim().toUpperCase()===novo.toUpperCase());
 if(duplicate)return alert('Esse responsável já está cadastrado.');
 cadastros.responsaveis[i]=novo; saveCad(); renderCadastro();
}
function editCliente(i){
 const atual=String(cadastros.clientes[i]??'').trim(); if(!atual)return;
 const d=prompt('Nome do cliente:',atual); if(d===null)return;
 const novo=d.trim(); if(!novo)return alert('Informe o nome do cliente.');
 const duplicate=cadastros.clientes.some((x,idx)=>idx!==i&&String(x).trim().toUpperCase()===novo.toUpperCase());
 if(duplicate)return alert('Esse cliente já está cadastrado.');
 cadastros.clientes[i]=novo; cadastros.clientes.sort((a,b)=>a.localeCompare(b,'pt-BR')); saveCad(); renderCadastro();
}

function addMotivo(){const c=document.getElementById('cadMotivoCode').value.trim(),d=document.getElementById('cadMotivoDesc').value.trim();if(!c&&!d)return alert('Informe o código ou a descrição do motivo.');if(cadastros.motivos.some(x=>String(x.codigo)===c&&String(x.descricao).toUpperCase()===d.toUpperCase()))return alert('Esse motivo já está cadastrado.');cadastros.motivos.push({codigo:c,descricao:d});saveCad();document.getElementById('cadMotivoCode').value='';document.getElementById('cadMotivoDesc').value='';renderCadastro();}
function addPeca(){
 const editRaw=document.getElementById('cadPecaEditIndex')?.value??'';
 const editIndex=editRaw!==''?Number(editRaw):null;
 const cli=document.getElementById('cadPecaCliente').value.trim();
 const c=document.getElementById('cadPecaCode').value.trim();
 let planta=document.getElementById('cadPecaPlanta').value.trim().toUpperCase();
 const d=document.getElementById('cadPecaDesc').value.trim();
 if(planta==='FUNDICAO')planta='FUNDIÇÃO';
 if(planta==='FUNDICAO NA USINAGEM')planta='FUNDIÇÃO NA USINAGEM';
 if(!c)return alert('Informe o código da peça.');
 if(!d)return alert('Informe a descrição da peça.');
 if(!planta)return alert('Selecione a planta da peça.');
 const toNum=id=>{const v=document.getElementById(id)?.value.trim();if(!v)return null;const n=Number(v.replace(',','.'));return Number.isFinite(n)&&n>=0?n:null};
 const principal=toNum('cadPecaPesoPrincipal'),arvore=toNum('cadPecaPesoArvore'),fundUsin=toNum('cadPecaPesoFundUsin'),usinado=toNum('cadPecaPesoUsinado');
 if(principal===null||arvore===null||fundUsin===null||usinado===null)return alert('Preencha os 4 pesos com valores válidos.');
 const normalizeClient=x=>canonicalClientName(x||'').trim();
 const cliente=normalizeClient(cli);
 const registro={cliente,codigo:c,planta,descricao:d,pesoPrincipal:principal,pesoArvore:arvore,pesoFundUsin:fundUsin,pesoUsinado:usinado};
 if(editIndex!==null && Number.isInteger(editIndex) && cadastros.pecas[editIndex]){
   const duplicate=cadastros.pecas.some((x,idx)=>idx!==editIndex&&String(x.codigo??'').trim()===c&&String(x.cliente??'').trim().toUpperCase()===cliente.toUpperCase());
   if(duplicate)return alert('Essa combinação de cliente + código já está cadastrada em outro produto.');
   cadastros.pecas[editIndex]={...cadastros.pecas[editIndex],...registro, _origemExcel:cadastros.pecas[editIndex]._origemExcel??false};
   saveCad();
   renderCadastro();
   cancelEditPeca();
   alert('Produto atualizado com sucesso.');
   return;
 }
 if(cadastros.pecas.some(x=>String(x.codigo)===c&&String(x.cliente).toUpperCase()===cliente.toUpperCase()))return alert('Essa combinação de cliente + código já está cadastrada.');
 cadastros.pecas.push(registro);saveCad();
 cancelEditPeca();
 renderCadastro();
}
function emailValido(e){return !e||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}
function addParticipante(){const n=document.getElementById('cadPartNome').value.trim(),e=document.getElementById('cadPartEmail').value.trim();if(!n)return alert('Informe o nome do participante.');if(!emailValido(e))return alert('E-mail inválido.');if(cadastros.participantes.some(x=>x.nome.toUpperCase()===n.toUpperCase()))return alert('Esse participante já está cadastrado.');cadastros.participantes.push({nome:n,email:e});saveCad();scheduleFirebasePush();document.getElementById('cadPartNome').value='';document.getElementById('cadPartEmail').value='';renderCadastro()}
function editParticipante(i){const x=cadastros.participantes[i];if(!x)return;const n=prompt('Nome do participante:',x.nome);if(n===null)return;const nome=n.trim();if(!nome)return alert('Informe o nome do participante.');const e=prompt('E-mail do participante:',x.email||'');if(e===null)return;const em=e.trim();if(!emailValido(em))return alert('E-mail inválido.');if(cadastros.participantes.some((y,idx)=>idx!==i&&y.nome.toUpperCase()===nome.toUpperCase()))return alert('Esse participante já está cadastrado.');cadastros.participantes[i]={nome,email:em};saveCad();scheduleFirebasePush();renderCadastro()}
function removeParticipante(i){if(confirm('Excluir este participante do cadastro? As atas já salvas não são alteradas.')){cadastros.participantes.splice(i,1);saveCad();scheduleFirebasePush();renderCadastro()}}
function addResponsavel(){const d=document.getElementById('cadResponsavel').value.trim();if(!d)return alert('Informe o nome do responsável.');if(cadastros.responsaveis.some(x=>x.toUpperCase()===d.toUpperCase()))return alert('Esse responsável já está cadastrado.');cadastros.responsaveis.push(d);saveCad();document.getElementById('cadResponsavel').value='';renderCadastro();}
function addCliente(){const d=document.getElementById('cadCliente').value.trim();if(!d)return alert('Informe o nome do cliente.');if(cadastros.clientes.some(x=>String(x).trim().toUpperCase()===d.toUpperCase()))return alert('Esse cliente já está cadastrado.');cadastros.clientes.push(d);cadastros.clientes.sort((a,b)=>a.localeCompare(b,'pt-BR'));saveCad();document.getElementById('cadCliente').value='';renderCadastro();}
function removeMotivo(i){if(confirm('Excluir este motivo do cadastro?')){cadastros.motivos.splice(i,1);saveCad();renderCadastro()}}
function removePeca(i){if(confirm('Excluir esta peça do cadastro?')){cadastros.pecas.splice(i,1);saveCad();renderCadastro()}}
function removeResponsavel(i){if(confirm('Excluir este responsável do cadastro?')){cadastros.responsaveis.splice(i,1);saveCad();renderCadastro()}}
function removeCliente(i){if(confirm('Excluir este cliente do cadastro?')){cadastros.clientes.splice(i,1);saveCad();renderCadastro()}}

function save(){
  __historySearchCache=new WeakMap();
  limparRegistrosZeradosHistorico();
  localStorage.setItem(KEY,JSON.stringify(data));
  dashboardDirty=true;dashboardQtdDirty=true;
}
function saveMeta(){if(!cadastroAccessAllowed()){alert('A meta só pode ser alterada na aba Cadastro, com a senha liberada.');return}meta={perc:n(metaPerc.value),kg:n(metaKg.value)};localStorage.setItem(KEY+'_meta',JSON.stringify(meta));dashboardDirty=true;if(document.getElementById('dashboard')?.classList.contains('active'))dashboard();alert('Meta salva.')}
function productionYear(p){const y=Number(p?.ano);return Number.isFinite(y)?y:null}
function productionMonth(p){const m=Number(p?.mes);return Number.isFinite(m)&&m>=1&&m<=12?m:null}
function productionValue(p){return n(p?.kg)}
function productionTotalForFilters(){
  const y=String(document.getElementById('filterYear')?.value||'');
  const PL=plSel('filterPlant');
  const m=String(document.getElementById('filterMonth')?.value||'');
  if(PL.length&&PL.indexOf('FUNDICAO')<0) return 0;
  return producaoFundicao.reduce((sum,r)=>{const ry=productionYear(r),rm=productionMonth(r);return sum+((!y||String(ry)===y)&&(!m||String(rm)===m)?productionValue(r):0)},0);
}
function productionMonthsForDashboard(){
  const fy=String(document.getElementById('filterYear')?.value||'');
  const PL=plSel('filterPlant');
  const arr=Array(12).fill(0);
  if(PL.length&&PL.indexOf('FUNDICAO')<0) return arr;
  producaoFundicao.forEach(r=>{const y=productionYear(r),m=productionMonth(r);if(m&&(!fy||String(y)===fy))arr[m-1]+=productionValue(r)});
  return arr;
}
function produced(r){return 0}
function recordProductionEntry(r){
  const d=date(r);
  if(!d) return null;
  const y=d.getFullYear(), m=d.getMonth()+1;
  return producaoFundicao.find(p=>productionYear(p)===y && productionMonth(p)===m) || null;
}
function monthlyRefugoCost(r){const p=recordProductionEntry(r);return p?Number(p.custoKg)||0:0}
function directRefugoCostRate(r){
  const keys=[cols.custoKg,'CUSTO DO REFUGO (R$/KG)','CUSTO DO REFUGO','CUSTO R$/KG'];
  for(const k of keys){
    const v=r?.[k];
    if(v!==undefined&&v!==null&&String(v).trim()!==''){
      const n0=Number(String(v).replace(/[^0-9,.-]/g,'').replace(/\.(?=\d{3}(?:[,]|$))/g,'').replace(',','.'));
      if(Number.isFinite(n0)) return n0;
    }
  }
  return null;
}
function cost(r){const direct=directRefugoCostRate(r);return kg(r)*(direct!==null?direct:monthlyRefugoCost(r))}
function n(v){return Number(v)||0}
const DATA_OLD_HEADER='DATA DO REFUGO/ DATA DA APROVAÇÃO';/* Planta do refugo = planta do MOTIVO (cadastro de motivos), não a planta da peça. Ex.: motivo 209 => USINAGEM.
   Só vale para FUNDICAO, FUNDICAO NA USINAGEM e USINAGEM; motivos GERAL/SISTEMA ou sem cadastro mantêm a planta gravada. */
let __motPlantaCache=null,__motPlantaRef=null,__motPlantaLen=-1;
function __motPlantaMaps(){
  const arr=(typeof cadastros!=='undefined'&&cadastros&&Array.isArray(cadastros.motivos))?cadastros.motivos:[];
  if(__motPlantaCache&&__motPlantaRef===arr&&__motPlantaLen===arr.length)return __motPlantaCache;
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
  const okPl={'FUNDICAO':'FUNDICAO','FUNDICAO NA USINAGEM':'FUNDICAO NA USINAGEM','USINAGEM':'USINAGEM'};
  const byCode=new Map(),byDesc=new Map();
  arr.forEach(x=>{const pl=okPl[norm(x.planta)];if(!pl)return;const c=String(x.codigo??'').trim().replace(/^0+(?=\d)/,'');if(c)byCode.set(c,pl);const d=norm(x.descricao);if(d&&!byDesc.has(d))byDesc.set(d,pl)});
  __motPlantaCache={byCode,byDesc,norm};__motPlantaRef=arr;__motPlantaLen=arr.length;return __motPlantaCache;
}
function plantaPeloMotivo(r){
  if(!r||typeof r!=='object')return '';
  const m=__motPlantaMaps();
  const rawC=String(r['MOTIVO DO REFUGO']??r.motivo??'').trim();
  const mc=rawC.match(/^\d+/);
  if(mc){const pl=m.byCode.get(mc[0].replace(/^0+(?=\d)/,''));if(pl)return pl}
  const d=m.norm(r['DESCRIÇÃO DO MOTIVO']??r.descricaoMotivo??'');
  if(d){const pl=m.byDesc.get(d);if(pl)return pl}
  return '';
}
function val(r,k){if(!r||typeof r!=='object')return '';if(k==='planta'){const pm=plantaPeloMotivo(r);if(pm)return pm}const primary=cols[k];if(primary && r[primary]!==undefined && r[primary]!==null && r[primary]!=='')return r[primary];if(k==='data' && r[DATA_OLD_HEADER]!==undefined && r[DATA_OLD_HEADER]!==null)return r[DATA_OLD_HEADER];return ''}
function kg(r){return n(val(r,'kgRefugo'))}
function qty(r){return n(val(r,'quantidade'))}
function normalizeText(v){return String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ')} function date(r){let x=val(r,'data'); if(x===null||x===undefined||x==='')return null; if(x instanceof Date)return isNaN(x.getTime())?null:x; if(typeof x==='number'&&isFinite(x)){let d=new Date(Date.UTC(1899,11,30)+x*86400000);return isNaN(d.getTime())?null:d;} let s=String(x).trim(); let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if(m){let d=new Date(+m[3],+m[2]-1,+m[1]);return isNaN(d.getTime())?null:d;} m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/); if(m){let d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d.getTime())?null:d;} let d=new Date(s);return isNaN(d.getTime())?null:d;}
function fmt(v){return n(v).toLocaleString('pt-BR',{maximumFractionDigits:2})}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function recordYear(r){
  // Primeiro usa o campo ANO já existente na base; depois tenta a data.
  const rawAno = r && (r['ANO'] ?? r.ANO);
  if(rawAno!==undefined && rawAno!==null && String(rawAno).trim()!==''){
    const y=Number(String(rawAno).trim());
    if(Number.isFinite(y) && y>=1901 && y<=2100) return y;
  }
  const d=date(r); return d ? d.getFullYear() : null;
}
function recordMonth(r){
  // O Excel de referência usa o campo MÊS como fonte do dashboard mensal.
  // Há alguns registros históricos em que MÊS está gravado como número (ex.: 5)
  // enquanto a tabela dinâmica considera apenas os rótulos textuais (ex.: "maio").
  // Para manter o site idêntico à planilha, números não entram como mês de relatório.
  const rawMes = r && (r['MÊS'] ?? r.MES ?? r.mes);
  if(rawMes!==undefined && rawMes!==null && String(rawMes).trim()!==''){
    const s=normalizeText(rawMes), map={JANEIRO:1,FEVEREIRO:2,MARCO:3,ABRIL:4,MAIO:5,JUNHO:6,JULHO:7,AGOSTO:8,SETEMBRO:9,OUTUBRO:10,NOVEMBRO:11,DEZEMBRO:12};
    if(map[s])return map[s];
    const numericMonth=Number(String(rawMes).trim());
    if(Number.isFinite(numericMonth)&&numericMonth>=1&&numericMonth<=12)return null;
  }
  // Registros novos, sem MÊS preenchido, continuam sendo agrupados pela data.
  const d=date(r); return d ? d.getMonth()+1 : null;
}
function recordPlant(r){
  return plantNormName(plantaPeloMotivo(r) || (r?.[cols.planta] ?? r?.PLANTA ?? r?.planta ?? r?.Planta ?? ''));
}
function filtered(){
  const y=String(document.getElementById('filterYear')?.value||''),PL=plSel('filterPlant'),m=String(document.getElementById('filterMonth')?.value||'');
  return data.filter(r=>{
    const ry=recordYear(r), rp=recordPlant(r), rm=recordMonth(r);
    return (!y||String(ry)===y)&&plHas(PL,rp)&&(!m||String(rm)===m);
  });
}
function options(){
  const fy=document.getElementById('filterYear'),fp=document.getElementById('filterPlant');if(!fy||!fp)return;
  const years=[...new Set(data.map(recordYear).filter(y=>y!==null))].sort((a,b)=>a-b);
  const plants=[...new Set(data.map(recordPlant).filter(x=>x&&x!=='NAO INFORMADO'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const oldY=String(fy.value||''),oldPRaw=String(fp.value||'').trim(),oldP=oldPRaw?plantNormName(oldPRaw):'';
  fy.innerHTML='<option value="">Todos os anos</option>'+years.map(x=>`<option value="${x}">${x}</option>`).join('');
  fp.innerHTML='<option value="">Todas as plantas</option>'+plants.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  if(years.some(x=>String(x)===oldY))fy.value=oldY; else fy.value='';
  if(plants.includes(oldP))fp.value=oldP; else fp.value='';
}
function group(rows,key,limit=99){
 let o={};rows.forEach(r=>{let k=key(r)||'Não informado';o[k]=(o[k]||0)+kg(r)});
 return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,limit);
}
function cssVar(name,fallback){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback}
function canvasDpr(){return document.querySelector('.pdf-print-target') ? 3 : Math.min(1.5,Math.max(1,devicePixelRatio||1))}
let dashboardChartRows=[];
let dashboardQtyChartRows=[];
let chartDetailConfigs={};
function setChartDetailConfig(id,cfg){ chartDetailConfigs[id]=cfg||{}; }

function attachChartInteraction(c,id){
 if(!c)return;
 c.style.cursor='pointer';
 c.onclick=function(e){
   const rect=c.getBoundingClientRect();
   const x=e.clientX-rect.left, y=e.clientY-rect.top;
   if(id==='qChartMotivo'){
     const hit=(c._motivoHits||[]).find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);
     if(hit && qMotivoChartData?.[hit.index]){
       showQMotivoPopover(hit.index,e.clientX,e.clientY);
       e.stopPropagation();
     }
     return;
   }
   const cfg=chartDetailConfigs?.[id];
   if(!cfg)return;
   const hits=c._chartHits||[];
   let hit=null;
   for(const h of hits){
     if(h.donut){if(pointInDonutHit(h,x,y)){hit=h;break}}
     else if(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h){hit=h;break}
   }
   if(hit){
     showChartDetail(id,hit.index,hit.seriesIndex,e.clientX,e.clientY);
     e.stopPropagation();
   }
 };
 c.onmousemove=function(e){
   const rect=c.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
   if(id==='qChartMotivo'){
     const hit=(c._motivoHits||[]).find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);
     c.style.cursor=hit?'pointer':'default'; return;
   }
   const hits=c._chartHits||[];
   const hit=hits.find(h=>h.donut?pointInDonutHit(h,x,y):(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h));
   c.style.cursor=hit?'pointer':'default';
 };
}
function draw(id,labels,values,horizontal=false,unit='kg'){
 let c=document.getElementById(id);if(!c)return;let ctx=c.getContext('2d'),dpr=canvasDpr(),w=c.clientWidth||500,h=c.clientHeight||340;
 c._chartHits=[]; if(id==='qChartMotivo'){c._motivoHits=[];c.classList.add('q-motivo-clickable');}
 c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 let max=Math.max(...values,1),text=cssVar('--canvas-text','#4c5864'),grid=cssVar('--canvas-grid','#e8edf2'),accent=cssVar('--orange','#ff5a18');
 ctx.font='11px Segoe UI';ctx.lineWidth=1;ctx.strokeStyle=grid;ctx.fillStyle=text;
 if(horizontal){
   let longest=Math.max(0,...labels.map(x=>String(x??'').length));
   let left=Math.min(205,Math.max(145,110+longest*2.2)),right=92,top=12,bottom=10,chartW=Math.max(120,w-left-right),chartH=Math.max(100,h-top-bottom),row=chartH/Math.max(labels.length,1),bh=Math.min(24,Math.max(13,row-7));
   labels.forEach((lab,i)=>{
     let y=top+i*row+(row-bh)/2,bw=values[i]/max*chartW;
     if(id==='qChartMotivo'){c._motivoHits.push({index:i,x:0,y:y-5,w:w,h:bh+10});} c._chartHits.push({index:i,x:0,y:y-5,w:w,h:bh+10});
     ctx.fillStyle=accent;ctx.beginPath();ctx.roundRect(left,y,bw,bh,6);ctx.fill();
     ctx.fillStyle=text;ctx.textAlign='right';ctx.font='10px Segoe UI';
     let name=String(lab??'').trim(); if(name.length>32) name=name.slice(0,31)+'…';
     ctx.fillText(name,left-9,y+bh/2+4);
     ctx.textAlign='left';ctx.font='700 10px Segoe UI';
     let valueText=fmt(values[i])+' '+unit;
     if(bw>58){ctx.fillStyle='#fff';ctx.textAlign='right';ctx.fillText(valueText,left+bw-7,y+bh/2+4);}
     else{ctx.fillStyle=text;ctx.textAlign='left';ctx.fillText(valueText,Math.min(left+bw+7,w-right+20),y+bh/2+4);}
   });
 } else {
   let left=46,right=12,top=20,bottom=36,chartW=w-left-right,chartH=h-top-bottom,step=chartW/Math.max(labels.length,1),bw=Math.min(54,step*.68);
   for(let g=0;g<=4;g++){let gy=top+chartH-g*chartH/4;ctx.beginPath();ctx.moveTo(left,gy);ctx.lineTo(w-right,gy);ctx.stroke();ctx.fillStyle=text;ctx.textAlign='right';ctx.font='10px Segoe UI';ctx.fillText(fmt(max*g/4),left-7,gy+4)}
   values.forEach((v,i)=>{let x=left+i*step+(step-bw)/2,bh=v/max*chartH,y=top+chartH-bh;c._chartHits.push({index:i,x:x-8,y:top,w:bw+16,h:chartH+18});ctx.fillStyle=accent;ctx.beginPath();ctx.roundRect(x,y,bw,bh,6);ctx.fill();ctx.fillStyle=text;ctx.textAlign='center';ctx.font='700 10px Segoe UI';ctx.fillText(fmt(v)+' '+unit,x+bw/2,Math.max(top+12,y-5));ctx.font='10px Segoe UI';ctx.fillText(String(labels[i]).slice(0,10),x+bw/2,h-12)});
 }
 ctx.textAlign='left';
 attachChartInteraction(c,id);
}
function drawLine(id,labels,seriesList){
 let c=document.getElementById(id);if(!c)return;let ctx=c.getContext('2d'),dpr=canvasDpr(),w=c.clientWidth||600,h=c.clientHeight||340;
 c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);c._chartHits=[];
 let left=45,right=16,top=34,bottom=34,cw=w-left-right,ch=h-top-bottom,all=seriesList.flatMap(s=>s.values),max=Math.max(...all,1);
 let grid=cssVar('--canvas-grid','#e8edf2'),text=cssVar('--canvas-text','#4c5864'),accent=cssVar('--orange','#ff5a18'),secondary=cssVar('--canvas-secondary','#142b49');
 ctx.font='11px Segoe UI';ctx.fillStyle=text;ctx.strokeStyle=grid;for(let g=0;g<=4;g++){let y=top+ch-g*ch/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(fmt(max*g/4),5,y+4)}
 const points=[];
 seriesList.forEach((s,si)=>{
   const color=si===0?accent:secondary;
   ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
   s.values.forEach((v,i)=>{let x=left+(labels.length===1?cw/2:i*cw/(labels.length-1)),y=top+ch-v/(max||1)*ch;i?ctx.lineTo(x,y):ctx.moveTo(x,y);points.push({x,y,v:Number(v)||0,si});});
   ctx.stroke();
   ctx.fillStyle=color;
   s.values.forEach((v,i)=>{let x=left+(labels.length===1?cw/2:i*cw/(labels.length-1)),y=top+ch-v/(max||1)*ch;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()});
   s.values.forEach((v,i)=>{let x=left+(labels.length===1?cw/2:i*cw/(labels.length-1)),y=top+ch-v/(max||1)*ch;c._chartHits.push({index:i,seriesIndex:si,x:x-10,y:y-10,w:20,h:20});});
   // Mostra o valor de cada ponto, priorizando a série principal.
   ctx.textAlign='center';ctx.font='700 10px Segoe UI';
   s.values.forEach((v,i)=>{
     const n=Number(v)||0;
     // Não repetir uma linha-meta zerada ou idêntica ao ponto principal.
     if(si>0 && (n===0 || (seriesList[0]&&Number(seriesList[0].values[i])===n))) return;
     const x=left+(labels.length===1?cw/2:i*cw/(labels.length-1));
     const y=top+ch-n/(max||1)*ch;
     const unit=s.unit||'';
     const label=fmt(n)+(unit?' '+unit:'');
     let ly=y-10;
     // Mantém o texto dentro do gráfico.
     if(ly<14) ly=y+16;
     // Evita choque com a linha-meta quando ela estiver próxima.
     if(si===0 && seriesList.length>1){
       const other=Number(seriesList[1].values[i])||0;
       const oy=top+ch-other/(max||1)*ch;
       if(Math.abs(ly-oy)<14 && other!==0) ly=Math.min(h-bottom-8,y+18);
     }
     ctx.fillStyle=text;ctx.fillText(label,x,ly);
   });
 });
 ctx.fillStyle=text;ctx.textAlign='center';ctx.font='11px Segoe UI';labels.forEach((lab,i)=>{let x=left+(labels.length===1?cw/2:i*cw/(labels.length-1));ctx.fillText(lab,x,h-12)})
 attachChartInteraction(c,id);
}
function drawStackedQty(id,labels,series){
 let c=document.getElementById(id);if(!c)return;
 let ctx=c.getContext('2d'),dpr=canvasDpr(),w=c.clientWidth||900,h=c.clientHeight||430;
 c._chartHits=[];
 c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 let totals=labels.map((_,i)=>series.reduce((a,s)=>a+(Number(s.values[i])||0),0));
 let rawMax=Math.max(...totals,1),max=rawMax*1.14;
 let left=58,right=18,top=68,bottom=42,cw=w-left-right,ch=h-top-bottom;
 let grid=cssVar('--canvas-grid','#e8edf2'),text=cssVar('--canvas-text','#4c5864'),palette=[cssVar('--orange','#ff5a18'),'#4e8bd6','#8bb54a'];
 ctx.font='10px Segoe UI';ctx.textAlign='left';
 let lx=left,ly=18;
 series.forEach((s,i)=>{
   let label=String(s.name),tw=ctx.measureText(label).width+30;
   if(lx+tw>w-right){lx=left;ly+=20}
   ctx.fillStyle=palette[i%palette.length];ctx.fillRect(lx,ly-9,9,9);
   ctx.fillStyle=text;ctx.fillText(label,lx+14,ly);lx+=tw;
 });
 ctx.font='10px Segoe UI';ctx.strokeStyle=grid;ctx.fillStyle=text;
 for(let g=0;g<=4;g++){
   let y=top+ch-g*ch/4;
   ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
   ctx.textAlign='right';ctx.fillText(fmt(rawMax*g/4),left-7,y+4);
 }
 let step=cw/Math.max(labels.length,1),bw=Math.min(58,step*.64);
 labels.forEach((lab,i)=>{
   let x=left+i*step+(step-bw)/2,base=top+ch;
   series.forEach((s,si)=>{
     let v=Number(s.values[i]||0),bh=v/max*ch,y=base-bh;
     c._chartHits.push({index:i,seriesIndex:si,x:x-6,y:y,w:bw+12,h:Math.max(bh,8),monthIndex:i}); ctx.fillStyle=palette[si%palette.length];ctx.fillRect(x,y,bw,bh);
     if(v>0){
       let label=fmt(v),fontSize=bh>=18?10:8;
       ctx.font=`700 ${fontSize}px Segoe UI`;ctx.textAlign='center';
       if(bh>=14){
         ctx.fillStyle='#fff';ctx.fillText(label,x+bw/2,y+bh/2+3);
       }else if(bh>=7){
         ctx.fillStyle='#fff';ctx.fillText(label,x+bw/2,y+bh-2);
       }else{
         // Segmentos muito pequenos recebem o valor logo acima, sem encostar no total.
         ctx.fillStyle=text;ctx.fillText(label,x+bw/2,Math.max(top+11,y-3));
       }
     }
     base=y;
   });
   // Total do mês fica sempre acima da barra, com área livre reservada no topo.
   ctx.font='700 10px Segoe UI';ctx.fillStyle=text;ctx.textAlign='center';
   let totalY=top+ch-totals[i]/max*ch-9;
   ctx.fillText(fmt(totals[i]),x+bw/2,Math.max(top-8,totalY));
   ctx.font='10px Segoe UI';ctx.fillText(String(lab).slice(0,8),x+bw/2,h-13);
 });
 ctx.textAlign='left';
 attachChartInteraction(c,id);
}
function drawDonutQty(id,labels,values,unit="un."){
 let c=document.getElementById(id);if(!c)return;let ctx=c.getContext('2d'),dpr=canvasDpr(),w=c.clientWidth||500,h=c.clientHeight||350;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 let total=values.reduce((a,b)=>a+b,0),cx=w*.30,cy=h*.48,r=Math.min(105,h*.31),colors=[cssVar('--orange','#ff5a18'),'#4e8bd6','#8bb54a','#8b68b5','#d8a33e'];
 if(!total){ctx.fillStyle=cssVar('--canvas-text','#4c5864');ctx.textAlign='center';ctx.fillText('Sem dados',cx,cy);return}
 let a=-Math.PI/2;c._chartHits=[];values.forEach((v,i)=>{let da=v/total*Math.PI*2; c._chartHits.push({index:i,donut:true,start:a,end:a+da,cx,cy,r});ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,a,a+da);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();if(v/total>=.055){let mid=a+da/2,tx=cx+Math.cos(mid)*r*.68,ty=cy+Math.sin(mid)*r*.68;ctx.fillStyle='#fff';ctx.font='700 10px Segoe UI';ctx.textAlign='center';ctx.fillText(fmt(v),tx,ty+3);ctx.font='9px Segoe UI';ctx.fillText(fmt(v/total*100)+'%',tx,ty+15)}a+=da});
 ctx.beginPath();ctx.arc(cx,cy,r*.55,0,Math.PI*2);ctx.fillStyle=cssVar('--card','#fff');ctx.fill();ctx.fillStyle=cssVar('--canvas-text','#4c5864');ctx.textAlign='center';ctx.font='700 14px Segoe UI';ctx.fillText(fmt(total),cx,cy+5);ctx.font='9px Segoe UI';ctx.fillText('total',cx,cy+19);
 let lx=w*.58,ly=28;labels.forEach((lab,i)=>{let name=String(lab),parts=[];if(name.length>22){parts=[name.slice(0,22),name.slice(22,44)];}else parts=[name];ctx.fillStyle=colors[i%colors.length];ctx.fillRect(lx,ly-8,10,10);ctx.fillStyle=cssVar('--canvas-text','#4c5864');ctx.textAlign='left';ctx.font='10px Segoe UI';ctx.fillText(parts[0],lx+16,ly);if(parts[1])ctx.fillText(parts[1],lx+16,ly+13);ctx.font='700 10px Segoe UI';ctx.fillText(fmt(values[i])+' '+unit+' ('+fmt(values[i]/total*100)+'%)',lx+16,ly+(parts[1]?27:14));ly+=parts[1]?48:34});
 attachChartInteraction(c,id);
}
function positionChartDetailPopover(x,y){
 const pop=document.getElementById('chartDetailPopover'); if(!pop)return;
 pop.style.left='0px';pop.style.top='0px';
 const rectW=pop.offsetWidth||390,rectH=pop.offsetHeight||320,pad=10;
 let left=x+14,top=y+14; if(left+rectW>window.innerWidth-pad)left=x-rectW-14; if(left<pad)left=pad; if(top+rectH>window.innerHeight-pad)top=y-rectH-14; if(top<pad)top=pad; pop.style.left=Math.round(left)+'px';pop.style.top=Math.round(top)+'px';
}
function closeChartDetailPopover(){const p=document.getElementById('chartDetailPopover');if(p){p.classList.remove('open');p.setAttribute('aria-hidden','true');}setChartPopoverBackdrop(false);}
function groupTop(rows, keyFn, measureFn, limit=8){const m={};rows.forEach(r=>{const k=String(keyFn(r)||'Não informado').trim()||'Não informado';m[k]=(m[k]||0)+measureFn(r)});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,limit);}
function showChartDetail(id,index,seriesIndex,x,y){
 const cfg=chartDetailConfigs[id],pop=document.getElementById('chartDetailPopover'); if(!cfg||!pop)return;
 let title=cfg.title||'Detalhes do gráfico',sub='',totalText='',items=[];
 const rows=cfg.rows||[]; const fmtItem=(name,val,unit)=>`<li><span class="q-motivo-qty">${fmt(val)} ${unit||''}</span><span class="q-motivo-item">${esc(name)}</span></li>`;
 if(cfg.kind==='reasonKg'){const motivo=cfg.labels[index];items=groupTop(rows,r=>val(r,'produto')||val(r,'codigo'),r=>kg(r),8);items=rows.filter(r=>motivoDescricao(r)===motivo).length?groupTop(rows.filter(r=>motivoDescricao(r)===motivo),r=>val(r,'produto')||val(r,'codigo'),r=>kg(r),8):[];const total=rows.filter(r=>motivoDescricao(r)===motivo).reduce((a,r)=>a+kg(r),0);sub='Principais itens refugados por este motivo, em peso.';totalText=fmt(total)+' kg';}
 else if(cfg.kind==='clientKg'){const client=cfg.labels[index],rr=rows.filter(r=>String(val(r,'cliente')).trim()===client);items=groupTop(rr,r=>motivoDescricao(r),r=>kg(r),8);sub='Principais motivos de refugo deste cliente.';totalText=fmt(rr.reduce((a,r)=>a+kg(r),0))+' kg';}
 else if(cfg.kind==='plantKg'){const plant=cfg.labels[index],rr=rows.filter(r=>plantNormName(val(r,'planta'))===plantNormName(plant));items=groupTop(rr,r=>motivoDescricao(r),r=>kg(r),8);sub='Principais motivos de refugo desta planta.';totalText=fmt(rr.reduce((a,r)=>a+kg(r),0))+' kg';}
 else if(cfg.kind==='monthKg'){const m=index+1,rr=rows.filter(r=>recordMonth(r)===m);items=groupTop(rr,r=>motivoDescricao(r),r=>kg(r),8);sub='Principais motivos de refugo no mês.';totalText=fmt(rr.reduce((a,r)=>a+kg(r),0))+' kg';}
 else if(cfg.kind==='rate'){const m=index+1,rr=rows.filter(r=>recordMonth(r)===m);const ref=rr.reduce((a,r)=>a+kg(r),0),prod=cfg.prod?.[index]||0;items=[[months[index]||String(m),ref]];items.push(['Produção',prod]);sub='Refugo e produção do mês selecionado.';totalText=fmt(ref)+' kg refugo';}
 else if(cfg.kind==='itemKg'){const item=cfg.labels[index],rr=rows.filter(r=>String(val(r,'produto')||val(r,'codigo')).trim()===item);items=groupTop(rr,r=>String(val(r,'cliente')).trim()||'Não informado',r=>kg(r),8);sub='Principais clientes para este item.';totalText=fmt(rr.reduce((a,r)=>a+kg(r),0))+' kg';}
 else if(cfg.kind==='monthPlantQty'){const m=index, vals=cfg.series.map(s=>Number(s.values[index]||0));items=cfg.series.map((s,i)=>[s.name,vals[i]]).filter(x=>x[1]>0);sub='Quantidade de refugo por planta no mês selecionado.';totalText=fmt(vals.reduce((a,b)=>a+b,0))+' un.';}
 else if(cfg.kind==='reasonQty'){const motivo=cfg.labels[index],rr=rows.filter(r=>motivoDescricao(r)===motivo);items=groupTop(rr,r=>val(r,'produto')||val(r,'codigo'),r=>qty(r),8);sub='Principais itens refugados por este motivo.';totalText=fmt(rr.reduce((a,r)=>a+qty(r),0))+' un.';}
 else if(cfg.kind==='clientQty'){const client=cfg.labels[index],rr=rows.filter(r=>String(val(r,'cliente')).trim()===client);items=groupTop(rr,r=>motivoDescricao(r),r=>qty(r),8);sub='Principais motivos de refugo deste cliente.';totalText=fmt(rr.reduce((a,r)=>a+qty(r),0))+' un.';}
 else if(cfg.kind==='itemQty'){const item=cfg.labels[index],rr=rows.filter(r=>String(val(r,'produto')||val(r,'codigo')).trim()===item);items=groupTop(rr,r=>String(val(r,'cliente')).trim()||'Não informado',r=>qty(r),8);sub='Principais clientes para este item.';totalText=fmt(rr.reduce((a,r)=>a+qty(r),0))+' un.';}
 else if(cfg.kind==='plantQty'){const plant=cfg.labels[index],rr=rows.filter(r=>plantNormName(val(r,'planta'))===plantNormName(plant));items=groupTop(rr,r=>motivoDescricao(r),r=>qty(r),8);sub='Principais motivos de refugo desta planta.';totalText=fmt(rr.reduce((a,r)=>a+qty(r),0))+' un.';}
 else return;
 document.getElementById('chartDetailPopoverTitle').textContent=cfg.labelPrefix?`${cfg.labelPrefix}: ${cfg.labels[index]}`:title;
 document.getElementById('chartDetailPopoverSub').textContent=sub; document.getElementById('chartDetailPopoverTotal').textContent=totalText;
 document.getElementById('chartDetailPopoverList').innerHTML=items.length?items.map(x=>fmtItem(String(x[0]),x[1],cfg.unit||'')).join(''):'<li>Nenhum detalhe encontrado.</li>';
 pop.classList.add('open');pop.setAttribute('aria-hidden','false');positionChartDetailPopover(x,y);
}
function pointInDonutHit(hit,x,y){if(!hit?.donut)return false;const dx=x-hit.cx,dy=y-hit.cy;const dist=Math.hypot(dx,dy);if(dist>hit.r||dist<hit.r*.55)return false;let a=Math.atan2(dy,dx);if(a<0)a+=Math.PI*2;let s=hit.start%(Math.PI*2);if(s<0)s+=Math.PI*2;let e=hit.end%(Math.PI*2);if(e<0)e+=Math.PI*2;return hit.end-hit.start>=Math.PI*2-0.001 || (s<=e?(a>=s&&a<=e):(a>=s||a<=e));}
function bindDashboardChartClickFallback(){
  if(document.documentElement.dataset.chartFallbackBound==='1') return;
  document.documentElement.dataset.chartFallbackBound='1';
  document.addEventListener('click',function(e){
    const c=e.target instanceof HTMLCanvasElement ? e.target : e.target?.closest?.('canvas');
    if(!c) return;
    const id=c.id;
    if(id==='qChartMotivo'){
      const rect=c.getBoundingClientRect();
      const x=e.clientX-rect.left, y=e.clientY-rect.top;
      const hit=(c._motivoHits||[]).find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);
      if(hit && window.qMotivoChartData?.[hit.index]){
        showQMotivoPopover(hit.index,e.clientX,e.clientY);
        e.stopPropagation();
      }
      return;
    }
    const cfg=chartDetailConfigs?.[id];
    if(!cfg) return;
    const rect=c.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const arr=c._chartHits||[];
    let hit=null;
    for(const h of arr){
      if(h.donut){ if(pointInDonutHit(h,x,y)){hit=h;break;} }
      else if(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h){hit=h;break;}
    }
    if(hit){
      showChartDetail(id,hit.index,hit.seriesIndex,e.clientX,e.clientY);
      e.stopPropagation();
    }
  },true);
}


function setChartPopoverBackdrop(open){const b=document.getElementById('chartPopoverBackdrop');if(!b)return;b.classList.toggle('open',!!open);b.setAttribute('aria-hidden',open?'false':'true')}
function closeAllChartPopovers(){closeChartDetailPopover();closeQMotivoPopover();}
function bindGlobalPopoverClose(){
  if(document.documentElement.dataset.globalPopoverCloseBound==='1') return;
  document.documentElement.dataset.globalPopoverCloseBound='1';
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAllChartPopovers();});
}
function bindGenericChartDetails(){
 const ids=['chartMonth','chartPareto','chartPlant','chartPlantPie','chartClient','chartRate','qChartMonthPlant','qChartClient','qChartItem','qChartPlant'];
 ids.forEach(id=>{const c=document.getElementById(id);if(!c||c.dataset.detailBound==='1')return;c.dataset.detailBound='1';
   const hitAt=(e)=>{const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const arr=c._chartHits||[];const h=arr.find(h=>h.donut?pointInDonutHit(h,x,y):(x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h));if(!h)return null;return {...h,clientX:e.clientX,clientY:e.clientY};};
   c.addEventListener('click',e=>{const h=hitAt(e);if(h)showChartDetail(id,h.index,h.seriesIndex,h.clientX,h.clientY);else closeChartDetailPopover();});
   c.addEventListener('mousemove',e=>{c.style.cursor=hitAt(e)?'pointer':'default';});
 });
 const close=document.getElementById('chartDetailPopoverClose');close?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeChartDetailPopover();});
 document.addEventListener('click',e=>{const p=document.getElementById('chartDetailPopover');if(!p||!p.classList.contains('open'))return;if(!p.contains(e.target) && !(e.target instanceof HTMLCanvasElement))closeChartDetailPopover();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeChartDetailPopover();});
}
function qtyGroup(rows,key,limit=10){let o={};rows.forEach(r=>{let k=String(key(r)||'Não informado').trim()||'Não informado';o[k]=(o[k]||0)+qty(r)});return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,limit)}

let qMotivoChartRows=[];
let qMotivoChartData=[];
function topItensDoMotivoQuantidade(rows,motivo,limit=8){
 const grouped={};
 rows.forEach(r=>{
   if(motivoDescricao(r)!==motivo)return;
   const codigo=String(val(r,'codigo')??'').trim();
   const desc=String(val(r,'produto')??'').trim();
   const item=desc||codigo||'Item não informado';
   const key=(codigo+'|'+item).toUpperCase();
   if(!grouped[key]) grouped[key]={item,codigo,total:0};
   grouped[key].total+=qty(r);
 });
 return Object.values(grouped).sort((a,b)=>b.total-a.total).slice(0,limit);
}
function positionQMotivoPopover(x,y){
 const pop=document.getElementById('qMotivoPopover'); if(!pop)return;
 pop.style.left='0px';pop.style.top='0px';
 const rectW=pop.offsetWidth||390,rectH=pop.offsetHeight||300,pad=10;
 let left=x+14,top=y+14;
 if(left+rectW>window.innerWidth-pad)left=x-rectW-14;
 if(left<pad)left=pad;
 if(top+rectH>window.innerHeight-pad)top=y-rectH-14;
 if(top<pad)top=pad;
 pop.style.left=Math.round(left)+'px';pop.style.top=Math.round(top)+'px';
}
function showQMotivoPopover(index,x,y){
 const pop=document.getElementById('qMotivoPopover'),title=document.getElementById('qMotivoPopoverTitle'),sub=document.getElementById('qMotivoPopoverSub'),total=document.getElementById('qMotivoPopoverTotal'),list=document.getElementById('qMotivoPopoverList');
 const entry=qMotivoChartData?.[index]; if(!pop||!entry)return;
 const [motivo,valor]=entry;
 const items=topItensDoMotivoQuantidade(qMotivoChartRows,motivo,8);
 title.textContent=motivo;
 sub.textContent='Principais itens refugados por este motivo, conforme os filtros atuais.';
 total.textContent=fmt(valor)+' un.';
 list.innerHTML=items.length?items.map(x=>`<li><span class="q-motivo-qty">${fmt(x.total)} un.</span><span class="q-motivo-item">${esc(x.item)}</span>${x.codigo?`<span class="q-motivo-code">Código ${esc(x.codigo)}</span>`:''}</li>`).join(''):'<li>Nenhum item encontrado para este motivo.</li>';
 closeChartDetailPopover();pop.classList.add('open');pop.setAttribute('aria-hidden','false');setChartPopoverBackdrop(true);
 positionQMotivoPopover(x,y);
}
function closeQMotivoPopover(){const pop=document.getElementById('qMotivoPopover');if(pop){pop.classList.remove('open');pop.setAttribute('aria-hidden','true');}setChartPopoverBackdrop(false);} window.closeQMotivoPopover=closeQMotivoPopover
function bindQMotivoPopoverGlobal(){
 const closeBtn=document.getElementById('qMotivoPopoverClose');
 closeBtn?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeQMotivoPopover();});
 document.addEventListener('click',e=>{
   const pop=document.getElementById('qMotivoPopover'), chart=document.getElementById('qChartMotivo');
   if(!pop || !pop.classList.contains('open')) return;
   if(e.target!==pop && !pop.contains(e.target) && e.target!==chart) closeQMotivoPopover();
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeQMotivoPopover();});
}
function bindQMotivoPopover(){
 const c=document.getElementById('qChartMotivo'); if(!c || c.dataset.qMotivoBound==='1')return;
 c.dataset.qMotivoBound='1';
 const getHit=(e)=>{
   const rect=c.getBoundingClientRect();
   const x=e.clientX-rect.left, y=e.clientY-rect.top;
   return (c._motivoHits||[]).find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);
 };
 c.addEventListener('click',e=>{
   const hit=getHit(e);
   if(hit && qMotivoChartData?.[hit.index]) showQMotivoPopover(hit.index,e.clientX,e.clientY);
   else closeQMotivoPopover();
 });
 c.addEventListener('mousemove',e=>{ c.style.cursor=getHit(e)?'pointer':'default'; });
}
function qtyFiltered(){
  const y=String(document.getElementById('qFilterYear')?.value||''),PL=plSel('qFilterPlant'),m=String(document.getElementById('qFilterMonth')?.value||'');
  return data.filter(r=>{const ry=recordYear(r),rp=recordPlant(r),rm=recordMonth(r);return (!y||String(ry)===y)&&plHas(PL,rp)&&(!m||String(rm)===m)});
}
function populateQtyFilters(){
  const years=[...new Set(data.map(recordYear).filter(y=>y!==null))].sort((a,b)=>a-b),plants=[...new Set(data.map(recordPlant).filter(x=>x&&x!=='NAO INFORMADO'))].sort((a,b)=>a.localeCompare(b,'pt-BR')),y=document.getElementById('qFilterYear'),p=document.getElementById('qFilterPlant');
  const oldY=String(y?.value||''),oldPRaw=String(p?.value||'').trim(),oldP=oldPRaw?plantNormName(oldPRaw):'';
  if(y){y.innerHTML='<option value="">Todos os anos</option>'+years.map(x=>`<option value="${x}">${x}</option>`).join('');y.value=years.some(x=>String(x)===oldY)?oldY:''}
  if(p){p.innerHTML='<option value="">Todas as plantas</option>'+plants.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');p.value=plants.includes(oldP)?oldP:''}
}
function dashboardQtd(){
 let rows=qtyFiltered(); dashboardQtyChartRows=rows;
 try{anaRenderResumo('q');anaRenderCusto(rows,'q')}catch(e){console.error('analises',e)}
 let total=rows.reduce((a,r)=>a+qty(r),0),byPlant={};
 rows.forEach(r=>{let k=String(val(r,'planta')||'Não informado').trim()||'Não informado';byPlant[k]=(byPlant[k]||0)+qty(r)});
 const normPlant=k=>{let s=String(k??'').trim().toUpperCase();if(s.includes('FUNDICAO NA USINAGEM'))return 'FUNDICAO NA USINAGEM';if(s==='USINAGEM')return 'USINAGEM';if(s==='FUNDICAO')return 'FUNDICAO';return k};
 let plantNorm={};Object.entries(byPlant).forEach(([k,v])=>{let n=normPlant(k);plantNorm[n]=(plantNorm[n]||0)+v});
 document.getElementById('qKpiTotal').textContent=fmt(total);[['FUNDICAO','qKpiFundicao','qPctFundicao'],['FUNDICAO NA USINAGEM','qKpiFU','qPctFU'],['USINAGEM','qKpiUsinagem','qPctUsinagem']].forEach(([k,id,pid])=>{let v=plantNorm[k]||0;document.getElementById(id).textContent=fmt(v);document.getElementById(pid).textContent=(total?fmt(v/total*100):'0')+'% do total'});
 let pf=Array(12).fill(0),pfu=Array(12).fill(0),pu=Array(12).fill(0);rows.forEach(r=>{let m=recordMonth(r);if(!m)return;let i=m-1,q=qty(r),pl=normPlant(val(r,'planta'));if(pl==='FUNDICAO')pf[i]+=q;else if(pl==='FUNDICAO NA USINAGEM')pfu[i]+=q;else if(pl==='USINAGEM')pu[i]+=q});
 const qMonthSeries=[{name:'Fundição',values:pf},{name:'Fundição na Usinagem',values:pfu},{name:'Usinagem',values:pu}]; drawStackedQty('qChartMonthPlant',months,qMonthSeries); setChartDetailConfig('qChartMonthPlant',{labels:months,rows,series:qMonthSeries,kind:'monthPlantQty',unit:'un.',labelPrefix:'Mês'});
 preencherMotivosPlantas(rows,r=>qty(r),'q');
 qMotivoChartRows=rows;
 let motivos=qtyGroup(rows,r=>motivoDescricao(r),10);qMotivoChartData=motivos;window.qMotivoChartData=qMotivoChartData;draw('qChartMotivo',motivos.map(x=>x[0]),motivos.map(x=>x[1]),true,'un.');bindQMotivoPopover();
 let clientes=qtyGroup(rows,r=>val(r,'cliente'),10);draw('qChartClient',clientes.map(x=>x[0]),clientes.map(x=>x[1]),true,'un.'); setChartDetailConfig('qChartClient',{labels:clientes.map(x=>x[0]),rows,kind:'clientQty',unit:'un.',labelPrefix:'Cliente'});
 let itens=qtyGroup(rows,r=>val(r,'produto')||val(r,'codigo'),10);draw('qChartItem',itens.map(x=>x[0]),itens.map(x=>x[1]),true,'un.'); setChartDetailConfig('qChartItem',{labels:itens.map(x=>x[0]),rows,kind:'itemQty',unit:'un.',labelPrefix:'Item'});
 let plants=Object.entries(plantNorm).sort((a,b)=>b[1]-a[1]);drawDonutQty('qChartPlant',plants.map(x=>x[0]),plants.map(x=>x[1])); setChartDetailConfig('qChartPlant',{labels:plants.map(x=>x[0]),rows,kind:'plantQty',unit:'un.',labelPrefix:'Planta'});
 const tbody=document.getElementById('qPlantTable');if(tbody)tbody.innerHTML=plants.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${fmt(v)}</td><td>${total?fmt(v/total*100):'0'}%</td></tr>`).join('')||'<tr><td colspan="3">Sem dados para o período.</td></tr>';
}

let dashboardDirty=true, dashboardQtdDirty=true;
function plantNormName(v){let s=normalizeText(v);if(s.includes('FUNDICAO NA USINAGEM'))return 'FUNDICAO NA USINAGEM';if(s==='USINAGEM')return 'USINAGEM';if(s==='FUNDICAO')return 'FUNDICAO';return s||'NAO INFORMADO';}
function motivoDescricao(r){
 let d=String(val(r,'descricaoMotivo')??'').trim();
 let c=String(val(r,'motivo')??'').trim();
 return d||c||'Não informado';
}
function principalMotivoPorPlanta(rows,plant,measureFn){
 let grouped={};
 rows.forEach(r=>{if(plantNormName(val(r,'planta'))!==plant)return;let m=motivoDescricao(r);grouped[m]=(grouped[m]||0)+measureFn(r)});
 let arr=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
 return arr[0]||['—',0];
}
function topItensDoMotivo(rows,plant,motivo,measureFn){
 const grouped={};
 rows.forEach(r=>{
   if(plantNormName(val(r,'planta'))!==plant)return;
   if(motivoDescricao(r)!==motivo)return;
   const codigo=String(val(r,'codigo')??'').trim();
   const desc=String(val(r,'produto')??'').trim();
   const item=desc||codigo||'Item não informado';
   const key=(codigo+'|'+item).toUpperCase();
   if(!grouped[key]) grouped[key]={item,codigo,total:0};
   grouped[key].total+=measureFn(r);
 });
 return Object.values(grouped).sort((a,b)=>b.total-a.total).slice(0,3);
}
function preencherItensMotivo(id,items,measureFn,prefix){
 const el=document.getElementById(id); if(!el)return;
 el.innerHTML=items.length?items.map(x=>`<li>${esc(x.item)}${x.codigo?` <span style="opacity:.65">(${esc(x.codigo)})</span>`:''} <b>— ${fmt(x.total)}${prefix?' un.':' kg'}</b></li>`).join(''):'<li>Sem registros</li>';
}
function preencherMotivosPlantas(rows,measureFn,prefix){
 const total=rows.reduce((a,r)=>a+measureFn(r),0);
 const geral=Object.entries(rows.reduce((o,r)=>{let m=motivoDescricao(r);o[m]=(o[m]||0)+measureFn(r);return o},{})).sort((a,b)=>b[1]-a[1])[0];
 const map=[['FUNDICAO','Fundicao'],['FUNDICAO NA USINAGEM','FU'],['USINAGEM','Usinagem']];
 if(prefix==='') document.getElementById('kpiMotivo').textContent=geral?.[0]||'—';
 else {document.getElementById('qKpiMotivo').textContent=geral?.[0]||'—';document.getElementById('qKpiReg').textContent=rows.length;document.getElementById('qKpiQtdTop').textContent=fmt(total)}
 map.forEach(([plant,suf])=>{
   let [mot,v]=principalMotivoPorPlanta(rows,plant,measureFn);
   let id=prefix?`qKpiMotivo${suf}`:`kpiMotivo${suf}`;
   let sid=prefix?`qKpiMotivo${suf}Sub`:`kpiMotivo${suf}Sub`;
   let iid=prefix?`qKpiMotivo${suf}Items`:`kpiMotivo${suf}Items`;
   let el=document.getElementById(id),sub=document.getElementById(sid);
   if(el)el.textContent=mot||'—';
   if(sub)sub.textContent=(v?fmt(v)+(prefix?' un.':' kg')+' no período':'Sem registros no período');
   preencherItensMotivo(iid,mot&&mot!=='—'?topItensDoMotivo(rows,plant,mot,measureFn):[],measureFn,prefix);
 });
}

function dashboard(){
 let rows=filtered(); dashboardChartRows=rows;
 let totalKg=rows.reduce((a,r)=>a+kg(r),0),totalQ=rows.reduce((a,r)=>a+qty(r),0),totalProd=productionTotalForFilters(),totalCost=rows.reduce((a,r)=>a+cost(r),0),perc=totalProd?totalKg/totalProd*100:0;
 kpiKg.textContent=fmt(totalKg)+' kg';kpiQtd.textContent=fmt(totalQ);kpiReg.textContent=rows.length;
 let reasons=group(rows,r=>motivoDescricao(r)), clients=group(rows,r=>String(val(r,'cliente')).trim());
 preencherMotivosPlantas(rows,r=>kg(r),'');
try{anaRenderResumo();anaRenderCusto(rows)}catch(e){console.error('analises',e)}
kpiPerc.textContent=fmt(perc)+'%';if(kpiCusto){kpiCusto.dataset.costValue='R$ '+fmt(totalCost);kpiCusto.textContent=costAccessAllowed()?'R$ '+fmt(totalCost):'🔒 Restrito';}if(document.getElementById('kpiCustoSub'))document.getElementById('kpiCustoSub').textContent=costAccessAllowed()?'valor financeiro da perda':'valores protegidos — acesso restrito';
kpiMeta.innerHTML=meta.perc?((perc<=meta.perc)?'<span class="meta-pill ok">✔ Dentro</span>':'<span class="meta-pill bad">▲ Acima</span>'):'<span class="meta-pill none">Sem meta</span>';
(function(){var s=document.getElementById('kpiMetaSub'),b=document.getElementById('kpiMetaBar'),c=document.getElementById('kpiMeta').closest('.card');if(!s)return;
if(!meta.perc){s.textContent='defina a meta em Cadastro > Metas';if(b)b.style.width='0%';c.dataset.st='none';return}
var r=perc/meta.perc*100,msg=r<=90?'🎉 Ótimo! '+fmt(100-r)+'% de folga até o limite':r<=100?'🔔 Quase no limite — só '+fmt(100-r)+'% de folga':'⚠ '+fmt(perc-meta.perc)+' p.p. acima da meta — hora de agir';
s.innerHTML='<b>'+fmt(perc)+'%</b> de <b>'+fmt(meta.perc)+'%</b>'+(meta.kg?' • '+fmt(meta.kg)+' kg/mês':'')+'<br>'+msg;if(b)b.style.width=Math.min(100,r)+'%';c.dataset.st=r<=100?'ok':'bad'})();
metaPerc.value=meta.perc;metaKg.value=meta.kg;
 let mo=Array(12).fill(0);rows.forEach(r=>{let m=recordMonth(r);if(m)mo[m-1]+=kg(r)});
 const monthSeries=[{values:mo,unit:'kg'},{values:months.map(()=>meta.kg||0),unit:'kg'}]; drawLine('chartMonth',months,monthSeries); setChartDetailConfig('chartMonth',{labels:months,rows,kind:'monthKg',unit:'kg',labelPrefix:'Mês'});
let prodMo=productionMonthsForDashboard();
const rateSeries=[{values:prodMo.map((v,i)=>v?mo[i]/v*100:0),unit:'%'}]; drawLine('chartRate',months,rateSeries); setChartDetailConfig('chartRate',{labels:months,rows,prod:prodMo,kind:'rate',unit:'',labelPrefix:'Mês'});

 let plantMap={};rows.forEach(r=>{let raw=String(val(r,'planta')||'Não informado').trim()||'Não informado';let s=raw.toUpperCase();let k=s.includes('FUNDICAO NA USINAGEM')?'FUNDICAO NA USINAGEM':(s==='USINAGEM'?'USINAGEM':(s==='FUNDICAO'?'FUNDICAO':raw));plantMap[k]=(plantMap[k]||0)+kg(r)});
 let plants=Object.entries(plantMap).sort((a,b)=>b[1]-a[1]);draw('chartPlant',plants.map(x=>x[0]),plants.map(x=>x[1]),true,'kg'); setChartDetailConfig('chartPlant',{labels:plants.map(x=>x[0]),rows,kind:'plantKg',unit:'kg',labelPrefix:'Planta'}); drawDonutQty('chartPlantPie',plants.map(x=>x[0]),plants.map(x=>x[1]),'kg'); setChartDetailConfig('chartPlantPie',{labels:plants.map(x=>x[0]),rows,kind:'plantKg',unit:'kg',labelPrefix:'Planta'});
 let kgTotal=plants.reduce((a,x)=>a+x[1],0);let kgTable=document.getElementById('kgPlantTable');if(kgTable){kgTable.innerHTML=plants.map(x=>`<tr><td>${esc(x[0])}</td><td>${fmt(x[1])} kg</td><td>${kgTotal?fmt(x[1]/kgTotal*100):'0'}%</td></tr>`).join('');}
let pareto=reasons.slice(0,10);draw('chartPareto',pareto.map(x=>x[0]),pareto.map(x=>x[1]),true,'kg'); setChartDetailConfig('chartPareto',{labels:pareto.map(x=>x[0]),rows,kind:'reasonKg',unit:'kg',labelPrefix:'Motivo'});
 clients=clients.slice(0,8);draw('chartClient',clients.map(x=>x[0]),clients.map(x=>x[1]),true,'kg'); setChartDetailConfig('chartClient',{labels:clients.map(x=>x[0]),rows,kind:'clientKg',unit:'kg',labelPrefix:'Cliente'});
 summary.innerHTML=`<div class="kpis"><span class="pill">Kg: ${fmt(totalKg)}</span><span class="pill">Quantidade: ${fmt(totalQ)}</span><span class="pill">Registros: ${rows.length}</span></div><p class="small">Os gráficos são recalculados automaticamente conforme os lançamentos e filtros.</p>`;
 dashboardDirty=false;
}
function motivoCompleto(r){
 let codigo=String(val(r,'motivo')??'').trim();
 let descricao=String(val(r,'descricaoMotivo')??'').trim();
 if(codigo && descricao) return `${codigo} - ${descricao}`;
 return codigo || descricao || 'Não informado';
}
const historySelected = new Set();
function historyDateMs(r){
  const d=date(r);
  return d ? d.getTime() : 0;
}
function updateHistorySelectionUI(visibleIndices=[]){
  const selectedCount=historySelected.size;
  const del=document.getElementById('deleteSelectedBtn');
  const clear=document.getElementById('clearSelectedBtn');
  const select=document.getElementById('selectVisibleBtn');
  if(del){del.disabled=selectedCount===0;del.textContent=`🗑 Excluir selecionados (${selectedCount})`}
  if(clear){clear.disabled=selectedCount===0}
  const visible=visibleIndices.filter(i=>Number.isInteger(i));
  const allVisible=visible.length>0 && visible.every(i=>historySelected.has(i));
  if(select)select.textContent=allVisible?'☐ Desmarcar todos':'☑ Selecionar todos';
}
function toggleHistorySelection(index,checked){
  const i=Number(index);
  if(!Number.isInteger(i)||!data[i])return;
  if(checked)historySelected.add(i);else historySelected.delete(i);
  renderTable();
}
function toggleSelectAllVisible(){
  const q=String(document.getElementById('search')?.value||'').toLowerCase();
  const visible=data.map((r,i)=>({r,i})).filter(x=>JSON.stringify(x.r).toLowerCase().includes(q));
  const indices=visible.map(x=>x.i);
  if(!indices.length)return;
  const all=indices.every(i=>historySelected.has(i));
  indices.forEach(i=>all?historySelected.delete(i):historySelected.add(i));
  renderTable();
}
function clearHistorySelection(){historySelected.clear();renderTable();}
function removeSelectedRows(){
  const indices=[...historySelected].filter(i=>Number.isInteger(i)&&data[i]).sort((a,b)=>b-a);
  if(!indices.length)return;
  const plural=indices.length===1?'lançamento selecionado':'lançamentos selecionados';
  if(!confirm(`Excluir ${indices.length} ${plural}?\n\nEssa ação não poderá ser desfeita.`))return;
  indices.forEach(i=>data.splice(i,1));
  historySelected.clear();
  save();
  refresh();
}
/* Histórico leve: mostra os registros em blocos (não monta milhares de linhas de uma vez) */
const HISTORY_PAGE=150;
let historyLimit=HISTORY_PAGE;
let __historySearchCache=new WeakMap();
function __historySearchText(r){let t=__historySearchCache.get(r);if(t===undefined){t=JSON.stringify(r).toLowerCase();__historySearchCache.set(r,t)}return t}
function historyShowMore(){historyLimit+=HISTORY_PAGE;renderTable()}
function renderTable(){
 limparRegistrosZeradosHistorico();
 const searchEl=document.getElementById('search');
 let q=String(searchEl?.value||'').toLowerCase();
 let rows=[];
 for(let i=0;i<data.length;i++){const r=data[i];if(!q||__historySearchText(r).includes(q))rows.push({r,i})}
 // Mais recente primeiro. Em empate, o registro lançado por último fica acima.
 rows.forEach(x=>{x.t=historyDateMs(x.r)});
 rows.sort((a,b)=>b.t-a.t||b.i-a.i);
 // Descarta da seleção índices que já não existem após exclusões/limpezas.
 [...historySelected].forEach(i=>{if(!data[i])historySelected.delete(i)});
 const hc=document.getElementById('historyCount');
 const shown=rows.slice(0,historyLimit);
 if(hc) hc.textContent=`${rows.length.toLocaleString('pt-BR')} de ${data.length.toLocaleString('pt-BR')} lançamentos`+(rows.length>shown.length?` • exibindo ${shown.length.toLocaleString('pt-BR')}`:'');
 const body=document.getElementById('tbody');
 if(body){
  const html=shown.map(({r,i})=>`<tr>
   <td class="history-select-cell"><input class="history-select-check" type="checkbox" aria-label="Selecionar lançamento" ${historySelected.has(i)?'checked':''} onchange="toggleHistorySelection(${i}, this.checked)"></td>
   <td>${esc(val(r,'data'))}</td>
   <td>${esc(val(r,'dataLancamento'))}</td>
   <td>${esc(val(r,'cliente'))}</td>
   <td>${esc(val(r,'codigo'))}</td>
   <td>${esc(val(r,'produto'))}</td>
   <td>${esc(val(r,'of'))}</td>
   <td>${fmt(qty(r))}</td>
   <td>${fmt(kg(r))}</td>
   <td><strong>${esc(motivoCompleto(r))}</strong></td>
   <td>${esc(val(r,'planta'))}</td>
   <td>${esc(val(r,'responsavel'))}</td>
   <td>${Array.isArray(r.FOTOS)&&r.FOTOS.length?`<button class="btn secondary" title="Ver fotos e observação" onclick="verFotos(${i})">📷 ${r.FOTOS.length}</button> `:''}<button class="btn secondary" onclick="edit(${i})">Editar</button> <button class="btn danger" onclick="removeRow(${i})">Excluir</button></td>
 </tr>`).join('');
  const more=rows.length>shown.length?`<tr><td colspan="13" style="text-align:center;padding:14px"><button class="btn secondary" onclick="historyShowMore()">Mostrar mais ${HISTORY_PAGE} (exibindo ${shown.length.toLocaleString('pt-BR')} de ${rows.length.toLocaleString('pt-BR')})</button></td></tr>`:'';
  body.innerHTML=(html+more)||'<tr><td colspan="13" style="text-align:center" class="small">Nenhum lançamento encontrado.</td></tr>';
 }
 updateHistorySelectionUI(rows.map(x=>x.i));
}
function codigoKey(v){
  const t=String(v??'').trim().toUpperCase();
  if(!t) return '';
  // Normaliza códigos numéricos e alfanuméricos para evitar falhas por espaços,
  // formatação de planilha ou zeros à esquerda.
  if(/^\d+$/.test(t)) return String(Number(t));
  return t.replace(/\s+/g,'');
}

function pecasPorCodigo(codigo){
  normalizeCad();
  const cod=String(codigo??'').trim();
  const key=codigoKey(cod);
  if(!key) return [];
  const out=[];
  const seen=new Set();
  const add=(item)=>{
    if(!item) return;
    const itemKey=codigoKey(item.codigo);
    if(itemKey!==key) return;
    const cliente=canonicalClientName(item.cliente||'');
    const descricao=String(item.descricao||'').trim();
    const chave=[itemKey,cliente.toUpperCase(),descricao.toUpperCase()].join('|');
    if(seen.has(chave)) return;
    seen.add(chave);
    out.push({...item,codigo:cod,cliente,descricao});
  };

  // Fonte oficial: cadastro de produtos salvo e a base CADASTRO embutida no sistema.
  cadastros.pecas.filter(x=>codigoKey(x.codigo)===key).forEach(add);
  CADASTRO_EXCEL_SEED.filter(x=>codigoKey(x.codigo)===key).forEach(add);

  // Se houver clientes adicionais registrados em lançamentos históricos para o mesmo código,
  // adiciona esses clientes sem substituir descrição/planta/pesos do cadastro oficial.
  const oficiais=out.slice();
  const base=oficiais.find(x=>x.descricao||x.planta||x.pesoPrincipal!==''||x.pesoArvore!=='') || oficiais[0] || {};
  data.filter(r=>codigoKey(val(r,'codigo'))===key).forEach(r=>{
    const cliente=canonicalClientName(val(r,'cliente')||'');
    if(!cliente) return;
    add({
      ...base,
      cliente,
      codigo:cod,
      descricao:String(base.descricao||val(r,'produto')||'').trim(),
      planta:String(base.planta||val(r,'planta')||'').trim(),
      pesoPrincipal:base.pesoPrincipal??'',
      pesoArvore:base.pesoArvore??'',
      pesoFundUsin:base.pesoFundUsin??'',
      pesoUsinado:base.pesoUsinado??''
    });
  });
  return out;
}

function findPeca(cliente,codigo){
  const cod=String(codigo||'').trim();
  const cli=canonicalClientName(cliente||'').trim().toUpperCase();
  const matches=pecasPorCodigo(cod);
  if(!matches.length) return null;

  // Quando o usuário já selecionou um cliente, prioriza exatamente esse cliente.
  if(cli){
    const exact=matches.find(x=>canonicalClientName(x.cliente||'').trim().toUpperCase()===cli);
    if(exact) return exact;
  }

  // O cadastro oficial da aba CADASTRO é a referência principal para descrição,
  // planta e pesos. Mesmo que existam vários clientes no histórico para o mesmo
  // código, a peça deve ser preenchida imediatamente e o cliente pode ser escolhido.
  const oficial=matches.find(x=>x._origemExcel===true);
  if(oficial) return oficial;

  // Fallback: produto sem cliente no cadastro ou um único registro conhecido.
  if(matches.length===1) return matches[0];
  return matches.find(x=>String(x.descricao||'').trim()) || matches[0] || null;
}

function numericCadastroWeight(v){
  const t=String(v??'').trim().replace(',','.');
  if(!t) return null;
  const n=Number(t);
  return Number.isFinite(n)&&n>=0?n:null;
}

function setFieldValue(id,v){const el=document.getElementById(id);if(el)el.value=v==null?'':v}

function updateClientOptionsForCode(codigo, selected=''){
  const select=document.getElementById('cliente');
  if(!select) return [];
  normalizeCad();
  const matches=pecasPorCodigo(codigo);
  const clients=normalizeClientList(matches.map(x=>x.cliente).filter(Boolean));
  const current=canonicalClientName(selected||select.value||'').trim();

  if(!String(codigo||'').trim()){
    select.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
    return [];
  }

  if(clients.length){
    select.innerHTML=clienteOptionsHtml(clients,'Selecione o cliente');
    const exact=clients.find(x=>canonicalClientName(x).toUpperCase()===current.toUpperCase());
    if(exact) select.value=exact;
    else if(current.toUpperCase()===SEM_CLIENTE) select.value=SEM_CLIENTE;
    else if(clients.length===1) select.value=clients[0];
  }else if(matches.length){
    // Produto sem cliente cadastrado: lança como "Sem cliente cadastro".
    select.innerHTML=clienteOptionsHtml([],'Selecione o cliente');
    select.value=SEM_CLIENTE;
  }else{
    select.innerHTML='<option value="">Código não encontrado</option>';
  }

  const info=document.getElementById('pecaAutoInfo');
  if(info){
    if(clients.length>1) info.textContent=`Código ${String(codigo).trim()} encontrado para ${clients.length} clientes. Selecione o cliente para preencher os dados.`;
    else if(clients.length===1) info.textContent=`Cadastro localizado para ${clients[0]}. Dados da peça serão preenchidos automaticamente.`;
    else if(matches.length) info.textContent=`Código ${String(codigo).trim()} localizado no cadastro de produtos. Cliente não informado no cadastro.`;
    else info.textContent='Código não localizado no cadastro de produtos.';
  }
  return clients;
}

function preencherCamposProdutoDireto(produto){
  if(!produto) return false;
  setFieldValue('produto',produto.descricao||'');
  setFieldValue('planta',produto.planta||'');
  setFieldValue('pesoPrincipal',numericCadastroWeight(produto.pesoPrincipal));
  setFieldValue('pesoArvore',numericCadastroWeight(produto.pesoArvore));
  setFieldValue('pesoCanal',numericCadastroWeight(produto.pesoFundUsin));
  setFieldValue('pesoUsinado',numericCadastroWeight(produto.pesoUsinado));
  calcularPesosLancamento();
  return true;
}

function aplicarCadastroPeca(){
  const cod=document.getElementById('codigo')?.value||'';
  const cli=canonicalClientName(document.getElementById('cliente')?.value||'').trim().toUpperCase();
  const oficial=window.__BUSCAR_PRODUTO_OFICIAL__?.(cod);
  if(oficial){
    preencherCamposProdutoDireto(oficial);
    // Recupera os clientes históricos associados a este código sem substituir os dados oficiais da peça.
    const histClients=normalizeClientList((Array.isArray(data)?data:[])
      .filter(r=>codigoKey(val(r,'codigo'))===codigoKey(cod))
      .map(r=>canonicalClientName(val(r,'cliente')))
      .filter(Boolean));
    const select=document.getElementById('cliente');
    if(select){
      const atual=cli;
      if(histClients.length){
        select.innerHTML=clienteOptionsHtml(histClients,'Selecione o cliente');
        const exact=histClients.find(x=>canonicalClientName(x).toUpperCase()===atual);
        if(exact) select.value=exact;
        else if(atual===SEM_CLIENTE) select.value=SEM_CLIENTE;
        else if(histClients.length===1) select.value=histClients[0];
      }else{
        select.innerHTML=clienteOptionsHtml([],'Selecione o cliente');
        select.value=SEM_CLIENTE;
      }
    }
    return true;
  }
  // Fallback: cadastro manual/localStorage.
  const p=findPeca(cli,cod);
  if(!p) return false;
  preencherCamposProdutoDireto(p);
  return true;
}

window.autoPreencherClientePorCodigo=autoPreencherClientePorCodigo;
function autoPreencherClientePorCodigo(){
  const cod=document.getElementById('codigo')?.value||'';
  if(!String(cod).trim()){
    const select=document.getElementById('cliente');
    if(select) select.innerHTML=clienteOptionsHtml(cadastros.clientes,'Selecione o cliente');
    ['produto','planta','pesoPrincipal','pesoArvore','pesoCanal','pesoUsinado','kgFundUsin','kgRefugo'].forEach(id=>setFieldValue(id,''));
    return;
  }
  const oficial=window.__BUSCAR_PRODUTO_OFICIAL__?.(cod);
  if(oficial){
    preencherCamposProdutoDireto(oficial);
    // Clientes conhecidos para o código vêm do histórico, mantendo a peça do cadastro oficial.
    const clients=normalizeClientList((Array.isArray(data)?data:[])
      .filter(r=>codigoKey(val(r,'codigo'))===codigoKey(cod))
      .map(r=>canonicalClientName(val(r,'cliente')))
      .filter(Boolean));
    const select=document.getElementById('cliente');
    if(select){
      const current=canonicalClientName(select.value||'').trim();
      if(clients.length){
        select.innerHTML=clienteOptionsHtml(clients,'Selecione o cliente');
        const exact=clients.find(x=>canonicalClientName(x).toUpperCase()===current.toUpperCase());
        if(exact) select.value=exact;
        else if(current.toUpperCase()===SEM_CLIENTE) select.value=SEM_CLIENTE;
        else if(clients.length===1) select.value=clients[0];
      }else{
        select.innerHTML=clienteOptionsHtml([],'Selecione o cliente');
        select.value=SEM_CLIENTE;
      }
    }
    const info=document.getElementById('pecaAutoInfo');
    if(info) info.textContent=clients.length>1
      ? `Código ${String(cod).trim()} localizado. Selecione o cliente; descrição e pesos já foram preenchidos.`
      : `Código ${String(cod).trim()} localizado no Cadastro de Produtos.`;
    return true;
  }
  const clients=updateClientOptionsForCode(cod,'');
  const ok=aplicarCadastroPeca();
  if(!ok){
    ['produto','planta','pesoPrincipal','pesoArvore','pesoCanal','pesoUsinado','kgFundUsin','kgRefugo'].forEach(id=>setFieldValue(id,''));
    const info=document.getElementById('pecaAutoInfo');
    if(info) info.textContent='Código não localizado no cadastro de produtos.';
  }
  return ok;
}

function calcularPesosLancamento(){
  const q=n(document.getElementById('quantidade')?.value);
  const pf=n(document.getElementById('pesoCanal')?.value);
  const pp=n(document.getElementById('pesoPrincipal')?.value);

  // Peso da árvore: permanece apenas como o peso unitário cadastrado.
  // Não é multiplicado pela quantidade.

  // Peso líquido da Fundição / Peso bruto da Usinagem: quantidade × peso cadastrado.
  if(Number.isFinite(q)&&q>0&&Number.isFinite(pf)&&pf>=0) setFieldValue('kgFundUsin',q*pf);
  else setFieldValue('kgFundUsin','');

  // Peso bruto fracionado / refugo: quantidade × Peso Principal.
  if(Number.isFinite(q)&&q>0&&Number.isFinite(pp)&&pp>=0) setFieldValue('kgRefugo',(q*pp).toFixed(3));
  else setFieldValue('kgRefugo','');
}

function formatDataCurtaBR(iso){
  if(!iso)return '';
  const parts=String(iso).split('-');
  if(parts.length!==3)return '';
  return `${parts[2]}/${parts[1]}/${String(parts[0]).slice(-2)}`;
}
function atualizarDataDisplay(){
  const dateEl=document.getElementById('data');
  const displayEl=document.getElementById('dataDisplay');
  if(displayEl)displayEl.value=formatDataCurtaBR(dateEl?.value||'');
}
function abrirSeletorData(){
  const dateEl=document.getElementById('data');
  if(!dateEl)return;
  try{
    dateEl.focus();
    if(typeof dateEl.showPicker==='function') dateEl.showPicker();
  }catch{}
}

function clearForm(){try{ltMatSet("")}catch(e){}
  const form=document.getElementById('refugoForm');
  form?.reset();
  setFieldValue('editIndex','');
  setFieldValue('formTitle','Novo lançamento');
  const title=document.getElementById('formTitle');if(title)title.textContent='Novo lançamento';
  const dateEl=document.getElementById('data');
  const now=new Date();
  const iso=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  if(dateEl)dateEl.value=iso;
  setFieldValue('dataLancamento',iso);
  formFotos=[];fotosRemovidas=[];renderFormFotos();
  atualizarDataDisplay();
  updateClientOptionsForCode('', '');
  ['produto','planta','pesoPrincipal','pesoArvore','pesoCanal','pesoUsinado','kgFundUsin','kgRefugo'].forEach(id=>setFieldValue(id,''));
  const info=document.getElementById('pecaAutoInfo');
  if(info) info.textContent='Digite o código interno para localizar descrição, cliente e pesos.';
  switchLaunchTab('refugo');
}

function edit(i){
  historySelected.clear();
  const r=data[i];
  if(!r)return;
  clearForm();
  ['cliente','codigo','produto','of','quantidade','pesoArvore','pesoCanal','kgFundUsin','kgRefugo','motivo','descricaoMotivo','planta','material','responsavel','observacao','data','dataLancamento'].forEach(k=>{
    const el=document.getElementById(k);if(el)el.value=val(r,k);
  });
  atualizarDataDisplay();
  ltMatSet(val(r,"material"));loadFormFotos(r.FOTOS);
  setFieldValue('editIndex',i);
  const title=document.getElementById('formTitle');if(title)title.textContent='Editar lançamento';
  updateClientOptionsForCode(val(r,'codigo'),val(r,'cliente')||SEM_CLIENTE);
  aplicarCadastroPeca();
  // Preserva os pesos já registrados no lançamento apenas para os campos históricos do próprio registro.
  setFieldValue('kgFundUsin',val(r,'kgFundUsin'));
  {const _kg=Number(String(val(r,'kgRefugo')??'').replace(',','.'));setFieldValue('kgRefugo',Number.isFinite(_kg)?_kg.toFixed(3):val(r,'kgRefugo'));}
  navigate('lancamentos');
  switchLaunchTab('refugo');
}

function removeRow(i){if(confirm('Excluir este lançamento?')){historySelected.delete(Number(i));{const fs=data[i]&&data[i].FOTOS;if(Array.isArray(fs))fs.forEach(id=>{fotoApagarRemoto(id)})}data.splice(i,1);historySelected.clear();save();refresh();}}

/* ===== Fotos anexadas ao lançamento =====
   - Reduzidas no aparelho (máx. 1000 px, JPEG) para não pesar
   - Guardadas no IndexedDB do navegador (fora do localStorage) e, com o Firebase conectado, também no Firestore (coleção "fotos")
   - O lançamento guarda apenas os IDs em r.FOTOS */
(function(){
  const st=document.createElement('style');
  st.textContent='.fotos-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.foto-prev{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.foto-prev .fp{position:relative;width:96px;height:96px;border-radius:10px;overflow:hidden;border:1px solid #c8d2e0;background:#eef2f7}.foto-prev .fp img{width:100%;height:100%;object-fit:cover;cursor:zoom-in}.foto-prev .fp button{position:absolute;top:3px;right:3px;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;font-weight:900;cursor:pointer;line-height:1}#fotoModal{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:99998;display:none;align-items:center;justify-content:center;padding:18px}#fotoModal.show{display:flex}#fotoModal .fm{background:var(--card,#fff);color:var(--text,#17212b);border-radius:14px;max-width:960px;width:100%;max-height:92vh;overflow:auto;padding:18px}#fotoModal .fm h3{margin:0 0 6px}#fotoModal .fm-obs{white-space:pre-wrap;margin:8px 0 14px;font-size:14px}#fotoModal .fm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}#fotoModal .fm-grid img{width:100%;border-radius:10px;border:1px solid #c8d2e0;cursor:zoom-in}.reu-lbl{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700}';
  document.head.appendChild(st);
})();
const FOTO_MAX=4;
let formFotos=[];        // [{id,url,novo}]
let fotosRemovidas=[];   // ids removidos no formulário (apagados ao salvar)
function fotoDB(){return new Promise((res,rej)=>{try{const rq=indexedDB.open('controle_refugos_fotos',1);rq.onupgradeneeded=()=>rq.result.createObjectStore('f',{keyPath:'id'});rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error)}catch(e){rej(e)}})}
async function fotoLocalPut(rec){const db=await fotoDB();return new Promise((res,rej)=>{const t=db.transaction('f','readwrite');t.objectStore('f').put(rec);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function fotoLocalGet(id){try{const db=await fotoDB();return await new Promise((res)=>{const q=db.transaction('f').objectStore('f').get(id);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}}
async function fotoLocalDel(id){try{const db=await fotoDB();await new Promise(res=>{const t=db.transaction('f','readwrite');t.objectStore('f').delete(id);t.oncomplete=res;t.onerror=res})}catch(e){}}
async function fotoLocalPendentes(){try{const db=await fotoDB();return await new Promise(res=>{const out=[];const q=db.transaction('f').objectStore('f').openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return res(out);if(!c.value.synced)out.push(c.value);c.continue()};q.onerror=()=>res(out)})}catch(e){return[]}}
function fotoOnline(){try{return !!(typeof firebaseOnlineConnected!=='undefined'&&firebaseOnlineConnected&&firebaseDbOnline)}catch(e){return false}}
async function fotoPushRemote(rec){if(!fotoOnline())return false;try{await firebaseRoot().collection('fotos').doc(rec.id).set({d:rec.url,ts:Date.now()});await fotoLocalPut({id:rec.id,url:rec.url,synced:true});return true}catch(e){console.warn('Foto não enviada ao Firebase:',e);return false}}
async function fotoSyncPendentes(){if(!fotoOnline())return;const L=await fotoLocalPendentes();for(const rec of L){await fotoPushRemote(rec)}}
setInterval(()=>{fotoSyncPendentes().catch(()=>{})},45000);
window.addEventListener('load',()=>setTimeout(()=>fotoSyncPendentes().catch(()=>{}),8000));
async function fotoGet(id){
  const loc=await fotoLocalGet(id);if(loc&&loc.url)return loc.url;
  if(fotoOnline()){try{const d=await firebaseRoot().collection('fotos').doc(id).get();if(d.exists){const url=d.data().d;await fotoLocalPut({id,url,synced:true});return url}}catch(e){console.warn('Foto não baixada:',e)}}
  return null;
}
async function fotoApagarRemoto(id){await fotoLocalDel(id);if(fotoOnline()){try{await firebaseRoot().collection('fotos').doc(id).delete()}catch(e){}}}
function fotoComprimir(file){return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{try{
    const w=img.naturalWidth,h=img.naturalHeight;
    const make=(dim,q)=>{const k=Math.min(1,dim/Math.max(w,h));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q)};
    let out=make(1000,.68);
    if(out.length>700000)out=make(800,.55);
    if(out.length>700000)out=make(640,.45);
    URL.revokeObjectURL(url);resolve(out);
  }catch(e){URL.revokeObjectURL(url);reject(e)}};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Não foi possível ler a imagem.'))};
  img.src=url;
})}
function renderFormFotos(){
  const box=document.getElementById('fotoPrev');if(!box)return;
  box.innerHTML=formFotos.map((f,i)=>`<div class="fp"><img src="${f.url}" alt="Foto ${i+1}" onclick="abrirFotoGrande(${i})"><button type="button" title="Remover foto" onclick="removerFormFoto(${i})">×</button></div>`).join('');
  const info=document.getElementById('fotoInfo');if(info)info.textContent=formFotos.length?`${formFotos.length} de ${FOTO_MAX} foto(s) anexada(s).`:`Até ${FOTO_MAX} fotos por lançamento. São reduzidas automaticamente para não pesar.`;
}
function removerFormFoto(i){const f=formFotos[i];if(!f)return;if(!f.novo)fotosRemovidas.push(f.id);formFotos.splice(i,1);renderFormFotos()}
function abrirFotoGrande(i){const f=formFotos[i];if(!f)return;const w=window.open('','_blank');if(w){w.document.write('<title>Foto</title><body style="margin:0;background:#111"><img src="'+f.url+'" style="max-width:100%;display:block;margin:auto">')}}
async function loadFormFotos(ids){
  formFotos=[];fotosRemovidas=[];renderFormFotos();
  if(!Array.isArray(ids)||!ids.length)return;
  const tmp=[];for(const id of ids){const url=await fotoGet(id);if(url)tmp.push({id,url,novo:false})}
  formFotos=tmp;renderFormFotos();
}
document.getElementById('fotoInput')?.addEventListener('change',async ev=>{
  const files=[...(ev.target.files||[])];ev.target.value='';
  for(const file of files){
    if(formFotos.length>=FOTO_MAX){alert('Limite de '+FOTO_MAX+' fotos por lançamento.');break}
    if(!/^image\//.test(file.type)){continue}
    try{const url=await fotoComprimir(file);formFotos.push({id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),url,novo:true});renderFormFotos()}
    catch(e){alert('Não foi possível anexar a foto: '+(e?.message||e))}
  }
});
async function commitFormFotos(r){
  const ids=[];
  for(const f of formFotos){
    ids.push(f.id);
    if(f.novo){await fotoLocalPut({id:f.id,url:f.url,synced:false});fotoPushRemote({id:f.id,url:f.url}).catch(()=>{})}
  }
  if(ids.length)r.FOTOS=ids;else delete r.FOTOS;
  const rem=fotosRemovidas.slice();fotosRemovidas=[];
  rem.forEach(id=>{fotoApagarRemoto(id)});
}
async function verFotos(i){
  const r=data[i];if(!r)return;
  let m=document.getElementById('fotoModal');
  if(!m){m=document.createElement('div');m.id='fotoModal';m.addEventListener('click',e=>{if(e.target===m||e.target.dataset.close)m.classList.remove('show')});document.body.appendChild(m)}
  m.innerHTML='<div class="fm"><h3>Lançamento — '+esc(val(r,'produto')||val(r,'codigo'))+'</h3><div class="small">OF '+esc(val(r,'of')||'—')+' • '+esc(val(r,'data'))+'</div><div class="fm-obs">'+esc(val(r,'observacao')||'Sem observação.')+'</div><div class="fm-grid" id="fmGrid">Carregando fotos...</div><div style="text-align:right;margin-top:12px"><button class="btn secondary" data-close="1">Fechar</button></div></div>';
  m.classList.add('show');
  const parts=[];for(const id of (r.FOTOS||[])){const url=await fotoGet(id);parts.push(url?`<img src="${url}" alt="Foto do lançamento" onclick="window.open(this.src,'_blank')">`:'<div class="small">Foto indisponível neste aparelho (conecte ao Firebase para baixar).</div>')}
  const g=document.getElementById('fmGrid');if(g)g.innerHTML=parts.join('')||'Sem fotos.';
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('fotoModal')?.classList.remove('show')});
function showToast(msg){
  let t=document.getElementById('appToast');
  if(!t){t=document.createElement('div');t.id='appToast';t.setAttribute('role','status');t.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1f7a3d;color:#fff;padding:12px 22px;border-radius:12px;font:700 14px system-ui,Arial;box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:99999;opacity:0;transition:opacity .2s;pointer-events:none';document.body.appendChild(t)}
  t.textContent='✔ '+msg;t.style.opacity='1';clearTimeout(t._h);t._h=setTimeout(()=>{t.style.opacity='0'},2600);
}
const refugoForm=document.getElementById('refugoForm');
refugoForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const cod=String(document.getElementById('codigo')?.value||'').trim();
    const cliente=canonicalClientName(document.getElementById('cliente')?.value||'').trim();
    if(!cod){ alert('Informe o código interno da peça.'); return; }
    if(!cliente){ alert('Selecione o cliente (ou "Sem cliente cadastro").'); return; }

    // Usa primeiro o cadastro oficial da aba Produtos. Isso evita que um
    // cliente selecionado no lançamento impeça o salvamento quando o produto
    // oficial estiver sem cliente preenchido.
    const oficial=window.__BUSCAR_PRODUTO_OFICIAL__?.(cod);
    const p=oficial || findPeca(cliente.toUpperCase()===SEM_CLIENTE?'':cliente,cod);
    if(!p){ alert('Não foi possível localizar a peça para o código informado.'); return; }

    const quantidade=document.getElementById('quantidade')?.value||'';
    if(quantidade==='' || !Number.isFinite(Number(String(quantidade).replace(',','.'))) || Number(quantidade)<0){
      alert('Informe uma quantidade válida.'); return;
    }

    let r={};
    Object.entries(cols).forEach(([k,c])=>{
      const el=document.getElementById(k);
      r[c]=el?el.value||null:null;
    });
    r[cols.produzidoKg]=null;
    r[cols.custoKg]=null;
    r[cols.cliente]=cliente;
    r[cols.codigo]=cod;
    r[cols.produto]=p.descricao||r[cols.produto]||null;
    r[cols.planta]=plantaPeloMotivo(r)||p.planta||r[cols.planta]||null;
    r[cols.pesoArvore]=p.pesoArvore??null;
    r[cols.pesoCanal]=p.pesoFundUsin??null;
    r[cols.kgFundUsin]=document.getElementById('kgFundUsin')?.value || null;
    r[cols.kgRefugo]=document.getElementById('kgRefugo')?.value || null;
    if(document.getElementById('pesoPrincipal')) r.PESO_PRINCIPAL_CADASTRO=document.getElementById('pesoPrincipal').value||null;
    if(document.getElementById('pesoUsinado')) r.PESO_USINADO_CADASTRO=document.getElementById('pesoUsinado').value||null;

    const i=document.getElementById('editIndex')?.value??'';
    if(i==='' && !r[cols.dataLancamento]){const n=new Date();r[cols.dataLancamento]=new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)}
    await commitFormFotos(r);
    if(i==='' || !Number.isInteger(Number(i))) data.push(r); else data[Number(i)]=r;
    save();
    clearForm();
    showToast(i==='' ? 'Lançamento salvo com sucesso.' : 'Lançamento atualizado com sucesso.');
    setTimeout(refresh,30);
  }catch(err){
    console.error('Erro ao salvar lançamento:',err);
    alert('Não foi possível salvar o lançamento.\n\nDetalhes: '+(err?.message||err));
  }
});

function switchLaunchTab(tab){
  const isProd=tab==='producao';
  document.querySelectorAll('.launch-tab').forEach(b=>b.classList.toggle('active',b.dataset.launchTab===tab));
  const ref=document.getElementById('launchTabRefugo'),prod=document.getElementById('launchTabProducao');
  if(ref)ref.style.display=isProd?'none':'';
  if(prod)prod.style.display=isProd?'':'none';
  if(isProd)renderProducao();
}

const MESES_PRODUCAO=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const FONTE_HIST_KEY='controle_refugos_2026_historico_fonte';
function salvarHistoricoFonte(){
  try{
    const snap={versao:'v79',dataRegistro:new Date().toISOString(),custoRefugoKg:2.60,producaoFundicao:Array.isArray(producaoFundicao)?producaoFundicao.map(x=>({...x,custoKg:2.6})):[],reunioes:Array.isArray(window.reunioes)?JSON.parse(JSON.stringify(window.reunioes)):[]};
    localStorage.setItem(FONTE_HIST_KEY,JSON.stringify(snap));
  }catch(e){console.warn('Não foi possível salvar histórico-fonte local:',e)}
}
function normalizarCustoRefugoHistorico(){
  let alterado=false;
  if(Array.isArray(producaoFundicao)){
    producaoFundicao=producaoFundicao.map(x=>{const y={...x};if(Number(y.custoKg)!==2.6){y.custoKg=2.6;alterado=true}return y});
  }
  if(alterado)localStorage.setItem(PROD_KEY,JSON.stringify(producaoFundicao));
  salvarHistoricoFonte();
}
normalizarCustoRefugoHistorico();
function saveProducao(){localStorage.setItem(PROD_KEY,JSON.stringify(producaoFundicao));salvarHistoricoFonte();dashboardDirty=true;}
function clearProducaoForm(resetAno=true){
  const idx=document.getElementById('producaoEditIndex');if(idx)idx.value='';
  if(resetAno){const a=document.getElementById('producaoAno');if(a)a.value=new Date().getFullYear();}
  const m=document.getElementById('producaoMes');if(m)m.value=String(new Date().getMonth()+1);
  ['producaoKg','producaoCustoKg','producaoObs'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  updateSecurityUI();
}
function renderProducao(){
  const body=document.getElementById('producaoTableBody');if(!body)return;
  const list=[...producaoFundicao].sort((a,b)=>productionYear(b)-productionYear(a)||productionMonth(b)-productionMonth(a));
  const count=document.getElementById('producaoCount');if(count)count.textContent=`${list.length} ${list.length===1?'mês cadastrado':'meses cadastrados'}`;
  const costCell=r=>costAccessAllowed()?`R$ ${fmt(r.custoKg||0)}`:'🔒 Restrito';
  body.innerHTML=list.length?list.map(r=>{const idx=producaoFundicao.indexOf(r);return `<tr><td>${esc(r.ano)}</td><td>${esc(MESES_PRODUCAO[(productionMonth(r)||1)-1]||'')}</td><td><strong>${fmt(productionValue(r))} kg</strong></td><td>${costCell(r)}</td><td>${esc(r.observacao||'')}</td><td><button class="btn secondary" onclick="editProducao(${idx})">Editar</button> <button class="btn danger" onclick="removeProducao(${idx})">Excluir</button></td></tr>`}).join(''):'<tr><td colspan="6" style="text-align:center" class="small">Nenhum valor mensal cadastrado.</td></tr>';
  updateSecurityUI();
}
function editProducao(i){const r=producaoFundicao[i];if(!r)return;if(!costAccessAllowed()){openSecurityModal('cost',()=>editProducao(i));return;}document.getElementById('producaoEditIndex').value=String(i);document.getElementById('producaoAno').value=r.ano;document.getElementById('producaoMes').value=r.mes;document.getElementById('producaoKg').value=r.kg;document.getElementById('producaoCustoKg').value=r.custoKg??'';document.getElementById('producaoObs').value=r.observacao||'';navigate('lancamentos');switchLaunchTab('producao');}
function removeProducao(i){if(confirm('Excluir o total produzido deste mês?')){producaoFundicao.splice(i,1);saveProducao();renderProducao();dashboardDirty=true;dashboard();}}
const producaoForm=document.getElementById('producaoForm');
producaoForm?.addEventListener('submit',e=>{e.preventDefault();const ano=Number(document.getElementById('producaoAno').value),mes=Number(document.getElementById('producaoMes').value),kgVal=Number(String(document.getElementById('producaoKg').value).replace(',','.')),custoTxt=String(document.getElementById('producaoCustoKg').value||'').trim(),custoVal=costAccessAllowed()?(custoTxt===''?2.6:Number(custoTxt.replace(',','.'))):2.6,obs=document.getElementById('producaoObs').value.trim();if(!Number.isInteger(ano)||ano<2020||ano>2100)return alert('Informe um ano válido.');if(!Number.isInteger(mes)||mes<1||mes>12)return alert('Informe um mês válido.');if(!Number.isFinite(kgVal)||kgVal<0)return alert('Informe um total produzido válido.');if(!Number.isFinite(custoVal)||custoVal<0)return alert('Informe um custo de refugo válido ou deixe em branco.');const editIdx=document.getElementById('producaoEditIndex').value;const dup=producaoFundicao.findIndex(x=>Number(x.ano)===ano&&Number(x.mes)===mes);const existente=editIdx!==''?producaoFundicao[Number(editIdx)]:dup>=0?producaoFundicao[dup]:null;const obj={ano,mes,kg:kgVal,custoKg:costAccessAllowed()?custoVal:(existente?.custoKg!==undefined&&existente?.custoKg!==''?existente.custoKg:2.6),observacao:obs};if(editIdx!=='')producaoFundicao[Number(editIdx)]=obj;else if(dup>=0)producaoFundicao[dup]=obj;else producaoFundicao.push(obj);saveProducao();clearProducaoForm();renderProducao();dashboardDirty=true;dashboard();alert(`Produção da Fundição de ${MESES_PRODUCAO[mes-1]}/${ano} salva: ${fmt(kgVal)} kg.`);});

const codigoInput=document.getElementById('codigo');
if(codigoInput){
  codigoInput.addEventListener('input',autoPreencherClientePorCodigo);
  codigoInput.addEventListener('change',autoPreencherClientePorCodigo);
  codigoInput.addEventListener('blur',autoPreencherClientePorCodigo);
  codigoInput.addEventListener('paste',()=>setTimeout(autoPreencherClientePorCodigo,50));
  codigoInput.addEventListener('keyup',e=>{if(e.key==='Enter') autoPreencherClientePorCodigo();});
}
document.addEventListener('input',e=>{if(e.target?.id==='codigo') autoPreencherClientePorCodigo();});
document.getElementById('cliente')?.addEventListener('change',aplicarCadastroPeca);
document.getElementById('quantidade')?.addEventListener('input',calcularPesosLancamento);

function analysisInputDate(id){const v=String(document.getElementById(id)?.value||'').trim();if(!v)return null;const m=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return Number.isNaN(d.getTime())?null:d;}
function analysisFilters(){
  return {
    start:analysisInputDate('analysisDateStart'),
    end:analysisInputDate('analysisDateEnd'),
    plant:(document.getElementById('analysisPlant')?.value||'').trim()?plantNormName(document.getElementById('analysisPlant').value):'',
    client:normalizeText(canonicalClientName(document.getElementById('analysisClient')?.value||'')),
    reason:normalizeText(document.getElementById('analysisReason')?.value||''),
    responsible:normalizeText(document.getElementById('analysisResponsible')?.value||''),
    product:normalizeText(document.getElementById('analysisProduct')?.value||''),
    of:normalizeText(document.getElementById('analysisOF')?.value||'')
  };
}
function analysisFiltered(){
  const f=analysisFilters();
  return data.filter(r=>{
    const d=date(r);
    if(f.start && (!d || d<f.start)) return false;
    if(f.end){const end=new Date(f.end.getFullYear(),f.end.getMonth(),f.end.getDate(),23,59,59,999);if(!d||d>end)return false;}
    if(f.plant && recordPlant(r)!==f.plant)return false;
    if(f.client && normalizeText(canonicalClientName(val(r,'cliente')))!==f.client)return false;
    if(f.reason && normalizeText(motivoDescricao(r))!==f.reason)return false;
    if(f.responsible && normalizeText(val(r,'responsavel'))!==f.responsible)return false;
    if(f.product){const prod=normalizeText(val(r,'produto')),cod=normalizeText(val(r,'codigo'));if(!prod.includes(f.product)&&!cod.includes(f.product))return false;}
    if(f.of && !normalizeText(val(r,'of')).includes(f.of))return false;
    return true;
  });
}
function analysisProductionTotal(filters){
  if(filters.plant && filters.plant!=='FUNDICAO') return 0;
  return producaoFundicao.reduce((sum,p)=>{
    const y=productionYear(p),m=productionMonth(p);if(!y||!m)return sum;
    const pStart=new Date(y,m-1,1),pEnd=new Date(y,m,0,23,59,59,999);
    if(filters.start && pEnd<filters.start)return sum;
    if(filters.end && pStart>filters.end)return sum;
    return sum+productionValue(p);
  },0);
}
function analysisFilterLabel(){
  const f=analysisFilters(),parts=[];
  if(f.start)parts.push('de '+f.start.toLocaleDateString('pt-BR'));
  if(f.end)parts.push('até '+f.end.toLocaleDateString('pt-BR'));
  if(f.plant)parts.push('planta: '+f.plant);
  if(f.client)parts.push('cliente: '+canonicalClientName(document.getElementById('analysisClient')?.value||''));
  if(f.reason)parts.push('motivo: '+String(document.getElementById('analysisReason')?.value||''));
  if(f.responsible)parts.push('responsável: '+String(document.getElementById('analysisResponsible')?.value||''));
  if(f.product)parts.push('produto/código: '+String(document.getElementById('analysisProduct')?.value||''));
  if(f.of)parts.push('OF: '+String(document.getElementById('analysisOF')?.value||''));
  return parts.length?parts.join(' • '):'Todos os lançamentos';
}
function groupAnalysis(rows,key){
  const m={};
  rows.forEach(r=>{const raw=key(r);const k=String(raw??'').trim()||'Não informado';if(!m[k])m[k]={kg:0,q:0,cost:0,motivos:{},client:''};m[k].kg+=kg(r);m[k].q+=qty(r);m[k].cost+=cost(r);const mot=motivoDescricao(r)||'Não informado';m[k].motivos[mot]=(m[k].motivos[mot]||0)+kg(r);if(!m[k].client)m[k].client=canonicalClientName(val(r,'cliente'))||'Não informado';});
  return m;
}
function totalFoot(id,totalKg,totalQty,totalCost,label='TOTAL FILTRADO'){
  const el=document.getElementById(id);if(!el)return;
  const c=costAccessAllowed()?`R$ ${fmt(totalCost)}`:'🔒 Restrito';
  el.innerHTML=`<tr><td>${esc(label)}</td><td>${fmt(totalKg)}</td><td>${fmt(totalQty)}</td><td>100%</td><td>${c}</td></tr>`;
}
function analysis(){
  const f=analysisFilters();
  const rows=analysisFiltered();
  const totalKg=rows.reduce((a,r)=>a+kg(r),0),totalQty=rows.reduce((a,r)=>a+qty(r),0),totalCost=rows.reduce((a,r)=>a+cost(r),0);
  const prodPeriodo=analysisProductionTotal(f);
  const perc=prodPeriodo?rows.reduce((a,r)=>a+(recordPlant(r)==='FUNDICAO'?kg(r):0),0)/prodPeriodo*100:0;
  const k=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  k('analysisKpiKg',fmt(totalKg)+' kg');
  k('analysisKpiQty',fmt(totalQty));
  k('analysisKpiCost', costAccessAllowed()?'R$ '+fmt(totalCost):'🔒 Restrito');const _akc=document.getElementById('analysisKpiCost');if(_akc)_akc.dataset.costValue='R$ '+fmt(totalCost);if(document.getElementById('analysisKpiCostSub'))document.getElementById('analysisKpiCostSub').textContent=costAccessAllowed()?'kg × custo R$/kg':'valores protegidos — acesso restrito';
  k('analysisKpiPerc',prodPeriodo?fmt(perc)+'%':'—');
  k('analysisKpiRecords',fmt(rows.length));
  const info=document.getElementById('analysisFilterInfo');
  if(info)info.innerHTML=`<b>${fmt(rows.length)}</b> lançamento(s) encontrados • <b>${fmt(totalKg)} kg</b> de refugo • <b>${fmt(totalQty)}</b> unidade(s) • <b>${costAccessAllowed()?'R$ '+fmt(totalCost):'🔒 custo restrito'}</b> • <span>${esc(analysisFilterLabel())}</span>`;

  const cm=groupAnalysis(rows,r=>canonicalClientName(val(r,'cliente'))||'Não informado');
  const clientEntries=Object.entries(cm).sort((a,b)=>b[1].kg-a[1].kg);
  const clientBody=document.getElementById('clientAnalysis');
  if(clientBody)clientBody.innerHTML=clientEntries.length?clientEntries.map(([name,v])=>`<tr><td>${esc(name)}</td><td>${fmt(v.kg)}</td><td>${fmt(v.q)}</td><td>${totalKg?fmt(v.kg/totalKg*100)+'%':'—'}</td><td>${costAccessAllowed()?'R$ '+fmt(v.cost):'🔒 Restrito'}</td></tr>`).join(''):`<tr><td colspan="5" class="small" style="text-align:center">Nenhum registro para os filtros informados.</td></tr>`;
  totalFoot('clientAnalysisTotal',totalKg,totalQty,totalCost);

  const pm=groupAnalysis(rows,r=>val(r,'produto')||val(r,'codigo')||'Não informado');
  const partEntries=Object.entries(pm).sort((a,b)=>b[1].kg-a[1].kg);
  const partBody=document.getElementById('partAnalysis');
  if(partBody)partBody.innerHTML=partEntries.length?partEntries.map(([name,v])=>`<tr><td>${esc(name)}</td><td>${fmt(v.kg)}</td><td>${fmt(v.q)}</td><td>${totalKg?fmt(v.kg/totalKg*100)+'%':'—'}</td><td>${costAccessAllowed()?'R$ '+fmt(v.cost):'🔒 Restrito'}</td></tr>`).join(''):`<tr><td colspan="5" class="small" style="text-align:center">Nenhum registro para os filtros informados.</td></tr>`;
  totalFoot('partAnalysisTotal',totalKg,totalQty,totalCost);

  const om=groupAnalysis(rows,r=>String(val(r,'of')||'Não informado').trim()||'Não informado');
  const ofEntries=Object.entries(om).sort((a,b)=>b[1].kg-a[1].kg);
  const ofBody=document.getElementById('ofAnalysis');
  if(ofBody)ofBody.innerHTML=ofEntries.length?ofEntries.map(([of,v])=>{const motivo=Object.entries(v.motivos).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';return `<tr><td>${esc(of)}</td><td>${esc(v.client)}</td><td>${fmt(v.kg)}</td><td>${fmt(v.q)}</td><td>${totalKg?fmt(v.kg/totalKg*100)+'%':'—'}</td><td>${esc(motivo)}</td></tr>`}).join(''):`<tr><td colspan="6" class="small" style="text-align:center">Nenhum registro para os filtros informados.</td></tr>`;
  const oft=document.getElementById('ofAnalysisTotal');if(oft)oft.innerHTML=`<tr><td>TOTAL FILTRADO</td><td>—</td><td>${fmt(totalKg)}</td><td>${fmt(totalQty)}</td><td>100%</td><td>—</td></tr>`;

  if(typeof report!=='undefined' && report){report.innerHTML=`<h4>Resumo da análise filtrada</h4><p><b>Filtros:</b> ${esc(analysisFilterLabel())}</p><p><b>Refugo:</b> ${fmt(totalKg)} kg &nbsp; | &nbsp; <b>Quantidade:</b> ${fmt(totalQty)} &nbsp; | &nbsp; <b>Produção da Fundição nos meses do período:</b> ${fmt(prodPeriodo)} kg &nbsp; | &nbsp; <b>% refugo:</b> ${prodPeriodo?fmt(perc):'—'}% &nbsp; | &nbsp; <b>Custo/valor:</b> ${costAccessAllowed()?'R$ '+fmt(totalCost):'🔒 Restrito'}</p>`;}
}
function populateAnalysisFilters(){
  const defs=[
    ['analysisPlant','Todas as plantas',[...new Set(data.map(recordPlant).filter(x=>x&&x!=='NAO INFORMADO'))].sort((a,b)=>a.localeCompare(b,'pt-BR'))],
    ['analysisClient','Todos os clientes',[...new Set(data.map(r=>canonicalClientName(val(r,'cliente'))).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))],
    ['analysisReason','Todos os motivos',[...new Set(data.map(r=>motivoDescricao(r)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))],
    ['analysisResponsible','Todos os responsáveis',[...new Set(data.map(r=>String(val(r,'responsavel')||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))]
  ];
  defs.forEach(([id,placeholder,items])=>{const el=document.getElementById(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(items.includes(old))el.value=old;});
  const dl=document.getElementById('analysisProductList');
  if(dl){const map=new Map();data.forEach(r=>{const d=String(val(r,'produto')||'').trim(),c=String(val(r,'codigo')||'').trim();if(!d&&!c)return;const key=d+'|'+c;if(!map.has(key))map.set(key,{d,c});});dl.innerHTML=[...map.values()].sort((a,b)=>(a.d||a.c).localeCompare(b.d||b.c,'pt-BR')).map(x=>`<option value="${esc(x.d||x.c)}">${esc(x.c?x.c+' — ':'')}${esc(x.d)}</option>`).join('');}
}
function resetAnalysisFilters(){['analysisDateStart','analysisDateEnd','analysisPlant','analysisClient','analysisReason','analysisResponsible','analysisProduct','analysisOF'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});analysis();}
function printReport(){analysis();let w=window.open('','_blank');w.document.write(`<html><head><title>Relatório de Refugo</title><style>body{font-family:Arial;padding:30px}table{border-collapse:collapse;width:100%;margin:15px 0}td,th{border:1px solid #ccc;padding:7px;text-align:left}@media print{button{display:none}}
/* Top 3 itens do principal motivo */
.plant-motive .pm-items-title{font-size:9.5px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.35px;margin-top:10px;margin-bottom:4px}
.plant-motive .pm-items{margin:0;padding-left:19px;color:var(--canvas-text);font-size:10.5px;line-height:1.45}
.plant-motive .pm-items li{padding:2px 0;overflow-wrap:anywhere}
.plant-motive .pm-items li::marker{font-weight:800;color:var(--orange)}
/* Destaque dos cards de principal motivo - KG e Quantidade */
.plant-motives .plant-motive{
  position:relative;
  background:linear-gradient(135deg,#fff7f2 0%,var(--card) 72%);
  border:1px solid #ff9a6b;
  border-left:4px solid var(--orange);
  box-shadow:0 8px 22px rgba(255,90,24,.14);
  transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease,background .35s ease;
}
.plant-motives .plant-motive::before{
  content:"";position:absolute;left:0;top:0;right:0;height:3px;background:var(--orange);border-radius:12px 12px 0 0;
}
.plant-motives .plant-motive:hover{
  transform:translateY(-2px);
  box-shadow:0 12px 28px rgba(255,90,24,.22);
  border-color:var(--orange);
}
.plant-motives .pm-label{color:var(--orange);font-size:10.5px}
.plant-motives .pm-value{font-size:14px;font-weight:850}
.plant-motives .pm-sub{font-weight:700}
[data-theme="dark"] .plant-motives .plant-motive{
  background:linear-gradient(135deg,#182336 0%,#101a2a 76%);
  border-color:#9a4b28;
  border-left-color:var(--orange);
  box-shadow:0 8px 24px rgba(0,0,0,.28),0 0 0 1px rgba(255,90,24,.08);
}
[data-theme="dark"] .plant-motives .plant-motive:hover{
  border-color:var(--orange);
  box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 18px rgba(255,90,24,.10);
}
[data-theme="dark"] .plant-motives .pm-label{color:#ff9a70}
</style></head><body><h1>Relatório de Refugo</h1>${report.innerHTML}<h2>Por cliente</h2><table>${clientAnalysis.parentElement.parentElement.innerHTML}</table><h2>Por peça</h2><table>${partAnalysis.parentElement.parentElement.innerHTML}</table><h2>Por OF</h2><table>${ofAnalysis.parentElement.parentElement.innerHTML}</table>


</body></html>`);w.document.close();w.print()}
function exportReportCSV(){
  const rows=analysisFiltered(),f=analysisFilters(),prodPeriodo=analysisProductionTotal(f),totalKg=rows.reduce((a,r)=>a+kg(r),0),totalCost=rows.reduce((a,r)=>a+cost(r),0),perc=prodPeriodo?rows.reduce((a,r)=>a+(recordPlant(r)==='FUNDICAO'?kg(r):0),0)/prodPeriodo*100:0;
  const headers=['Data','Cliente','Planta','Código','Produto','OF','Quantidade','Kg refugo','Motivo','Responsável','Custo/valor'];
  const out=[headers,...rows.map(r=>[val(r,'data'),canonicalClientName(val(r,'cliente')),recordPlant(r),val(r,'codigo'),val(r,'produto'),val(r,'of'),qty(r),kg(r),motivoDescricao(r),val(r,'responsavel'),cost(r)])];
  out.push(['','','','','','','TOTAL FILTRADO',totalKg,'','',''+totalCost]);
  let csv=out.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');
  let b=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='analise-refugo-filtrada.csv';a.click();
}
function applyTheme(theme){
 const body=document.body;
 if(body){body.classList.add('theme-transition');}
 document.documentElement.setAttribute('data-theme',theme);
 localStorage.setItem('controle_refugos_2026_theme',theme);
 const b=document.getElementById('themeToggle');
 if(b)b.innerHTML=theme==='dark'?'☀️ <span>Modo claro</span>':'🌙 <span>Modo escuro</span>';
 dashboardDirty=true;dashboardQtdDirty=true;
 const active=document.querySelector('.page.active')?.id||'dashboard';
 if(active==='dashboard')dashboard(); else if(active==='dashboardQtd')dashboardQtd();
 window.setTimeout(()=>body?.classList.remove('theme-transition'),520);
}
function toggleTheme(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark')}
function gerarPdfDashboard(pageId){
  const page=document.getElementById(pageId);
  if(!page)return;
  const oldTitle=document.title;
  const filtroAno=document.getElementById(pageId==='dashboard'?'filterYear':'qFilterYear')?.value||'Todos';
  const filtroPlanta=plSel(pageId==='dashboard'?'filterPlant':'qFilterPlant').join(' + ')||'Todas as plantas';
  const filtroMes=document.getElementById(pageId==='dashboard'?'filterMonth':'qFilterMonth')?.value||'Todos';
  document.title='Dashboard de Refugos - '+filtroAno+' - '+filtroPlanta;
  // Marca a página antes de redesenhar os gráficos para usar o buffer de alta resolução do PDF.
  document.querySelectorAll('.page.pdf-print-target').forEach(el=>el.classList.remove('pdf-print-target'));
  page.classList.add('pdf-print-target');
  if(pageId==='dashboard'){dashboardDirty=true;dashboard();}
  else if(pageId==='dashboardQtd'){dashboardQtdDirty=true;dashboardQtd();}

  const title=document.createElement('div');
  title.className='pdf-only-title';
  const logoSrc=document.querySelector('.brand img')?.src||'';
  const filtroAnoTxt=filtroAno==='Todos'?'Todos os anos':filtroAno;
  const filtroPlantaTxt=filtroPlanta||'Todas as plantas';
  const filtroMesTxt=filtroMes==='Todos'?'Todos os meses':filtroMes;
  const dataGeracao=new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  title.innerHTML='<div class="pdf-brand">'+(logoSrc?'<img src="'+logoSrc+'" alt="Logo">':'')+'<div><div class="pdf-title-main">CONTROLE DE REFUGOS — '+(pageId==='dashboardQtd'?'DASHBOARD QUANTIDADE':'DASHBOARD')+'</div><div class="pdf-sub">Relatório para impressão • A4 paisagem • Gerado em '+esc(dataGeracao)+'</div></div></div><div class="pdf-filters"><b>Filtros aplicados</b><br>Ano: '+esc(filtroAnoTxt)+' • Planta: '+esc(filtroPlantaTxt)+' • Mês: '+esc(filtroMesTxt)+'</div>';
  page.insertBefore(title,page.firstChild);
  const cleanup=()=>{title.remove();page.classList.remove('pdf-print-target');document.title=oldTitle;window.removeEventListener('afterprint',cleanup);if(pageId==='dashboard'){dashboardDirty=true;dashboard();}else if(pageId==='dashboardQtd'){dashboardQtdDirty=true;dashboardQtd();}};
  window.addEventListener('afterprint',cleanup);
  setTimeout(()=>window.print(),250);
}

function initTheme(){const t=localStorage.getItem('controle_refugos_2026_theme')||'light';document.documentElement.setAttribute('data-theme',t);const b=document.getElementById('themeToggle');if(b)b.innerHTML=t==='dark'?'☀️ <span>Modo claro</span>':'🌙 <span>Modo escuro</span>';if(document.querySelector('.page.active')){dashboardDirty=true;dashboardQtdDirty=true;}}
function refresh(){window.__limpaVazios&&window.__limpaVazios();
 normalizeCad();saveCad();options();populateQtyFilters();populateAnalysisFilters();popularCamposLancamento();
 dashboardDirty=true;dashboardQtdDirty=true;
 const active=document.querySelector('.page.active')?.id||'dashboard';
 if(active==='dashboard')dashboard();
 else if(active==='dashboardQtd')dashboardQtd();
 else if(active==='historico')renderTable();
 else if(active==='cadastro')renderCadastro();
 else if(active==='analise'||active==='relatorio')analysis();
 else if(active==='lancamentos')renderProducao();
}
function resetFilters(){document.getElementById('filterYear').value='';msSet('filterPlant',[]);document.getElementById('filterMonth').value='';dashboardDirty=true;dashboard()}
function resetQtyFilters(){document.getElementById('qFilterYear').value='';msSet('qFilterPlant',[]);document.getElementById('qFilterMonth').value='';dashboardQtdDirty=true;dashboardQtd()}
['filterYear','filterPlant','filterMonth'].map(id=>document.getElementById(id)).filter(Boolean).forEach(x=>x.addEventListener('change',()=>{dashboardDirty=true;dashboard()}));
[document.getElementById('qFilterYear'),document.getElementById('qFilterPlant'),document.getElementById('qFilterMonth')].filter(Boolean).forEach(x=>x.addEventListener('change',()=>{dashboardQtdDirty=true;dashboardQtd()}));
// Reforço: garante que os filtros sejam populados depois que toda a base foi carregada.
setTimeout(()=>{options();populateQtyFilters();populateAnalysisFilters();popularCamposLancamento();},0);
const analysisFilterIds=['analysisDateStart','analysisDateEnd','analysisPlant','analysisClient','analysisReason','analysisResponsible'];
analysisFilterIds.map(id=>document.getElementById(id)).filter(Boolean).forEach(el=>el.addEventListener('change',analysis));
let analysisInputTimer=null;
['analysisProduct','analysisOF'].map(id=>document.getElementById(id)).filter(Boolean).forEach(el=>el.addEventListener('input',()=>{clearTimeout(analysisInputTimer);analysisInputTimer=setTimeout(analysis,180);}));
{let __st;search.addEventListener('input',()=>{clearTimeout(__st);__st=setTimeout(()=>{historyLimit=HISTORY_PAGE;renderTable()},250)});}
let appLoadingTimer=null;
let appLoadingToken=0;
function showAppLoading(title='Carregando informações...', text='Aguarde um instante.') {
  const overlay=document.getElementById('appLoading');
  const t=document.getElementById('appLoadingTitle');
  const tx=document.getElementById('appLoadingText');
  if(!overlay)return;
  if(t)t.textContent=title;
  if(tx)tx.textContent=text;
  clearTimeout(appLoadingTimer);
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
}
function hideAppLoading(delay=0){
  const token=++appLoadingToken;
  clearTimeout(appLoadingTimer);
  const close=()=>{
    if(token!==appLoadingToken)return;
    const overlay=document.getElementById('appLoading');
    if(!overlay)return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
  };
  if(delay>0)appLoadingTimer=setTimeout(close,delay); else close();
}
function withAppLoading(title,text,work,minVisible=220){
  const started=performance.now();
  showAppLoading(title,text);
  const finish=()=>{
    const elapsed=performance.now()-started;
    hideAppLoading(Math.max(0,minVisible-elapsed));
  };
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      try{work()}catch(err){console.error(err)}finally{finish()}
    },45);
  });
}

/* ==================== CONTROLE DE ACESSO ==================== */
let securityMode='';
let securitySuccessCallback=null;
let cadastroUnlocked=sessionStorage.getItem('controle_refugos_cadastro_unlocked')==='true';
let costUnlocked=sessionStorage.getItem('controle_refugos_cost_unlocked')==='true';
function openSecurityModal(mode,callback){
  securityMode=mode||'generic';
  securitySuccessCallback=typeof callback==='function'?callback:null;
  const modal=document.getElementById('securityModal'),title=document.getElementById('securityTitle'),text=document.getElementById('securityText'),icon=document.getElementById('securityIcon'),input=document.getElementById('securityPassword');
  if(!modal)return;
  const cfg=securityMode==='cadastro'
    ? {title:'Cadastro protegido',text:'Digite a senha para cadastrar, editar ou excluir informações.',icon:'🔒'}
    : {title:'Custo protegido',text:'Digite a senha para visualizar os valores de custo do refugo.',icon:'💰'};
  if(title)title.textContent=cfg.title;if(text)text.textContent=cfg.text;if(icon)icon.textContent=cfg.icon;
  if(input){input.value='';input.placeholder='Digite a senha';input.focus();}
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
}
function closeSecurityModal(){const modal=document.getElementById('securityModal');if(!modal)return;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');securityMode='';securitySuccessCallback=null;const input=document.getElementById('securityPassword');if(input)input.value='';}
function submitSecurityPassword(){return window.__submitSec();}
function __submitSecOld(){
  const input=document.getElementById('securityPassword');const senha=String(input?.value||'');
  const expected=null;
  if(senha!==expected){if(input){input.value='';input.focus();}alert('Senha incorreta.');return;}
  const mode=securityMode,cb=securitySuccessCallback;
  if(mode==='cadastro'){cadastroUnlocked=true;sessionStorage.setItem('controle_refugos_cadastro_unlocked','true');}
  if(mode==='cost'){costUnlocked=true;sessionStorage.setItem('controle_refugos_cost_unlocked','true');}
  closeSecurityModal();
  updateSecurityUI();
  if(mode==='cost')refreshSensitiveViews();
  if(typeof cb==='function')cb();
}
function lockCadastroAccess(){cadastroUnlocked=false;sessionStorage.removeItem('controle_refugos_cadastro_unlocked');const active=document.getElementById('cadastro');if(active?.classList.contains('active'))navigate('dashboard');updateSecurityUI();}
function cadastroAccessAllowed(){return window.__cadOK?window.__cadOK():false;}
function costAccessAllowed(){return window.__costOK?window.__costOK():false;}
function toggleCostAccess(){
  if(costAccessAllowed()){
    costUnlocked=false;sessionStorage.removeItem('controle_refugos_cost_unlocked');updateSecurityUI();refreshSensitiveViews();
  }else{
    openSecurityModal('cost');
  }
}
function refreshSensitiveViews(){
  updateSecurityUI();
  try{dashboard();}catch(e){}
  try{analysis();}catch(e){}
  try{renderProducao();}catch(e){}
}
function updateSecurityUI(){
  const cost=costAccessAllowed();
  const buttons=['dashboardCostAccessBtn','analysisCostAccessBtn','productionCostAccessBtn'];
  buttons.forEach(id=>{const b=document.getElementById(id);if(b)b.textContent=cost?'🔓 Ocultar custos':'🔐 Mostrar custos';});
  const field=document.getElementById('producaoCostField'),input=document.getElementById('producaoCustoKg');
  if(field)field.style.display=cost?'':'none';
  if(input){input.disabled=!cost;input.placeholder=cost?'Ex.: 25,00':'🔒 Disponível somente com senha';if(!cost)input.value='';}
  const k=document.getElementById('kpiCusto'),ks=document.getElementById('kpiCustoSub');
  if(k){k.textContent=cost?(k.dataset.costValue||'R$ 0'):'🔒 Restrito';k.parentElement?.classList.toggle('cost-sensitive-locked',!cost);}
  if(ks)ks.textContent=cost?'valor financeiro da perda':'valores protegidos — acesso restrito';
  const ak=document.getElementById('analysisKpiCost'),aks=document.getElementById('analysisKpiCostSub');
  if(ak){ak.textContent=cost?(ak.dataset.costValue||'R$ 0'):'🔒 Restrito';ak.parentElement?.classList.toggle('cost-sensitive-locked',!cost);}
  if(aks)aks.textContent=cost?'kg × custo R$/kg':'valores protegidos — acesso restrito';
  const cb=document.getElementById('cadastroLockBtn');if(cb)cb.textContent=cadastroAccessAllowed()?'🔒 Bloquear cadastro':'🔐 Cadastro protegido';
}
function setHistoryLoading(show){
  const el=document.getElementById('historyInlineLoading'),wrap=document.getElementById('historyTableWrap');
  if(el)el.classList.toggle('show',!!show);
  if(wrap)wrap.style.display=show?'none':'';
}
document.getElementById('securityPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitSecurityPassword()}if(e.key==='Escape'){e.preventDefault();closeSecurityModal()}});
document.getElementById('securityModal')?.addEventListener('click',e=>{if(e.target?.id==='securityModal')closeSecurityModal()});

function loadingLabel(page){
  return ({
    dashboard:'Atualizando dashboard...',
    dashboardQtd:'Atualizando dashboard de quantidade...',
    historico:'Carregando histórico...',
    cadastro:'Carregando cadastros...',
    analise:'Preparando análise...',
    relatorio:'Preparando relatórios...',
    dados:'Carregando dados e backup...',
    ajuda:'Abrindo ajuda...'
  })[page]||'Carregando informações...';
}

function navigate(page){if(page==='auditoria')setTimeout(function(){window.audInit&&window.audInit()},0);if(page==='retrabalho')setTimeout(function(){window.rtInit&&window.rtInit()},0);if(page==='reuniao')setTimeout(function(){window.reuniaoInit&&window.reuniaoInit()},0);
 if(page==='cadastro' && !cadastroAccessAllowed()){openSecurityModal('cadastro',()=>navigate('cadastro'));closeMobileMenu();return;}
 const btns=document.querySelectorAll('.tab');
 btns.forEach(x=>x.classList.toggle('active',x.dataset.page===page));
 const current=document.querySelector('.page.active');
 const target=document.getElementById(page);
 if(!target)return;
 if(current && current!==target){current.classList.remove('active');current.classList.remove('page-leaving');}
 target.classList.add('active');
 const activeBtn=document.querySelector(`.tab[data-page="${page}"]`);
 if(activeBtn){document.querySelector('.top-title h1').textContent=activeBtn.textContent.replace(/[▣▥＋☷⌕▤⚙❓]/g,'').trim()}
 const needsLoading=['dashboard','dashboardQtd','historico','cadastro','analise','relatorio','dados','ajuda'].includes(page);
 const renderPage=()=>{
   if(page==='dashboard' && dashboardDirty)dashboard();
   if(page==='dashboardQtd' && dashboardQtdDirty)dashboardQtd();
   if(page==='historico'){historyLimit=HISTORY_PAGE;renderTable();}
   if(page==='cadastro')renderCadastro();
   if(page==='lancamentos')popularCamposLancamento();
   if(page==='analise'||page==='relatorio')analysis();
   closeMobileMenu();
   window.scrollTo({top:0,behavior:'auto'});
 };
 if(needsLoading){
   const textMap={historico:'Organizando os lançamentos do mais recente para o mais antigo.',analise:'Aplicando os filtros e consolidando os valores.',relatorio:'Preparando os dados para visualização.',cadastro:'Carregando o cadastro protegido.'};
   if(page==='historico')setHistoryLoading(true);
   withAppLoading(loadingLabel(page),textMap[page]||'Aguarde um instante.',()=>{try{renderPage()}finally{if(page==='historico')setHistoryLoading(false)}},150);
 }else{
   renderPage();
 }
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();navigate(b.dataset.page)}));
updateSecurityUI();
// Realça somente os painéis que possuem gráficos, preservando as demais caixas do sistema.
function initChartPanelHover(){
  document.querySelectorAll('.panel').forEach(panel=>{
    if(panel.querySelector('.chartbox')) panel.classList.add('chart-panel');
  });
}
initChartPanelHover();


const mobileDrawer=document.getElementById('mobileDrawer');
const mobileMenuBtn=document.getElementById('mobileMenuBtn');
const mobileDrawerClose=document.getElementById('mobileDrawerClose');
const mobileDrawerBackdrop=document.getElementById('mobileDrawerBackdrop');
function openMobileMenu(){if(!mobileDrawer)return;mobileDrawer.classList.add('open');mobileDrawer.setAttribute('aria-hidden','false');mobileMenuBtn?.setAttribute('aria-expanded','true');document.body.style.overflow='hidden'}
function closeMobileMenu(){if(!mobileDrawer)return;mobileDrawer.classList.remove('open');mobileDrawer.setAttribute('aria-hidden','true');mobileMenuBtn?.setAttribute('aria-expanded','false');document.body.style.overflow=''}
mobileMenuBtn?.addEventListener('click',openMobileMenu);
mobileDrawerClose?.addEventListener('click',closeMobileMenu);
mobileDrawerBackdrop?.addEventListener('click',closeMobileMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileMenu()});


function zipU16(b,o){return b[o]|(b[o+1]<<8)}
function zipU32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0}
function zipFindEOCD(b){let start=Math.max(0,b.length-65557);for(let i=b.length-22;i>=start;i--){if(zipU32(b,i)===0x06054b50)return i}throw new Error('Arquivo Excel inválido ou ZIP não reconhecido.')}
function zipEntries(b){let e=zipFindEOCD(b),cdSize=zipU32(b,e+12),cdOffset=zipU32(b,e+16),p=cdOffset,entries={};while(p<cdOffset+cdSize){if(zipU32(b,p)!==0x02014b50)break;let method=zipU16(b,p+10),compSize=zipU32(b,p+20),nameLen=zipU16(b,p+28),extraLen=zipU16(b,p+30),commentLen=zipU16(b,p+32),localOffset=zipU32(b,p+42);let name=new TextDecoder('utf-8').decode(b.slice(p+46,p+46+nameLen));entries[name]={method,compSize,localOffset};p+=46+nameLen+extraLen+commentLen}return entries}
async function zipRead(b,e,name){let x=e[name];if(!x)throw new Error('Aba/arquivo interno não encontrado: '+name);let p=x.localOffset;if(zipU32(b,p)!==0x04034b50)throw new Error('ZIP inválido.');let nameLen=zipU16(b,p+26),extraLen=zipU16(b,p+28),start=p+30+nameLen+extraLen,raw=b.slice(start,start+x.compSize);if(x.method===0)return raw;if(x.method===8){let ds=new DecompressionStream('deflate-raw');return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer())}throw new Error('Método de compressão não suportado pelo navegador.')} 
function xmlText(el){return el?el.textContent||'':''}
function colIndex(ref){let m=String(ref||'').match(/[A-Z]+/i);if(!m)return 0;let n=0;for(let c of m[0].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
function excelDate(v){if(v===''||v==null)return null;if(typeof v==='number' || /^-?\d+(\.\d+)?$/.test(String(v))){let serial=Number(v);if(!Number.isFinite(serial))return null;let d=new Date(Date.UTC(1899,11,30)+serial*86400000);return d.toISOString().slice(0,10)}let d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function normalizeHeader(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase()}
async function parseXLSX(file,preferredSheet='LANCAMENTOS'){
let b=new Uint8Array(await file.arrayBuffer()),entries=zipEntries(b),decoder=new TextDecoder('utf-8');
let shared=[];
if(entries['xl/sharedStrings.xml']){
  let x=new DOMParser().parseFromString(decoder.decode(await zipRead(b,entries,'xl/sharedStrings.xml')),'application/xml');
  for(let si of Array.from(x.getElementsByTagName('si'))) shared.push(Array.from(si.getElementsByTagName('t')).map(xmlText).join(''));
}

/* Descobre a planilha pelo nome no workbook, em vez de assumir a ordem dos arquivos ZIP.
   Isso é importante porque o Excel pode armazenar sheet4.xml antes de sheet1.xml. */
let sheetName='';
if(entries['xl/workbook.xml'] && entries['xl/_rels/workbook.xml.rels']){
  let wbXml=new DOMParser().parseFromString(decoder.decode(await zipRead(b,entries,'xl/workbook.xml')),'application/xml');
  let relXml=new DOMParser().parseFromString(decoder.decode(await zipRead(b,entries,'xl/_rels/workbook.xml.rels')),'application/xml');
  let targetRel='';
  for(let sh of Array.from(wbXml.getElementsByTagName('sheet'))){
    let name=String(sh.getAttribute('name')||'').trim();
    if(normalizeHeader(name)===normalizeHeader(preferredSheet)){
      let rid=sh.getAttribute('r:id')||sh.getAttribute('id')||'';
      for(let rel of Array.from(relXml.getElementsByTagName('Relationship'))){
        if((rel.getAttribute('Id')||'')===rid){targetRel=rel.getAttribute('Target')||'';break}
      }
      break;
    }
  }
  if(targetRel){
    targetRel=targetRel.replace(/^\/+/, '');
    sheetName=targetRel.startsWith('xl/')?targetRel:('xl/'+targetRel.replace(/^\.\//,''));
  }
}
if(!sheetName || !entries[sheetName]){
  sheetName=Object.keys(entries).find(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k));
}
if(!sheetName) throw new Error('Não encontrei a aba '+preferredSheet+' dentro do Excel.');

let x=new DOMParser().parseFromString(decoder.decode(await zipRead(b,entries,sheetName)),'application/xml');
let rows=[];
for(let row of Array.from(x.getElementsByTagName('row'))){
  let cells=[];
  for(let c of Array.from(row.getElementsByTagName('c'))){
    let ref=c.getAttribute('r')||'',idx=colIndex(ref),t=c.getAttribute('t')||'',v='';
    if(t==='inlineStr') v=Array.from(c.getElementsByTagName('t')).map(xmlText).join('');
    else {let ve=c.getElementsByTagName('v')[0];v=xmlText(ve)}
    if(t==='s') v=shared[Number(v)]??'';
    else if(t==='b') v=v==='1';
    cells[idx]=v;
  }
  rows.push(cells);
}
let headerRow=rows.find(r=>r.some(v=>['CLIENTE','CODIGO SISTEMA','DESCRICAO DO ITEM'].includes(normalizeHeader(v))));
if(!headerRow) throw new Error('Não encontrei a linha de cabeçalho da aba LANÇAMENTOS.');
let headerIndex=rows.indexOf(headerRow),headers=headerRow.map(v=>String(v??'')),out=[];
for(let ri=headerIndex+1;ri<rows.length;ri++){
  let arr=rows[ri];
  if(!arr || !arr.some(v=>String(v??'').trim()!=='')) continue;
  let raw={};
  headers.forEach((h,i)=>{if(h)raw[h]=arr[i]??''});raw['__FIRST_COLUMN__']=arr[0]??'';
  if(!String(arr[0]??'').trim()) continue;
  out.push(raw);
}
return out;
}
function mapImportedRow(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  let norm={};
  Object.entries(raw).forEach(([k,v])=>norm[normalizeHeader(k)]=v);
  let r={};
  r[cols.cliente]=norm['CLIENTE']??null;
  r[cols.codigo]=norm['CODIGO SISTEMA']??null;
  r[cols.produto]=norm['DESCRICAO DO PRODUTO']??null;
  r[cols.of]=norm['OF']??null;
  r[cols.quantidade]=norm['QUANTIDADE']??null;
  r[cols.pesoArvore]=norm['PESO ARVORE']??null;
  r[cols.pesoCanal]=norm['PESO UNITARIO BRUTO']??null;
  r[cols.kgArvore]=norm['PESO BRUTO FRACIONADO = REFUGO GERADO']??null;
  r[cols.kgRefugo]=norm['PESO BRUTO FRACIONADO = REFUGO GERADO']??null;
  r[cols.motivo]=norm['MOTIVO DO REFUGO']??null;
  r[cols.descricaoMotivo]=norm['DESCRICAO DO MOTIVO']??null;
  r[cols.planta]=norm['PLANTA']??null;
  r[cols.data]=excelDate(norm['DATA QUE REFUGOU']??'');
  r[cols.responsavel]=norm['RESPONSAVEL PELA ETIQUETA']??null;
  r[cols.observacao]=norm['OBSERVACAO']??null;
  r[cols.produzidoKg]=null;
  r[cols.custoKg]=null;
  r.__importadoExcel=true;
  r.__dadosOriginais=raw;
  return r;
}
function productNumber(v){
  if(v==null || String(v).trim()==='') return null;
  let raw=String(v).trim().replace(/\s/g,'').replace(',','.');
  let n=Number(raw);
  return Number.isFinite(n)&&n>=0?n:null;
}
function firstNonEmpty(...vals){for(const v of vals){if(v!=null && String(v).trim()!=='')return v}return null}
function mapImportedProduct(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  let norm={};Object.entries(raw).forEach(([k,v])=>norm[normalizeHeader(k)]=v);
  const code=firstNonEmpty(norm['__FIRST_COLUMN__'],norm['CODIGO SISTEMA'],norm['N X']);
  const desc=firstNonEmpty(norm['DESCRICAO DO ITEM'],norm['DESCRICAO DO PRODUTO']);
  if(!desc && !code) return null;
  return {
    cliente:'',
    codigo:code==null?'':String(code).trim(),
    descricao:desc==null?'':String(desc).trim(),
    planta:firstNonEmpty(norm['PLANTA'],'')||'',
    material:firstNonEmpty(norm['MATERIAL'],'')||'',
    pesoPrincipal:productNumber(norm['PESO BRUTO FRACIONADO']),
    pesoArvore:productNumber(norm['PESO ARVORE']),
    pesoFundUsin:productNumber(norm['PESO LIQUIDO DA FUNDICAO E BRUTO DA USINAGEM (FRACIONADO)']),
    pesoUsinado:productNumber(norm['PESO USINADO']),
    _origemExcel:true
  };
}
async function importProdutosExcel(mode){
  const input=document.getElementById('produtoExcelImport'),status=document.getElementById('produtoExcelStatus');
  if(!input?.files?.[0]){status.textContent='Escolha primeiro a planilha Excel da aba CADASTRO.';status.className='small import-status error';return}
  status.textContent='Lendo a aba CADASTRO...';status.className='small import-status';
  try{
    const raw=await parseXLSX(input.files[0],'CADASTRO');
    const imported=raw.map(mapImportedProduct).filter(x=>x&&x.descricao);
    if(!imported.length) throw new Error('A aba CADASTRO foi encontrada, mas nenhum produto válido foi localizado.');
    const key=x=>String(x.codigo||'').trim()+'|'+String(x.descricao||'').trim().toUpperCase();
    const map=new Map();
    if(mode==='merge') (cadastros.pecas||[]).forEach(x=>map.set(key(x),x));
    imported.forEach(x=>{
      const k=key(x),old=map.get(k);
      const nx={};Object.keys(x).forEach(f=>{if(x[f]!==null&&x[f]!==undefined&&x[f]!=='')nx[f]=x[f]});
      map.set(k,old?{...old,...nx,cliente:old.cliente||'',_origemExcel:true}:{...x});
    });
    cadastros.pecas=[...map.values()];
    cadastros.pecas.sort((a,b)=>String(a.descricao||'').localeCompare(String(b.descricao||''),'pt-BR'));
    saveCad();renderCadastro();
    status.textContent=`Cadastro atualizado: ${imported.length.toLocaleString('pt-BR')} produtos lidos da planilha (${cadastros.pecas.length.toLocaleString('pt-BR')} no cadastro).`;
    status.className='small import-status ok';
    alert(status.textContent);
  }catch(err){
    console.error(err);status.textContent='Erro ao importar cadastro: '+(err?.message||err);status.className='small import-status error';alert(status.textContent);
  }
}
async function importExcel(mode){
  let input=document.getElementById('excelImport'),status=document.getElementById('excelStatus');
  if(!input?.files?.[0]){status.textContent='Escolha primeiro uma planilha Excel (.xlsx).';status.className='small import-status error';return}
  let file=input.files[0];
  status.textContent='Lendo '+file.name+'...';status.className='small import-status';
  try{
    let raw=await parseXLSX(file);
    let imported=raw.map(x=>mapImportedRow(x)).filter(r=>r && (String(val(r,'cliente')).trim()||String(val(r,'codigo')).trim()||String(val(r,'of')).trim()||String(val(r,'data')).trim()));
    if(!imported.length)throw new Error('A aba LANÇAMENTOS foi encontrada, mas nenhum registro com CLIENTE, CÓDIGO SISTEMA, OF ou DATA foi localizado.');
    if(mode==='replace') data=imported; else data=(Array.isArray(data)?data:[]).concat(imported);
    data=data.filter(r=>r && typeof r==='object');
    save();
    refresh();
    status.textContent=`Importação concluída: ${imported.length.toLocaleString('pt-BR')} lançamentos ${mode==='replace'?'carregados no histórico':'adicionados à base'}.`;
    status.className='small import-status ok';
    alert(status.textContent);
  }catch(err){
    console.error(err);
    status.textContent='Erro ao importar: '+(err?.message||err);
    status.className='small import-status error';
    alert(status.textContent);
  }
}
function backup(){let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-refugos-2026.json';a.click()}
document.querySelectorAll('input[id="restore"]').forEach(function(__r){__r.addEventListener('change',e=>{let f=e.target.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{try{data=JSON.parse(rd.result);save();refresh();alert('Backup restaurado.')}catch{alert('Arquivo inválido.')}};rd.readAsText(f)})});
function exportCSV(){let headers=Object.values(cols);let lines=[headers,...data.map(r=>headers.map(h=>String(r[h]??'').replaceAll('"','""')))];let csv=lines.map(row=>row.map(x=>`"${x}"`).join(';')).join('\\n');let blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='refugos-2026.csv';a.click()}

// Integração do modo online ao salvamento local existente.
const __saveOriginal=save;
save=function(){__saveOriginal();scheduleFirebasePush()};
const __saveCadOriginal=saveCad;
saveCad=function(){__saveCadOriginal();scheduleFirebasePush()};
const __saveProducaoOriginal=saveProducao;
saveProducao=function(){__saveProducaoOriginal();scheduleFirebasePush()};
document.getElementById('data')?.addEventListener('input',atualizarDataDisplay);document.getElementById('data')?.addEventListener('change',atualizarDataDisplay);document.getElementById('data')?.addEventListener('blur',atualizarDataDisplay);

let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const active=document.querySelector('.page.active')?.id;if(active==='dashboard')dashboard();else if(active==='dashboardQtd')dashboardQtd();},140)});clearProducaoForm();clearForm();atualizarDataDisplay();initTheme();bindGlobalPopoverClose();bindQMotivoPopoverGlobal();refresh();

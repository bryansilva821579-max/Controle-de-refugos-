/* Service worker do Controle de Refugos: rede primeiro, cache só como reserva offline.
   Não intercepta Firebase nem nada de outro domínio, então sincronização e atualizações seguem normais. */
const CACHE='refugos-pwa-v208';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const ehVersao=url.pathname.endsWith('/version.json');
  e.respondWith(
    fetch(req,ehVersao?{cache:'no-store'}:undefined).then(res=>{
      if(res&&res.ok&&!ehVersao){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp)).catch(()=>{});}
      return res;
    }).catch(()=>caches.match(req).then(r=>r||caches.match(req,{ignoreSearch:true})).then(r=>r||(req.mode==='navigate'?caches.match('index.html',{ignoreSearch:true}):undefined)))
  );
});

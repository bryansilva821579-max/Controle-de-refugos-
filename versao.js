/* ==================================================================
   AVISO DE NOVA VERSÃO
   Compara window.APP_VERSION com version.json.
   ================================================================== */

/* Aviso de nova versão: compara window.APP_VERSION com version.json */
(function(){
  async function check(){
    try{
      var r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      var j=await r.json();
      if(j.version&&j.version!==window.APP_VERSION&&!document.getElementById('newVerBar')){
        var b=document.createElement('div');b.id='newVerBar';
        b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0b5ed7;color:#fff;padding:12px;text-align:center;font:14px Arial;cursor:pointer';
        b.textContent='Nova versão disponível ('+j.version+'). Toque aqui para atualizar.';
        b.onclick=function(){location.href=location.pathname+'?v='+Date.now()};
        document.body.appendChild(b);
      }
    }catch(e){}
  }
  window.addEventListener('load',function(){setTimeout(check,3000);setInterval(check,300000)});
})();

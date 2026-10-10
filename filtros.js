/* ==================================================================
   FILTROS
   Seleção múltipla de plantas (dashboards e Reunião).
   ================================================================== */
/* ===== Filtro de planta com seleção múltipla ===== */
function msGet(id){var s=document.getElementById(id);if(!s)return[];try{return JSON.parse(s.dataset.multi||'[]')}catch(e){return[]}}
function msSet(id,arr){var s=document.getElementById(id);if(!s)return;s.dataset.multi=JSON.stringify(arr||[]);msLabel(id)}
function plSel(id){return msGet(id).map(function(v){return plantNormName(v)}).filter(Boolean)}
function plHas(L,p){return !L.length||L.indexOf(p)>=0}
function plLbl(pl){return String(pl||'').split('|').filter(Boolean).join(' + ')}
function msLabel(id){var w=document.getElementById(id+'Ms'),s=document.getElementById(id);if(!w||!s)return;var c=msGet(id),tx=c.map(function(v){var o=[].slice.call(s.options).filter(function(x){return x.value===v})[0];return o?(o.text||v):v});w.querySelector('.ms-btn').textContent=(tx.length?tx.join(' + '):'Todas as plantas')+' ▾'}
function msInit(id){var s=document.getElementById(id);if(!s||s.__ms)return;s.__ms=1;s.style.display='none';
var w=document.createElement('div');w.className='ms';w.id=id+'Ms';w.innerHTML='<button type="button" class="ms-btn"></button><div class="ms-panel"></div>';s.parentNode.insertBefore(w,s.nextSibling);
var btn=w.querySelector('.ms-btn'),pn=w.querySelector('.ms-panel');
function build(){var cur=msGet(id),op=[].slice.call(s.options).filter(function(o){return o.value});pn.innerHTML='<label class="ms-it"><input type="checkbox" data-all="1" '+(cur.length?'':'checked')+'> <b>Todas as plantas</b></label>'+op.map(function(o){return '<label class="ms-it"><input type="checkbox" value="'+esc(o.value)+'" '+(cur.indexOf(o.value)>=0?'checked':'')+'> '+esc(o.text||o.value)+'</label>'}).join('')}
btn.addEventListener('click',function(e){e.stopPropagation();var o=w.classList.toggle('open');if(o)build()});
pn.addEventListener('change',function(e){var v=e.target.dataset.all?[]:[].slice.call(pn.querySelectorAll('input[value]:checked')).map(function(i){return i.value});msSet(id,v);var cu=msGet(id);[].forEach.call(pn.querySelectorAll('input'),function(i){i.checked=i.dataset.all?!cu.length:cu.indexOf(i.value)>=0});s.dispatchEvent(new Event('change'))});
document.addEventListener('click',function(e){if(!w.contains(e.target))w.classList.remove('open')});msLabel(id)}
function msBoot(){['filterPlant','qFilterPlant','reuPl'].forEach(msInit)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',msBoot);else msBoot();

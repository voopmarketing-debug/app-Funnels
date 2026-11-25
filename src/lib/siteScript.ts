import { createHash } from "node:crypto";

// The one script the public pages run. It is a fixed text (nothing from the
// business's content ever goes inside it), allowed in the page's
// Content-Security-Policy by its SHA-256 hash, so any other script is still
// blocked. Every piece is progressive enhancement: the blocks read their
// data from data-* attributes and the page is complete and readable without it.
//
// Pieces: reveal-on-scroll (.rv), monthly countdown ([data-countdown]), 3D tilt
// and glow ([data-tilt]), the drag-to-rotate product viewer ([data-showroom]),
// the budget quoter ([data-quoter]) and the draggable fan ([data-fan]).
export const SITE_SCRIPT = `(function(){
var d=document,root=d.documentElement;
var reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var fxOff=root.getAttribute('data-fx')==='off';
function $(s,c){return Array.prototype.slice.call((c||d).querySelectorAll(s));}
function pad(n){return n<10?'0'+n:''+n;}
function money(v,cur){v=Math.round(v);return cur==='USD'?'US$'+v.toLocaleString('en-US'):cur==='EUR'?'\\u20ac'+v.toLocaleString('de-DE'):'$'+v.toLocaleString('es-CO');}
root.className+=' js';
window.addEventListener('message',function(e){
  var m=e.data;if(!m||typeof m!=='object')return;
  if(typeof m.flHtmlH==='number'){
    $('iframe[data-autoheight]').forEach(function(f){if(f.contentWindow===e.source)f.style.height=Math.min(4000,Math.max(40,Math.ceil(m.flHtmlH)))+'px';});
    return;
  }
  var L=m.flLead;if(!L||typeof L!=='object')return;
  var fr=$('iframe[data-htmlframe]').filter(function(x){return x.contentWindow===e.source;})[0];if(!fr)return;
  var src=fr.getAttribute('src')||'',base=src.split('/bloque/')[0],pv=src.indexOf('preview=1')>-1;
  var fd=new FormData();fd.append('name',String(L.name||'').slice(0,120));fd.append('contact',String(L.contact||'').slice(0,120));fd.append('message',String(L.message||'').slice(0,500));
  function reply(ok){try{fr.contentWindow.postMessage({flLeadResult:ok},'*');}catch(x){}}
  fetch(base+'/registro'+(pv?'?preview=1':''),{method:'POST',body:fd,redirect:'manual'}).then(function(r){reply(r.type==='opaqueredirect'||r.ok);}).catch(function(){reply(false);});
});
var MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
$('[data-month]').forEach(function(n){n.textContent=MONTHS[new Date().getMonth()];});
d.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('[data-view]'):null;if(!a)return;
  var t=d.querySelector('[data-showroom] [data-pid="'+a.getAttribute('data-view')+'"]');
  if(t)t.click();
});

if(!reduce&&!fxOff&&'IntersectionObserver' in window){
  var vh=window.innerHeight||800;
  var els=$('.rv').filter(function(e){return e.getBoundingClientRect().top>vh*0.92;});
  els.forEach(function(e){e.classList.add('rv-hide');});
  var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.remove('rv-hide');x.target.classList.add('rv-in');io.unobserve(x.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:0.05});
  els.forEach(function(e){io.observe(e);});
}

$('[data-countdown]').forEach(function(box){
  var parts={};
  $('[data-cd]',box).forEach(function(n){parts[n.getAttribute('data-cd')]=n;});
  function tick(){
    var n=new Date(),u=box.getAttribute('data-until'),end=u?Date.parse(u):new Date(n.getFullYear(),n.getMonth()+1,1).getTime()-1;if(isNaN(end))end=n.getTime();
    var s=Math.floor(Math.max(0,end-n.getTime())/1000);
    var v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};
    for(var k in v){if(parts[k])parts[k].textContent=pad(v[k]);}
  }
  tick();setInterval(tick,1000);
});

if(!reduce){
  $('[data-tilt]').forEach(function(el){
    el.addEventListener('pointermove',function(e){
      if(e.pointerType==='touch')return;
      var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      el.style.setProperty('--rx',(-y*8).toFixed(2)+'deg');
      el.style.setProperty('--ry',(x*10).toFixed(2)+'deg');
      el.style.setProperty('--mx',((x+.5)*100).toFixed(1)+'%');
      el.style.setProperty('--my',((y+.5)*100).toFixed(1)+'%');
    });
    el.addEventListener('pointerleave',function(){
      el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');
    });
  });
}

$('[data-showroom]').forEach(function(box){
  var stages=$('[data-stage]',box),thumbs=$('[data-thumb]',box),infos=$('[data-info]',box),facts=$('[data-facts]',box);
  var viewer=box.querySelector('[data-viewer]');
  var cur=0,angle=0,frame=0;
  function show(list,attr,i){list.forEach(function(e){var on=+e.getAttribute(attr)===i;e.classList.toggle('on',on);if(on)e.removeAttribute('hidden');else e.setAttribute('hidden','');});}
  function select(i){
    cur=i;angle=0;
    var im0=stages.filter(function(x){return +x.getAttribute('data-stage')===i;})[0],imf=im0&&im0.querySelector('img'),frs=imf&&imf.getAttribute('data-frames');
    if(frs&&frame!==0){imf.src=frs.split('|')[0];}
    frame=0;
    show(stages,'data-stage',i);show(infos,'data-info',i);show(facts,'data-facts',i);
    thumbs.forEach(function(t){var on=+t.getAttribute('data-thumb')===i;t.classList.toggle('on',on);t.setAttribute('aria-pressed',on?'true':'false');});
    paint(false);
  }
  function setFrame(img,list,f){if(f!==frame){frame=f;img.src=list[f];}}
  function preload(){stages.forEach(function(st){var im=st.querySelector('img'),fr=im&&im.getAttribute('data-frames');if(fr&&!im.__pre){im.__pre=1;fr.split('|').forEach(function(u){var x=new Image();x.src=u;});}});}
  function active(){return stages.filter(function(s){return +s.getAttribute('data-stage')===cur;})[0];}
  function paint(drag){
    var s=active();if(!s)return;
    var img=s.querySelector('img');if(!img)return;
    img.style.transition=drag?'none':'transform .5s cubic-bezier(.2,.8,.2,1)';
    img.style.transform='perspective(900px) rotateY('+angle.toFixed(1)+'deg)';
  }
  thumbs.forEach(function(t){t.addEventListener('click',function(){select(+t.getAttribute('data-thumb'));});});
  if(viewer){
    var down=null;
    viewer.addEventListener('pointerenter',preload);
    viewer.addEventListener('pointerdown',function(e){preload();down={x:e.clientX,a:angle,f:frame};try{viewer.setPointerCapture(e.pointerId);}catch(x){}viewer.classList.add('drag');});
    viewer.addEventListener('pointermove',function(e){
      if(!down)return;
      var dx=e.clientX-down.x,s=active(),img=s&&s.querySelector('img'),frames=img&&img.getAttribute('data-frames');
      if(frames){
        var list=frames.split('|'),unit=Math.max(12,viewer.clientWidth/list.length*1.1);
        setFrame(img,list,((down.f-Math.round(dx/unit))%list.length+list.length)%list.length);
      }else{
        angle=Math.max(-20,Math.min(20,down.a+dx*0.18));paint(true);
      }
    });
    function up(){down=null;viewer.classList.remove('drag');if(!reduce){var s=active(),img=s&&s.querySelector('img');if(img&&!img.getAttribute('data-frames')){angle=0;paint(false);}}}
    viewer.addEventListener('pointerup',up);viewer.addEventListener('pointercancel',up);
    viewer.addEventListener('keydown',function(e){
      var s=active(),img=s&&s.querySelector('img'),fr=img&&img.getAttribute('data-frames'),n=thumbs.length||1;
      if(fr){var list=fr.split('|');if(e.key==='ArrowRight'){preload();setFrame(img,list,(frame+1)%list.length);}if(e.key==='ArrowLeft'){preload();setFrame(img,list,(frame-1+list.length)%list.length);}return;}
      if(e.key==='ArrowRight')select((cur+1)%n);
      if(e.key==='ArrowLeft')select((cur-1+n)%n);
    });
  }
  if('IntersectionObserver' in window){
    var o=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){box.classList.add('in');o.disconnect();}});},{threshold:0.25});
    o.observe(box);
  }else{box.classList.add('in');}
  select(0);
});

$('[data-quoter]').forEach(function(q){
  var range=q.querySelector('input[type=range]'),cur=q.getAttribute('data-cur')||'COP',months=+q.getAttribute('data-months')||48;
  var modeBtns=$('[data-mode]',q),rows=$('[data-qprice]',q);
  var out=q.querySelector('[data-qbudget]'),count=q.querySelector('[data-qcount]'),unit=q.querySelector('[data-qunit]');
  var mode='total';
  function num(a){return +q.getAttribute(a)||0;}
  function setMode(m){
    mode=m;
    modeBtns.forEach(function(b){var on=b.getAttribute('data-mode')===m;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
    var lo=m==='total'?num('data-tmin'):num('data-cmin'),hi=m==='total'?num('data-tmax'):num('data-cmax');
    range.min=lo;range.max=hi;range.step=Math.max(1,Math.round((hi-lo)/200));
    range.value=Math.round(lo+(hi-lo)*0.55);
    if(unit)unit.textContent=m==='total'?'Tu presupuesto total':'Tu cuota mensual ('+months+' meses)';
    render();
  }
  function render(){
    var b=+range.value,ok=0;
    if(out)out.textContent=money(b,cur)+(mode==='cuota'?' /mes':'');
    rows.forEach(function(r){
      var price=+r.getAttribute('data-qprice'),cost=mode==='total'?price:price/months;
      var fit=cost<=b,pct=Math.min(100,Math.round(cost/b*100)),diff=Math.abs(b-cost);
      if(fit)ok++;
      r.classList.toggle('fit',fit);r.classList.toggle('nofit',!fit);
      var bar=r.querySelector('[data-qbar]'),st=r.querySelector('[data-qstate]'),c=r.querySelector('[data-qcost]');
      if(bar)bar.style.width=pct+'%';
      if(c)c.textContent=money(cost,cur)+(mode==='cuota'?' /mes':'');
      if(st)st.textContent=fit?'Te alcanza, te sobran '+money(diff,cur):'Te faltan '+money(diff,cur);
    });
    if(count)count.textContent=ok+' de '+rows.length+' te alcanzan';
  }
  modeBtns.forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-mode'));});});
  range.addEventListener('input',render);
  setMode('total');
});

$('[data-traveler]').forEach(function(t){
  var stage=t.querySelector('.tv-stage'),prod=t.querySelector('.tv-product'),scenes=$('[data-tvs]',t),n=scenes.length;
  if(!stage||!prod||n<2)return;
  var KF=[[68,50,1,-10],[30,52,.86,8],[66,54,1.06,-4],[34,48,.92,-7]];
  var on=false,tick=false;
  function update(){
    tick=false;if(!on)return;
    var r=t.getBoundingClientRect(),total=r.height-stage.offsetHeight;
    var prog=total>0?Math.min(1,Math.max(0,(68-r.top)/total)):0,p=prog*(n-1);
    var i=Math.min(n-2,Math.floor(p)),f=p-i;f=f*f*(3-2*f);
    var a=KF[Math.min(i,3)],b=KF[Math.min(i+1,3)];
    prod.style.left=(a[0]+(b[0]-a[0])*f).toFixed(2)+'%';
    prod.style.top=(a[1]+(b[1]-a[1])*f).toFixed(2)+'%';
    prod.style.transform='translate(-50%,-50%) scale('+(a[2]+(b[2]-a[2])*f).toFixed(3)+') rotate('+(a[3]+(b[3]-a[3])*f).toFixed(2)+'deg)';
    scenes.forEach(function(sc,k){sc.style.setProperty('--o',Math.max(0,1-Math.abs(p-k)*1.7).toFixed(3));});
  }
  function request(){if(!tick){tick=true;requestAnimationFrame(update);}}
  function check(){
    var want=!reduce&&window.innerWidth>=900;
    if(want===on)return;
    on=want;t.classList.toggle('tv-on',on);
    if(on)update();else{prod.removeAttribute('style');scenes.forEach(function(sc){sc.style.removeProperty('--o');});}
  }
  window.addEventListener('scroll',request,{passive:true});
  window.addEventListener('resize',function(){check();request();});
  check();
});

$('[data-fan]').forEach(function(f){
  var cards=$('[data-fcard]',f),n=cards.length,pos=0,down=null,timer=null,moved=false;
  if(n<2)return;
  f.classList.add('fan-on');
  var infos=$('[data-finfo]',f);
  function layout(drag){
    var step=Math.min(15,70/Math.max(n-1,1));
    cards.forEach(function(c,i){
      var rel=(((i-pos)%n)+n)%n;if(rel>n/2)rel-=n;
      var far=Math.abs(rel)>3;
      c.style.transition=drag?'none':'transform .6s cubic-bezier(.2,.8,.2,1),opacity .6s';
      c.style.transform='translateX(-50%) rotate('+(rel*step).toFixed(2)+'deg)';
      c.style.zIndex=String(100-Math.round(Math.abs(rel)*10));
      c.style.opacity=far?'0':'1';
      c.style.pointerEvents=far?'none':'auto';
      c.classList.toggle('mid',Math.round(rel)===0);
    });
  }
  function settle(){
    var mid=((Math.round(pos)%n)+n)%n;
    infos.forEach(function(e){var on=+e.getAttribute('data-finfo')===mid;e.classList.toggle('on',on);if(on)e.removeAttribute('hidden');else e.setAttribute('hidden','');});
  }
  function go(to){pos=to;layout(false);settle();}
  function stop(){if(timer){clearInterval(timer);timer=null;}}
  function start(){if(reduce||timer)return;timer=setInterval(function(){go(Math.round(pos)+1);},3200);}
  f.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('a,button,[role=tab]'))return;down={x:e.clientX,p:pos,id:e.pointerId,cap:false};moved=false;stop();});
  f.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-down.x;if(Math.abs(dx)>4){moved=true;if(!down.cap){down.cap=true;try{f.setPointerCapture(down.id);}catch(x){}}}if(moved){pos=down.p-dx/130;layout(true);}});
  function up(){if(!down)return;var was=moved;down=null;if(was)go(Math.round(pos));else start();}
  f.addEventListener('pointerup',up);f.addEventListener('pointercancel',up);
  cards.forEach(function(c,i){c.addEventListener('click',function(){if(moved)return;stop();var rel=(((i-pos)%n)+n)%n;if(rel>n/2)rel-=n;go(Math.round(pos)+Math.round(rel));});});
  $('[data-ftab]',f).forEach(function(t){t.addEventListener('click',function(){
    var k=t.getAttribute('data-ftab');
    $('[data-ftab]',f).forEach(function(x){var on=x===t;x.classList.toggle('on',on);x.setAttribute('aria-selected',on?'true':'false');});
    $('[data-fpane]',f).forEach(function(p){if(p.getAttribute('data-fpane')===k)p.removeAttribute('hidden');else p.setAttribute('hidden','');});
  });});
  f.addEventListener('mouseenter',stop);f.addEventListener('mouseleave',start);
  layout(false);settle();start();
});
})();`;

/** Hash for the page's Content-Security-Policy (`script-src 'sha256-…'`). */
export const SITE_SCRIPT_HASH = createHash("sha256").update(SITE_SCRIPT).digest("base64");

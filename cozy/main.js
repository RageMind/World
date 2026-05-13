const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
let W=0,H=0,DPR=1,t=0,last=performance.now();
const TW=64,TH=32,mapW=24,mapH=19;
const cam={x:0,y:0,z:1,drag:false,lx:0,ly:0,lock:false,moved:false};
let currentTool='hand';
const tiles=[],ground=[],paths=[],structures=[],flora=[],chars=[];
let tileDraw=[],groundDraw=[],pathsDraw=[],structuresDraw=[],floraDraw=[];
const base='assets/kenney/isometric-landscape/png/';
const art={loaded:false,solidGrass:null,solidWater:null,solidShore:null};
const skins=['#d89a67','#e4b17a','#c98756','#f0c18a','#b8754c'];
const hairs=['#241713','#3b2419','#6b3e23','#1a1411','#8b5a2b'];
const shirts=['#9f5638','#d7bd69','#ead9b2','#3d3933','#c1843f','#8f4f37'];
const pants=['#2b2722','#1f2a2d','#3a2a20','#202020'];
const waypoints=[
 {x:11.35,y:10.05},{x:12.95,y:10.05},{x:13.15,y:10.95},
 {x:12.2,y:11.35},{x:11.25,y:10.85},{x:12.15,y:9.45}
];

async function loadKenney(){
 try{
  const list=await fetch('assets/kenney/isometric-landscape/manifest.json?v=anim1').then(r=>r.json());
  const names=list.filter(n=>/^landscapeTiles_\d+\.png$/.test(n));
  const loaded=await Promise.all(names.map(n=>new Promise(res=>{const im=new Image();im.onload=()=>res({n,img:im});im.onerror=()=>res(null);im.src=base+n+'?v=anim1'})));
  const tmp=document.createElement('canvas'),tc=tmp.getContext('2d',{willReadFrequently:true});
  const grass=[],water=[],shore=[];
  for(const o of loaded.filter(Boolean)){
   const im=o.img;if(im.height>110)continue;tmp.width=im.width;tmp.height=im.height;tc.clearRect(0,0,tmp.width,tmp.height);tc.drawImage(im,0,0);
   const d=tc.getImageData(0,0,tmp.width,tmp.height).data;let r=0,g=0,b=0,c=0;
   for(let i=0;i<d.length;i+=16)if(d[i+3]>30){r+=d[i];g+=d[i+1];b+=d[i+2];c++}
   if(!c)continue;r/=c;g/=c;b/=c;
   o.score={green:g-r*.45-b*.35,blue:b-r*.45,shore:r+g-b*1.55};
   if(b>r*.95&&b>g*.75)water.push(o);
   if(r>115&&g>90&&b<120)shore.push(o);
   if(g>95&&g>=r*.78&&g>b*1.05&&o.score.blue<70)grass.push(o);
  }
  grass.sort((a,b)=>b.score.green-a.score.green);water.sort((a,b)=>b.score.blue-a.score.blue);shore.sort((a,b)=>b.score.shore-a.score.shore);
  art.solidGrass=grass[0]?.img||null;art.solidWater=water[0]?.img||null;art.solidShore=shore[0]?.img||null;
  art.loaded=!!(art.solidGrass&&art.solidWater&&art.solidShore);
 }catch(e){console.warn('Kenney assets not loaded',e)}
}
loadKenney();

function hash(x,y,s=0){let n=x*374761393+y*668265263+s*1442695041;n=(n^(n>>13))*1274126177;return((n^(n>>16))>>>0)/4294967295}
function rnd(a,b,x=1,y=1,s=0){return a+hash(x,y,s)*(b-a)}
function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth*DPR|0;H=innerHeight*DPR|0;if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;if(!cam.lock){cam.z=innerWidth<700?.82:1.06;cam.x=innerWidth<700?innerWidth*.5:innerWidth*.52;cam.y=innerWidth<700?245:140}}}
function iso(x,y,z=0){return{x:(x-y)*TW/2,y:(x+y)*TH/2-z}}
function invIso(px,py){const sx=px/(DPR*cam.z)-cam.x/(cam.z*DPR)+40;const sy=py/(DPR*cam.z)-cam.y/(cam.z*DPR)+18;return{x:sy/TH+sx/TW,y:sy/TH-sx/TW}}
function tileAt(x,y){return tiles.find(q=>q.x===x&&q.y===y)}
function isWater(x,y){const q=tileAt(x,y);return !q||q.type==='water'}
function nearWater(x,y){for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if(isWater(x+xx,y+yy))return true;return false}
function near(x,y,px,py,r){return Math.hypot(x-px,y-py)<r}
function blocked(x,y){return near(x,y,12.2,10.5,1.85)||near(x,y,11.62,10.05,1.0)||near(x,y,12.75,10.1,1.0)}
function add(list,kind,x,y,s=1,d=0){list.push({kind,x,y,s,depth:d||x+y+.7})}
function islandValue(x,y){const cx=mapW/2-.2,cy=mapH/2+.1;const dx=(x-cx)/10.8,dy=(y-cy)/7.85;return Math.sqrt(dx*dx+dy*dy)+(hash(Math.floor(x/3),Math.floor(y/3),401)-.5)*.08}
function sortStatic(){tileDraw=tiles.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y));groundDraw=ground.slice().sort((a,b)=>a.depth-b.depth);pathsDraw=paths.slice().sort((a,b)=>a.depth-b.depth);structuresDraw=structures.slice().sort((a,b)=>a.depth-b.depth);floraDraw=flora.slice().sort((a,b)=>a.depth-b.depth)}
function choosePoint(i){return waypoints[(i+(t/120|0))%waypoints.length]}
function setCard(title,text){const a=document.getElementById('card-title'),b=document.getElementById('card-text');if(a)a.textContent=title;if(b)b.textContent=text}
function objectLabel(o){if(o.kind==='tree')return ['Tree','Дерево. Позже жители смогут рубить его и получать wood.'];if(o.kind==='rock')return ['Stone','Камень. Позже жители смогут добывать stone.'];if(o.kind==='bush')return ['Berry bush','Куст с ягодами. Позже будет давать food.'];if(o.kind==='pebble')return ['Pebble','Маленький камень у берега.'];if(o.kind==='camp')return ['Campfire','Стартовый костёр. Жители собираются вокруг него.'];return ['Object',o.kind||'unknown']}
function selectAt(clientX,clientY){if(currentTool!=='hand')return;const p=invIso(clientX*DPR,clientY*DPR);let best=null,dist=1e9,type='';for(let i=0;i<chars.length;i++){const ch=chars[i],d=Math.hypot(ch.x-p.x,ch.y-p.y);if(d<.65&&d<dist){best=ch;dist=d;type='person'}}for(const o of [...structures,...flora]){const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<.75&&d<dist){best=o;dist=d;type='object'}}if(type==='person'){const state=best.mode==='walk'?'идёт':'стоит';setCard('Villager','Житель: '+state+'. Сейчас просто живёт около костра.')}else if(type==='object'){const [a,b]=objectLabel(best);setCard(a,b)}else{const tx=Math.floor(p.x),ty=Math.floor(p.y),q=tileAt(tx,ty);setCard('Tile',q?('Клетка '+tx+','+ty+' · '+q.type):'Пусто за пределами карты')}}

function init(){
 for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++){
  const v=islandValue(x,y);let type=v>.98?'water':v>.83?'shore':'grass';
  if(type==='grass'&&hash(x,y,4)<.035)type='flower';if(type==='grass'&&hash(x,y,5)<.03)type='bushTile';
  tiles.push({x,y,type,h:type==='water'?-5:type==='shore'?-2:0,n:hash(x,y,8)})
 }
 for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++){
  const q=tileAt(x,y);if(!q||q.type==='water')continue;
  const nw=nearWater(x,y),centerClear=near(x,y,12.2,10.5,3.35),edgeForest=x<5||y<4||x>18||y>13||islandValue(x,y)>.69;
  if(q.type!=='shore'&&!nw&&!centerClear){
   if(edgeForest&&hash(x,y,20)<.32)add(flora,'tree',x+rnd(.18,.68,x,y,21),y+rnd(.05,.42,x,y,22),rnd(.62,.92,x,y,23),x+y+rnd(.1,.6,x,y,24));
   else if(hash(x,y,30)<.025)add(flora,'tree',x+rnd(.18,.68,x,y,31),y+rnd(.05,.42,x,y,32),rnd(.55,.78,x,y,33),x+y+rnd(.1,.6,x,y,34));
   if(hash(x,y,40)<.045)add(flora,'rock',x+rnd(.18,.8,x,y,41),y+rnd(.18,.72,x,y,42),rnd(.42,.72,x,y,43),x+y+.75);
   if(hash(x,y,50)<.045)add(flora,'bush',x+rnd(.18,.78,x,y,51),y+rnd(.18,.75,x,y,52),rnd(.55,.88,x,y,53),x+y+.78)
  }
  if(q.type==='shore'&&hash(x,y,66)<.15)add(flora,'pebble',x+rnd(.2,.8,x,y,67),y+rnd(.2,.8,x,y,68),rnd(.35,.6,x,y,69),x+y+.8);
  if((q.type==='grass'||q.type==='flower'||q.type==='bushTile')&&!blocked(x,y)&&!centerClear){
   const count=nw?(hash(x,y,70)<.06?1:0):(hash(x,y,70)<.20?1:0);
   for(let i=0;i<count;i++){let k=hash(x,y,80+i),kind=k<.25?'dirt':k<.55?'meadow':k<.78?'leaf':'flowers';add(ground,kind,x+rnd(.24,.76,x,y,90+i),y+rnd(.24,.76,x,y,100+i),rnd(.34,.58,x,y,110+i),x+y+.45+i*.01)}
  }
 }
 add(paths,'path',11.82,10.48,.55,22.1);add(paths,'path',12.4,10.38,.55,22.7);add(structures,'camp',12.15,10.45,.70,22.8);
 for(let i=0;i<2;i++){
  const x=11.62+i*1.08,y=10.03+rnd(-.08,.12,i,2),wp=waypoints[(i*2+1)%waypoints.length];
  chars.push({x,y,targetX:wp.x,targetY:wp.y,wait:40+i*35,mode:'idle',dir:1,walk:0,speed:.010+i*.002,skin:skins[(i+2)%skins.length],hair:hairs[(i*2+1)%hairs.length],shirt:shirts[(i*3+2)%shirts.length],pants:pants[(i*5+1)%pants.length],hairType:i%4,body:rnd(.92,1.02,i,9),p:hash(i,2,1)*6.28,depth:x+y+1.12})
 }
 sortStatic();
}

function updatePeople(dt){
 for(let i=0;i<chars.length;i++){
  const ch=chars[i];
  if(ch.wait>0){ch.wait-=dt*60;ch.mode='idle';ch.depth=ch.x+ch.y+1.12;continue}
  let dx=ch.targetX-ch.x,dy=ch.targetY-ch.y,dist=Math.hypot(dx,dy);
  if(dist<.035){const next=waypoints[(Math.abs((i*3+(t/90|0)))%waypoints.length)];ch.targetX=next.x+rnd(-.08,.08,i,t/90|0);ch.targetY=next.y+rnd(-.06,.06,i,t/70|0);ch.wait=35+rnd(0,95,i,t/50|0)*1;ch.mode='idle'}
  else{const step=Math.min(dist,ch.speed*dt*60);ch.x+=dx/dist*step;ch.y+=dy/dist*step;ch.dir=dx>=0?1:-1;ch.mode='walk';ch.walk+=dt*7}
  ch.depth=ch.x+ch.y+1.12;
 }
}

function pathD(x,y,w,h){ctx.beginPath();ctx.moveTo(x,y-h/2);ctx.lineTo(x+w/2,y);ctx.lineTo(x,y+h/2);ctx.lineTo(x-w/2,y);ctx.closePath()}
function dia(x,y,w,h,fill,stroke){pathD(x,y,w,h);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function blob(x,y,w,h){ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fill()}
function roundRect(x,y,w,h,r,fill){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill()}
function drawKenney(img,x,y,kind){if(!img)return false;const w=kind==='water'?80:78,h=kind==='shore'?50:kind==='water'?48:49;ctx.drawImage(img,x-w/2,y-h*.7,w,h);return true}
function drawTile(q){const p=iso(q.x,q.y,q.h),x=p.x,y=p.y,img=q.type==='water'?art.solidWater:q.type==='shore'?art.solidShore:art.solidGrass;if(art.loaded&&drawKenney(img,x,y,q.type))return;const c=q.type==='water'?'#1f6379':q.type==='shore'?'#caa15b':'#5f8f40';dia(x,y,TW,TH,c,'rgba(20,42,23,.11)')}
function tree(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.24)';blob(0,21,25,8);ctx.fillStyle='#744927';ctx.fillRect(-5,0,10,29);ctx.fillStyle='#2f5728';blob(0,-15,34,24);ctx.fillStyle='#4b7d38';blob(-16,-7,25,19);blob(16,-6,25,19);ctx.fillStyle='#6b9d4a';blob(0,-28,21,15);ctx.restore()}
function bush(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.16)';blob(0,8,14,5);ctx.fillStyle='#3f7130';blob(0,0,15,9);ctx.fillStyle='#67994b';blob(-5,-4,8,6);ctx.fillStyle='#c65a48';ctx.fillRect(3,-4,3,3);ctx.fillRect(-7,1,3,3);ctx.restore()}
function rock(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.18)';blob(0,10,17,5);ctx.fillStyle='#67675d';blob(0,0,15,12);ctx.fillStyle='#999077';blob(-5,-4,6,4);ctx.restore()}
function pebble(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#716d60';blob(0,0,8,5);ctx.fillStyle='#a39a80';blob(-2,-2,3,2);ctx.restore()}
function pathPatch(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.26;dia(0,0,TW*.66,TH*.44,'#b48343');ctx.globalAlpha=1;ctx.restore()}
function meadow(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.07)';blob(0,4,14,5);ctx.fillStyle='#5d8d3e';blob(0,0,11,5);ctx.fillStyle='#78a84f';blob(-5,-1,6,3);blob(4,-2,5,3);ctx.fillStyle='#95c464';blob(0,-3,4,2);ctx.restore()}
function leaf(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.06)';blob(0,4,12,4);ctx.fillStyle='#87b95a';blob(0,-3,4,2.5);ctx.fillStyle='#6ea548';blob(-5,-1,4,2.5);ctx.restore()}
function flowers(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#76a54b';blob(0,4,10,4);ctx.fillStyle='#ffd166';ctx.fillRect(-6,-2,2,2);ctx.fillStyle='#f06b59';ctx.fillRect(-1,0,2,2);ctx.restore()}
function dirt(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.18;ctx.fillStyle='#a7763b';blob(0,0,14,5);ctx.globalAlpha=1;ctx.restore()}
function camp(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(255,128,45,.18)';blob(0,7,24,15);ctx.fillStyle='#704327';ctx.rotate(.5);ctx.fillRect(-14,4,28,3.6);ctx.rotate(-1);ctx.fillRect(-14,4,28,3.6);ctx.rotate(.5);let f=Math.sin(t*.18)*2;ctx.fillStyle='#ffcf5b';ctx.beginPath();ctx.moveTo(0,-17-f);ctx.lineTo(6,4);ctx.lineTo(-5,4);ctx.fill();ctx.fillStyle='#e65c28';ctx.beginPath();ctx.moveTo(-3,-10+f*.4);ctx.lineTo(10,6);ctx.lineTo(-7,6);ctx.fill();ctx.restore()}
function person(ch){const p=iso(ch.x,ch.y,0),walk=ch.mode==='walk'?Math.sin(ch.walk*7):0,bob=(ch.mode==='walk'?Math.abs(walk)*1.6:Math.sin(t*.04+ch.p)*.35),sc=.54*ch.body;ctx.save();ctx.translate(p.x,p.y-5+bob);ctx.scale(sc*ch.dir,sc);ctx.fillStyle='rgba(0,0,0,.18)';blob(0,22,9,3.5);ctx.fillStyle=ch.pants;roundRect(-6,6+Math.max(0,walk)*2,4,14,1.5,ch.pants);roundRect(2,6+Math.max(0,-walk)*2,4,14,1.5,ch.pants);ctx.fillStyle='#1c1714';ctx.fillRect(-8,19+Math.max(0,walk)*2,7,3);ctx.fillRect(2,19+Math.max(0,-walk)*2,7,3);roundRect(-9,-8,18,18,4,ch.shirt);ctx.fillStyle=ch.skin;ctx.fillRect(-12,-4-Math.max(0,-walk)*2,4,13);ctx.fillRect(8,-4-Math.max(0,walk)*2,4,13);ctx.beginPath();ctx.ellipse(0,-18,9,10,0,0,Math.PI*2);ctx.fillStyle=ch.skin;ctx.fill();ctx.fillStyle=ch.hair;if(ch.hairType===0){ctx.beginPath();ctx.ellipse(0,-23,10,6,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-9,-22,4,7);ctx.fillRect(5,-22,5,6)}else{ctx.fillRect(-8,-27,16,8);ctx.fillRect(-9,-22,5,8);ctx.fillRect(5,-22,4,7)}ctx.fillStyle='#1d1714';ctx.fillRect(-4,-18,2,2);ctx.fillRect(4,-18,2,2);ctx.restore()}
function drawLayer(list){for(const o of list){const p=iso(o.x,o.y,0);({meadow,leaf,flowers,dirt,path:pathPatch,camp,tree,bush,rock,pebble}[o.kind]||(()=>{}))(p.x,p.y,o.s)}}
function draw(){resize();const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;t++;updatePeople(dt);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0e282a');g.addColorStop(.42,'#203d31');g.addColorStop(1,'#071614');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.scale(DPR*cam.z,DPR*cam.z);ctx.translate(cam.x/(cam.z*DPR)-40,cam.y/(cam.z*DPR)-18);for(const q of tileDraw)drawTile(q);drawLayer(groundDraw);drawLayer(pathsDraw);drawLayer(structuresDraw);drawLayer(floraDraw);chars.slice().sort((a,b)=>a.depth-b.depth).forEach(person);ctx.restore();if(art.loaded){ctx.fillStyle='rgba(20,40,25,.65)';ctx.fillRect(10*DPR,(innerHeight-28)*DPR,170*DPR,18*DPR);ctx.fillStyle='#d9ff9b';ctx.font=(10*DPR)+'px sans-serif';ctx.fillText('HAND SELECT V1',16*DPR,(innerHeight-15)*DPR)}ctx.globalAlpha=.035;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;requestAnimationFrame(draw)}
document.querySelectorAll('.toolbar button').forEach(btn=>{btn.addEventListener('click',()=>{currentTool=btn.dataset.tool||'hand';document.querySelectorAll('.toolbar button').forEach(b=>b.classList.toggle('active',b===btn));setCard(currentTool[0].toUpperCase()+currentTool.slice(1),currentTool==='hand'?'Нажми на объект, чтобы посмотреть информацию.':'Инструмент пока только выбран. Следующий этап — действие на карте.')} )});
canvas.addEventListener('pointerdown',e=>{cam.drag=true;cam.lock=true;cam.moved=false;cam.lx=e.clientX;cam.ly=e.clientY});canvas.addEventListener('pointermove',e=>{if(!cam.drag)return;const dx=e.clientX-cam.lx,dy=e.clientY-cam.ly;if(Math.hypot(dx,dy)>3)cam.moved=true;cam.x+=dx;cam.y+=dy;cam.lx=e.clientX;cam.ly=e.clientY});canvas.addEventListener('pointerup',e=>{if(!cam.moved)selectAt(e.clientX,e.clientY);cam.drag=false});canvas.addEventListener('pointercancel',()=>cam.drag=false);canvas.addEventListener('wheel',e=>{e.preventDefault();cam.z=Math.max(.45,Math.min(1.8,cam.z*(e.deltaY>0?.9:1.1)))},{passive:false});
init();draw();

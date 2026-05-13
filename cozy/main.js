const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;

let W=0,H=0,DPR=1,t=0;
const TILE_W=64,TILE_H=32;
const mapW=24,mapH=19;
const cam={x:0,y:0,zoom:1,drag:false,lx:0,ly:0,locked:false};
const tiles=[],decor=[],chars=[];

function hash(x,y,s=0){let n=x*374761393+y*668265263+s*1442695041;n=(n^(n>>13))*1274126177;return ((n^(n>>16))>>>0)/4294967295}
function rnd(a,b,x=1,y=1,s=0){return a+hash(x,y,s)*(b-a)}
function resize(){DPR=Math.min(devicePixelRatio||1,2);W=Math.floor(innerWidth*DPR);H=Math.floor(innerHeight*DPR);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;if(!cam.locked){cam.zoom=innerWidth<700?.82:1.06;cam.x=innerWidth<700?innerWidth*.50:innerWidth*.52;cam.y=innerWidth<700?245:140}}}
function iso(x,y,z=0){return{x:(x-y)*TILE_W/2,y:(x+y)*TILE_H/2-z}}
function getTile(x,y){return tiles.find(q=>q.x===x&&q.y===y)}
function isWater(x,y){const q=getTile(x,y);return !q||q.type==='water'}
function isLandType(type){return type!=='water'}
function init(){
  for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++){
    const dx=x-mapW/2,dy=y-mapH/2;
    const wobble=(hash(x,y,1)-.5)*.9+(hash(x+3,y-2,2)-.5)*.65;
    const d=Math.sqrt(dx*dx*.86+dy*dy*1.18)+wobble;
    let type=d>9.7?'water':d>8.05?'shore':'grass';
    if((x>16&&y<8)||(x<3&&y>12)||(x>19&&y>13))type='water';
    if(type==='grass'&&hash(x,y,4)<.07)type='flower';
    if(type==='grass'&&hash(x,y,5)<.05)type='bushTile';
    tiles.push({x,y,type,h:type==='water'?-5:type==='shore'?-2:0,n:hash(x,y,8),grass:hash(x,y,9)});
  }
  for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++){
    const q=getTile(x,y); if(!q||q.type==='water'||q.type==='shore')continue;
    const edge=x<5||y<4||x>18||y>13;
    if(edge&&hash(x,y,20)<.55)decor.push({kind:'tree',x:x+rnd(.18,.68,x,y,21),y:y+rnd(.05,.42,x,y,22),s:rnd(.62,.92,x,y,23),depth:x+y+rnd(.1,.6,x,y,24)});
    else if(hash(x,y,30)<.07)decor.push({kind:'tree',x:x+rnd(.18,.68,x,y,31),y:y+rnd(.05,.42,x,y,32),s:rnd(.55,.78,x,y,33),depth:x+y+rnd(.1,.6,x,y,34)});
    if(hash(x,y,40)<.09)decor.push({kind:'rock',x:x+rnd(.18,.8,x,y,41),y:y+rnd(.18,.72,x,y,42),s:rnd(.42,.72,x,y,43),depth:x+y+.75});
    if(hash(x,y,50)<.08)decor.push({kind:'bush',x:x+rnd(.18,.78,x,y,51),y:y+rnd(.18,.75,x,y,52),s:rnd(.55,.88,x,y,53),depth:x+y+.78});
    if(q.type==='shore'&&hash(x,y,66)<.25)decor.push({kind:'pebble',x:x+rnd(.2,.8,x,y,67),y:y+rnd(.2,.8,x,y,68),s:rnd(.35,.6,x,y,69),depth:x+y+.8});
  }
  const fixed=[['house',8.7,11.2,1],['house',14.7,9.3,.95],['camp',12.2,10.6,1],['path',10.3,10.8,1],['path',11.2,10.7,1],['path',13.1,10.2,1]];
  fixed.forEach(([kind,x,y,s])=>decor.push({kind,x,y,s,depth:x+y+.9}));
  const cols=['#6b3d28','#c1843f','#e0c16a','#8f4f37','#33302a','#d6c2a0'];
  for(let i=0;i<8;i++){const x=9+(i%4)*1.15+rnd(-.22,.22,i,1),y=9.4+Math.floor(i/4)*1.15+rnd(-.18,.2,i,2);chars.push({x,y,c:cols[i%cols.length],p:hash(i,2,1)*6.28,depth:x+y+1.15,name:['Alina','Mira','Torn','Nora','Kira','Luka'][i%6]})}
}
function diamond(cx,cy,w,h,fill,stroke){ctx.beginPath();ctx.moveTo(cx,cy-h/2);ctx.lineTo(cx+w/2,cy);ctx.lineTo(cx,cy+h/2);ctx.lineTo(cx-w/2,cy);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function softDiamond(cx,cy,w,h,fill){diamond(cx,cy,w,h,fill,null);ctx.globalAlpha=.12;diamond(cx,cy,w*.72,h*.52,'#fff3bd',null);ctx.globalAlpha=1}
function drawTile(tile){const p=iso(tile.x,tile.y,tile.h),x=p.x,y=p.y;const c={grass:'#5d8d3b',flower:'#639746',bushTile:'#567f35',shore:'#caa15b',water:'#246b82'}[tile.type];if(tile.type==='water'){const wave=Math.sin(t*.02+tile.x*.7+tile.y*.4)*.7;diamond(x,y+wave,TILE_W,TILE_H,'#1e6077','rgba(42,109,126,.55)');ctx.globalAlpha=.13;diamond(x,y+wave-3,TILE_W*.68,TILE_H*.46,'#72bac2');ctx.globalAlpha=1;return}const outline=tile.type==='grass'||tile.type==='flower'||tile.type==='bushTile'?'rgba(30,52,31,.18)':'rgba(82,58,30,.24)';diamond(x,y,TILE_W,TILE_H,c,outline);if(tile.type==='shore'){ctx.fillStyle='rgba(255,228,151,.18)';for(let i=0;i<3;i++)ctx.fillRect(x-20+i*14+tile.n*5,y-4+i*3,7,2)}else{ctx.fillStyle='rgba(255,224,132,.08)';for(let i=0;i<4;i++)ctx.fillRect(x-23+i*14+tile.n*6,y-5+i*3,4,2)}if(tile.type!=='water'&&tile.type!=='shore'){if(isWater(tile.x+1,tile.y)||isWater(tile.x-1,tile.y)||isWater(tile.x,tile.y+1)||isWater(tile.x,tile.y-1)){ctx.globalAlpha=.16;diamond(x,y,TILE_W*.86,TILE_H*.66,'#b99152');ctx.globalAlpha=1}}if(tile.type==='flower'){for(let i=0;i<4;i++)flower(x-19+i*12,y-2+Math.sin(tile.n*9+i)*2)}if(tile.type==='bushTile')bush(x,y+2,.72)}
function blob(x,y,w,h){ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fill()}
function tree(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.24)';blob(0,21,25,8);ctx.fillStyle='#744927';ctx.fillRect(-5,0,10,29);ctx.fillStyle='#2f5728';blob(0,-15,34,24);ctx.fillStyle='#4b7d38';blob(-16,-7,25,19);blob(16,-6,25,19);ctx.fillStyle='#6b9d4a';blob(0,-28,21,15);ctx.fillStyle='rgba(255,235,148,.18)';blob(-8,-30,9,6);ctx.restore()}
function bush(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.16)';blob(0,8,14,5);ctx.fillStyle='#3f7130';blob(0,0,15,9);ctx.fillStyle='#67994b';blob(-5,-4,8,6);ctx.fillStyle='#c65a48';ctx.fillRect(3,-4,3,3);ctx.fillRect(-7,1,3,3);ctx.restore()}
function rock(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.18)';blob(0,10,17,5);ctx.fillStyle='#67675d';blob(0,0,15,12);ctx.fillStyle='#999077';blob(-5,-4,6,4);ctx.restore()}
function pebble(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#716d60';blob(0,0,8,5);ctx.fillStyle='#a39a80';blob(-2,-2,3,2);ctx.restore()}
function flower(x,y){ctx.fillStyle='#e65b59';ctx.fillRect(x-2,y-2,4,4);ctx.fillStyle='#ffd16a';ctx.fillRect(x,y,2,2)}
function pathPatch(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.38;diamond(0,0,TILE_W*.72,TILE_H*.52,'#b48343',null);ctx.globalAlpha=1;ctx.restore()}
function house(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.30)';blob(0,39,45,13);ctx.fillStyle='#77451f';ctx.fillRect(-26,5,52,40);ctx.fillStyle='#c98a46';ctx.fillRect(-20,5,40,39);ctx.fillStyle='#f0ce80';ctx.fillRect(-23,12,8,28);ctx.fillStyle='#663622';ctx.beginPath();ctx.moveTo(-36,6);ctx.lineTo(0,-30);ctx.lineTo(36,6);ctx.closePath();ctx.fill();ctx.fillStyle='#bf7132';ctx.beginPath();ctx.moveTo(-27,3);ctx.lineTo(0,-19);ctx.lineTo(27,3);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,224,145,.14)';ctx.beginPath();ctx.moveTo(-14,-1);ctx.lineTo(0,-13);ctx.lineTo(14,-1);ctx.closePath();ctx.fill();ctx.fillStyle='#4b3022';ctx.fillRect(-8,21,16,24);ctx.fillStyle='#ffe39b';ctx.fillRect(-20,14,10,9);ctx.fillRect(11,14,10,9);ctx.restore()}
function campfire(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(255,128,45,.22)';blob(0,8,34,21);ctx.fillStyle='#704327';ctx.rotate(.5);ctx.fillRect(-20,6,40,5);ctx.rotate(-1);ctx.fillRect(-20,6,40,5);ctx.rotate(.5);const flick=Math.sin(t*.18)*3;ctx.fillStyle='#ffcf5b';ctx.beginPath();ctx.moveTo(0,-25-flick);ctx.lineTo(10,5);ctx.lineTo(-7,5);ctx.fill();ctx.fillStyle='#e65c28';ctx.beginPath();ctx.moveTo(-4,-14+flick*.4);ctx.lineTo(16,8);ctx.lineTo(-10,8);ctx.fill();ctx.restore()}
function person(ch){const p=iso(ch.x,ch.y,0);const bob=Math.sin(t*.045+ch.p)*1.1;ctx.save();ctx.translate(p.x,p.y-18+bob);ctx.fillStyle='rgba(0,0,0,.25)';blob(0,27,10,4);ctx.fillStyle='#3d2b21';ctx.fillRect(-5,10,4,15);ctx.fillRect(2,10,4,15);ctx.fillStyle=ch.c;ctx.fillRect(-8,-3,16,17);ctx.fillStyle='#dfad78';ctx.fillRect(-8,-17,16,14);ctx.fillStyle='#3b2418';ctx.fillRect(-9,-20,18,7);ctx.fillStyle='#1d1714';ctx.fillRect(-4,-11,2,2);ctx.fillRect(4,-11,2,2);ctx.restore()}
function draw(){resize();t++;const grd=ctx.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#0e282a');grd.addColorStop(.42,'#203d31');grd.addColorStop(1,'#071614');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);ctx.save();ctx.scale(DPR*cam.zoom,DPR*cam.zoom);ctx.translate(cam.x/(cam.zoom*DPR)-40,cam.y/(cam.zoom*DPR)-18);tiles.sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(drawTile);const items=[];decor.forEach(d=>items.push(d));chars.forEach(c=>items.push({kind:'person',ref:c,depth:c.depth}));items.sort((a,b)=>a.depth-b.depth).forEach(o=>{const p=o.ref?null:iso(o.x,o.y,0);if(o.kind==='tree')tree(p.x,p.y,o.s);else if(o.kind==='rock')rock(p.x,p.y,o.s);else if(o.kind==='pebble')pebble(p.x,p.y,o.s);else if(o.kind==='bush')bush(p.x,p.y,o.s);else if(o.kind==='house')house(p.x,p.y,o.s);else if(o.kind==='camp')campfire(p.x,p.y,o.s);else if(o.kind==='path')pathPatch(p.x,p.y,o.s);else if(o.kind==='person')person(o.ref)});ctx.restore();ctx.globalAlpha=.10;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;requestAnimationFrame(draw)}
canvas.addEventListener('pointerdown',e=>{cam.drag=true;cam.locked=true;cam.lx=e.clientX;cam.ly=e.clientY});canvas.addEventListener('pointermove',e=>{if(!cam.drag)return;cam.x+=e.clientX-cam.lx;cam.y+=e.clientY-cam.ly;cam.lx=e.clientX;cam.ly=e.clientY});canvas.addEventListener('pointerup',()=>cam.drag=false);canvas.addEventListener('pointercancel',()=>cam.drag=false);canvas.addEventListener('wheel',e=>{e.preventDefault();cam.zoom=Math.max(.45,Math.min(1.8,cam.zoom*(e.deltaY>0?.9:1.1)))},{passive:false});
init();draw();

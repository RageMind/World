// YourWill visual pass 1
// Safe overlay over current prototype. Branch: cozy-current only.
(function(){
  const panel=document.createElement('div');
  panel.id='yw-info-panel';
  panel.innerHTML='<div class="yw-info-title">Информация</div><div class="yw-info-body">Hand: нажми на жителя или объект.</div>';
  document.body.appendChild(panel);

  const style=document.createElement('style');
  style.textContent=`
    #yw-info-panel{position:fixed;right:10px;top:106px;z-index:20;width:min(232px,34vw);padding:9px 10px;border-radius:15px;background:rgba(8,24,20,.84);border:1px solid rgba(235,218,156,.28);box-shadow:0 10px 24px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(10px);color:#f7e7b1;font-family:system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:none;opacity:.94}
    #yw-info-panel .yw-info-title{font-weight:900;font-size:14px;line-height:1.05;margin-bottom:5px;color:#fff4bf;text-shadow:0 2px 0 rgba(0,0,0,.25)}
    #yw-info-panel .yw-info-body{font-size:10.5px;line-height:1.32;color:#e7ddb6;white-space:pre-line}
    @media(max-width:700px){#yw-info-panel{top:98px;right:8px;width:34vw;padding:8px 9px}.yw-info-title{font-size:12px!important}.yw-info-body{font-size:9.5px!important}}
  `;
  document.head.appendChild(style);

  function setPanel(title,body){panel.querySelector('.yw-info-title').textContent=title;panel.querySelector('.yw-info-body').textContent=body}
  function screenPos(mapX,mapY,z=0){const p=iso(mapX,mapY,z),ox=cam.x/(cam.z*DPR)-40,oy=cam.y/(cam.z*DPR)-18;return{x:(p.x+ox)*cam.z*DPR,y:(p.y+oy)*cam.z*DPR}}
  function adjacentWater(x,y){return isWater(x+1,y)||isWater(x-1,y)||isWater(x,y+1)||isWater(x,y-1)||isWater(x+1,y-1)||isWater(x-1,y+1)||isWater(x+1,y+1)||isWater(x-1,y-1)}

  for(const q of tiles){if(q.type!=='water'&&adjacentWater(q.x,q.y)){q.type='shore';q.h=-2}}
  sortStatic();

  const originalDrawTile=drawTile;
  drawTile=function(q){
    const p=iso(q.x,q.y,q.h);
    if(q.type==='water'){
      pathD(p.x,p.y,TW,TH);ctx.fillStyle='#3a9fbb';ctx.fill();
      ctx.globalAlpha=.18;pathD(p.x,p.y-2,TW*.72,TH*.44);ctx.fillStyle='#8bd6df';ctx.fill();ctx.globalAlpha=.14;
      ctx.strokeStyle='#d6fbff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-20,p.y-3);ctx.quadraticCurveTo(p.x-6,p.y-8,p.x+10,p.y-4);ctx.stroke();ctx.globalAlpha=1;return;
    }
    if(q.type==='shore'){
      pathD(p.x,p.y,TW,TH);ctx.fillStyle='#d4aa61';ctx.fill();
      ctx.globalAlpha=.42;pathD(p.x,p.y-2,TW*.72,TH*.44);ctx.fillStyle='#ecd07f';ctx.fill();ctx.globalAlpha=.2;
      ctx.fillStyle='#a87b40';ctx.fillRect(p.x-15,p.y-1,8,2);ctx.fillRect(p.x+7,p.y+4,10,2);ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(82,58,31,.18)';pathD(p.x,p.y,TW,TH);ctx.stroke();return;
    }
    originalDrawTile(q);
    if(q.type==='grass'||q.type==='flower'||q.type==='bushTile'){
      if(((q.x*17+q.y*23)%5)===0){ctx.globalAlpha=.16;pathD(p.x+4,p.y+2,TW*.42,TH*.22);ctx.fillStyle='#8abf54';ctx.fill();ctx.globalAlpha=1}
    }
  };

  tree=function(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.25)';blob(0,23,28,8);ctx.fillStyle='#74451f';ctx.fillRect(-5,0,10,30);ctx.fillStyle='#264d25';blob(0,-13,35,25);ctx.fillStyle='#3d7733';blob(-16,-7,26,19);blob(16,-6,26,19);ctx.fillStyle='#659d45';blob(0,-29,21,14);ctx.fillStyle='rgba(235,255,180,.12)';blob(-8,-29,10,5);ctx.restore()};
  bush=function(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.24)';blob(0,10,19,6);ctx.fillStyle='#244d28';blob(0,2,19,12);ctx.fillStyle='#3d7a36';blob(-9,-2,13,8);blob(9,-2,13,8);ctx.fillStyle='#72ad50';blob(0,-9,12,7);ctx.fillStyle='#ff5f5b';for(const b of [[-8,-7,3.8],[5,-5,3.8],[1,2,3.4],[10,1,3.2]]){ctx.beginPath();ctx.arc(b[0],b[1],b[2],0,Math.PI*2);ctx.fill()}ctx.fillStyle='#ffd8bd';ctx.beginPath();ctx.arc(-9,-8,1.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(4,-6,1.1,0,Math.PI*2);ctx.fill();ctx.restore()};
  camp=function(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(255,130,40,.26)';blob(0,8,32,19);ctx.fillStyle='rgba(255,210,90,.18)';blob(0,2,22,14);ctx.fillStyle='#704327';ctx.rotate(.5);ctx.fillRect(-17,5,34,4);ctx.rotate(-1);ctx.fillRect(-17,5,34,4);ctx.rotate(.5);let f=Math.sin(t*.18)*2.8;ctx.fillStyle='#ffd35b';ctx.beginPath();ctx.moveTo(0,-22-f);ctx.lineTo(8,5);ctx.lineTo(-6,5);ctx.fill();ctx.fillStyle='#f0642a';ctx.beginPath();ctx.moveTo(-4,-13+f*.3);ctx.lineTo(13,7);ctx.lineTo(-9,7);ctx.fill();ctx.globalAlpha=.4;ctx.fillStyle='#d6d6c8';blob(-4,-31-f,4,8);ctx.restore()};
  person=function(ch){const p=iso(ch.x,ch.y,0),walk=ch.mode==='walk'?Math.sin(ch.walk*7):0,bob=(ch.mode==='walk'?Math.abs(walk)*1.3:Math.sin(t*.04+ch.p)*.28),sc=.48*ch.body;ctx.save();ctx.translate(p.x,p.y-5+bob);ctx.scale(sc*ch.dir,sc);ctx.fillStyle='rgba(0,0,0,.20)';blob(0,22,10,3.8);ctx.fillStyle=ch.pants;roundRect(-6,6+Math.max(0,walk)*2,4,14,1.5,ch.pants);roundRect(2,6+Math.max(0,-walk)*2,4,14,1.5,ch.pants);ctx.fillStyle='#151515';ctx.fillRect(-8,19+Math.max(0,walk)*2,7,3);ctx.fillRect(2,19+Math.max(0,-walk)*2,7,3);roundRect(-9,-8,18,18,4,ch.shirt);ctx.fillStyle=ch.skin;ctx.fillRect(-12,-4-Math.max(0,-walk)*2,4,13);ctx.fillRect(8,-4-Math.max(0,walk)*2,4,13);ctx.beginPath();ctx.ellipse(0,-18,9,10,0,0,Math.PI*2);ctx.fillStyle=ch.skin;ctx.fill();ctx.fillStyle=ch.hair;ctx.fillRect(-8,-27,16,8);ctx.fillRect(-9,-22,5,8);ctx.fillStyle='#1d1714';ctx.fillRect(-4,-18,2,2);ctx.fillRect(4,-18,2,2);ctx.restore()};

  function objectInfo(o){if(o.kind==='camp')return['Костёр','Центр лагеря.\nОтдых и ночной сбор.'];if(o.kind==='tree')return['Дерево','Источник wood.\nПозже: рубка и стройка.'];if(o.kind==='rock')return['Камень','Источник stone.\nНужен для домов.'];if(o.kind==='bush')return['Ягодный куст','Источник food.\nЖители едят ягоды.'];return['Объект',`Тип: ${o.kind||'unknown'}`]}
  function personInfo(ch){const state=ch.health<=0?'без сил':ch.need==='forage'?'ищет еду':ch.need==='rest'?'отдыхает':ch.need==='hungry'?'голоден':ch.mode==='walk'?'идёт':'стоит';return[ch.name||'Житель',`Роль: выживание.\nСостояние: ${state}\nЕда: ${Math.round(ch.hunger??0)}/100\nЭнергия: ${Math.round(ch.energy??0)}/100\nЗдоровье: ${Math.round(ch.health??100)}/100`]}

  selectAt=function(clientX,clientY){if(currentTool!=='hand')return;const sx=clientX*DPR,sy=clientY*DPR;let best=null,dist=1e9,type='';for(const ch of chars){const sp=screenPos(ch.x,ch.y,-8),d=Math.hypot(sp.x-sx,sp.y-sy);if(d<48*DPR&&d<dist){best=ch;dist=d;type='person'}}for(const o of [...structures,...flora]){const sp=screenPos(o.x,o.y,0),r=(o.kind==='tree'?48:o.kind==='camp'?44:o.kind==='bush'?38:30)*DPR,d=Math.hypot(sp.x-sx,sp.y-sy);if(d<r&&d<dist){best=o;dist=d;type='object'}}if(type==='person'){const [a,b]=personInfo(best);setPanel(a,b);setCard(a,b.replace(/\n/g,' '));return}if(type==='object'){const [a,b]=objectInfo(best);setPanel(a,b);setCard(a,b.replace(/\n/g,' '));return}setPanel('Пусто','Нажми ближе к жителю или объекту.')};

  const prevDraw=draw;
  draw=function(){prevDraw();ctx.save();ctx.setTransform(1,0,0,1,0,0);const px=20*DPR,py=76*DPR,w=Math.min(canvas.width-40*DPR,520*DPR),h=32*DPR;ctx.fillStyle='rgba(9,24,20,.86)';ctx.fillRect(px,py,w,h);ctx.strokeStyle='rgba(235,218,156,.22)';ctx.strokeRect(px,py,w,h);ctx.fillStyle='#f2e0a9';ctx.font=(12*DPR)+'px system-ui,sans-serif';ctx.fillText('День 1  ·  2 жителя  ·  ягоды рядом  ·  Hand: выбор объекта',px+12*DPR,py+21*DPR);ctx.restore()};

  setPanel('Информация','Hand: нажми на жителя, ягоды, дерево, камень или костёр.');
})();

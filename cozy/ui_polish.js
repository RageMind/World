// YourWill UI / terrain polish layer
// Loaded after main.js and survival.js. Same branch only: cozy-current.
(function(){
  const panel=document.createElement('div');
  panel.id='yw-info-panel';
  panel.innerHTML='<div class="yw-info-title">Информация</div><div class="yw-info-body">Hand: нажми на жителя или объект.</div>';
  document.body.appendChild(panel);

  const style=document.createElement('style');
  style.textContent=`
    #yw-info-panel{position:fixed;right:10px;top:98px;z-index:20;width:min(250px,36vw);padding:10px 11px;border-radius:16px;background:rgba(8,24,20,.82);border:1px solid rgba(235,218,156,.30);box-shadow:0 12px 28px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(10px);color:#f7e7b1;font-family:system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:none;opacity:.95}
    #yw-info-panel .yw-info-title{font-weight:900;font-size:15px;line-height:1.1;margin-bottom:5px;color:#fff4bf;text-shadow:0 2px 0 rgba(0,0,0,.25)}
    #yw-info-panel .yw-info-body{font-size:11px;line-height:1.35;color:#e7ddb6;white-space:pre-line}
    @media(max-width:700px){#yw-info-panel{top:96px;right:8px;width:36vw;padding:9px 10px;border-radius:14px}.yw-info-title{font-size:13px!important}.yw-info-body{font-size:10px!important}}
  `;
  document.head.appendChild(style);

  function setPanel(title,body){
    panel.querySelector('.yw-info-title').textContent=title;
    panel.querySelector('.yw-info-body').textContent=body;
  }

  function screenPos(mapX,mapY,z=0){
    const p=iso(mapX,mapY,z);
    const ox=cam.x/(cam.z*DPR)-40;
    const oy=cam.y/(cam.z*DPR)-18;
    return {x:(p.x+ox)*cam.z*DPR,y:(p.y+oy)*cam.z*DPR};
  }

  function adjacentWater(x,y){
    return isWater(x+1,y)||isWater(x-1,y)||isWater(x,y+1)||isWater(x,y-1)||isWater(x+1,y-1)||isWater(x-1,y+1)||isWater(x+1,y+1)||isWater(x-1,y-1);
  }

  function applySandyCoast(){
    let changed=0;
    for(const q of tiles){
      if(q.type!=='water'&&adjacentWater(q.x,q.y)){
        q.type='shore';
        q.h=-2;
        changed++;
      }
    }
    if(changed)sortStatic();
  }
  applySandyCoast();

  const originalDrawTile=drawTile;
  drawTile=function(q){
    const p=iso(q.x,q.y,q.h);
    if(q.type==='shore'){
      // Clear readable sand band. Do not rely on the automatically picked Kenney tile,
      // because the package contains several green transition tiles that looked like grass.
      pathD(p.x,p.y,TW,TH);
      ctx.fillStyle='#d2ad63';
      ctx.fill();
      ctx.globalAlpha=.38;
      pathD(p.x,p.y-2,TW*.76,TH*.48);
      ctx.fillStyle='#e6c879';
      ctx.fill();
      ctx.globalAlpha=.22;
      ctx.fillStyle='#ad8445';
      ctx.fillRect(p.x-18,p.y-2,9,2);
      ctx.fillRect(p.x+6,p.y+4,12,2);
      ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(74,55,30,.20)';
      pathD(p.x,p.y,TW,TH);
      ctx.stroke();
      return;
    }
    originalDrawTile(q);
  };

  // Make berry bushes more readable without importing new textures.
  bush=function(x,y,s=1){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.fillStyle='rgba(0,0,0,.24)';
    blob(0,10,19,6);
    ctx.fillStyle='#244d28';
    blob(0,2,19,12);
    ctx.fillStyle='#3d7a36';
    blob(-9,-2,13,8);
    blob(9,-2,13,8);
    ctx.fillStyle='#72ad50';
    blob(0,-9,12,7);
    ctx.fillStyle='#ff5f5b';
    for(const b of [[-8,-7,3.8],[5,-5,3.8],[1,2,3.4],[10,1,3.2]]){
      ctx.beginPath();ctx.arc(b[0],b[1],b[2],0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#ffd8bd';
    ctx.beginPath();ctx.arc(-9,-8,1.1,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(4,-6,1.1,0,Math.PI*2);ctx.fill();
    ctx.restore();
  };

  function objectInfo(o){
    if(!o)return ['Пусто','Здесь пока ничего нет.'];
    if(o.kind==='camp')return ['Костёр','Нужен как центр лагеря.\nЖители отдыхают здесь и возвращаются ночью.'];
    if(o.kind==='tree')return ['Дерево','Источник wood.\nПозже жители будут рубить его для строительства.'];
    if(o.kind==='rock')return ['Камень','Источник stone.\nНужен для построек и улучшений.'];
    if(o.kind==='bush')return ['Ягодный куст','Источник food.\nГолодный житель подходит, собирает ягоды и ест.'];
    if(o.kind==='pebble')return ['Малый камень','Декор берега. Позже можно сделать stone.'];
    return ['Объект',`Тип: ${o.kind||'unknown'}`];
  }

  function personInfo(ch){
    const state=ch.health<=0?'без сил':ch.need==='forage'?'ищет еду':ch.need==='rest'?'отдыхает':ch.need==='hungry'?'голоден':ch.mode==='walk'?'идёт':'стоит';
    const hunger=Math.round(ch.hunger??0),energy=Math.round(ch.energy??0),health=Math.round(ch.health??100);
    return [ch.name||'Житель',`Роль: житель мира.\nСостояние: ${state}\nЕда: ${hunger}/100\nЭнергия: ${energy}/100\nЗдоровье: ${health}/100`];
  }

  selectAt=function(clientX,clientY){
    if(currentTool!=='hand')return;
    const sx=clientX*DPR,sy=clientY*DPR;
    let best=null,dist=1e9,type='';

    for(const ch of chars){
      const sp=screenPos(ch.x,ch.y,-8);
      const d=Math.hypot(sp.x-sx,sp.y-sy);
      if(d<42*DPR&&d<dist){best=ch;dist=d;type='person';}
    }
    for(const o of [...structures,...flora]){
      const sp=screenPos(o.x,o.y,0);
      const radius=(o.kind==='tree'?48:o.kind==='camp'?40:o.kind==='bush'?34:30)*DPR;
      const d=Math.hypot(sp.x-sx,sp.y-sy);
      if(d<radius&&d<dist){best=o;dist=d;type='object';}
    }

    if(type==='person'){
      const [title,body]=personInfo(best);
      setPanel(title,body);
      setCard(title,body.replace(/\n/g,' '));
      return;
    }
    if(type==='object'){
      const [title,body]=objectInfo(best);
      setPanel(title,body);
      setCard(title,body.replace(/\n/g,' '));
      return;
    }

    const p=invIso(clientX*DPR,clientY*DPR);
    const tx=Math.floor(p.x),ty=Math.floor(p.y),q=tileAt(tx,ty);
    if(q){
      const body=`Координаты: ${tx}, ${ty}\nТип: ${q.type}\n${q.type==='shore'?'Песчаный берег отделяет воду от травы.':'Клетка мира.'}`;
      setPanel('Клетка карты',body);
      setCard('Клетка карты',body.replace(/\n/g,' '));
    }else{
      setPanel('Пусто','Нажми ближе к объекту или центру клетки.');
      setCard('Пусто','Нажми ближе к объекту или центру клетки.');
    }
  };

  setPanel('Информация','Hand: нажми на жителя, ягоды, дерево, камень или костёр.');
})();

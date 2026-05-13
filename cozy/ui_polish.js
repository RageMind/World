// YourWill UI / terrain polish layer
// Loaded after main.js and survival.js. Same branch only: cozy-current.
(function(){
  const panel=document.createElement('div');
  panel.id='yw-info-panel';
  panel.innerHTML='<div class="yw-info-title">Информация</div><div class="yw-info-body">Выбери Hand и нажми на объект.</div>';
  document.body.appendChild(panel);

  const style=document.createElement('style');
  style.textContent=`
    #yw-info-panel{position:fixed;right:14px;top:116px;z-index:20;width:min(310px,42vw);padding:14px 15px;border-radius:18px;background:rgba(8,24,20,.78);border:1px solid rgba(235,218,156,.28);box-shadow:0 14px 35px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(10px);color:#f7e7b1;font-family:system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:none;opacity:.96}
    #yw-info-panel .yw-info-title{font-weight:900;font-size:17px;line-height:1.15;margin-bottom:7px;color:#fff4bf;text-shadow:0 2px 0 rgba(0,0,0,.25)}
    #yw-info-panel .yw-info-body{font-size:13px;line-height:1.42;color:#e7ddb6;white-space:pre-line}
    @media(max-width:700px){#yw-info-panel{top:102px;right:10px;width:42vw;padding:11px 12px;border-radius:15px}.yw-info-title{font-size:14px!important}.yw-info-body{font-size:11px!important}}
  `;
  document.head.appendChild(style);

  function setPanel(title,body){
    panel.querySelector('.yw-info-title').textContent=title;
    panel.querySelector('.yw-info-body').textContent=body;
  }

  function adjacentWater(x,y){
    return isWater(x+1,y)||isWater(x-1,y)||isWater(x,y+1)||isWater(x,y-1)||isWater(x+1,y-1)||isWater(x-1,y+1);
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

  // Make shore clearer after map generation, using the same Kenney shore tile that main.js already selects.
  applySandyCoast();

  // Make berry bushes more readable without importing new textures.
  // This intentionally changes only the bush object drawing, not terrain.
  try{
    bush=function(x,y,s=1){
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(s,s);
      ctx.fillStyle='rgba(0,0,0,.22)';
      blob(0,10,18,6);
      ctx.fillStyle='#254f29';
      blob(0,2,18,11);
      ctx.fillStyle='#3f7d38';
      blob(-9,-2,12,8);
      blob(9,-2,12,8);
      ctx.fillStyle='#70a84f';
      blob(0,-8,11,7);
      ctx.fillStyle='#e85d55';
      ctx.beginPath();ctx.arc(-7,-6,3.2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(5,-4,3.2,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(1,2,2.8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffd0b0';
      ctx.beginPath();ctx.arc(-8,-7,1.1,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(4,-5,1.1,0,Math.PI*2);ctx.fill();
      ctx.restore();
    };
  }catch(e){console.warn('Berry polish failed',e)}

  function objectInfo(o){
    if(!o)return ['Пусто','Здесь пока ничего нет.'];
    if(o.kind==='camp')return ['Костёр','Зачем нужен:\n• точка лагеря\n• место отдыха жителей\n• ночью жители идут к нему\n\nСтатус: работает.'];
    if(o.kind==='tree')return ['Дерево','Зачем нужно:\n• будущий источник wood\n• часть леса и экосистемы\n• позже жители смогут рубить его\n\nРесурс: wood.'];
    if(o.kind==='rock')return ['Камень','Зачем нужен:\n• источник stone\n• нужен для строительства\n\nРесурс: stone.'];
    if(o.kind==='bush')return ['Ягодный куст','Зачем нужен:\n• источник еды\n• голодный житель может подойти, собрать ягоды и поесть\n\nРесурс: food.'];
    if(o.kind==='pebble')return ['Маленький камень','Декор берега. Позже можно сделать мелким источником stone.'];
    return ['Объект',`Тип: ${o.kind||'unknown'}`];
  }

  function personInfo(ch){
    const state=ch.health<=0?'без сил':ch.need==='forage'?'ищет еду':ch.need==='rest'?'отдыхает':ch.need==='hungry'?'голоден':ch.mode==='walk'?'идёт':'стоит';
    const hunger=Math.round(ch.hunger??0),energy=Math.round(ch.energy??0),health=Math.round(ch.health??100);
    return [ch.name||'Житель',`Зачем нужен:\n• самостоятельный житель мира\n• ищет еду, отдыхает, ходит по лагерю\n• позже будет строить и собирать ресурсы\n\nСостояние: ${state}\nЕда: ${hunger}/100\nЭнергия: ${energy}/100\nЗдоровье: ${health}/100`];
  }

  const previousSelect=selectAt;
  selectAt=function(clientX,clientY){
    if(currentTool!=='hand')return previousSelect(clientX,clientY);
    const p=invIso(clientX*DPR,clientY*DPR);
    let best=null,dist=1e9,type='';
    for(let i=0;i<chars.length;i++){
      const ch=chars[i],d=Math.hypot(ch.x-p.x,ch.y-p.y);
      if(d<1.35&&d<dist){best=ch;dist=d;type='person';}
    }
    for(const o of [...structures,...flora]){
      const d=Math.hypot(o.x-p.x,o.y-p.y);
      if(d<.9&&d<dist){best=o;dist=d;type='object';}
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
    const tx=Math.floor(p.x),ty=Math.floor(p.y),q=tileAt(tx,ty);
    const title=q?'Клетка карты':'Пусто';
    const body=q?`Координаты: ${tx}, ${ty}\nТип земли: ${q.type}\n\nЗачем нужно:\n• по клеткам позже будут ставиться объекты\n• песок отделяет воду от травы`:'За пределами карты.';
    setPanel(title,body);
    setCard(title,body.replace(/\n/g,' '));
  };

  setPanel('Информация','Выбери Hand и нажми на жителя, куст, дерево, камень или костёр.');
})();

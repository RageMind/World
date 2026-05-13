// YourWill sandbox actions layer
// Branch: cozy-current only. Adds resources, placement, saving without replacing renderer.
(function(){
  const state={wood:0,food:0,stone:0,mode:'hand',speed:1,selected:null};
  window.ywState=state;

  const css=document.createElement('style');
  css.textContent=`
    .topbar .res span{min-width:22px;text-align:center;color:#ffe9a6;font-weight:900}
    .toolbar button[data-tool="nature"]::before{content:"🌿 ";font-size:.9em}.toolbar button[data-tool="home"]::before{content:"🏠 ";font-size:.9em}.toolbar button[data-tool="fire"]::before{content:"🔥 ";font-size:.9em}.toolbar button[data-tool="hand"]::before{content:"✋ ";font-size:.9em}
  `;
  document.head.appendChild(css);

  function updateHud(){
    const spans=document.querySelectorAll('.topbar .res span');
    if(spans[0])spans[0].textContent=chars.length;
    if(spans[1])spans[1].textContent=Math.floor(state.food);
    if(spans[2])spans[2].textContent=Math.floor(state.wood);
    if(spans[3])spans[3].textContent=Math.floor(state.stone);
  }

  function save(){
    const data={
      state:{wood:state.wood,food:state.food,stone:state.stone},
      structures:structures.map(o=>({kind:o.kind,x:o.x,y:o.y,s:o.s,depth:o.depth,built:o.built||false,need:o.need||null})),
      addedFlora:flora.filter(o=>o.playerMade).map(o=>({kind:o.kind,x:o.x,y:o.y,s:o.s,depth:o.depth,playerMade:true}))
    };
    localStorage.setItem('yourwill-current-save',JSON.stringify(data));
  }

  function load(){
    try{
      const data=JSON.parse(localStorage.getItem('yourwill-current-save')||'null');
      if(!data)return;
      if(data.state)Object.assign(state,data.state);
      for(const o of data.addedFlora||[])add(flora,o.kind,o.x,o.y,o.s,o.depth),flora[flora.length-1].playerMade=true;
      for(const s of data.structures||[]){
        if(s.kind==='camp')continue;
        add(structures,s.kind,s.x,s.y,s.s,s.depth);
        Object.assign(structures[structures.length-1],{built:s.built,need:s.need});
      }
      sortStatic();
    }catch(e){console.warn('save load failed',e)}
  }

  function mapPoint(clientX,clientY){
    const p=invIso(clientX*DPR,clientY*DPR);
    return {x:Math.floor(p.x),y:Math.floor(p.y),fx:p.x,fy:p.y};
  }
  function canPlace(tx,ty){
    const q=tileAt(tx,ty);
    if(!q)return [false,'За пределами карты'];
    if(q.type==='water')return [false,'Нельзя ставить на воду'];
    return [true,'ok'];
  }
  function objectNear(x,y,r=.75){
    return [...flora,...structures,...chars].some(o=>Math.hypot(o.x-x,o.y-y)<r);
  }
  function place(kind,tx,ty){
    const [ok,why]=canPlace(tx,ty);
    if(!ok){setCard('Нельзя',why);return;}
    const x=tx+.5,y=ty+.45;
    if(objectNear(x,y,.65)){setCard('Занято','Здесь уже есть объект или житель.');return;}
    if(kind==='nature'){
      const makeBush=Math.random()<.55;
      add(flora,makeBush?'bush':'tree',x,y,makeBush?.72:.68,tx+ty+.75);
      flora[flora.length-1].playerMade=true;
      setCard(makeBush?'Ягодный куст':'Дерево',makeBush?'Посажен источник еды.':'Посажен будущий источник wood.');
    }else if(kind==='fire'){
      add(structures,'camp',x,y,.68,tx+ty+.75);
      structures[structures.length-1].built=true;
      setCard('Костёр','Поставлен новый костёр. Жители смогут отдыхать рядом.');
    }else if(kind==='home'){
      add(structures,'blueprint',x,y,.72,tx+ty+.75);
      const bp=structures[structures.length-1];
      bp.need={wood:8,stone:3};
      bp.built=false;
      setCard('Чертёж дома','Нужно: 8 wood и 3 stone. Следующий этап — строительство жителями.');
    }
    sortStatic();save();updateHud();
  }

  const oldSelect=selectAt;
  selectAt=function(clientX,clientY){
    if(state.mode==='hand'||currentTool==='hand')return oldSelect(clientX,clientY);
    const p=mapPoint(clientX,clientY);
    if(state.mode==='nature'||currentTool==='nature')return place('nature',p.x,p.y);
    if(state.mode==='fire'||currentTool==='fire')return place('fire',p.x,p.y);
    if(state.mode==='home'||currentTool==='home')return place('home',p.x,p.y);
    oldSelect(clientX,clientY);
  };

  document.querySelectorAll('.toolbar button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const tool=btn.dataset.tool||'hand';
      if(tool==='fast'){
        state.speed=state.speed===1?2:1;
        btn.textContent=state.speed===1?'Fast':'x2';
        setCard('Скорость','Скорость мира: x'+state.speed);
        return;
      }
      state.mode=tool;
      currentTool=tool;
      document.querySelectorAll('.toolbar button').forEach(b=>b.classList.toggle('active',b===btn));
      const hints={hand:'Нажми на жителя или объект.',nature:'Нажми на землю: посадить дерево/ягоды.',home:'Нажми на землю: поставить чертёж дома.',fire:'Нажми на землю: поставить костёр.',water:'Позже: инструмент воды.'};
      setCard(tool[0].toUpperCase()+tool.slice(1),hints[tool]||'Инструмент выбран.');
    },true);
  });

  // Resource rewards from survival gathering.
  const oldSort=sortStatic;
  sortStatic=function(){oldSort();updateHud();};

  const prevUpdate=updatePeople;
  updatePeople=function(dt){
    prevUpdate(dt*(state.speed||1));
    for(const ch of chars){
      if(ch.need==='forage'&&ch.hunger>85&&!ch._fedReward){state.food+=1;ch._fedReward=true;updateHud();save();}
      if(ch.need!=='forage')ch._fedReward=false;
    }
  };

  function drawBlueprint(o){
    const p=iso(o.x,o.y,0);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.7,o.s||.7);ctx.globalAlpha=.72;
    dia(0,14,54,27,'#cfb16b','rgba(255,245,180,.5)');
    ctx.strokeStyle='#f3d680';ctx.lineWidth=3;ctx.strokeRect(-18,-8,36,25);
    ctx.beginPath();ctx.moveTo(-23,-8);ctx.lineTo(0,-27);ctx.lineTo(23,-8);ctx.stroke();
    ctx.globalAlpha=1;ctx.restore();
  }
  const oldDrawLayer=drawLayer;
  drawLayer=function(list){
    for(const o of list){
      if(o.kind==='blueprint'){drawBlueprint(o);continue;}
      const p=iso(o.x,o.y,0);({meadow,leaf,flowers,dirt,path:pathPatch,camp,tree,bush,rock,pebble}[o.kind]||(()=>{}))(p.x,p.y,o.s);
    }
  };

  load();updateHud();
})();

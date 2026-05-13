// YourWill sandbox actions layer
// Branch: cozy-current only. Adds resources, placement, building, saving without replacing renderer.
(function(){
  const state={wood:0,food:0,stone:0,mode:'hand',speed:1,selected:null,message:'Готово'};
  window.ywState=state;

  const css=document.createElement('style');
  css.textContent=`
    .topbar .res span{min-width:22px;text-align:center;color:#ffe9a6;font-weight:900}
    .toolbar button[data-tool="nature"]::before{content:"🌿 ";font-size:.9em}.toolbar button[data-tool="home"]::before{content:"🏠 ";font-size:.9em}.toolbar button[data-tool="fire"]::before{content:"🔥 ";font-size:.9em}.toolbar button[data-tool="hand"]::before{content:"✋ ";font-size:.9em}
  `;
  document.head.appendChild(css);

  function card(title,text){state.message=text;setCard(title,text)}
  function updateHud(){
    const spans=document.querySelectorAll('.topbar .res span');
    if(spans[0])spans[0].textContent=chars.length;
    if(spans[1])spans[1].textContent=Math.floor(state.food);
    if(spans[2])spans[2].textContent=Math.floor(state.wood);
    if(spans[3])spans[3].textContent=Math.floor(state.stone);
  }
  function save(){
    const data={state:{wood:state.wood,food:state.food,stone:state.stone},structures:structures.map(o=>({kind:o.kind,x:o.x,y:o.y,s:o.s,depth:o.depth,built:o.built||false,need:o.need||null,progress:o.progress||0})),addedFlora:flora.filter(o=>o.playerMade).map(o=>({kind:o.kind,x:o.x,y:o.y,s:o.s,depth:o.depth,playerMade:true,hp:o.hp||1,res:o.res||null}))};
    localStorage.setItem('yourwill-current-save',JSON.stringify(data));
  }
  function load(){
    try{
      const data=JSON.parse(localStorage.getItem('yourwill-current-save')||'null');
      if(!data)return;
      if(data.state)Object.assign(state,data.state);
      for(const o of data.addedFlora||[]){add(flora,o.kind,o.x,o.y,o.s,o.depth);Object.assign(flora[flora.length-1],{playerMade:true,hp:o.hp||1,res:o.res||resourceOf(o.kind)})}
      for(const s of data.structures||[]){if(s.kind==='camp')continue;add(structures,s.kind,s.x,s.y,s.s,s.depth);Object.assign(structures[structures.length-1],{built:s.built,need:s.need,progress:s.progress||0})}
      sortStatic();
    }catch(e){console.warn('save load failed',e)}
  }
  function resourceOf(kind){return kind==='tree'?'wood':kind==='rock'||kind==='pebble'?'stone':kind==='bush'?'food':null}
  function ensureResources(){for(const o of flora){if(!o.res)o.res=resourceOf(o.kind);if(!o.hp)o.hp=o.kind==='tree'?3:o.kind==='rock'?2:1}}
  function mapPoint(clientX,clientY){const p=invIso(clientX*DPR,clientY*DPR);return {x:Math.floor(p.x),y:Math.floor(p.y),fx:p.x,fy:p.y}}
  function canPlace(tx,ty){const q=tileAt(tx,ty);if(!q)return [false,'За пределами карты'];if(q.type==='water')return [false,'Нельзя ставить на воду'];return [true,'ok']}
  function objectNear(x,y,r=.75){return [...flora,...structures,...chars].some(o=>Math.hypot(o.x-x,o.y-y)<r)}
  function place(kind,tx,ty){
    const [ok,why]=canPlace(tx,ty);if(!ok){card('Нельзя',why);return}
    const x=tx+.5,y=ty+.45;if(objectNear(x,y,.65)){card('Занято','Здесь уже есть объект или житель.');return}
    if(kind==='nature'){
      const makeBush=Math.random()<.55;add(flora,makeBush?'bush':'tree',x,y,makeBush?.78:.72,tx+ty+.75);Object.assign(flora[flora.length-1],{playerMade:true,hp:makeBush?1:3,res:makeBush?'food':'wood'});card(makeBush?'Ягодный куст':'Дерево',makeBush?'Посажен источник еды.':'Посажен источник дерева.');
    }else if(kind==='fire'){
      add(structures,'camp',x,y,.68,tx+ty+.75);structures[structures.length-1].built=true;card('Костёр','Поставлен новый костёр.');
    }else if(kind==='home'){
      add(structures,'blueprint',x,y,.72,tx+ty+.75);Object.assign(structures[structures.length-1],{need:{wood:8,stone:3},built:false,progress:0});card('Чертёж дома','Нужно: 8 wood и 3 stone. Жители построят, когда хватит ресурсов.');
    }
    sortStatic();save();updateHud();
  }
  function nearest(ch,list,filter){let best=null,bd=999;for(const o of list){if(filter&&!filter(o))continue;const d=Math.hypot(o.x-ch.x,o.y-ch.y);if(d<bd){bd=d;best=o}}return best}
  function setTarget(ch,obj,job){ch.targetX=obj.x;ch.targetY=obj.y;ch.jobObj=obj;ch.need=job;ch.wait=0}
  function chooseWork(ch){
    const bp=nearest(ch,structures,o=>o.kind==='blueprint'&&!o.built&&state.wood>=o.need.wood&&state.stone>=o.need.stone);
    if(bp){setTarget(ch,bp,'build');return true}
    if(ch.hunger<60){const b=nearest(ch,flora,o=>o.kind==='bush');if(b){setTarget(ch,b,'forage');return true}}
    const r=nearest(ch,flora,o=>o.res&&(o.kind==='tree'||o.kind==='rock'||o.kind==='pebble'||o.kind==='bush'));
    if(r){setTarget(ch,r,'gather');return true}
    return false;
  }
  const oldSelect=selectAt;
  selectAt=function(clientX,clientY){if(state.mode==='hand'||currentTool==='hand')return oldSelect(clientX,clientY);const p=mapPoint(clientX,clientY);if(state.mode==='nature'||currentTool==='nature')return place('nature',p.x,p.y);if(state.mode==='fire'||currentTool==='fire')return place('fire',p.x,p.y);if(state.mode==='home'||currentTool==='home')return place('home',p.x,p.y);oldSelect(clientX,clientY)};
  document.querySelectorAll('.toolbar button').forEach(btn=>{btn.addEventListener('click',()=>{const tool=btn.dataset.tool||'hand';if(tool==='fast'){state.speed=state.speed===1?2:1;btn.textContent=state.speed===1?'Fast':'x2';card('Скорость','Скорость мира: x'+state.speed);return}state.mode=tool;currentTool=tool;document.querySelectorAll('.toolbar button').forEach(b=>b.classList.toggle('active',b===btn));const hints={hand:'Нажми на жителя или объект.',nature:'Нажми на землю: посадить дерево/ягоды.',home:'Нажми на землю: поставить чертёж дома.',fire:'Нажми на землю: поставить костёр.',water:'Позже: инструмент воды.'};card(tool[0].toUpperCase()+tool.slice(1),hints[tool]||'Инструмент выбран.')},true)});
  const oldSort=sortStatic;sortStatic=function(){oldSort();updateHud()};
  const prevUpdate=updatePeople;
  updatePeople=function(dt){
    ensureResources();
    const scaled=dt*(state.speed||1);
    prevUpdate(scaled);
    for(const ch of chars){
      if((!ch.need||ch.need==='wander'||ch.need==='idle'||ch.need==='hungry')&&!ch.wait)chooseWork(ch);
      if(ch.need==='gather'&&ch.jobObj&&flora.includes(ch.jobObj)&&Math.hypot(ch.x-ch.jobObj.x,ch.y-ch.jobObj.y)<.12){
        ch.work=(ch.work||0)+scaled;
        if(ch.work>.75){ch.work=0;const o=ch.jobObj,rr=o.res||resourceOf(o.kind);state[rr]=(state[rr]||0)+1;o.hp=(o.hp||1)-1;card('Сбор','+'+rr+' · '+Math.floor(state[rr]));if(o.hp<=0){flora.splice(flora.indexOf(o),1);sortStatic()}ch.need='idle';ch.wait=20;save();updateHud()}
      }
      if(ch.need==='build'&&ch.jobObj&&structures.includes(ch.jobObj)&&Math.hypot(ch.x-ch.jobObj.x,ch.y-ch.jobObj.y)<.14){
        const bp=ch.jobObj;if(state.wood>=bp.need.wood&&state.stone>=bp.need.stone){bp.progress=(bp.progress||0)+scaled*.55;card('Стройка','Дом строится: '+Math.floor(bp.progress*100)+'%');if(bp.progress>=1){state.wood-=bp.need.wood;state.stone-=bp.need.stone;bp.kind='house';bp.built=true;bp.s=.62;card('Дом построен','Жители построили первый дом.');sortStatic();save();updateHud();ch.need='idle';ch.wait=40}}
      }
    }
  };
  function drawBlueprint(o){const p=iso(o.x,o.y,0);ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.7,o.s||.7);ctx.globalAlpha=.74;dia(0,14,54,27,'#cfb16b','rgba(255,245,180,.5)');ctx.strokeStyle='#f3d680';ctx.lineWidth=3;ctx.strokeRect(-18,-8,36,25);ctx.beginPath();ctx.moveTo(-23,-8);ctx.lineTo(0,-27);ctx.lineTo(23,-8);ctx.stroke();ctx.fillStyle='#fff0a6';ctx.font='11px sans-serif';ctx.fillText(Math.floor((o.progress||0)*100)+'%',-12,28);ctx.globalAlpha=1;ctx.restore()}
  function houseDraw(o){const p=iso(o.x,o.y,0);ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.62,o.s||.62);ctx.fillStyle='rgba(0,0,0,.28)';blob(0,31,36,10);ctx.fillStyle='#b97638';ctx.fillRect(-20,0,40,35);ctx.fillStyle='#f2cf82';ctx.fillRect(-15,8,8,9);ctx.fillRect(7,8,8,9);ctx.fillStyle='#5a2e1f';ctx.fillRect(-7,16,14,20);ctx.fillStyle='#8f3f22';ctx.beginPath();ctx.moveTo(-30,2);ctx.lineTo(0,-24);ctx.lineTo(30,2);ctx.fill();ctx.fillStyle='#c96d32';ctx.beginPath();ctx.moveTo(-22,0);ctx.lineTo(0,-17);ctx.lineTo(22,0);ctx.fill();ctx.restore()}
  const oldDrawLayer=drawLayer;
  drawLayer=function(list){for(const o of list){if(o.kind==='blueprint'){drawBlueprint(o);continue}if(o.kind==='house'){houseDraw(o);continue}const p=iso(o.x,o.y,0);({meadow,leaf,flowers,dirt,path:pathPatch,camp,tree,bush,rock,pebble}[o.kind]||(()=>{}))(p.x,p.y,o.s)}};
  load();ensureResources();updateHud();card('Sandbox','Ресурсы, сбор и строительство включены.');
})();

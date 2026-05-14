// YourWill quality pass v3
// Branch: cozy-current only. Cleaner HUD, smarter work split, nicer blueprint/selection/coast.
(function(){
  const fx=[];
  window.ywFx=fx;
  let selected=null;
  let qualityMsg='живой лагерь';
  const assigned=new WeakMap();

  const style=document.createElement('style');
  style.textContent=`#yw-info-panel{display:none!important}.topbar .res{display:none!important}.card{opacity:.96}`;
  document.head.appendChild(style);

  function st(){return window.ywState||(window.ywState={wood:0,food:0,stone:0,mode:'hand',speed:1})}
  function addFx(x,y,kind,txt=''){fx.push({x,y,kind,txt,l:70,t:0})}
  function d(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function resOf(o){return o.res||(o.kind==='tree'?'wood':o.kind==='rock'||o.kind==='pebble'?'stone':o.kind==='bush'?'food':null)}
  function nearest(ch,list,filter){let best=null,bd=999;for(const o of list){if(filter&&!filter(o))continue;if(assigned.get(o)&&assigned.get(o)!==ch)continue;const dd=d(ch,o);if(dd<bd){bd=dd;best=o}}return best}
  function target(ch,o,job){if(ch.jobObj)assigned.delete(ch.jobObj);ch.targetX=o.x;ch.targetY=o.y;ch.jobObj=o;ch.need=job;ch.wait=0;ch.work=0;assigned.set(o,ch)}
  function release(ch){if(ch.jobObj)assigned.delete(ch.jobObj);ch.jobObj=null}

  const prevDrawTile=drawTile;
  drawTile=function(q){
    prevDrawTile(q);
    const p=iso(q.x,q.y,q.h);
    if(q.type==='shore'){
      ctx.save();
      ctx.globalAlpha=.72;pathD(p.x,p.y+4,TW*.84,TH*.40);ctx.fillStyle='#d4ad64';ctx.fill();
      ctx.globalAlpha=.22;pathD(p.x,p.y+1,TW*.54,TH*.22);ctx.fillStyle='#f1d58d';ctx.fill();
      ctx.globalAlpha=.16;ctx.strokeStyle='#8a6739';ctx.beginPath();ctx.moveTo(p.x-16,p.y+5);ctx.lineTo(p.x-4,p.y+7);ctx.moveTo(p.x+8,p.y+3);ctx.lineTo(p.x+18,p.y+5);ctx.stroke();
      ctx.restore();
    }else if(q.type==='water'){
      ctx.save();ctx.globalAlpha=.10;pathD(p.x,p.y-2,TW*.50,TH*.22);ctx.fillStyle='#d8fbff';ctx.fill();ctx.restore();
    }else if((q.type==='grass'||q.type==='flower'||q.type==='bushTile')&&((q.x*13+q.y*19)%6===0)){
      ctx.save();ctx.globalAlpha=.08;pathD(p.x+3,p.y+1,TW*.30,TH*.14);ctx.fillStyle='#a7ce64';ctx.fill();ctx.restore();
    }
  };

  const oldUpdate=updatePeople;
  updatePeople=function(dt){
    oldUpdate(dt);
    const s=st();
    for(const ch of chars){
      if(ch.health<=0)continue;
      const busy=['chop','mine','forage','build'].includes(ch.need);
      if(!busy && (!ch.wait||ch.wait<8)){
        const bp=nearest(ch,structures,o=>o.kind==='blueprint'&&!o.built&&s.wood>=8&&s.stone>=3);
        if(bp){target(ch,bp,'build');continue}
        if(ch.hunger<78){const b=nearest(ch,flora,o=>o.kind==='bush');if(b){target(ch,b,'forage');continue}}
        const tree=nearest(ch,flora,o=>o.kind==='tree');
        const rock=nearest(ch,flora,o=>o.kind==='rock'||o.kind==='pebble');
        const pick=(tree&&rock)?(d(ch,tree)<d(ch,rock)?tree:rock):(tree||rock);
        if(pick)target(ch,pick,pick.kind==='tree'?'chop':'mine');
      }
      if(ch.jobObj&&['chop','mine','forage','build'].includes(ch.need)){
        const o=ch.jobObj;
        if((flora.includes(o)||structures.includes(o))&&Math.hypot(ch.x-o.x,ch.y-o.y)<.20){
          ch.mode='work';ch.work=(ch.work||0)+dt;ch.dir=o.x>=ch.x?1:-1;
          if(ch.need==='chop'&&Math.floor(ch.work*14)%2===0)addFx(o.x,o.y,'wood');
          if(ch.need==='mine'&&Math.floor(ch.work*11)%2===0)addFx(o.x,o.y,'stone');
          if(ch.need==='forage'&&Math.floor(ch.work*8)%2===0)addFx(o.x,o.y,'berry');
          if(ch.need==='build'&&Math.floor(ch.work*8)%2===0)addFx(o.x,o.y,'build');
          if(ch.work>1.0){
            ch.work=0;
            if(ch.need==='build'){
              if(s.wood>=8&&s.stone>=3){s.wood-=8;s.stone-=3;o.kind='house';o.built=true;o.s=.60;addFx(o.x,o.y,'text','Дом');qualityMsg='дом построен';setCard('Дом построен','Жители построили дом.');sortStatic()}
            }else{
              const r=resOf(o);if(r){s[r]=(s[r]||0)+1;addFx(o.x,o.y,'text','+'+r);qualityMsg='+'+r}
              if(ch.need==='forage')ch.hunger=Math.min(100,(ch.hunger||50)+30);
              o.hp=(o.hp||(o.kind==='tree'?3:1))-1;
              if(o.hp<=0&&flora.includes(o)){flora.splice(flora.indexOf(o),1);sortStatic()}
            }
            ch.need='idle';release(ch);ch.wait=16;
          }
        }
      }
    }
  };

  const oldPerson=person;
  person=function(ch){
    if(ch.mode!=='work')return oldPerson(ch);
    const p=iso(ch.x,ch.y,0),s=.49*(ch.body||1),sw=Math.sin((ch.work||0)*22);
    ctx.save();ctx.translate(p.x,p.y-5+Math.abs(sw)*1.2);ctx.scale(s*ch.dir,s);
    ctx.fillStyle='rgba(0,0,0,.24)';blob(0,22,12,4);
    ctx.fillStyle=ch.pants||'#222';roundRect(-6,7,4,14,1.5,ch.pants||'#222');roundRect(2,7,4,14,1.5,ch.pants||'#222');roundRect(-9,-8,18,18,4,ch.shirt||'#b76');
    ctx.fillStyle=ch.skin||'#d89a67';ctx.fillRect(-12,-4,4,13);ctx.fillRect(8,-4,4,13);
    ctx.save();ctx.translate(7,-10);ctx.rotate(-.9+sw*.75);ctx.fillStyle='#6b4325';ctx.fillRect(0,-13,4,27);ctx.fillStyle=ch.need==='mine'?'#8f8f84':ch.need==='build'?'#d5b15f':'#c78b35';ctx.fillRect(-3,-17,10,6);ctx.restore();
    ctx.beginPath();ctx.ellipse(0,-18,9,10,0,0,Math.PI*2);ctx.fillStyle=ch.skin||'#d89a67';ctx.fill();ctx.fillStyle=ch.hair||'#231';ctx.fillRect(-8,-27,16,8);ctx.fillRect(-9,-22,5,8);
    ctx.fillStyle='#1d1714';ctx.fillRect(-4,-18,2,2);ctx.fillRect(4,-18,2,2);ctx.restore();
  };

  const oldDrawLayer=drawLayer;
  drawLayer=function(list){
    for(const o of list){
      if(o.kind==='blueprint'){
        const p=iso(o.x,o.y,0);ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.62,o.s||.62);ctx.globalAlpha=.62;dia(0,14,52,25,'#bca161','rgba(255,235,160,.38)');ctx.strokeStyle='#e8cc79';ctx.lineWidth=2;ctx.strokeRect(-17,-7,34,24);ctx.beginPath();ctx.moveTo(-22,-7);ctx.lineTo(0,-26);ctx.lineTo(22,-7);ctx.stroke();ctx.restore();continue;
      }
      if(o.kind==='house'){
        const p=iso(o.x,o.y,0);ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.60,o.s||.60);ctx.fillStyle='rgba(0,0,0,.30)';blob(0,32,38,10);ctx.fillStyle='#b8793d';ctx.fillRect(-21,0,42,35);ctx.fillStyle='#f4cf82';ctx.fillRect(-16,8,8,9);ctx.fillRect(8,8,8,9);ctx.fillStyle='#4d291d';ctx.fillRect(-7,16,14,20);ctx.fillStyle='#74361f';ctx.beginPath();ctx.moveTo(-32,2);ctx.lineTo(0,-26);ctx.lineTo(32,2);ctx.fill();ctx.fillStyle='#c86d31';ctx.beginPath();ctx.moveTo(-23,0);ctx.lineTo(0,-18);ctx.lineTo(23,0);ctx.fill();ctx.restore();continue;
      }
      const p=iso(o.x,o.y,0);({meadow,leaf,flowers,dirt,path:pathPatch,camp,tree,bush,rock,pebble}[o.kind]||(()=>{}))(p.x,p.y,o.s);
    }
  };

  const oldSelect=selectAt;
  selectAt=function(clientX,clientY){oldSelect(clientX,clientY);selected=null;const sx=clientX*DPR,sy=clientY*DPR;function sp(o,z=0){const p=iso(o.x,o.y,z),ox=cam.x/(cam.z*DPR)-40,oy=cam.y/(cam.z*DPR)-18;return{x:(p.x+ox)*cam.z*DPR,y:(p.y+oy)*cam.z*DPR}}let bd=999;for(const o of [...chars,...structures,...flora]){const p=sp(o,0),dd=Math.hypot(p.x-sx,p.y-sy);if(dd<55*DPR&&dd<bd){bd=dd;selected=o}}};

  const oldDraw=draw;
  draw=function(){
    oldDraw();
    ctx.save();ctx.scale(DPR*cam.z,DPR*cam.z);ctx.translate(cam.x/(cam.z*DPR)-40,cam.y/(cam.z*DPR)-18);
    if(selected){const p=iso(selected.x,selected.y,0);ctx.globalAlpha=.55;ctx.strokeStyle='#fff09a';ctx.lineWidth=2;pathD(p.x,p.y+8,42,20);ctx.stroke();ctx.globalAlpha=1}
    for(const ch of chars){if(['chop','mine','forage','build'].includes(ch.need)){const p=iso(ch.x,ch.y,26),label=ch.need==='chop'?'🪓':ch.need==='mine'?'⛏':ch.need==='forage'?'🍓':'🔨';ctx.font='15px sans-serif';ctx.fillText(label,p.x-8,p.y-10)}}
    for(let i=fx.length-1;i>=0;i--){const f=fx[i],p=iso(f.x,f.y,24+f.t*.25);f.t++;f.l--;ctx.globalAlpha=Math.max(0,f.l/70);if(f.kind==='wood'){ctx.fillStyle='#8b5a2b';ctx.fillRect(p.x-3,p.y,12,3)}else if(f.kind==='stone'){ctx.fillStyle='#aaa';blob(p.x,p.y,5,3)}else if(f.kind==='berry'){ctx.fillStyle='#ff5f5b';blob(p.x,p.y,5,4)}else if(f.kind==='build'){ctx.fillStyle='#ffd36a';ctx.fillRect(p.x-3,p.y-3,6,6)}else{ctx.fillStyle='#fff0a6';ctx.font='12px system-ui';ctx.fillText(f.txt,p.x-10,p.y)}ctx.globalAlpha=1;if(f.l<=0)fx.splice(i,1)}
    ctx.restore();
    const s=st();ctx.save();ctx.setTransform(1,0,0,1,0,0);const x=42*DPR,y=84*DPR,w=Math.min(canvas.width-84*DPR,430*DPR),h=28*DPR;ctx.fillStyle='rgba(8,24,20,.78)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(240,220,150,.20)';ctx.strokeRect(x,y,w,h);ctx.fillStyle='#f6e4aa';ctx.font=(10.5*DPR)+'px system-ui,sans-serif';ctx.fillText(`D1 · 👥${chars.length} · 🍓${Math.floor(s.food||0)} · 🪵${Math.floor(s.wood||0)} · 🪨${Math.floor(s.stone||0)} · ${qualityMsg}`,x+9*DPR,y+18*DPR);ctx.restore();
  };
  qualityMsg='работы включены';setCard('Quality v3','HUD очищен, задачи разделяются, чертёж меньше.');
})();

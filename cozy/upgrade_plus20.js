// YourWill visible gameplay upgrade
// Branch: cozy-current only. Adds visible work animations, action FX, stronger coast, and resource tasks.
(function(){
  const fx=[];
  window.ywFx=fx;
  function addFx(x,y,kind,txt=''){fx.push({x,y,kind,txt,l:70,t:0})}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function nearest(ch,list,filter){let best=null,bd=999;for(const o of list){if(filter&&!filter(o))continue;const d=dist(ch,o);if(d<bd){bd=d;best=o}}return best}
  function resOf(o){return o.res||(o.kind==='tree'?'wood':o.kind==='rock'||o.kind==='pebble'?'stone':o.kind==='bush'?'food':null)}
  function target(ch,o,job){ch.targetX=o.x;ch.targetY=o.y;ch.jobObj=o;ch.need=job;ch.wait=0;ch.work=0}

  // Force clear visible coast while terrain-pack issue is being fixed.
  const prevDrawTile=drawTile;
  drawTile=function(q){
    prevDrawTile(q);
    if(q.type==='shore'){
      const p=iso(q.x,q.y,q.h);
      ctx.save();ctx.globalAlpha=.8;
      pathD(p.x,p.y+2,TW*.92,TH*.48);ctx.fillStyle='#d8b166';ctx.fill();
      ctx.globalAlpha=.35;pathD(p.x,p.y,TW*.64,TH*.28);ctx.fillStyle='#f0d184';ctx.fill();
      ctx.globalAlpha=1;ctx.restore();
    }
  };

  const oldUpdate=updatePeople;
  updatePeople=function(dt){
    oldUpdate(dt);
    const state=window.ywState||{wood:0,stone:0,food:0};
    for(const ch of chars){
      if(ch.health<=0)continue;
      const busy=['chop','mine','forage','build'].includes(ch.need);
      if(!busy && (!ch.wait||ch.wait<8)){
        const bp=nearest(ch,structures,o=>o.kind==='blueprint'&&!o.built&&state.wood>=8&&state.stone>=3);
        if(bp){target(ch,bp,'build');continue}
        if(ch.hunger<72){const b=nearest(ch,flora,o=>o.kind==='bush');if(b){target(ch,b,'forage');continue}}
        const tree=nearest(ch,flora,o=>o.kind==='tree');
        const rock=nearest(ch,flora,o=>o.kind==='rock'||o.kind==='pebble');
        const pick=(tree&&rock)?(dist(ch,tree)<dist(ch,rock)?tree:rock):(tree||rock);
        if(pick)target(ch,pick,pick.kind==='tree'?'chop':'mine');
      }
      if(ch.jobObj&&['chop','mine','forage','build'].includes(ch.need)){
        const o=ch.jobObj;
        if((flora.includes(o)||structures.includes(o))&&Math.hypot(ch.x-o.x,ch.y-o.y)<.17){
          ch.mode='work';ch.work=(ch.work||0)+dt;ch.dir=o.x>=ch.x?1:-1;
          if(ch.need==='chop'&&Math.floor(ch.work*10)%2===0)addFx(o.x,o.y,'wood');
          if(ch.need==='mine'&&Math.floor(ch.work*8)%2===0)addFx(o.x,o.y,'stone');
          if(ch.need==='build'&&Math.floor(ch.work*7)%2===0)addFx(o.x,o.y,'build');
          if(ch.work>.9){
            ch.work=0;
            if(ch.need==='build'){
              if(state.wood>=8&&state.stone>=3){state.wood-=8;state.stone-=3;o.kind='house';o.built=true;o.s=.62;addFx(o.x,o.y,'text','Дом');setCard('Дом построен','Жители построили дом.');sortStatic()}
            }else{
              const r=resOf(o);if(r){state[r]=(state[r]||0)+1;addFx(o.x,o.y,'text','+'+r)}
              if(ch.need==='forage')ch.hunger=Math.min(100,(ch.hunger||50)+26);
              o.hp=(o.hp||(o.kind==='tree'?3:1))-1;
              if(o.hp<=0&&flora.includes(o)){flora.splice(flora.indexOf(o),1);sortStatic()}
            }
            ch.need='idle';ch.jobObj=null;ch.wait=20;
          }
        }
      }
    }
  };

  const oldPerson=person;
  person=function(ch){
    if(ch.mode!=='work')return oldPerson(ch);
    const p=iso(ch.x,ch.y,0),s=.48*(ch.body||1),swing=Math.sin((ch.work||0)*18);
    ctx.save();ctx.translate(p.x,p.y-5);ctx.scale(s*ch.dir,s);
    ctx.fillStyle='rgba(0,0,0,.22)';blob(0,22,11,4);
    ctx.fillStyle=ch.pants||'#222';roundRect(-6,7,4,14,1.5,ch.pants||'#222');roundRect(2,7,4,14,1.5,ch.pants||'#222');
    roundRect(-9,-8,18,18,4,ch.shirt||'#b76');
    ctx.fillStyle=ch.skin||'#d89a67';ctx.fillRect(-12,-4,4,13);ctx.fillRect(8,-4,4,13);
    ctx.save();ctx.rotate(-.55+swing*.45);ctx.fillStyle='#6b4325';ctx.fillRect(7,-18,4,25);ctx.fillStyle=ch.need==='mine'?'#8b8b80':'#c78b35';ctx.fillRect(5,-22,9,6);ctx.restore();
    ctx.beginPath();ctx.ellipse(0,-18,9,10,0,0,Math.PI*2);ctx.fillStyle=ch.skin||'#d89a67';ctx.fill();ctx.fillStyle=ch.hair||'#231';ctx.fillRect(-8,-27,16,8);ctx.fillRect(-9,-22,5,8);
    ctx.fillStyle='#1d1714';ctx.fillRect(-4,-18,2,2);ctx.fillRect(4,-18,2,2);ctx.restore();
  };

  const oldDrawLayer=drawLayer;
  drawLayer=function(list){
    for(const o of list){
      if(o.kind==='blueprint'){
        const p=iso(o.x,o.y,0);ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.72,o.s||.72);ctx.globalAlpha=.86;dia(0,14,58,29,'#d1b16a','rgba(255,245,180,.6)');ctx.strokeStyle='#ffe08a';ctx.lineWidth=3;ctx.strokeRect(-19,-8,38,27);ctx.beginPath();ctx.moveTo(-25,-8);ctx.lineTo(0,-30);ctx.lineTo(25,-8);ctx.stroke();ctx.restore();continue;
      }
      if(o.kind==='house'){
        const p=iso(o.x,o.y,0);ctx.save();ctx.translate(p.x,p.y);ctx.scale(o.s||.62,o.s||.62);ctx.fillStyle='rgba(0,0,0,.30)';blob(0,32,38,10);ctx.fillStyle='#b8793d';ctx.fillRect(-21,0,42,35);ctx.fillStyle='#f4cf82';ctx.fillRect(-16,8,8,9);ctx.fillRect(8,8,8,9);ctx.fillStyle='#4d291d';ctx.fillRect(-7,16,14,20);ctx.fillStyle='#74361f';ctx.beginPath();ctx.moveTo(-32,2);ctx.lineTo(0,-26);ctx.lineTo(32,2);ctx.fill();ctx.fillStyle='#c86d31';ctx.beginPath();ctx.moveTo(-23,0);ctx.lineTo(0,-18);ctx.lineTo(23,0);ctx.fill();ctx.restore();continue;
      }
      const p=iso(o.x,o.y,0);({meadow,leaf,flowers,dirt,path:pathPatch,camp,tree,bush,rock,pebble}[o.kind]||(()=>{}))(p.x,p.y,o.s);
    }
  };

  const oldDraw=draw;
  draw=function(){
    oldDraw();
    ctx.save();ctx.scale(DPR*cam.z,DPR*cam.z);ctx.translate(cam.x/(cam.z*DPR)-40,cam.y/(cam.z*DPR)-18);
    for(let i=fx.length-1;i>=0;i--){const f=fx[i],p=iso(f.x,f.y,24+f.t*.25);f.t++;f.l--;ctx.globalAlpha=Math.max(0,f.l/70);if(f.kind==='wood'){ctx.fillStyle='#8b5a2b';ctx.fillRect(p.x-3,p.y,12,3)}else if(f.kind==='stone'){ctx.fillStyle='#aaa';blob(p.x,p.y,5,3)}else if(f.kind==='build'){ctx.fillStyle='#ffd36a';ctx.fillRect(p.x-3,p.y-3,6,6)}else{ctx.fillStyle='#fff0a6';ctx.font='12px system-ui';ctx.fillText(f.txt,p.x-10,p.y)}ctx.globalAlpha=1;if(f.l<=0)fx.splice(i,1)}
    ctx.restore();
  };
  setCard('Upgrade','Анимации рубки/добычи/стройки включены.');
})();

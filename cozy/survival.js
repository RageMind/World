// YourWill survival layer
// Safe overlay over current visual prototype. Do not replace main renderer here.
(function(){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const names=['Alina','Miro','Torn','Nora'];
  const camp=()=>structures.find(o=>o.kind==='camp')||{x:12.15,y:10.45,kind:'camp'};

  function initNeed(ch,i){
    if(ch.survivalReady)return;
    ch.name=ch.name||names[i%names.length];
    ch.hunger=ch.hunger??(78+i*8);
    ch.energy=ch.energy??(88-i*5);
    ch.health=ch.health??100;
    ch.need='wander';
    ch.work=0;
    ch.survivalReady=true;
  }

  function nearest(ch,kind){
    let best=null,bd=999;
    for(const o of flora){
      if(o.kind!==kind)continue;
      const d=Math.hypot(o.x-ch.x,o.y-ch.y);
      if(d<bd){bd=d;best=o;}
    }
    return best;
  }

  function setTarget(ch,x,y,need,obj=null){
    ch.targetX=x;
    ch.targetY=y;
    ch.need=need;
    ch.targetObj=obj;
    ch.wait=0;
  }

  function chooseWander(ch,i){
    const wp=waypoints[Math.abs((i*2+(t/120|0)))%waypoints.length];
    setTarget(ch,wp.x+rnd(-.12,.12,i,t),wp.y+rnd(-.1,.1,i,t+5),'wander');
  }

  function chooseNeed(ch,i){
    if(ch.health<=0){ch.need='down';return;}
    if(ch.energy<28){
      const c=camp();
      setTarget(ch,c.x+rnd(-.25,.25,i,t),c.y+rnd(-.18,.18,i,t+7),'rest',c);
      return;
    }
    if(ch.hunger<58){
      const b=nearest(ch,'bush');
      if(b){setTarget(ch,b.x,b.y,'forage',b);return;}
      const c=camp();
      setTarget(ch,c.x+rnd(-.2,.2,i,t),c.y+rnd(-.18,.18,i,t+9),'hungry',c);
      return;
    }
    chooseWander(ch,i);
  }

  function showInfo(ch){
    const state=ch.health<=0?'без сил':ch.need==='forage'?'ищет еду':ch.need==='rest'?'отдыхает':ch.need==='hungry'?'голоден':ch.mode==='walk'?'идёт':'стоит';
    setCard(ch.name||'Villager',`Состояние: ${state}. Еда ${Math.round(ch.hunger)}/100 · энергия ${Math.round(ch.energy)}/100 · здоровье ${Math.round(ch.health)}/100`);
  }

  const oldSelect=selectAt;
  selectAt=function(clientX,clientY){
    if(currentTool!=='hand')return;
    const p=invIso(clientX*DPR,clientY*DPR);
    let best=null,dist=1e9;
    for(let i=0;i<chars.length;i++){
      const ch=chars[i],d=Math.hypot(ch.x-p.x,ch.y-p.y);
      if(d<.65&&d<dist){best=ch;dist=d;}
    }
    if(best){showInfo(best);return;}
    oldSelect(clientX,clientY);
  };

  updatePeople=function(dt){
    for(let i=0;i<chars.length;i++){
      const ch=chars[i];
      initNeed(ch,i);

      if(ch.health<=0){
        ch.mode='idle';
        ch.depth=ch.x+ch.y+1.12;
        continue;
      }

      const moving=ch.mode==='walk';
      ch.hunger=clamp(ch.hunger-dt*(moving?.72:.42),0,100);
      ch.energy=clamp(ch.energy-dt*(moving?.55:.22),0,100);
      if(ch.hunger<=0)ch.health=clamp(ch.health-dt*2.2,0,100);
      else if(ch.hunger>70&&ch.energy>55)ch.health=clamp(ch.health+dt*.25,0,100);

      if(ch.wait>0){
        ch.wait-=dt*60;
        ch.mode='idle';
        if(ch.wait<=0)chooseNeed(ch,i);
        ch.depth=ch.x+ch.y+1.12;
        continue;
      }

      let dx=ch.targetX-ch.x,dy=ch.targetY-ch.y,dist=Math.hypot(dx,dy);

      if(dist<.07){
        ch.mode='idle';
        if(ch.need==='rest'){
          ch.energy=clamp(ch.energy+dt*12,0,100);
          if(ch.energy>82){ch.wait=30+rnd(0,35,i,t);chooseNeed(ch,i);}
        }else if(ch.need==='forage'){
          if(!ch.targetObj||!flora.includes(ch.targetObj)||ch.targetObj.kind!=='bush'){
            chooseNeed(ch,i);
          }else{
            ch.work+=dt;
            if(ch.work>.9){
              ch.work=0;
              ch.hunger=clamp(ch.hunger+38,0,100);
              flora.splice(flora.indexOf(ch.targetObj),1);
              sortStatic();
              setCard(ch.name||'Villager','Собрал ягоды и поел. Еда '+Math.round(ch.hunger)+'/100.');
              ch.wait=25+rnd(0,35,i,t);
              chooseNeed(ch,i);
            }
          }
        }else if(ch.need==='hungry'){
          ch.health=clamp(ch.health-dt*.55,0,100);
          if(ch.hunger>60||ch.energy<25)chooseNeed(ch,i);
        }else{
          ch.wait=30+rnd(0,90,i,t);
          chooseNeed(ch,i);
        }
      }else{
        const slow=ch.hunger<18?.48:ch.energy<20?.6:1;
        const step=Math.min(dist,ch.speed*dt*60*slow);
        ch.x+=dx/dist*step;
        ch.y+=dy/dist*step;
        ch.dir=dx>=0?1:-1;
        ch.mode='walk';
        ch.walk+=dt*7*slow;
      }
      ch.depth=ch.x+ch.y+1.12;
    }
  };

  chars.forEach(initNeed);
  setCard('Survival','Жители теперь голодают, устают, отдыхают у костра и ищут ягоды.');
})();

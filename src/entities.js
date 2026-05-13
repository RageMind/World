class Entity {
  constructor(x, z, world) {
    this.x  = x;  // world X (can be fractional)
    this.z  = z;  // world Z (can be fractional)
    this.world = world;
    this.id = Entity._nextId++;
    this.alive = true;
    this.tickCount = 0;
  }
}
Entity._nextId = 1;

class Troglyte extends Entity {
  constructor(x, z, world, isElder = false) {
    super(x, z, world);
    this.isElder   = isElder;
    this.name      = this._genName();
    this.health    = 100;
    this.maxHealth = isElder ? 120 : 100;
    this.hunger    = 80 + Math.random() * 20;
    this.happiness = 60 + Math.random() * 30;
    this.energy    = 90 + Math.random() * 10;
    this.age       = 0;
    this.state     = ES.IDLE;
    this.stateTimer = 0;
    this.dir       = Math.random() * Math.PI * 2;  // facing angle
    this.targetX   = x;
    this.targetZ   = z;
    this.walkSpeed = 0.04 + Math.random() * 0.02;
    this.speechText  = '';
    this.speechTimer = 0;
    this.deathTimer  = 0;
    this.deathAlpha  = 1;
    this._deathCause = '';
    this.generation  = 0;
    this.builtCount  = 0;
    this.inventory   = { food: 0, ore: 0, wood: 0 };
    this.homeX = x; this.homeZ = z;
    this.animPhase = Math.random() * Math.PI * 2;  // walk cycle offset
    // Appearance
    this.skinColor  = this._pickSkin();
    this.eyeColor   = isElder ? '#ffd700' : this._pickEye();
    this.clothColor = this._pickCloth();
    this.clothColor2 = this._pickCloth2();
  }

  _genName() {
    const arr = Math.random() < 0.5 ? TROGLYTE_NAMES_M : TROGLYTE_NAMES_F;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  _pickSkin()   { return ['#8aa0a8','#6a7880','#9ab4b8','#7a8e96','#5a6870','#aabcbc'][Math.floor(Math.random()*6)]; }
  _pickEye()    { return ['#88ffaa','#66ddcc','#aaffcc','#55eebb','#44dd99'][Math.floor(Math.random()*5)]; }
  _pickCloth()  { return ['#3a2820','#283840','#382030','#202838','#302820','#2a2040'][Math.floor(Math.random()*6)]; }
  _pickCloth2() { return ['#c87820','#4a8840','#8840a0','#205888','#882020','#886020'][Math.floor(Math.random()*6)]; }

  speak(text) { this.speechText = text; this.speechTimer = 160; }

  update(entityManager, time) {
    if (!this.alive) {
      this.deathTimer++;
      this.deathAlpha = Math.max(0, 1 - this.deathTimer / 80);
      return;
    }
    this.tickCount++;
    this.age += 0.003;
    this.animPhase += 0.18;
    if (this.speechTimer > 0) this.speechTimer--;

    // Stat decay
    this.hunger -= 0.018;
    this.energy -= this.state === ES.SLEEP ? -0.4 : 0.006;
    this.energy = Math.max(0, Math.min(100, this.energy));
    if (this.hunger < 30) this.happiness -= 0.025;
    if (this.hunger <= 0) { this.hunger = 0; this.health -= 0.12; }
    if (this.age > 85) this.health -= 0.03;
    if (this.health <= 0) { this.die('старость'); return; }

    const dayPhase = (time % CFG.DAY_TICKS) / CFG.DAY_TICKS;
    const isNight  = dayPhase > 0.62 || dayPhase < 0.12;

    if (isNight && this.energy < 40 && this.state !== ES.BUILD) {
      this._setState(ES.SLEEP);
    }

    this.stateTimer++;
    switch (this.state) {
      case ES.IDLE:    this._stateIdle(entityManager, time); break;
      case ES.WALK:    this._stateWalk(); break;
      case ES.EAT:     this._stateEat(); break;
      case ES.SLEEP:   this._stateSleep(dayPhase); break;
      case ES.BUILD:   this._stateBuild(); break;
      case ES.EXPLORE: this._stateExplore(); break;
      case ES.FLEE:    this._stateFlee(); break;
    }
  }

  _setState(s) { this.state = s; this.stateTimer = 0; }

  _stateIdle(em, time) {
    if (this.stateTimer < 20 + Math.random() * 40) return;
    const r = Math.random();
    if (this.hunger < 45) { this._setState(ES.EAT); }
    else if (r < 0.25) { this._setWalkTarget(4 + Math.random() * 8); }
    else if (r < 0.45) { this._setWalkTarget(8 + Math.random() * 16); this._setState(ES.EXPLORE); }
    else if (r < 0.55 && this.builtCount < 5) { this._setState(ES.BUILD); }
    else {
      if (Math.random() < 0.08) {
        const p = ['Что за день!', 'Голоден...', 'Красиво тут.', 'Надо работать!', '...', 'Слышали гром?'];
        this.speak(p[Math.floor(Math.random() * p.length)]);
      }
    }
  }

  _setWalkTarget(dist) {
    const angle = Math.random() * Math.PI * 2;
    let tx = this.x + Math.cos(angle) * dist;
    let tz = this.z + Math.sin(angle) * dist;
    tx = Math.max(1, Math.min(this.world.w - 2, tx));
    tz = Math.max(1, Math.min(this.world.d - 2, tz));
    this.targetX = tx; this.targetZ = tz;
    this._setState(ES.WALK);
  }

  _stateWalk() {
    if (this._moveToward(this.targetX, this.targetZ, this.walkSpeed) || this.stateTimer > 150) {
      this._setState(ES.IDLE);
    }
  }

  _stateExplore() {
    if (this._moveToward(this.targetX, this.targetZ, this.walkSpeed * 0.8) || this.stateTimer > 250) {
      this._setState(ES.IDLE);
    }
  }

  _stateEat() {
    if (this.hunger > 90 || this.stateTimer > 180) { this._setState(ES.IDLE); return; }
    // Find mushroom/flower within range
    const r = 6;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.round(this.x + dx), nz = Math.round(this.z + dz);
        const feat = this.world.getFeature(nx, nz);
        if (feat === FT.MUSHROOM || feat === FT.FLOWER) {
          if (this._moveToward(nx, nz, this.walkSpeed)) {
            this.world.setFeature(nx, nz, FT.NONE);
            this.hunger = Math.min(100, this.hunger + 45);
            this.health = Math.min(this.maxHealth, this.health + 8);
            this.happiness = Math.min(100, this.happiness + 8);
            this.speak('Вкусно!');
            this._setState(ES.IDLE);
          }
          return;
        }
      }
    }
    // Wander searching
    if (this.stateTimer % 40 === 0) this._setWalkTarget(4);
    this._stateWalk();
  }

  _stateSleep(dayPhase) {
    const isNight = dayPhase > 0.62 || dayPhase < 0.12;
    if (!isNight && this.energy > 75) {
      this._setState(ES.IDLE);
      if (Math.random() < 0.3) this.speak('Доброе утро!');
    }
  }

  _stateBuild() {
    if (this.stateTimer > 250) { this._setState(ES.IDLE); return; }
    const ix = Math.round(this.x), iz = Math.round(this.z);
    // Find adjacent grass tile to place house
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = ix + dx, nz = iz + dz;
        if (this.world.getType(nx, nz) === ST.GRASS && this.world.getFeature(nx, nz) === FT.NONE) {
          if (this._moveToward(nx, nz, this.walkSpeed)) {
            if (this.stateTimer > 80) {
              this.world.setFeature(nx, nz, FT.HOUSE);
              this.builtCount++;
              this.happiness = Math.min(100, this.happiness + 12);
              this.speak('Построил!');
              this._setState(ES.IDLE);
            }
          }
          return;
        }
      }
    }
    this._setState(ES.IDLE);
  }

  _stateFlee() {
    const angle = this.dir + Math.PI;
    const tx = this.x + Math.cos(angle) * 8;
    const tz = this.z + Math.sin(angle) * 8;
    this._moveToward(Math.max(1, Math.min(this.world.w-2, tx)), Math.max(1, Math.min(this.world.d-2, tz)), this.walkSpeed * 1.5);
    if (this.stateTimer > 80) this._setState(ES.IDLE);
  }

  _moveToward(tx, tz, speed) {
    const dx = tx - this.x, dz = tz - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < speed * 1.5) return true;

    this.dir = Math.atan2(dz, dx);
    const nx = this.x + (dx / dist) * speed;
    const nz = this.z + (dz / dist) * speed;
    const bx = Math.round(nx), bz = Math.round(nz);

    if (this.world.isWalkable(bx, bz)) {
      this.x = Math.max(0.5, Math.min(this.world.w - 0.5, nx));
      this.z = Math.max(0.5, Math.min(this.world.d - 0.5, nz));
    } else {
      // Try to go around obstacle
      const alt = this.dir + (Math.random() < 0.5 ? 0.5 : -0.5);
      const ax = this.x + Math.cos(alt) * speed;
      const az = this.z + Math.sin(alt) * speed;
      if (this.world.isWalkable(Math.round(ax), Math.round(az))) {
        this.x = ax; this.z = az;
      }
    }
    return false;
  }

  die(cause) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.state = ES.DIE;
    this._deathCause = cause;
    this.speak('...');
  }

  getInfo() {
    const stateLabels = {
      [ES.IDLE]: 'Отдыхает', [ES.WALK]: 'Идёт',
      [ES.EAT]: 'Ищет еду', [ES.SLEEP]: 'Спит',
      [ES.BUILD]: 'Строит',  [ES.EXPLORE]: 'Исследует',
      [ES.FLEE]: 'Убегает',  [ES.DIE]: 'Умирает',
    };
    return {
      name: this.name,
      type: this.isElder ? 'Старейшина' : 'Трогглит',
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      hunger: Math.round(this.hunger),
      happiness: Math.round(this.happiness),
      energy: Math.round(this.energy),
      age: Math.round(this.age),
      state: stateLabels[this.state] || '—',
    };
  }
}

class EntityManager {
  constructor(world) {
    this.world   = world;
    this.entities = [];
    this.totalBorn  = 0;
    this.totalDied  = 0;
    this.time = 0;
    this.events = [];
  }

  spawn(x, z, isElder = false) {
    if (this.entities.filter(e => e.alive).length >= CFG.MAX_ENTITIES) return null;
    const e = new Troglyte(x, z, this.world, isElder);
    this.entities.push(e);
    this.totalBorn++;
    this._log(`${e.name} ${isElder ? '(Старейшина)' : ''} появился в мире`);
    return e;
  }

  spawnInitial(count) {
    const cx = Math.floor(this.world.w / 2);
    const cz = Math.floor(this.world.d / 2);
    for (let i = 0; i < count; i++) {
      for (let attempts = 0; attempts < 50; attempts++) {
        const x = cx + (Math.random() - 0.5) * 20;
        const z = cz + (Math.random() - 0.5) * 20;
        const bx = Math.round(x), bz = Math.round(z);
        if (this.world.isWalkable(bx, bz)) {
          this.spawn(x, z, i === 0);
          break;
        }
      }
    }
  }

  update() {
    this.time++;
    for (const e of this.entities) {
      e.update(this, this.time);
      if (!e.alive && e.deathTimer === 1) {
        this.totalDied++;
        this._log(`${e.name} погиб (${e._deathCause || 'неизвестно'})`);
      }
    }
    // Purge long-dead
    this.entities = this.entities.filter(e => e.alive || e.deathTimer < 100);

    // Reproduction
    if (this.time % 500 === 0) {
      const alive = this.entities.filter(e => e.alive);
      if (alive.length > 3 && alive.length < CFG.MAX_ENTITIES * 0.8) {
        const parent = alive[Math.floor(Math.random() * alive.length)];
        if (parent.happiness > 65 && parent.hunger > 55) {
          const child = this.spawn(parent.x + (Math.random()-0.5)*2, parent.z + (Math.random()-0.5)*2, false);
          if (child) {
            child.generation = parent.generation + 1;
            this._log(`${parent.name} стал родителем! Добро пожаловать, ${child.name}!`);
          }
        }
      }
    }
  }

  getAt(wx, wz, radius = 1.2) {
    return this.entities.find(e => e.alive && Math.hypot(e.x - wx, e.z - wz) < radius) || null;
  }

  getAliveCount()    { return this.entities.filter(e => e.alive).length; }
  getBuildingCount() { return this.entities.reduce((s, e) => s + (e.alive ? e.builtCount : 0), 0); }

  _log(msg) {
    this.events.unshift({ text: msg, time: this.time });
    if (this.events.length > 50) this.events.pop();
  }

  getRecentEvents(n = 10) { return this.events.slice(0, n); }
}

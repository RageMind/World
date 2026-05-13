class Entity {
  constructor(x, y, world) {
    this.x = x;
    this.y = y;
    this.world = world;
    this.vx = 0;
    this.vy = 0;
    this.id = Entity._nextId++;
    this.alive = true;
    this.age = 0;
    this.tickCount = 0;
  }
}
Entity._nextId = 1;

class Troglyte extends Entity {
  constructor(x, y, world, isElder = false) {
    super(x, y, world);
    this.isElder = isElder;
    this.name = this._genName();
    this.gender = Math.random() < 0.5 ? 'm' : 'f';
    this.health = 100;
    this.maxHealth = isElder ? 120 : 100;
    this.hunger = 80 + Math.random() * 20;
    this.happiness = 60 + Math.random() * 30;
    this.energy = 90 + Math.random() * 10;
    this.state = ES.IDLE;
    this.stateTimer = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.targetX = x;
    this.targetY = y;
    this.walkTimer = 0;
    this.speechText = '';
    this.speechTimer = 0;
    this.deathTimer = 0;
    this.deathAlpha = 1;
    this.skinColor = this._pickSkin();
    this.eyeColor = isElder ? '#ffd700' : this._pickEye();
    this.clothColor = this._pickCloth();
    this.jumpVy = 0;
    this.onGround = false;
    this.inventory = { food: 0, stone: 0, ore: 0 };
    this.homeX = x;
    this.homeY = y;
    this.relationship = null; // id of partner
    this.generation = 0;
    this.builtCount = 0;
  }

  _genName() {
    const arr = Math.random() < 0.5 ? TROGLYTE_NAMES_M : TROGLYTE_NAMES_F;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _pickSkin() {
    const skins = ['#7a8890', '#5a6870', '#8a9898', '#6a7880', '#4a5860', '#9aacaa'];
    return skins[Math.floor(Math.random() * skins.length)];
  }

  _pickEye() {
    const eyes = ['#88ffaa', '#aaffcc', '#88eecc', '#66ddaa', '#aaff88'];
    return eyes[Math.floor(Math.random() * eyes.length)];
  }

  _pickCloth() {
    const cols = ['#4a3828', '#3a4848', '#5a3030', '#283840', '#4a4020', '#382838'];
    return cols[Math.floor(Math.random() * cols.length)];
  }

  speak(text) {
    this.speechText = text;
    this.speechTimer = 180;
  }

  update(entityManager, time) {
    if (!this.alive) {
      this.deathTimer++;
      this.deathAlpha = Math.max(0, 1 - this.deathTimer / 80);
      return;
    }
    this.tickCount++;
    this.age += 0.002;

    // Passive stat decay
    this.hunger -= 0.015;
    this.energy -= 0.005;
    if (this.hunger < 30) this.happiness -= 0.02;
    if (this.state === ES.SLEEP) { this.energy = Math.min(100, this.energy + 0.5); }

    // Hunger damage
    if (this.hunger <= 0) {
      this.hunger = 0;
      this.health -= 0.1;
    }

    // Old age
    if (this.age > 90) this.health -= 0.02;

    // Death
    if (this.health <= 0) { this.die('голод'); return; }

    // Speech timer
    if (this.speechTimer > 0) this.speechTimer--;

    // Apply gravity
    this._applyGravity();

    // AI state machine
    this._updateState(entityManager, time);

    // Move
    this._applyMovement();

    // Clamp position
    this.x = Math.max(0.5, Math.min(this.world.w - 0.5, this.x));
    this.y = Math.max(0, Math.min(this.world.h - 1.5, this.y));
  }

  _applyGravity() {
    const bx = Math.round(this.x), by = Math.round(this.y);
    const below = this.world.isSolid(bx, by + 1);
    this.onGround = below;
    if (!below) {
      this.jumpVy += 0.08;
      if (this.jumpVy > 0.5) this.jumpVy = 0.5;
    } else {
      this.jumpVy = 0;
    }
    this.y += this.jumpVy;

    // Don't sink into ground
    const gby = Math.round(this.y);
    if (this.world.isSolid(gby, Math.round(this.y) + 1)) {
      this.y = Math.floor(this.y);
      this.jumpVy = 0;
    }

    // Lava damage
    const ft = this.world.get(Math.round(this.x), Math.round(this.y));
    if (ft === T.LAVA) { this.health -= 2; this.speak('АААА!'); }
    if (ft === T.FIRE) { this.health -= 0.5; }
  }

  _updateState(entityManager, time) {
    this.stateTimer++;

    // Sleep at night
    const nightTime = (time % CFG.DAY_TICKS) / CFG.DAY_TICKS;
    const isNight = nightTime > 0.65 || nightTime < 0.15;

    if (this.state !== ES.DIE) {
      if (isNight && this.energy < 50 && this.state !== ES.MINE && this.state !== ES.BUILD) {
        this._setState(ES.SLEEP);
      }
    }

    switch (this.state) {
      case ES.IDLE:    this._stateIdle(entityManager); break;
      case ES.WALK:    this._stateWalk(); break;
      case ES.MINE:    this._stateMine(); break;
      case ES.EAT:     this._stateEat(entityManager); break;
      case ES.SLEEP:   this._stateSleep(time); break;
      case ES.BUILD:   this._stateBuild(); break;
      case ES.FLEE:    this._stateFlee(entityManager); break;
      case ES.EXPLORE: this._stateExplore(); break;
    }
  }

  _setState(s) {
    this.state = s;
    this.stateTimer = 0;
  }

  _stateIdle(entityManager) {
    if (this.stateTimer > 30 + Math.random() * 60) {
      // Choose next action
      const r = Math.random();
      if (this.hunger < 50) {
        this._setState(ES.EAT);
      } else if (r < 0.3) {
        this._setState(ES.WALK);
        this.targetX = this.x + (Math.random() < 0.5 ? -1 : 1) * (3 + Math.floor(Math.random() * 8));
      } else if (r < 0.5 && this.tickCount % 60 === 0) {
        this._setState(ES.MINE);
        this._findMineTarget();
      } else if (r < 0.6 && this.builtCount < 3) {
        this._setState(ES.BUILD);
      } else if (r < 0.8) {
        this._setState(ES.EXPLORE);
        this.targetX = this.x + (Math.random() < 0.5 ? -1 : 1) * (5 + Math.floor(Math.random() * 15));
      } else {
        // Occasionally say something
        if (Math.random() < 0.1) {
          const phrases = ['...', 'хм...', 'голоден.', 'что-то темно.', 'слышал грохот?', 'надо строить!'];
          this.speak(phrases[Math.floor(Math.random() * phrases.length)]);
        }
      }
    }
  }

  _stateWalk() {
    const dx = this.targetX - this.x;
    if (Math.abs(dx) < 0.5) { this._setState(ES.IDLE); return; }
    if (this.stateTimer > 120) { this._setState(ES.IDLE); return; }
    this.dir = dx > 0 ? 1 : -1;
    this.vx = this.dir * 0.04;
    // Jump over obstacles
    const nx = Math.round(this.x + this.dir);
    if (this.world.isSolid(nx, Math.round(this.y)) && this.onGround) {
      this.jumpVy = -0.35;
    }
  }

  _stateMine() {
    if (this.stateTimer > 200) { this._setState(ES.IDLE); return; }
    const tx = Math.round(this.targetX), ty = Math.round(this.targetY);
    const dx = tx - this.x, dy = ty - this.y;
    if (Math.abs(dx) > 1.5) {
      this.dir = dx > 0 ? 1 : -1;
      this.vx = this.dir * 0.04;
    } else if (Math.abs(dy) < 2 && this.stateTimer % 15 === 0) {
      const nt = this.world.get(tx, ty);
      if (nt !== T.AIR && nt !== T.WATER && nt !== T.LAVA) {
        // Mine it
        if (nt === T.COAL || nt === T.IRON || nt === T.GOLD || nt === T.DIAMOND) {
          this.inventory.ore++;
          this.happiness = Math.min(100, this.happiness + 5);
        }
        this.world.set(tx, ty, T.AIR);
        this.world.invalidateLight(tx, ty);
        this._setState(ES.IDLE);
      }
    }
  }

  _findMineTarget() {
    const sx = Math.round(this.x), sy = Math.round(this.y);
    for (let r = 1; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = sx + dx, ny = sy + dy;
          const nt = this.world.get(nx, ny);
          if (nt === T.COAL || nt === T.IRON || nt === T.STONE || nt === T.GOLD || nt === T.DIAMOND) {
            this.targetX = nx; this.targetY = ny; return;
          }
        }
      }
    }
    this._setState(ES.IDLE);
  }

  _stateEat(entityManager) {
    if (this.hunger > 90) { this._setState(ES.IDLE); return; }
    if (this.stateTimer > 150) { this._setState(ES.IDLE); return; }
    // Look for mushroom nearby
    const sx = Math.round(this.x), sy = Math.round(this.y);
    for (let dy = -3; dy <= 1; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (this.world.get(sx + dx, sy + dy) === T.MUSHROOM) {
          const fdx = sx + dx - this.x;
          if (Math.abs(fdx) > 0.5) {
            this.dir = fdx > 0 ? 1 : -1;
            this.vx = this.dir * 0.04;
          } else {
            this.world.set(sx + dx, sy + dy, T.AIR);
            this.hunger = Math.min(100, this.hunger + 40);
            this.health = Math.min(this.maxHealth, this.health + 10);
            this.happiness = Math.min(100, this.happiness + 10);
            this.speak('Вкусно!');
            this._setState(ES.IDLE);
          }
          return;
        }
      }
    }
    // Wander looking for food
    this.vx = this.dir * 0.03;
    if (this.stateTimer % 40 === 0) this.dir *= -1;
  }

  _stateSleep(time) {
    this.vx = 0;
    const nightTime = (time % CFG.DAY_TICKS) / CFG.DAY_TICKS;
    const isNight = nightTime > 0.65 || nightTime < 0.15;
    if (!isNight && this.energy > 80) {
      this._setState(ES.IDLE);
      if (Math.random() < 0.2) this.speak('Доброе утро!');
    }
  }

  _stateBuild() {
    if (this.stateTimer > 200) { this._setState(ES.IDLE); return; }
    const sx = Math.round(this.x), sy = Math.round(this.y);
    // Place a brick block on the surface if there's space
    const placeY = sy - 1;
    const placeX = sx + this.dir * 2;
    if (this.world.get(placeX, placeY) === T.AIR && this.world.isSolid(placeX, placeY + 1)) {
      if (this.stateTimer % 40 === 39) {
        this.world.set(placeX, placeY, T.BRICK);
        this.builtCount++;
        this.happiness = Math.min(100, this.happiness + 3);
        this.speak('Строю!');
        this._setState(ES.IDLE);
      }
    } else {
      this._setState(ES.IDLE);
    }
  }

  _stateFlee(entityManager) {
    this.vx = -this.dir * 0.08;
    if (this.stateTimer > 100) this._setState(ES.IDLE);
  }

  _stateExplore() {
    const dx = this.targetX - this.x;
    if (Math.abs(dx) < 0.5 || this.stateTimer > 180) { this._setState(ES.IDLE); return; }
    this.dir = dx > 0 ? 1 : -1;
    this.vx = this.dir * 0.035;
    const nx = Math.round(this.x + this.dir);
    if (this.world.isSolid(nx, Math.round(this.y)) && this.onGround) {
      this.jumpVy = -0.35;
    }
  }

  _applyMovement() {
    const nx = this.x + this.vx;
    const bx = Math.round(nx), by = Math.round(this.y);
    if (!this.world.isSolid(bx, by)) {
      this.x = nx;
    } else {
      this.vx = 0;
    }
    this.vx *= 0.8; // friction
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
    return {
      name: this.name,
      type: this.isElder ? 'Старейшина' : 'Трогглит',
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      hunger: Math.round(this.hunger),
      happiness: Math.round(this.happiness),
      energy: Math.round(this.energy),
      age: Math.round(this.age),
      state: this._stateLabel(),
      inventory: this.inventory,
    };
  }

  _stateLabel() {
    const map = {
      [ES.IDLE]: 'Отдыхает', [ES.WALK]: 'Идёт',
      [ES.MINE]: 'Добывает', [ES.EAT]: 'Ищет еду',
      [ES.SLEEP]: 'Спит', [ES.BUILD]: 'Строит',
      [ES.FLEE]: 'Убегает', [ES.EXPLORE]: 'Исследует',
      [ES.DIE]: 'Умирает',
    };
    return map[this.state] || '—';
  }
}

class EntityManager {
  constructor(world) {
    this.world = world;
    this.entities = [];
    this.totalBorn = 0;
    this.totalDied = 0;
    this.time = 0;
    this.events = [];
  }

  spawn(x, y, isElder = false) {
    if (this.entities.filter(e => e.alive).length >= CFG.MAX_ENTITIES) return null;
    const e = new Troglyte(x, y, this.world, isElder);
    this.entities.push(e);
    this.totalBorn++;
    this._log(`${e.name} ${isElder ? '(Старейшина)' : ''} появился в мире`);
    return e;
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) {
      const x = 10 + Math.floor(Math.random() * (this.world.w - 20));
      const sy = this.world.getSurfaceY(x);
      const isElder = i === 0;
      this.spawn(x, sy - 1, isElder);
    }
  }

  update() {
    this.time++;
    const alive = this.entities.filter(e => e.alive);
    for (const e of this.entities) {
      e.update(this, this.time);
      if (!e.alive && e.deathTimer === 1) {
        this.totalDied++;
        this._log(`${e.name} погиб (${e._deathCause || 'неизвестно'})`);
      }
    }

    // Remove long-dead entities
    this.entities = this.entities.filter(e => e.alive || e.deathTimer < 120);

    // Reproduction
    if (this.time % 600 === 0 && alive.length > 2 && alive.length < CFG.MAX_ENTITIES * 0.8) {
      const parent = alive[Math.floor(Math.random() * alive.length)];
      if (parent.happiness > 70 && parent.hunger > 60) {
        const bx = Math.round(parent.x), by = Math.round(parent.y);
        const child = this.spawn(bx + (Math.random() < 0.5 ? -1 : 1), by, false);
        if (child) {
          child.generation = parent.generation + 1;
          this._log(`${parent.name} стал родителем. Добро пожаловать, ${child.name}!`);
        }
      }
    }
  }

  getAt(wx, wy, radius = 1) {
    return this.entities.find(e =>
      e.alive && Math.abs(e.x - wx) < radius && Math.abs(e.y - wy) < radius
    ) || null;
  }

  getAliveCount() { return this.entities.filter(e => e.alive).length; }
  getBuildingCount() { return this.entities.reduce((s, e) => s + (e.alive ? e.builtCount : 0), 0); }

  _log(msg) {
    this.events.unshift({ text: msg, time: this.time });
    if (this.events.length > 40) this.events.pop();
  }

  getRecentEvents(n = 10) { return this.events.slice(0, n); }
}

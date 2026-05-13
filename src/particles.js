const PT = {
  FIRE: 'fire', SPARK: 'spark', SMOKE: 'smoke',
  MAGIC: 'magic', RAIN: 'rain', EXPLOSION: 'explosion',
  DUST: 'dust', HEAL: 'heal', LIGHTNING: 'lightning',
  METEOR: 'meteor', BLOOD: 'blood', STAR: 'star'
};

class Particle {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    this.life = 1.0;
    this.vx = 0; this.vy = 0;
    this.size = 2;
    this.color = '#fff';
    this.decay = 0.02;
    this.alpha = 1;
    this._init(type);
  }

  _init(type) {
    const rnd = () => (Math.random() - 0.5) * 2;
    switch (type) {
      case PT.FIRE:
        this.vx = rnd() * 0.3;
        this.vy = -(0.3 + Math.random() * 0.5);
        this.size = 2 + Math.random() * 3;
        this.color = Math.random() < 0.5 ? '#ff8800' : '#ffcc00';
        this.decay = 0.025 + Math.random() * 0.02;
        break;
      case PT.SPARK:
        this.vx = rnd() * 1.5;
        this.vy = -Math.random() * 1.5;
        this.size = 1.5;
        this.color = '#ffdd44';
        this.decay = 0.04;
        break;
      case PT.SMOKE:
        this.vx = rnd() * 0.2;
        this.vy = -(0.1 + Math.random() * 0.2);
        this.size = 3 + Math.random() * 4;
        this.color = '#667788';
        this.decay = 0.01;
        break;
      case PT.MAGIC:
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 2 + Math.random() * 2;
        const cols = ['#8844ff', '#44aaff', '#ff44aa', '#44ffcc', '#ffcc44'];
        this.color = cols[Math.floor(Math.random() * cols.length)];
        this.decay = 0.02 + Math.random() * 0.02;
        break;
      case PT.RAIN:
        this.vx = -0.1 + Math.random() * 0.2;
        this.vy = 1.5 + Math.random() * 1.5;
        this.size = 1;
        this.color = '#4488cc';
        this.decay = 0.04;
        break;
      case PT.EXPLOSION:
        const ea = Math.random() * Math.PI * 2;
        const es = 2 + Math.random() * 4;
        this.vx = Math.cos(ea) * es;
        this.vy = Math.sin(ea) * es;
        this.size = 3 + Math.random() * 5;
        this.color = Math.random() < 0.5 ? '#ff6600' : (Math.random() < 0.5 ? '#ffcc00' : '#ff2200');
        this.decay = 0.03;
        break;
      case PT.DUST:
        this.vx = rnd() * 0.8;
        this.vy = -Math.random() * 0.5;
        this.size = 2;
        this.color = '#998877';
        this.decay = 0.03;
        break;
      case PT.HEAL:
        this.vx = rnd() * 0.3;
        this.vy = -(0.2 + Math.random() * 0.3);
        this.size = 2 + Math.random() * 2;
        this.color = Math.random() < 0.5 ? '#44ff88' : '#88ffcc';
        this.decay = 0.015;
        break;
      case PT.LIGHTNING:
        this.vx = rnd() * 0.5;
        this.vy = rnd() * 0.5;
        this.size = 1 + Math.random() * 2;
        this.color = '#aaccff';
        this.decay = 0.06;
        break;
      case PT.METEOR:
        this.vx = 2 + Math.random() * 2;
        this.vy = 2 + Math.random() * 2;
        this.size = 4 + Math.random() * 3;
        this.color = Math.random() < 0.5 ? '#ff8800' : '#ffaa00';
        this.decay = 0.025;
        break;
      case PT.BLOOD:
        this.vx = rnd() * 1;
        this.vy = -(0.3 + Math.random() * 0.8);
        this.size = 1.5;
        this.color = '#cc0022';
        this.decay = 0.04;
        break;
      case PT.STAR:
        this.vx = rnd() * 0.1;
        this.vy = rnd() * 0.1;
        this.size = 1 + Math.random() * 2;
        this.color = '#ffffcc';
        this.decay = 0.005;
        break;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.alpha = Math.max(0, this.life);

    switch (this.type) {
      case PT.FIRE:   this.vy -= 0.01; this.vx *= 0.95; break;
      case PT.SMOKE:  this.size += 0.05; this.vx *= 0.98; break;
      case PT.MAGIC:  this.vx *= 0.92; this.vy *= 0.92; break;
      case PT.RAIN:   this.vy += 0.05; break;
      case PT.EXPLOSION: this.vx *= 0.92; this.vy *= 0.92; this.vy += 0.05; break;
      case PT.DUST:   this.vx *= 0.9; this.vy += 0.01; break;
      case PT.BLOOD:  this.vy += 0.05; this.vx *= 0.95; break;
      case PT.SPARK:  this.vy += 0.06; this.vx *= 0.9; break;
    }
  }

  isDead() { return this.life <= 0; }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(type, x, y, count = 1) {
    const available = CFG.MAX_PARTICLES - this.particles.length;
    const actual = Math.min(count, available);
    for (let i = 0; i < actual; i++) {
      this.particles.push(new Particle(
        x + (Math.random() - 0.5) * 0.5,
        y + (Math.random() - 0.5) * 0.5,
        type
      ));
    }
  }

  emitBurst(type, x, y, count) {
    this.emit(type, x, y, count);
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead()) this.particles.splice(i, 1);
    }
  }

  // Continuous emitters (call every frame for fire tiles etc.)
  emitFireTile(wx, wy, tileSize, camX, camY, zoom) {
    if (Math.random() > 0.5) return;
    const sx = (wx - camX) * tileSize * zoom + tileSize * 0.5;
    const sy = (wy - camY) * tileSize * zoom + tileSize * 0.5;
    this.emit(PT.FIRE, wx, wy - 0.2);
    if (Math.random() < 0.2) this.emit(PT.SMOKE, wx, wy - 0.5);
  }
}

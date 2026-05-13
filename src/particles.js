class Particle {
  constructor(x, z, elevation, type) {
    this.x = x; this.z = z; this.elev = elevation;
    this.type = type;
    this.life  = 1.0;
    this.vx = 0; this.vy = 0; this.vz = 0; // vy = vertical (up)
    this.size  = 2;
    this.color = '#fff';
    this.decay = 0.025;
    this._init(type);
  }

  _init(type) {
    const rnd = () => (Math.random() - 0.5) * 2;
    switch (type) {
      case PT.FIRE:
        this.vx = rnd() * 0.04; this.vz = rnd() * 0.04; this.vy = 0.06 + Math.random() * 0.06;
        this.size  = 2 + Math.random() * 3;
        this.color = Math.random() < 0.5 ? '#ff8800' : '#ffcc00';
        this.decay = 0.028 + Math.random() * 0.02;
        break;
      case PT.SPARK:
        this.vx = rnd() * 0.12; this.vz = rnd() * 0.12; this.vy = 0.1 + Math.random() * 0.1;
        this.size  = 1.5; this.color = '#ffee44'; this.decay = 0.045;
        break;
      case PT.SMOKE:
        this.vx = rnd() * 0.02; this.vz = rnd() * 0.02; this.vy = 0.02 + Math.random() * 0.02;
        this.size  = 4 + Math.random() * 4; this.color = '#607080'; this.decay = 0.01;
        break;
      case PT.MAGIC:
        const a = Math.random() * Math.PI * 2, sp = 0.04 + Math.random() * 0.08;
        this.vx = Math.cos(a) * sp; this.vz = Math.sin(a) * sp; this.vy = 0.03 + Math.random() * 0.04;
        this.size  = 2 + Math.random() * 2;
        const mc = ['#8844ff','#44aaff','#ff44aa','#44ffcc','#ffcc44'];
        this.color = mc[Math.floor(Math.random() * mc.length)];
        this.decay = 0.02 + Math.random() * 0.015;
        break;
      case PT.RAIN:
        this.vx = 0; this.vz = 0; this.vy = -0.12;
        this.size = 1; this.color = '#5599dd'; this.decay = 0.06;
        break;
      case PT.EXPLOSION:
        const ea = Math.random() * Math.PI * 2, es = 0.1 + Math.random() * 0.3;
        this.vx = Math.cos(ea) * es; this.vz = Math.sin(ea) * es; this.vy = 0.08 + Math.random() * 0.15;
        this.size  = 3 + Math.random() * 5;
        this.color = Math.random() < 0.5 ? '#ff6600' : (Math.random() < 0.5 ? '#ffcc00' : '#ff2200');
        this.decay = 0.03;
        break;
      case PT.DUST:
        this.vx = rnd() * 0.06; this.vz = rnd() * 0.06; this.vy = 0.02 + Math.random() * 0.03;
        this.size = 2; this.color = '#998877'; this.decay = 0.035;
        break;
      case PT.HEAL:
        this.vx = rnd() * 0.03; this.vz = rnd() * 0.03; this.vy = 0.04 + Math.random() * 0.04;
        this.size  = 2 + Math.random() * 2;
        this.color = Math.random() < 0.5 ? '#44ff88' : '#88ffcc';
        this.decay = 0.018;
        break;
      case PT.LIGHTNING:
        this.vx = rnd() * 0.06; this.vz = rnd() * 0.06; this.vy = rnd() * 0.06;
        this.size = 1.5; this.color = '#aaddff'; this.decay = 0.07;
        break;
      case PT.BLOOD:
        this.vx = rnd() * 0.08; this.vz = rnd() * 0.08; this.vy = 0.04 + Math.random() * 0.06;
        this.size = 1.5; this.color = '#cc0022'; this.decay = 0.04;
        break;
      case PT.LEAF:
        this.vx = rnd() * 0.04; this.vz = rnd() * 0.04; this.vy = -0.01 - Math.random() * 0.02;
        this.size = 1.5; this.color = Math.random() < 0.5 ? '#3a9020' : '#4aaa28'; this.decay = 0.012;
        break;
      case PT.SNOWFLAKE:
        this.vx = rnd() * 0.02; this.vz = rnd() * 0.02; this.vy = -0.02 - Math.random() * 0.02;
        this.size = 1.5; this.color = '#d8eeff'; this.decay = 0.01;
        break;
    }
  }

  update() {
    this.x += this.vx; this.z += this.vz; this.elev += this.vy;
    this.life -= this.decay;
    switch (this.type) {
      case PT.FIRE:      this.vy += 0.001; this.vx *= 0.96; this.vz *= 0.96; break;
      case PT.SMOKE:     this.size += 0.06; this.vx *= 0.98; this.vz *= 0.98; break;
      case PT.EXPLOSION: this.vx *= 0.92; this.vz *= 0.92; this.vy -= 0.01; break;
      case PT.BLOOD:     this.vy -= 0.008; break;
      case PT.SPARK:     this.vy -= 0.012; break;
    }
  }

  isDead() { return this.life <= 0; }
}

class ParticleSystem {
  constructor() { this.particles = []; }

  emit(type, x, z, elev = 0, count = 1) {
    const avail = CFG.MAX_PARTICLES - this.particles.length;
    const n = Math.min(count, avail);
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(
        x + (Math.random() - 0.5) * 0.4,
        z + (Math.random() - 0.5) * 0.4,
        elev + (Math.random() - 0.5) * 0.2,
        type
      ));
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead()) this.particles.splice(i, 1);
    }
  }
}

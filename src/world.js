class World {
  constructor(width, height, seed) {
    this.w = width;
    this.h = height;
    this.seed = seed;
    this.tiles = new Uint8Array(width * height);
    this.tileMeta = new Float32Array(width * height); // timers, phase offsets, etc.
    this.lightMap = new Float32Array(width * height);
    this.noise = new Noise(seed);
    this.tickCount = 0;
    this.pendingUpdates = new Set();
    this.generate();
    this._computeLight();
  }

  idx(x, y) { return y * this.w + x; }
  valid(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }

  get(x, y) {
    if (!this.valid(x, y)) return T.BEDROCK;
    return this.tiles[this.idx(x, y)];
  }

  set(x, y, type) {
    if (!this.valid(x, y)) return;
    this.tiles[this.idx(x, y)] = type;
    this._scheduleUpdate(x, y);
  }

  getMeta(x, y) { return this.valid(x, y) ? this.tileMeta[this.idx(x, y)] : 0; }
  setMeta(x, y, v) { if (this.valid(x, y)) this.tileMeta[this.idx(x, y)] = v; }

  isSolid(x, y) {
    const t = this.get(x, y);
    return TD[t] && TD[t].solid;
  }

  isLiquid(x, y) {
    const t = this.get(x, y);
    return TD[t] && TD[t].liquid;
  }

  isPassable(x, y) { return !this.isSolid(x, y) && !this.isLiquid(x, y); }

  _scheduleUpdate(x, y) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (this.valid(x + dx, y + dy))
          this.pendingUpdates.add((y + dy) * this.w + (x + dx));
  }

  generate() {
    const { WORLD_W: W, WORLD_H: H, SURFACE_Y: SY, SEA_Y, CAVE_START_Y, BEDROCK_Y } = CFG;
    const n = this.noise;

    // Height map
    const hMap = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      hMap[x] = Math.floor(SY + n.fbm(nx * 3, 0.5, 5) * 14 - 7);
    }

    // Biome map (0=normal, 1=cold, 2=volcanic, 3=desert)
    const biome = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      const bv = (n.fbm(x / W * 2, 1.5, 2) + 1) / 2;
      biome[x] = bv < 0.25 ? 1 : bv < 0.5 ? 0 : bv < 0.75 ? 3 : 2;
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const surf = hMap[x];
        const bm = biome[x];

        if (y < surf - 1) {
          this.set(x, y, T.AIR);
        } else if (y === surf - 1) {
          if (bm === 1) this.set(x, y, T.SNOW);
          else if (bm === 3) this.set(x, y, T.SAND);
          else this.set(x, y, T.GRASS);
        } else if (y < surf + 4) {
          if (bm === 3) this.set(x, y, T.SAND);
          else this.set(x, y, T.DIRT);
        } else if (y >= BEDROCK_Y) {
          this.set(x, y, T.BEDROCK);
        } else if (y > H * 0.75) {
          this.set(x, y, T.DEEP_STONE);
        } else {
          this.set(x, y, T.STONE);
        }
      }
    }

    // Sea
    for (let x = 0; x < W; x++) {
      for (let y = hMap[x]; y < SEA_Y; y++) {
        if (this.get(x, y) === T.AIR) {
          if (biome[x] === 1) this.set(x, y, T.ICE);
          else this.set(x, y, T.WATER);
        }
      }
    }

    // Caves (cellular automata)
    const caveNoise = new Float32Array(W * H);
    for (let y = CAVE_START_Y; y < BEDROCK_Y; y++) {
      for (let x = 0; x < W; x++) {
        const v = n.fbm(x / 20, y / 20, 3);
        caveNoise[y * W + x] = v;
      }
    }
    // Carve caves
    for (let y = CAVE_START_Y + 4; y < BEDROCK_Y - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const v = caveNoise[y * W + x];
        const depth = (y - CAVE_START_Y) / (BEDROCK_Y - CAVE_START_Y);
        const thresh = 0.08 + depth * 0.04;
        if (Math.abs(v) < thresh && this.isSolid(x, y)) {
          this.tiles[this.idx(x, y)] = T.AIR;
        }
      }
    }

    // Ores
    for (let y = CAVE_START_Y; y < BEDROCK_Y - 2; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y) !== T.STONE && this.get(x, y) !== T.DEEP_STONE) continue;
        const depth = y / H;
        const rv = n.rnd(x + this.seed, y);
        if (rv < 0.015) this.set(x, y, T.COAL);
        else if (rv < 0.008 && depth > 0.5) this.set(x, y, T.IRON);
        else if (rv < 0.004 && depth > 0.65) this.set(x, y, T.GOLD);
        else if (rv < 0.0015 && depth > 0.8) this.set(x, y, T.DIAMOND);
      }
    }

    // Trees
    for (let x = 3; x < W - 3; x++) {
      const surf = hMap[x];
      if (biome[x] === 3 || biome[x] === 2) continue;
      if (this.get(x, surf - 1) !== T.GRASS) continue;
      if (n.rnd(x * 7, this.seed) > 0.12) continue;
      const h = 4 + Math.floor(n.rnd(x, this.seed + 1) * 3);
      for (let dy = 0; dy < h; dy++) this.set(x, surf - 2 - dy, T.LOG);
      const top = surf - 2 - h;
      for (let ly = top - 2; ly <= top + 1; ly++) {
        for (let lx = x - 2; lx <= x + 2; lx++) {
          if (!this.valid(lx, ly)) continue;
          if (this.get(lx, ly) !== T.AIR && this.get(lx, ly) !== T.LOG) continue;
          const dist = Math.abs(lx - x) + Math.abs(ly - top);
          if (dist <= 3 && n.rnd(lx * 3, ly * 5) > 0.2) this.set(lx, ly, T.LEAVES);
        }
      }
    }

    // Lava pools in deep areas
    for (let y = BEDROCK_Y - 20; y < BEDROCK_Y - 3; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y) === T.AIR && this.get(x, y + 1) !== T.AIR) {
          if (n.rnd(x * 2, y + this.seed) < 0.3) this.set(x, y, T.LAVA);
        }
      }
    }

    // Mushrooms in caves
    for (let y = CAVE_START_Y; y < BEDROCK_Y - 2; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (this.get(x, y) === T.AIR && this.isSolid(x, y + 1)) {
          if (n.rnd(x + 13, y + this.seed) < 0.015) this.set(x, y, T.MUSHROOM);
        }
      }
    }

    // Torches in caves (decorative)
    for (let y = CAVE_START_Y; y < BEDROCK_Y - 2; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (this.get(x, y) === T.AIR && this.isSolid(x, y + 1) && this.isSolid(x - 1, y)) {
          if (n.rnd(x + 77, y + this.seed * 2) < 0.004) this.set(x, y, T.TORCH);
        }
      }
    }

    // Clear updates from generation
    this.pendingUpdates.clear();
  }

  _computeLight() {
    const { WORLD_W: W, WORLD_H: H } = CFG;
    // Sky light propagation downward
    for (let x = 0; x < W; x++) {
      let skyLight = 1.0;
      for (let y = 0; y < H; y++) {
        const t = this.get(x, y);
        const d = TD[t];
        if (d && d.solid) skyLight *= 0.05;
        else if (d && d.liquid) skyLight *= 0.6;
        else if (t === T.LEAVES) skyLight *= 0.7;
        this.lightMap[this.idx(x, y)] = skyLight;
      }
    }
    // Local light sources
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.get(x, y);
        const d = TD[t];
        if (!d || !d.light) continue;
        this._spreadLight(x, y, d.light);
      }
    }
  }

  _spreadLight(cx, cy, strength) {
    const R = Math.ceil(strength * 10);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this.valid(x, y)) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const contrib = Math.max(0, strength - dist / 10);
        const i = this.idx(x, y);
        if (contrib > this.lightMap[i]) this.lightMap[i] = contrib;
      }
    }
  }

  update() {
    this.tickCount++;
    if (this.tickCount % 3 !== 0) return; // only update every 3 ticks for performance

    const toProcess = [...this.pendingUpdates].slice(0, 400);
    this.pendingUpdates.clear();

    for (const idx of toProcess) {
      const x = idx % this.w, y = Math.floor(idx / this.w);
      this._updateTile(x, y);
    }

    // Random updates
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(Math.random() * this.w);
      const y = Math.floor(Math.random() * this.h);
      this._updateTile(x, y);
    }
  }

  _updateTile(x, y) {
    const t = this.get(x, y);
    switch (t) {
      case T.WATER: this._updateWater(x, y); break;
      case T.LAVA:  this._updateLava(x, y);  break;
      case T.FIRE:  this._updateFire(x, y);  break;
      case T.SAND:
      case T.GRAVEL: this._updateGravity(x, y); break;
    }
  }

  _updateWater(x, y) {
    if (this.get(x, y + 1) === T.AIR) { this.set(x, y + 1, T.WATER); this.set(x, y, T.AIR); return; }
    const dl = this.get(x - 1, y), dr = this.get(x + 1, y);
    if (dl === T.AIR && dr === T.AIR) this.set(x + (Math.random() < 0.5 ? -1 : 1), y, T.WATER);
    else if (dl === T.AIR) this.set(x - 1, y, T.WATER);
    else if (dr === T.AIR) this.set(x + 1, y, T.WATER);
    // Extinguish fire below
    if (this.get(x, y - 1) === T.FIRE) this.set(x, y - 1, T.AIR);
  }

  _updateLava(x, y) {
    if (Math.random() > 0.3) return;
    if (this.get(x, y + 1) === T.AIR) { this.set(x, y + 1, T.LAVA); this.set(x, y, T.AIR); return; }
    if (this.get(x, y + 1) === T.WATER) { this.set(x, y + 1, T.STONE); return; }
    const dx = Math.random() < 0.5 ? -1 : 1;
    if (this.get(x + dx, y) === T.AIR) this.set(x + dx, y, T.LAVA);
    // Set fire to adjacent flammable tiles
    for (let dy = -1; dy <= 1; dy++) {
      for (let ddx = -1; ddx <= 1; ddx++) {
        const nt = this.get(x + ddx, y + dy);
        if (TD[nt] && TD[nt].flammable && Math.random() < 0.02) this.set(x + ddx, y + dy, T.FIRE);
      }
    }
  }

  _updateFire(x, y) {
    let meta = this.getMeta(x, y);
    meta++;
    if (meta > 60 + Math.random() * 30) { this.set(x, y, T.AIR); return; }
    this.setMeta(x, y, meta);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nt = this.get(x + dx, y + dy);
        if (TD[nt] && TD[nt].flammable && Math.random() < 0.01) this.set(x + dx, y + dy, T.FIRE);
      }
    }
  }

  _updateGravity(x, y) {
    if (this.get(x, y + 1) === T.AIR) {
      this.set(x, y + 1, this.get(x, y));
      this.set(x, y, T.AIR);
    }
  }

  getBiomeName(x) {
    const n = this.noise;
    const bv = (n.fbm(x / this.w * 2, 1.5, 2) + 1) / 2;
    if (bv < 0.25) return 'Тундра';
    if (bv < 0.5)  return 'Равнина';
    if (bv < 0.75) return 'Пустыня';
    return 'Вулканический';
  }

  getSurfaceY(x) {
    for (let y = 0; y < this.h; y++) {
      if (this.isSolid(x, y)) return y;
    }
    return this.h - 1;
  }

  invalidateLight(x, y, r = 8) {
    const cx = Math.max(0, x - r), cy = Math.max(0, y - r);
    const ex = Math.min(this.w - 1, x + r), ey = Math.min(this.h - 1, y + r);
    for (let ly = cy; ly <= ey; ly++) {
      for (let lx = cx; lx <= ex; lx++) {
        const t = this.get(lx, ly);
        const d = TD[t];
        let l = 0;
        if (d && d.light) l = d.light;
        this.lightMap[this.idx(lx, ly)] = l;
      }
    }
    // Re-propagate sky
    for (let lx = cx; lx <= ex; lx++) {
      let sky = 1.0;
      for (let ly = 0; ly <= ey; ly++) {
        const t = this.get(lx, ly);
        const d = TD[t];
        if (d && d.solid) sky *= 0.05;
        else if (d && d.liquid) sky *= 0.6;
        if (ly >= cy) {
          const i = this.idx(lx, ly);
          if (sky > this.lightMap[i]) this.lightMap[i] = sky;
        }
      }
    }
    // Light sources
    for (let ly = cy; ly <= ey; ly++) {
      for (let lx = cx; lx <= ex; lx++) {
        const t = this.get(lx, ly);
        const d = TD[t];
        if (d && d.light) this._spreadLight(lx, ly, d.light);
      }
    }
  }
}

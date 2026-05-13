class World {
  constructor(w, d, seed) {
    this.w = w;
    this.d = d;
    this.seed = seed;
    this.noise = new Noise(seed);
    // Per-cell data
    this.heightMap  = new Float32Array(w * d);  // 0-12 elevation
    this.typeMap    = new Uint8Array(w * d);     // ST.*
    this.featureMap = new Uint8Array(w * d);     // FT.*
    this.fireMap    = new Uint8Array(w * d);     // fire timer
    this.tickCount  = 0;
    this.generate();
  }

  idx(x, z) { return z * this.w + x; }
  valid(x, z) { return x >= 0 && x < this.w && z >= 0 && z < this.d; }

  getHeight(x, z)  { return this.valid(x,z) ? this.heightMap[this.idx(x,z)] : 0; }
  getType(x, z)    { return this.valid(x,z) ? this.typeMap[this.idx(x,z)] : ST.VOID; }
  getFeature(x, z) { return this.valid(x,z) ? this.featureMap[this.idx(x,z)] : FT.NONE; }
  getFire(x, z)    { return this.valid(x,z) ? this.fireMap[this.idx(x,z)] : 0; }

  setHeight(x, z, v)  { if (this.valid(x,z)) this.heightMap[this.idx(x,z)] = Math.max(0, Math.min(12, v)); }
  setType(x, z, t)    { if (this.valid(x,z)) this.typeMap[this.idx(x,z)] = t; }
  setFeature(x, z, f) { if (this.valid(x,z)) this.featureMap[this.idx(x,z)] = f; }
  setFire(x, z, v)    { if (this.valid(x,z)) this.fireMap[this.idx(x,z)] = v; }

  isWalkable(x, z) {
    const t = this.getType(x, z);
    return t !== ST.WATER && t !== ST.DEEP_WATER && t !== ST.LAVA && t !== ST.VOID && this.valid(x,z);
  }

  getSurfaceElevation(x, z) {
    return this.getHeight(x, z);
  }

  generate() {
    const n = this.noise;
    const W = this.w, D = this.d;
    const WL = CFG.WATER_LEVEL;

    // Biome map
    const biome = new Float32Array(W * D);
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++)
        biome[z * W + x] = n.fbm(x / W * 2, z / D * 2, 3);

    // Height map: continent shape + noise
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W, nz = z / D;
        // Falloff from edges (island shape)
        const fx = Math.sin(nx * Math.PI);
        const fz = Math.sin(nz * Math.PI);
        const falloff = fx * fz;

        const h = n.fbm(nx * 4, nz * 4, 5) * 0.6
                + n.fbm(nx * 8, nz * 8, 3) * 0.3
                + n.ridged(nx * 2, nz * 2, 3) * 0.1;

        this.heightMap[this.idx(x, z)] = Math.max(1, Math.round((h * 0.5 + 0.5) * falloff * 10 + 1));
      }
    }

    // Assign surface types
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const h = this.getHeight(x, z);
        const bv = biome[z * W + x];
        let type;

        if (h <= WL - 1) {
          type = ST.DEEP_WATER;
        } else if (h <= WL) {
          type = ST.WATER;
        } else if (h <= WL + 1) {
          type = bv > 0.1 ? ST.SAND : ST.CLAY;
        } else if (h <= WL + 4) {
          if (bv > 0.3) type = ST.GRASS;
          else if (bv < -0.3) type = ST.DIRT;
          else type = ST.GRASS;
        } else if (h <= WL + 6) {
          type = ST.STONE;
        } else if (h <= WL + 8) {
          type = ST.DEEP_STONE;
        } else {
          type = ST.SNOW;
        }

        // Volcanic zones
        if (bv < -0.35 && h > WL + 2) {
          if (h > WL + 5) { type = ST.VOLCANIC; }
          else { type = ST.GRAVEL; }
        }

        // Mud around coast
        if (h === WL + 1 && bv < 0) type = ST.MUD;

        this.setType(x, z, type);
      }
    }

    // Features: trees, rocks, etc.
    for (let z = 1; z < D - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const type = this.getType(x, z);
        const bv = biome[z * W + x];
        const rv = n.rnd(x * 3 + this.seed, z * 7);

        if (type === ST.GRASS) {
          if (rv < 0.12) {
            // Check no adjacent trees (sparse)
            if (!this._hasNearbyFeature(x, z, 2, [FT.OAK_TREE, FT.BIRCH, FT.PINE_TREE])) {
              if (bv > 0.15) this.setFeature(x, z, FT.OAK_TREE);
              else if (bv > 0) this.setFeature(x, z, FT.BIRCH);
              else this.setFeature(x, z, FT.PINE_TREE);
            }
          } else if (rv < 0.18) {
            this.setFeature(x, z, FT.FLOWER);
          } else if (rv < 0.20) {
            this.setFeature(x, z, FT.MUSHROOM);
          }
        } else if (type === ST.STONE || type === ST.DEEP_STONE) {
          if (rv < 0.08) this.setFeature(x, z, FT.ROCK);
        } else if (type === ST.SAND) {
          if (rv < 0.04) this.setFeature(x, z, FT.CACTUS);
        } else if (type === ST.SNOW) {
          if (rv < 0.06) this.setFeature(x, z, FT.PINE_TREE);
          else if (rv < 0.10) this.setFeature(x, z, FT.DEAD_TREE);
        } else if (type === ST.VOLCANIC) {
          if (rv < 0.05) this.setFeature(x, z, FT.ROCK);
        }
      }
    }

    // Lava in volcanic/deep areas
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (this.getType(x, z) === ST.VOLCANIC && n.rnd(x + 99, z) < 0.15) {
          this.setType(x, z, ST.LAVA);
        }
      }
    }
  }

  _hasNearbyFeature(cx, cz, r, types) {
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const f = this.getFeature(cx + dx, cz + dz);
        if (types.includes(f)) return true;
      }
    return false;
  }

  update() {
    this.tickCount++;
    if (this.tickCount % 5 !== 0) return;

    // Fire spread and decay
    const W = this.w, D = this.d;
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const fire = this.getFire(x, z);
        if (!fire) continue;
        const newFire = fire - 1;
        this.setFire(x, z, newFire);
        if (newFire === 0) {
          const t = this.getType(x, z);
          if (t === ST.GRASS) this.setType(x, z, ST.DIRT);
          if (this.getFeature(x, z) !== FT.NONE) this.setFeature(x, z, FT.DEAD_TREE);
        }
        // Spread
        if (newFire > 5 && Math.random() < 0.08) {
          const dx = [-1,1,0,0][Math.floor(Math.random()*4)];
          const dz = [0,0,-1,1][Math.floor(Math.random()*4)];
          const nx = x+dx, nz = z+dz;
          if (this.valid(nx, nz) && !this.getFire(nx, nz)) {
            const nt = this.getType(nx, nz);
            const nf = this.getFeature(nx, nz);
            if (nt === ST.GRASS || nf === FT.OAK_TREE || nf === FT.BIRCH || nf === FT.PINE_TREE) {
              this.setFire(nx, nz, 15 + Math.floor(Math.random() * 10));
            }
          }
        }
      }
    }
  }

  getBiomeName(x, z) {
    const h = this.getHeight(x, z);
    const t = this.getType(x, z);
    if (t === ST.DEEP_WATER) return 'Глубокий океан';
    if (t === ST.WATER) return 'Вода';
    if (t === ST.SAND) return 'Пляж';
    if (t === ST.SNOW) return 'Тундра';
    if (t === ST.LAVA || t === ST.VOLCANIC) return 'Вулкан';
    if (t === ST.STONE || t === ST.DEEP_STONE) return 'Горы';
    if (h > CFG.WATER_LEVEL + 3) return 'Холмы';
    return 'Равнина';
  }
}

class Renderer {
  constructor(canvas, world, em, ps) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.world  = world;
    this.em     = em;
    this.ps     = ps;
    // Camera: world-space center point
    this.camX = world.w / 2;
    this.camZ = world.d / 2;
    this.zoom = 1.4;
    // Base dims at zoom=1
    this.TW = CFG.ISO_TW;  // diamond width
    this.TH = CFG.ISO_TH;  // diamond height
    this.TD = CFG.ISO_TD;  // depth per elevation unit
    this.time = 0;
    this._shake = { x: 0, y: 0, s: 0 };
    this._sel   = null;
    // Per-tile random variation seed cache
    this._rndCache = new Float32Array(world.w * world.d);
    for (let i = 0; i < this._rndCache.length; i++) this._rndCache[i] = Math.random();
  }

  resize(w, h) { this.canvas.width = w; this.canvas.height = h; }

  // ── World → Screen ──────────────────────────────────────────────
  w2s(wx, wz, elev = 0) {
    const TW = this.TW * this.zoom, TH = this.TH * this.zoom, TD = this.TD * this.zoom;
    const cx = this.canvas.width  / 2;
    const cy = this.canvas.height / 2;
    const rx = (wx - this.camX) - (wz - this.camZ);
    const rz = (wx - this.camX) + (wz - this.camZ);
    return {
      x: cx + rx * TW / 2,
      y: cy + rz * TH / 2 - elev * TD,
    };
  }

  s2w(sx, sy) {
    const TW = this.TW * this.zoom, TH = this.TH * this.zoom;
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    const rx = (sx - cx) / (TW / 2);
    const ry = (sy - cy) / (TH / 2);
    return {
      x: (rx + ry) / 2 + this.camX,
      z: (ry - rx) / 2 + this.camZ,
    };
  }

  // ── Main render ──────────────────────────────────────────────────
  render(time, dayPhase) {
    this.time = time;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    ctx.save();
    if (this._shake.s > 0.5) {
      this._shake.x = (Math.random() - 0.5) * this._shake.s;
      this._shake.y = (Math.random() - 0.5) * this._shake.s;
      this._shake.s *= 0.85;
      ctx.translate(this._shake.x, this._shake.y);
    }

    // Sky
    this._drawSky(dayPhase);

    // World tiles (back to front)
    this._drawWorld(dayPhase);

    // Particles below entities
    this._drawParticles(false, dayPhase);

    // Entities
    this._drawEntities(dayPhase);

    // Particles above entities
    this._drawParticles(true, dayPhase);

    // Atmosphere overlay
    this._drawAtmosphere(dayPhase);

    ctx.restore();
  }

  // ── Sky ──────────────────────────────────────────────────────────
  _drawSky(phase) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const isNight = phase > 0.62 || phase < 0.12;
    const isDawn  = (phase > 0.12 && phase < 0.25) || (phase > 0.52 && phase < 0.65);

    let c0, c1;
    if (isNight) {
      c0 = '#03030e'; c1 = '#06061a';
    } else if (isDawn) {
      const t = phase < 0.25 ? (phase - 0.12) / 0.13 : 1 - (phase - 0.52) / 0.13;
      c0 = `rgb(${Math.round(3 + 60*t)},${Math.round(3 + 30*t)},${Math.round(14 + 60*t)})`;
      c1 = `rgb(${Math.round(100*t)},${Math.round(50*t)},${Math.round(14 + 20*t)})`;
    } else {
      c0 = '#0a1e50'; c1 = '#1a4098';
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Stars
    if (isNight || phase > 0.55) {
      const alpha = isNight ? 1 : Math.min(1, (phase - 0.55) * 8);
      const rng = new Noise(99);
      for (let i = 0; i < 120; i++) {
        const sx = rng.rnd(i * 7, 1) * W;
        const sy = rng.rnd(i * 7, 2) * H * 0.55;
        const r  = rng.rnd(i, 4) < 0.8 ? 1 : 2;
        const twinkle = 0.45 + 0.55 * Math.sin(this.time * 0.04 + i * 1.47);
        ctx.globalAlpha = alpha * twinkle;
        ctx.fillStyle = rng.rnd(i, 5) < 0.9 ? '#ffffd0' : '#ffd0ff';
        ctx.fillRect(sx, sy, r, r);
      }
      ctx.globalAlpha = 1;
    }

    // Sun / Moon
    const sunPhase  = phase;
    const moonPhase = (phase + 0.5) % 1;
    const arcH = H * 0.45;

    if (!isNight) {
      const sx = W * (0.1 + sunPhase * 0.8);
      const sy = H * 0.1 + arcH * Math.sin(Math.PI * (sunPhase - 0.15) / 0.7) * 0.5;
      ctx.save();
      const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 50);
      sg.addColorStop(0, 'rgba(255,240,120,0.35)');
      sg.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 50, sy - 50, 100, 100);
      ctx.fillStyle = '#ffee55';
      ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe870';
      ctx.beginPath(); ctx.arc(sx - 3, sy - 3, 10, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (isNight || phase > 0.55) {
      const mx = W * (0.1 + moonPhase * 0.8);
      const my = H * 0.1 + arcH * Math.sin(Math.PI * (moonPhase - 0.15) / 0.7) * 0.5;
      const malpha = isNight ? 1 : Math.min(1, (phase - 0.55) * 8);
      ctx.globalAlpha = malpha;
      ctx.fillStyle = '#c8dde8';
      ctx.beginPath(); ctx.arc(mx, my, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a0b8c8';
      ctx.beginPath(); ctx.arc(mx + 3, my - 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Clouds
    if (!isNight) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#dde8f4';
      const ns = new Noise(17);
      for (let i = 0; i < 7; i++) {
        const cx2 = ((ns.rnd(i*13,1) * W * 1.5 + this.time * 0.05) % (W + 300)) - 150;
        const cy2 = H * 0.06 + ns.rnd(i*13,2) * H * 0.18;
        const r1  = 22 + ns.rnd(i,3) * 20;
        ctx.beginPath();
        ctx.arc(cx2, cy2, r1, 0, Math.PI*2);
        ctx.arc(cx2+r1*0.8, cy2-5, r1*0.7, 0, Math.PI*2);
        ctx.arc(cx2+r1*1.5, cy2, r1*0.85, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Isometric World ──────────────────────────────────────────────
  _drawWorld(dayPhase) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const world = this.world;
    const TW = this.TW * this.zoom, TH = this.TH * this.zoom, TD = this.TD * this.zoom;
    const pad = 4;

    // Compute visible tile range (approximate bounding box)
    const tl = this.s2w(0, 0);
    const br = this.s2w(W, H + 200);
    const minX = Math.max(0, Math.floor(Math.min(tl.x, br.x) - pad));
    const maxX = Math.min(world.w - 1, Math.ceil(Math.max(tl.x, br.x) + pad));
    const minZ = Math.max(0, Math.floor(Math.min(tl.z, br.z) - pad));
    const maxZ = Math.min(world.d - 1, Math.ceil(Math.max(tl.z, br.z) + pad));

    const t = this.time;
    const isNight = dayPhase > 0.62 || dayPhase < 0.12;
    const nightDark = isNight ? 0.55 : 0;

    // Draw in back-to-front isometric order
    for (let diag = (minX - minZ); diag <= (maxX - minZ) + (maxZ - minX); diag++) {
      for (let wx = minX; wx <= maxX; wx++) {
        const wz = wx - diag + minZ;
        if (wz < minZ || wz > maxZ) continue;

        const h    = world.getHeight(wx, wz);
        const type = world.getType(wx, wz);
        const feat = world.getFeature(wx, wz);
        const fire = world.getFire(wx, wz);
        const rnd  = this._rndCache[wz * world.w + wx];

        const pos = this.w2s(wx, wz, h);
        const sx = pos.x, sy = pos.y;

        // Cull off-screen
        if (sx + TW < 0 || sx - TW > W || sy + 100 * this.zoom < 0 || sy > H + 20) continue;

        this._drawTile(ctx, wx, wz, sx, sy, h, type, feat, fire, rnd, t, dayPhase, nightDark, TW, TH, TD, isNight);
      }
    }
  }

  _drawTile(ctx, wx, wz, sx, sy, h, type, feat, fire, rnd, t, dayPhase, nightDark, TW, TH, TD, isNight) {
    const world = this.world;
    const hw = TW / 2, hh = TH / 2;

    const hL = world.getHeight(wx - 1, wz);
    const hR = world.getHeight(wx, wz - 1);
    const colors = this._tileColors(type, h, rnd, t);

    // ── Left face (south-west) ────────────────────────────────────
    if (h > hL || !world.valid(wx - 1, wz)) {
      const fh = (h - Math.max(0, hL)) * TD;
      ctx.beginPath();
      ctx.moveTo(sx - hw, sy + hh);
      ctx.lineTo(sx,      sy + TH);
      ctx.lineTo(sx,      sy + TH + fh);
      ctx.lineTo(sx - hw, sy + hh + fh);
      ctx.closePath();
      ctx.fillStyle = this._applyNight(colors.left, nightDark);
      ctx.fill();
      // Edge line for depth
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── Right face (south-east) ───────────────────────────────────
    if (h > hR || !world.valid(wx, wz - 1)) {
      const fh = (h - Math.max(0, hR)) * TD;
      ctx.beginPath();
      ctx.moveTo(sx,      sy + TH);
      ctx.lineTo(sx + hw, sy + hh);
      ctx.lineTo(sx + hw, sy + hh + fh);
      ctx.lineTo(sx,      sy + TH + fh);
      ctx.closePath();
      ctx.fillStyle = this._applyNight(colors.right, nightDark);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── Top face (diamond) ────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(sx,      sy);
    ctx.lineTo(sx + hw, sy + hh);
    ctx.lineTo(sx,      sy + TH);
    ctx.lineTo(sx - hw, sy + hh);
    ctx.closePath();

    if (colors.grad) {
      const g = ctx.createLinearGradient(sx - hw, sy, sx + hw, sy + TH);
      g.addColorStop(0, colors.grad[0]);
      g.addColorStop(1, colors.grad[1]);
      ctx.fillStyle = this._applyNight(g, nightDark * 0.6, true);
      if (nightDark > 0) {
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = `rgba(0,0,${Math.round(nightDark * 50)},${nightDark})`;
      }
    } else {
      ctx.fillStyle = this._applyNight(colors.top, nightDark * 0.6);
    }
    ctx.fill();

    // Top-face texture details
    this._drawTileDetail(ctx, wx, wz, sx, sy, h, type, rnd, t, TW, TH, TD);

    // Fire overlay
    if (fire > 0) {
      const fa = Math.min(0.85, fire / 20) * (0.7 + 0.3 * Math.sin(t * 0.2 + wx));
      ctx.fillStyle = `rgba(255, 80, 0, ${fa})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy); ctx.lineTo(sx+hw, sy+hh); ctx.lineTo(sx, sy+TH); ctx.lineTo(sx-hw, sy+hh);
      ctx.closePath(); ctx.fill();
      if (Math.random() < 0.15) this.ps.emit(PT.FIRE, wx, wz, h + 0.5, 1);
      if (Math.random() < 0.05) this.ps.emit(PT.SMOKE, wx, wz, h + 0.8, 1);
    }

    // Feature
    if (feat !== FT.NONE) {
      this._drawFeature(ctx, wx, wz, sx, sy, h, feat, rnd, t, TW, TH, TD, isNight);
    }

    // AO edge
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx+hw, sy+hh); ctx.lineTo(sx, sy+TH); ctx.lineTo(sx-hw, sy+hh);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Lava glow
    if (type === ST.LAVA) {
      const g2 = ctx.createRadialGradient(sx, sy+hh, 0, sx, sy+hh, TW * 1.2);
      g2.addColorStop(0, `rgba(220,80,0,${0.18 + 0.08*Math.sin(t*0.1+wx)})`);
      g2.addColorStop(1, 'rgba(200,60,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(sx, sy+hh, TW * 1.2, 0, Math.PI*2);
      ctx.fill();
    }
  }

  _tileColors(type, h, rnd, t) {
    const d = STD[type];
    if (!d) return { top:'#222', left:'#111', right:'#181818' };

    // Variation
    const v = (rnd - 0.5) * 16;

    if (type === ST.WATER || type === ST.DEEP_WATER) {
      const wave = Math.sin(t * 0.06 + h * 0.3) * 12;
      const base = type === ST.WATER ? [42, 122, 223] : [16, 60, 160];
      const top = `rgb(${base[0]+wave/3},${base[1]+wave/2},${base[2]+wave})`;
      return { top, grad:[top, d.l], left: d.l, right: d.r };
    }
    if (type === ST.LAVA) {
      const lv = Math.sin(t * 0.08 + h * 0.5 + rnd * 10) * 0.5;
      const r = Math.round(220 + lv * 30), g = Math.round(70 + lv * 50);
      return { top: `rgb(${r},${g},0)`, grad:[`rgb(${r},${g},0)`, '#601000'], left: '#6a1c00', right: '#802200' };
    }
    if (type === ST.GRASS) {
      const gr = Math.round(88 + v);
      const top = `rgb(${Math.round(60+v*0.5)},${Math.clamp ? Math.clamp(gr,60,140) : Math.min(140,Math.max(60,gr))},${Math.round(30+v*0.3)})`;
      return { top, grad: [this._lightenHex(d.top, 10), this._darkenHex(d.top, 8)], left: d.l, right: d.r };
    }
    if (type === ST.SNOW) {
      const sv = Math.round(220 + v * 0.5);
      const top = `rgb(${sv},${sv+4},${sv+8})`;
      return { top, grad: [top, '#b8d0e0'], left: d.l, right: d.r };
    }

    return {
      top: this._varHex(d.top, v),
      grad: [this._lightenHex(d.top, 8 + v*0.3), this._darkenHex(d.top, 6)],
      left: d.l, right: d.r
    };
  }

  _drawTileDetail(ctx, wx, wz, sx, sy, h, type, rnd, t, TW, TH, TD) {
    const hw = TW/2, hh = TH/2;
    const zoom = this.zoom;
    if (zoom < 0.6) return;

    if (type === ST.GRASS) {
      // Grass blade dots on top
      ctx.fillStyle = `rgba(${40+Math.floor(rnd*20)},${105+Math.floor(rnd*20)},${20+Math.floor(rnd*10)},0.8)`;
      for (let i = 0; i < 4; i++) {
        const bx = sx - hw*0.6 + (rnd * 17 + i * 23) % (hw * 1.2);
        const by = sy + hh * 0.3 + (rnd * 13 + i * 17) % (hh * 1.0);
        ctx.fillRect(bx, by, Math.max(1, zoom), Math.max(1, zoom));
      }
    }

    if (type === ST.STONE || type === ST.DEEP_STONE) {
      // Crack lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = Math.max(0.5, zoom * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx - hw * 0.3, sy + hh * 0.4);
      ctx.lineTo(sx + hw * 0.1, sy + hh * 0.8);
      ctx.stroke();
    }

    if (type === ST.SAND) {
      // Ripple effect
      const ripple = Math.sin(t * 0.05 + wx * 0.5 + wz * 0.3) * 0.05;
      ctx.strokeStyle = `rgba(180,160,80,${0.25+ripple})`;
      ctx.lineWidth = Math.max(0.5, zoom * 0.4);
      ctx.beginPath();
      ctx.moveTo(sx - hw * 0.5, sy + hh * 0.5);
      ctx.lineTo(sx + hw * 0.5, sy + hh * 0.5);
      ctx.stroke();
    }

    if (type === ST.SNOW) {
      // Sparkle
      const sp = Math.sin(t * 0.15 + wx * 2.3 + wz * 1.7);
      if (sp > 0.7) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(sx - 1, sy + hh - 1, 2, 2);
      }
    }

    if (type === ST.WATER) {
      // Wave highlight
      const wv = Math.sin(t * 0.1 + wx * 0.7 + wz * 0.5);
      ctx.fillStyle = `rgba(120,180,255,${0.15 + wv * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy + hh * 0.6, hw * 0.5, hh * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (type === ST.LAVA) {
      // Lava cracks (bright)
      const lp = Math.sin(t * 0.12 + wx + wz * 0.7);
      ctx.strokeStyle = `rgba(255,200,0,${0.4 + lp * 0.2})`;
      ctx.lineWidth = Math.max(0.5, zoom * 0.6);
      ctx.beginPath();
      ctx.moveTo(sx - hw * 0.4, sy + hh * 0.3);
      ctx.lineTo(sx + hw * 0.2, sy + hh * 0.9);
      ctx.stroke();
    }
  }

  // ── Features ──────────────────────────────────────────────────────
  _drawFeature(ctx, wx, wz, sx, sy, h, feat, rnd, t, TW, TH, TD, isNight) {
    const zoom = this.zoom;
    const baseY = sy + TH / 2;  // center of tile top face

    switch (feat) {
      case FT.OAK_TREE:   this._drawOakTree(ctx, sx, baseY, zoom, rnd, t, isNight); break;
      case FT.PINE_TREE:  this._drawPineTree(ctx, sx, baseY, zoom, rnd, t, isNight); break;
      case FT.BIRCH:      this._drawBirchTree(ctx, sx, baseY, zoom, rnd, t, isNight); break;
      case FT.DEAD_TREE:  this._drawDeadTree(ctx, sx, baseY, zoom, rnd); break;
      case FT.ROCK:       this._drawRock(ctx, sx, baseY, zoom, rnd, TW); break;
      case FT.MUSHROOM:   this._drawMushroom(ctx, sx, baseY, zoom, rnd); break;
      case FT.FLOWER:     this._drawFlower(ctx, sx, baseY, zoom, rnd, t); break;
      case FT.CACTUS:     this._drawCactus(ctx, sx, baseY, zoom, rnd); break;
      case FT.HOUSE:      this._drawHouse(ctx, wx, wz, sx, baseY, zoom, rnd, isNight); break;
      case FT.TORCH:      this._drawTorch(ctx, sx, baseY, zoom, t); break;
    }
  }

  _drawOakTree(ctx, sx, sy, zoom, rnd, t, isNight) {
    const h  = (28 + rnd * 14) * zoom;
    const tr = (5 + rnd * 3) * zoom;
    const lr = (18 + rnd * 8) * zoom;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx + 3*zoom, sy + 4*zoom, lr * 0.7, lr * 0.28, 0, 0, Math.PI*2);
    ctx.fill();

    // Trunk
    const tg = ctx.createLinearGradient(sx - tr, sy - h, sx + tr, sy);
    tg.addColorStop(0, '#5d3818'); tg.addColorStop(1, '#3a2010');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.rect(sx - tr * 0.5, sy - h, tr, h);
    ctx.fill();
    // Trunk highlight
    ctx.fillStyle = 'rgba(100,70,30,0.4)';
    ctx.fillRect(sx - tr*0.15, sy - h, tr * 0.3, h);

    // Leaf layers (bottom to top for z-order)
    const leafColors = ['#2a6e14', '#358020', '#42961e', '#52aa28', '#3a8a18'];
    const layers = [
      { y: sy - h * 0.55, rx: lr * 1.0, ry: lr * 0.42 },
      { y: sy - h * 0.72, rx: lr * 0.88, ry: lr * 0.38 },
      { y: sy - h * 0.87, rx: lr * 0.72, ry: lr * 0.32 },
      { y: sy - h * 0.98, rx: lr * 0.50, ry: lr * 0.24 },
    ];
    layers.forEach((layer, i) => {
      // Dark underside
      ctx.fillStyle = leafColors[0];
      ctx.beginPath();
      ctx.ellipse(sx, layer.y + layer.ry * 0.4, layer.rx, layer.ry, 0, 0, Math.PI*2);
      ctx.fill();
      // Main layer
      const sway = Math.sin(t * 0.03 + sx * 0.1) * zoom * 0.8;
      ctx.fillStyle = leafColors[i + 1] || leafColors[3];
      ctx.beginPath();
      ctx.ellipse(sx + sway, layer.y, layer.rx, layer.ry, 0, 0, Math.PI*2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(100,200,60,0.15)';
      ctx.beginPath();
      ctx.ellipse(sx + sway - layer.rx*0.2, layer.y - layer.ry*0.2, layer.rx*0.5, layer.ry*0.35, 0, 0, Math.PI*2);
      ctx.fill();
    });

    if (isNight) {
      ctx.fillStyle = 'rgba(0,0,20,0.25)';
      layers.forEach(l => {
        ctx.beginPath();
        ctx.ellipse(sx, l.y, l.rx, l.ry, 0, 0, Math.PI*2);
        ctx.fill();
      });
    }

    // Random leaf particles
    if (Math.random() < 0.008) this.ps.emit(PT.LEAF, sx / this.TW / this.zoom, sy / this.TH / this.zoom, 0, 1);
  }

  _drawPineTree(ctx, sx, sy, zoom, rnd, t, isNight) {
    const h  = (36 + rnd * 14) * zoom;
    const tr = (4 + rnd * 2) * zoom;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx + 2*zoom, sy + 3*zoom, 10*zoom, 4*zoom, 0, 0, Math.PI*2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#4a2c10';
    ctx.fillRect(sx - tr*0.5, sy - h*0.55, tr, h*0.55);

    // Layers (triangle tiers)
    const layers = [0.9, 0.7, 0.5, 0.3];
    const widths  = [0.55, 0.42, 0.3, 0.18];
    layers.forEach((yFrac, i) => {
      const layerY  = sy - h * yFrac;
      const layerW  = h * widths[i];
      const c = i % 2 === 0 ? '#1e6016' : '#26781e';
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(sx, layerY - h * 0.2);
      ctx.lineTo(sx + layerW, layerY);
      ctx.lineTo(sx - layerW, layerY);
      ctx.closePath();
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(80,180,40,0.18)';
      ctx.beginPath();
      ctx.moveTo(sx - layerW*0.1, layerY - h*0.18);
      ctx.lineTo(sx + layerW*0.1, layerY - h*0.18);
      ctx.lineTo(sx, layerY - h*0.22);
      ctx.closePath();
      ctx.fill();
    });

    if (isNight) {
      ctx.fillStyle = 'rgba(0,0,20,0.28)';
      layers.forEach((yFrac, i) => {
        ctx.beginPath();
        ctx.moveTo(sx, sy - h*yFrac - h*0.2);
        ctx.lineTo(sx + h*widths[i], sy - h*yFrac);
        ctx.lineTo(sx - h*widths[i], sy - h*yFrac);
        ctx.closePath(); ctx.fill();
      });
    }
  }

  _drawBirchTree(ctx, sx, sy, zoom, rnd, t, isNight) {
    const h  = (30 + rnd * 10) * zoom;
    const tr = (4 + rnd * 2) * zoom;
    const lr = (15 + rnd * 6) * zoom;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx+2*zoom, sy+3*zoom, lr*0.7, lr*0.28, 0, 0, Math.PI*2);
    ctx.fill();

    // White birch trunk
    const btg = ctx.createLinearGradient(sx-tr, 0, sx+tr, 0);
    btg.addColorStop(0, '#d0c8b8'); btg.addColorStop(0.5, '#f0ece0'); btg.addColorStop(1, '#c0b8a8');
    ctx.fillStyle = btg;
    ctx.fillRect(sx - tr*0.5, sy - h, tr, h);
    // Black marks
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 3; i++) {
      const my = sy - h * (0.2 + i * 0.28 + rnd * 0.1);
      ctx.fillRect(sx - tr*0.4, my, tr * 0.8, zoom * 2);
    }

    // Light green leaves
    const lcs = ['#7acc3c', '#8cdc4a', '#6ab830', '#9ae058'];
    [0.6, 0.75, 0.87, 0.95].forEach((yf, i) => {
      const ly = sy - h * yf;
      const rx = lr * (1.0 - i*0.15);
      const ry = lr * (0.4 - i*0.05);
      const sway = Math.sin(t * 0.04 + sx) * zoom;
      ctx.fillStyle = lcs[i];
      ctx.beginPath();
      ctx.ellipse(sx + sway, ly, rx, ry, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,240,80,0.15)';
      ctx.beginPath();
      ctx.ellipse(sx + sway - rx*0.2, ly - ry*0.25, rx*0.4, ry*0.35, 0, 0, Math.PI*2);
      ctx.fill();
    });
  }

  _drawDeadTree(ctx, sx, sy, zoom, rnd) {
    const h = (22 + rnd * 10) * zoom;
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = Math.max(1, 3 * zoom);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - h); ctx.stroke();
    ctx.lineWidth = Math.max(0.5, 1.5 * zoom);
    ctx.beginPath(); ctx.moveTo(sx, sy - h*0.6); ctx.lineTo(sx + h*0.3, sy - h*0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx, sy - h*0.7); ctx.lineTo(sx - h*0.25, sy - h*0.95); ctx.stroke();
  }

  _drawRock(ctx, sx, sy, zoom, rnd, TW) {
    const s = (8 + rnd * 10) * zoom;
    const rx = s * 1.3, ry = s * 0.8;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx + 2*zoom, sy + 2*zoom, rx, ry*0.5, 0, 0, Math.PI*2);
    ctx.fill();

    const rg = ctx.createRadialGradient(sx - rx*0.3, sy - ry*0.4, 0, sx, sy, rx * 1.2);
    rg.addColorStop(0, '#b0b0b0'); rg.addColorStop(0.6, '#808080'); rg.addColorStop(1, '#4a4a4a');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(sx, sy - ry*0.3, rx, ry, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = 'rgba(200,200,200,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx - rx*0.3, sy - ry*0.5, rx*0.4, ry*0.25, -0.3, 0, Math.PI*2);
    ctx.fill();
  }

  _drawMushroom(ctx, sx, sy, zoom, rnd) {
    const sz = (7 + rnd * 6) * zoom;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx+1*zoom, sy+1*zoom, sz*0.7, sz*0.2, 0, 0, Math.PI*2);
    ctx.fill();

    // Stem
    ctx.fillStyle = '#ddd0c0';
    ctx.fillRect(sx - sz*0.25, sy - sz*0.9, sz*0.5, sz*0.9);

    // Cap
    const capG = ctx.createRadialGradient(sx - sz*0.2, sy - sz*0.9, 0, sx, sy - sz*0.8, sz*1.1);
    capG.addColorStop(0, '#ee4444'); capG.addColorStop(0.7, '#cc2222'); capG.addColorStop(1, '#881111');
    ctx.fillStyle = capG;
    ctx.beginPath();
    ctx.arc(sx, sy - sz * 0.85, sz, Math.PI, 0);
    ctx.closePath(); ctx.fill();

    // White spots
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[0, -sz*0.25, sz*0.15], [-sz*0.45, -sz*0.1, sz*0.1], [sz*0.4, -sz*0.15, sz*0.1]].forEach(([dx,dy,r]) => {
      ctx.beginPath(); ctx.arc(sx+dx, sy-sz*0.85+dy, r, 0, Math.PI*2); ctx.fill();
    });
  }

  _drawFlower(ctx, sx, sy, zoom, rnd, t) {
    const types = [
      { petal: '#ff6699', center: '#ffee00' },
      { petal: '#ff9933', center: '#fff200' },
      { petal: '#cc44ff', center: '#ffff00' },
      { petal: '#ffffff', center: '#ffcc00' },
    ];
    const fl = types[Math.floor(rnd * types.length)];
    const sz = (4 + rnd * 3) * zoom;
    const sw = Math.sin(t * 0.06 + sx * 0.2) * zoom * 0.5;

    ctx.fillStyle = '#3a8820';
    ctx.fillRect(sx - zoom*0.5, sy - sz * 1.6 + sw, zoom, sz * 1.6);

    ctx.fillStyle = fl.petal;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * sz * 0.8 + sw, sy - sz * 1.6 + Math.sin(a) * sz * 0.4, sz * 0.5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = fl.center;
    ctx.beginPath();
    ctx.arc(sx + sw, sy - sz * 1.6, sz * 0.45, 0, Math.PI*2);
    ctx.fill();
  }

  _drawCactus(ctx, sx, sy, zoom, rnd) {
    const h = (24 + rnd * 12) * zoom;
    const w = (5 + rnd * 3) * zoom;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(sx+2*zoom, sy+2*zoom, w*1.2, w*0.4, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#3a8c1e';
    ctx.fillRect(sx - w*0.5, sy - h, w, h);
    // Arms
    ctx.fillRect(sx + w*0.5, sy - h * 0.6, w * 1.2, w * 0.8);
    ctx.fillRect(sx + w*0.5 + w*1.2 - w*0.5, sy - h*0.6 - w*0.8, w, w*0.8);
    ctx.fillRect(sx - w*0.5 - w*1.2, sy - h * 0.45, w * 1.2, w * 0.8);
    ctx.fillRect(sx - w*0.5 - w*1.2 - w*0.5, sy - h*0.45 - w*0.8, w, w*0.8);

    // Spines
    ctx.strokeStyle = '#c0d080';
    ctx.lineWidth = Math.max(0.5, zoom * 0.6);
    for (let i = 0; i < 5; i++) {
      const ny = sy - h * (0.15 + i * 0.18);
      ctx.beginPath(); ctx.moveTo(sx - w*0.5 - 3*zoom, ny); ctx.lineTo(sx - w*0.5, ny); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + w*0.5, ny); ctx.lineTo(sx + w*0.5 + 3*zoom, ny); ctx.stroke();
    }
  }

  _drawHouse(ctx, wx, wz, sx, sy, zoom, rnd, isNight) {
    const w = (18 + rnd * 6) * zoom;
    const h = (16 + rnd * 4) * zoom;
    const roofH = (10 + rnd * 4) * zoom;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(sx+2*zoom, sy+3*zoom, w, w*0.35, 0, 0, Math.PI*2); ctx.fill();

    // Walls (isometric front-left)
    ctx.fillStyle = '#c89060';
    ctx.fillRect(sx - w, sy - h, w, h);
    // Right wall (darker)
    ctx.fillStyle = '#a07040';
    ctx.fillRect(sx, sy - h, w, h);

    // Windows
    const winC = isNight ? '#ffee88' : '#88ccee';
    ctx.fillStyle = winC;
    ctx.fillRect(sx - w*0.7, sy - h*0.65, w*0.22, h*0.25);
    ctx.fillRect(sx - w*0.3, sy - h*0.65, w*0.22, h*0.25);
    ctx.fillRect(sx + w*0.1, sy - h*0.65, w*0.22, h*0.25);
    if (isNight) {
      ctx.fillStyle = 'rgba(255,220,100,0.2)';
      ctx.beginPath(); ctx.arc(sx - w*0.6, sy - h*0.52, w*0.5, 0, Math.PI*2); ctx.fill();
    }

    // Door
    ctx.fillStyle = '#6a4020';
    ctx.fillRect(sx - w*0.15, sy - h*0.45, w*0.3, h*0.45);

    // Roof (isometric triangle)
    const roofColor = '#8a3820';
    ctx.fillStyle = roofColor;
    // Left slope
    ctx.beginPath();
    ctx.moveTo(sx - w,     sy - h);
    ctx.lineTo(sx,         sy - h - roofH);
    ctx.lineTo(sx,         sy - h);
    ctx.closePath(); ctx.fill();
    // Right slope (lighter)
    ctx.fillStyle = '#6a2810';
    ctx.beginPath();
    ctx.moveTo(sx,         sy - h);
    ctx.lineTo(sx,         sy - h - roofH);
    ctx.lineTo(sx + w,     sy - h);
    ctx.closePath(); ctx.fill();
    // Ridge
    ctx.fillStyle = '#b05030';
    ctx.beginPath();
    ctx.moveTo(sx - w,     sy - h);
    ctx.lineTo(sx,         sy - h - roofH);
    ctx.lineTo(sx + w,     sy - h);
    ctx.lineTo(sx,         sy - h - roofH);
    ctx.closePath(); ctx.fill();

    // Chimney
    ctx.fillStyle = '#7a5838';
    ctx.fillRect(sx + w*0.3, sy - h - roofH * 0.5, w*0.12, roofH*0.5);
    if (Math.random() < 0.04) this.ps.emit(PT.SMOKE, wx, wz, 2, 1);
  }

  _drawTorch(ctx, sx, sy, zoom, t) {
    const h = 10 * zoom;
    ctx.fillStyle = '#6a3a10';
    ctx.fillRect(sx - zoom, sy - h, zoom*2, h);
    const fc = Math.sin(t * 0.2) > 0 ? '#ffaa00' : '#ff7700';
    ctx.fillStyle = fc;
    ctx.beginPath(); ctx.arc(sx, sy - h, 3*zoom, 0, Math.PI*2); ctx.fill();
    ctx.save();
    ctx.shadowBlur = 8 * zoom; ctx.shadowColor = '#ff8800';
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(sx, sy - h, 1.5*zoom, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.12) this.ps.emit(PT.FIRE, sx, sy - h, 0.3, 1);
  }

  // ── Entities ─────────────────────────────────────────────────────
  _drawEntities(dayPhase) {
    const ctx = this.ctx;
    const isNight = dayPhase > 0.62 || dayPhase < 0.12;

    // Sort by z-order for isometric (draw back-to-front)
    const sorted = [...this.em.entities].sort((a, b) => (a.x + a.z) - (b.x + b.z));

    for (const e of sorted) {
      const h = this.world.getHeight(Math.round(e.x), Math.round(e.z)) || 1;
      const pos = this.w2s(e.x, e.z, h);
      const sx = pos.x, sy = pos.y;

      ctx.save();
      ctx.globalAlpha = e.deathAlpha !== undefined ? e.deathAlpha : 1;
      ctx.translate(sx, sy);

      if (!e.alive) {
        this._drawDeadTroglyte(ctx, e);
      } else {
        this._drawTroglyte(ctx, e, isNight);
      }

      // Selection ring
      if (this._sel === e) {
        ctx.strokeStyle = '#88ddff';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14 * this.zoom, 6 * this.zoom, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  _drawTroglyte(ctx, e, isNight) {
    const zoom = this.zoom;
    const t = this.time;
    const walk = (e.state === ES.WALK || e.state === ES.EXPLORE)
      ? Math.sin(e.animPhase) : 0;
    const isSleeping = e.state === ES.SLEEP;

    if (isSleeping) {
      ctx.rotate(Math.PI / 2 * 0.9);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(1*zoom, 2*zoom, 9*zoom, 3.5*zoom, 0, 0, Math.PI*2);
    ctx.fill();

    // Legs
    const lOff = walk * 3 * zoom;
    ctx.fillStyle = this._darkenHex(e.clothColor, 10);
    ctx.fillRect(-6*zoom,  -5*zoom + lOff,  5*zoom, 6*zoom);
    ctx.fillRect( 2*zoom,  -5*zoom - lOff,  5*zoom, 6*zoom);
    // Boots
    ctx.fillStyle = '#2a1a08';
    ctx.fillRect(-6*zoom,   1*zoom + lOff,  5*zoom, 2*zoom);
    ctx.fillRect( 2*zoom,   1*zoom - lOff,  5*zoom, 2*zoom);

    // Body
    const bodyG = ctx.createLinearGradient(-7*zoom, -16*zoom, 7*zoom, -5*zoom);
    bodyG.addColorStop(0, e.clothColor);
    bodyG.addColorStop(1, this._darkenHex(e.clothColor, 20));
    ctx.fillStyle = bodyG;
    ctx.fillRect(-7*zoom, -16*zoom, 14*zoom, 12*zoom);

    // Accent stripe
    ctx.fillStyle = e.clothColor2;
    ctx.fillRect(-7*zoom, -15*zoom, 14*zoom, 2*zoom);

    // Belt
    ctx.fillStyle = '#1a1008';
    ctx.fillRect(-7*zoom, -6*zoom, 14*zoom, 2*zoom);

    // Arms
    const armL = -walk * 4 * zoom;
    const armR =  walk * 4 * zoom;
    // Left arm
    ctx.fillStyle = e.skinColor;
    ctx.fillRect(-11*zoom, -15*zoom + armL, 4*zoom, 10*zoom);
    // Right arm
    ctx.fillRect(  7*zoom, -15*zoom + armR, 4*zoom, 10*zoom);

    // Build tool in hand
    if (e.state === ES.BUILD) {
      ctx.fillStyle = '#a08060';
      ctx.fillRect(8*zoom, -18*zoom + armR, 2*zoom, 14*zoom);
    }

    // Head
    const headG = ctx.createRadialGradient(-3*zoom, -24*zoom, 0, 0, -22*zoom, 10*zoom);
    headG.addColorStop(0, this._lightenHex(e.skinColor, 18));
    headG.addColorStop(1, e.skinColor);
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.roundRect(-8*zoom, -30*zoom, 16*zoom, 15*zoom, 3*zoom);
    ctx.fill();
    // Neck
    ctx.fillStyle = e.skinColor;
    ctx.fillRect(-4*zoom, -18*zoom, 8*zoom, 4*zoom);

    // Eyes
    const eyeOpen = !isSleeping;
    const eyeH = eyeOpen ? 3*zoom : 1*zoom;
    // Eye whites
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-6*zoom, -26*zoom, 5*zoom, eyeH + zoom);
    ctx.fillRect( 2*zoom, -26*zoom, 5*zoom, eyeH + zoom);
    // Eye color
    ctx.fillStyle = e.eyeColor;
    ctx.fillRect(-6*zoom, -26*zoom, 5*zoom, eyeH);
    ctx.fillRect( 2*zoom, -26*zoom, 5*zoom, eyeH);

    // Pupil
    if (eyeOpen) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-5*zoom, -26*zoom, 2*zoom, 2*zoom);
      ctx.fillRect( 3*zoom, -26*zoom, 2*zoom, 2*zoom);
    }

    // Night eye glow
    if (isNight && eyeOpen) {
      ctx.save();
      ctx.shadowBlur = 8; ctx.shadowColor = e.eyeColor;
      ctx.fillStyle = e.eyeColor;
      ctx.fillRect(-6*zoom, -26*zoom, 5*zoom, eyeH);
      ctx.fillRect( 2*zoom, -26*zoom, 5*zoom, eyeH);
      ctx.restore();
    }

    // Smile / expression
    if (e.happiness > 60) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = zoom;
      ctx.beginPath();
      ctx.arc(0, -20*zoom, 3*zoom, 0, Math.PI);
      ctx.stroke();
    }

    // Elder crown
    if (e.isElder) {
      ctx.fillStyle = '#c8a000';
      ctx.fillRect(-8*zoom, -31*zoom, 16*zoom, 2*zoom);
      [[-6,-34],[0,-36],[6,-34]].forEach(([dx,dy]) => {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.arc(dx*zoom, dy*zoom, 2.5*zoom, 0, Math.PI*2); ctx.fill();
      });
    }

    // Health bar
    if (e.health < e.maxHealth) {
      const bw = 18*zoom, bh = 2*zoom;
      const bx = -bw/2, by = -38*zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx-1, by-1, bw+2, bh+2);
      ctx.fillStyle = e.health > 60 ? '#44cc44' : e.health > 30 ? '#cccc22' : '#cc3333';
      ctx.fillRect(bx, by, bw * (e.health / e.maxHealth), bh);
    }

    // Name
    if (this.zoom > 0.9) {
      ctx.font = `bold ${Math.round(9*zoom)}px "Inter",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = e.isElder ? '#ffd700' : 'rgba(220,235,255,0.92)';
      ctx.shadowBlur = 3; ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.fillText(e.name, 0, -40*zoom);
      ctx.shadowBlur = 0;
    }

    // Speech bubble
    if (e.speechTimer > 0 && e.speechText) {
      const alpha = Math.min(1, e.speechTimer / 30);
      ctx.globalAlpha *= alpha;
      const fsize = Math.round(8 * zoom);
      ctx.font = `${fsize}px "Inter",sans-serif`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(e.speechText).width + 10;
      const bh = fsize + 8, bw = tw;
      const bx = -bw/2, by = -(50 + bh)*zoom;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillText(e.speechText, 0, by + bh - 5);
    }
  }

  _drawDeadTroglyte(ctx, e) {
    const zoom = this.zoom;
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha *= e.deathAlpha;
    ctx.fillStyle = '#606070';
    ctx.fillRect(-14*zoom, -4*zoom, 28*zoom, 8*zoom);
    if (Math.random() < 0.04) this.ps.emit(PT.SMOKE, e.x, e.z, 0.3, 1);
  }

  // ── Particles ─────────────────────────────────────────────────────
  _drawParticles(highLayer, dayPhase) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    for (const p of this.ps.particles) {
      const isHigh = p.elev > 1.5;
      if (isHigh !== highLayer) continue;

      const pos = this.w2s(p.x, p.z, p.elev);
      const sx = pos.x, sy = pos.y;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);

      if (p.type === PT.FIRE || p.type === PT.MAGIC || p.type === PT.HEAL || p.type === PT.SPARK) {
        ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      }

      ctx.fillStyle = p.color;
      const ps = p.size * this.zoom * 0.6;
      ctx.fillRect(sx - ps/2, sy - ps/2, ps, ps);
      ctx.restore();
    }
  }

  // ── Atmosphere ────────────────────────────────────────────────────
  _drawAtmosphere(dayPhase) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const isNight = dayPhase > 0.62 || dayPhase < 0.12;

    // Night darkness
    if (isNight) {
      let a = 0;
      if (dayPhase > 0.62) a = Math.min(0.4, (dayPhase - 0.62) * 3);
      else a = Math.min(0.4, (0.12 - dayPhase) * 3);
      ctx.fillStyle = `rgba(0,0,20,${a})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  _applyNight(colorOrStyle, darkness, isStyle = false) {
    if (darkness <= 0.01 || isStyle) return colorOrStyle;
    if (typeof colorOrStyle !== 'string') return colorOrStyle;
    // Simple: return a darkened version
    const r = parseInt(colorOrStyle.slice(1,3),16);
    const g = parseInt(colorOrStyle.slice(3,5),16);
    const b = parseInt(colorOrStyle.slice(5,7),16);
    const f = 1 - darkness * 0.65;
    return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
  }

  _varHex(hex, vary) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    const v = vary * 0.5;
    return `rgb(${Math.round(Math.min(255,Math.max(0,r+v)))},${Math.round(Math.min(255,Math.max(0,g+v)))},${Math.round(Math.min(255,Math.max(0,b+v)))})`;
  }

  _lightenHex(hex, amt) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
  }

  _darkenHex(hex, amt) { return this._lightenHex(hex, -amt); }

  shake(s) { this._shake.s = Math.max(this._shake.s, s); }
  setSelectedEntity(e) { this._sel = e; }
}

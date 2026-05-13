class GameApp {
  constructor() {
    this.world   = null;
    this.em      = null;
    this.renderer = null;
    this.ps      = null;
    this.ui      = new UIManager(this);

    this.currentTool = TOOLS.BRUSH_GRASS;
    this.brushSize   = 1;
    this.paused      = false;
    this.simSpeed    = 2;
    this.selectedEntity = null;

    this._mouseDown = false;
    this._lastMX = 0; this._lastMY = 0;
    this._dragStartX = 0; this._dragStartY = 0;
    this._isDragging = false;
    this._touchStart = null;
    this._lastPinchDist = 0;

    this._initStartScreen();
  }

  _initStartScreen() {
    const canvas = document.getElementById('start-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    const miniWorld = new World(60, 60, Math.floor(Math.random() * 9999));
    let camX = 30, camZ = 30, t = 0;
    const TW = 28, TH = 14;

    const drawPreview = () => {
      if (document.getElementById('start-screen').style.display === 'none') return;
      t++;
      camX += 0.012;
      if (camX > 55) camX = 5;

      const ctx  = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Sky
      const phase = (t * 0.001) % 1;
      const isN = phase > 0.6;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, isN ? '#020310' : '#0a1e50');
      g.addColorStop(1, isN ? '#060618' : '#1a4098');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const cx = W / 2, cy = H * 0.42;

      // Draw tiles back to front
      for (let diag = 0; diag < 120; diag++) {
        for (let wx = 0; wx < 60; wx++) {
          const wz = wx - diag + 30;
          if (wz < 0 || wz >= 60) continue;

          const h  = miniWorld.getHeight(wx, wz);
          const ty = miniWorld.getType(wx, wz);
          const d  = STD[ty];
          if (!d || !d.color && ty !== 0) {}

          const rx = (wx - camX) - (wz - camZ);
          const rz = (wx - camX) + (wz - camZ);
          const sx = cx + rx * TW / 2;
          const sy = cy + rz * TH / 2 - h * 10;
          const hw = TW / 2, hh = TH / 2;

          if (sx + TW < 0 || sx - TW > W || sy + 60 < 0 || sy > H + 20) continue;
          if (!d) continue;

          const hL = miniWorld.getHeight(wx-1, wz);
          const hR = miniWorld.getHeight(wx, wz-1);

          if (h > hL || !miniWorld.valid(wx-1, wz)) {
            const fh = (h - Math.max(0, hL)) * 10;
            ctx.fillStyle = d.l;
            ctx.beginPath();
            ctx.moveTo(sx-hw, sy+hh); ctx.lineTo(sx, sy+TH);
            ctx.lineTo(sx, sy+TH+fh); ctx.lineTo(sx-hw, sy+hh+fh);
            ctx.closePath(); ctx.fill();
          }
          if (h > hR || !miniWorld.valid(wx, wz-1)) {
            const fh = (h - Math.max(0, hR)) * 10;
            ctx.fillStyle = d.r;
            ctx.beginPath();
            ctx.moveTo(sx, sy+TH); ctx.lineTo(sx+hw, sy+hh);
            ctx.lineTo(sx+hw, sy+hh+fh); ctx.lineTo(sx, sy+TH+fh);
            ctx.closePath(); ctx.fill();
          }

          let topColor = d.top;
          if (ty === ST.WATER || ty === ST.DEEP_WATER) {
            const wv = Math.sin(t * 0.05 + wx * 0.4 + wz * 0.3) * 15;
            topColor = ty === ST.WATER
              ? `rgb(42,${122+wv},${220+wv})`
              : `rgb(16,${50+wv},150)`;
          }
          if (ty === ST.LAVA) {
            const lv = Math.sin(t * 0.07 + wx + wz * 0.6) * 0.4;
            topColor = `rgb(${220+lv*30},${60+lv*40},0)`;
          }

          ctx.fillStyle = topColor;
          ctx.beginPath();
          ctx.moveTo(sx, sy); ctx.lineTo(sx+hw, sy+hh);
          ctx.lineTo(sx, sy+TH); ctx.lineTo(sx-hw, sy+hh);
          ctx.closePath(); ctx.fill();

          const feat = miniWorld.getFeature(wx, wz);
          if (feat === FT.OAK_TREE || feat === FT.BIRCH) {
            ctx.fillStyle = '#3a7820';
            ctx.beginPath(); ctx.arc(sx, sy - h*10/10 - 14, 9, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#4a8830';
            ctx.beginPath(); ctx.arc(sx-2, sy - h*10/10 - 17, 7, 0, Math.PI*2); ctx.fill();
          } else if (feat === FT.PINE_TREE) {
            ctx.fillStyle = '#1e5010';
            ctx.beginPath();
            ctx.moveTo(sx, sy - h*10/10 - 22);
            ctx.lineTo(sx+8, sy - h*10/10 - 8);
            ctx.lineTo(sx-8, sy - h*10/10 - 8);
            ctx.closePath(); ctx.fill();
          }
        }
      }

      if (isN) { ctx.fillStyle = 'rgba(0,0,20,0.35)'; ctx.fillRect(0,0,W,H); }

      // Dark vignette
      const vg = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);

      requestAnimationFrame(drawPreview);
    };
    drawPreview();
  }

  initWorld(popCount, speed) {
    const seed = Math.floor(Math.random() * 99999);
    this.simSpeed = speed;
    this.ps = new ParticleSystem();
    this.world = new World(CFG.WORLD_W, CFG.WORLD_D, seed);
    this.em = new EntityManager(this.world);
    this.em.spawnInitial(popCount);

    const canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(canvas, this.world, this.em, this.ps);

    this._bindCanvasEvents(canvas);
    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    // Center camera and zoom
    this.renderer.camX = CFG.WORLD_W / 2;
    this.renderer.camZ = CFG.WORLD_D / 2;
    this.renderer.zoom = 1.4;

    requestAnimationFrame((t) => this._loop(t));
    this.ui.showNotification('Мир создан. Добро пожаловать, Бог.', 'info');
  }

  _onResize() {
    if (!this.renderer) return;
    const c = document.getElementById('game-canvas-container');
    const r = c.getBoundingClientRect();
    this.renderer.resize(r.width, r.height);
  }

  _lastTick = 0;
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    if (!this.paused) {
      for (let i = 0; i < this.simSpeed; i++) {
        this.world.update();
        this.em.update();
      }
      this.ps.update();
    }
    const dayPhase = (this.em ? this.em.time : 0) % CFG.DAY_TICKS / CFG.DAY_TICKS;
    if (this.renderer) this.renderer.render(this.em ? this.em.time : 0, dayPhase);
    this.ui.updateHUD(this);
  }

  _bindCanvasEvents(canvas) {
    canvas.addEventListener('mousedown',  (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove',  (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup',    (e) => this._onMouseUp(e));
    canvas.addEventListener('mouseleave', ()  => { this._mouseDown = false; });
    canvas.addEventListener('wheel',      (e) => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu',(e) => { e.preventDefault(); });
    // Touch
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove',  (e) => this._onTouchMove(e),  { passive: false });
    canvas.addEventListener('touchend',   (e) => this._onTouchEnd(e));
    window.addEventListener('keydown',    (e) => this._onKeyDown(e));
  }

  _canvasPos(e) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onMouseDown(e) {
    e.preventDefault();
    this._mouseDown = true;
    this._isDragging = false;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._lastMX = e.clientX;
    this._lastMY = e.clientY;
    if (e.button === 0) this._applyTool(e.clientX, e.clientY);
  }

  _onMouseMove(e) {
    if (!this.renderer) return;
    const cp = this._canvasPos(e);
    const wp = this.renderer.s2w(cp.x, cp.y);
    const tx = Math.round(wp.x), tz = Math.round(wp.z);
    const tile = this.world ? this.world.getType(tx, tz) : 0;
    this.ui.showTileInfo(wp.x, wp.z, tile, this.world ? this.world.getBiomeName(tx, tz) : '');

    if (this._mouseDown) {
      const dx = e.clientX - this._dragStartX, dy = e.clientY - this._dragStartY;
      if (!this._isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) this._isDragging = true;

      if (e.buttons === 2 || e.buttons === 4 || (e.buttons === 1 && this._currentToolIsPan())) {
        // Pan
        const ddx = e.clientX - this._lastMX, ddy = e.clientY - this._lastMY;
        const TW = CFG.ISO_TW * this.renderer.zoom;
        const TH = CFG.ISO_TH * this.renderer.zoom;
        this.renderer.camX -= ddx / TW;
        this.renderer.camZ -= ddy / TH;
      } else if (e.buttons === 1 && this._isDragging) {
        this._applyTool(e.clientX, e.clientY);
      }
    }
    this._lastMX = e.clientX;
    this._lastMY = e.clientY;
  }

  _onMouseUp(e) {
    this._mouseDown = false;
    if (!this._isDragging && e.button === 0) this._trySelectEntity(e.clientX, e.clientY);
  }

  _onWheel(e) {
    e.preventDefault();
    if (!this.renderer) return;
    const cp = this._canvasPos(e);
    this._zoomAt(cp.x, cp.y, e.deltaY > 0 ? 0.87 : 1.15);
  }

  _zoomAt(sx, sy, factor) {
    const r = this.renderer;
    const wp = r.s2w(sx, sy);
    r.zoom = Math.max(0.35, Math.min(5, r.zoom * factor));
    const wp2 = r.s2w(sx, sy);
    r.camX += wp.x - wp2.x;
    r.camZ += wp.z - wp2.z;
  }

  // Touch support
  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this._mouseDown = true;
      this._isDragging = false;
      this._dragStartX = t.clientX; this._dragStartY = t.clientY;
      this._lastMX = t.clientX; this._lastMY = t.clientY;
      this._touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
    } else if (e.touches.length === 2) {
      this._lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this.renderer) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - this._lastMX, dy = t.clientY - this._lastMY;
      if (!this._isDragging && (Math.abs(t.clientX - this._dragStartX) > 8 || Math.abs(t.clientY - this._dragStartY) > 8)) {
        this._isDragging = true;
      }
      if (this._isDragging) {
        const TW = CFG.ISO_TW * this.renderer.zoom;
        const TH = CFG.ISO_TH * this.renderer.zoom;
        this.renderer.camX -= dx / TW;
        this.renderer.camZ -= dy / TH;
      }
      this._lastMX = t.clientX; this._lastMY = t.clientY;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (this._lastPinchDist > 0) {
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        this._zoomAt(cx - this.renderer.canvas.getBoundingClientRect().left,
                     cy - this.renderer.canvas.getBoundingClientRect().top,
                     dist / this._lastPinchDist);
      }
      this._lastPinchDist = dist;
    }
  }

  _onTouchEnd(e) {
    if (e.touches.length === 0) {
      const ts = this._touchStart;
      if (ts && !this._isDragging && Date.now() - ts.time < 350) {
        // Tap = apply tool
        this._applyTool(ts.x, ts.y);
        if (!this._currentToolIsBrush()) this._trySelectEntity(ts.x, ts.y);
      }
      this._mouseDown = false;
      this._touchStart = null;
    }
    this._lastPinchDist = 0;
  }

  _currentToolIsPan() { return false; }
  _currentToolIsBrush() {
    return Object.values(TOOL_TILE).includes(TOOL_TILE[this.currentTool]) || this.currentTool === TOOLS.ERASE_FEATURE;
  }

  _onKeyDown(e) {
    if (!this.renderer) return;
    const spd = 2;
    switch (e.key) {
      case 'ArrowLeft':  this.renderer.camX -= spd; break;
      case 'ArrowRight': this.renderer.camX += spd; break;
      case 'ArrowUp':    this.renderer.camZ -= spd; break;
      case 'ArrowDown':  this.renderer.camZ += spd; break;
      case ' ':  e.preventDefault(); this.togglePause(); break;
      case '+': case '=': this.renderer.zoom = Math.min(5, this.renderer.zoom * 1.2); break;
      case '-':           this.renderer.zoom = Math.max(0.35, this.renderer.zoom * 0.8); break;
      case 'Escape': this.selectedEntity = null; this.renderer.setSelectedEntity(null); this.ui.showEntityInfo(null); break;
    }
  }

  _screenToWorld(clientX, clientY) {
    if (!this.renderer) return { x: 0, z: 0 };
    const rect = this.renderer.canvas.getBoundingClientRect();
    return this.renderer.s2w(clientX - rect.left, clientY - rect.top);
  }

  _applyTool(clientX, clientY) {
    if (!this.world || !this.renderer) return;
    const wp = this._screenToWorld(clientX, clientY);
    const wx = Math.round(wp.x), wz = Math.round(wp.z);
    const tool = this.currentTool;

    if (!this.ui.canUseTool(tool)) {
      this.ui.showNotification('Недостаточно маны!', 'warn');
      return;
    }

    const r = this.brushSize - 1;

    // Tile brushes
    if (TOOL_TILE[tool] !== undefined) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (dx*dx + dz*dz <= r*r + 0.5 && this.world.valid(wx+dx, wz+dz))
            this.world.setType(wx+dx, wz+dz, TOOL_TILE[tool]);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.RAISE) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (dx*dx + dz*dz <= r*r + 0.5)
            this.world.setHeight(wx+dx, wz+dz, this.world.getHeight(wx+dx, wz+dz) + 1);
      return;
    }
    if (tool === TOOLS.LOWER) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (dx*dx + dz*dz <= r*r + 0.5)
            this.world.setHeight(wx+dx, wz+dz, this.world.getHeight(wx+dx, wz+dz) - 1);
      return;
    }
    if (tool === TOOLS.ERASE_FEATURE) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          this.world.setFeature(wx+dx, wz+dz, FT.NONE);
      return;
    }

    if (tool === TOOLS.SPAWN_TROGLYTE) {
      this.em.spawn(wp.x, wp.z, false);
      this.ps.emit(PT.MAGIC, wp.x, wp.z, 1, 15);
      this.ui.spendMana(tool); return;
    }
    if (tool === TOOLS.SPAWN_ELDER) {
      this.em.spawn(wp.x, wp.z, true);
      this.ps.emit(PT.MAGIC, wp.x, wp.z, 1, 25);
      this.ui.spendMana(tool); return;
    }

    if (tool === TOOLS.METEOR)     { this._applyMeteor(wx, wz, wp);     this.ui.spendMana(tool); return; }
    if (tool === TOOLS.LIGHTNING)  { this._applyLightning(wx, wz);      this.ui.spendMana(tool); return; }
    if (tool === TOOLS.RAIN)       { this._applyRain(wx, wz);           this.ui.spendMana(tool); return; }
    if (tool === TOOLS.EARTHQUAKE) { this._applyEarthquake(wx, wz);     this.ui.spendMana(tool); return; }
    if (tool === TOOLS.FIRE_STORM) { this._applyFireStorm(wx, wz);      this.ui.spendMana(tool); return; }
    if (tool === TOOLS.HEAL)       { this._applyHeal(wp.x, wp.z);       this.ui.spendMana(tool); return; }
  }

  _applyMeteor(wx, wz, wp) {
    this.ps.emit(PT.EXPLOSION, wp.x, wp.z, 3, 30);
    this.ps.emit(PT.SPARK,     wp.x, wp.z, 4, 20);
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        const d2 = dx*dx + dz*dz;
        if (d2 > 9) continue;
        if (d2 < 3) { this.world.setType(wx+dx, wz+dz, ST.LAVA); this.world.setHeight(wx+dx, wz+dz, Math.max(1, this.world.getHeight(wx+dx,wz+dz)-2)); }
        else { this.world.setFire(wx+dx, wz+dz, 20); this.world.setFeature(wx+dx, wz+dz, FT.NONE); }
      }
    this.renderer.shake(18);
    for (const e of this.em.entities) {
      if (!e.alive) continue;
      if (Math.hypot(e.x-wp.x, e.z-wp.z) < 4) { e.health -= 80; if (e.health<=0) e.die('метеорит'); }
    }
    this.em._log('МЕТЕОРИТ УПАЛ!');
  }

  _applyLightning(wx, wz) {
    this.ps.emit(PT.LIGHTNING, wx, wz, 2, 25);
    this.ps.emit(PT.SPARK,     wx, wz, 1, 15);
    this.world.setFire(wx, wz, 18);
    this.world.setFeature(wx, wz, FT.NONE);
    this.renderer.shake(10);
    for (const e of this.em.entities) {
      if (!e.alive) continue;
      if (Math.hypot(e.x-wx, e.z-wz) < 2) { e.health -= 65; if (e.health<=0) e.die('молния'); }
    }
    this.em._log('Молния ударила!');
  }

  _applyRain(wx, wz) {
    for (let i = 0; i < 50; i++) {
      this.ps.emit(PT.RAIN, wx + (Math.random()-0.5)*12, wz + (Math.random()-0.5)*12, 4, 1);
    }
    for (let dz = -6; dz <= 6; dz++)
      for (let dx = -6; dx <= 6; dx++)
        if (this.world.getFire(wx+dx, wz+dz)) this.world.setFire(wx+dx, wz+dz, 0);
    this.em._log('Прошёл дождь.');
  }

  _applyEarthquake(wx, wz) {
    this.renderer.shake(28);
    for (let i = 0; i < 80; i++) {
      const rx = wx + (Math.random()-0.5)*18, rz = wz + (Math.random()-0.5)*18;
      const irx = Math.round(rx), irz = Math.round(rz);
      if (this.world.valid(irx, irz) && Math.random() < 0.35) {
        const dh = Math.random() < 0.5 ? -1 : 1;
        this.world.setHeight(irx, irz, this.world.getHeight(irx,irz) + dh);
        this.ps.emit(PT.DUST, rx, rz, 0.5, 2);
      }
    }
    this.em._log('Землетрясение всколыхнуло мир!');
  }

  _applyFireStorm(wx, wz) {
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++)
        if (dx*dx+dz*dz <= 10) {
          this.world.setFire(wx+dx, wz+dz, 15 + Math.floor(Math.random()*10));
          this.ps.emit(PT.FIRE, wx+dx, wz+dz, 1, 2);
        }
    for (const e of this.em.entities) {
      if (!e.alive) continue;
      if (Math.hypot(e.x-wx, e.z-wz) < 4) { e.health -= 40; if (e.health<=0) e.die('огонь'); }
    }
  }

  _applyHeal(ewx, ewz) {
    for (const e of this.em.entities) {
      if (!e.alive) continue;
      if (Math.hypot(e.x-ewx, e.z-ewz) < 5) {
        e.health = Math.min(e.maxHealth, e.health + 45);
        e.hunger = Math.min(100, e.hunger + 30);
        e.happiness = Math.min(100, e.happiness + 25);
        e.speak('Спасибо!');
        this.ps.emit(PT.HEAL, e.x, e.z, 1, 8);
      }
    }
  }

  _trySelectEntity(clientX, clientY) {
    if (!this.renderer) return;
    const wp = this._screenToWorld(clientX, clientY);
    const entity = this.em ? this.em.getAt(wp.x, wp.z, 1.5) : null;
    this.selectedEntity = entity;
    this.renderer.setSelectedEntity(entity);
    this.ui.showEntityInfo(entity);
  }

  togglePause() { this.paused = !this.paused; }
  cycleSpeed()  { this.simSpeed = this.simSpeed >= 5 ? 1 : this.simSpeed + 1; }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new GameApp(); });

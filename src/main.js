class GameApp {
  constructor() {
    this.world = null;
    this.em = null;
    this.renderer = null;
    this.ps = null;
    this.ui = new UIManager(this);

    this.currentTool = TOOLS.BRUSH_GRASS;
    this.brushSize = 1;
    this.paused = false;
    this.simSpeed = 2;
    this.selectedEntity = null;
    this._rafId = null;
    this._lastTick = 0;
    this._mouseDown = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;

    this._initStartScreen();
  }

  _initStartScreen() {
    // Animate the start screen canvas (mini world preview)
    const canvas = document.getElementById('start-canvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const tempWorld = new World(120, 80, Math.floor(Math.random() * 9999));
    const miniRenderer = {
      cam: { x: 30, y: 25, zoom: 1.4 },
      t: 0
    };

    const drawPreview = () => {
      if (document.getElementById('start-screen').style.display === 'none') return;
      miniRenderer.t++;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ts = CFG.TILE_SIZE * miniRenderer.cam.zoom;
      const W = canvas.width, H = canvas.height;

      // Move camera slowly
      miniRenderer.cam.x += 0.008;
      if (miniRenderer.cam.x > tempWorld.w - W/ts) miniRenderer.cam.x = 0;

      const phase = (miniRenderer.t * 0.002) % 1;
      const isNight = phase > 0.5;

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      if (isNight) {
        skyGrad.addColorStop(0, '#020410'); skyGrad.addColorStop(1, '#0a0820');
      } else {
        skyGrad.addColorStop(0, '#0a1a4a'); skyGrad.addColorStop(1, '#3a6acc');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      const cam = miniRenderer.cam;
      const startX = Math.max(0, Math.floor(cam.x - 1));
      const endX   = Math.min(tempWorld.w - 1, Math.ceil(cam.x + W/ts + 1));
      const startY = Math.max(0, Math.floor(cam.y - 1));
      const endY   = Math.min(tempWorld.h - 1, Math.ceil(cam.y + H/ts + 1));

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const tile = tempWorld.get(x, y);
          if (tile === T.AIR) continue;
          const data = TD[tile];
          if (!data || !data.color) continue;

          const sx = (x - cam.x) * ts;
          const sy = (y - cam.y) * ts;
          const tw = Math.ceil(ts) + 1;
          const th = Math.ceil(ts) + 1;

          if (data.alpha) ctx.globalAlpha = data.alpha;
          if (tile === T.LAVA) {
            const lv = Math.sin(miniRenderer.t * 0.06 + x * 0.4 + y * 0.6);
            ctx.fillStyle = `rgb(${200 + Math.floor(lv * 30)}, ${50 + Math.floor(lv * 40)}, 0)`;
          } else if (tile === T.WATER) {
            ctx.fillStyle = '#1a5cbf';
          } else {
            ctx.fillStyle = data.color;
          }
          ctx.fillRect(sx, sy, tw, th);
          ctx.globalAlpha = 1;
        }
      }

      // Dark overlay for mood
      ctx.fillStyle = isNight ? 'rgba(0,0,20,0.4)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, 0, W, H);

      // Vignette
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      requestAnimationFrame(drawPreview);
    };
    drawPreview();
  }

  initWorld(popCount, speed) {
    const seed = Math.floor(Math.random() * 99999);
    this.simSpeed = speed;

    this.world = new World(CFG.WORLD_W, CFG.WORLD_H, seed);
    this.ps = new ParticleSystem();
    this.em = new EntityManager(this.world);
    this.em.spawnInitial(popCount);

    const canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(canvas, this.world, this.em, this.ps);

    this._bindCanvasEvents(canvas);
    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    // Center camera on first creature
    if (this.em.entities.length > 0) {
      const e = this.em.entities[0];
      this.renderer.camera.x = e.x - 15;
      this.renderer.camera.y = CFG.SURFACE_Y - 15;
    }

    this._lastTick = performance.now();
    this._loop(performance.now());

    this.ui.showNotification('Мир создан. Добро пожаловать, Бог.', 'info');
  }

  _onResize() {
    if (!this.renderer) return;
    const container = document.getElementById('game-canvas-container');
    const rect = container.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
  }

  _loop(now) {
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = now - this._lastTick;
    this._lastTick = now;

    // Update sim
    if (!this.paused) {
      for (let i = 0; i < this.simSpeed; i++) {
        this.world.update();
        this.em.update();
      }
      this.ps.update();
    }

    // Emit fire/lava particles from world
    this._emitWorldParticles();

    // Calculate day phase
    const dayPhase = (this.em.time % CFG.DAY_TICKS) / CFG.DAY_TICKS;

    // Render
    this.renderer.render(this.em.time, dayPhase);

    // Update HUD
    this.ui.updateHUD(this);
  }

  _emitWorldParticles() {
    if (Math.random() > 0.3) return;
    const cam = this.renderer.camera;
    const ts = CFG.TILE_SIZE * cam.zoom;
    const W = this.renderer.canvas.width, H = this.renderer.canvas.height;
    const startX = Math.max(0, Math.floor(cam.x));
    const endX   = Math.min(this.world.w - 1, Math.ceil(cam.x + W / ts));
    const startY = Math.max(0, Math.floor(cam.y));
    const endY   = Math.min(this.world.h - 1, Math.ceil(cam.y + H / ts));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const t = this.world.get(x, y);
        if (t === T.FIRE && Math.random() < 0.08) this.ps.emit(PT.FIRE, x, y - 0.3, 1);
        if (t === T.LAVA && Math.random() < 0.03) {
          this.ps.emit(PT.SPARK, x + Math.random(), y - 0.2, 1);
          this.ps.emit(PT.SMOKE, x + Math.random(), y - 0.5, 1);
        }
        if (t === T.TORCH && Math.random() < 0.06) this.ps.emit(PT.FIRE, x, y - 0.4, 1);
      }
    }
  }

  _bindCanvasEvents(canvas) {
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup',   (e) => this._onMouseUp(e));
    canvas.addEventListener('wheel',     (e) => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this._onRightClick(e); });
    canvas.addEventListener('mouseleave', () => { this._mouseDown = false; });

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  _onMouseDown(e) {
    this._mouseDown = true;
    this._isDragging = false;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;

    if (e.button === 0) {
      this._applyTool(e);
    }
  }

  _onMouseMove(e) {
    if (!this.renderer) return;
    const rect = this.renderer.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wp = this.renderer.screenToWorld(sx, sy);
    const tile = this.world ? this.world.get(Math.round(wp.x), Math.round(wp.y)) : 0;
    this.ui.showTileInfo(wp.x, wp.y, tile);

    if (this._mouseDown) {
      const dx = e.clientX - this._dragStartX;
      const dy = e.clientY - this._dragStartY;
      if (!this._isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        this._isDragging = true;
      }

      if (this._isDragging && e.button !== 0) {
        // Pan
        const ts = CFG.TILE_SIZE * this.renderer.camera.zoom;
        this.renderer.camera.x -= (e.clientX - this._lastMouseX) / ts;
        this.renderer.camera.y -= (e.clientY - this._lastMouseY) / ts;
      } else if (e.button === 0) {
        this._applyTool(e);
      }
    }

    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;
  }

  _onMouseUp(e) {
    this._mouseDown = false;
    if (!this._isDragging && e.button === 0) {
      // Check for entity click
      this._trySelectEntity(e);
    }
  }

  _onRightClick(e) {
    // Pan mode — handled in mousemove
    this._isDragging = true;
  }

  _onWheel(e) {
    e.preventDefault();
    if (!this.renderer) return;
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    const newZoom = Math.max(0.4, Math.min(5, this.renderer.camera.zoom * factor));

    // Zoom towards cursor
    const rect = this.renderer.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const ts = CFG.TILE_SIZE * this.renderer.camera.zoom;
    const wx = sx / ts + this.renderer.camera.x;
    const wy = sy / ts + this.renderer.camera.y;

    this.renderer.camera.zoom = newZoom;
    const newTs = CFG.TILE_SIZE * newZoom;
    this.renderer.camera.x = wx - sx / newTs;
    this.renderer.camera.y = wy - sy / newTs;
  }

  _onKeyDown(e) {
    if (!this.renderer) return;
    const speed = 2;
    const cam = this.renderer.camera;
    switch (e.key) {
      case 'ArrowLeft':  cam.x -= speed; break;
      case 'ArrowRight': cam.x += speed; break;
      case 'ArrowUp':    cam.y -= speed; break;
      case 'ArrowDown':  cam.y += speed; break;
      case ' ': e.preventDefault(); this.togglePause(); break;
      case '+':
      case '=': cam.zoom = Math.min(5, cam.zoom * 1.2); break;
      case '-': cam.zoom = Math.max(0.4, cam.zoom * 0.8); break;
      case 'Escape': this.selectedEntity = null; this.renderer.setSelectedEntity(null); this.ui.showEntityInfo(null); break;
    }
  }

  _applyTool(e) {
    if (!this.world || !this.renderer) return;
    const rect = this.renderer.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wp = this.renderer.screenToWorld(sx, sy);
    const wx = Math.round(wp.x), wy = Math.round(wp.y);

    const tool = this.currentTool;

    if (!this.ui.canUseTool(tool)) {
      this.ui.showNotification('Недостаточно маны!', 'warn');
      return;
    }

    const r = this.brushSize - 1;

    // Tile brush tools
    if (TOOL_TILE[tool] !== undefined) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r + 0.5) continue;
          this.world.set(wx + dx, wy + dy, TOOL_TILE[tool]);
          this.world.invalidateLight(wx + dx, wy + dy);
        }
      }
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.ERASE) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r + 0.5) continue;
          this.world.set(wx + dx, wy + dy, T.AIR);
          this.world.invalidateLight(wx + dx, wy + dy);
        }
      }
      return;
    }

    if (tool === TOOLS.SPAWN_TROGLYTE) {
      this.em.spawn(wx, wy, false);
      this.ps.emitBurst(PT.MAGIC, wx, wy, 12);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.SPAWN_ELDER) {
      this.em.spawn(wx, wy, true);
      this.ps.emitBurst(PT.MAGIC, wx, wy, 20);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.METEOR) {
      this._applyMeteor(wx, wy);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.LIGHTNING) {
      this._applyLightning(wx, wy);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.RAIN) {
      this._applyRain(wx, wy);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.EARTHQUAKE) {
      this._applyEarthquake(wx, wy);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.FIRE_STORM) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx*dx + dy*dy > 12) continue;
          const nt = this.world.get(wx+dx, wy+dy);
          if (nt !== T.AIR && nt !== T.WATER) this.world.set(wx+dx, wy+dy, T.FIRE);
        }
      }
      this.ps.emitBurst(PT.EXPLOSION, wx, wy, 20);
      this.ui.spendMana(tool);
      return;
    }

    if (tool === TOOLS.HEAL) {
      for (const e of this.em.entities) {
        if (!e.alive) continue;
        const dist = Math.sqrt((e.x - wx)**2 + (e.y - wy)**2);
        if (dist < 5) {
          e.health = Math.min(e.maxHealth, e.health + 40);
          e.hunger = Math.min(100, e.hunger + 30);
          e.happiness = Math.min(100, e.happiness + 20);
          e.speak('Спасибо!');
          this.ps.emitBurst(PT.HEAL, e.x, e.y - 0.5, 8);
        }
      }
      this.ui.spendMana(tool);
      return;
    }
  }

  _applyMeteor(wx, wy) {
    this.ps.emitBurst(PT.METEOR, wx - 10, wy - 10, 15);
    this.ps.emitBurst(PT.EXPLOSION, wx, wy, 30);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d2 = dx*dx + dy*dy;
        if (d2 > 9) continue;
        const nt = this.world.get(wx+dx, wy+dy);
        if (d2 < 3) this.world.set(wx+dx, wy+dy, T.LAVA);
        else if (nt !== T.AIR) this.world.set(wx+dx, wy+dy, T.FIRE);
      }
    }
    this.renderer.shake(15);
    // Damage entities
    for (const e of this.em.entities) {
      if (!e.alive) continue;
      const dist = Math.sqrt((e.x - wx)**2 + (e.y - wy)**2);
      if (dist < 4) { e.health -= 80; if (e.health <= 0) e.die('метеорит'); }
    }
    this.em._log('Метеорит упал!');
  }

  _applyLightning(wx, wy) {
    this.ps.emitBurst(PT.LIGHTNING, wx, wy, 20);
    this.ps.emitBurst(PT.SPARK, wx, wy, 15);
    // Strike down from sky
    for (let y = 0; y <= wy; y++) {
      if (this.world.get(wx, y) !== T.AIR) {
        const nt = this.world.get(wx, y);
        if (TD[nt] && TD[nt].flammable) this.world.set(wx, y, T.FIRE);
        break;
      }
    }
    this.renderer.shake(8);
    for (const e of this.em.entities) {
      if (!e.alive) continue;
      const dist = Math.sqrt((e.x - wx)**2 + (e.y - wy)**2);
      if (dist < 2) { e.health -= 60; if (e.health <= 0) e.die('молния'); }
    }
    this.em._log('Молния ударила в мир!');
  }

  _applyRain(wx, wy) {
    for (let i = 0; i < 40; i++) {
      const rx = wx + (Math.random() - 0.5) * 20;
      const ry = wy - Math.random() * 10;
      this.ps.emit(PT.RAIN, rx, ry, 1);
    }
    // Extinguish nearby fire
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        if (this.world.get(wx+dx, wy+dy) === T.FIRE) {
          this.world.set(wx+dx, wy+dy, T.AIR);
        }
      }
    }
    this.em._log('Дождь пролился.');
  }

  _applyEarthquake(wx, wy) {
    this.renderer.shake(25);
    for (let i = 0; i < 60; i++) {
      const rx = wx + (Math.random() - 0.5) * 20;
      const ry = wy + (Math.random() - 0.5) * 15;
      const t = this.world.get(Math.round(rx), Math.round(ry));
      if (t !== T.AIR && t !== T.BEDROCK) {
        if (Math.random() < 0.3) this.world.set(Math.round(rx), Math.round(ry), T.AIR);
        this.ps.emit(PT.DUST, rx, ry, 2);
      }
    }
    this.em._log('Землетрясение разрушило часть мира!');
  }

  _trySelectEntity(e) {
    if (!this.renderer) return;
    const rect = this.renderer.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wp = this.renderer.screenToWorld(sx, sy);
    const entity = this.em ? this.em.getAt(wp.x, wp.y, 1.2) : null;
    this.selectedEntity = entity;
    this.renderer.setSelectedEntity(entity);
    this.ui.showEntityInfo(entity);
  }

  togglePause() {
    this.paused = !this.paused;
  }

  cycleSpeed() {
    this.simSpeed = this.simSpeed >= 5 ? 1 : this.simSpeed + 1;
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameApp();
});

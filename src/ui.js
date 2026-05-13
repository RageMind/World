class UIManager {
  constructor(game) {
    this.game = game;
    this.selectedTool = TOOLS.BRUSH_GRASS;
    this.brushSize = 1;
    this.mana = CFG.MANA_MAX;
    this._bindStartScreen();
    this._bindGameUI();
    this._bindModals();
  }

  _bindStartScreen() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      this._startGame();
    });
    document.getElementById('btn-settings').addEventListener('click', () => {
      this._showModal('settings-modal');
    });
    document.getElementById('btn-about').addEventListener('click', () => {
      this._showModal('about-modal');
    });
  }

  _bindModals() {
    document.getElementById('btn-settings-close').addEventListener('click', () => {
      this._hideModal('settings-modal');
    });
    document.getElementById('btn-about-close').addEventListener('click', () => {
      this._hideModal('about-modal');
    });
    document.getElementById('pop-start').addEventListener('input', (e) => {
      document.getElementById('pop-start-val').textContent = e.target.value;
    });
    document.getElementById('sim-speed').addEventListener('input', (e) => {
      document.getElementById('sim-speed-val').textContent = e.target.value + '×';
    });
  }

  _showModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('visible');
  }

  _hideModal(id) {
    document.getElementById(id).classList.remove('visible');
    document.getElementById(id).classList.add('hidden');
  }

  _startGame() {
    const popCount = parseInt(document.getElementById('pop-start').value);
    const speed = parseInt(document.getElementById('sim-speed').value);

    const startScreen = document.getElementById('start-screen');
    startScreen.classList.add('fade-out');
    setTimeout(() => {
      startScreen.style.display = 'none';
      document.getElementById('game-ui').classList.remove('hidden');
      this.game.initWorld(popCount, speed);
    }, 800);
  }

  _bindGameUI() {
    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTool = btn.dataset.tool;
        this.game.currentTool = this.selectedTool;
      });
    });

    // Brush size
    const brushInput = document.getElementById('brush-size');
    brushInput.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById('brush-size-val').textContent = e.target.value;
      this.game.brushSize = this.brushSize;
    });

    // Pause
    document.getElementById('btn-pause').addEventListener('click', () => {
      this.game.togglePause();
    });

    // Speed
    document.getElementById('btn-speed').addEventListener('click', () => {
      this.game.cycleSpeed();
    });

    // Zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.game.renderer && (this.game.renderer.camera.zoom = Math.min(4, this.game.renderer.camera.zoom * 1.25));
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.game.renderer && (this.game.renderer.camera.zoom = Math.max(0.4, this.game.renderer.camera.zoom * 0.8));
    });

    // Menu button returns to start
    document.getElementById('btn-menu').addEventListener('click', () => {
      if (confirm('Вернуться в главное меню?')) location.reload();
    });
  }

  updateHUD(game) {
    if (!game.world) return;

    // Day/time
    const dayPhase = (game.em.time % CFG.DAY_TICKS) / CFG.DAY_TICKS;
    const isNight = dayPhase > 0.65 || dayPhase < 0.15;
    document.getElementById('time-icon').textContent = isNight ? '🌙' : '☀';
    document.getElementById('day-display').textContent = `День ${Math.floor(game.em.time / CFG.DAY_TICKS) + 1}`;
    document.getElementById('time-progress').style.width = (dayPhase * 100) + '%';

    // Stats
    document.getElementById('pop-count').textContent = game.em.getAliveCount();
    document.getElementById('death-count').textContent = game.em.totalDied;
    document.getElementById('building-count').textContent = game.em.getBuildingCount();

    // Mana
    this.mana = Math.min(CFG.MANA_MAX, this.mana + CFG.MANA_REGEN);
    const manaPercent = (this.mana / CFG.MANA_MAX * 100).toFixed(0);
    document.getElementById('mana-fill').style.width = manaPercent + '%';
    document.getElementById('mana-value').textContent = `${Math.floor(this.mana)}/${CFG.MANA_MAX}`;

    // Zoom
    document.getElementById('zoom-value').textContent =
      Math.round(game.renderer.camera.zoom * 100) + '%';

    // Speed display
    document.getElementById('btn-speed').textContent = game.simSpeed + '×';

    // Pause button
    document.getElementById('btn-pause').textContent = game.paused ? '▶' : '⏸';

    // Event log
    this._updateEventLog(game.em.getRecentEvents(8));
  }

  _updateEventLog(events) {
    const list = document.getElementById('event-list');
    if (!events.length) return;

    const items = events.map(ev => {
      const mins = Math.floor(ev.time / CFG.DAY_TICKS);
      return `<div class="event-item"><span class="event-day">День ${mins + 1}</span><span class="event-text">${ev.text}</span></div>`;
    }).join('');

    if (list.innerHTML !== items) list.innerHTML = items;
  }

  showEntityInfo(entity) {
    const panel = document.getElementById('info-content');
    if (!entity) {
      panel.innerHTML = `<div class="info-hint"><p>Нажмите на существо<br>чтобы увидеть<br>информацию</p></div>`;
      return;
    }

    const info = entity.getInfo();
    const hp = (info.health / info.maxHealth * 100).toFixed(0);
    const hunger = info.hunger.toFixed(0);
    const happiness = info.happiness.toFixed(0);
    const energy = info.energy.toFixed(0);

    const hpColor = info.health > 60 ? '#44cc66' : info.health > 30 ? '#cccc44' : '#cc4444';
    const hungerColor = info.hunger > 60 ? '#44cc66' : info.hunger > 30 ? '#cccc44' : '#cc4444';
    const happyColor = info.happiness > 60 ? '#44cc66' : info.happiness > 30 ? '#cccc44' : '#cc4444';

    panel.innerHTML = `
      <div class="entity-info">
        <div class="entity-name ${info.type === 'Старейшина' ? 'elder' : ''}">${info.name}</div>
        <div class="entity-type">${info.type} • Поколение ${entity.generation}</div>
        <div class="entity-state">${info.state}</div>

        <div class="info-stats">
          <div class="stat-row">
            <span class="stat-label">Здоровье</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${hp}%;background:${hpColor}"></div></div>
            <span class="stat-val">${info.health}/${info.maxHealth}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Голод</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${hunger}%;background:${hungerColor}"></div></div>
            <span class="stat-val">${hunger}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Счастье</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${happiness}%;background:${happyColor}"></div></div>
            <span class="stat-val">${happiness}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Энергия</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${energy}%;background:#4488ff"></div></div>
            <span class="stat-val">${energy}%</span>
          </div>
        </div>

        <div class="entity-extra">
          <div class="extra-item">⏳ Возраст: ${info.age}</div>
          <div class="extra-item">⛏ Руды: ${entity.inventory.ore}</div>
          <div class="extra-item">🏠 Построено: ${entity.builtCount}</div>
        </div>
      </div>`;
  }

  showTileInfo(wx, wy, tile) {
    const name = TD[tile] ? TD[tile].name : '—';
    document.getElementById('cursor-x').textContent = Math.floor(wx);
    document.getElementById('cursor-y').textContent = Math.floor(wy);
    document.getElementById('biome-name').textContent = name;
  }

  canUseTool(tool) {
    const cost = TOOL_MANA[tool] || 0;
    if (this.mana < cost) return false;
    return true;
  }

  spendMana(tool) {
    const cost = TOOL_MANA[tool] || 0;
    this.mana = Math.max(0, this.mana - cost);
  }

  showNotification(text, type = 'info') {
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    note.textContent = text;
    document.body.appendChild(note);
    requestAnimationFrame(() => note.classList.add('show'));
    setTimeout(() => {
      note.classList.remove('show');
      setTimeout(() => note.remove(), 400);
    }, 2500);
  }
}

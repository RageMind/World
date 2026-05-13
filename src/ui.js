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
    document.getElementById('btn-new-game').addEventListener('click', () => this._startGame());
    document.getElementById('btn-settings').addEventListener('click', () => this._showModal('settings-modal'));
    document.getElementById('btn-about').addEventListener('click', () => this._showModal('about-modal'));
  }

  _bindModals() {
    document.getElementById('btn-settings-close').addEventListener('click', () => this._hideModal('settings-modal'));
    document.getElementById('btn-about-close').addEventListener('click', () => this._hideModal('about-modal'));
    document.getElementById('pop-start').addEventListener('input', e => {
      document.getElementById('pop-start-val').textContent = e.target.value;
    });
    document.getElementById('sim-speed').addEventListener('input', e => {
      document.getElementById('sim-speed-val').textContent = e.target.value + '×';
    });
  }

  _showModal(id) { document.getElementById(id).classList.remove('hidden'); document.getElementById(id).classList.add('visible'); }
  _hideModal(id) { document.getElementById(id).classList.remove('visible'); document.getElementById(id).classList.add('hidden'); }

  _startGame() {
    const popCount = parseInt(document.getElementById('pop-start').value);
    const speed    = parseInt(document.getElementById('sim-speed').value);
    const ss = document.getElementById('start-screen');
    ss.classList.add('fade-out');
    setTimeout(() => {
      ss.style.display = 'none';
      document.getElementById('game-ui').classList.remove('hidden');
      this.game.initWorld(popCount, speed);
      setTimeout(() => this.game._onResize(), 100);
    }, 800);
  }

  _bindGameUI() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTool = btn.dataset.tool;
        this.game.currentTool = this.selectedTool;
      });
    });

    const brushInput = document.getElementById('brush-size');
    brushInput.addEventListener('input', e => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById('brush-size-val').textContent = e.target.value;
      this.game.brushSize = this.brushSize;
    });

    document.getElementById('btn-pause').addEventListener('click', () => this.game.togglePause());
    document.getElementById('btn-speed').addEventListener('click', () => this.game.cycleSpeed());
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      if (this.game.renderer) this.game.renderer.zoom = Math.min(5, this.game.renderer.zoom * 1.25);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      if (this.game.renderer) this.game.renderer.zoom = Math.max(0.35, this.game.renderer.zoom * 0.8);
    });
    document.getElementById('btn-menu').addEventListener('click', () => {
      if (confirm('Вернуться в главное меню?')) location.reload();
    });
  }

  updateHUD(game) {
    if (!game.em) return;
    const dayPhase = (game.em.time % CFG.DAY_TICKS) / CFG.DAY_TICKS;
    const isNight  = dayPhase > 0.62 || dayPhase < 0.12;
    document.getElementById('time-icon').textContent    = isNight ? '🌙' : '☀';
    document.getElementById('day-display').textContent  = `День ${Math.floor(game.em.time / CFG.DAY_TICKS) + 1}`;
    document.getElementById('time-progress').style.width = (dayPhase * 100) + '%';
    document.getElementById('pop-count').textContent     = game.em.getAliveCount();
    document.getElementById('death-count').textContent   = game.em.totalDied;
    document.getElementById('building-count').textContent = game.em.getBuildingCount();

    // Mana
    this.mana = Math.min(CFG.MANA_MAX, this.mana + CFG.MANA_REGEN);
    document.getElementById('mana-fill').style.width  = (this.mana / CFG.MANA_MAX * 100) + '%';
    document.getElementById('mana-value').textContent = `${Math.floor(this.mana)}/${CFG.MANA_MAX}`;

    if (game.renderer) {
      document.getElementById('zoom-value').textContent = Math.round(game.renderer.zoom * 100) + '%';
    }
    document.getElementById('btn-speed').textContent = game.simSpeed + '×';
    document.getElementById('btn-pause').textContent = game.paused ? '▶' : '⏸';

    this._updateEventLog(game.em.getRecentEvents(8));
  }

  _updateEventLog(events) {
    const list = document.getElementById('event-list');
    const html = events.map(ev => {
      const day = Math.floor(ev.time / CFG.DAY_TICKS) + 1;
      return `<div class="event-item"><span class="event-day">День ${day}</span><span class="event-text">${ev.text}</span></div>`;
    }).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
  }

  showEntityInfo(entity) {
    const panel = document.getElementById('info-content');
    if (!entity) {
      panel.innerHTML = `<div class="info-hint"><p>Нажмите на трогглита,<br>чтобы увидеть<br>его историю.</p></div>`;
      return;
    }
    const info = entity.getInfo();
    const hpPct  = (info.health / info.maxHealth * 100).toFixed(0);
    const hpCol  = info.health > 60 ? '#44cc66' : info.health > 30 ? '#cccc44' : '#cc4444';
    const hunCol = info.hunger > 60 ? '#44cc66' : info.hunger > 30 ? '#cccc44' : '#cc4444';
    const hapCol = info.happiness > 60 ? '#44cc66' : info.happiness > 30 ? '#cccc44' : '#cc4444';

    panel.innerHTML = `
      <div class="entity-info">
        <div class="entity-name ${info.type === 'Старейшина' ? 'elder' : ''}">${info.name}</div>
        <div class="entity-type">${info.type} · Поколение ${entity.generation}</div>
        <div class="entity-state">${info.state}</div>
        <div class="info-stats">
          <div class="stat-row">
            <span class="stat-label">Здоровье</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${hpPct}%;background:${hpCol}"></div></div>
            <span class="stat-val">${info.health}/${info.maxHealth}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Голод</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${info.hunger}%;background:${hunCol}"></div></div>
            <span class="stat-val">${info.hunger}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Счастье</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${info.happiness}%;background:${hapCol}"></div></div>
            <span class="stat-val">${info.happiness}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Энергия</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${info.energy}%;background:#4488ff"></div></div>
            <span class="stat-val">${info.energy}%</span>
          </div>
        </div>
        <div class="entity-extra">
          <div class="extra-item">⏳ Возраст: ${info.age}</div>
          <div class="extra-item">🏠 Построено: ${entity.builtCount}</div>
          <div class="extra-item">⛏ Ресурсы: ${entity.inventory.ore + entity.inventory.food + entity.inventory.wood}</div>
        </div>
      </div>`;
  }

  showTileInfo(wx, wz, tile, biome) {
    document.getElementById('cursor-x').textContent = Math.floor(wx);
    document.getElementById('cursor-y').textContent = Math.floor(wz);
    document.getElementById('biome-name').textContent = biome || (STD[tile] ? STD[tile].name : '—');
  }

  canUseTool(tool)  { return this.mana >= (TOOL_MANA[tool] || 0); }
  spendMana(tool)   { this.mana = Math.max(0, this.mana - (TOOL_MANA[tool] || 0)); }

  showNotification(text, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = text;
    document.body.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 400); }, 2500);
  }
}

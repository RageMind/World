(() => {
  const box = document.createElement('div');
  box.id = 'thoughts-panel';
  box.style.cssText = 'position:fixed;right:10px;top:118px;z-index:25;width:min(390px,calc(100vw - 20px));max-height:44vh;overflow:auto;padding:10px 12px;border:1px solid rgba(255,230,150,.25);border-radius:16px;background:rgba(5,18,15,.91);color:#f6e4aa;font:12px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  box.innerHTML = '<b>Мысли и отношения</b><div id="thoughts-list" style="margin-top:7px;color:#d8e6a0"></div><button id="thoughts-all" style="margin-top:8px;border:0;border-radius:10px;padding:7px 10px;background:#d8bd74;color:#10231f;font-weight:700">Все жители</button> <button id="thoughts-force" style="margin-top:8px;border:0;border-radius:10px;padding:7px 10px;background:#9fbd63;color:#10231f;font-weight:700">Обдумать</button>';
  document.body.appendChild(box);
  let selectedName = null;

  function relationHtml(p) {
    const social = window.YourWillSocial;
    const rels = social && social.relList ? social.relList(p) : Object.values(p.relationships || {});
    if (!rels || !rels.length) return '<small style="opacity:.72">отношения ещё не сформированы</small>';
    return rels.map(r => {
      const loveHint = r.affection > 70 && r.trust > 60 ? 'тёплая привязанность' : r.affection > 52 ? 'симпатия растёт' : r.trust > 55 ? 'доверяет' : 'присматривается';
      return `<small style="display:block;opacity:.84">${r.name}: доверие ${Math.round(r.trust || 0)} · симпатия ${Math.round(r.affection || 0)} · влечение ${Math.round(r.attraction || 0)} · связь ${Math.round(r.bond || 0)} · ${loveHint}</small>`;
    }).join('');
  }

  function line(p) {
    const m = p.memory || {};
    const ev = (m.events || []).slice(0, 3).join(' · ') || 'пока пусто';
    const berries = (m.berries || []).length;
    const trees = (m.trees || []).length;
    const rocks = (m.rocks || []).length;
    const friends = (m.friends || []).length;
    return `<div style="padding:7px 0;border-top:1px solid rgba(255,230,150,.12)"><b>${p.name}</b> <span style="opacity:.75">${p.role}</span><br><span>${p.aiSource || 'local'}: ${p.thought || 'думает'} → ${p.aiAction || p.task || 'idle'}</span><br><small style="opacity:.78">еда ${Math.round(p.hunger || 0)} · энергия ${Math.round(p.energy || 0)} · общение ${Math.round(p.social || 0)} · настроение ${Math.round(p.mood || 0)}</small><br>${relationHtml(p)}<small style="opacity:.78">память: 🍓${berries} 🌳${trees} 🪨${rocks} 👥${friends}; ${ev}</small></div>`;
  }

  function render() {
    const api = window.YourWill;
    const out = document.getElementById('thoughts-list');
    if (!api || !api.people) {
      out.textContent = 'жду загрузку жителей...';
      return;
    }
    if (window.YourWillSocial && window.YourWillSocial.ensure) window.YourWillSocial.ensure();
    api.people.forEach(p => api.scan && api.scan(p));
    const people = selectedName ? api.people.filter(p => p.name === selectedName) : api.people;
    out.innerHTML = people.length ? people.map(line).join('') : 'житель не выбран';
  }

  window.addEventListener('yourwill-select', e => {
    selectedName = e.detail && e.detail.name ? e.detail.name : null;
    render();
  });
  document.getElementById('thoughts-all').onclick = () => { selectedName = null; render(); };
  document.getElementById('thoughts-force').onclick = () => {
    const api = window.YourWill;
    if (api && api.forceThink) api.forceThink(selectedName);
    setTimeout(render, 350);
    setTimeout(render, 1800);
    setTimeout(render, 4200);
  };
  setInterval(render, 900);
  render();
})();

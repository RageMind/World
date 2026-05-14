(() => {
  const oldFetch = window.fetch.bind(window);
  const traits = {
    Alina: 'наблюдательная, осторожная, ценит заботу и честность, боится остаться одной',
    Miro: 'практичный, немного ревнивый, хочет быть полезным, скрывает нежность за работой'
  };
  function clamp(v) { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50; }
  function ensure() {
    const api = window.YourWill;
    if (!api || !api.people) return null;
    for (const p of api.people) {
      p.personality = p.personality || traits[p.name] || 'живой, осторожный, хочет выжить и найти близость';
      p.relationships = p.relationships || {};
      for (const o of api.people) if (o !== p) {
        if (!p.relationships[o.name]) {
          const seed = (p.name.charCodeAt(0) * 17 + o.name.charCodeAt(0) * 31) % 19;
          p.relationships[o.name] = {
            name: o.name,
            trust: 38 + seed,
            affection: 32 + seed,
            attraction: 28 + seed,
            bond: 30 + seed,
            jealousy: 5,
            last: 'ещё мало знакомы',
            thoughts: [`Интересно, можно ли доверять ${o.name}?`]
          };
        }
      }
    }
    return api;
  }
  function remember(p, s) {
    p.memory = p.memory || { events: [] };
    p.memory.events = p.memory.events || [];
    p.memory.events.unshift(s);
    p.memory.events.length = 8;
  }
  function relList(p) {
    ensure();
    return Object.values(p.relationships || {}).map(r => ({
      name: r.name,
      trust: Math.round(clamp(r.trust)),
      affection: Math.round(clamp(r.affection)),
      attraction: Math.round(clamp(r.attraction)),
      bond: Math.round(clamp(r.bond)),
      jealousy: Math.round(clamp(r.jealousy)),
      last: r.last || ''
    }));
  }
  function tickRelations() {
    const api = ensure();
    if (!api) return;
    const ps = api.people;
    for (const p of ps) for (const o of ps) if (p !== o) {
      const r = p.relationships && p.relationships[o.name];
      if (!r) continue;
      const d = Math.hypot((p.x || 0) - (o.x || 0), (p.y || 0) - (o.y || 0));
      if (d < 1.25) {
        r.trust = clamp(r.trust + 0.08);
        r.bond = clamp(r.bond + 0.06);
        r.affection = clamp(r.affection + 0.04);
        r.last = 'были рядом и привыкали друг к другу';
      }
      if (p.task === 'talk' && p.friend === o) {
        r.trust = clamp(r.trust + 0.35);
        r.affection = clamp(r.affection + 0.24);
        r.bond = clamp(r.bond + 0.28);
        r.last = 'говорили и стали ближе';
        if (Math.random() < 0.02) remember(p, `после разговора подумал о ${o.name}`);
      }
      if (p.task === 'share' && p.friend === o) {
        r.trust = clamp(r.trust + 0.55);
        r.affection = clamp(r.affection + 0.45);
        r.bond = clamp(r.bond + 0.35);
        r.last = 'получилась забота через еду';
      }
      if ((p.task === 'help' || p.aiAction === 'help') && p.job && o.job === p.job) {
        r.trust = clamp(r.trust + 0.25);
        r.bond = clamp(r.bond + 0.35);
        r.last = 'работали вместе';
      }
      if ((p.hunger || 100) < 28 && (o.hunger || 100) > 65) {
        r.jealousy = clamp(r.jealousy + 0.05);
      } else {
        r.jealousy = clamp(r.jealousy - 0.02);
      }
      if (r.affection > 62 && r.trust > 55 && Math.random() < 0.004) {
        const q = `А ${o.name} правда ко мне тянется или просто выживает рядом?`;
        r.thoughts.unshift(q);
        r.thoughts.length = 5;
        remember(p, q);
      }
    }
  }
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('/api/ai/think') && init && init.body) {
      try {
        const body = JSON.parse(init.body);
        const api = ensure();
        if (api && body.villager) {
          const p = api.people.find(z => z.name === body.villager.name);
          if (p) {
            body.villager.personality = p.personality || traits[p.name] || '';
            body.villager.mood = Math.round(p.mood || 50);
            body.villager.memories = (p.memory && p.memory.events || []).slice(0, 8);
            body.world = body.world || {};
            body.world.relationships = relList(p);
          }
        }
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (_) {}
    }
    return oldFetch(input, init);
  };
  window.YourWillSocial = { ensure, relList, tickRelations };
  setInterval(tickRelations, 700);
})();

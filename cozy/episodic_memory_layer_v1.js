(() => {
  const ACTION_RU = {
    idle: 'стоял и думал', walk: 'шёл', forage: 'собирал ягоды', gather: 'искал еду', chop: 'рубил дерево', mine: 'добывал камень', build: 'строил', talk: 'говорил', share: 'делился едой', eat: 'ел', rest: 'отдыхал', help: 'помогал', explore: 'осматривался'
  };
  function nowHour() {
    const api = window.YourWill;
    const r = api && api.resources;
    return r && Number.isFinite(r.time) ? `${Math.floor(r.time)}:00` : 'сейчас';
  }
  function ensurePerson(p) {
    p.memory = p.memory || {};
    p.memory.events = p.memory.events || [];
    p.memory.did = p.memory.did || [];
    p.memory.received = p.memory.received || [];
    p.memory.saw = p.memory.saw || [];
    p.memory.reflections = p.memory.reflections || [];
    p.memory.important = p.memory.important || [];
    p.selfNarrative = p.selfNarrative || 'Я пытаюсь понять, кто мне близок, кому можно доверять и как выжить.';
    p.lastObservedTask = p.lastObservedTask || p.task || 'idle';
    p.lastObservedJob = p.lastObservedJob || null;
    p.lastReflectAt = p.lastReflectAt || 0;
    p.reasoning = p.reasoning || 'Я пока только собираю впечатления.';
  }
  function push(list, text, max) {
    if (!text) return;
    list.unshift(`${nowHour()} ${text}`);
    list.length = max;
  }
  function rememberDid(p, text) { ensurePerson(p); push(p.memory.did, text, 14); push(p.memory.events, 'я ' + text, 16); }
  function rememberReceived(p, text) { ensurePerson(p); push(p.memory.received, text, 14); push(p.memory.events, text, 16); }
  function rememberSaw(p, text) { ensurePerson(p); push(p.memory.saw, text, 12); }
  function rememberReflection(p, text) { ensurePerson(p); push(p.memory.reflections, text, 10); p.reasoning = text; }
  function allMemory(p) {
    ensurePerson(p);
    return [
      'Что я делал: ' + (p.memory.did.slice(0, 5).join(' | ') || 'пока мало'),
      'Что мне делали: ' + (p.memory.received.slice(0, 5).join(' | ') || 'пока мало'),
      'Что я видел: ' + (p.memory.saw.slice(0, 4).join(' | ') || 'пока мало'),
      'Мои выводы: ' + (p.memory.reflections.slice(0, 4).join(' | ') || 'пока мало'),
      'Главная мысль о себе: ' + p.selfNarrative
    ];
  }
  function observeTasks() {
    const api = window.YourWill;
    if (!api || !api.people) return;
    for (const p of api.people) {
      ensurePerson(p);
      const task = p.task || 'idle';
      if (task !== p.lastObservedTask) {
        const ru = ACTION_RU[task] || task;
        if (!['walk', 'idle'].includes(task)) rememberDid(p, ru);
        p.lastObservedTask = task;
      }
      for (const o of api.people) if (o !== p) {
        const d = Math.hypot((p.x || 0) - (o.x || 0), (p.y || 0) - (o.y || 0));
        if (d < 2.4 && o.task && o.task !== 'idle' && o.task !== 'walk' && Math.random() < 0.025) {
          rememberSaw(p, `${o.name} ${ACTION_RU[o.task] || o.task}`);
        }
      }
    }
  }
  function observeSocialEffects() {
    const api = window.YourWill;
    if (!api || !api.people) return;
    for (const p of api.people) {
      ensurePerson(p);
      if (p.task === 'share' && p.friend && Math.random() < 0.08) {
        rememberDid(p, `поделился едой с ${p.friend.name}`);
        rememberReceived(p.friend, `${p.name} поделился со мной едой`);
      }
      if (p.task === 'talk' && p.friend && Math.random() < 0.06) {
        rememberDid(p, `поговорил с ${p.friend.name}`);
        rememberReceived(p.friend, `${p.name} поговорил со мной`);
      }
      if (p.task === 'help' && p.friend && Math.random() < 0.05) {
        rememberDid(p, `помог ${p.friend.name}`);
        rememberReceived(p.friend, `${p.name} помог мне`);
      }
    }
  }
  function reflectLocally(p) {
    ensurePerson(p);
    const rels = p.relationships ? Object.values(p.relationships) : [];
    const best = rels.sort((a,b)=>((b.affection||0)+(b.trust||0)+(b.bond||0))-((a.affection||0)+(a.trust||0)+(a.bond||0)))[0];
    let s;
    if ((p.hunger || 100) < 35) s = 'Я плохо соображаю от голода, поэтому мои чувства могут быть резче обычного.';
    else if (best && best.affection > 60) s = `Я всё чаще думаю о ${best.name}; не уверен, любовь ли это, но мне важно, как ${best.name} смотрит на меня.`;
    else if (best && best.trust > 55) s = `${best.name} кажется надёжным человеком; доверие растёт из мелочей, а не из слов.`;
    else s = 'Я пока не знаю, кому можно раскрыться. Надо смотреть на поступки, а не только на близость.';
    rememberReflection(p, s);
  }
  function enrichFetch() {
    const old = window.fetch;
    if (old.__episodicWrapped) return;
    function wrapped(input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.includes('/api/ai/think') && init && init.body) {
        try {
          const body = JSON.parse(init.body);
          const api = window.YourWill;
          const p = api && api.people && body.villager ? api.people.find(z => z.name === body.villager.name) : null;
          if (p) {
            ensurePerson(p);
            body.villager.memories = allMemory(p);
            body.villager.selfNarrative = p.selfNarrative;
            body.villager.lastReasoning = p.reasoning;
            body.villager.mustReason = true;
            init = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        } catch (_) {}
      }
      return old(input, init);
    }
    wrapped.__episodicWrapped = true;
    window.fetch = wrapped;
  }
  function tickReflection() {
    const api = window.YourWill;
    if (!api || !api.people) return;
    for (const p of api.people) {
      ensurePerson(p);
      const now = Date.now();
      if (now - p.lastReflectAt > 9000) {
        p.lastReflectAt = now;
        reflectLocally(p);
      }
    }
  }
  window.YourWillMemory = { ensurePerson, rememberDid, rememberReceived, rememberSaw, rememberReflection, allMemory, reflectLocally };
  enrichFetch();
  setInterval(observeTasks, 600);
  setInterval(observeSocialEffects, 900);
  setInterval(tickReflection, 1200);
})();

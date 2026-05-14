const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
const ROOT = __dirname;
const COZY = path.join(ROOT, 'cozy');
const ALLOWED = new Set(['eat', 'rest', 'talk', 'gather', 'chop', 'mine', 'build', 'explore', 'help', 'share']);

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 100000) reject(new Error('payload_too_large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function clampNumber(n, min, max, fallback) {
  n = Number(n);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function safeText(v, max = 240) {
  return String(v || '').replace(/[\n\r]+/g, ' ').trim().slice(0, max);
}

function fallbackDecision(v = {}, world = {}) {
  const hunger = clampNumber(v.hunger, 0, 100, 70);
  const energy = clampNumber(v.energy, 0, 100, 70);
  const social = clampNumber(v.social, 0, 100, 50);
  const food = clampNumber(world.food, 0, 999, 0);
  const wood = clampNumber(world.wood, 0, 999, 0);
  const stone = clampNumber(world.stone, 0, 999, 0);
  const rel = Array.isArray(world.relationships) ? world.relationships[0] : null;
  if (hunger < 45 && food > 0) return { thought: 'Я голоден, надо поесть, иначе буду хуже относиться ко всему.', reasoning: 'Голод сейчас сильнее социальных сомнений.', action: 'eat', source: 'fallback' };
  if (energy < 35) return { thought: 'Я устал. Если хочу кому-то нравиться, сначала надо восстановиться.', reasoning: 'Усталость мешает нормально говорить и работать.', action: 'rest', source: 'fallback' };
  if (rel && social < 62) return { thought: `Интересно, что чувствует ${safeText(rel.name, 24)}. Надо поговорить спокойнее.`, reasoning: 'Недостаток общения и наличие отношений делают разговор полезным.', action: 'talk', source: 'fallback' };
  if (food < 5) return { thought: 'Запас еды мал. Забота о других начинается с ягод.', reasoning: 'Колонии нужен запас еды, иначе отношения будут портиться от голода.', action: 'gather', source: 'fallback' };
  if (wood < 10) return { thought: 'Нужно дерево. Дом и безопасность важнее пустых слов.', reasoning: 'Дерево нужно для строительства и будущей стабильности.', action: 'chop', source: 'fallback' };
  if (stone < 5) return { thought: 'Без камня поселение слабое. Пойду добывать.', reasoning: 'Камень нужен для развития поселения.', action: 'mine', source: 'fallback' };
  if (wood >= 8 && stone >= 3) return { thought: 'Дом поможет отношениям: людям нужно место и спокойствие.', reasoning: 'Ресурсов хватает, строительство улучшит быт.', action: 'build', source: 'fallback' };
  return { thought: 'Нужно осмотреться и понять, что сейчас важнее для меня и для нас.', reasoning: 'Я не вижу срочной нужды, поэтому собираю контекст.', action: 'explore', source: 'fallback' };
}

function parseOllamaResponse(raw, fallback) {
  let txt = raw && raw.response ? String(raw.response).trim() : '';
  for (const candidate of [txt, (txt.match(/\{[\s\S]*\}/) || [])[0]]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const action = String(parsed.action || '').trim().toLowerCase();
      const thought = safeText(parsed.thought, 220);
      const reasoning = safeText(parsed.reasoning, 360);
      const emotion = safeText(parsed.emotion, 50);
      const social_target = safeText(parsed.social_target, 40);
      const relationship_intent = safeText(parsed.relationship_intent, 100);
      const question = safeText(parsed.question, 140);
      const memory_used = safeText(parsed.memory_used, 180);
      if (ALLOWED.has(action)) return { thought: thought || fallback.thought, reasoning: reasoning || fallback.reasoning || '', action, emotion, social_target, relationship_intent, question, memory_used, source: 'ollama' };
    } catch (_) {}
  }
  return fallback;
}

function relationshipSummary(world = {}) {
  const rels = Array.isArray(world.relationships) ? world.relationships.slice(0, 4) : [];
  if (!rels.length) return 'No known relationships yet.';
  return rels.map(r => `${safeText(r.name, 24)}: trust=${clampNumber(r.trust,0,100,50)}, affection=${clampNumber(r.affection,0,100,50)}, attraction=${clampNumber(r.attraction,0,100,50)}, bond=${clampNumber(r.bond,0,100,50)}, jealousy=${clampNumber(r.jealousy,0,100,0)}, last=${safeText(r.last, 90)}`).join('\n');
}

async function askOllama(payload) {
  const villager = payload.villager || {};
  const world = payload.world || {};
  const fallback = fallbackDecision(villager, world);
  const memories = Array.isArray(villager.memories) ? villager.memories.slice(0, 12).map(x => '- ' + safeText(x, 180)).join('\n') : 'none';
  const prompt = [
    'You are a fast local AI brain for one simulated villager in a sandbox survival game.',
    'The villager is NOT a real person, but should feel believable: needs, doubts, affection, fear, jealousy, gratitude, friendship, attachment, self-protection.',
    'Return ONLY valid JSON. No markdown. No explanations outside JSON.',
    'Allowed actions: eat, rest, talk, gather, chop, mine, build, explore, help, share.',
    'Choose exactly one action that makes sense both for survival and relationships.',
    'Think from personal episodic memory: what I did, what others did to me, what I saw, and what conclusions I formed.',
    'Write thought in first-person Russian, like inner monologue. Write reasoning as 1-3 short Russian sentences explaining WHY, based on memory and current needs.',
    'It may ask human-like questions, for example: "А любит ли меня Алина?" if relationships make that plausible. Never claim certainty about love; use doubt, hope, observation.',
    'JSON schema: {"thought":"first-person russian inner thought","reasoning":"1-3 russian reasoning sentences","emotion":"short emotion","action":"one_allowed_action","social_target":"name or empty","relationship_intent":"short russian intent","question":"optional inner question","memory_used":"which memory affected decision"}',
    `Villager: name=${villager.name || 'unknown'}, role=${villager.role || 'worker'}, hunger=${clampNumber(villager.hunger,0,100,70)}, energy=${clampNumber(villager.energy,0,100,70)}, social=${clampNumber(villager.social,0,100,50)}, mood=${clampNumber(villager.mood,0,100,50)}, task=${villager.task || 'idle'}.`,
    `Personality: ${safeText(villager.personality || 'calm, cautious, wants connection', 180)}.`,
    `Self narrative: ${safeText(villager.selfNarrative || '', 180)}.`,
    `Last reasoning: ${safeText(villager.lastReasoning || '', 220)}.`,
    `World: food=${clampNumber(world.food,0,999,0)}, wood=${clampNumber(world.wood,0,999,0)}, stone=${clampNumber(world.stone,0,999,0)}, hasCamp=${!!world.hasCamp}, hasBlueprint=${!!world.hasBlueprint}.`,
    `Useful targets: berries=${clampNumber(world.berries,0,999,0)}, trees=${clampNumber(world.trees,0,999,0)}, rocks=${clampNumber(world.rocks,0,999,0)}, friends=${clampNumber(world.friends,0,999,0)}.`,
    'Relationships:',
    relationshipSummary(world),
    'Episodic memory:',
    memories
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const r = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.72, top_p: 0.92, num_predict: 190 }
      })
    });
    clearTimeout(timer);
    if (!r.ok) return fallback;
    const raw = await r.json();
    return parseOllamaResponse(raw, fallback);
  } catch (_) {
    clearTimeout(timer);
    return fallback;
  }
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/cozy/index.html';
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT) || (!full.startsWith(COZY) && !full.endsWith('server.js'))) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': contentType(full), 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.url.startsWith('/api/ai/health')) return send(res, 200, JSON.stringify({ ok: true, model: OLLAMA_MODEL, social: true, episodicMemory: true, reasoning: true }));
  if (req.url.startsWith('/api/ai/think')) {
    if (req.method !== 'POST') return send(res, 405, JSON.stringify({ error: 'method_not_allowed' }));
    try {
      const payload = await readJson(req);
      const decision = await askOllama(payload);
      return send(res, 200, JSON.stringify(decision));
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: 'bad_request' }));
    }
  }
  return serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`YourWill server listening on http://127.0.0.1:${PORT}`);
  console.log(`Ollama model: ${OLLAMA_MODEL}`);
  console.log('Social relationship + episodic reasoning prompts enabled');
});

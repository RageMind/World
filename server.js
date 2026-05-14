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

function fallbackDecision(v = {}, world = {}) {
  const hunger = clampNumber(v.hunger, 0, 100, 70);
  const energy = clampNumber(v.energy, 0, 100, 70);
  const social = clampNumber(v.social, 0, 100, 50);
  const food = clampNumber(world.food, 0, 999, 0);
  const wood = clampNumber(world.wood, 0, 999, 0);
  const stone = clampNumber(world.stone, 0, 999, 0);
  if (hunger < 45 && food > 0) return { thought: 'Я голоден, надо поесть.', action: 'eat', source: 'fallback' };
  if (energy < 35) return { thought: 'Я устал, надо отдохнуть.', action: 'rest', source: 'fallback' };
  if (food < 5) return { thought: 'Нужно собрать ягоды для запаса.', action: 'gather', source: 'fallback' };
  if (wood < 10) return { thought: 'Нужно заготовить дерево.', action: 'chop', source: 'fallback' };
  if (stone < 5) return { thought: 'Нужно добыть камень.', action: 'mine', source: 'fallback' };
  if (social < 45) return { thought: 'Нужно поговорить с другим жителем.', action: 'talk', source: 'fallback' };
  if (wood >= 8 && stone >= 3) return { thought: 'Можно строить дом.', action: 'build', source: 'fallback' };
  return { thought: 'Осмотрюсь и выберу полезное дело.', action: 'explore', source: 'fallback' };
}

function parseOllamaResponse(raw, fallback) {
  let txt = raw && raw.response ? String(raw.response).trim() : '';
  try {
    const parsed = JSON.parse(txt);
    const action = String(parsed.action || '').trim().toLowerCase();
    const thought = String(parsed.thought || '').trim().slice(0, 90);
    if (ALLOWED.has(action)) return { thought: thought || fallback.thought, action, source: 'ollama' };
  } catch (_) {}
  const match = txt.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      const action = String(parsed.action || '').trim().toLowerCase();
      const thought = String(parsed.thought || '').trim().slice(0, 90);
      if (ALLOWED.has(action)) return { thought: thought || fallback.thought, action, source: 'ollama' };
    } catch (_) {}
  }
  return fallback;
}

async function askOllama(payload) {
  const villager = payload.villager || {};
  const world = payload.world || {};
  const fallback = fallbackDecision(villager, world);
  const prompt = [
    'You are a fast local AI brain for one villager in a sandbox survival game.',
    'Return ONLY valid JSON. No markdown. No explanations.',
    'Allowed actions: eat, rest, talk, gather, chop, mine, build, explore, help, share.',
    'Choose exactly one action. Use short Russian thought.',
    'JSON schema: {"thought":"short russian thought","action":"one_allowed_action"}',
    `Villager: name=${villager.name || 'unknown'}, role=${villager.role || 'worker'}, hunger=${clampNumber(villager.hunger,0,100,70)}, energy=${clampNumber(villager.energy,0,100,70)}, social=${clampNumber(villager.social,0,100,50)}, task=${villager.task || 'idle'}.`,
    `World: food=${clampNumber(world.food,0,999,0)}, wood=${clampNumber(world.wood,0,999,0)}, stone=${clampNumber(world.stone,0,999,0)}, hasCamp=${!!world.hasCamp}, hasBlueprint=${!!world.hasBlueprint}.`,
    `Useful targets: berries=${clampNumber(world.berries,0,999,0)}, trees=${clampNumber(world.trees,0,999,0)}, rocks=${clampNumber(world.rocks,0,999,0)}, friends=${clampNumber(world.friends,0,999,0)}.`
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
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
        options: { temperature: 0.1, num_predict: 64 }
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
  if (!full.startsWith(ROOT) || (!full.startsWith(COZY) && !full.endsWith('server.js'))) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': contentType(full), 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.url.startsWith('/api/ai/health')) {
    return send(res, 200, JSON.stringify({ ok: true, model: OLLAMA_MODEL }));
  }
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
});

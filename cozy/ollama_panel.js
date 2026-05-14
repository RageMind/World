(() => {
  const allowed = new Set(['eat','rest','talk','gather','chop','mine','build','explore','help','share']);
  const box = document.createElement('div');
  box.id = 'ollama-ai-box';
  box.style.cssText = 'position:fixed;right:12px;top:122px;z-index:20;max-width:310px;padding:10px 12px;border:1px solid rgba(255,230,150,.25);border-radius:14px;background:rgba(5,18,15,.90);color:#f6e4aa;font:12px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  box.innerHTML = '<b>Ollama AI</b><br><span id="ollama-ai-status">checking...</span><br><button id="ollama-ai-test" style="margin-top:8px;border:0;border-radius:10px;padding:7px 10px;background:#d8bd74;color:#10231f;font-weight:700">Проверить мысль</button><div id="ollama-ai-result" style="margin-top:8px;color:#d8e6a0"></div>';
  document.body.appendChild(box);

  function safeDecision(d) {
    if (!d || typeof d !== 'object') return { thought: 'Нет ответа от локального ИИ.', action: 'explore', source: 'client_fallback' };
    const action = String(d.action || '').trim().toLowerCase();
    return {
      thought: String(d.thought || 'Думаю, что делать дальше.').slice(0, 90),
      action: allowed.has(action) ? action : 'explore',
      source: d.source || 'unknown'
    };
  }

  async function health() {
    const status = document.getElementById('ollama-ai-status');
    try {
      const r = await fetch('/api/ai/health', { cache: 'no-store' });
      const j = await r.json();
      status.textContent = j.ok ? `online · ${j.model}` : 'offline';
    } catch (_) {
      status.textContent = 'offline: server.js не запущен или nginx не проксирует /api';
    }
  }

  async function testThought() {
    const out = document.getElementById('ollama-ai-result');
    out.textContent = 'думает...';
    try {
      const r = await fetch('/api/ai/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villager: { name: 'Alina', role: 'gatherer', hunger: 25, energy: 80, social: 45, task: 'idle' },
          world: { food: 2, wood: 5, stone: 0, hasCamp: true, hasBlueprint: false, berries: 3, trees: 8, rocks: 2, friends: 1 }
        })
      });
      const d = safeDecision(await r.json());
      out.textContent = `${d.source}: ${d.thought} → ${d.action}`;
    } catch (_) {
      out.textContent = 'ошибка: нет ответа от /api/ai/think';
    }
  }

  document.getElementById('ollama-ai-test').onclick = testThought;
  health();
})();

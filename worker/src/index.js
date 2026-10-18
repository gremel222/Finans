/**
 * worker/src/index.js — Cloudflare Worker /route (п.6.1, п.7)
 * В T0 — каркас с валидацией, Origin, rate-limit заглушкой, daily cap.
 * LLM-вызовы подключатся в T4.
 */
import { CONFIG } from './config.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  // В dev разрешаем localhost — только если явно включён флаг DEV
  if (env.DEV === '1' || env.DEV === 'true') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  }
  // Сравниваем только origin (схема+хост+порт), без пути — поправка v4 п.2
  try {
    const o = new URL(origin);
    const originOnly = o.origin;
    return allowed.includes(originOnly);
  } catch { return false; }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// Заглушки rate-limit / daily cap — в T4 заменятся на KV/Durable Object
// Сейчас — in-memory (сбрасывается при рестарте воркера), но интерфейс совместим
const memRate = new Map(); // ipHash -> {count, reset}
const memDaily = { count: 0, day: new Date().toISOString().slice(0, 10) };

async function checkRateLimit(ipHash, env) {
  // TODO T4: заменить на rateLimit.check(ipHash) с KV/RateLimit binding
  const now = Date.now();
  const rec = memRate.get(ipHash);
  if (!rec || now > rec.reset) {
    memRate.set(ipHash, { count: 1, reset: now + CONFIG.IP_RATE_WINDOW_MS });
    return true;
  }
  if (rec.count >= CONFIG.IP_RATE_LIMIT) return false;
  rec.count++;
  return true;
}

async function checkDailyCap(env) {
  const day = new Date().toISOString().slice(0, 10);
  if (memDaily.day !== day) { memDaily.day = day; memDaily.count = 0; }
  // TODO T4: KV с атомарным инкрементом
  return memDaily.count < CONFIG.DAILY_LLM_CAP;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin, env)) return new Response(null, { status: 204 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/route') return json({ error: 'not_found' }, 404);

    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    // Origin — не защита от curl, а от чужого сайта (п.7)
    if (!isAllowedOrigin(origin, env)) {
      // Логируем только метаданные, без IP в чистом виде (п.22)
      console.log(JSON.stringify({ ev: 'origin_rejected', origin: origin.slice(0, 80) }));
      return json({ error: 'forbidden' }, 403, corsHeaders(origin));
    }

    // IP-хэш (п.22) — воркер не логирует IP, ключ = SHA-256(ip) укороченный
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    let ipHash = ip;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
      ipHash = [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch {}

    if (!(await checkRateLimit(ipHash, env))) {
      return json({ error: 'rate_limited' }, 429, corsHeaders(origin));
    }
    if (!(await checkDailyCap(env))) {
      return json({ error: 'quota' }, 503, corsHeaders(origin));
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > CONFIG.MAX_BODY_KB * 1024) return json({ error: 'payload_too_large' }, 400, corsHeaders(origin));
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'bad_request' }, 400, corsHeaders(origin));
    }

    // Валидация (п.6.1) — серверная, не доверяем клиенту
    const { topic, level, lang, candidates, exclude_ids } = body;
    if (typeof topic !== 'string' || topic.length === 0 || topic.length > CONFIG.MAX_TOPIC_LEN) return json({ error: 'bad_topic' }, 400, corsHeaders(origin));
    if (!['beginner','intermediate','advanced'].includes(level)) return json({ error: 'bad_level' }, 400, corsHeaders(origin));
    if (!['ru','en'].includes(lang)) return json({ error: 'bad_lang' }, 400, corsHeaders(origin));
    if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > CONFIG.MAX_CANDIDATES) return json({ error: 'bad_candidates' }, 400, corsHeaders(origin));
    const ids = candidates.map(c => c.id);
    if (new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id))) return json({ error: 'bad_ids' }, 400, corsHeaders(origin));
    for (const c of candidates) {
      if (typeof c.title !== 'string' || !c.title) return json({ error: 'bad_title' }, 400, corsHeaders(origin));
      if (c.extract && c.extract.length > CONFIG.MAX_EXTRACT_LEN + 50) return json({ error: 'bad_extract' }, 400, corsHeaders(origin)); // +запас, обрежем
    }

    // Обрезаем extract/description на сервере тоже
    const cleanCandidates = candidates.map(c => ({
      ...c,
      extract: (c.extract || '').slice(0, CONFIG.MAX_EXTRACT_LEN),
      description: (c.description || '').slice(0, CONFIG.MAX_DESCRIPTION_LEN),
    }));

    // T0: LLM ещё не подключён — отдаём quota чтобы фронт ушёл в fallback (не падает)
    // В T4 здесь будет цепочка провайдеров п.6.4
    // Пока фиксируем что воркер живой и валидация работает
    console.log(JSON.stringify({ ev: 'route_hit', lang, level, n: cleanCandidates.length, ipHash }));
    memDaily.count++;

    // Заглушка: честно говорим что LLM пока не подключён — фронт покажет упрощённый маршрут
    return json({ error: 'quota' }, 503, corsHeaders(origin));

    // --- T4 реализация (закомментирована до живого AI binding) ---
    // try {
    //   const provider = await import('./providers/workersai.js');
    //   const system = provider.buildSystemPrompt(level, lang);
    //   const user = provider.buildUserBlock(topic, cleanCandidates, exclude_ids || []);
    //   const result = await provider.run(env, { system, user });
    //   return json({ mode: 'llm', route: result.route }, 200, corsHeaders(origin));
    // } catch (e) {
    //   if (e.code === 'quota' || /quota|limit/i.test(e.message)) {
    //     // попробовать gemini если включён
    //     if (CONFIG.GEMINI_ENABLED && env.GEMINI_API_KEY) { ... return {mode:'llm_fallback'} }
    //     return json({ error: 'quota' }, 503, corsHeaders(origin));
    //   }
    //   return json({ error: 'unavailable' }, 503, corsHeaders(origin));
    // }
  },
};

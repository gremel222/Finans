/**
 * worker/src/index.js — Cloudflare Worker /route (п.6.1, п.6.4, п.7)
 * Цепочка: основная модель → FALLBACK_MODELS → Gemini (если флаг) → 503.
 */
import { CONFIG } from './config.js';
import { buildSystemPrompt, buildUserBlock, run as runWorkersAi } from './providers/workersai.js';
import { run as runGemini } from './providers/gemini.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (env.DEV === '1' || env.DEV === 'true') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  }
  try {
    return allowed.includes(new URL(origin).origin);
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

const memRate = new Map();
const memDaily = { count: 0, day: new Date().toISOString().slice(0, 10) };

async function checkRateLimit(ipHash, env) {
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
  return memDaily.count < CONFIG.DAILY_LLM_CAP;
}

function isQuota(e) {
  return e?.code === 'quota' || /quota|rate.?limit|capacity|exceeded|neuron/i.test(String(e?.message || e));
}
function isMissingModel(e) {
  return /model not found|unknown model|does not exist|no such model/i.test(String(e?.message || e));
}

function sanitizeRoute(route, ids) {
  const set = new Set(ids);
  const seen = new Set();
  const out = [];
  for (const item of route || []) {
    const id = Number(item.id);
    if (!set.has(id) || seen.has(id)) continue;
    if (typeof item.why !== 'string' || typeof item.you_will_understand !== 'string') continue;
    seen.add(id);
    out.push({
      id,
      why: String(item.why).slice(0, 400),
      you_will_understand: String(item.you_will_understand).slice(0, 400),
    });
  }
  return out;
}

async function tryModel(env, model, system, user, ids) {
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const result = await runWorkersAi(env, { system, user, model });
      const route = sanitizeRoute(result.route, ids);
      if (route.length >= 4) return route;
      last = Object.assign(new Error('too_few'), { code: 'unavailable' });
    } catch (e) {
      if (isMissingModel(e) || isQuota(e)) throw e;
      last = e;
      if (i === 0) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
    }
  }
  throw last || Object.assign(new Error('unavailable'), { code: 'unavailable' });
}

async function runChain(env, { level, lang, topic, candidates, exclude_ids }) {
  const system = buildSystemPrompt(level, lang, false);
  const user = buildUserBlock(topic, candidates, exclude_ids || []);
  const ids = candidates.map(c => c.id);
  const models = [CONFIG.WORKERS_AI_MODEL, ...CONFIG.FALLBACK_MODELS];
  let quotaHit = false;

  for (const model of models) {
    try {
      const route = await tryModel(env, model, system, user, ids);
      console.log(JSON.stringify({ ev: 'llm_ok', model, n: route.length }));
      return { mode: 'llm', route, model };
    } catch (e) {
      console.log(JSON.stringify({ ev: 'llm_fail', model, err: String(e.message || e).slice(0, 120) }));
      if (isQuota(e)) { quotaHit = true; break; }
    }
  }

  if (CONFIG.GEMINI_ENABLED && env.GEMINI_API_KEY) {
    try {
      const gem = await runGemini(env, { system, user });
      const route = sanitizeRoute(gem.route, ids);
      if (route.length >= 4) {
        console.log(JSON.stringify({ ev: 'gemini_ok', n: route.length }));
        return { mode: 'llm_fallback', route, model: 'gemini' };
      }
    } catch (e) {
      console.log(JSON.stringify({ ev: 'gemini_fail', err: String(e.message || e).slice(0, 120) }));
      if (isQuota(e)) quotaHit = true;
    }
  }

  throw Object.assign(new Error(quotaHit ? 'quota' : 'unavailable'), { code: quotaHit ? 'quota' : 'unavailable' });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin, env)) return new Response(null, { status: 204 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/route') return json({ error: 'not_found' }, 404);

    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    if (!isAllowedOrigin(origin, env)) {
      console.log(JSON.stringify({ ev: 'origin_rejected', origin: origin.slice(0, 80) }));
      return json({ error: 'forbidden' }, 403, corsHeaders(origin));
    }

    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    let ipHash = ip;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
      ipHash = [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { /* keep ip as fallback key, still not logged */ }

    if (!(await checkRateLimit(ipHash, env))) {
      return json({ error: 'rate_limited' }, 429, corsHeaders(origin));
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > CONFIG.MAX_BODY_KB * 1024) return json({ error: 'payload_too_large' }, 400, corsHeaders(origin));
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'bad_request' }, 400, corsHeaders(origin));
    }

    const { topic, level, lang, candidates, exclude_ids } = body;
    if (typeof topic !== 'string' || topic.length === 0 || topic.length > CONFIG.MAX_TOPIC_LEN) return json({ error: 'bad_topic' }, 400, corsHeaders(origin));
    if (!['beginner', 'intermediate', 'advanced'].includes(level)) return json({ error: 'bad_level' }, 400, corsHeaders(origin));
    if (!['ru', 'en'].includes(lang)) return json({ error: 'bad_lang' }, 400, corsHeaders(origin));
    if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > CONFIG.MAX_CANDIDATES) return json({ error: 'bad_candidates' }, 400, corsHeaders(origin));
    const ids = candidates.map(c => c.id);
    if (new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id))) return json({ error: 'bad_ids' }, 400, corsHeaders(origin));
    for (const c of candidates) {
      if (typeof c.title !== 'string' || !c.title) return json({ error: 'bad_title' }, 400, corsHeaders(origin));
      if (c.extract && c.extract.length > CONFIG.MAX_EXTRACT_LEN + 50) return json({ error: 'bad_extract' }, 400, corsHeaders(origin));
    }

    const cleanCandidates = candidates.map(c => ({
      ...c,
      extract: (c.extract || '').slice(0, CONFIG.MAX_EXTRACT_LEN),
      description: (c.description || '').slice(0, CONFIG.MAX_DESCRIPTION_LEN),
    }));

    if (!env.AI) {
      console.log(JSON.stringify({ ev: 'no_ai_binding' }));
      return json({ error: 'unavailable' }, 503, corsHeaders(origin));
    }
    if (!(await checkDailyCap(env))) {
      return json({ error: 'quota' }, 503, corsHeaders(origin));
    }
    memDaily.count++;

    try {
      const out = await runChain(env, {
        level, lang, topic,
        candidates: cleanCandidates,
        exclude_ids: Array.isArray(exclude_ids) ? exclude_ids : [],
      });
      console.log(JSON.stringify({ ev: 'route_ok', mode: out.mode, n: out.route.length, lang, level }));
      return json({ mode: out.mode, route: out.route }, 200, corsHeaders(origin));
    } catch (e) {
      const code = e.code === 'quota' ? 'quota' : 'unavailable';
      console.log(JSON.stringify({ ev: 'route_fail', code }));
      return json({ error: code }, 503, corsHeaders(origin));
    }
  },
};

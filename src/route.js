/**
 * route.js — вызов Worker /route и валидация по id (п.6.6)
 * Полная реализация в T5, здесь каркас.
 */

// По умолчанию — относительный путь (для dev) или прод-URL из config
export const WORKER_URL = ''; // задаётся в main.js через window.__WORKER_URL__ или localStorage

/**
 * @param {{topic:string, level:string, lang:string, candidates:Array, exclude_ids?:number[]}} payload
 * @param {{signal?:AbortSignal, workerUrl?:string}} opts
 * @returns {Promise<{mode:string, route:Array<{id:number,why:string,you_will_understand:string}>}>}
 */
export async function requestRoute(payload, { signal, workerUrl } = {}) {
  const url = (workerUrl || WORKER_URL || (typeof window !== 'undefined' && window.__WORKER_URL__) || '') + '/route';
  if (!url || url === '/route') {
    // в T0 Worker ещё не задеплоен — бросаем специальную ошибку для перехода в fallback
    throw Object.assign(new Error('Worker URL not configured'), { code: 'no_worker' });
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (res.status === 429) throw Object.assign(new Error('rate_limited'), { code: 'rate_limited', status: 429 });
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'unavailable'), { code: body.error || 'unavailable', status: 503 });
  }
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: 'http', status: res.status });
  return res.json();
}

/**
 * Валидация ответа LLM по id (п.6.6)
 */
export function validateRoute(rawRoute, candidates) {
  const byId = new Map(candidates.map(c => [c.id, c]));
  const seen = new Set();
  const out = [];
  for (const item of rawRoute || []) {
    const id = Number(item.id);
    if (!byId.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, why: String(item.why || ''), you_will_understand: String(item.you_will_understand || '') });
  }
  return out;
}

/**
 * Вызов Worker + валидация по id. Если осталось <4 — один повтор, затем too_few (п.6.6).
 */
export async function requestValidRoute(payload, candidates, opts) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await requestRoute(payload, opts);
      const valid = validateRoute(res.route, candidates);
      if (valid.length >= 4) return { ...res, route: valid };
      lastErr = Object.assign(new Error('too_few'), { code: 'too_few' });
    } catch (e) {
      if (e.code === 'quota' || e.code === 'rate_limited' || e.code === 'no_worker') throw e;
      lastErr = e;
    }
  }
  throw lastErr || Object.assign(new Error('too_few'), { code: 'too_few' });
}

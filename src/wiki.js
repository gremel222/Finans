/**
 * wiki.js — работа с MediaWiki Action API (T1–T2, каркас в T0)
 * Полная реализация в T1/T2, здесь: wikiFetch с кэшем/ретраями/таймаутом
 * и совместимость с фикстурами smoke.mjs.
 */

export const API_USER_AGENT = 'WikiNavigator/0.1 (https://github.com/<твой_логин>/wiki-navigator)';
const CACHE_PREFIX = 'wiki:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TIMEOUT_MS = 8000;

function cacheKey(url) { return CACHE_PREFIX + url; }

function cacheGet(url) {
  try {
    const raw = sessionStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) { sessionStorage.removeItem(cacheKey(url)); return null; }
    return data;
  } catch { return null; }
}
function cacheSet(url, data) {
  try { sessionStorage.setItem(cacheKey(url), JSON.stringify({ t: Date.now(), data })); } catch {}
}

/**
 * Базовый fetch к Википедии.
 * - заголовок Api-User-Agent
 * - parallel ≤3 должен контролировать вызывающий код
 * - 429/503: 1s,2s,4s до 3 попыток
 * - таймаут 8s, поддержка AbortSignal
 */
export async function wikiFetch(url, { signal } = {}) {
  const cached = cacheGet(url);
  if (cached) return cached;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(new DOMException('TimeoutError', 'TimeoutError')), TIMEOUT_MS);
    // пробрасываем внешний signal
    if (signal) {
      if (signal.aborted) throw new DOMException('AbortError', 'AbortError');
      signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
    }
    try {
      const res = await fetch(url, {
        headers: { 'Api-User-Agent': API_USER_AGENT },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (res.status === 429 || res.status === 503) {
        const delay = 1000 * Math.pow(2, attempt);
        if (attempt < 3) { await new Promise(r => setTimeout(r, delay)); continue; }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cacheSet(url, json);
      return json;
    } catch (e) {
      clearTimeout(timeout);
      lastErr = e;
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        // таймаут — ретрай как 5xx, но не более 3 раз
        if (attempt < 3 && e.name === 'TimeoutError') {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw e;
      }
      if (attempt < 3) { await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); continue; }
      throw lastErr;
    }
  }
  throw lastErr;
}

export function buildApiUrl(lang, params) {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const usp = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  return `${base}?${usp.toString()}`;
}

// Заглушки — будут реализованы в T1/T2, нужны для импорта в main.js
export async function findStartArticle(_topic, _lang, _signal) {
  throw new Error('findStartArticle: not implemented until T1');
}
export async function getLeadCandidates(_title, _lang, _signal) {
  throw new Error('getLeadCandidates: not implemented until T1');
}
export async function getCandidateData(_titles, _lang, _startTitle, _signal) {
  throw new Error('getCandidateData: not implemented until T2');
}

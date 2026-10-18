/**
 * wiki.js — MediaWiki Action API (T1–T2)
 * findStartArticle, getLeadCandidates, getCandidateData + wikiFetch.
 *
 * Из браузера не шлём Api-User-Agent: это не-simple header, Wikipedia
 * не отвечает на CORS-preflight. Идентификация — origin=* + Referer.
 * Node (smoke.mjs) ставит Api-User-Agent. Если появятся 403/429 из браузера —
 * перенести вызовы в Worker (п.5.5 / вопрос 10).
 */

export const API_USER_AGENT = 'WikiNavigator/0.1 (https://github.com/gremel222/wiki-navigator)';
const CACHE_PREFIX = 'wiki:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const MAX_CANDIDATES = 30;
const LEAD_FALLBACK_MIN = 12;
const MAX_ARTICLE_LINKS = 300;
const EXTRACT_BATCH = 20;
const VIEWS_BATCH = 50;
const PARALLEL = 3;

const NS_PREFIXES = new Set([
  'file', 'image', 'category', 'help', 'wikipedia', 'template', 'talk', 'user',
  'special', 'media', 'module', 'portal', 'draft', 'timedtext', 'mediawiki',
  'wp', 'wt', 'cat',
  'файл', 'изображение', 'категория', 'справка', 'википедия', 'шаблон',
  'обсуждение', 'участник', 'служебная', 'модуль', 'портал', 'медиавики',
  'проект',
]);

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

export function buildApiUrl(lang, params) {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const usp = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  return `${base}?${usp.toString()}`;
}

export function normalizeTitle(title) {
  return String(title || '').replace(/_/g, ' ').trim();
}

export async function wikiFetch(url, { signal } = {}) {
  const cached = cacheGet(url);
  if (cached) return cached;

  const headers = {};
  if (typeof window === 'undefined') headers['Api-User-Agent'] = API_USER_AGENT;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < 3) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cacheSet(url, json);
      return json;
    } catch (e) {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (e.name === 'AbortError') throw new DOMException('Timeout', 'TimeoutError');
      lastErr = e;
      if (attempt < 1) {
        await sleep(500);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function mapPool(items, limit, fn) {
  const ret = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      ret[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length || 1));
  if (!items.length) return ret;
  await Promise.all(Array.from({ length: n }, worker));
  return ret;
}

export function parseParseText(parse) {
  if (!parse) return '';
  const html = parse.text;
  if (typeof html === 'string') return html;
  if (html && typeof html['*'] === 'string') return html['*'];
  return '';
}

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function titleFromHref(href) {
  const raw = String(href || '');
  const part = raw.includes('/wiki/') ? raw.split('/wiki/')[1] : raw.replace(/^\//, '');
  const noQuery = part.split('?')[0].split('#')[0];
  try { return decodeURIComponent(noQuery).replace(/_/g, ' '); } catch { return noQuery.replace(/_/g, ' '); }
}

export function isNonMainNamespace(title) {
  const t = normalizeTitle(title);
  const colon = t.indexOf(':');
  if (colon <= 0) return false;
  return NS_PREFIXES.has(t.slice(0, colon).trim().toLowerCase());
}

export function isDabTitle(title) {
  return /\((значения|disambiguation)\)\s*$/i.test(normalizeTitle(title));
}

export function isDateOrListTitle(title) {
  const t = normalizeTitle(title);
  // \b не работает с кириллицей (JS word char = [A-Za-z0-9_])
  if (/^(Список|Хронология)(\s|$|:)/i.test(t)) return true;
  if (/^(List of|Lists of|Chronology of|Timeline of)(\s|$|:)/i.test(t)) return true;
  if (/^\d{1,4}(\s*(год|года|годы|г\.|гг\.))?$/i.test(t)) return true;
  if (/^\d{1,4}s$/i.test(t)) return true;
  if (/^\d{1,4}(\s*[–-]\s*\d{1,4})?\s*(годы|гг\.)$/i.test(t)) return true;
  if (/^(\d{1,2}|[IVXLCDM]+)\s*(век|века|веков)\.?$/i.test(t)) return true;
  if (/^\d{1,2}(st|nd|rd|th)\s+century$/i.test(t)) return true;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(,\s*\d{1,4})?$/i.test(t)) return true;
  if (/^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(\s+\d{1,4})?$/i.test(t)) return true;
  return false;
}

function extractAnchorsFromHtml(html) {
  const anchors = [];
  const re = /<a\b([^>]*?)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const hrefM = attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i);
    if (!hrefM) continue;
    const titleM = attrs.match(/title\s*=\s*"([^"]*)"/i) || attrs.match(/title\s*=\s*'([^']*)'/i);
    const classM = attrs.match(/class\s*=\s*"([^"]*)"/i) || attrs.match(/class\s*=\s*'([^']*)'/i);
    anchors.push({
      href: decodeHtml(hrefM[1]),
      title: titleM ? decodeHtml(titleM[1]) : '',
      className: classM ? classM[1] : '',
    });
  }
  return anchors;
}

function topLevelParagraphHtml(html) {
  let work = html;
  const idx = work.search(/class=["']mw-parser-output["']/i);
  if (idx !== -1) {
    const gt = work.indexOf('>', idx);
    if (gt !== -1) work = work.slice(gt + 1);
  }
  const paras = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(work))) paras.push(m[1]);
  return paras.join('\n');
}

export function parseLeadHtml(html) {
  if (!html) return [];
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const root = doc.querySelector('.mw-parser-output') || doc.body;
      const anchors = [];
      const paras = [...root.children].filter(el => el.tagName === 'P');
      for (const p of paras) {
        for (const a of p.querySelectorAll('a[href^="/wiki/"]')) {
          anchors.push({
            href: a.getAttribute('href') || '',
            title: a.getAttribute('title') || '',
            className: a.getAttribute('class') || '',
          });
        }
      }
      return anchors;
    } catch { /* fall through to lite parser */ }
  }
  return extractAnchorsFromHtml(topLevelParagraphHtml(html));
}

export function collectLeadLinks(html, startTitle) {
  const start = normalizeTitle(startTitle).toLowerCase();
  const seen = new Set();
  const out = [];
  for (const a of parseLeadHtml(html)) {
    const href = a.href || '';
    if (!href.includes('/wiki/') && !href.startsWith('/wiki/')) continue;
    if (href.includes('#')) continue;
    if (/[?&]redlink=1/.test(href)) continue;
    if (/\bnew\b/.test(a.className || '')) continue;
    let title = normalizeTitle(a.title) || titleFromHref(href);
    title = normalizeTitle(title);
    if (!title) continue;
    if (isNonMainNamespace(title)) continue;
    if (title.toLowerCase() === start) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, lead_pos: out.length + 1 });
  }
  return out;
}

export function sumPageviews(pageviews) {
  if (!pageviews || typeof pageviews !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(pageviews)) {
    if (typeof v === 'number' && Number.isFinite(v)) n += v;
  }
  return n;
}

export function isGarbageCandidate(c) {
  if (!c || !c.title) return true;
  if (c.disambiguation) return true;
  if (isDabTitle(c.title)) return true;
  if (isNonMainNamespace(c.title)) return true;
  if (isDateOrListTitle(c.title)) return true;
  if (!c.is_start && !(c.description || '').trim() && !(c.extract || '').trim()) return true;
  return false;
}

export function truncateCandidates(list, limit = MAX_CANDIDATES) {
  const start = list.filter(c => c.is_start);
  const rest = list.filter(c => !c.is_start)
    .sort((a, b) => (a.lead_pos - b.lead_pos) || ((b.views || 0) - (a.views || 0)));
  return [...start, ...rest].slice(0, limit);
}

export function mergeQueryPages(query, originalItems) {
  const pages = query?.pages || [];
  const redirects = query?.redirects || [];
  const normalized = query?.normalized || [];
  const alias = new Map();
  for (const n of normalized) alias.set(n.from, n.to);
  for (const r of redirects) alias.set(r.from, r.to);
  function resolve(t) {
    let cur = t;
    for (let i = 0; i < 6 && alias.has(cur); i++) cur = alias.get(cur);
    return cur;
  }
  const metaByFinal = new Map();
  for (const item of originalItems) {
    const final = resolve(item.title);
    const prev = metaByFinal.get(final) || { lead_pos: Infinity, is_start: false };
    metaByFinal.set(final, {
      lead_pos: Math.min(prev.lead_pos, item.lead_pos ?? Infinity),
      is_start: prev.is_start || !!item.is_start,
    });
  }
  const byPageId = new Map();
  for (const p of pages) {
    if (!p || p.missing || p.invalid || p.pageid == null) continue;
    if (byPageId.has(p.pageid)) continue;
    const meta = metaByFinal.get(p.title) || { lead_pos: 999, is_start: false };
    const description = typeof p.description === 'string'
      ? p.description
      : (p.description && p.description.text) || '';
    byPageId.set(p.pageid, {
      pageid: p.pageid,
      title: p.title,
      extract: p.extract || '',
      description,
      views: sumPageviews(p.pageviews),
      disambiguation: !!(p.pageprops && Object.prototype.hasOwnProperty.call(p.pageprops, 'disambiguation')),
      lead_pos: Number.isFinite(meta.lead_pos) ? meta.lead_pos : 999,
      is_start: meta.is_start,
    });
  }
  return [...byPageId.values()];
}

export function assignIds(list) {
  return list.map((c, i) => ({
    id: i + 1,
    title: c.title,
    pageid: c.pageid,
    is_start: !!c.is_start,
    description: (c.description || '').slice(0, 400),
    extract: (c.extract || '').slice(0, 800),
    views: c.views || 0,
    lead_pos: c.lead_pos ?? i,
  }));
}

function mergeItems(base, extra) {
  const seen = new Set(base.map(i => normalizeTitle(i.title).toLowerCase()));
  const out = [...base];
  for (const e of extra) {
    const title = normalizeTitle(e.title);
    if (!title) continue;
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ title, lead_pos: e.lead_pos ?? out.length + 1, is_start: !!e.is_start });
  }
  return out;
}

function linksFromParseLinks(json, startTitle) {
  const start = normalizeTitle(startTitle).toLowerCase();
  const out = [];
  const seen = new Set();
  for (const l of json.parse?.links || []) {
    if (l.ns != null && l.ns !== 0) continue;
    if (!('exists' in l) || l.exists === false) continue;
    const title = normalizeTitle(l.title);
    if (!title || title.toLowerCase() === start) continue;
    if (isNonMainNamespace(title) || isDateOrListTitle(title) || isDabTitle(title)) continue;
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ title, lead_pos: out.length + 1 });
  }
  return out;
}

async function getAllArticleLinks(title, lang, signal, max = MAX_ARTICLE_LINKS) {
  let plcontinue;
  const collected = [];
  const seen = new Set();
  const start = normalizeTitle(title).toLowerCase();
  do {
    const params = {
      action: 'query', titles: title, redirects: '1',
      prop: 'links', plnamespace: '0', pllimit: 'max',
    };
    if (plcontinue) params.plcontinue = plcontinue;
    const json = await wikiFetch(buildApiUrl(lang, params), { signal });
    const page = (json.query?.pages || [])[0];
    for (const l of page?.links || []) {
      if (l.ns != null && l.ns !== 0) continue;
      const t = normalizeTitle(l.title);
      if (!t || t.toLowerCase() === start) continue;
      if (isNonMainNamespace(t) || isDateOrListTitle(t) || isDabTitle(t)) continue;
      if (seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      collected.push({ title: t, lead_pos: collected.length + 1 });
      if (collected.length >= max) return collected;
    }
    plcontinue = json.continue?.plcontinue;
  } while (plcontinue && collected.length < max);
  return collected;
}

/**
 * @returns {{ title:string, pageid:number, exact:boolean, disambiguation:boolean, needsChoice:boolean, alternatives:Array }}
 */
export async function findStartArticle(topic, lang, signal) {
  const q = String(topic || '').trim();
  if (!q) throw Object.assign(new Error('not_found'), { code: 'not_found' });

  const exactUrl = buildApiUrl(lang, {
    action: 'query', titles: q, redirects: '1',
    prop: 'pageprops', ppprop: 'disambiguation',
  });
  const searchUrl = buildApiUrl(lang, {
    action: 'query', list: 'search', srsearch: q, srlimit: '5',
  });
  const [exactJson, searchJson] = await Promise.all([
    wikiFetch(exactUrl, { signal }),
    wikiFetch(searchUrl, { signal }),
  ]);

  const page = (exactJson.query?.pages || [])[0];
  const search = (searchJson.query?.search || []).map(s => ({
    title: s.title,
    pageid: s.pageid,
    snippet: s.snippet || '',
  }));
  const missing = !page || page.missing || page.invalid;
  const dab = !missing && page.pageprops && Object.prototype.hasOwnProperty.call(page.pageprops, 'disambiguation');

  if (!missing && !dab) {
    return {
      title: page.title,
      pageid: page.pageid,
      exact: true,
      disambiguation: false,
      needsChoice: false,
      alternatives: search.filter(s => s.title !== page.title && !isDabTitle(s.title)),
    };
  }

  const alts = search.filter(s => !isDabTitle(s.title) && (!page || s.title !== page.title));
  if (!alts.length) throw Object.assign(new Error('not_found'), { code: 'not_found' });

  return {
    title: dab ? page.title : alts[0].title,
    pageid: dab ? page.pageid : alts[0].pageid,
    exact: !missing,
    disambiguation: !!dab,
    needsChoice: true,
    alternatives: alts,
  };
}

/**
 * @returns {{ titles: Array<{title:string, lead_pos:number}>, narrow:boolean, source:string }}
 */
export async function getLeadCandidates(title, lang, signal) {
  const parseUrl = buildApiUrl(lang, {
    action: 'parse', page: title, prop: 'text', section: '0', redirects: '1',
  });
  const parseJson = await wikiFetch(parseUrl, { signal });
  const html = parseParseText(parseJson.parse);
  let items = collectLeadLinks(html, title);
  let source = 'lead';
  let usedFallback = false;

  if (items.length < LEAD_FALLBACK_MIN) {
    const linksUrl = buildApiUrl(lang, {
      action: 'parse', page: title, prop: 'links', section: '0', redirects: '1',
    });
    const linksJson = await wikiFetch(linksUrl, { signal });
    items = mergeItems(items, linksFromParseLinks(linksJson, title));
    source = 'parse_links';
    usedFallback = true;
  }

  if (items.length < LEAD_FALLBACK_MIN) {
    const more = await getAllArticleLinks(title, lang, signal, MAX_ARTICLE_LINKS);
    items = mergeItems(items, more);
    source = 'article_links';
    usedFallback = true;
  }

  return {
    titles: items,
    narrow: usedFallback || items.length < LEAD_FALLBACK_MIN,
    source,
  };
}

async function fetchExtractBatch(titles, lang, signal) {
  if (!titles.length) return { query: { pages: [] } };
  const url = buildApiUrl(lang, {
    action: 'query',
    titles: titles.join('|'),
    redirects: '1',
    prop: 'extracts|description|pageprops|pageviews',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: String(Math.min(EXTRACT_BATCH, titles.length)),
    ppprop: 'disambiguation',
    pvipdays: '30',
  });
  return wikiFetch(url, { signal });
}

async function fetchViewsBatch(titles, lang, signal) {
  const url = buildApiUrl(lang, {
    action: 'query',
    titles: titles.join('|'),
    redirects: '1',
    prop: 'pageviews',
    pvipdays: '30',
  });
  return wikiFetch(url, { signal });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * @param {Array<{title:string, lead_pos:number, is_start?:boolean}>} titleItems
 * @returns {Promise<Array>}
 */
export async function getCandidateData(titleItems, lang, startTitle, signal) {
  let items = (titleItems || []).map(t => (
    typeof t === 'string' ? { title: normalizeTitle(t), lead_pos: 0 } : { ...t, title: normalizeTitle(t.title) }
  ));
  const start = normalizeTitle(startTitle);
  if (start && !items.some(i => i.title.toLowerCase() === start.toLowerCase())) {
    items.unshift({ title: start, lead_pos: 0, is_start: true });
  } else {
    for (const i of items) {
      if (i.title.toLowerCase() === start.toLowerCase()) i.is_start = true;
    }
  }

  const byKey = new Map();
  for (const i of items) {
    const k = i.title.toLowerCase();
    const prev = byKey.get(k);
    if (!prev || (i.lead_pos ?? 999) < (prev.lead_pos ?? 999)) byKey.set(k, { ...i });
    else if (i.is_start) prev.is_start = true;
  }
  items = [...byKey.values()];

  if (items.length > 40) {
    const viewChunks = chunk(items.map(i => i.title), VIEWS_BATCH);
    const viewJsons = await mapPool(viewChunks, PARALLEL, (titles) => fetchViewsBatch(titles, lang, signal));
    const viewsByTitle = new Map();
    for (let i = 0; i < viewJsons.length; i++) {
      const merged = mergeQueryPages(viewJsons[i].query, viewChunks[i].map(title => ({ title, lead_pos: 0 })));
      for (const p of merged) viewsByTitle.set(p.title.toLowerCase(), p.views || 0);
    }
    for (const i of items) i.views = viewsByTitle.get(i.title.toLowerCase()) || 0;
    const startItems = items.filter(i => i.is_start);
    const rest = items.filter(i => !i.is_start).sort((a, b) => (b.views || 0) - (a.views || 0));
    items = [...startItems, ...rest].slice(0, MAX_CANDIDATES);
  }

  const batches = chunk(items.map(i => i.title), EXTRACT_BATCH);
  const jsons = await mapPool(batches, PARALLEL, (titles) => fetchExtractBatch(titles, lang, signal));
  let pages = [];
  for (let i = 0; i < jsons.length; i++) {
    const orig = batches[i].map(title => items.find(it => it.title === title) || { title, lead_pos: 999 });
    pages = pages.concat(mergeQueryPages(jsons[i].query, orig));
  }

  const byPageId = new Map();
  for (const p of pages) {
    if (byPageId.has(p.pageid)) {
      const prev = byPageId.get(p.pageid);
      if (p.is_start) prev.is_start = true;
      prev.lead_pos = Math.min(prev.lead_pos, p.lead_pos);
      continue;
    }
    byPageId.set(p.pageid, p);
  }
  let list = [...byPageId.values()].filter(c => !isGarbageCandidate(c));
  list = truncateCandidates(list, MAX_CANDIDATES);
  return assignIds(list);
}

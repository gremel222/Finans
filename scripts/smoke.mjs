#!/usr/bin/env node
/**
 * scripts/smoke.mjs — реальные запросы к Википедии (T0)
 * Запускает человек локально (нужен Node.js >=18, без deps).
 * Сохраняет ответы в tests/fixtures/ и печатает краткий отчёт.
 * Использование: node scripts/smoke.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures');
const API_USER_AGENT = 'WikiNavigator/0.1 (https://github.com/<твой_логин>/wiki-navigator)';

const TOPICS = [
  { topic: 'Блокчейн', lang: 'ru' },
  { topic: 'Quantum mechanics', lang: 'en' },
  { topic: 'Римская империя', lang: 'ru' },
];

const TIMEOUT_MS = 8000;

async function fetchJson(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'Api-User-Agent': API_USER_AGENT }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429 || res.status === 503) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); continue; }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      if (attempt < retries && e.name !== 'AbortError') { await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt))); continue; }
      throw e;
    }
  }
}

function buildUrl(lang, params) {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const usp = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  return `${base}?${usp.toString()}`;
}

async function runTopic({ topic, lang }) {
  const out = { topic, lang, at: new Date().toISOString(), steps: {} };

  // 5.1 — точное совпадение
  const exactUrl = buildUrl(lang, { action: 'query', titles: topic, redirects: '1', prop: 'pageprops', ppprop: 'disambiguation' });
  out.steps.exact = { url: exactUrl };
  try {
    out.steps.exact.response = await fetchJson(exactUrl);
    const pages = out.steps.exact.response.query?.pages || [];
    const page = pages[0];
    out.steps.exact.found = page && !page.missing ? { title: page.title, pageid: page.pageid, disambiguation: !!page.pageprops?.disambiguation } : null;
  } catch (e) { out.steps.exact.error = String(e); }

  // 5.1 — поиск топ-5
  const searchUrl = buildUrl(lang, { action: 'query', list: 'search', srsearch: topic, srlimit: '5' });
  out.steps.search = { url: searchUrl };
  try {
    out.steps.search.response = await fetchJson(searchUrl);
    out.steps.search.results = out.steps.search.response.query?.search?.map(s => s.title) || [];
  } catch (e) { out.steps.search.error = String(e); }

  const startTitle = out.steps.exact.found?.title || out.steps.search.results?.[0] || topic;

  // 5.2 — parse section 0 text
  const parseTextUrl = buildUrl(lang, { action: 'parse', page: startTitle, prop: 'text', section: '0', redirects: '1' });
  out.steps.parseText = { url: parseTextUrl };
  try {
    out.steps.parseText.response = await fetchJson(parseTextUrl);
    const html = out.steps.parseText.response.parse?.text;
    // html может быть строкой (fv2) или объектом {*: "..."} (fv1)
    const htmlStr = typeof html === 'string' ? html : (html?.['*'] || '');
    out.steps.parseText.htmlLength = htmlStr.length;
    out.steps.parseText.htmlPreview = htmlStr.slice(0, 300);
  } catch (e) { out.steps.parseText.error = String(e); }

  // 5.2 запасной — parse links
  const parseLinksUrl = buildUrl(lang, { action: 'parse', page: startTitle, prop: 'links', section: '0', redirects: '1' });
  out.steps.parseLinks = { url: parseLinksUrl };
  try { out.steps.parseLinks.response = await fetchJson(parseLinksUrl); } catch (e) { out.steps.parseLinks.error = String(e); }

  // 5.3 — батч extracts+description+pageprops+pageviews
  // Сначала соберём до 20 заголовков из parse.links если есть, иначе из search
  let titlesForBatch = [];
  if (out.steps.parseLinks.response?.parse?.links) {
    titlesForBatch = out.steps.parseLinks.response.parse.links.filter(l => l.ns === 0 && l.exists).map(l => l.title).slice(0, 20);
  }
  if (!titlesForBatch.length) titlesForBatch = [startTitle];
  const batchUrl = buildUrl(lang, {
    action: 'query', titles: titlesForBatch.join('|'), redirects: '1',
    prop: 'extracts|description|pageprops|pageviews',
    exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20',
    ppprop: 'disambiguation', pvipdays: '30',
  });
  out.steps.batch = { url: batchUrl, titles: titlesForBatch };
  try {
    out.steps.batch.response = await fetchJson(batchUrl);
    const pages = out.steps.batch.response.query?.pages || [];
    out.steps.batch.pageCount = pages.length;
    out.steps.batch.hasPageviews = pages.some(p => p.pageviews && Object.keys(p.pageviews).length);
    // проверка массивов redirects/normalized
    out.steps.batch.redirects = out.steps.batch.response.query?.redirects || [];
    out.steps.batch.normalized = out.steps.batch.response.query?.normalized || [];
  } catch (e) { out.steps.batch.error = String(e); }

  return out;
}

async function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log(`WikiNavigator smoke — ${TOPICS.length} тем, Api-User-Agent: ${API_USER_AGENT}\n`);
  const results = [];
  for (const t of TOPICS) {
    console.log(`→ ${t.lang}: "${t.topic}" ...`);
    try {
      const out = await runTopic(t);
      const safe = t.topic.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]+/g, '_').slice(0, 40);
      const file = path.join(FIXTURES_DIR, `${t.lang}-${safe}.json`);
      fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
      console.log(`  ✓ saved ${path.relative(process.cwd(), file)} — found: ${out.steps.exact.found?.title || out.steps.search.results?.[0] || '—'}, batch pages: ${out.steps.batch.pageCount || 0}, hasPageviews: ${!!out.steps.batch.hasPageviews}`);
      // отдельно сохранить краткий отчёт по CORS/pageviews
      results.push({ topic: t.topic, lang: t.lang, ok: true, hasPageviews: !!out.steps.batch.hasPageviews, apiUserAgentOk: !out.steps.batch.error });
    } catch (e) {
      console.error(`  ✗ ${t.topic}: ${e.message}`);
      results.push({ topic: t.topic, lang: t.lang, ok: false, error: String(e) });
    }
  }
  console.log('\n--- Краткий отчёт ---');
  for (const r of results) console.log(`  ${r.lang} "${r.topic}": ok=${r.ok} hasPageviews=${r.hasPageviews ?? 'n/a'} ${r.error || ''}`);
  console.log(`\nApi-User-Agent из Node ${results.every(r=>r.ok) ? 'работает' : 'проверить по файлам'}.`);
  console.log(`prop=pageviews: ${results.some(r=>r.hasPageviews) ? 'работает на части языков' : 'пусто/ошибка — фронт деградирует без views (п.11 ответа)'}.`);
  console.log(`Фикстуры в tests/fixtures/ — приложи их к ответу агенту, если интернет в среде агента закрыт.`);
}

main().catch(e => { console.error(e); process.exit(1); });

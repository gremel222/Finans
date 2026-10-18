#!/usr/bin/env node
/**
 * scripts/smoke.mjs — реальные запросы к Википедии (T0)
 * Запускает человек локально (нужен Node.js >=18, без зависимостей).
 * Сохраняет ответы в tests/fixtures/ и печатает краткий отчёт.
 * Использование: node scripts/smoke.mjs
 *
 * Правило: фикстура сохраняется ТОЛЬКО если получены реальные данные.
 * Если все шаги темы упали (нет сети и т.п.) — файл не пишется.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures');
// Должен совпадать с src/wiki.js. Только ASCII: HTTP-заголовок не может содержать кириллицу.
const API_USER_AGENT = 'WikiNavigator/0.1 (https://github.com/gremel222/wiki-navigator)';

const TOPICS = [
  { topic: 'Блокчейн', lang: 'ru' },
  { topic: 'Quantum mechanics', lang: 'en' },
  { topic: 'Римская империя', lang: 'ru' },
];

const TIMEOUT_MS = 8000;

// --- предварительные проверки среды (понятные сообщения для новичка) ---
function preflight() {
  const major = Number(process.versions.node.split('.')[0]);
  if (typeof fetch !== 'function' || major < 18) {
    console.error(`✗ Нужен Node.js 18 или новее (у вас ${process.version}). Скачайте LTS с https://nodejs.org и запустите снова.`);
    process.exit(2);
  }
  // eslint-disable-next-line no-control-regex
  if (/[^\x20-\x7E]/.test(API_USER_AGENT)) {
    console.error('✗ API_USER_AGENT содержит не-ASCII символы (кириллицу?). HTTP-заголовок должен быть латиницей. Исправьте константу в scripts/smoke.mjs и src/wiki.js.');
    process.exit(2);
  }
}

function describeError(e) {
  if (!e) return 'unknown';
  if (e.name === 'AbortError') return `timeout ${TIMEOUT_MS} ms`;
  const cause = e.cause && (e.cause.code || e.cause.message);
  return cause ? `${e.message} (${cause})` : (e.message || String(e));
}

async function fetchJson(url, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'Api-User-Agent': API_USER_AGENT }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); continue; }
        throw lastErr;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      // Ошибки конфигурации (например, плохой заголовок) не лечатся повтором
      if (e instanceof TypeError && !e.cause) throw e;
      if (attempt < retries) { await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt))); continue; }
      throw e;
    }
  }
  throw lastErr;
}

function buildUrl(lang, params) {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const usp = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  return `${base}?${usp.toString()}`;
}

async function step(out, name, url, handler) {
  out.steps[name] = { url };
  try {
    const response = await fetchJson(url);
    out.steps[name].response = response;
    if (handler) handler(out.steps[name], response);
    out.steps[name].ok = true;
  } catch (e) {
    out.steps[name].ok = false;
    out.steps[name].error = describeError(e);
  }
  return out.steps[name];
}

async function runTopic({ topic, lang }) {
  const out = { topic, lang, at: new Date().toISOString(), apiUserAgent: API_USER_AGENT, steps: {} };

  // 5.1 — точное совпадение
  await step(out, 'exact',
    buildUrl(lang, { action: 'query', titles: topic, redirects: '1', prop: 'pageprops', ppprop: 'disambiguation' }),
    (s, r) => {
      const page = (r.query?.pages || [])[0];
      s.found = page && !page.missing
        ? { title: page.title, pageid: page.pageid, disambiguation: !!page.pageprops?.disambiguation }
        : null;
      s.redirects = r.query?.redirects || [];
      s.normalized = r.query?.normalized || [];
    });

  // 5.1 — поиск топ-5
  await step(out, 'search',
    buildUrl(lang, { action: 'query', list: 'search', srsearch: topic, srlimit: '5' }),
    (s, r) => { s.results = (r.query?.search || []).map(x => x.title); });

  const startTitle = out.steps.exact.found?.title || out.steps.search.results?.[0] || topic;
  out.startTitle = startTitle;

  // 5.2 — parse section 0 text (HTML вступления)
  await step(out, 'parseText',
    buildUrl(lang, { action: 'parse', page: startTitle, prop: 'text', section: '0', redirects: '1' }),
    (s, r) => {
      const html = r.parse?.text;
      const htmlStr = typeof html === 'string' ? html : (html?.['*'] || '');
      s.htmlLength = htmlStr.length;
      s.htmlPreview = htmlStr.slice(0, 300);
    });

  // 5.2 запасной — parse links секции 0
  await step(out, 'parseLinks',
    buildUrl(lang, { action: 'parse', page: startTitle, prop: 'links', section: '0', redirects: '1' }),
    (s, r) => {
      const links = r.parse?.links || [];
      s.linksTotal = links.length;
      // fv2: exists=true присутствует только у существующих страниц (у красных ссылок ключа нет)
      s.linksNs0Existing = links.filter(l => l.ns === 0 && 'exists' in l).length;
    });

  // 5.3 — батч extracts+description+pageprops+pageviews по первым 20 ссылкам ns0
  let titlesForBatch = [];
  const links = out.steps.parseLinks.response?.parse?.links || [];
  titlesForBatch = links.filter(l => l.ns === 0 && 'exists' in l).map(l => l.title).slice(0, 20);
  if (!titlesForBatch.length) titlesForBatch = [startTitle];
  await step(out, 'batch',
    buildUrl(lang, {
      action: 'query', titles: titlesForBatch.join('|'), redirects: '1',
      prop: 'extracts|description|pageprops|pageviews',
      exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20',
      ppprop: 'disambiguation', pvipdays: '30',
    }),
    (s, r) => {
      const pages = r.query?.pages || [];
      s.titles = titlesForBatch;
      s.pageCount = pages.length;
      s.hasPageviews = pages.some(p => p.pageviews && Object.values(p.pageviews).some(v => v != null));
      s.hasExtracts = pages.some(p => typeof p.extract === 'string' && p.extract.length > 0);
      s.hasDescriptions = pages.some(p => typeof p.description === 'string' && p.description.length > 0);
      s.redirects = r.query?.redirects || [];
      s.normalized = r.query?.normalized || [];
      s.warnings = r.warnings || null;
    });

  return out;
}

async function main() {
  preflight();
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  console.log(`WikiNavigator smoke — ${TOPICS.length} тем, Node ${process.version}`);
  console.log(`Api-User-Agent: ${API_USER_AGENT}\n`);
  const results = [];
  for (const t of TOPICS) {
    console.log(`→ ${t.lang}: "${t.topic}" ...`);
    const out = await runTopic(t);
    const steps = Object.values(out.steps);
    const okCount = steps.filter(s => s.ok).length;
    const safe = t.topic.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]+/g, '_').slice(0, 40);
    const file = path.join(FIXTURES_DIR, `${t.lang}-${safe}.json`);

    if (okCount === 0) {
      // Нет ни одного реального ответа — фикстуру не пишем (правило «только реальные данные»)
      const firstErr = steps[0]?.error || 'unknown';
      console.log(`  ✗ ни один запрос не прошёл — файл НЕ сохранён. Ошибка: ${firstErr}`);
      results.push({ ...t, ok: false, error: firstErr });
      continue;
    }

    fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
    const b = out.steps.batch;
    console.log(`  ✓ ${okCount}/${steps.length} шагов, сохранено ${path.relative(process.cwd(), file)}`);
    console.log(`    стартовая статья: ${out.startTitle}${out.steps.exact.found ? '' : ' (через поиск)'}; поиск топ-5: ${(out.steps.search.results || []).join(' | ') || '—'}`);
    console.log(`    вступление: html ${out.steps.parseText.htmlLength ?? '—'} симв.; ссылок в секции 0: ${out.steps.parseLinks.linksTotal ?? '—'}`);
    console.log(`    батч: страниц ${b.pageCount ?? '—'}, extracts=${b.hasExtracts ?? '—'}, descriptions=${b.hasDescriptions ?? '—'}, pageviews=${b.hasPageviews ?? '—'}`);
    for (const [name, s] of Object.entries(out.steps)) if (!s.ok) console.log(`    ! шаг ${name}: ${s.error}`);
    results.push({ ...t, ok: true, partial: okCount < steps.length, hasPageviews: !!b.hasPageviews, hasExtracts: !!b.hasExtracts });
  }

  console.log('\n--- Краткий отчёт ---');
  for (const r of results) {
    console.log(`  ${r.lang} "${r.topic}": ${r.ok ? (r.partial ? 'частично' : 'ok') : 'FAIL'}${r.ok ? ` pageviews=${r.hasPageviews} extracts=${r.hasExtracts}` : ` — ${r.error}`}`);
  }
  const anyOk = results.some(r => r.ok);
  if (!anyOk) {
    console.log('\nИтог: ни одного ответа от Википедии. Проверьте интернет/прокси/VPN и запустите снова.');
    console.log('Если ошибка «fetch failed (ENOTFOUND|ECONNRESET|ECONNREFUSED)» — сеть блокирует *.wikipedia.org.');
    process.exit(1);
  }
  console.log(`\nApi-User-Agent из Node: принят (ответы получены).`);
  console.log(`prop=pageviews: ${results.some(r => r.hasPageviews) ? 'работает' : 'пусто — фронт деградирует без views (сортировка по lead_pos)'}.`);
  console.log(`Фикстуры: tests/fixtures/ — пришлите эти файлы и этот вывод агенту.`);
}

main().catch(e => { console.error('✗ Непредвиденная ошибка:', describeError(e)); process.exit(1); });

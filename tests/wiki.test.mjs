/**
 * Юнит-тесты T1/T2: разбор HTML, фильтр, редиректы, дедуп, обрезка.
 * Мок-ответы — форма API, не «живые» фикстуры Википедии (их пишет только smoke.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectLeadLinks, isDateOrListTitle, isNonMainNamespace, isDabTitle,
  isGarbageCandidate, truncateCandidates, mergeQueryPages, sumPageviews,
  parseParseText, titleFromHref, assignIds, findStartArticle, getLeadCandidates,
  getCandidateData,
} from '../src/wiki.js';

test('collectLeadLinks: только p, без #, redlink, File, self', () => {
  const html = `<div class="mw-parser-output">
    <div class="hatnote">Не путать с <a href="/wiki/Foo" title="Foo">Foo</a></div>
    <p>Текст <a href="/wiki/Криптография" title="Криптография">криптография</a>
       и <a href="/wiki/Блокчейн#cite" title="Блокчейн">сноска</a>
       и <a href="/wiki/X?redlink=1" title="X" class="new">нет</a>
       и <a href="/wiki/File:A.png" title="File:A.png">файл</a>
       и <a href="/wiki/Блокчейн" title="Блокчейн">self</a>
       и <a href="/wiki/Хеш-функция" title="Хеш-функция">хеш</a>.</p>
    <p>Ещё <a href="/wiki/Распределённый_реестр" title="Распределённый реестр">реестр</a>.</p>
  </div>`;
  const links = collectLeadLinks(html, 'Блокчейн');
  assert.deepEqual(links.map(l => l.title), ['Криптография', 'Хеш-функция', 'Распределённый реестр']);
  assert.equal(links[0].lead_pos, 1);
  assert.equal(links[2].lead_pos, 3);
});

test('фильтр дат, списков, хронологий, dab, ns', () => {
  assert.equal(isDateOrListTitle('2020'), true);
  assert.equal(isDateOrListTitle('2020 год'), true);
  assert.equal(isDateOrListTitle('XX век'), true);
  assert.equal(isDateOrListTitle('19th century'), true);
  assert.equal(isDateOrListTitle('12 января'), true);
  assert.equal(isDateOrListTitle('List of algorithms'), true);
  assert.equal(isDateOrListTitle('Список стран'), true);
  assert.equal(isDateOrListTitle('Хронология Второй мировой войны'), true);
  assert.equal(isDateOrListTitle('Timeline of computing'), true);
  assert.equal(isDateOrListTitle('Россия'), false);
  assert.equal(isDateOrListTitle('Блокчейн'), false);
  assert.equal(isNonMainNamespace('Категория:Криптография'), true);
  assert.equal(isNonMainNamespace('File:A.png'), true);
  assert.equal(isNonMainNamespace('Star Wars: A New Hope'), false);
  assert.equal(isDabTitle('Python (значения)'), true);
  assert.equal(isDabTitle('Python (disambiguation)'), true);
  assert.equal(isDabTitle('Python'), false);
});

test('мусор: dab, пустые, списки; страны не фильтруем', () => {
  assert.equal(isGarbageCandidate({ title: 'X', disambiguation: true, description: 'a', extract: 'b' }), true);
  assert.equal(isGarbageCandidate({ title: 'Список X', description: 'a', extract: 'b' }), true);
  assert.equal(isGarbageCandidate({ title: 'Пусто' }), true);
  assert.equal(isGarbageCandidate({ title: 'Пусто', is_start: true }), false);
  assert.equal(isGarbageCandidate({ title: 'Россия', description: 'государство' }), false);
  assert.equal(isGarbageCandidate({ title: 'Блокчейн', extract: 'цепочка блоков' }), false);
});

test('обрезка до 30: is_start, затем lead_pos, затем views', () => {
  const list = [];
  for (let i = 0; i < 40; i++) {
    list.push({ title: 'T' + i, lead_pos: i + 1, views: 1000 - i, is_start: false });
  }
  list.push({ title: 'Start', lead_pos: 99, views: 1, is_start: true });
  const t = truncateCandidates(list, 30);
  assert.equal(t.length, 30);
  assert.equal(t[0].title, 'Start');
  assert.equal(t[1].title, 'T0');
  assert.equal(t[2].title, 'T1');
});

test('sumPageviews пропускает null', () => {
  assert.equal(sumPageviews({ '2024-01-01': 10, '2024-01-02': null, '2024-01-03': 5 }), 15);
  assert.equal(sumPageviews(null), 0);
});

test('parseParseText fv1 и fv2', () => {
  assert.equal(parseParseText({ text: '<p>A</p>' }), '<p>A</p>');
  assert.equal(parseParseText({ text: { '*': '<p>B</p>' } }), '<p>B</p>');
  assert.equal(parseParseText({}), '');
});

test('titleFromHref декодирует кириллицу и _', () => {
  assert.equal(titleFromHref('/wiki/Hello_World'), 'Hello World');
  assert.equal(titleFromHref('/wiki/%D0%91%D0%BB%D0%BE%D0%BA%D1%87%D0%B5%D0%B9%D0%BD'), 'Блокчейн');
});

test('редиректы + дедуп по pageid', () => {
  const query = {
    normalized: [{ from: 'blockchain', to: 'Blockchain' }],
    redirects: [{ from: 'Blockchain', to: 'Блокчейн' }],
    pages: [
      { pageid: 1, title: 'Блокчейн', extract: 'e', description: 'd', pageviews: { a: 10 } },
      { pageid: 1, title: 'Блокчейн', extract: 'dup' },
    ],
  };
  const merged = mergeQueryPages(query, [
    { title: 'blockchain', lead_pos: 3, is_start: false },
    { title: 'Блокчейн', lead_pos: 0, is_start: true },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].pageid, 1);
  assert.equal(merged[0].is_start, true);
  assert.equal(merged[0].lead_pos, 0);
  assert.equal(merged[0].views, 10);
});

test('assignIds с 1', () => {
  const ids = assignIds([{ title: 'A', lead_pos: 0, is_start: true }, { title: 'B', lead_pos: 1 }]);
  assert.equal(ids[0].id, 1);
  assert.equal(ids[1].id, 2);
});

test('findStartArticle: точное совпадение не требует выбора', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('action=query') && u.includes('titles=')) {
      return jsonRes({ query: { pages: [{ pageid: 10, title: 'Блокчейн', pageprops: {} }] } });
    }
    return jsonRes({ query: { search: [{ title: 'Блокчейн', pageid: 10 }, { title: 'Криптовалюта', pageid: 11 }] } });
  };
  try {
    const r = await findStartArticle('Блокчейн', 'ru');
    assert.equal(r.exact, true);
    assert.equal(r.needsChoice, false);
    assert.equal(r.title, 'Блокчейн');
    assert.equal(r.alternatives[0].title, 'Криптовалюта');
  } finally { globalThis.fetch = orig; }
});

test('findStartArticle: страница значений требует выбора', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('ppprop=disambiguation')) {
      return jsonRes({ query: { pages: [{ pageid: 1, title: 'Python (значения)', pageprops: { disambiguation: '' } }] } });
    }
    return jsonRes({ query: { search: [
      { title: 'Python (значения)', pageid: 1 },
      { title: 'Python', pageid: 2 },
      { title: 'Питон', pageid: 3 },
    ] } });
  };
  try {
    const r = await findStartArticle('Python', 'ru');
    assert.equal(r.disambiguation, true);
    assert.equal(r.needsChoice, true);
    assert.ok(r.alternatives.every(a => a.title !== 'Python (значения)'));
    assert.equal(r.alternatives[0].title, 'Python');
  } finally { globalThis.fetch = orig; }
});

test('findStartArticle: нет страницы — поиск, ждать выбор', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('ppprop=disambiguation')) {
      return jsonRes({ query: { pages: [{ missing: true, title: 'блокчеин' }] } });
    }
    return jsonRes({ query: { search: [{ title: 'Блокчейн', pageid: 10 }] } });
  };
  try {
    const r = await findStartArticle('блокчеин', 'ru');
    assert.equal(r.exact, false);
    assert.equal(r.needsChoice, true);
    assert.equal(r.alternatives[0].title, 'Блокчейн');
  } finally { globalThis.fetch = orig; }
});

test('findStartArticle: пустой поиск — not_found', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => jsonRes({ query: { pages: [{ missing: true, title: 'zzz' }], search: [] } });
  try {
    await findStartArticle('zzzxyz', 'ru');
    assert.fail('expected throw');
  } catch (e) {
    assert.equal(e.code, 'not_found');
  } finally { globalThis.fetch = orig; }
});

test('getLeadCandidates: при <12 ссылок идёт запас parse links', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('prop=text')) {
      return jsonRes({ parse: { text: '<div class="mw-parser-output"><p><a href="/wiki/A" title="A">A</a></p></div>' } });
    }
    if (u.includes('prop=links') && u.includes('action=parse')) {
      const links = [];
      for (let i = 0; i < 15; i++) links.push({ ns: 0, title: 'C' + i, exists: true });
      return jsonRes({ parse: { links } });
    }
    return jsonRes({ query: { pages: [{ links: [] }] } });
  };
  try {
    const r = await getLeadCandidates('Start', 'en');
    assert.ok(r.titles.length >= 12);
    assert.equal(r.narrow, true);
    assert.equal(r.source, 'parse_links');
    assert.ok(r.titles.some(t => t.title === 'A'));
  } finally { globalThis.fetch = orig; }
});

test('getCandidateData: батч, фильтр списка, id', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = decodeURIComponent(String(url));
    return jsonRes({
      query: {
        pages: [
          { pageid: 1, title: 'Блокчейн', extract: 'цепочка', description: 'реестр', pageviews: { d: 100 } },
          { pageid: 2, title: 'Список протоколов', extract: 'список', description: 'список', pageviews: { d: 9 } },
          { pageid: 3, title: 'Криптография', extract: 'наука', description: 'шифрование', pageviews: { d: 50 } },
          { pageid: 4, title: '2020 год', extract: 'год', description: 'год' },
          { pageid: 5, title: 'Хеш', missing: true },
        ],
      },
    });
  };
  try {
    const out = await getCandidateData(
      [{ title: 'Криптография', lead_pos: 1 }, { title: 'Список протоколов', lead_pos: 2 }, { title: '2020 год', lead_pos: 3 }],
      'ru', 'Блокчейн',
    );
    assert.ok(out.every(c => c.id >= 1));
    assert.ok(out.some(c => c.is_start && c.title === 'Блокчейн'));
    assert.ok(!out.some(c => c.title.startsWith('Список')));
    assert.ok(!out.some(c => c.title === '2020 год'));
    assert.ok(out.some(c => c.title === 'Криптография'));
  } finally { globalThis.fetch = orig; }
});

function jsonRes(obj) {
  return {
    ok: true,
    status: 200,
    json: async () => obj,
  };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRoute } from '../src/route.js';

const cands = [
  { id: 1, title: 'A' },
  { id: 2, title: 'B' },
  { id: 3, title: 'C' },
  { id: 4, title: 'D' },
  { id: 5, title: 'E' },
];

test('выдуманный id отбрасывается, дубли убираются, текст как есть', () => {
  const raw = [
    { id: 2, why: 'w2', you_will_understand: 'u2' },
    { id: 99, why: 'fake', you_will_understand: 'no' },
    { id: 2, why: 'dup', you_will_understand: 'dup' },
    { id: 1, why: 'w1', you_will_understand: 'u1' },
  ];
  const v = validateRoute(raw, cands);
  assert.deepEqual(v.map(x => x.id), [2, 1]);
  assert.equal(v[0].why, 'w2');
});

test('пустой/битый ответ → []', () => {
  assert.deepEqual(validateRoute(null, cands), []);
  assert.deepEqual(validateRoute([{ id: 'nope' }], cands), []);
});

test('requestValidRoute: <4 валидных id → повтор → too_few', async () => {
  const { requestValidRoute } = await import('../src/route.js');
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => {
    n++;
    return {
      ok: true, status: 200,
      json: async () => ({ mode: 'llm', route: [{ id: 1, why: 'a', you_will_understand: 'b' }] }),
    };
  };
  try {
    await requestValidRoute({ topic: 't' }, cands, { workerUrl: 'http://w.example' });
    assert.fail('should throw');
  } catch (e) {
    assert.equal(e.code, 'too_few');
    assert.equal(n, 2);
  } finally {
    globalThis.fetch = orig;
  }
});

test('requestValidRoute: 503 quota сразу, без повтора', async () => {
  const { requestValidRoute } = await import('../src/route.js');
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => {
    n++;
    return { ok: false, status: 503, json: async () => ({ error: 'quota' }) };
  };
  try {
    await requestValidRoute({ topic: 't' }, cands, { workerUrl: 'http://w.example' });
    assert.fail('should throw');
  } catch (e) {
    assert.equal(e.code, 'quota');
    assert.equal(n, 1);
  } finally {
    globalThis.fetch = orig;
  }
});

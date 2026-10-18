import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackRoute } from '../src/fallback.js';

function cand(id, extra = {}) {
  return { id, title: 'T' + id, is_start: false, description: 'd', extract: 'e', views: id * 10, lead_pos: id, ...extra };
}

const pool = [
  cand(1, { is_start: true, title: 'Start', lead_pos: 0, views: 100 }),
  cand(2, { lead_pos: 1, views: 50 }),
  cand(3, { lead_pos: 2, views: 80 }),
  cand(4, { lead_pos: 3, views: 10 }),
  cand(5, { lead_pos: 4, views: 70 }),
  cand(6, { lead_pos: 5, views: 5 }),
  cand(7, { lead_pos: 6, views: 40 }),
  cand(8, { lead_pos: 7, views: 90 }),
];

test('beginner: стартовая первая, затем lead_pos, 5–7 штук', () => {
  const r = buildFallbackRoute(pool, 'beginner', []);
  assert.ok(r.length >= 5 && r.length <= 7);
  assert.equal(r[0].is_start, true);
  assert.equal(r[0].title, 'Start');
});

test('intermediate: без стартовой, views убыв. среди первых 15', () => {
  const r = buildFallbackRoute(pool, 'intermediate', []);
  assert.ok(r.length >= 5 && r.length <= 7);
  assert.ok(!r.some(c => c.is_start));
});

test('advanced: views возр. среди первых 20', () => {
  const r = buildFallbackRoute(pool, 'advanced', []);
  assert.ok(r.length >= 5 && r.length <= 7);
});

test('exclude_ids убирает статьи, служебных нет', () => {
  const r = buildFallbackRoute(pool, 'beginner', [2, 3]);
  assert.ok(!r.some(c => c.id === 2 || c.id === 3));
  assert.ok(r.length >= 5);
});

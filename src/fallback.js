/**
 * fallback.js — упрощённый маршрут без LLM (п.6.5)
 * Работает полностью на клиенте, без сети.
 */

/**
 * @param {Array<{id:number,title:string,is_start:boolean,description:string,extract:string,views:number,lead_pos:number}>} candidates
 * @param {'beginner'|'intermediate'|'advanced'} level
 * @param {number[]} excludeIds
 * @returns {{id:number,title:string}[]}
 */
export function buildFallbackRoute(candidates, level, excludeIds = []) {
  const exclude = new Set(excludeIds);
  // 1. исключить служебные (переданы уже отфильтрованными, но на всякий)
  let pool = candidates.filter(c => !exclude.has(c.id));
  if (!pool.length) return [];

  // вспомогательные отсортированные
  const byLeadPos = [...pool].sort((a, b) => a.lead_pos - b.lead_pos || (b.views ?? 0) - (a.views ?? 0));
  const byViewsDesc = (arr) => [...arr].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const byViewsAsc = (arr) => [...arr].sort((a, b) => (a.views ?? 0) - (b.views ?? 0));

  let picked = [];
  if (level === 'beginner') {
    const start = pool.find(c => c.is_start);
    if (start) picked.push(start);
    for (const c of byLeadPos) {
      if (picked.length >= 7) break;
      if (start && c.id === start.id) continue;
      picked.push(c);
    }
  } else if (level === 'intermediate') {
    // без стартовой, по views убыв. среди первых 15 по lead_pos
    const first15 = byLeadPos.slice(0, 15).filter(c => !c.is_start);
    // если кандидатов мало, берём что есть
    const source = first15.length ? first15 : byLeadPos.filter(c => !c.is_start);
    picked = byViewsDesc(source).slice(0, 7);
  } else {
    // advanced: по views возр. среди первых 20 по lead_pos
    const first20 = byLeadPos.slice(0, 20);
    picked = byViewsAsc(first20).slice(0, 7);
  }

  // взять 5-7
  if (picked.length > 7) picked = picked.slice(0, 7);
  if (picked.length < 5 && pool.length >= 5) {
    // добить по lead_pos если алгоритм дал <5
    const ids = new Set(picked.map(p => p.id));
    for (const c of byLeadPos) {
      if (picked.length >= 5) break;
      if (!ids.has(c.id)) picked.push(c);
    }
  }
  return picked.slice(0, 7);
}

/**
 * Текст-заглушка для карточки в упрощённом режиме
 */
export function fallbackCardText(candidate) {
  if (candidate.description) return candidate.description;
  if (candidate.extract) return candidate.extract.split('.').slice(0, 1).join('.') + '.';
  return '';
}

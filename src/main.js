/**
 * main.js — связка этапов, состояние, отмена запросов (T0 каркас)
 * Полный флоу будет в T1–T5, здесь: валидация формы, состояния, мок smoke-проверки.
 */
import { setStatus, setLoading, showError, hideError, els, t } from './ui.js';
import { buildFallbackRoute } from './fallback.js';

// Глобальный AbortController для гонок запросов (п.8)
let currentCtrl = null;
let rebuildLeft = 3;
let lastCandidates = [];
let lastRouteIds = [];

function getLang() { return els.lang.value; }

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const topic = els.topic.value.trim();
  const lang = getLang();
  if (!topic) { showError(t(lang, 'not_found')); return; }
  if (topic.length > 100) { showError(lang === 'en' ? 'Topic too long (max 100)' : 'Тема слишком длинная (макс. 100)'); return; }

  // отмена предыдущего
  if (currentCtrl) currentCtrl.abort();
  currentCtrl = new AbortController();
  const signal = currentCtrl.signal;

  rebuildLeft = 3;
  lastCandidates = [];
  lastRouteIds = [];

  setLoading(true);
  els.candidatesSection.hidden = true;
  els.routeSection.hidden = true;
  els.startConfirm && (els.startConfirm.hidden = true);

  try {
    setStatus(t(lang, 'looking_for_article'));
    // В T0 живой флоу ещё не реализован — показываем куда пойдёт запрос
    // Динамический импорт чтобы не падать если wiki.js ещё заглушка
    const wiki = await import('./wiki.js');
    // Попытаемся вызвать — в T0 бросит not implemented и уйдём в catch с понятным сообщением
    const start = await wiki.findStartArticle(topic, lang, signal);
    setStatus(t(lang, 'collecting_concepts'));
    const candidatesMeta = await wiki.getLeadCandidates(start.title, lang, signal);
    setStatus(t(lang, 'building_route'));
    const candidates = await wiki.getCandidateData(candidatesMeta.titles, lang, start.title, signal);
    lastCandidates = candidates;

    // Валидация N<5 по v4 п.13
    if (candidates.length < 5) {
      setStatus('');
      const { renderCandidates } = await import('./ui.js');
      renderCandidates(candidates, lang);
      const warn = document.getElementById('candidates-warn');
      warn.textContent = lang === 'en' ? 'Too few candidates — simplified route' : 'Слишком мало кандидатов — упрощённый маршрут';
      warn.hidden = false;
      // сразу fallback без LLM
      const level = els.level.value;
      const route = buildFallbackRoute(candidates, level, []);
      const { renderRoute } = await import('./ui.js');
      renderRoute(route.map(c => ({ id: c.id, why: '', you_will_understand: '' })), candidates, lang, 'simplified');
      setStatus('');
      return;
    }

    // Попытка LLM
    const { requestRoute, validateRoute } = await import('./route.js');
    const level = els.level.value;
    const payload = {
      topic, level, lang,
      candidates: candidates.map(c => ({
        id: c.id, title: c.title, is_start: !!c.is_start,
        description: (c.description || '').slice(0, 120),
        extract: (c.extract || '').slice(0, 250),
        views: c.views || 0, lead_pos: c.lead_pos || 0,
      })),
      exclude_ids: [],
    };
    try {
      const res = await requestRoute(payload, { signal, workerUrl: window.__WORKER_URL__ || localStorage.getItem('worker_url') || '' });
      const valid = validateRoute(res.route, candidates);
      if (valid.length < 4) throw Object.assign(new Error('too_few'), { code: 'too_few' });
      const { renderRoute, updateRebuildButton } = await import('./ui.js');
      renderRoute(valid, candidates, lang, res.mode || 'llm');
      lastRouteIds = valid.map(v => v.id);
      updateRebuildButton(rebuildLeft, candidates.length, valid.length);
    } catch (err) {
      if (err.code === 'quota' || err.code === 'unavailable' || err.code === 'no_worker' || err.code === 'too_few') {
        const level2 = els.level.value;
        const fb = buildFallbackRoute(candidates, level2, []);
        const { renderRoute } = await import('./ui.js');
        renderRoute(fb.map(c => ({ id: c.id, why: '', you_will_understand: '' })), candidates, lang, 'simplified');
        if (err.code === 'no_worker') setStatus(lang === 'en' ? 'Worker not yet deployed — simplified route shown' : 'Worker ещё не задеплоен — показан упрощённый маршрут');
      } else if (err.code === 'rate_limited') {
        showError(t(lang, 'rate_limited'));
      } else throw err;
    }
    setStatus('');
  } catch (err) {
    if (err.name === 'AbortError') return; // устаревший запрос
    // В T0 ожидаем not implemented — показываем дружелюбно
    if (String(err.message).includes('not implemented')) {
      setStatus('');
      showError(getLang() === 'en'
        ? 'T0 scaffold: Wikipedia flow will be implemented in T1–T2. Run scripts/smoke.mjs locally to collect fixtures.'
        : 'Каркас T0: логика Википедии появится в T1–T2. Запустите scripts/smoke.mjs локально чтобы собрать фикстуры.');
      return;
    }
    console.error(err);
    showError(err.message || t(getLang(), 'unavailable'));
    setStatus('');
  } finally {
    setLoading(false);
  }
});

els.rebuildBtn?.addEventListener('click', async () => {
  if (rebuildLeft <= 0 || !lastCandidates.length) return;
  const lang = getLang();
  const level = els.level.value;
  const signal = currentCtrl?.signal;
  rebuildLeft--;
  try {
    const { requestRoute, validateRoute } = await import('./route.js');
    const payload = {
      topic: els.topic.value.trim(), level, lang,
      candidates: lastCandidates.map(c => ({ id: c.id, title: c.title, is_start: !!c.is_start, description: (c.description||'').slice(0,120), extract:(c.extract||'').slice(0,250), views:c.views||0, lead_pos:c.lead_pos||0 })),
      exclude_ids: lastRouteIds,
    };
    const res = await requestRoute(payload, { signal, workerUrl: window.__WORKER_URL__ || localStorage.getItem('worker_url') || '' });
    const valid = validateRoute(res.route, lastCandidates);
    const { renderRoute, updateRebuildButton } = await import('./ui.js');
    renderRoute(valid, lastCandidates, lang, res.mode || 'llm');
    lastRouteIds = valid.map(v=>v.id);
    updateRebuildButton(rebuildLeft, lastCandidates.length, valid.length);
  } catch (err) {
    if (err.code === 'quota' || err.code === 'unavailable') {
      const fb = buildFallbackRoute(lastCandidates, level, lastRouteIds);
      const { renderRoute } = await import('./ui.js');
      renderRoute(fb.map(c=>({id:c.id,why:'',you_will_understand:''})), lastCandidates, lang, 'simplified');
    } else showError(err.message);
  }
});

els.retryBtn?.addEventListener('click', () => {
  hideError();
  els.form.requestSubmit();
});

// Подсказка языка по кириллице (не переключает, только подсказывает — п.7)
els.topic.addEventListener('input', () => {
  const v = els.topic.value;
  const hasCyr = /[а-яё]/i.test(v);
  const hasLat = /[a-z]/i.test(v);
  if (hasCyr && !hasLat && els.lang.value !== 'ru') {
    els.topic.title = 'Похоже, тема на русском — выбран ru, но вы можете сменить язык';
  } else if (!hasCyr && hasLat && els.lang.value !== 'en') {
    els.topic.title = 'Looks like English — en is not selected';
  } else els.topic.title = '';
});

// Dev: Worker URL из localStorage
if (localStorage.getItem('worker_url')) window.__WORKER_URL__ = localStorage.getItem('worker_url');

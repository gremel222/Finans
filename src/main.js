/**
 * main.js — связка этапов T1–T5
 * Точное совпадение → сразу строим + «Не то?»; поиск/значения → ждём выбор.
 * N<5 → упрощённый без LLM; 5≤N<8 → LLM + предупреждение.
 */
import {
  setStatus, setLoading, showError, hideError, els, t,
  getLang, getLevel, setLang, showLangHint,
  renderCandidates, renderRoute, updateRebuildButton,
  showStartConfirm, hideStartConfirm,
} from './ui.js';
import { buildFallbackRoute } from './fallback.js';
import { requestValidRoute } from './route.js';
import * as wiki from './wiki.js';

let currentCtrl = null;
let runId = 0;
let rebuildLeft = 3;
let lastCandidates = [];
let lastRouteIds = [];
let lastTopic = '';

function workerUrl() {
  return (typeof window !== 'undefined' && (window.__WORKER_URL__ || localStorage.getItem('worker_url'))) || '';
}

async function onceOrRetry(fn, signal, lang) {
  try {
    return await fn();
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e.name === 'TimeoutError') {
      setStatus(t(lang, 'retrying'));
      return await fn();
    }
    throw e;
  }
}

function makePayload(topic, lang, candidates, excludeIds) {
  return {
    topic, level: getLevel(), lang,
    candidates: candidates.map(c => ({
      id: c.id, title: c.title, is_start: !!c.is_start,
      description: (c.description || '').slice(0, 120),
      extract: (c.extract || '').slice(0, 250),
      views: c.views || 0, lead_pos: c.lead_pos || 0,
    })),
    exclude_ids: excludeIds || [],
  };
}

function showSimplified(candidates, lang, excludeIds, extraStatus) {
  const fb = buildFallbackRoute(candidates, getLevel(), excludeIds || []);
  renderRoute(fb.map(c => ({ id: c.id, why: '', you_will_understand: '' })), candidates, lang, 'simplified');
  lastRouteIds = fb.map(c => c.id);
  updateRebuildButton(rebuildLeft, candidates.length, fb.length);
  if (extraStatus) setStatus(extraStatus);
}

async function pipelineFromTitle({ title, topic, lang, signal, alternatives }) {
  showStartConfirm(title, alternatives, (chosen) => {
    if (chosen === title) return;
    void runFromChoice(chosen, topic, lang, alternatives);
  }, topic);

  setStatus(t(lang, 'collecting_concepts'));
  const lead = await onceOrRetry(() => wiki.getLeadCandidates(title, lang, signal), signal, lang);
  if (signal.aborted) return;

  setStatus(t(lang, 'building_route'));
  const candidates = await onceOrRetry(() => wiki.getCandidateData(lead.titles, lang, title, signal), signal, lang);
  if (signal.aborted) return;

  lastCandidates = candidates;
  lastTopic = topic;
  renderCandidates(candidates, lang);

  if (els.candidatesWarn) {
    if (candidates.length < 5) {
      els.candidatesWarn.textContent = t(lang, 'too_few_note');
      els.candidatesWarn.hidden = false;
    } else if (candidates.length < 8 || lead.narrow) {
      els.candidatesWarn.textContent = t(lang, 'narrow_topic');
      els.candidatesWarn.hidden = false;
    } else {
      els.candidatesWarn.hidden = true;
      els.candidatesWarn.textContent = '';
    }
  }

  if (candidates.length < 5) {
    showSimplified(candidates, lang, []);
    setStatus('');
    return;
  }

  try {
    const res = await requestValidRoute(
      makePayload(topic, lang, candidates, []),
      candidates,
      { signal, workerUrl: workerUrl() },
    );
    if (signal.aborted) return;
    renderRoute(res.route, candidates, lang, res.mode || 'llm');
    lastRouteIds = res.route.map(v => v.id);
    updateRebuildButton(rebuildLeft, candidates.length, res.route.length);
    if (res.route.length < 5) {
      els.routeNote.textContent = `${t(lang, 'found_n')} ${res.route.length}`;
    } else {
      els.routeNote.textContent = '';
    }
  } catch (err) {
    if (signal.aborted) return;
    if (err.code === 'quota' || err.code === 'unavailable' || err.code === 'no_worker' || err.code === 'too_few') {
      const msg = err.code === 'no_worker'
        ? (lang === 'en' ? 'Worker not deployed — simplified route' : 'Worker ещё не задеплоен — упрощённый маршрут')
        : '';
      showSimplified(candidates, lang, [], msg);
    } else if (err.code === 'rate_limited') {
      showError(t(lang, 'rate_limited'));
    } else throw err;
  }
  setStatus('');
}

function handleError(err, lang, signal) {
  if (signal?.aborted || err.name === 'AbortError') return;
  setStatus('');
  if (err.code === 'not_found') { showError(t(lang, 'not_found')); return; }
  if (err.name === 'TimeoutError') { showError(t(lang, 'timeout')); return; }
  if (/fetch|network|Failed/i.test(String(err.message || ''))) { showError(t(lang, 'network')); return; }
  console.error(err);
  showError(err.message || t(lang, 'unavailable'));
}

async function runFromChoice(chosen, topic, lang, alternatives) {
  if (currentCtrl) currentCtrl.abort();
  currentCtrl = new AbortController();
  const signal = currentCtrl.signal;
  const my = ++runId;
  rebuildLeft = 3;
  lastCandidates = [];
  lastRouteIds = [];
  hideError();
  setLoading(true);
  els.candidatesSection.hidden = true;
  els.routeSection.hidden = true;
  try {
    await pipelineFromTitle({ title: chosen, topic, lang, signal, alternatives });
  } catch (err) {
    if (my !== runId) return;
    handleError(err, lang, signal);
  } finally {
    if (my === runId) setLoading(false);
  }
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const topic = els.topic.value.trim();
  const lang = getLang();
  if (!topic) { showError(t(lang, 'not_found')); return; }
  if (topic.length > 100) { showError(lang === 'en' ? 'Topic too long (max 100)' : 'Тема слишком длинная (макс. 100)'); return; }

  if (currentCtrl) currentCtrl.abort();
  currentCtrl = new AbortController();
  const signal = currentCtrl.signal;
  const my = ++runId;

  rebuildLeft = 3;
  lastCandidates = [];
  lastRouteIds = [];
  lastTopic = topic;

  setLoading(true);
  els.candidatesSection.hidden = true;
  els.routeSection.hidden = true;
  hideStartConfirm();

  try {
    setStatus(t(lang, 'looking_for_article'));
    const start = await onceOrRetry(() => wiki.findStartArticle(topic, lang, signal), signal, lang);
    if (my !== runId || signal.aborted) return;

    if (start.needsChoice) {
      setLoading(false);
      setStatus('');
      showStartConfirm(null, start.alternatives, (chosen) => {
        void runFromChoice(chosen, topic, lang, start.alternatives);
      }, topic);
      return;
    }

    await pipelineFromTitle({
      title: start.title, topic, lang, signal,
      alternatives: start.alternatives,
    });
  } catch (err) {
    if (my !== runId) return;
    handleError(err, lang, signal);
  } finally {
    if (my === runId) setLoading(false);
  }
});

els.rebuildBtn?.addEventListener('click', async () => {
  if (rebuildLeft <= 0 || !lastCandidates.length) return;
  const lang = getLang();
  const signal = currentCtrl?.signal;
  rebuildLeft--;
  try {
    const res = await requestValidRoute(
      makePayload(lastTopic || els.topic.value.trim(), lang, lastCandidates, lastRouteIds),
      lastCandidates,
      { signal, workerUrl: workerUrl() },
    );
    renderRoute(res.route, lastCandidates, lang, res.mode || 'llm');
    lastRouteIds = res.route.map(v => v.id);
    updateRebuildButton(rebuildLeft, lastCandidates.length, res.route.length);
  } catch (err) {
    if (err.code === 'quota' || err.code === 'unavailable' || err.code === 'no_worker' || err.code === 'too_few') {
      showSimplified(lastCandidates, lang, lastRouteIds);
    } else if (err.code === 'rate_limited') showError(t(lang, 'rate_limited'));
    else showError(err.message);
  }
});

els.retryBtn?.addEventListener('click', () => {
  hideError();
  els.form.requestSubmit();
});

function refreshLangHint() {
  const v = els.topic.value;
  const hasCyr = /[а-яё]/i.test(v);
  const hasLat = /[a-z]/i.test(v);
  const lang = getLang();
  if (hasCyr && !hasLat && lang !== 'ru') showLangHint('to_ru');
  else if (!hasCyr && hasLat && lang !== 'en') showLangHint('to_en');
  else showLangHint(null);
}

els.topic.addEventListener('input', refreshLangHint);
for (const radio of document.querySelectorAll('#route-form input[name="lang"]')) {
  radio.addEventListener('change', refreshLangHint);
}
els.langHintBtn?.addEventListener('click', () => {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  showLangHint(null);
});

if (typeof localStorage !== 'undefined' && localStorage.getItem('worker_url')) {
  window.__WORKER_URL__ = localStorage.getItem('worker_url');
}

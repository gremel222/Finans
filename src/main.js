/**
 * main.js — поиск в Википедии и маршрут по правилам (без Cloudflare / ИИ)
 * Точное совпадение → сразу строим + «Не то?»; поиск/значения → ждём выбор.
 */
import {
  setStatus, setLoading, showError, hideError, els, t,
  getLang, getLevel, setLang, showLangHint,
  renderCandidates, renderRoute, updateRebuildButton,
  showStartConfirm, hideStartConfirm,
} from './ui.js';
import { buildFallbackRoute } from './fallback.js';
import * as wiki from './wiki.js';

let currentCtrl = null;
let runId = 0;
let rebuildLeft = 3;
let lastCandidates = [];
let lastRouteIds = [];

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

function showRoute(candidates, lang, excludeIds) {
  const fb = buildFallbackRoute(candidates, getLevel(), excludeIds || []);
  renderRoute(fb.map(c => ({ id: c.id, why: '', you_will_understand: '' })), candidates, lang, 'simplified');
  lastRouteIds = fb.map(c => c.id);
  updateRebuildButton(rebuildLeft, candidates.length, fb.length);
  if (els.routeNote) {
    els.routeNote.textContent = fb.length < 5 ? `${t(lang, 'found_n')} ${fb.length}` : '';
  }
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

  showRoute(candidates, lang, []);
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

els.rebuildBtn?.addEventListener('click', () => {
  if (rebuildLeft <= 0 || !lastCandidates.length) return;
  rebuildLeft--;
  showRoute(lastCandidates, getLang(), lastRouteIds);
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

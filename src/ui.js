/**
 * ui.js — рендер, статусы, баннеры
 */

export const els = {
  form: document.getElementById('route-form'),
  topic: document.getElementById('topic'),
  submitBtn: document.getElementById('submit-btn'),
  rebuildBtn: document.getElementById('rebuild-btn'),
  rebuildLeft: document.getElementById('rebuild-left'),
  status: document.getElementById('status'),
  startConfirm: document.getElementById('start-confirm'),
  startFoundText: document.getElementById('start-found-text'),
  startAlternatives: document.getElementById('start-alternatives'),
  candidatesSection: document.getElementById('candidates-section'),
  candidatesCount: document.getElementById('candidates-count'),
  candidatesWarn: document.getElementById('candidates-warn'),
  candidatesList: document.getElementById('candidates-list'),
  routeSection: document.getElementById('route-section'),
  routeBanner: document.getElementById('route-banner'),
  routeList: document.getElementById('route-list'),
  routeNote: document.getElementById('route-note'),
  errorSection: document.getElementById('error-section'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  previewSection: document.getElementById('preview-section'),
  langHint: document.getElementById('lang-hint'),
  langHintText: document.getElementById('lang-hint-text'),
  langHintBtn: document.getElementById('lang-hint-btn'),
};

const DICT = {
  ru: {
    looking_for_article: 'Ищу статью…',
    collecting_concepts: 'Собираю понятия из вступления…',
    building_route: 'Строю маршрут…',
    rate_limited: 'Слишком много запросов, попробуйте позже.',
    quota: 'ИИ сегодня недоступен, работает упрощённый режим.',
    unavailable: 'Сервис временно недоступен. Попробуйте ещё раз или используйте упрощённый режим.',
    not_found: 'Тема не найдена. Попробуйте другое написание или смените язык.',
    banner_llm: 'Режим: ИИ (основная модель)',
    banner_fallback: 'Режим: запасной ИИ',
    banner_simplified: 'Упрощённый режим: ИИ сегодня недоступен (лимит). Порядок подобран по правилам, без пояснений.',
    why: 'Зачем читать',
    understand: 'Что поймёшь',
    open_article: 'Открыть статью',
    found: 'Нашли',
    query: 'запрос',
    not_it: 'Не то?',
    lang_hint_ru: 'Тема похожа на русскую, а выбран English.',
    lang_hint_en: 'Looks like English, but Russian Wikipedia is selected.',
    lang_hint_btn: 'Искать на другом языке?',
    pick_article: 'Выберите статью:',
    narrow_topic: 'Тема узкая, маршрут может быть короче.',
    retrying: 'Повторяю запрос…',
    timeout: 'Википедия не ответила за 8 секунд. Нажмите «Повторить».',
    network: 'Нет связи с Википедией. Проверьте интернет и нажмите «Повторить».',
    too_few_note: 'Найдено меньше 5 статей — упрощённый маршрут.',
    found_n: 'найдено статей:',
  },
  en: {
    looking_for_article: 'Looking for article…',
    collecting_concepts: 'Collecting concepts from lead…',
    building_route: 'Building route…',
    rate_limited: 'Too many requests, try again later.',
    quota: 'AI is unavailable today, simplified mode is active.',
    unavailable: 'Service temporarily unavailable. Try again or use simplified mode.',
    not_found: 'Topic not found. Try another spelling or switch language.',
    banner_llm: 'Mode: AI (primary)',
    banner_fallback: 'Mode: AI fallback',
    banner_simplified: 'Simplified mode: AI unavailable today (quota). Order is heuristic, without explanations.',
    why: 'Why read',
    understand: 'You will understand',
    open_article: 'Open article',
    found: 'Found',
    query: 'query',
    not_it: 'Not it?',
    lang_hint_ru: 'Тема похожа на русскую, а выбран English.',
    lang_hint_en: 'Looks like English, but Russian Wikipedia is selected.',
    lang_hint_btn: 'Search on other language?',
    pick_article: 'Pick an article:',
    narrow_topic: 'Narrow topic — the route may be shorter.',
    retrying: 'Retrying…',
    timeout: 'Wikipedia did not respond in 8 seconds. Press Retry.',
    network: 'Cannot reach Wikipedia. Check the network and press Retry.',
    too_few_note: 'Fewer than 5 articles — simplified route.',
    found_n: 'articles found:',
  },
};

export function t(lang, key) {
  return (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
}

export function getLang() {
  const el = document.querySelector('#route-form input[name="lang"]:checked');
  return el ? el.value : 'ru';
}

export function getLevel() {
  const el = document.querySelector('#route-form input[name="level"]:checked');
  return el ? el.value : 'beginner';
}

export function setLang(lang) {
  const el = document.querySelector(`#route-form input[name="lang"][value="${lang}"]`);
  if (el) el.checked = true;
}

export function setStatus(text) {
  els.status.textContent = text || '';
}

export function showError(msg) {
  els.errorText.textContent = msg;
  els.errorSection.hidden = false;
  els.errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
export function hideError() {
  els.errorSection.hidden = true;
  els.errorText.textContent = '';
}

export function setLoading(isLoading) {
  els.submitBtn.disabled = isLoading;
  els.topic.disabled = isLoading;
  els.submitBtn.classList.toggle('is-loading', isLoading);
  els.submitBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  document.body.classList.toggle('is-loading', isLoading);
}

function wikiUrl(lang, title) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function renderCandidates(candidates, lang) {
  els.candidatesList.innerHTML = '';
  for (const c of candidates) {
    const li = document.createElement('li');
    li.className = 'cand-item';
    const a = document.createElement('a');
    a.className = 'cand-title';
    a.href = wikiUrl(lang, c.title);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = c.title;
    const meta = document.createElement('small');
    meta.className = 'cand-desc';
    meta.textContent = c.description || c.extract?.slice(0, 80) || '';
    li.append(a, meta);
    els.candidatesList.appendChild(li);
  }
  els.candidatesCount.textContent = `— ${candidates.length}`;
  els.candidatesSection.hidden = false;
}

export function renderRoute(routeItems, candidates, lang, mode) {
  if (els.previewSection) els.previewSection.hidden = true;
  const byId = new Map(candidates.map(c => [c.id, c]));
  els.routeList.innerHTML = '';
  for (let i = 0; i < routeItems.length; i++) {
    const r = routeItems[i];
    const c = byId.get(r.id);
    if (!c) continue;
    const url = wikiUrl(lang, c.title);

    const li = document.createElement('li');
    li.className = 'route-card';

    const num = document.createElement('div');
    num.className = 'route-num';
    num.textContent = String(i + 1);

    const body = document.createElement('div');
    body.className = 'route-body';

    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = c.title;
    h3.appendChild(a);
    body.appendChild(h3);

    if (mode !== 'simplified' && r.why) {
      const why = document.createElement('p');
      why.className = 'route-why';
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = t(lang, 'why');
      why.append(k, document.createTextNode(r.why));
      body.appendChild(why);
    } else {
      const desc = document.createElement('p');
      desc.textContent = c.description || c.extract || '';
      body.appendChild(desc);
    }
    if (mode !== 'simplified' && r.you_will_understand) {
      const yu = document.createElement('p');
      yu.className = 'route-learn';
      const k2 = document.createElement('span');
      k2.className = 'k';
      k2.textContent = t(lang, 'understand');
      yu.append(k2, document.createTextNode(r.you_will_understand));
      body.appendChild(yu);
    }

    const open = document.createElement('a');
    open.className = 'route-open';
    open.href = url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = t(lang, 'open_article');
    body.appendChild(open);

    li.append(num, body);
    els.routeList.appendChild(li);
  }

  let bannerText = '';
  let bannerClass = 'banner';
  if (mode === 'llm') bannerText = t(lang, 'banner_llm');
  else if (mode === 'llm_fallback') bannerText = t(lang, 'banner_fallback');
  else if (mode === 'simplified') { bannerText = t(lang, 'banner_simplified'); bannerClass = 'banner warn'; }
  if (bannerText) {
    els.routeBanner.textContent = 'ⓘ ' + bannerText;
    els.routeBanner.className = bannerClass;
    els.routeBanner.hidden = false;
  } else {
    els.routeBanner.hidden = true;
  }

  els.routeSection.hidden = false;
  els.routeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function showStartConfirm(foundTitle, alternatives, onSelect, query) {
  const lang = getLang();
  if (foundTitle) {
    const q = query ? ` (${t(lang, 'query')}: ${query})` : '';
    els.startFoundText.textContent = `${t(lang, 'found')}: ${foundTitle}${q}. ${t(lang, 'not_it')}`;
  } else {
    els.startFoundText.textContent = t(lang, 'pick_article');
  }
  els.startAlternatives.innerHTML = '';
  for (const alt of alternatives || []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = alt.title;
    if (foundTitle && alt.title === foundTitle) btn.setAttribute('aria-current', 'true');
    btn.addEventListener('click', () => onSelect(alt.title));
    els.startAlternatives.appendChild(btn);
  }
  els.startConfirm.hidden = false;
}
export function hideStartConfirm() { els.startConfirm.hidden = true; }

export function updateRebuildButton(left, totalCandidates, routeLen) {
  const canRebuild = left > 0 && (totalCandidates - routeLen) >= 5;
  els.rebuildBtn.hidden = false;
  if (els.rebuildLeft) els.rebuildLeft.textContent = String(left);
  els.rebuildBtn.disabled = !canRebuild;
  if (!canRebuild && left <= 0) els.rebuildBtn.title = 'Других статей по теме не найдено';
}

export function showLangHint(kind) {
  if (!els.langHint) return;
  if (!kind) {
    els.langHint.hidden = true;
    return;
  }
  const lang = getLang();
  els.langHintText.textContent = kind === 'to_ru' ? t(lang, 'lang_hint_ru') : t(lang, 'lang_hint_en');
  if (els.langHintBtn) els.langHintBtn.textContent = t(lang, 'lang_hint_btn');
  els.langHint.hidden = false;
}

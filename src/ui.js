/**
 * ui.js — рендер, статусы, баннеры
 */

export const els = {
  form: document.getElementById('route-form'),
  topic: document.getElementById('topic'),
  level: document.getElementById('level'),
  lang: document.getElementById('lang'),
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
  },
};

export function t(lang, key) {
  return (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
}

export function setStatus(text) {
  els.status.textContent = text || '';
}

export function showError(msg) {
  els.errorText.textContent = msg;
  els.errorSection.hidden = false;
}
export function hideError() {
  els.errorSection.hidden = true;
  els.errorText.textContent = '';
}

export function setLoading(isLoading) {
  els.submitBtn.disabled = isLoading;
  els.topic.disabled = isLoading;
  // level/lang блокировать не нужно жёстко, но при гонке они отменят запрос
}

export function renderCandidates(candidates, lang) {
  els.candidatesList.innerHTML = '';
  for (const c of candidates) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = c.title;
    const meta = document.createElement('small');
    meta.textContent = c.description || c.extract?.slice(0, 80) || '';
    li.append(a, meta);
    els.candidatesList.appendChild(li);
  }
  els.candidatesCount.textContent = `— ${candidates.length}`;
  els.candidatesSection.hidden = false;
}

export function renderRoute(routeItems, candidates, lang, mode) {
  const byId = new Map(candidates.map(c => [c.id, c]));
  els.routeList.innerHTML = '';
  for (let i = 0; i < routeItems.length; i++) {
    const r = routeItems[i];
    const c = byId.get(r.id);
    if (!c) continue;
    const li = document.createElement('li');
    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `${i + 1}. ${c.title}`;
    h3.appendChild(a);
    li.appendChild(h3);
    if (mode !== 'simplified' && r.why) {
      const why = document.createElement('p');
      const b = document.createElement('strong');
      b.textContent = lang === 'en' ? 'Why read: ' : 'Зачем читать: ';
      why.append(b, document.createTextNode(r.why));
      li.appendChild(why);
    } else {
      const desc = document.createElement('p');
      desc.textContent = c.description || c.extract || '';
      li.appendChild(desc);
    }
    if (mode !== 'simplified' && r.you_will_understand) {
      const yu = document.createElement('p');
      const b2 = document.createElement('strong');
      b2.textContent = lang === 'en' ? 'You will understand: ' : 'Что поймёшь: ';
      yu.append(b2, document.createTextNode(r.you_will_understand));
      li.appendChild(yu);
    }
    els.routeList.appendChild(li);
  }

  // баннер режима
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
}

export function showStartConfirm(foundTitle, alternatives, onSelect) {
  els.startFoundText.textContent = `Нашли статью: ${foundTitle}. Не то?`;
  els.startAlternatives.innerHTML = '';
  for (const alt of alternatives) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = alt.title;
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

# Прогресс

## T0 — Каркас и проверка среды (в работе)

**Что сделано (2026-10-18):**
- Структура по п.9 SPEC: `index.html`, `style.css`, `src/{main,wiki,route,fallback,ui}.js`, `worker/{src/index,src/config,src/providers/*,wrangler.toml}`, `scripts/{smoke,bakeoff}.mjs`, `tests/fixtures/`, `SPEC.md` с поправками v4, `docs/progress.md`.
- Поправки v4 внесены: сортировка по `lead_pos` (п.12), Origin без пути (п.2), N<5 без LLM (п.13), лимит перестроений 3 (п.21), белый список хостов в прокси (п.10), коды ошибок Worker (п.23), проверка KV-лимитов (п.17).
- `worker/src/config.js` — единый конфиг моделей/лимитов: `WORKERS_AI_MODEL`, `FALLBACK_MODELS`, `DAILY_LLM_CAP=100`, `IP_RATE_LIMIT=15`, `GEMINI_ENABLED=false`.
- `worker/src/index.js` — каркас `/route`: валидация входа, проверка Origin (схема+хост), rate-limit/daily-cap заглушки (in-memory до KV), `wrangler tail` логи без IP.
- `src/wiki.js` — `wikiFetch` с `Api-User-Agent`, TTL 24ч `sessionStorage`, ретраи 1/2/4с, таймаут 8с.
- `src/fallback.js` — алгоритм п.6.5 для всех уровней.
- `scripts/smoke.mjs` — реальные запросы п.5.1–5.3 по трём темам, сохраняет `tests/fixtures/ru|en-*.json` и печатает отчёт по `Api-User-Agent` и `prop=pageviews`.

**Как проверено:**
- `index.html` открывается локально (статика без сборки), форма валидирует `topic ≤100`.
- `node scripts/smoke.mjs` — ждёт запуска человеком (интернет в среде агента закрыт, план Б по п.0).

**Отклонения от SPEC:**
- Репозиторий пока `Finans` — переименование в `wiki-navigator` делает человек (настройки GitHub + Pages). `Api-User-Agent` и `ALLOWED_ORIGINS` содержат плейсхолдер `<твой_логин>` до получения логина (п.1–2 ответов).
- Worker в T0 возвращает `503 quota` чтобы фронт показал упрощённый маршрут — LLM-цепочка появится в T4.

**Следующий шаг — T1** после получения от человека:
1. Логин GitHub для подстановки в `Api-User-Agent` и `wrangler.toml`.
2. Вывод `node scripts/smoke.mjs` + фикстуры `tests/fixtures/*.json` (приложить файлы).
3. Подтверждение тем из п.32 (или правки).

**Данные для T0 (нужны от владельца):**
- [ ] Логин GitHub: `...`
- [ ] Логи `smoke.mjs` + 3 файла фикстур
- [ ] Темы T4b/T7: утвержден список из 10+3 стресс или правки

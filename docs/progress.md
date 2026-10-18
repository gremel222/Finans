# Прогресс

## T0 — Каркас и проверка среды (в работе, ждёт фикстур)

**Что сделано (2026-10-18):**
- Структура по п.9 SPEC: `index.html`, `style.css`, `src/{main,wiki,route,fallback,ui}.js`, `worker/{src/index,src/config,src/providers/*,wrangler.toml}`, `scripts/{smoke,bakeoff}.mjs`, `tests/fixtures/`, `SPEC.md` с поправками v4, `docs/progress.md`.
- Поправки v4 внесены: сортировка по `lead_pos` (п.12), Origin без пути (п.2), N<5 без LLM (п.13), лимит перестроений 3 (п.21), белый список хостов в прокси (п.10), коды ошибок Worker (п.23), проверка KV-лимитов (п.17).
- `worker/src/config.js` — единый конфиг моделей/лимитов: `WORKERS_AI_MODEL`, `FALLBACK_MODELS`, `DAILY_LLM_CAP=100`, `IP_RATE_LIMIT=15`, `GEMINI_ENABLED=false`.
- `worker/src/index.js` — каркас `/route`: валидация входа, проверка Origin (схема+хост), rate-limit/daily-cap заглушки (in-memory до KV), `wrangler tail` логи без IP.
- `src/wiki.js` — `wikiFetch` с `Api-User-Agent`, TTL 24ч `sessionStorage`, ретраи 1/2/4с, таймаут 8с.
- `src/fallback.js` — алгоритм п.6.5 для всех уровней.
- `scripts/smoke.mjs` — реальные запросы п.5.1–5.3 по трём темам, сохраняет `tests/fixtures/ru|en-*.json` и печатает отчёт по `Api-User-Agent`, `extracts`, `description`, `prop=pageviews`.
- Логин получен: **gremel222**. Подставлен в `src/wiki.js` и `scripts/smoke.mjs` (`Api-User-Agent: WikiNavigator/0.1 (https://github.com/gremel222/wiki-navigator)`), `worker/wrangler.toml` (`ALLOWED_ORIGINS = "https://gremel222.github.io"`), `README.md`.

**Как проверено:**
- `node --check` всех модулей — ок; `index.html` открывается локально (статика без сборки), форма валидирует `topic ≤100`.
- `node scripts/smoke.mjs` в среде агента: все запросы падают с `fetch failed (ECONNRESET)` — исходящий доступ к `*.wikipedia.org` закрыт, скрипт **не создаёт файлов** и завершается с кодом 1. Это ожидаемо (план Б по п.0): живой прогон делает человек.
- Код успешного пути `smoke.mjs` проверен на мок-ответах формы `formatversion=2` во временной папке (`/tmp`, не в репозитории): 5/5 шагов, отчёт печатается, файлы пишутся. Мок-данные в `tests/fixtures/` **не попадают**.

**Найденная и исправленная ошибка:**
- В первой версии `smoke.mjs` и `src/wiki.js` заголовок `Api-User-Agent` содержал кириллический плейсхолдер `<твой_логин>`. HTTP-заголовки допускают только ASCII, поэтому `fetch` падал ещё до выхода в сеть: `TypeError: Cannot convert argument to a ByteString`. Исправлено подстановкой логина; добавлена предварительная проверка ASCII в `smoke.mjs` с понятным сообщением, проверка версии Node (≥18), а фикстура теперь сохраняется только при наличии хотя бы одного реального ответа.

**Отклонения от SPEC:**
- Репозиторий пока называется `Finans` — переименование в `wiki-navigator` делает человек (GitHub → Settings → Repository name), иначе адрес Pages будет `gremel222.github.io/Finans/`. Origin (`https://gremel222.github.io`) от имени репозитория не зависит.
- Worker в T0 возвращает `503 quota`, чтобы фронт показал упрощённый маршрут — LLM-цепочка появится в T4.

**UI (без ожидания фикстур):** вёрстка переведена на mobile-first — iPhone (safe-area, 16px в полях, кнопки 48px), Android и ПК. Уровень/язык — сегменты вместо select; маршрут — таймлайн с крупной «Открыть статью»; на странице макет карточек, чтобы сразу видеть вид на телефоне.

**Следующий шаг — T1** после получения от человека:
1. ~~Логин GitHub~~ — получен (`gremel222`).
2. Вывод `node scripts/smoke.mjs` + фикстуры `tests/fixtures/*.json` (приложить файлы).
3. Подтверждение тем из п.32 (или правки).

**Данные для T0 (нужны от владельца):**
- [x] Логин GitHub: `gremel222`
- [ ] Вывод `smoke.mjs` + 3 файла фикстур
- [ ] Темы T4b/T7: утверждён список из 10+3 стресс или правки

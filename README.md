# Вики-навигатор знаний — MVP (бесплатная версия)

> Статический фронт на GitHub Pages + один Cloudflare Worker (`/route`) + бесплатные LLM (Workers AI). Никаких платных сервисов, карта не нужна.

## Статус
T1–T5 в коде: поиск статьи в Википедии, кандидаты из вступления, упрощённый маршрут без ИИ, вызов Worker `/route`. Живой LLM проверяет человек после `wrangler deploy` (см. T4 ниже). В браузере `Api-User-Agent` не ставится (CORS-preflight); идентификация — `origin=*`. Если Википедия начнёт отвечать 403/429 из браузера — перенести запросы в Worker (п.5.5).

Юнит-тесты (без сети): `node --test tests/*.test.mjs`

## Быстрый старт (локально)

1. Клонируй репо (после переименования в `wiki-navigator`):
   ```bash
   git clone https://github.com/gremel222/wiki-navigator.git
   cd wiki-navigator
   ```
2. Открой `index.html` в браузере напрямую или через сервер:
   ```bash
   npx serve .
   # или
   python3 -m http.server 8000
   ```
   Открой `http://localhost:8000`.

3. Для Worker (нужен Cloudflare, бесплатный план, карта не нужна):
   ```bash
   npm i -g wrangler
   wrangler login          # делает человек, браузерный логин
   cd worker
   wrangler dev            # локальный Worker на http://localhost:8787
   ```
   В `worker/wrangler.toml` уже `ALLOWED_ORIGINS = "https://gremel222.github.io"` (только схема+хост, без пути — поправка v4 п.2). `DEV=1` разрешает `localhost` только в dev.

## Ручные шаги человека (п.0 SPEC)

1. Аккаунт Cloudflare (free Workers, карта не нужна) + `wrangler login`. Для основной модели ключ не нужен — привязка `AI` в Worker.
2. Репозиторий GitHub `wiki-navigator` и включение Pages: Settings → Pages → Source = `main` branch (или `gh-pages`).
3. (Опционально, T4c, после MVP) ключ Google AI Studio: `wrangler secret put GEMINI_API_KEY` — вводит человек в своём терминале, в репо не попадает.

### Переименование репозитория `Finans` → `wiki-navigator`

Сейчас код лежит в репозитории `gremel222/Finans`. Чтобы адрес сайта был `https://gremel222.github.io/wiki-navigator/`, репозиторий нужно переименовать (это делается один раз, старые ссылки GitHub перенаправляет автоматически):

1. Открой `https://github.com/gremel222/Finans/settings`.
2. В самом верху, поле **Repository name** → сотри `Finans`, напиши `wiki-navigator` → кнопка **Rename**.
3. На своём компьютере (если репозиторий уже склонирован) обнови адрес:
   ```bash
   git remote set-url origin https://github.com/gremel222/wiki-navigator.git
   ```
   Ожидаемый результат: `git remote -v` показывает две строки с `wiki-navigator.git`.

`ALLOWED_ORIGINS` в `worker/wrangler.toml` от имени репозитория не зависит (`https://gremel222.github.io` — только схема+хост).

## Проверка доступа к Википедии — `scripts/smoke.mjs`

Среда агента не ходит в `*.wikipedia.org` (запросы падают с `ECONNRESET`). Поэтому живой тест делает человек на своём компьютере.

**Что нужно:** Node.js 18 или новее. Проверка: в терминале `node -v` → должно напечатать `v18.x.x` или больше. Если команда не найдена — скачай LTS с `https://nodejs.org`, установи, открой терминал заново.

**Запуск** (из папки репозитория):

```bash
node scripts/smoke.mjs
```

Скрипт делает запросы п.5.1–5.3 по темам «Блокчейн» (ru), «Quantum mechanics» (en), «Римская империя» (ru): точное совпадение, поиск топ-5, вступление (`parse` секции 0, текст и ссылки), батч `extracts|description|pageprops|pageviews`. Сырые ответы сохраняются в `tests/fixtures/ru-Блокчейн.json`, `tests/fixtures/en-Quantum_mechanics.json`, `tests/fixtures/ru-Римская_империя.json`. Фикстуры — только реальные: если по теме не пришло ни одного ответа, файл **не создаётся**.

**Ожидаемый вывод при успехе** (цифры будут другие):

```
WikiNavigator smoke — 3 тем, Node v22.x.x
Api-User-Agent: WikiNavigator/0.1 (https://github.com/gremel222/wiki-navigator)

→ ru: "Блокчейн" ...
  ✓ 5/5 шагов, сохранено tests/fixtures/ru-Блокчейн.json
    стартовая статья: Блокчейн; поиск топ-5: Блокчейн | ...
    вступление: html 12345 симв.; ссылок в секции 0: 40
    батч: страниц 20, extracts=true, descriptions=true, pageviews=true
...
--- Краткий отчёт ---
  ru "Блокчейн": ok pageviews=true extracts=true
  ...
```

**Что прислать агенту:** весь текст из терминала + три файла из `tests/fixtures/` (их можно просто закоммитить: `git add tests/fixtures && git commit -m "fixtures: smoke" && git push`). Без них T1–T2 нельзя считать проверенными на живом API. Юнит-тесты логики (`node --test`) живой API не заменяют.

## Проверка Worker (T4) — делает человек

После `wrangler login` из папки `worker`:

```bash
cd worker
npx wrangler dev
```

В другом терминале (подставьте свой origin, для локального dev в `wrangler.toml` временно `DEV = "1"`):

```bash
curl -s -D - -X POST http://localhost:8787/route \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8000" \
  -d '{"topic":"Блокчейн","level":"beginner","lang":"ru","exclude_ids":[],"candidates":[{"id":1,"title":"Блокчейн","is_start":true,"description":"реестр","extract":"цепочка блоков","views":1,"lead_pos":0},{"id":2,"title":"Криптография","is_start":false,"description":"шифрование","extract":"наука о шифрах","views":1,"lead_pos":1},{"id":3,"title":"Хеш","is_start":false,"description":"отпечаток","extract":"хеш-функция","views":1,"lead_pos":2},{"id":4,"title":"Ключ","is_start":false,"description":"секрет","extract":"ключ шифрования","views":1,"lead_pos":3},{"id":5,"title":"Сеть","is_start":false,"description":"узлы","extract":"одноранговая сеть","views":1,"lead_pos":4}]}'
```

Ожидание: `200` и JSON `{ "mode": "llm", "route": [ ... ] }` с id только из 1–5. `topic` длиннее 100 символов → `400`. Частые запросы → `429`. После исчерпания `DAILY_LLM_CAP` → `503 {"error":"quota"}`.

Чтобы фронт ходил в локальный Worker: в консоли браузера `localStorage.setItem('worker_url','http://localhost:8787')` и обновить страницу.

**Если что-то пошло не так:**

| Сообщение | Причина | Что делать |
|---|---|---|
| `node: command not found` / `не является внутренней командой` | Node.js не установлен | Установить с `https://nodejs.org` (LTS), перезапустить терминал |
| `✗ Нужен Node.js 18 или новее` | Старый Node | Обновить до LTS |
| `fetch failed (ENOTFOUND)` | Нет DNS/интернета | Проверить соединение, повторить |
| `fetch failed (ECONNRESET)` / `(ECONNREFUSED)` | Сеть/прокси/VPN блокирует `wikipedia.org` | Отключить VPN или наоборот включить, повторить |
| `timeout 8000 ms` на всех шагах | Очень медленная сеть | Повторить позже |
| `HTTP 403` | Википедия отклонила запрос (обычно из-за заголовка) | Прислать вывод агенту — это важный сигнал для п.10 (перенос запросов в Worker) |
| `! шаг batch: ...` при остальных `✓` | Частичный сбой | Нормально, файл сохранён; прислать как есть |
| `✗ API_USER_AGENT содержит не-ASCII символы` | В заголовок попала кириллица | Константа уже с логином `gremel222`; если правил — вернуть латиницу |

## Конфигурация моделей и лимитов

В `worker/src/config.js` (единственное место):

- `WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it'` — сверять по `npx wrangler ai models` или Workers AI → Pricing. При снятии — замена по порядку `qwen3-30b-a3b-fp8 → gpt-oss-120b → glm-4.7-flash` (запрещённые на free: `kimi-k2.6/k2.7-code, glm-5.x, deepseek-v4-*`).
- `DAILY_LLM_CAP = 100`, `IP_RATE_LIMIT = 15/час` — стартовые, после T4b пересчёт: `cap = floor(0.8 × 10000 / нейронов_на_маршрут)`. Пул сбрасывается в 00:00 UTC (10:00 по Владивостоку).
- `GEMINI_ENABLED = false` до T5 (заглушка провайдера).

## Лимиты бесплатного тарифа (проверить перед деплоем)

Перед стартом сверить по документации Cloudflare: запросы Workers в день, лимиты KV (около 1000 записей/сутки, не проверено — если мало, глобальный счётчик в Durable Object), лимиты Workers AI (нейроны/день). Записать фактические цифры сюда.

| Ресурс | Лимит free | Факт на дату |
|---|---|---|
| Workers AI нейроны | ~10000/день (уточнить) |  |
| Workers запросы | 100k/день (уточнить) |  |
| KV записи | ~1000/день (проверить) |  |

## Структура

```
index.html, style.css
src/main.js, wiki.js, route.js, fallback.js, ui.js
worker/src/index.js, config.js, providers/workersai.js, providers/gemini.js, wrangler.toml
scripts/smoke.mjs, bakeoff.mjs
tests/fixtures/
SPEC.md, docs/progress.md
```

## Ошибки и поведение

- `429 rate_limited` — «Слишком много запросов…»
- `503 quota` — «ИИ сегодня недоступен, работает упрощённый режим» (показывает эвристику по `lead_pos`/`views`)
- `503 unavailable` — повтор или упрощённый режим
- Таймаут каждого запроса 8с, один автоповтор.

## Деплой

Фронт: push в `main` → GitHub Pages (человек включает Pages по инструкции выше).
Бэк: `cd worker && wrangler deploy`.

## Ограничения MVP (п.11 SPEC)

- Маршрут только из ссылок вступления одной статьи (предпосылок вроде «линейная алгебра для квантмеха» может не быть).
- Сложность оценивается по краткому описанию, не по тексту статьи.
- Русская Википедия бедна по узким темам — для них лучше `en`.
- Бесплатный пул — десятки–сотни маршрутов/день, при исчерпании — упрощённый режим.
- Бесплатные модели меняются без предупреждения.

## Позже

Граф связей, сохранение маршрутов, «Поделиться» (hash с темой/языком/уровнем), Web Analytics.

## Лицензия данных

Данные: Википедия, CC BY-SA 4.0. Пояснения «сгенерировано ИИ».

## Что внести в ТЗ v4 (зафиксировано)

Сортировка по `lead_pos` при обрезке до 30, Origin без пути, N<5 без LLM, лимит перестроений 3, проверка KV-лимитов, белый список хостов в прокси, коды ошибок Worker вместо текстов.

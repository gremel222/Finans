# Вики-навигатор знаний — MVP (бесплатная версия)

> Статический фронт на GitHub Pages + один Cloudflare Worker (`/route`) + бесплатные LLM (Workers AI). Никаких платных сервисов, карта не нужна.

## Статус
T0 — каркас. Живой флоу Википедии — с T1. До получения реальных фикстур (`scripts/smoke.mjs`) фронт показывает заглушку.

## Быстрый старт (локально)

1. Клонируй репо (после переименования в `wiki-navigator`):
   ```bash
   git clone https://github.com/<твой_логин>/wiki-navigator.git
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
   В `worker/wrangler.toml` подставь `ALLOWED_ORIGINS = "https://<твой_логин>.github.io"` (только схема+хост, без пути — поправка v4 п.2). `DEV=1` разрешает `localhost` только в dev.

## Ручные шаги человека (п.0 SPEC)

1. Аккаунт Cloudflare (free Workers, карта не нужна) + `wrangler login`. Для основной модели ключ не нужен — привязка `AI` в Worker.
2. Репозиторий GitHub `wiki-navigator` и включение Pages: Settings → Pages → Source = `main` branch (или `gh-pages`).
3. (Опционально, T4c, после MVP) ключ Google AI Studio: `wrangler secret put GEMINI_API_KEY` — вводит человек в своём терминале, в репо не попадает.

## Проверка доступа к Википедии — `scripts/smoke.mjs`

Среда агента может не ходить в `*.wikipedia.org`. Поэтому живой тест делает человек:

```bash
node scripts/smoke.mjs
```

Скрипт делает запросы п.5.1–5.3 по темам «Блокчейн» (ru), «Quantum mechanics» (en), «Римская империя» (ru), сохраняет сырые ответы в `tests/fixtures/ru-*.json` и `en-*.json` (фикстуры — только реальные, выдумывать запрещено) и печатает отчёт по `Api-User-Agent` и `prop=pageviews`.

Пришли агенту вывод скрипта и файлы `tests/fixtures/*.json` — без них T1–T2 нельзя считать проверенными.

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

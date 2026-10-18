/**
 * worker/src/config.js — единый конфиг моделей и лимитов (п.3)
 * Имя модели — в одном месте, т.к. бесплатные модели часто снимают.
 */

export const CONFIG = {
  // Основная модель — сверять по `npx wrangler ai models` / Workers AI Pricing
  // Заявленная: @cf/google/gemma-4-26b-a4b-it
  // Порядок замены при отсутствии (вопрос 4): qwen3-30b-a3b-fp8 → gpt-oss-120b → glm-4.7-flash
  // Запрещённые на free (требуют платного): kimi-k2.6, kimi-k2.7-code, glm-5.x, deepseek-v4-*
  WORKERS_AI_MODEL: '@cf/google/gemma-4-26b-a4b-it',
  FALLBACK_MODELS: [
    '@cf/qwen/qwen3-30b-a3b-fp8',
    '@cf/openai/gpt-oss-120b',
    '@cf/zhipu/glm-4.7-flash',
  ],

  // Лимиты (вопрос 16) — стартово, пересчёт после T4b: cap = floor(0.8 * 10000 / neurons_per_route)
  DAILY_LLM_CAP: 100,
  IP_RATE_LIMIT: 15, // запросов в час, включая «Перестроить»
  IP_RATE_WINDOW_MS: 60 * 60 * 1000,

  // Валидация входа (п.6.1)
  MAX_TOPIC_LEN: 100,
  MAX_CANDIDATES: 30,
  MAX_EXTRACT_LEN: 250,
  MAX_DESCRIPTION_LEN: 120,
  MAX_BODY_KB: 40,

  // Провайдер Gemini — флаг (вопрос 5): выкл до T5
  GEMINI_ENABLED: false,
  // Имя модели Gemini сверять в день T4c по docs AI Studio
  GEMINI_MODEL: 'gemini-2.0-flash',

  // Workers AI
  WORKERS_AI_TIMEOUT_MS: 30000,
  WORKERS_AI_MAX_TOKENS: 1200,
};

/**
 * worker/src/providers/gemini.js — запасной провайдер Google Gemini (п.6.4, T4c)
 * В T4 — заглушка с интерфейсом, активируется только при наличии секрета GEMINI_API_KEY
 * и CONFIG.GEMINI_ENABLED=true. До T5 — не используется.
 */

/**
 * @param {any} env - env с GEMINI_API_KEY
 * @param {{system:string, user:string, schema:any}} args
 * @returns {Promise<{route:Array}>}
 */
export async function run(env, { system, user, schema }) {
  if (!env.GEMINI_API_KEY) throw Object.assign(new Error('quota'), { code: 'quota' });
  // TODO T4c: реализовать REST Google AI Studio:
  // POST https://generativelanguage.googleapis.com/v1beta/models/{CONFIG.GEMINI_MODEL}:generateContent?key=...
  // body: { contents: [{role:'user', parts:[{text: system + '\n\n' + user}]}], generationConfig: { responseMimeType:'application/json', responseSchema: schema, maxOutputTokens: 1200 } }
  // + маппинг ошибок лимита -> quota
  throw Object.assign(new Error('not_implemented'), { code: 'unavailable' });
}

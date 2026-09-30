// vesta recon: when VESTA_LLM_BASE_URL is set, the app's text-LLM calls go to
// vesta's OpenAI-compatible gateway (LiteLLM; model alias `default` is Qwen 27B)
// instead of OpenAI. Upstream behaviour is unchanged when it is unset.

/**
 * Read vesta's gateway settings from the environment.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ baseUrl: string, apiKey: string, model: string }|null}
 *   The gateway settings, or null when the gateway is not configured.
 */
export function vestaLlmConfig(env = process.env) {
  const baseUrl = String(env.VESTA_LLM_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!baseUrl) return null;
  return {
    baseUrl,
    apiKey: String(env.VESTA_LLM_API_KEY ?? '').trim(),
    model: String(env.VESTA_LLM_MODEL ?? '').trim() || 'default',
  };
}

/**
 * Build a Chat Completions request for the gateway, with thinking off: Qwen
 * thinks by default, and the gateway's Responses route cannot switch that off
 * (a one-line answer spent 860 reasoning tokens and 8 s there; 0.3 s here).
 *
 * @param {{ baseUrl: string, model: string }} config
 * @param {{ system: string, user: string, maxTokens: number }} prompt
 * @returns {{ url: string, body: object }}
 */
export function vestaChatRequest(config, { system, user, maxTokens }) {
  return {
    url: `${config.baseUrl}/chat/completions`,
    body: {
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      chat_template_kwargs: { enable_thinking: false },
    },
  };
}

/**
 * The assistant text of a Chat Completions answer, or '' when there is none.
 *
 * @param {unknown} data
 * @returns {string}
 */
export function vestaChatText(data) {
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

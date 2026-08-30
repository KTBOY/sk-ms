import type { AISettings } from './types';

/**
 * AI 接口（预置，OpenAI 兼容协议）。
 * 写作台「发送给 AI」= 上下文包作为 prompt 发送到 {baseUrl}/chat/completions。
 */
export async function chatComplete(settings: AISettings, prompt: string): Promise<string> {
  if (!settings.baseUrl) throw new Error('尚未配置 AI 接口（设置 → AI 接口）');
  const base = settings.baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`AI 接口返回 HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回内容为空');
  return content;
}

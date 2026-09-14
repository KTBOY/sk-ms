import type { AISettings } from './types';

/**
 * AI 接口（预置，OpenAI 兼容协议）。
 * 写作台「发送给 AI」= 上下文包作为 prompt 发送到 {baseUrl}/chat/completions；
 * 选中智能体角色卡时，角色卡 SOUL 全文作为 system 提示词先行注入。
 */
export async function chatComplete(settings: AISettings, prompt: string, system?: string): Promise<string> {
  if (!settings.baseUrl) throw new Error('尚未配置 AI 接口（设置 → AI 接口）');
  const base = settings.baseUrl.replace(/\/+$/, '');
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (system && system.trim()) messages.push({ role: 'system', content: system.trim() });
  messages.push({ role: 'user', content: prompt });
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`AI 接口返回 HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回内容为空');
  return content;
}

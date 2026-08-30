import { createAvatar } from '@dicebear/core';
import { adventurer, lorelei, notionists, micah, bigSmile, openPeeps } from '@dicebear/collection';

/**
 * 无图时的随机头像生成：DiceBear 开源风格集（MIT），
 * 纯本地生成 SVG，无网络请求、无 API Key，结果由 seed 决定（同名人物可复现）。
 */

const STYLES: Array<{ make: (seed: string) => ReturnType<typeof createAvatar> }> = [
  { make: (s) => createAvatar(adventurer, { seed: s }) },
  { make: (s) => createAvatar(lorelei, { seed: s }) },
  { make: (s) => createAvatar(notionists, { seed: s }) },
  { make: (s) => createAvatar(micah, { seed: s }) },
  { make: (s) => createAvatar(bigSmile, { seed: s }) },
  { make: (s) => createAvatar(openPeeps, { seed: s }) },
];

/** 生成一个头像 dataURL；seed 变化则形象变化，style 缺省随机选取。 */
export function generateAvatar(seed: string, styleIndex?: number): string {
  const idx = styleIndex ?? Math.floor(Math.random() * STYLES.length);
  const avatar = STYLES[idx % STYLES.length].make(seed || 'wumo');
  const svg = avatar.toDataUri();
  return svg;
}

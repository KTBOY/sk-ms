/**
 * 古风头像生成器（纯本地 SVG，无网络依赖）。
 * 由 seed 决定全部细节：发式 / 发饰 / 服饰 / 配色 / 面容，
 * 同一 seed 恒定复现；gender 含「女」时走女式造型。
 */

const INK_BG = ['#1a1714', '#211c17', '#262019', '#1d1b22'];
const ROBE = [
  { robe: '#3d5a66', trim: '#c9ac67' }, // 黛青
  { robe: '#6b3a3f', trim: '#d8b56a' }, // 绛红
  { robe: '#4a4458', trim: '#c9ac67' }, // 紫檀
  { robe: '#37503f', trim: '#cfc07a' }, // 秋香
  { robe: '#555c66', trim: '#b8c4cf' }, // 月白灰
  { robe: '#5a4632', trim: '#d8b56a' }, // 赭金
];
const SKIN = ['#e8c9a8', '#e3bd99', '#d9b18c'];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

/** 生成古风头像 dataURL；seed 变化则形象变化。 */
export function generateAvatar(seed: string, gender?: string): string {
  const r = rng(hash(seed || 'wumo'));
  const female = (gender || '').includes('女');
  const bg = pick(r, INK_BG);
  const { robe, trim } = pick(r, ROBE);
  const skin = pick(r, SKIN);
  const hair = pick(r, ['#17130f', '#211a12', '#0f0d0c']);
  const ink = pick(r, ['#c9ac67', '#b8a06a']);

  // 墨晕背景：随机偏心的墨环
  const ring = (cx: number, cy: number, rr: number, o: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${ink}" stroke-width="${(0.6 + r() * 1.4).toFixed(2)}" opacity="${o}"/>`;
  const rings = ring(120 + r() * 20 - 10, 96 + r() * 16, 70 + r() * 22, 0.22) +
    ring(112 + r() * 24, 104 + r() * 14, 88 + r() * 16, 0.12) +
    ring(104 + r() * 30, 92 + r() * 20, 104 + r() * 14, 0.06);

  // 发式
  let hairPath = '';
  if (female) {
    const style = Math.floor(r() * 3);
    if (style === 0) { // 双环髻
      hairPath += `<circle cx="99" cy="46" r="11" fill="${hair}"/><circle cx="141" cy="46" r="11" fill="${hair}"/>`;
    } else if (style === 1) { // 堕马髻偏髻
      hairPath += `<ellipse cx="${132 + r() * 10}" cy="47" rx="14" ry="10" fill="${hair}"/>`;
    } else { // 高髻
      hairPath += `<ellipse cx="120" cy="42" rx="12" ry="13" fill="${hair}"/>`;
    }
  } else {
    const style = Math.floor(r() * 3);
    if (style === 0) { // 束发玉冠
      hairPath += `<rect x="112" y="30" width="16" height="14" rx="2.5" fill="${trim}"/>`;
    } else if (style === 1) { // 道髻
      hairPath += `<circle cx="120" cy="38" r="9" fill="${hair}"/><rect x="116.5" y="33" width="7" height="10" rx="1" fill="${trim}" opacity=".85"/>`;
    } else { // 披发
      hairPath += `<path d="M96 66 Q92 90 98 104 L110 96 Z" fill="${hair}" opacity=".9"/><path d="M144 66 Q148 90 142 104 L130 96 Z" fill="${hair}" opacity=".9"/>`;
    }
  }

  // 发饰
  let pin = '';
  if (female && r() > 0.35) { // 发簪
    const px = 104 + r() * 32;
    pin = `<line x1="${px}" y1="${52 - r() * 8}" x2="${px + 26}" y2="${38 - r() * 6}" stroke="${trim}" stroke-width="2" stroke-linecap="round"/><circle cx="${px}" cy="${52 - r() * 8}" r="3" fill="${trim}"/>`;
  } else if (!female && r() > 0.5) { // 简单玉簪横贯
    pin = `<line x1="102" y1="36" x2="142" y2="32" stroke="${trim}" stroke-width="2" stroke-linecap="round"/>`;
  }
  const huadian = female && r() > 0.45
    ? `<circle cx="120" cy="72" r="1.8" fill="${trim}" opacity=".9"/>`
    : '';
  const blush = female
    ? `<ellipse cx="105" cy="76" rx="4.5" ry="2.2" fill="#c97a6a" opacity=".28"/><ellipse cx="135" cy="76" rx="4.5" ry="2.2" fill="#c97a6a" opacity=".28"/>`
    : '';

  // 交领汉服肩线
  const collar = `
    <path d="M64 200 Q70 150 96 132 L120 156 L144 132 Q170 150 176 200 Z" fill="${robe}"/>
    <path d="M96 132 L120 160 L106 176 L88 150 Z" fill="${hair}" opacity=".0"/>
    <path d="M97 133 L120 161 L143 133 L136 128 L120 146 L104 128 Z" fill="${trim}" opacity=".55"/>
    <path d="M120 161 L120 200" stroke="${trim}" stroke-width="1.2" opacity=".4"/>`;
  const shoulders = `<path d="M78 148 Q120 128 162 148 L158 158 Q120 140 82 158 Z" fill="${robe}" opacity=".9"/>`;

  // 面容
  const browY = 71 + r() * 2;
  const face = `
    <path d="M99 60 Q98 92 120 96 Q142 92 141 60 Q140 50 120 49 Q100 50 99 60" fill="${skin}"/>
    <path d="M99 62 Q96 46 120 44 Q144 46 141 62 Q142 52 120 51 Q98 52 99 62" fill="${hair}"/>
    ${hairPath}${pin}
    <path d="M107 ${browY} Q112 ${browY - 3.4} 116 ${browY - 0.6}" stroke="${hair}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M124 ${browY - 0.6} Q128 ${browY - 3.4} 133 ${browY}" stroke="${hair}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="111.5" cy="78" rx="2.1" ry="2.6" fill="#2a2018"/>
    <ellipse cx="128.5" cy="78" rx="2.1" ry="2.6" fill="#2a2018"/>
    <path d="M115 88 Q120 91 125 88" stroke="#8a5a4a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    ${blush}${huadian}`;

  // 印章（名字首字）
  const name = (seed || '墨').trim().slice(0, 1);
  const seal = `
    <rect x="150" y="160" width="26" height="26" rx="3" fill="#9e3b33" opacity=".92"/>
    <text x="163" y="179" font-size="17" fill="#f3e6c8" text-anchor="middle" font-family="'Kaiti SC','STKaiti','KaiTi',serif">${name}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
<defs><radialGradient id="g" cx="50%" cy="42%" r="70%">
<stop offset="0%" stop-color="${bg}" stop-opacity="1"/><stop offset="72%" stop-color="#141210" stop-opacity="1"/><stop offset="100%" stop-color="#0d0c0a"/></radialGradient></defs>
<rect width="240" height="240" fill="url(#g)"/>
${rings}
${shoulders}${collar}${face}
${seal}
<circle cx="120" cy="120" r="112" fill="none" stroke="${ink}" stroke-width="1" opacity=".25"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

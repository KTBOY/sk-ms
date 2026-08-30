import type { CharacterAttributes } from '../../core/types';

/** 五维能力雷达图（纯 SVG）。labels=false 时只画网格与数据面（外置大标签由页面布局提供）。 */

const DIMS: Array<{ key: keyof CharacterAttributes; label: string }> = [
  { key: 'power', label: '力量' },
  { key: 'wisdom', label: '智谋' },
  { key: 'charm', label: '魅力' },
  { key: 'will', label: '意志' },
  { key: 'fortune', label: '机缘' },
];

export function RadarChart({ values, size = 190, labels = true, accent = 'gold' }: {
  values: CharacterAttributes;
  size?: number;
  labels?: boolean;
  accent?: 'violet' | 'gold';
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - (labels ? 26 : 10);
  const angle = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;

  const ringPath = (ratio: number) =>
    DIMS.map((_, i) => `${i === 0 ? 'M' : 'L'}${cx + r * ratio * Math.cos(angle(i))},${cy + r * ratio * Math.sin(angle(i))}`).join(' ') + ' Z';

  const dataPath = DIMS.map((d, i) => {
    const v = Math.max(0, Math.min(100, values[d.key])) / 100;
    return `${i === 0 ? 'M' : 'L'}${cx + r * v * Math.cos(angle(i))},${cy + r * v * Math.sin(angle(i))}`;
  }).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="五维能力雷达图">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <path key={ratio} d={ringPath(ratio)} fill="none" stroke="rgba(201,172,103,.22)" strokeWidth={ratio === 1 ? 1.5 : 1} />
      ))}
      {DIMS.map((d, i) => (
        <line key={d.key} x1={cx} y1={cy}
          x2={cx + r * Math.cos(angle(i))} y2={cy + r * Math.sin(angle(i))}
          stroke="rgba(201,172,103,.16)" />
      ))}
      <path d={dataPath}
        fill={accent === 'gold' ? 'rgba(201, 172, 103, 0.16)' : 'rgba(255,255,255,.14)'}
        stroke={accent === 'gold' ? 'var(--hud-gold-bright)' : 'rgba(255,120,80,.9)'}
        strokeWidth={2.5} strokeLinejoin="round" />
      {DIMS.map((d, i) => {
        const v = Math.max(0, Math.min(100, values[d.key])) / 100;
        return (
          <circle key={d.key} cx={cx + r * v * Math.cos(angle(i))} cy={cy + r * v * Math.sin(angle(i))} r={3.5}
            fill={accent === 'gold' ? 'var(--hud-gold-bright)' : '#fff'}
            stroke={accent === 'gold' ? 'rgba(201, 172, 103, 0.6)' : 'rgba(255,120,80,.9)'} strokeWidth={2} />
        );
      })}
      {labels && DIMS.map((d, i) => {
        const lx = cx + (r + 16) * Math.cos(angle(i));
        const ly = cy + (r + 16) * Math.sin(angle(i));
        return (
          <text key={d.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fill="rgba(250,250,233,.78)">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

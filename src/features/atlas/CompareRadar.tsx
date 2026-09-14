import type { CharacterAttributes } from '../../core/types';

/** 五维雷达 · 多人叠加对比（纯 SVG）。设定集「战力体系」用；未选中序列半透明。 */

const DIMS: Array<{ key: keyof CharacterAttributes; label: string }> = [
  { key: 'power', label: '力量' },
  { key: 'wisdom', label: '智谋' },
  { key: 'charm', label: '魅力' },
  { key: 'will', label: '意志' },
  { key: 'fortune', label: '机缘' },
];

export const RADAR_COLORS = ['#E9C46A', '#6FE3D0', '#FF9E7A', '#7FB0FF'];

export interface RadarSeries {
  name: string;
  values: CharacterAttributes;
}

export function CompareRadar({ series, size = 320 }: {
  series: Array<RadarSeries & { color: string; active: boolean }>;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 42;
  const angle = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;

  const ringPath = (ratio: number) =>
    DIMS.map((_, i) => `${i === 0 ? 'M' : 'L'}${cx + r * ratio * Math.cos(angle(i))},${cy + r * ratio * Math.sin(angle(i))}`).join(' ') + ' Z';

  const dataPath = (values: CharacterAttributes) =>
    DIMS.map((d, i) => {
      const v = Math.max(0, Math.min(100, values[d.key] ?? 0)) / 100;
      return `${i === 0 ? 'M' : 'L'}${cx + r * v * Math.cos(angle(i))},${cy + r * v * Math.sin(angle(i))}`;
    }).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="五维雷达对比图">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <path key={ratio} d={ringPath(ratio)} fill="none" stroke="rgba(201,172,103,.2)" strokeWidth={ratio === 1 ? 1.4 : 1} />
      ))}
      {DIMS.map((d, i) => (
        <line key={d.key} x1={cx} y1={cy}
          x2={cx + r * Math.cos(angle(i))} y2={cy + r * Math.sin(angle(i))}
          stroke="rgba(201,172,103,.14)" />
      ))}
      {series.map((s) => (
        <g key={s.name} opacity={s.active ? 0.95 : 0.16} style={{ transition: 'opacity .25s' }}>
          <path d={dataPath(s.values)} fill={`${s.color}24`} stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" />
          {DIMS.map((d, i) => {
            const v = Math.max(0, Math.min(100, s.values[d.key] ?? 0)) / 100;
            return (
              <circle key={d.key} cx={cx + r * v * Math.cos(angle(i))} cy={cy + r * v * Math.sin(angle(i))} r={3}
                fill={s.color} />
            );
          })}
        </g>
      ))}
      {DIMS.map((d, i) => {
        const lx = cx + (r + 24) * Math.cos(angle(i));
        const ly = cy + (r + 24) * Math.sin(angle(i));
        return (
          <text key={d.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fill="rgba(250,250,233,.75)">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

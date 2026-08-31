import { useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Project, StoryEvent } from '../../core/types';
import { factionColor } from './RelationshipGraph';
import { GraphZoomControls } from './GraphZoom';

/** 事件图谱：横轴=时间序、纵轴=因果泳道的确定性分层图。实线箭头=前因→后果；红虚线=时序倒置警示；虚线弧=选中事件的共享参与者。 */

const IMPORTANCE_COLORS = ['#7CE0FF', '#9BE07C', '#FFC24B', '#FF9E7A', '#FF6B6B'];

interface Placed { e: StoryEvent; x: number; y: number; r: number; lane: number }
interface CausalLink { s: Placed; t: Placed; backward: boolean }
interface SharedLink { s: Placed; t: Placed; count: number }

export function EventGraph({ project, selectedId, onSelect, showShared, height = 540 }: {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showShared: boolean;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const zoomBy = useCallback((factor: number) => {
    const el = svgRef.current;
    if (!el || !zoomRef.current) return;
    d3.select(el).call(zoomRef.current.scaleBy, factor);
  }, []);
  const zoomReset = useCallback(() => {
    const el = svgRef.current;
    if (!el || !zoomRef.current) return;
    d3.select(el).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  // 确定性布局：无模拟、无随机种子，同一数据永远得到同一张图；选中变化触发重建也很廉价
  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;
    const width = wrap.clientWidth || 800;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const root = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 2.6])
      .on('zoom', (event) => root.attr('transform', event.transform));
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    root.attr('transform', d3.zoomTransform(svgEl).toString());

    const events = [...project.events].sort((a, b) => a.sortIndex - b.sortIndex);
    if (events.length === 0) {
      root.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle')
        .attr('fill', 'rgba(250,250,233,.45)').attr('font-size', 13)
        .text('暂无事件 —— 去事件设计器创建，因果链会在这里生长');
      return;
    }

    const n = events.length;
    const marginX = 70;
    const axisY = height - 26;
    const topPad = 52;
    const centerY = (topPad + axisY - 14) / 2;
    const xAt = (i: number) => marginX + (n === 1 ? (width - marginX * 2) / 2 : (i * (width - marginX * 2)) / (n - 1));
    const rOf = (e: StoryEvent) => 7 + e.importance * 1.5;
    const byId = new Map(events.map((e) => [e.id, e]));

    // 泳道分配：贴近前因所在泳道（取均值），位置冲突时就近外扩
    const laneOf = new Map<string, number>();
    const laneXs: number[][] = [];
    events.forEach((e, i) => {
      const x = xAt(i);
      const r = rOf(e);
      const causeLanes = e.causeIds
        .filter((cid) => cid !== e.id && byId.has(cid) && laneOf.has(cid))
        .map((cid) => laneOf.get(cid) as number);
      const pref = causeLanes.length > 0
        ? Math.round(causeLanes.reduce((a, b) => a + b, 0) / causeLanes.length)
        : 0;
      const isFree = (lane: number) => !(laneXs[lane] ?? []).some((ox) => Math.abs(ox - x) < r + 24 + 8);
      let lane = pref;
      for (let step = 0; ; step++) {
        const cands = step === 0 ? [pref] : [pref + step, pref - step];
        const hit = cands.find((l) => isFree(l));
        if (hit != null) { lane = hit; break; }
      }
      laneOf.set(e.id, lane);
      (laneXs[lane] ??= []).push(x);
    });
    const maxLane = Math.max(...[...laneOf.values()].map((l) => Math.abs(l)), 1);
    const laneH = Math.min(74, (height / 2 - 72) / maxLane);
    const placed: Placed[] = events.map((e, i) => {
      const lane = laneOf.get(e.id) ?? 0;
      return { e, x: xAt(i), y: centerY + lane * laneH, r: rOf(e), lane };
    });
    const placedById = new Map(placed.map((p) => [p.e.id, p]));

    const causalLinks: CausalLink[] = [];
    placed.forEach((p) => {
      p.e.causeIds.forEach((cid) => {
        if (cid === p.e.id) return;
        const s = placedById.get(cid);
        if (s) causalLinks.push({ s, t: p, backward: s.x >= p.x });
      });
    });

    let sharedLinks: SharedLink[] = [];
    if (showShared && selectedId) {
      const sel = placedById.get(selectedId);
      const selEvent = sel?.e;
      if (sel && selEvent) {
        sharedLinks = placed
          .filter((p) => p.e.id !== selEvent.id)
          .map((p) => ({ s: sel, t: p, count: selEvent.participantIds.filter((pid) => p.e.participantIds.includes(pid)).length }))
          .filter((l) => l.count > 0);
      }
    }

    // 底部时间轴：逐事件刻度，标签按时序抽取避免拥挤
    root.append('line').attr('x1', marginX - 34).attr('x2', width - marginX + 34)
      .attr('y1', axisY).attr('y2', axisY)
      .attr('stroke', 'rgba(250,250,233,.16)').attr('stroke-dasharray', '2 6');
    const step = Math.max(1, Math.ceil((n * 58) / Math.max(1, width - marginX * 2)));
    placed.forEach((p, i) => {
      root.append('line').attr('x1', p.x).attr('x2', p.x)
        .attr('y1', axisY - 3).attr('y2', axisY + 3)
        .attr('stroke', 'rgba(250,250,233,.3)');
      if (i % step === 0) {
        const label = p.e.timeLabel && p.e.timeLabel.length <= 8 ? p.e.timeLabel : `第${p.e.sortIndex}事`;
        root.append('text').attr('x', p.x).attr('y', axisY + 15).attr('text-anchor', 'middle')
          .attr('font-size', 10).attr('fill', 'rgba(250,250,233,.42)').text(label);
      }
    });

    const defs = svg.append('defs');
    defs.append('marker').attr('id', 'ev-arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 9).attr('refY', 0).attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'rgba(255,158,122,.9)');
    defs.append('marker').attr('id', 'ev-arrow-warn').attr('viewBox', '0 -5 10 10')
      .attr('refX', 9).attr('refY', 0).attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#FF6B6B');

    const linkG = root.append('g');
    const causalPaths = linkG.selectAll<SVGPathElement, CausalLink>('path').data(causalLinks).join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.backward ? '#FF6B6B' : 'rgba(255,158,122,.85)'))
      .attr('stroke-width', (d) => (d.backward ? 1.5 : 2))
      .attr('stroke-dasharray', (d) => (d.backward ? '4 4' : null))
      .attr('marker-end', (d) => (d.backward ? 'url(#ev-arrow-warn)' : 'url(#ev-arrow)'))
      .attr('d', (d) => {
        const { s, t } = d;
        if (!d.backward) {
          const sx = s.x + s.r; const tx = t.x - t.r - 2;
          const mx = (sx + tx) / 2;
          return `M${sx},${s.y} C${mx},${s.y} ${mx},${t.y} ${tx},${t.y}`;
        }
        // 时序倒置：下弧绕行，视觉上区别于正常因果
        const sy = s.y + s.r; const ty = t.y + t.r;
        const low = Math.max(sy, ty) + 46;
        return `M${s.x},${sy} C${s.x},${low} ${t.x},${low} ${t.x},${ty}`;
      });
    causalPaths.append('title').text((d) =>
      d.backward ? `时序倒置：「${d.s.e.name}」(第${d.s.e.sortIndex}事) → 「${d.t.e.name}」(第${d.t.e.sortIndex}事)，因在果后，请检查排序`
        : `${d.s.e.name} → ${d.t.e.name}`);

    const sharedPaths = linkG.selectAll<SVGPathElement, SharedLink>('path.ev-shared').data(sharedLinks).join('path')
      .attr('class', 'ev-shared')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(250,250,233,.3)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5 5')
      .attr('d', (d) => {
        const { s, t } = d;
        const sy = s.y - s.r; const ty = t.y - t.r;
        const my = Math.min(sy, ty) - 40 - Math.abs(t.x - s.x) * 0.06;
        return `M${s.x},${sy} Q${(s.x + t.x) / 2},${my} ${t.x},${ty}`;
      });
    sharedPaths.append('title').text((d) => `与「${d.t.e.name}」共享 ${d.count} 位人物`);

    const nodeG = root.append('g');
    const node = nodeG.selectAll<SVGGElement, Placed>('g').data(placed).join('g')
      .style('cursor', 'pointer')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);
    node.append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => (d.e.importance >= 4 ? '#FFC24B' : 'rgba(250,250,233,.3)'))
      .attr('fill-opacity', (d) => (d.e.importance >= 4 ? 0.9 : 1))
      .attr('stroke', (d) => (d.e.id === selectedId ? '#e6cf95' : 'rgba(250,250,233,.5)'))
      .attr('stroke-width', (d) => (d.e.id === selectedId ? 3 : 1.5));
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.lane <= 0 ? -(d.r + 8) : d.r + 16))
      .attr('font-size', 12)
      .attr('fill', '#fafae9')
      .text((d) => (d.e.name.length > 14 ? `${d.e.name.slice(0, 13)}…` : d.e.name));
    node.append('title').text((d) => `${d.e.name} · 第${d.e.sortIndex}事${d.e.timeLabel ? ` · ${d.e.timeLabel}` : ''} · 重要度 ${d.e.importance}`);

    // 高亮通道：悬停/选中只调透明度，不重建
    const related = (id: string) => {
      const set = new Set<string>([id]);
      causalLinks.forEach((l) => {
        if (l.s.e.id === id) set.add(l.t.e.id);
        if (l.t.e.id === id) set.add(l.s.e.id);
      });
      return set;
    };
    const setDim = (keep: Set<string> | null) => {
      node.style('opacity', (d) => (keep && !keep.has(d.e.id) ? 0.25 : 1));
      causalPaths.style('opacity', (d) => {
        if (!keep) return 1;
        return keep.has(d.s.e.id) && keep.has(d.t.e.id) ? 1 : 0.12;
      });
      sharedPaths.style('opacity', (d) => {
        if (!keep) return 1;
        return keep.has(d.s.e.id) && keep.has(d.t.e.id) ? 1 : 0.12;
      });
    };

    node
      .on('mouseenter', (_event, d) => setDim(related(d.e.id)))
      .on('mouseleave', () => setDim(selectedId ? related(selectedId) : null))
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelect(d.e.id === selectedId ? null : d.e.id);
      });

    svg.on('click', () => onSelect(null));
    setDim(selectedId ? related(selectedId) : null);
  }, [project, selectedId, showShared, height, onSelect]);

  return (
    <div className="graph-canvas" ref={wrapRef}>
      <svg ref={svgRef} style={{ width: '100%', height }} role="img" aria-label="事件图谱" />
      <GraphZoomControls onIn={() => zoomBy(1.25)} onOut={() => zoomBy(0.8)} onReset={zoomReset} />
    </div>
  );
}

export { IMPORTANCE_COLORS, factionColor };

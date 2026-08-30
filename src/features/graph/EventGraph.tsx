import { useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Project } from '../../core/types';
import { factionColor } from './RelationshipGraph';
import { GraphZoomControls } from './GraphZoom';

/** 事件图谱：横轴=时间序的因果网络。实线箭头=前因→后果，虚线=共享参与者。 */

interface EvNode extends d3.SimulationNodeDatum {
  id: string; name: string; sortIndex: number; importance: number; x0: number;
}
interface EvLink extends d3.SimulationLinkDatum<EvNode> { kind: 'cause' | 'shared'; label?: string }

const IMPORTANCE_COLORS = ['#7CE0FF', '#9BE07C', '#FFC24B', '#FF9E7A', '#FF6B6B'];

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
  // 跨重建保留状态：节点位置 / 高亮函数 / 邻接函数 / 当前选中。
  // 点选只走高亮通道，不重建整图、不重启力模拟 —— 消除卡顿与闪烁。
  const nodesRef = useRef<EvNode[]>([]);
  const setDimRef = useRef<(keep: Set<string> | null) => void>(() => {});
  const relatedRef = useRef<(id: string) => Set<string>>(() => new Set());
  const selectedRef = useRef(selectedId);

  // 缩放控制：按钮驱动，与滚轮共用同一 zoom 行为
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

  // 主构建：仅在数据 / 共享开关 / 尺寸变化时重建
  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;
    const width = wrap.clientWidth || 800;

    const events = [...project.events].sort((a, b) => a.sortIndex - b.sortIndex);
    const margin = { x: 70, top: 60, bottom: 40 };
    const x0 = (i: number) => margin.x + (i * (width - margin.x * 2)) / Math.max(1, events.length - 1);

    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]));
    let resumed = false;
    const nodes: EvNode[] = events.map((e, i) => {
      const n: EvNode = { id: e.id, name: e.name, sortIndex: e.sortIndex, importance: e.importance, x0: x0(i) };
      const prev = prevById.get(e.id);
      if (prev && prev.x != null && prev.y != null) {
        n.x = prev.x; n.y = prev.y;
        resumed = true;
      }
      return n;
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const links: EvLink[] = [];
    events.forEach((e) => {
      e.causeIds.forEach((cid) => {
        if (byId.has(cid) && cid !== e.id) links.push({ source: cid, target: e.id, kind: 'cause' });
      });
    });
    if (showShared) {
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const shared = events[i].participantIds.filter((p) => events[j].participantIds.includes(p));
          if (shared.length > 0) links.push({ source: events[i].id, target: events[j].id, kind: 'shared', label: `${shared.length}位共同人物` });
        }
      }
    }

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const root = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 2.6])
      .on('zoom', (event) => root.attr('transform', event.transform));
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    root.attr('transform', d3.zoomTransform(svgEl).toString());

    // 时间轴
    root.append('line')
      .attr('x1', margin.x - 30).attr('x2', width - margin.x + 30)
      .attr('y1', height / 2).attr('y2', height / 2)
      .attr('stroke', 'rgba(250,250,233,.14)').attr('stroke-dasharray', '2 6');
    root.append('text').attr('x', margin.x - 30).attr('y', height / 2 - 12)
      .attr('font-size', 11).attr('fill', 'rgba(250,250,233,.45)').text('时间 →');

    const defs = svg.append('defs');
    defs.append('marker').attr('id', 'ev-arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', 'rgba(255,158,122,.9)');

    const linkG = root.append('g');
    const nodeG = root.append('g');

    const link = linkG.selectAll('path')
      .data(links).join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.kind === 'cause' ? 'rgba(255,158,122,.85)' : 'rgba(250,250,233,.22)'))
      .attr('stroke-width', (d) => (d.kind === 'cause' ? 2 : 1))
      .attr('stroke-dasharray', (d) => (d.kind === 'cause' ? null : '5 5'))
      .attr('marker-end', (d) => (d.kind === 'cause' ? 'url(#ev-arrow)' : null));

    const node = nodeG.selectAll('g')
      .data(nodes).join('g')
      .attr('class', 'rel-node')
      .style('cursor', 'pointer') as unknown as d3.Selection<SVGGElement, EvNode, SVGGElement, unknown>;

    node.append('circle')
      .attr('r', (d) => 9 + d.importance * 1.6)
      .attr('fill', (d) => IMPORTANCE_COLORS[d.importance - 1] ?? IMPORTANCE_COLORS[2])
      .attr('fill-opacity', 0.88)
      .attr('stroke', (d) => (d.id === selectedRef.current ? '#e6cf95' : 'rgba(250,250,233,.5)'))
      .attr('stroke-width', (d) => (d.id === selectedRef.current ? 3 : 1.5));

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (nodes.indexOf(d) % 2 === 0 ? -(9 + d.importance * 1.6) - 8 : (9 + d.importance * 1.6) + 18))
      .attr('font-size', 12)
      .attr('fill', '#fafae9')
      .text((d) => (d.name.length > 8 ? `${d.name.slice(0, 7)}…` : d.name));
    node.append('title').text((d) => `${d.name} · 第${d.sortIndex}事`);

    const related = (id: string) => {
      const set = new Set<string>([id]);
      links.forEach((l) => {
        const s = l.source as EvNode; const t = l.target as EvNode;
        if (s.id === id) set.add(t.id);
        if (t.id === id) set.add(s.id);
      });
      return set;
    };
    relatedRef.current = related;

    const setDim = (keep: Set<string> | null) => {
      node.style('opacity', (d) => (keep && !keep.has(d.id) ? 0.25 : 1));
      // 选中描边随高亮通道同步更新（点选不再重建整图）
      node.select('circle')
        .attr('stroke', (d) => (d.id === selectedRef.current ? '#e6cf95' : 'rgba(250,250,233,.5)'))
        .attr('stroke-width', (d) => (d.id === selectedRef.current ? 3 : 1.5));
      link.style('opacity', (d) => {
        if (!keep) return 1;
        const s = d.source as EvNode; const t = d.target as EvNode;
        return keep.has(s.id) && keep.has(t.id) ? 1 : 0.12;
      });
    };
    setDimRef.current = setDim;

    const simulation = d3.forceSimulation<EvNode>(nodes)
      .force('x', d3.forceX<EvNode>((d) => d.x0).strength(0.6))
      .force('y', d3.forceY<EvNode>(height / 2).strength(0.06))
      .force('charge', d3.forceManyBody().strength(-70))
      .force('collide', d3.forceCollide<EvNode>().radius((d) => 9 + d.importance * 1.6 + 18))
      .alpha(resumed ? 0.4 : 1)
      .on('tick', () => {
        link.attr('d', (d) => {
          const s = d.source as EvNode; const t = d.target as EvNode;
          const mx = (s.x ?? 0) / 2 + (t.x ?? 0) / 2;
          const my = (s.y ?? 0) / 2 + (t.y ?? 0) / 2 - 26;
          return `M${s.x ?? 0},${s.y ?? 0} Q${mx},${my} ${t.x ?? 0},${t.y ?? 0}`;
        });
        node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    node
      .on('mouseenter', (_event, d) => setDim(related(d.id)))
      .on('mouseleave', () => setDim(selectedRef.current ? related(selectedRef.current) : null))
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelect(d.id === selectedRef.current ? null : d.id);
      })
      .call(d3.drag<SVGGElement, EvNode>()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (_event, d) => { if (!_event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    svg.on('click', () => onSelect(null));
    setDim(selectedRef.current ? related(selectedRef.current) : null);
    nodesRef.current = nodes;
    return () => { simulation.stop(); };
  }, [project, showShared, height, onSelect]);

  // 选中态：只更新高亮，不重建
  useEffect(() => {
    selectedRef.current = selectedId;
    setDimRef.current(selectedId ? relatedRef.current(selectedId) : null);
  }, [selectedId]);

  return (
    <div className="graph-canvas" ref={wrapRef}>
      <svg ref={svgRef} style={{ width: '100%', height }} role="img" aria-label="事件图谱" />
      <GraphZoomControls onIn={() => zoomBy(1.25)} onOut={() => zoomBy(0.8)} onReset={zoomReset} />
    </div>
  );
}

export { IMPORTANCE_COLORS, factionColor };

import { useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Project } from '../../core/types';
import { GraphZoomControls } from './GraphZoom';

/** 关系图谱：力导向布局。节点=人物（大小=关系数、色=势力、金环=主角、灰环=已故）。 */

export interface RelNode extends d3.SimulationNodeDatum {
  id: string; name: string; avatar: string | null; color: string;
  radius: number; role: string; status: string;
}
export interface RelLink extends d3.SimulationLinkDatum<RelNode> {
  id: string; type: string; strength: number;
}

export const FACTION_COLORS = ['#C9A6FF', '#6FE3D0', '#FF9E7A', '#7FB0FF', '#F87EB2', '#9BE07C', '#FFC24B', '#7CE0FF'];

export function factionColor(project: Project, factionId: string | null): string {
  if (!factionId) return 'rgba(255,255,255,.42)';
  const idx = project.factions.findIndex((f) => f.id === factionId);
  return FACTION_COLORS[(idx < 0 ? 0 : idx) % FACTION_COLORS.length];
}

export function RelationshipGraph({ project, selectedId, onSelect, height = 540 }: {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // 跨重建保留状态：节点位置 / 高亮函数 / 邻接函数 / 当前选中。
  // 点选只走高亮通道，不重建整图、不重启力模拟 —— 消除卡顿与闪烁。
  const nodesRef = useRef<RelNode[]>([]);
  const setDimRef = useRef<(keep: Set<string> | null) => void>(() => {});
  const neighborsRef = useRef<(id: string) => Set<string>>(() => new Set());
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

  // 主构建：仅在数据 / 尺寸变化时重建
  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;
    const width = wrap.clientWidth || 800;

    const degree = new Map<string, number>();
    project.relations.forEach((r) => {
      degree.set(r.fromId, (degree.get(r.fromId) ?? 0) + 1);
      degree.set(r.toId, (degree.get(r.toId) ?? 0) + 1);
    });

    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]));
    let resumed = false;
    const nodes: RelNode[] = project.characters.map((c) => {
      const n: RelNode = {
        id: c.id, name: c.name, avatar: c.avatar, role: c.role, status: c.status,
        color: factionColor(project, c.factionId),
        radius: Math.min(32, 15 + (degree.get(c.id) ?? 0) * 2.2),
      };
      const prev = prevById.get(c.id);
      if (prev && prev.x != null && prev.y != null) {
        n.x = prev.x; n.y = prev.y;
        resumed = true;
      }
      return n;
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: RelLink[] = project.relations
      .filter((r) => byId.has(r.fromId) && byId.has(r.toId))
      .map((r) => ({ id: r.id, source: r.fromId, target: r.toId, type: r.type, strength: r.strength }));

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const root = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.6])
      .on('zoom', (event) => root.attr('transform', event.transform));
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    root.attr('transform', d3.zoomTransform(svgEl).toString());

    // 人物形象裁剪
    const defs = svg.append('defs');
    nodes.forEach((n) => {
      if (!n.avatar) return;
      defs.append('clipPath').attr('id', `av-${n.id}`)
        .append('circle').attr('r', n.radius);
    });

    const linkG = root.append('g');
    const nodeG = root.append('g');

    const link = linkG.selectAll('g')
      .data(links).join('g')
      .attr('class', 'rel-link');
    link.append('line')
      .attr('stroke', 'rgba(250,250,233,.30)')
      .attr('stroke-width', (d) => 1 + d.strength * 0.7);
    link.append('text')
      .attr('class', 'rel-link__label')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .text((d) => d.type);

    const node = nodeG.selectAll('g')
      .data(nodes).join('g')
      .attr('class', 'rel-node')
      .style('cursor', 'pointer') as unknown as d3.Selection<SVGGElement, RelNode, SVGGElement, unknown>;

    node.append('circle')
      .attr('r', (d) => d.radius + 3)
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.role === '主角' ? '#e6cf95' : d.status === '死亡' ? 'rgba(250,250,233,.25)' : 'rgba(250,250,233,.45)'))
      .attr('stroke-width', (d) => (d.role === '主角' ? 3 : 1.5));

    node.each(function (d) {
      const g = d3.select(this);
      if (d.avatar) {
        g.append('image')
          .attr('href', d.avatar)
          .attr('width', d.radius * 2).attr('height', d.radius * 2)
          .attr('x', -d.radius).attr('y', -d.radius)
          .attr('clip-path', `url(#av-${d.id})`)
          .attr('preserveAspectRatio', 'xMidYMid slice');
        g.append('circle')
          .attr('r', d.radius).attr('fill', 'none')
          .attr('stroke', 'rgba(250,250,233,.5)');
      } else {
        g.append('circle')
          .attr('r', d.radius)
          .attr('fill', d.color)
          .attr('fill-opacity', 0.32)
          .attr('stroke', d.color);
        g.append('text')
          .attr('text-anchor', 'middle').attr('dy', 4)
          .attr('font-size', Math.max(11, d.radius * 0.62))
          .attr('fill', '#fafae9')
          .text(d.name.slice(0, d.radius > 18 ? 2 : 1));
      }
    });

    node.append('text')
      .attr('class', 'rel-node__label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 16)
      .text((d) => (d.name.length > 8 ? `${d.name.slice(0, 7)}…` : d.name));
    node.append('title').text((d) => d.name);
    // 专用选中环：不占用角色/状态色描边，点选时点亮
    node.append('circle')
      .attr('class', 'rel-node__sel')
      .attr('r', (d) => d.radius + 8)
      .attr('fill', 'none')
      .attr('stroke', 'var(--gold-bright)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 4')
      .style('opacity', 0);

    const simulation = d3.forceSimulation<RelNode>(nodes)
      .force('link', d3.forceLink<RelNode, RelLink>(links).id((d) => d.id).distance(120).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<RelNode>().radius((d) => d.radius + 24))
      .alpha(resumed ? 0.4 : 1)
      .on('tick', () => {
        link.select('line')
          .attr('x1', (d) => (d.source as RelNode).x ?? 0).attr('y1', (d) => (d.source as RelNode).y ?? 0)
          .attr('x2', (d) => (d.target as RelNode).x ?? 0).attr('y2', (d) => (d.target as RelNode).y ?? 0);
        link.select('text')
          .attr('x', (d) => ((d.source as RelNode).x ?? 0) * 0.5 + ((d.target as RelNode).x ?? 0) * 0.5)
          .attr('y', (d) => ((d.source as RelNode).y ?? 0) * 0.5 + ((d.target as RelNode).y ?? 0) * 0.5);
        node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    const neighbors = (id: string) => {
      const set = new Set<string>([id]);
      links.forEach((l) => {
        const s = (l.source as RelNode).id;
        const t = (l.target as RelNode).id;
        if (s === id) set.add(t);
        if (t === id) set.add(s);
      });
      return set;
    };
    neighborsRef.current = neighbors;

    const setDim = (keep: Set<string> | null) => {
      node.style('opacity', (d) => (keep && !keep.has(d.id) ? 0.25 : 1));
      // 选中环随高亮通道同步点亮（点选不再重建整图）
      node.select('circle.rel-node__sel')
        .style('opacity', (d) => (d.id === selectedRef.current ? 1 : 0));
      link.style('opacity', (d) => {
        if (!keep) return 1;
        const s = (d.source as RelNode).id ?? '';
        const t = (d.target as RelNode).id ?? '';
        return keep.has(s) && keep.has(t) ? 1 : 0.12;
      });
      link.select('text').style('display', (d) => {
        if (!keep) return '';
        const s = (d.source as RelNode).id ?? '';
        const t = (d.target as RelNode).id ?? '';
        return keep.has(s) && keep.has(t) ? '' : 'none';
      });
    };
    setDimRef.current = setDim;

    node
      .on('mouseenter', (_event, d) => setDim(neighbors(d.id)))
      .on('mouseleave', () => setDim(selectedRef.current ? neighbors(selectedRef.current) : null))
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelect(d.id === selectedRef.current ? null : d.id);
      })
      .call(d3.drag<SVGGElement, RelNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.25).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    svg.on('click', () => onSelect(null));
    setDim(selectedRef.current ? neighbors(selectedRef.current) : null);
    nodesRef.current = nodes;

    return () => { simulation.stop(); };
  }, [project, onSelect, height]);

  // 选中态：只更新高亮，不重建
  useEffect(() => {
    selectedRef.current = selectedId;
    setDimRef.current(selectedId ? neighborsRef.current(selectedId) : null);
  }, [selectedId]);

  return (
    <div className="graph-canvas" ref={wrapRef}>
      <svg ref={svgRef} style={{ width: '100%', height }} role="img" aria-label="关系图谱" />
      <GraphZoomControls onIn={() => zoomBy(1.25)} onOut={() => zoomBy(0.8)} onReset={zoomReset} />
    </div>
  );
}

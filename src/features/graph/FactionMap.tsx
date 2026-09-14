import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { LocationNode, Project } from '../../core/types';
import { useProjectStore } from '../../store/projectStore';
import { GraphZoomControls } from './GraphZoom';
import { factionColor } from './RelationshipGraph';

/** 势力地图：地点为节点（按区域聚簇布点），归属势力着色，拖拽固定位置，点选查看详情。
 *  与关系图谱同架构：d3-zoom 缩放 / d3-drag 拖拽 / 选中环高亮通道，手动布局存 project.mapLayout。 */

export interface MapNode {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  radius: number;
  factionId: string | null;
  eventCount: number;
}

interface RegionGroup {
  region: string;
  nodes: MapNode[];
  cx: number;
  cy: number;
}

/** 确定性自动布局：区域围绕画布中心成环，区域内地点绕区域中心成环，子地点外推。 */
function autoLayout(project: Project, width: number, height: number): MapNode[] {
  const W = width || 800;
  const H = height || 520;
  const byRegion = new Map<string, LocationNode[]>();
  for (const l of project.locations) {
    const key = l.region.trim() || '未划区域';
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key)!.push(l);
  }
  const eventCount = (id: string) => project.events.filter((e) => e.locationId === id).length;
  const posById = new Map<string, { x: number; y: number }>();
  const regions = [...byRegion.entries()];
  const R = Math.min(W, H) * 0.30;

  regions.forEach(([, locs], ri) => {
    const angle = -Math.PI / 2 + (ri * 2 * Math.PI) / Math.max(regions.length, 1);
    const cx = W / 2 + R * Math.cos(angle) * (regions.length > 1 ? 1 : 0);
    const cy = H / 2 + R * Math.sin(angle) * 0.78 * (regions.length > 1 ? 1 : 0);
    const roots = locs.filter((l) => !l.parentId || !locs.some((p) => p.id === l.parentId));
    const children = locs.filter((l) => l.parentId && locs.some((p) => p.id === l.parentId));
    const ringR = 34 + roots.length * 12;
    roots.forEach((l, i) => {
      const a = (i * 2 * Math.PI) / Math.max(roots.length, 1) - Math.PI / 2;
      posById.set(l.id, { x: cx + ringR * Math.cos(a), y: cy + ringR * Math.sin(a) });
    });
    children.forEach((l, i) => {
      const parent = posById.get(l.parentId!) ?? { x: cx, y: cy };
      const a = (i * 2 * Math.PI) / Math.max(children.length, 1) - Math.PI / 2 + 0.5;
      posById.set(l.id, { x: parent.x + 62 * Math.cos(a), y: parent.y + 62 * Math.sin(a) });
    });
  });

  return project.locations.map((l) => {
    const p = posById.get(l.id) ?? { x: W / 2, y: H / 2 };
    const ec = eventCount(l.id);
    return {
      id: l.id,
      name: l.name,
      region: l.region.trim() || '未划区域',
      x: Math.max(46, Math.min(W - 46, p.x)),
      y: Math.max(40, Math.min(H - 40, p.y)),
      radius: 9 + Math.min(ec, 8) * 1.4,
      factionId: l.factionId ?? null,
      eventCount: ec,
    };
  });
}

export function FactionMap({ project, selectedId, onSelect, height = 500 }: {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const selectedRef = useRef(selectedId);
  const setSelRef = useRef<() => void>(() => {});
  const update = useProjectStore((s) => s.update);

  // 自动布局只依赖地点/事件/势力与画布宽度；手动布局从 project.mapLayout 读取
  const width = wrapRef.current?.clientWidth ?? 0;
  const baseNodes = useMemo(() => autoLayout(project, width, height), [project, width, height]);
  const regionGroups = useMemo<RegionGroup[]>(() => {
    const map = new Map<string, MapNode[]>();
    for (const n of baseNodes) {
      if (!map.has(n.region)) map.set(n.region, []);
      map.get(n.region)!.push(n);
    }
    return [...map.entries()].map(([region, nodes]) => ({
      region,
      nodes,
      cx: nodes.reduce((a, n) => a + n.x, 0) / nodes.length,
      cy: nodes.reduce((a, n) => a + n.y, 0) / nodes.length,
    }));
  }, [baseNodes]);

  const posOf = useCallback((n: MapNode) => {
    const saved = project.mapLayout?.[n.id];
    return saved ?? { x: n.x, y: n.y };
  }, [project.mapLayout]);

  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;
    const w = wrap.clientWidth || 800;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${w} ${height}`);

    const root = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 2.4])
      .on('zoom', (event) => root.attr('transform', event.transform));
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    root.attr('transform', d3.zoomTransform(svgEl).toString());

    // 区域底纹标签
    const regionG = root.append('g');
    regionG.selectAll('text')
      .data(regionGroups).join('text')
      .attr('class', 'map-region-label')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => d.cx).attr('y', (d) => d.cy - 74)
      .text((d) => d.region);

    // 从属连线（parent → child）
    const nodeById = new Map(baseNodes.map((n) => [n.id, n]));
    const links = project.locations
      .filter((l) => l.parentId && nodeById.has(l.id) && nodeById.has(l.parentId))
      .map((l) => ({ source: l.parentId!, target: l.id }));

    const linkG = root.append('g');
    linkG.selectAll('line')
      .data(links).join('line')
      .attr('stroke', 'rgba(250,250,233,.18)')
      .attr('stroke-dasharray', '3 5')
      .attr('x1', (d) => posOf(nodeById.get(d.source)!).x).attr('y1', (d) => posOf(nodeById.get(d.source)!).y)
      .attr('x2', (d) => posOf(nodeById.get(d.target)!).x).attr('y2', (d) => posOf(nodeById.get(d.target)!).y);

    const nodeG = root.append('g');
    const node = nodeG.selectAll('g')
      .data(baseNodes).join('g')
      .attr('class', 'map-node')
      .attr('transform', (d) => { const p = posOf(d); return `translate(${p.x},${p.y})`; })
      .style('cursor', 'pointer') as unknown as d3.Selection<SVGGElement, MapNode, SVGGElement, unknown>;

    node.append('circle')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.factionId ? factionColor(project, d.factionId) : 'rgba(250,250,233,.4)'))
      .attr('stroke-width', 2.4);
    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.factionId ? factionColor(project, d.factionId) : 'rgba(250,250,233,.28)'))
      .attr('fill-opacity', 0.24)
      .attr('stroke', 'rgba(250,250,233,.55)')
      .attr('stroke-width', 1);
    node.append('circle')
      .attr('r', 2.6)
      .attr('fill', '#e9c46a');
    node.append('text')
      .attr('class', 'map-node__label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 18)
      .text((d) => (d.name.length > 8 ? `${d.name.slice(0, 7)}…` : d.name));
    node.append('circle')
      .attr('class', 'map-node__sel')
      .attr('r', (d) => d.radius + 12)
      .attr('fill', 'none')
      .attr('stroke', 'var(--gold-bright)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 4')
      .style('opacity', 0);
    node.append('title').text((d) => `${d.name} · ${d.region}${d.factionId ? ` · ${project.factions.find((f) => f.id === d.factionId)?.name ?? ''}` : ''} · 关联事件 ${d.eventCount}`);

    const setSel = () => {
      node.select('circle.map-node__sel').style('opacity', (d) => (d.id === selectedRef.current ? 1 : 0));
      node.style('opacity', (d) => (selectedRef.current && d.id !== selectedRef.current ? 0.45 : 1));
    };
    setSelRef.current = setSel;

    node
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelect(d.id === selectedRef.current ? null : d.id);
      })
      .call(d3.drag<SVGGElement, MapNode>()
        .on('start', function (_event, d) {
          const p = posOf(d);
          d.x = p.x; d.y = p.y;
          d3.select(this).raise();
        })
        .on('drag', function (event, d) {
          d.x = event.x; d.y = event.y;
          d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
        })
        .on('end', (_event, d) => {
          update((p) => {
            p.mapLayout = { ...(p.mapLayout ?? {}) };
            p.mapLayout[d.id] = { x: Math.round(d.x), y: Math.round(d.y) };
          });
        }));

    svg.on('click', () => onSelect(null));
    setSel();

    return () => { zoomBehavior.on('zoom', null); };
  }, [project, baseNodes, regionGroups, posOf, height, onSelect, update]);

  // 选中态：只更新高亮，不重建
  useEffect(() => {
    selectedRef.current = selectedId;
    setSelRef.current();
  }, [selectedId]);

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

  if (project.locations.length === 0) {
    return (
      <div className="graph-detail graph-detail--empty" style={{ minHeight: height }}>
        <p className="dim">还没有地点数据——先在「地点」页登记地点，再回来布置势力版图。</p>
      </div>
    );
  }

  return (
    <div className="graph-canvas" ref={wrapRef}>
      <svg ref={svgRef} style={{ width: '100%', height }} role="img" aria-label="势力地图" />
      <GraphZoomControls onIn={() => zoomBy(1.25)} onOut={() => zoomBy(0.8)} onReset={zoomReset} />
    </div>
  );
}

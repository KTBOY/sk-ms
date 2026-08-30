import { useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Project } from '../../core/types';
import { GraphZoomControls } from './GraphZoom';

/** 人物轨迹：以时间为横轴渲染某人一生的事件路径（折线 + 节点 + 地点标注）。 */

export function TrajectoryChart({ project, characterId, height = 320, onPickEvent }: {
  project: Project;
  characterId: string | null;
  height?: number;
  onPickEvent: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

  useEffect(() => {
    const svgEl = svgRef.current;
    const wrap = wrapRef.current;
    if (!svgEl || !wrap) return;
    const width = wrap.clientWidth || 800;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const char = project.characters.find((c) => c.id === characterId);
    if (!char) {
      svg.append('text').attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', 'rgba(250,250,233,.45)')
        .text('在上方选择一位人物，查看TA的历史轨迹');
      return;
    }

    const events = project.events
      .filter((e) => e.participantIds.includes(char.id))
      .sort((a, b) => a.sortIndex - b.sortIndex);

    const margin = { left: 40, right: 40, top: 46, bottom: 40 };
    const innerW = width - margin.left - margin.right;
    const midY = height / 2 + 10;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const root = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 2.6])
      .on('zoom', (event) => root.attr('transform', event.transform));
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    // 重渲染（如切换人物）会重建 root，需恢复当前缩放变换
    root.attr('transform', d3.zoomTransform(svgEl).toString());
    const g = root.append('g').attr('transform', `translate(${margin.left},0)`);

    if (events.length === 0) {
      g.append('text').attr('x', innerW / 2).attr('y', midY)
        .attr('text-anchor', 'middle').attr('fill', 'rgba(250,250,233,.45)')
        .text(`「${char.name}」尚未参与任何事件，去事件设计器补充`);
      return;
    }

    const x = (i: number) => (events.length === 1 ? innerW / 2 : (i * innerW) / (events.length - 1));
    const y = (i: number) => midY + (i % 2 === 0 ? -74 : 74);

    // 轨迹折线
    const line = d3.line<{ x: number; y: number }>()
      .x((d) => d.x).y((d) => d.y)
      .curve(d3.curveCatmullRom.alpha(0.6));
    const pts = events.map((_, i) => ({ x: x(i), y: y(i) }));
    g.append('path').attr('d', line(pts) ?? '')
      .attr('fill', 'none').attr('stroke', 'rgba(201,166,255,.65)').attr('stroke-width', 2);

    // 时间轴
    g.append('line').attr('x1', 0).attr('x2', innerW)
      .attr('y1', midY).attr('y2', midY)
      .attr('stroke', 'rgba(250,250,233,.14)').attr('stroke-dasharray', '2 6');

    events.forEach((e, i) => {
      const px = x(i);
      const py = y(i);
      const node = g.append('g').attr('class', 'rel-node').style('cursor', 'pointer')
        .on('click', () => onPickEvent(e.id));

      node.append('line').attr('x1', px).attr('y1', midY).attr('x2', px).attr('y2', py)
        .attr('stroke', 'rgba(250,250,233,.14)');

      if (char.avatar) {
        node.append('circle').attr('cx', px).attr('cy', py).attr('r', 17)
          .attr('fill', '#14161a').attr('stroke', '#C9A6FF').attr('stroke-width', 2);
        node.append('clipPath').attr('id', `traj-${i}`)
          .append('circle').attr('cx', px).attr('cy', py).attr('r', 15);
        node.append('image').attr('href', char.avatar)
          .attr('x', px - 15).attr('y', py - 15).attr('width', 30).attr('height', 30)
          .attr('clip-path', `url(#traj-${i})`).attr('preserveAspectRatio', 'xMidYMid slice');
      } else {
        node.append('circle').attr('cx', px).attr('cy', py).attr('r', 13)
          .attr('fill', 'rgba(201,166,255,.3)').attr('stroke', '#C9A6FF').attr('stroke-width', 2);
        node.append('text').attr('x', px).attr('y', py + 4).attr('text-anchor', 'middle')
          .attr('font-size', 11).attr('fill', '#fafae9').text(String(e.sortIndex));
      }

      const isUp = i % 2 === 0;
      node.append('text').attr('x', px).attr('y', py + (isUp ? -26 : 34))
        .attr('text-anchor', 'middle').attr('font-size', 12.5).attr('fill', '#fafae9')
        .text(e.name.length > 9 ? `${e.name.slice(0, 9)}…` : e.name);
      const loc = e.locationId ? project.locations.find((l) => l.id === e.locationId)?.name : '';
      node.append('text').attr('x', px).attr('y', py + (isUp ? -42 : 50))
        .attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', '#6FE3D0')
        .text([e.timeLabel, loc && `@${loc}`].filter(Boolean).join(' '));
    });
  }, [project, characterId, height, onPickEvent]);

  return (
    <div className="graph-canvas" ref={wrapRef}>
      <svg ref={svgRef} style={{ width: '100%', height }} role="img" aria-label="人物轨迹" />
      <GraphZoomControls onIn={() => zoomBy(1.25)} onOut={() => zoomBy(0.8)} onReset={zoomReset} />
    </div>
  );
}

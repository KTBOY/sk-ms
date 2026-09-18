import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Character, DocCategory, Project, ProjectDoc } from '../../core/types';
import { parseMarkdown, type MdBlock } from '../../core/docs/markdown';
import { DOC_CATEGORY_LABELS } from '../../core/docs/classify';
import type { EntityKind } from '../../core/types';

/**
 * 文档语义化渲染层 —— 把工作区文档原文（Markdown）解析为 block 后，按 path/category
 * 命中专用只读视图；未命中回落到通用 MarkdownView。所有视图都是 content 的投影，
 * 编辑始终回到原文 textarea，保证「导入 → 编辑 → 导出」逐字节无损。
 */

type OpenDetail = (kind: EntityKind, id: string) => void;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 人物名 + 别名 → Character 索引（首次命中优先，长名先匹配）。 */
function charIndex(project: Project): Map<string, Character> {
  const m = new Map<string, Character>();
  for (const c of project.characters) {
    if (!m.has(c.name)) m.set(c.name, c);
    for (const a of c.aliases) if (a && !m.has(a)) m.set(a, c);
  }
  return m;
}

/** 文本中出现的已登记人物名渲染为可点击跳转的 span。 */
function linkify(text: string, index: Map<string, Character>, openDetail: OpenDetail): ReactNode {
  if (!text || index.size === 0) return text;
  const names = [...index.keys()].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const re = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'g');
  const parts = text.split(re);
  return parts.map((p, i) => {
    const c = index.get(p);
    return c ? (
      <span key={i} className="doc-link" title={`${c.name} · 查看人物详情`} onClick={() => openDetail('character', c.id)}>{p}</span>
    ) : (
      <span key={i}>{p}</span>
    );
  });
}

function TableBlock({ b, index, openDetail }: { b: Extract<MdBlock, { type: 'table' }>; index: Map<string, Character>; openDetail: OpenDetail }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>{b.header.map((h, i) => <th key={i} style={b.align[i] ? { textAlign: b.align[i] } : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {b.rows.map((row, r) => (
            <tr key={r}>{row.map((cell, c) => <td key={c}>{linkify(cell, index, openDetail)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockView({ b, index, openDetail }: { b: MdBlock; index: Map<string, Character>; openDetail: OpenDetail }) {
  switch (b.type) {
    case 'heading': {
      const Tag = (`h${Math.min(6, b.level + 1)}`) as 'h2';
      return <Tag className={`doc-h doc-h--${b.level}`}>{b.text}</Tag>;
    }
    case 'quote':
      return <blockquote className="doc-quote">{b.lines.map((l, i) => <div key={i}>{linkify(l, index, openDetail)}</div>)}</blockquote>;
    case 'table':
      return <TableBlock b={b} index={index} openDetail={openDetail} />;
    case 'list': {
      const items = b.items.map((it, i) => <li key={i}>{linkify(it, index, openDetail)}</li>);
      return b.ordered ? <ol className="doc-list">{items}</ol> : <ul className="doc-list">{items}</ul>;
    }
    case 'code':
      return <pre className="doc-code"><code>{b.lines.join('\n')}</code></pre>;
    case 'rule':
      return <hr className="doc-rule" />;
    case 'para':
      return <p className="doc-para">{linkify(b.text, index, openDetail)}</p>;
    default:
      return null;
  }
}

/** 通用 Markdown 视图：按 block 顺序结构化渲染，人物名可点击跳详情。 */
export function MarkdownView({ text, project, openDetail }: { text: string; project: Project; openDetail: OpenDetail }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const index = useMemo(() => charIndex(project), [project]);
  if (blocks.length === 0) return <p className="dim">（空文档）</p>;
  return (
    <div className="doc-md">
      {blocks.map((b, i) => <BlockView key={i} b={b} index={index} openDetail={openDetail} />)}
    </div>
  );
}

/** 纯文本 / 脚本视图：不解析 Markdown，原样等宽展示（tools/*.py、*.json 等）。 */
export function PlainView({ text }: { text: string }) {
  return <pre className="doc-plain">{text}</pre>;
}

/* ---------------- 语义适配器：台账 / 状态表 / 巡检报告 ---------------- */

interface SemTable { header: string[]; rows: string[][] }
function tablesOf(text: string): SemTable[] {
  return parseMarkdown(text)
    .filter((b): b is Extract<MdBlock, { type: 'table' }> => b.type === 'table')
    .map((b) => ({ header: b.header, rows: b.rows }));
}
const colOf = (header: string[], kw: RegExp) => header.findIndex((h) => kw.test(h));

const FORESHADOW_BADGE: Record<string, string> = {
  已回收: 'done', 已埋待收: 'pending', 待埋设: 'todo',
};
function statusBucket(status: string): { key: string; label: string } {
  if (status.includes('已回收')) return { key: 'done', label: '已回收' };
  if (status.includes('已埋')) return { key: 'pending', label: '已埋待收' };
  if (status.includes('待埋')) return { key: 'todo', label: '待埋设' };
  return { key: 'other', label: status || '—' };
}

/** 伏笔台账：按状态统计 + 逐条状态徽标 + △ 推断高亮。 */
function ForeshadowingView({ text, project, openDetail }: { text: string; project: Project; openDetail: OpenDetail }) {
  const tables = tablesOf(text);
  const ledger = tables.find((t) => colOf(t.header, /编号/) >= 0 && colOf(t.header, /状态/) >= 0);
  if (!ledger) return <MarkdownView text={text} project={project} openDetail={openDetail} />;
  const statusCol = colOf(ledger.header, /状态/);
  const counts: Record<string, number> = { done: 0, pending: 0, todo: 0, other: 0 };
  for (const r of ledger.rows) counts[statusBucket(r[statusCol] ?? '').key] += 1;
  return (
    <div className="doc-md doc-ledger">
      <div className="ledger-stats">
        <span className="ledger-stat ledger-stat--done">已回收 {counts.done}</span>
        <span className="ledger-stat ledger-stat--pending">已埋待收 {counts.pending}</span>
        <span className="ledger-stat ledger-stat--todo">待埋设 {counts.todo}</span>
        {counts.other > 0 && <span className="ledger-stat ledger-stat--other">其它 {counts.other}</span>}
      </div>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead><tr>{ledger.header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {ledger.rows.map((r, ri) => {
              const st = statusBucket(r[statusCol] ?? '');
              return (
                <tr key={ri}>
                  {r.map((cell, ci) => {
                    if (ci === statusCol) return <td key={ci}><span className={`fs-badge fs-badge--${FORESHADOW_BADGE[st.label] ?? 'other'}`}>{cell || st.label}</span></td>;
                    const inferred = cell.includes('△');
                    return <td key={ci} className={inferred ? 'fs-inferred' : undefined}>{cell}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 状态表：人物列匹配图谱 → 可点击跳详情；生死着色；未匹配标「图谱缺档」。 */
function StatusTrackerView({ text, project, openDetail }: { text: string; project: Project; openDetail: OpenDetail }) {
  const index = charIndex(project);
  const tables = tablesOf(text);
  const st = tables.find((t) => colOf(t.header, /人物|角色/) >= 0);
  if (!st) return <MarkdownView text={text} project={project} openDetail={openDetail} />;
  const nameCol = colOf(st.header, /人物|角色/);
  const lifeCol = colOf(st.header, /生死|存活|状态/);
  return (
    <div className="doc-md doc-status">
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead><tr>{st.header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {st.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => {
                  if (ci === nameCol) {
                    const c = index.get(cell.trim());
                    return (
                      <td key={ci}>
                        {c
                          ? <span className="doc-link" title="查看人物详情" onClick={() => openDetail('character', c.id)}>{cell}</span>
                          : <span className="status-missing" title="图谱中未找到该人物">{cell || '—'}<i>缺档</i></span>}
                      </td>
                    );
                  }
                  if (ci === lifeCol) {
                    const dead = /❌|死/.test(cell);
                    const alive = /✅|在世/.test(cell);
                    return <td key={ci} className={dead ? 'life-dead' : alive ? 'life-alive' : undefined}>{cell}</td>;
                  }
                  return <td key={ci}>{cell}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const WORD_MIN = 1800;
const WORD_MAX = 2600;

/** 巡检报告：逐章六扫 → 通过/告警 chips + 字数是否落 1800–2600 校验标红。 */
function ReportView({ text, project, openDetail }: { text: string; project: Project; openDetail: OpenDetail }) {
  const tables = tablesOf(text);
  const rep = tables.find((t) => colOf(t.header, /字数/) >= 0);
  if (!rep) return <MarkdownView text={text} project={project} openDetail={openDetail} />;
  const wordCol = colOf(rep.header, /字数/);
  const conclCol = colOf(rep.header, /结论|判定/);
  const passCount = rep.rows.filter((r) => conclCol >= 0 && /通过|ok|✓/i.test(r[conclCol] ?? '')).length;
  return (
    <div className="doc-md doc-report">
      <div className="report-summary">
        <span className="chip chip--pass">通过 {passCount}</span>
        <span className="chip chip--warn">告警 {rep.rows.length - passCount}</span>
        <span className="dim">共 {rep.rows.length} 章 · 字数区间 {WORD_MIN}–{WORD_MAX}</span>
      </div>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead><tr>{rep.header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {rep.rows.map((r, ri) => {
              const w = parseInt((r[wordCol] ?? '').replace(/\D/g, ''), 10);
              const wordBad = Number.isFinite(w) && (w < WORD_MIN || w > WORD_MAX);
              const concl = conclCol >= 0 ? (r[conclCol] ?? '') : '';
              const passed = /通过|ok|✓/i.test(concl);
              return (
                <tr key={ri}>
                  {r.map((cell, ci) => {
                    if (ci === wordCol) return <td key={ci} className={wordBad ? 'word-bad' : 'word-ok'}>{cell}{wordBad ? ' ⚠' : ''}</td>;
                    if (ci === conclCol) return <td key={ci}><span className={`chip ${passed ? 'chip--pass' : 'chip--warn'}`}>{cell || (passed ? '通过' : '告警')}</span></td>;
                    return <td key={ci}>{cell}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- 分派 ---------------- */

const isPlain = (path: string) => /\.(py|json|jsonl|ya?ml|toml|js|ts|cjs|mjs|css|csv|ini|log|txt|text)$/i.test(path);

/** 依 path / category 选择语义视图；无专用视图时回落通用渲染。 */
export function DocSemanticView({ doc, project, openDetail }: { doc: ProjectDoc; project: Project; openDetail: OpenDetail }) {
  const { path, category, content } = doc;
  if (isPlain(path)) return <PlainView text={content} />;
  if (/Foreshadowing|伏笔/i.test(path) || (category === 'ledger' && /伏笔/.test(content.slice(0, 400)))) return <ForeshadowingView text={content} project={project} openDetail={openDetail} />;
  if (/Status_Tracker|状态表|人物状态/i.test(path)) return <StatusTrackerView text={content} project={project} openDetail={openDetail} />;
  if (category === 'reports' || /日更|批次|巡检/.test(path)) return <ReportView text={content} project={project} openDetail={openDetail} />;
  return <MarkdownView text={content} project={project} openDetail={openDetail} />;
}

export const categoryLabel = (c: DocCategory): string => DOC_CATEGORY_LABELS[c] ?? c;

/** 名称相似度：归一化编辑距离，1 为完全相同。 */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

export interface FuzzyMatch<T> {
  item: T;
  label: string;
  score: number;
}

/** 在候选集中找与 query 最相似的若干项（含别名时取最高分）。 */
export function bestMatches<T extends { name: string; aliases?: string[] }>(
  query: string,
  candidates: T[],
  limit = 3,
  threshold = 0.5,
): FuzzyMatch<T>[] {
  const q = query.trim();
  if (!q) return [];
  const scored: FuzzyMatch<T>[] = [];
  for (const item of candidates) {
    let score = similarity(q, item.name);
    for (const alias of item.aliases ?? []) {
      score = Math.max(score, similarity(q, alias));
    }
    if (score >= threshold) scored.push({ item, label: item.name, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

import type { EntityKind, Project } from './types';
import { entitiesOfKind } from './collections';
import { similarity } from './fuzzy';

/**
 * 一致性引擎：
 * 1. collectMentions     —— 正文已登记实体识别（含别名，最长匹配优先）
 * 2. detectUnknownNames  —— 未登记名词探测（词频 + 停用词 + 相似名联想）
 * 3. auditProject        —— 全项目体检（悬空引用/别名冲突/因果时序/近名提醒）
 */

export interface Mention {
  entityId: string;
  kind: EntityKind;
  name: string; // 命中的称呼（名字或别名）
  start: number;
  end: number;
}

export interface UnknownSuggestion {
  entityId: string;
  name: string;
  score: number; // 0-1
}

export interface UnknownCandidate {
  word: string;
  count: number;
  suggestions: UnknownSuggestion[];
}

export type IssueType = '悬空引用' | '别名冲突' | '因果时序' | '近名提醒';

export interface Issue {
  key: string; // 稳定 key，避免列表跳动
  type: IssueType;
  message: string;
  kind: EntityKind;
  entityId: string; // 可跳转修复的实体
}

// --------------------------------------------------------------- 停用词表

const STOPWORD_SOURCE = [
  '我们','你们','他们','她们','自己','什么','这个','那个','这样','那样','这些','那些','没有','不是','就是','但是','可是','然而','因为','所以','如果','虽然','而且','并且','或者','还是','只是','只有','必须','需要','应该','可能','可以','已经','正在','将要','曾经','突然','终于','竟然','居然','果然','忽然','依然','仍然','当然','果然','原来','其实','真的','确实','似乎','仿佛','好像','几乎','差不多','一起','一样','一直','一般','一切','一定','一致','所有','全部','整个','每个','各个','其他','其它','另一个人','有人','某人','大家','众人','彼此','之间','之前','之后','上面','下面','左边','右边','前面','后面','里面','外面','中间','旁边','附近','周围','到处','处处','到处都是','时候','瞬间','刹那','片刻','很久','很久','许久','片刻','一时','当时','此刻','现在','过去','未来','今天','昨天','明天','今年','去年','明年','一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一','十二','一声','一步','一眼','一丝','一点','一下','一些','一片','一道','一种','一个','两个','三个','几个','数十','无数','许多','很多','不少','如此','如何','为何','怎么','怎样','怎么样','怎么办','什么意思','说着','说着','说道','想到','看到','听到','感到','觉得','知道','明白','了解','发现','出现','消失','存在','成为','变成','变得','显得','看起来','看上去','看上去','盯着','望着','看着','看着','说道','开口','回答','问道','喊道','叫道','笑道','哭道','说道','低声','轻声','大声','急忙','连忙','赶紧','立刻','马上','顿时','随即','然后','接着','最后','最终','开始','结束','完成','继续','停止','保持','变成','眼神','目光','声音','语气','口气','脸色','表情','样子','模样','身体','身子','双手','右手','左手','眼中','心中','心里','心头','身上','脸上','手中','头顶','脚下','身边','身后','面前','眼前','距离','方向','位置','地方','之处','这里','那里','哪里','这里','那边','这边','东西','事情','事物','东西','问题','答案','办法','方法','方式','情况','状态','样子','结果','原因','理由','目的','计划','打算','决定','选择','相信','怀疑','担心','害怕','恐惧','愤怒','生气','高兴','开心','快乐','悲伤','难过','痛苦','失望','绝望','惊讶','震惊','疑惑','困惑','迷茫','无奈','苦笑','微笑','大笑','冷笑','狂笑','摇头','点头','抬头','低头','转身','回头','起身','坐下','站起','站住','走近','走远','离开','回来','到达','出发','前往','朝着','向着','冲向','飞向','落向','掉进','走进','跑出','跳出','出手','收手','放手','握住','抓住','拿起','放下','抬手','挥手','招手','摇头','举起','砸向','砍向','刺向','挡住','闪开','躲避','攻击','防御','反击','出手','全力','用力','使劲','拼命','奋力','猛地','骤然','蓦然','陡然','霎时','登时','立时','即时','旋即','继而','跟着','随着','沿着','顺着','朝着','对着','向着','冲着','往日','平日','往昔','昔日','当年','当日','今日','次日','翌日','清晨','早上','上午','中午','下午','傍晚','黄昏','深夜','半夜','午夜','今夜','昨夜','夜晚','白天','半夜三更',' noise','第一','第二','第三','第四','第五','第六','第七','第八','第九','第十','一声','两声','三声','几分','几缕','几道','几名','几个','数百','数千','上万','百万','千万','亿万','无数','全部','半个','整个','整片','全身','周身','浑身','满脸','满头','遍地','漫天','满天','一片','一抹','一缕','一股','一阵','一声','一道','一柄','一枚','一颗','一条','一只','一头','一尊','一座','一扇','一面','一幅','一双','一套','一件','一种','一样','一手','一步','一句','一段','一幕','一场','一晚','一日','一夜','一年','一月','一天','一时','一世','一生','一定','一致','一般','一起','一面','一方面','说不定','差不多','不至于','不至于','看不','看不到','听不','听不到','看不','看不见','摸不','摸不着','找不到','找不到','回不','回不去','来不及','顾不上','忍不住','不由得','不由自主','不知不觉','不知','不曾','不成','不得','不可','不能','不愿','不肯','不想','不要','不用','不用','没法','无法','无力','无能为力','无可奈何','无人','无人','没有','不会','不能','不好','不大','不小','不多','不少','不高','不低','不远','不近','不快','不慢','早晚','迟早','终究','毕竟','究竟','到底','简直','简直','几乎','差点','险些','幸亏','好在','可惜','遗憾','可惜','可惜','呵呵','哈哈','哼','嗯','啊','呀','吧','吗','呢','啦','哟','哎','哎呀','诶','喂','嗨','哦','噢','喔','咦','嘿','唉','呜','嘶','咯','叮','轰','咔','嚓','砰','啪','嗖','唰','铮','嗡','滴','哒','铃','此话','此言','此人','此事','此地','此时','此刻','此间','四下','四周围','一时间','霎时间','刹那间','瞬间','顷刻','片刻后','半晌','许久','良久','多时','长时间','很长','短短','不过','不过','只是','仅是','唯有','只有','唯有','仅剩','所剩','剩余','多余','其余','剩下','留着','保留','保存','存放','收藏','收集','收集','gather','号称','名为','叫做','称为','称作','名曰','名曰','所谓','也就是','即是','即','乃是','乃是','正是','正是','正是','便是','就是','而是','而且是','但是','却是','却是','倒是','却是','反而','反倒','反倒','反而','偏偏','偏生','偏要','非要','硬是','硬是','愣是','竟然','居然','竟','竟自','自是','自然','自然','依旧','仍然','仍是','还是','仍旧','照旧','照常','如常','依旧如故','故而','因而','从而','进而','继而','是以','是以','因此','由此','据此','据此','据此','据此','据此','据此','据此',
];

const STOPWORDS = new Set(STOPWORD_SOURCE.map((w) => w.trim()).filter((w) => w.length >= 2 && !/^[a-zA-Z]+$/.test(w)));

// --------------------------------------------------------------- 已登记提及

interface Term {
  entityId: string;
  kind: EntityKind;
  term: string;
}

/** 正文中的已登记实体提及（名字 + 别名，最长匹配优先，不重叠）。 */
export function collectMentions(project: Project, text: string): Mention[] {
  if (!text) return [];
  const terms: Term[] = [];
  const push = (kind: EntityKind) => {
    for (const e of entitiesOfKind(project, kind)) {
      if (e.name.length >= 2) terms.push({ entityId: e.id, kind, term: e.name });
      for (const alias of e.aliases) {
        if (alias.length >= 2) terms.push({ entityId: e.id, kind, term: alias });
      }
    }
  };
  (['character', 'location', 'item', 'event', 'faction'] as EntityKind[]).forEach(push);
  terms.sort((a, b) => b.term.length - a.term.length);

  const occupied = new Array<boolean>(text.length).fill(false);
  const mentions: Mention[] = [];
  for (const { entityId, kind, term } of terms) {
    let from = 0;
    for (;;) {
      const idx = text.indexOf(term, from);
      if (idx < 0) break;
      from = idx + 1;
      let free = true;
      for (let i = idx; i < idx + term.length; i++) {
        if (occupied[i]) { free = false; break; }
      }
      if (!free) continue;
      for (let i = idx; i < idx + term.length; i++) occupied[i] = true;
      mentions.push({ entityId, kind, name: term, start: idx, end: idx + term.length });
    }
  }
  mentions.sort((a, b) => a.start - b.start);
  return mentions;
}

// --------------------------------------------------------------- 未登记名词探测

const CJK_RANGE = /^[\u4e00-\u9fa5]{2,4}$/;

/** 虚词/常用字：候选词含这些字的基本不是专有名词。 */
const FUNCTION_CHARS = new Set(
  '的了着呢吗吧呀啊嘛么之乎者是在有和与跟对让给被把从向于如果但然而并且说要能可以已将正很太更最都还又只就才便即乃等也去来进出回开关闭起坐下站立走跑飞跳跃听说读写看哭笑叫喊问答吃喝玩睡醒梦生死存活没无别再先最后每次第一二三四五六七八九十百千万亿个位只条名只群批份度分钟点天年月份星期礼拜季节春夏秋冬早上晚深夜晨午昨今明后前内外东西南北中间旁侧边角底顶梢端末尾首脑心脏腹背手脚眼耳鼻嘴脸面额头肩膀胸腿足发毛皮骨血肉筋脉脏肝肺肾肠胃里'
    .split(''),
);
function isNoise(word: string): boolean {
  for (const ch of word) {
    if (FUNCTION_CHARS.has(ch)) return true;
  }
  return false;
}

/** 提取已登记称呼（名字/别名/忽略词）集合。 */
function knownTerms(project: Project): Set<string> {
  const set = new Set<string>();
  for (const kind of ['character', 'event', 'item', 'location', 'faction'] as EntityKind[]) {
    for (const e of entitiesOfKind(project, kind)) {
      set.add(e.name);
      e.aliases.forEach((a) => set.add(a));
    }
  }
  project.ignoreWords.forEach((w) => set.add(w));
  return set;
}

/** 未登记名词候选：出现 ≥2 次、不在图谱与忽略词表中的 2-4 字词。 */
export function detectUnknownNames(project: Project, text: string, topN = 12): UnknownCandidate[] {
  if (text.length < 6) return [];
  const freq = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    for (let len = 2; len <= 4 && i + len <= text.length; len++) {
      const w = text.slice(i, i + len);
      if (!CJK_RANGE.test(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  const known = knownTerms(project);
  const allEntities = (['character', 'event', 'item', 'location', 'faction'] as EntityKind[])
    .flatMap((k) => entitiesOfKind(project, k).map((e) => ({ kind: k, entity: e })));

  const candidates: UnknownCandidate[] = [];
  for (const [word, count] of freq) {
    if (count < 2) continue;
    if (STOPWORDS.has(word)) continue;
    if (isNoise(word)) continue;
    if (known.has(word)) continue;
    // 与已知词互为子串 → 大概率是已知词的碎片或延伸，跳过
    let overlap = false;
    for (const k of known) {
      if (k.includes(word) || word.includes(k)) { overlap = true; break; }
    }
    if (overlap) continue;
    const suggestions: UnknownSuggestion[] = [];
    for (const { entity } of allEntities) {
      let score = similarity(word, entity.name);
      for (const alias of entity.aliases) score = Math.max(score, similarity(word, alias));
      if (score >= 0.55) suggestions.push({ entityId: entity.id, name: entity.name, score });
    }
    suggestions.sort((a, b) => b.score - a.score);
    candidates.push({ word, count, suggestions: suggestions.slice(0, 3) });
  }
  // 互相包含的去重：「管事」⊂「赵管事」时只保留更长（信息量更大）的候选
  candidates.sort((a, b) => b.count - a.count || b.word.length - a.word.length);
  const kept: UnknownCandidate[] = [];
  for (const cand of candidates) {
    if (!kept.some((k) => k.word.includes(cand.word) && k.word !== cand.word)) {
      kept.push(cand);
    }
  }
  return kept.slice(0, topN);
}

// --------------------------------------------------------------- 全项目体检

function entityExists(project: Project, kind: EntityKind, id: string | null | undefined): boolean {
  if (!id) return true; // 空引用不算悬空
  return entitiesOfKind(project, kind).some((e) => e.id === id);
}

function checkDangling(project: Project, push: (i: Omit<Issue, 'key'> & { key?: string }) => void): void {
  const dangling = (kind: EntityKind, entityId: string, field: string, targetKind: EntityKind, targetId: string | null) => {
    if (!entityExists(project, targetKind, targetId)) {
      push({
        type: '悬空引用',
        message: `「${labelOf(project, kind, entityId)}」的${field}指向了已删除的${ kind === 'character' ? '人物' : targetKind === 'character' ? '人物' : '实体' }`,
        kind,
        entityId,
      });
    }
  };
  const labelOf = (p: Project, kind: EntityKind, id: string): string => {
    const list = entitiesOfKind(p, kind);
    const hit = list.find((e) => e.id === id);
    return hit ? hit.name : `ID:${id.slice(0, 4)}`;
  };

  for (const rel of project.relations) {
    dangling('character', rel.fromId, `与「${labelOf(project, 'character', rel.toId)}」的关系`, 'character', rel.toId);
    dangling('character', rel.toId, `与「${labelOf(project, 'character', rel.fromId)}」的关系`, 'character', rel.fromId);
  }
  for (const c of project.characters) {
    dangling('character', c.id, '所属势力', 'faction', c.factionId);
  }
  for (const ev of project.events) {
    ev.participantIds.forEach((pid) => dangling('event', ev.id, '参与人物', 'character', pid));
    dangling('event', ev.id, '地点', 'location', ev.locationId);
    ev.causeIds.forEach((cid) => dangling('event', ev.id, '前因事件', 'event', cid));
    ev.effectIds.forEach((eid) => dangling('event', ev.id, '后果事件', 'event', eid));
  }
  for (const it of project.items) {
    dangling('item', it.id, '持有者', 'character', it.ownerId);
    dangling('item', it.id, '所在位置', 'location', it.locationId);
  }
  for (const loc of project.locations) {
    dangling('location', loc.id, '上级地点', 'location', loc.parentId);
  }
  for (const f of project.factions) {
    dangling('faction', f.id, '首领', 'character', f.leaderId);
  }
}

/** 全项目一致性体检。 */
export function auditProject(project: Project): Issue[] {
  const issues: Issue[] = [];
  const push = (i: Omit<Issue, 'key'> & { key?: string }) => {
    issues.push({ key: i.key ?? `${i.type}:${i.kind}:${i.entityId}:${issues.length}`, ...i });
  };

  checkDangling(project, push);

  // 别名冲突：同一别名指向多个实体（AI 会张冠李戴）
  const aliasOwner = new Map<string, string[]>();
  const record = (kind: EntityKind, name: string, id: string) => {
    if (name.length < 2) return;
    const key = `${kind}:${name}`;
    aliasOwner.set(key, [...(aliasOwner.get(key) ?? []), id]);
  };
  for (const kind of ['character', 'event', 'item', 'location', 'faction'] as EntityKind[]) {
    for (const e of entitiesOfKind(project, kind)) {
      record(kind, e.name, e.id);
      e.aliases.forEach((a) => record(kind, a, e.id));
    }
  }
  for (const kind of ['character', 'event', 'item', 'location', 'faction'] as EntityKind[]) {
    const byName = new Map<string, string[]>();
    for (const e of entitiesOfKind(project, kind)) {
      for (const n of [e.name, ...e.aliases]) {
        if (n.length < 2) continue;
        byName.set(n, [...(byName.get(n) ?? []), e.id]);
      }
    }
    for (const [name, ids] of byName) {
      if (ids.length > 1) {
        push({
          key: `别名冲突:${kind}:${name}`,
          type: '别名冲突',
          message: `${ids.length} 个实体共用称呼「${name}」，AI 会混淆，请改名或删除多余别名`,
          kind,
          entityId: ids[0],
        });
      }
    }
  }

  // 因果时序：前因排序号大于后果
  const eventById = new Map(project.events.map((e) => [e.id, e]));
  for (const ev of project.events) {
    for (const cid of ev.causeIds) {
      const cause = eventById.get(cid);
      if (cause && cause.sortIndex > ev.sortIndex) {
        push({
          key: `因果时序:${ev.id}:${cid}`,
          type: '因果时序',
          message: `「${cause.name}」（序${cause.sortIndex}）是「${ev.name}」（序${ev.sortIndex}）的前因，但排序更靠后`,
          kind: 'event',
          entityId: ev.id,
        });
      }
    }
  }

  // 近名提醒：实体名过于相似（限制规模避免 O(n²) 过大）
  const groups: { kind: EntityKind; list: { id: string; name: string }[] }[] = [
    { kind: 'character', list: project.characters },
    { kind: 'item', list: project.items },
    { kind: 'location', list: project.locations },
    { kind: 'faction', list: project.factions },
  ];
  for (const { kind, list } of groups) {
    if (list.length > 150) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const score = similarity(list[i].name, list[j].name);
        if (score >= 0.8 && list[i].name !== list[j].name) {
          push({
            key: `近名提醒:${kind}:${list[i].id}:${list[j].id}`,
            type: '近名提醒',
            message: `「${list[i].name}」与「${list[j].name}」名字过近（${Math.round(score * 100)}%），建议设置别名区分或改名`,
            kind,
            entityId: list[i].id,
          });
        }
      }
    }
  }

  return issues;
}

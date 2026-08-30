import type { Project } from './types';
import { newId } from './id';

/**
 * 示例作品《九州烟云》：首次使用自动载入，
 * 覆盖全部功能演示（图谱/轨迹/一致性提示中的「赵管事」为刻意埋入的未登记名词）。
 */

const now = Date.now();
const t = (id: string) => `${id}`;

export function createSeedProject(): Project {
  const projectId = newId();
  return {
    id: projectId,
    name: '九州烟云',
    genre: '东方玄幻',
    description: '少年林霄拜入青云剑宗，携玄天令之秘，卷入正邪两道千年棋局。',
    createdAt: now,
    updatedAt: now,
    ignoreWords: [],
    settings: { ai: { baseUrl: '', apiKey: '', model: '' } },
    factions: [
      { id: t('f-qingyun'), name: '青云剑宗', aliases: ['青云门'], description: '正道魁首，坐镇青云山八百年，以剑道冠绝九州。', tags: ['正道'], type: '宗门', leaderId: t('c-xuanqingzi'), stance: '正道', createdAt: now, updatedAt: now },
      { id: t('f-youming'), name: '幽冥教', aliases: ['幽冥'], description: '盘踞幽冥谷的邪道势力，行事诡秘，近年来频繁渗透中原。', tags: ['邪道'], type: '组织', leaderId: t('c-tujiu'), stance: '邪道', createdAt: now, updatedAt: now },
      { id: t('f-dali'), name: '大离皇朝', aliases: ['大离'], description: '中原第一王朝，皇城气象森严，与各大宗门貌合神离。', tags: ['世俗'], type: '王朝', leaderId: null, stance: '中立', createdAt: now, updatedAt: now },
    ],
    locations: [
      { id: t('l-qingyunshan'), name: '青云山', aliases: ['青云'], description: '青云剑宗山门所在，主峰问剑峰终年云雾缭绕。', tags: [], region: '东洲', parentId: null, createdAt: now, updatedAt: now },
      { id: t('l-luoxia'), name: '落霞镇', aliases: [], description: '青云山脚的小镇，林霄的故乡，也是血案的起点。', tags: [], region: '东洲', parentId: null, createdAt: now, updatedAt: now },
      { id: t('l-youminggu'), name: '幽冥谷', aliases: [], description: '终年不见天日的深谷，幽冥教总坛所在。', tags: ['禁地'], region: '南疆', parentId: null, createdAt: now, updatedAt: now },
      { id: t('l-huangcheng'), name: '皇城', aliases: ['大离皇城'], description: '大离皇朝都城，人烟百万，暗流涌动。', tags: [], region: '中州', parentId: null, createdAt: now, updatedAt: now },
      { id: t('l-jianzhong'), name: '剑冢', aliases: ['青云剑冢'], description: '青云山后山禁地，历代剑修埋剑之处，机关重重。', tags: ['禁地'], region: '东洲', parentId: t('l-qingyunshan'), createdAt: now, updatedAt: now },
    ],
    characters: [
      {
        id: t('c-linxiao'), name: '林霄', aliases: ['霄少', '小霄'], description: '身负玄天令之秘的少年剑客。', tags: ['剑修'],
        role: '主角', gender: '男', age: '16', factionId: t('f-qingyun'), status: '在世',
        appearance: '剑眉星目，身形挺拔，左手掌心有一枚青色令状胎记。',
        personality: '外冷内热，重情重义，遇强则强，认定的事九头牛拉不回。',
        background: '落霞镇猎户之子，镇子血案后拜入青云剑宗，身世与玄天令息息相关。',
        goals: '查清落霞镇血案真相，守护身边之人，登上剑道之巅。',
        avatar: 'nz.png', attributes: { power: 78, wisdom: 62, charm: 70, will: 88, fortune: 92 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-suyingxue'), name: '苏映雪', aliases: ['映雪'], description: '医武双修的大家闺秀。', tags: ['医道'],
        role: '配角', gender: '女', age: '15', factionId: null, status: '在世',
        appearance: '一袭素白衣裙，眉眼如画，腰间悬一只青玉药箱。',
        personality: '温婉聪慧，外柔内刚，医者仁心却有主见。',
        background: '药谷传人，游历九州历练医道，落霞镇血案中与林霄相识。',
        goals: '寻回失传的《青囊残卷》，查清师门旧案。',
        avatar: null, attributes: { power: 45, wisdom: 85, charm: 92, will: 70, fortune: 66 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-muchangfeng'), name: '慕长风', aliases: ['长风师兄'], description: '青云门大师兄，天资卓绝却心术不正。', tags: ['剑修'],
        role: '反派', gender: '男', age: '21', factionId: t('f-qingyun'), status: '在世',
        appearance: '白衣负剑，笑容温润，眼底偶有阴鸷一闪而过。',
        personality: '骄傲自负，极度渴望认可，不甘居于人下。',
        background: '宗门内定的下一任首席，宗门大比失利后心态失衡，被幽冥教趁虚而入。',
        goals: '证明自己才是青云第一人，不惜一切代价。',
        avatar: null, attributes: { power: 82, wisdom: 74, charm: 76, will: 55, fortune: 48 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-xuanqingzi'), name: '玄清子', aliases: ['老宗主'], description: '青云剑宗宗主，林霄的授业恩师。', tags: ['剑修'],
        role: '配角', gender: '男', age: '三百二十岁', factionId: t('f-qingyun'), status: '在世',
        appearance: '鹤发童颜，常着青色道袍，佩一柄无鞘古剑。',
        personality: '威严正直，护短，对青云山以外的世人近乎苛刻。',
        background: '百年前曾重创幽冥教主，深知玄天令的秘密，对林霄的来历守口如瓶。',
        goals: '保住青云剑宗气运，守住玄天令的秘密直到最后一刻。',
        avatar: null, attributes: { power: 95, wisdom: 90, charm: 60, will: 92, fortune: 40 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-tieniu'), name: '铁牛', aliases: ['牛哥'], description: '憨厚耿直的同门师兄，林霄最早的朋友。', tags: [],
        role: '配角', gender: '男', age: '18', factionId: t('f-qingyun'), status: '在世',
        appearance: '虎背熊腰，皮肤黝黑，笑起来一口白牙。',
        personality: '直肠子，讲义气，力大无穷却怕师父骂。',
        background: '猎户出身，与林霄同期入门，修的是外门横练功夫。',
        goals: '陪着兄弟闯出个名堂，光宗耀祖。',
        avatar: null, attributes: { power: 88, wisdom: 40, charm: 62, will: 80, fortune: 58 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-tujiu'), name: '血手屠九', aliases: ['屠九'], description: '幽冥教左坛主，落霞镇血案元凶。', tags: ['邪道'],
        role: '反派', gender: '男', age: '不详', factionId: t('f-youming'), status: '在世',
        appearance: '常年戴青铜鬼面，双手泛着暗红色尸斑。',
        personality: '嗜血残忍，却对幽冥教主忠心耿耿。',
        background: '奉命寻夺玄天令，血洗落霞镇，是林霄必须手刃的仇人。',
        goals: '夺回玄天令，献予幽冥教主，换取晋升右使。',
        avatar: null, attributes: { power: 90, wisdom: 66, charm: 20, will: 72, fortune: 35 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-yunmengyao'), name: '云梦瑶', aliases: ['梦瑶公主'], description: '大离皇朝郡主，深不可测的棋手。', tags: ['皇族'],
        role: '配角', gender: '女', age: '19', factionId: t('f-dali'), status: '在世',
        appearance: '金冠束发，华服烈艳，眼波流转间机锋暗藏。',
        personality: '八面玲珑，善于布局，心中自有丘壑。',
        background: '奉皇命监察各大宗门，对玄天令同样志在必得。',
        goals: '以玄天令为筹码，为大离皇朝搏一条新路。',
        avatar: null, attributes: { power: 52, wisdom: 93, charm: 88, will: 68, fortune: 75 },
        createdAt: now, updatedAt: now,
      },
      {
        id: t('c-qinlao'), name: '秦老', aliases: [], description: '寄居玄天令中的神秘老者。', tags: ['谜团'],
        role: '配角', gender: '男', age: '不详', factionId: null, status: '未知',
        appearance: '虚影缥缈，看不清面容，只余一缕苍老叹息。',
        personality: '惜字如金，偶有点拨，似乎在等一个人。',
        background: '自称"故人"，知晓千年前正邪大战的真相，与玄天令来历直接相关。',
        goals: '不明。',
        avatar: null, attributes: { power: 99, wisdom: 99, charm: 50, will: 99, fortune: 10 },
        createdAt: now, updatedAt: now,
      },
    ],
    relations: [
      { id: newId(), fromId: t('c-linxiao'), toId: t('c-xuanqingzi'), type: '师徒', strength: 5, note: '落霞镇血案后拜入青云门' },
      { id: newId(), fromId: t('c-linxiao'), toId: t('c-suyingxue'), type: '恋人', strength: 4, note: '落霞镇初遇，同历生死' },
      { id: newId(), fromId: t('c-linxiao'), toId: t('c-tieniu'), type: '挚友', strength: 5, note: '同期入门的猎户兄弟' },
      { id: newId(), fromId: t('c-linxiao'), toId: t('c-muchangfeng'), type: '同门', strength: 2, note: '宗门大比后渐生嫌隙' },
      { id: newId(), fromId: t('c-linxiao'), toId: t('c-tujiu'), type: '敌对', strength: 5, note: '灭镇之仇，不共戴天' },
      { id: newId(), fromId: t('c-muchangfeng'), toId: t('c-xuanqingzi'), type: '师徒', strength: 3, note: '大师兄，一度最被看好' },
      { id: newId(), fromId: t('c-muchangfeng'), toId: t('c-tujiu'), type: '其他', strength: 3, note: '暗中勾结，后被幽冥教拉拢' },
      { id: newId(), fromId: t('c-tujiu'), toId: t('c-xuanqingzi'), type: '敌对', strength: 4, note: '百年恩怨的延续' },
      { id: newId(), fromId: t('c-yunmengyao'), toId: t('c-linxiao'), type: '其他', strength: 3, note: '亦敌亦友的博弈者' },
      { id: newId(), fromId: t('c-linxiao'), toId: t('c-qinlao'), type: '其他', strength: 2, note: '玄天令中的神秘指引' },
      { id: newId(), fromId: t('c-tieniu'), toId: t('c-suyingxue'), type: '挚友', strength: 2, note: '苏映雪救过铁牛的命' },
    ],
    events: [
      { id: t('e1'), name: '林霄拜入青云门', aliases: [], description: '落霞镇血案后，林霄带着玄天令投奔青云剑宗，玄清子力排众议收其为徒。', tags: [], timeLabel: '第一年·秋', sortIndex: 1, locationId: t('l-qingyunshan'), participantIds: [t('c-linxiao'), t('c-xuanqingzi'), t('c-tieniu')], causeIds: [], effectIds: [t('e2')], importance: 5, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e2'), name: '落霞镇初遇苏映雪', aliases: [], description: '入门途中林霄在落霞镇救治受伤的苏映雪，两人结识。', tags: [], timeLabel: '第一年·秋', sortIndex: 2, locationId: t('l-luoxia'), participantIds: [t('c-linxiao'), t('c-suyingxue'), t('c-tieniu')], causeIds: [t('e1')], effectIds: [t('e4')], importance: 3, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e3'), name: '获得玄天令', aliases: [], description: '林霄在祖屋地窖中发现玄天令，秦老的虚影首次出现并留下警告。', tags: [], timeLabel: '第一年·秋', sortIndex: 3, locationId: t('l-luoxia'), participantIds: [t('c-linxiao'), t('c-qinlao')], causeIds: [], effectIds: [t('e4'), t('e7')], importance: 5, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e4'), name: '幽冥教夜袭落霞镇', aliases: [], description: '血手屠九率众血洗落霞镇搜寻玄天令，林霄与苏映雪死里逃生。', tags: [], timeLabel: '第一年·冬', sortIndex: 4, locationId: t('l-luoxia'), participantIds: [t('c-linxiao'), t('c-suyingxue'), t('c-tujiu')], causeIds: [t('e2'), t('e3')], effectIds: [t('e5')], importance: 5, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e5'), name: '玄清子重伤', aliases: [], description: '玄清子赶至救援，与屠九激战后虽退敌，自己也被幽冥鬼气反噬重伤。', tags: [], timeLabel: '第一年·冬', sortIndex: 5, locationId: t('l-luoxia'), participantIds: [t('c-xuanqingzi'), t('c-tujiu'), t('c-linxiao')], causeIds: [t('e4')], effectIds: [t('e6')], importance: 4, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e6'), name: '林霄剑冢得青莲剑', aliases: [], description: '为救师父，林霄闯青云剑冢，历经剑气洗礼，得前世剑修遗泽青莲剑。', tags: [], timeLabel: '第二年·春', sortIndex: 6, locationId: t('l-jianzhong'), participantIds: [t('c-linxiao'), t('c-qinlao')], causeIds: [t('e5')], effectIds: [t('e7')], importance: 4, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e7'), name: '宗门大比夺魁', aliases: [], description: '林霄以黑马之姿击败慕长风夺魁，玄天令秘密在宗门内初现端倪。', tags: [], timeLabel: '第二年·夏', sortIndex: 7, locationId: t('l-qingyunshan'), participantIds: [t('c-linxiao'), t('c-muchangfeng'), t('c-tieniu'), t('c-xuanqingzi')], causeIds: [t('e6'), t('e3')], effectIds: [t('e8'), t('e9')], importance: 5, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e8'), name: '幽冥谷探秘', aliases: [], description: '林霄、苏映雪与铁牛潜入幽冥谷外围，发现幽冥教正在布置血魂大阵。', tags: [], timeLabel: '第二年·秋', sortIndex: 8, locationId: t('l-youminggu'), participantIds: [t('c-linxiao'), t('c-suyingxue'), t('c-tieniu'), t('c-tujiu')], causeIds: [t('e7')], effectIds: [t('e10')], importance: 4, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e9'), name: '慕长风叛门', aliases: [], description: '大比失利后慕长风心态失衡，盗走宗门剑谱叛投幽冥教。', tags: [], timeLabel: '第二年·秋', sortIndex: 9, locationId: t('l-qingyunshan'), participantIds: [t('c-muchangfeng'), t('c-tujiu'), t('c-xuanqingzi')], causeIds: [t('e7')], effectIds: [t('e10')], importance: 5, chapterId: null, createdAt: now, updatedAt: now },
      { id: t('e10'), name: '血战幽冥教主', aliases: [], description: '血魂大阵将成，正邪两道在幽冥谷决战，玄天令秘密彻底揭开。', tags: [], timeLabel: '第三年·春', sortIndex: 10, locationId: t('l-youminggu'), participantIds: [t('c-linxiao'), t('c-suyingxue'), t('c-tieniu'), t('c-muchangfeng'), t('c-tujiu'), t('c-yunmengyao'), t('c-xuanqingzi')], causeIds: [t('e8'), t('e9')], effectIds: [], importance: 5, chapterId: null, createdAt: now, updatedAt: now },
    ],
    items: [
      { id: t('i-qinglian'), name: '青莲剑', aliases: [], description: '剑冢中诞生的灵剑，剑身青莲纹路，遇血则鸣。', tags: ['灵剑'], type: '灵剑', rarity: '史诗', ownerId: t('c-linxiao'), locationId: t('l-jianzhong'), origin: '青云剑冢历代剑修遗泽', status: '认主', createdAt: now, updatedAt: now },
      { id: t('i-xuantianling'), name: '玄天令', aliases: ['青色令状'], description: '千年前的正邪两道争夺之物，内封秦老残魂，是全书最大伏笔。', tags: ['核心伏笔'], type: '信物', rarity: '传说', ownerId: t('c-linxiao'), locationId: t('l-luoxia'), origin: '林家祖屋地窖', status: '封印中', createdAt: now, updatedAt: now },
      { id: t('i-huichun'), name: '回春丹', aliases: [], description: '苏映雪所炼疗伤圣药，可吊住重伤之人一缕生机。', tags: [], type: '丹药', rarity: '稀有', ownerId: t('c-suyingxue'), locationId: null, origin: '药谷秘方', status: '存量三枚', createdAt: now, updatedAt: now },
      { id: t('i-guimian'), name: '幽冥鬼面', aliases: ['青铜鬼面'], description: '血手屠九的面具，幽冥教左坛主信物，戴之可匿气息。', tags: ['邪物'], type: '法器', rarity: '稀有', ownerId: t('c-tujiu'), locationId: t('l-youminggu'), origin: '幽冥教祖师所铸', status: '完好', createdAt: now, updatedAt: now },
    ],
    chapters: [
      {
        id: t('ch1'), title: '第一章 山门雪', order: 1, status: '已完成', updatedAt: now, synopsis: '林霄携玄天令冒雪投奔青云山，赵管事百般刁难，铁牛仗义相助，最终惊动玄清子收徒。',
        content: [
          '青云山的雪，一下就是三天。',
          '林霄站在山门外的石阶上，怀里的玄天令隔着粗布衣裳硌得胸口生疼。三个月前，落霞镇还是炊烟袅袅的鱼米之乡；三个月后，他只剩下怀里这一枚青色令状，和一身没处说的血仇。',
          '"哪来的野小子，也配登青云山的门？"守门执事斜着眼打量他。负责登记杂役的赵管事更是把名册一合："今年的名额早满了，下山去吧。"',
          '赵管事在一旁嗤笑："落霞镇来的泥腿子，也配姓林？"',
          '林霄不说话，只是站着。雪落满肩头，他就那么站着，像一杆被雪压弯却始终没折断的枪。',
          '"我叫铁牛，外门弟子。"一个虎背熊腰的少年挤到栅栏边，压低声音，"兄弟，你这眼神，跟我当年进山时一模一样。听着，问剑峰上的玄清子老宗主今夜子时要巡山，你若能在他面前站住一炷香——"',
          '子夜，雪更大了。玄清子踏雪而来，鹤发童颜，目光如电。他在林霄面前站定，盯着这个冻得嘴唇发紫却纹丝不动的少年，忽然问："落霞镇林家，还留有后人？"',
          '林霄猛地抬头，怀中玄天令无风自热。',
        ].join('\n\n'),
      },
      {
        id: t('ch2'), title: '第二章 落霞夜变', order: 2, status: '写作中', updatedAt: now, synopsis: '回溯落霞镇血案：血手屠九夜袭小镇，苏映雪挺身救人，玄清子驰援退敌却身受鬼气反噬。',
        content: [
          '三个月前，落霞镇。',
          '血手屠九踏进镇口时，连狗都不敢叫了。青铜鬼面之下，暗红色的尸气顺着街面蔓延，所过之处，灯火一盏盏熄灭。',
          '"交出玄天令，留你全镇性命。"鬼面之后的声音像砂纸摩擦。',
          '回答他的，是破空而来的一枚银针。苏映雪一袭素衣立在医馆屋脊上，腰间青玉药箱大开："采生魂炼邪阵，也配叫修行？"',
          '那一夜的厮杀持续到天明。苏映雪拼着经脉受损救下七名孩童，最后是闻讯赶来的玄清子一剑震退屠九。只是没人看见，退走时鬼面下那双眼睛，把林霄的模样刻进了心里。',
          '"师父，您的手……"林霄扶住摇摇欲坠的玄清子，触到一只冰得吓人的手。幽冥鬼气顺着掌心往上爬，青玉药箱里最后一枚回春丹，也只能吊住这一缕生机。',
        ].join('\n\n'),
      },
      {
        id: t('ch3'), title: '第三章 剑冢青莲', order: 3, status: '草稿', updatedAt: now, synopsis: '为救师父，林霄闯剑冢求剑，历经剑气洗礼得到青莲剑；慕长风观望妒火中烧，云梦瑶初现端倪。',
        content: [
          '剑冢的石门比传说中更冷。',
          '秦老的叹息在识海里响起："此地埋葬的不是剑，是人。小子，你确定要进？"',
          '"师父的伤等不起。"林霄吐出八个字，抬脚跨入。',
          '万剑齐鸣。剑气如潮水般涌来，把他整个人淹没。恍惚间，他看见一柄通体青色的古剑在冢底苏醒，莲纹流转，似有清风明月。',
          '石门外，慕长风负手而立，望着门缝里透出的青光，指节一点点攥白。他修行十九年，从未被允许踏入剑冢半步——这个入门不足一年的野小子，凭什么？',
          '"大师兄好雅兴。"一道清脆嗓音自山道传来。云梦瑶金冠华服，摇着团扇款款而来，"皇城使节观礼在即，大师兄不去准备，倒在这后山看雪？"',
          '慕长风收回目光，笑容温润如常："郡主说笑了。"',
          '冢底，青莲剑破土而出，剑鸣如龙吟，震动青云山。',
        ].join('\n\n'),
      },
    ],
  };
}

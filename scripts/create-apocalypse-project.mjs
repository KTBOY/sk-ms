/**
 * 建库脚本：把第二部作品《天灾末世：我囤的物资百倍刷新》的「框架骨架」
 * 直接建进桌面端作品库（data/projects/<id>.json）。
 *
 * 只搭框架不写正文：全部章节 status=草稿、content 为空，synopsis 即分章大纲；
 * 人物/势力/地点/物品/事件/分卷一次性入库，墨枢的设定集(ATLAS)、时间线、
 * 关系图谱、写作台、分卷管理随之实时渲染出「给作者看的框架视图」。
 *
 * 可重复运行：同名作品已存在则跳过；写入后自动做引用完整性校验。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = path.join(root, 'data', 'projects');

// ---------- 基础信息 ----------
const BOOK = {
  name: '天灾末世：我囤的物资百倍刷新',
  genre: '末世求生',
  description:
    '末世爆发前七十二小时，仓储主管陈野的手机里多出一张「结算面板」：凡他囤下的物资，灾变当日百倍刷新。' +
    '极寒、尸潮、酸雨接踵而至，别人为一瓶矿泉水拼命，他领着队伍搬进了会升级的安全屋。' +
    '——囤货流＋安全屋基建＋末日预报节拍器，晶核复利滚雪球，越苟越强。',
};

const ID = 'msJinShouZhi1'; // 作品主键（文件名安全字符）

// ---------- 时间戳 ----------
const now = Date.now();
const t = (id) => id; // 框架期用可读 ID，与种子工程同风格

// ---------- 人物 ----------
const characters = [
  {
    id: t('c-chenye'), name: '陈野', aliases: ['野哥', '陈主管'], description: '手握「结算面板」的末世囤货流主角。',
    tags: ['囤货流', '基建流'], role: '主角', gender: '男', age: '27', factionId: t('f-qingyang'), status: '在世',
    appearance: '中等身材，常穿洗旧的工装外套，眼神沉稳，右手虎口有常年搬货磨出的厚茧。',
    personality: '谨慎务实，精打细算，护短；不轻信人，但认定的伙伴绝不撒手。',
    background: '江州城南仓储物流园理货主管，退伍两年，熟知货道与临期品渠道。灾变前七十二小时觉醒「结算面板」。',
    goals: '用百倍刷新在末世活下去，把安全屋建成末世方舟，查明「回声计划」与面板的来历。',
    avatar: null, attributes: { power: 55, wisdom: 82, charm: 60, will: 88, fortune: 95 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-sunian'), name: '苏念', aliases: ['苏医生'], description: '急诊科医生出身，据点医疗体系搭建者。',
    tags: ['医疗', '女主'], role: '配角', gender: '女', age: '26', factionId: t('f-qingyang'), status: '在世',
    appearance: '高马尾，白大褂换成冲锋衣，随身药箱从不离手。',
    personality: '外冷内热，理性到近乎冷峻，医者仁心藏在行动里。',
    background: '市一院急诊科医生，尸潮之夜在撤离点与陈野相识，以医疗物资入伙。',
    goals: '建立末世医疗体系，破解病毒变异规律，守护小满。',
    avatar: null, attributes: { power: 40, wisdom: 88, charm: 85, will: 80, fortune: 60 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-zhoushan'), name: '周铁山', aliases: ['老周', '周工'], description: '退伍工程兵，安全屋基建总工。',
    tags: ['基建', '老兵'], role: '配角', gender: '男', age: '45', factionId: t('f-qingyang'), status: '在世',
    appearance: '寸头花白，肩背宽厚，左手小指缺一截。',
    personality: '话少手稳，认死理，把据点当命根子。',
    background: '原市政工程抢险队队长，仓储园保卫战后带队入伙。',
    goals: '给据点修出铁桶一样的防线，替牺牲的弟兄看着堡垒立起来。',
    avatar: null, attributes: { power: 70, wisdom: 65, charm: 55, will: 85, fortune: 50 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-wangdapeng'), name: '王大鹏', aliases: ['王胖子', '胖子'], description: '主角发小，社区超市老板，物资线担当。',
    tags: ['后勤', '气氛组'], role: '配角', gender: '男', age: '28', factionId: t('f-qingyang'), status: '在世',
    appearance: '体格敦实，圆脸小眼，末世后瘦了两圈依然圆。',
    personality: '嘴碎心热，胆小却关键时刻不掉链子。',
    background: '陈野发小，连锁社区超市加盟商，囤货期的执行人。',
    goals: '在末世把超市重新开起来，让弟兄们顿顿热食。',
    avatar: null, attributes: { power: 30, wisdom: 55, charm: 70, will: 60, fortune: 75 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-xiaoman'), name: '陈小满', aliases: ['小满'], description: '病毒完全免疫体质的女孩，抗体母体（核心伏笔）。',
    tags: ['免疫体质', '伏笔'], role: '配角', gender: '女', age: '10', factionId: t('f-qingyang'), status: '在世',
    appearance: '瘦小黝黑，扎两个歪辫子，怀里总抱着一只缺耳朵的布兔子。',
    personality: '早熟懂事，安静得让人心疼，笑起来却亮。',
    background: '尸潮之夜的幸存孤儿，从超市废墟被救回；被咬不感染，体内抗体是全人类的解药钥匙。',
    goals: '不再弄丢任何一个家人。',
    avatar: null, attributes: { power: 15, wisdom: 50, charm: 80, will: 70, fortune: 98 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-hanxue'), name: '韩雪', aliases: ['韩长官'], description: '曙光基地联络官，亦敌亦友的官方代表。',
    tags: ['官方', '博弈'], role: '配角', gender: '女', age: '28', factionId: t('f-shuguang'), status: '在世',
    appearance: '作训服一丝不苟，腰间别着制式军刺。',
    personality: '原则至上，公私分明，在命令与良知之间反复拉扯。',
    background: '军方残存势力曙光基地的对外联络官，负责民间据点「征召」。',
    goals: '重建末世秩序；在基地倾轧中守住底线。',
    avatar: null, attributes: { power: 62, wisdom: 75, charm: 78, will: 82, fortune: 55 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-zhaotianhao'), name: '赵天豪', aliases: ['秃鹫'], description: '掠夺者「秃鹫团」首领，前期主反派。',
    tags: ['掠夺者'], role: '反派', gender: '男', age: '38', factionId: t('f-tuyuan'), status: '在世',
    appearance: '光头刀疤，皮甲上钉满金属牌（每块是一支被他吞掉的队伍）。',
    personality: '狼群逻辑，信奉弱肉强食，狡诈远胜蛮勇。',
    background: '前二手房产中介，世纪初花园业委会主任，靠信息差与狠辣在末世吞并幸存者队伍。',
    goals: '吞下青杨堡垒与仓储物资，做江州王。',
    avatar: null, attributes: { power: 65, wisdom: 70, charm: 66, will: 72, fortune: 40 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-shenjiming'), name: '沈既明', aliases: ['沈教授'], description: '方舟生物首席研究员，「回声计划」主持人，病毒缔造者。',
    tags: ['幕后黑手', '科研'], role: '反派', gender: '男', age: '52', factionId: t('f-fangzhou'), status: '在世',
    appearance: '银发一丝不乱，金丝眼镜，白大褂永远干净得不像末世的人。',
    personality: '绝对理性的疯狂，视病毒为「进化的钥匙」，以人类为培养基。',
    background: '「回声计划」首席科学家，原始株泄漏事故的真正责任人。',
    goals: '借尸潮完成「定向进化」，回收小满（抗体母体）。',
    avatar: null, attributes: { power: 35, wisdom: 96, charm: 50, will: 90, fortune: 30 },
    createdAt: now, updatedAt: now,
  },
  {
    id: t('c-linghao'), name: '零号', aliases: ['尸王', '零号体'], description: '尸潮主宰，原始株首个完全体感染者。',
    tags: ['尸王', '大反派'], role: '反派', gender: '男', age: '不详', factionId: t('f-huisheng'), status: '在世',
    appearance: '人形轮廓，周身覆黑色甲壳，胸口残留一件烧融的白大褂。',
    personality: '残存人类意识的捕食本能，会「学习」——越战越强的尸潮大脑。',
    background: '由「回声」原始株感染者异变而成，与小满抗体同源（伏笔：同一实验的阴与阳）。',
    goals: '吞噬同类进化，寻找「不能感染的猎物」——小满。',
    avatar: null, attributes: { power: 99, wisdom: 60, charm: 5, will: 99, fortune: 20 },
    createdAt: now, updatedAt: now,
  },
];

// ---------- 势力 ----------
const factions = [
  {
    id: t('f-qingyang'), name: '青杨堡垒', aliases: ['一号安全屋'], description: '陈野以「结算面板」物资建起的民间据点。',
    tags: ['主角据点'], type: '组织', leaderId: t('c-chenye'), stance: '中立·自保',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('f-shuguang'), name: '曙光基地', aliases: ['曙光'], description: '军方残存势力，据守西郊青龙山水库坝区，正「征召」民间据点。',
    tags: ['官方'], type: '组织', leaderId: null, stance: '官方秩序',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('f-tuyuan'), name: '秃鹫团', aliases: ['秃鹫'], description: '赵天豪的掠夺者团伙，专吞幸存者队伍与物资。',
    tags: ['掠夺者'], type: '组织', leaderId: t('c-zhaotianhao'), stance: '掠夺',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('f-huisheng'), name: '回声教团', aliases: ['教团'], description: '崇拜病毒的邪教，奉零号为「新世之神」，渗透各据点。',
    tags: ['邪教'], type: '组织', leaderId: null, stance: '极端崇拜',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('f-fangzhou'), name: '方舟生物', aliases: ['方舟'], description: '末世前生物医药巨头，病毒源头，「回声计划」的操盘者。',
    tags: ['幕后黑手'], type: '组织', leaderId: t('c-shenjiming'), stance: '幕后黑手',
    createdAt: now, updatedAt: now,
  },
];

// ---------- 地点 ----------
const locations = [
  {
    id: t('l-jiangzhou'), name: '江州市', aliases: ['江州'], description: '华东二线城市，故事起点，灾变后沦为尸潮腹地。',
    tags: [], region: '华东', parentId: null, createdAt: now, updatedAt: now,
  },
  {
    id: t('l-cangchu'), name: '城南仓储物流园', aliases: ['仓储园'], description: '陈野的工作地，百亿物资首秀战场，百倍结算触发点。',
    tags: ['开局地图'], region: '华东', parentId: t('l-jiangzhou'), createdAt: now, updatedAt: now,
  },
  {
    id: t('l-shiji'), name: '世纪花园小区', aliases: [], description: '陈野住所，撤离起点；赵天豪起家的地盘。',
    tags: [], region: '华东', parentId: t('l-jiangzhou'), createdAt: now, updatedAt: now,
  },
  {
    id: t('l-daxue'), name: '江州大学', aliases: [], description: '物资点兼丧尸巢，图书馆地下藏有抗体研究笔记。',
    tags: ['物资点'], region: '华东', parentId: t('l-jiangzhou'), createdAt: now, updatedAt: now,
  },
  {
    id: t('l-qingyang'), name: '青杨镇', aliases: [], description: '江州郊野小镇，据点所在，控出城国道咽喉。',
    tags: ['据点'], region: '江州郊野', parentId: null, createdAt: now, updatedAt: now,
  },
  {
    id: t('l-anquanwu'), name: '一号安全屋', aliases: ['安全屋'], description: '结算面板外化的可升级庇护所：水电网、农田、工厂、防御塔逐级解锁。',
    tags: ['金手指产物'], region: '江州郊野', parentId: t('l-qingyang'), createdAt: now, updatedAt: now,
  },
  {
    id: t('l-shuguangbase'), name: '青龙山水库坝区', aliases: ['曙光基地'], description: '曙光基地所在，借水坝水电梯级苟住的官方堡垒。',
    tags: ['官方据点'], region: '西郊', parentId: null, createdAt: now, updatedAt: now,
  },
  {
    id: t('l-baiyi'), name: '白疫研究所', aliases: ['回声计划总部'], description: '方舟生物绝密实验室，病毒源头，最终真相所在（禁地）。',
    tags: ['禁地', '真相之地'], region: '西郊', parentId: null, createdAt: now, updatedAt: now,
  },
];

// ---------- 物品 ----------
const items = [
  {
    id: t('i-panel'), name: '结算面板', aliases: ['面板', '金手指'], description: '绑定陈野意识的系统界面：囤入物资百倍刷新，附带「末日预报」。',
    tags: ['金手指'], type: '系统', rarity: '唯一', ownerId: t('c-chenye'), locationId: null,
    origin: '来历不明（疑与「回声计划」同源，核心伏笔）', status: '绑定中',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('i-jinghe'), name: '晶核', aliases: ['尸晶'], description: '变异体脑部凝结的能量结晶，末世硬通货，可投入面板复利刷新。',
    tags: ['货币'], type: '能量', rarity: '常见', ownerId: null, locationId: null,
    origin: '丧尸/变异体脑部凝结', status: '流通',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('i-xueqing'), name: '免疫血清', aliases: ['抗体药剂'], description: '小满血液提纯的抗体药剂，各方争夺的解药钥匙。',
    tags: ['麦高芬'], type: '医疗', rarity: '史诗', ownerId: t('c-sunian'), locationId: null,
    origin: '小满血液提纯', status: '试验阶段',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('i-heilin'), name: '黑鳞甲', aliases: [], description: '变异蜥蜴鳞片＋面板图纸打造的重甲，据点战力象征。',
    tags: ['防具'], type: '防具', rarity: '稀有', ownerId: t('c-chenye'), locationId: null,
    origin: '猎杀变异蜥蜴后由面板图纸铸造', status: '在役',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('i-wurenji'), name: '蜂鸟无人机', aliases: [], description: '侦察无人机，末日预报的「眼睛」，尸潮预警担当。',
    tags: ['装备'], type: '装备', rarity: '稀有', ownerId: t('c-chenye'), locationId: null,
    origin: '百倍刷新产出的电子库存', status: '在役',
    createdAt: now, updatedAt: now,
  },
  {
    id: t('i-huisheng'), name: '「回声」原始株样本', aliases: ['回声样本'], description: '方舟生物绝密病毒株，一切灾变的原点。',
    tags: ['麦高芬', '机密'], type: '机密', rarity: '传说', ownerId: t('c-shenjiming'), locationId: t('l-baiyi'),
    origin: '方舟生物「回声计划」实验产物', status: '封存',
    createdAt: now, updatedAt: now,
  },
];

// ---------- 事件（时间线＋因果链） ----------
const events = [
  {
    id: t('e-huisheng'), name: '回声泄漏', aliases: [], description: '方舟生物白疫研究所事故，原始株外泄，一切灾变的原点。',
    tags: ['真相线'], timeLabel: '灾变前30天', sortIndex: 1, locationId: t('l-baiyi'),
    participantIds: [t('c-shenjiming')], causeIds: [], effectIds: [t('e-juexing')], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-juexing'), name: '觉醒结算面板', aliases: [], description: '陈野加班夜收到黑色面板与末日预报：72小时后尸潮爆发。',
    tags: ['金手指'], timeLabel: '灾变前72小时', sortIndex: 2, locationId: t('l-cangchu'),
    participantIds: [t('c-chenye')], causeIds: [t('e-huisheng')], effectIds: [t('e-tunhuo')], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-tunhuo'), name: '全城囤货', aliases: [], description: '七十二小时倒计时，扫空卖场与仓储园尾货，压上全部身家。',
    tags: ['囤货流'], timeLabel: '灾变前3天', sortIndex: 3, locationId: t('l-jiangzhou'),
    participantIds: [t('c-chenye'), t('c-wangdapeng')], causeIds: [t('e-juexing')], effectIds: [t('e-baofa')], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-baofa'), name: '尸潮之夜', aliases: ['灾变日'], description: '零点病毒爆发全城尸变；百倍结算触发，仓库爆出物资山。',
    tags: ['大事件'], timeLabel: '灾变日 D0', sortIndex: 4, locationId: t('l-jiangzhou'),
    participantIds: [t('c-chenye')], causeIds: [t('e-tunhuo')], effectIds: [t('e-baowei'), t('e-jihan')], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-baowei'), name: '仓储园保卫战', aliases: [], description: '幸存者与劫掠者围攻仓库，陈野以百倍物资立威组队。',
    tags: ['爽点'], timeLabel: 'D+1', sortIndex: 5, locationId: t('l-cangchu'),
    participantIds: [t('c-chenye'), t('c-wangdapeng'), t('c-zhoushan')], causeIds: [t('e-baofa')], effectIds: [t('e-lizu')], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-cheli'), name: '撤离世纪花园', aliases: [], description: '救出小满，收拢苏念与伤员，车队拉走第一批物资。',
    tags: ['收人'], timeLabel: 'D+7', sortIndex: 6, locationId: t('l-shiji'),
    participantIds: [t('c-chenye'), t('c-sunian'), t('c-xiaoman')], causeIds: [t('e-baowei')], effectIds: [t('e-lizu')], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-lizu'), name: '青杨镇立足', aliases: [], description: '安全屋一期落成（围墙/水电网），据点雏形立起。',
    tags: ['基建流'], timeLabel: 'D+20', sortIndex: 7, locationId: t('l-qingyang'),
    participantIds: [t('c-chenye'), t('c-zhoushan')], causeIds: [t('e-baowei'), t('e-cheli')], effectIds: [t('e-tuxi')], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-tuxi'), name: '秃鹫来袭', aliases: [], description: '赵天豪率队劫掠青杨镇，首次据点攻防战。',
    tags: ['冲突'], timeLabel: 'D+35', sortIndex: 8, locationId: t('l-qingyang'),
    participantIds: [t('c-zhaotianhao'), t('c-chenye')], causeIds: [t('e-lizu')], effectIds: [], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-jihan'), name: '极寒潮', aliases: [], description: '末日预报兑现，气温骤降至零下四十度；安全屋二期（供暖）渡劫。',
    tags: ['天灾'], timeLabel: 'D+50', sortIndex: 9, locationId: t('l-qingyang'),
    participantIds: [t('c-chenye')], causeIds: [t('e-baofa')], effectIds: [t('e-jiaoda')], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-jiaoda'), name: '江大物资战', aliases: [], description: '争夺江州大学地下物资库，意外发现抗体研究笔记。',
    tags: ['伏笔'], timeLabel: 'D+70', sortIndex: 10, locationId: t('l-daxue'),
    participantIds: [t('c-chenye'), t('c-sunian')], causeIds: [t('e-jihan')], effectIds: [t('e-mianyi')], importance: 3, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-mianyi'), name: '小满免疫暴露', aliases: [], description: '小满被尸抓咬不感染，免疫体质曝光，各方目光齐聚。',
    tags: ['转折'], timeLabel: 'D+85', sortIndex: 11, locationId: t('l-qingyang'),
    participantIds: [t('c-xiaoman'), t('c-sunian'), t('c-chenye')], causeIds: [t('e-jiaoda')], effectIds: [t('e-jiechu')], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-jiechu'), name: '曙光接触', aliases: [], description: '韩雪带来基地「征召令」，合作与博弈开始。',
    tags: ['势力线'], timeLabel: 'D+100', sortIndex: 12, locationId: t('l-qingyang'),
    participantIds: [t('c-hanxue'), t('c-chenye')], causeIds: [t('e-mianyi')], effectIds: [t('e-jiaotuan')], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-jiaotuan'), name: '回声教团现身', aliases: [], description: '邪教渗透据点，奉零号为「新世之神」，内鬼危机。',
    tags: ['阴谋'], timeLabel: 'D+120', sortIndex: 13, locationId: t('l-qingyang'),
    participantIds: [t('c-chenye')], causeIds: [t('e-jiechu')], effectIds: [t('e-shichao')], importance: 4, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-shichao'), name: '二次尸潮·零号现身', aliases: [], description: '尸王首次正面现身，江州彻底沦陷，据点被迫升级备战。',
    tags: ['大高潮'], timeLabel: 'D+150', sortIndex: 14, locationId: t('l-jiangzhou'),
    participantIds: [t('c-linghao'), t('c-chenye')], causeIds: [t('e-jiaotuan')], effectIds: [t('e-zhenxiang')], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
  {
    id: t('e-zhenxiang'), name: '白疫研究所攻略', aliases: [], description: '真相线总爆发：「回声计划」、面板来历、小满与零号的同源之谜。',
    tags: ['真相'], timeLabel: 'D+200', sortIndex: 15, locationId: t('l-baiyi'),
    participantIds: [t('c-chenye'), t('c-shenjiming'), t('c-xiaoman')], causeIds: [t('e-shichao')], effectIds: [], importance: 5, chapterId: null,
    createdAt: now, updatedAt: now,
  },
];

// ---------- 人物关系 ----------
const relations = [
  { id: t('r-1'), fromId: t('c-chenye'), toId: t('c-sunian'), type: '恋人', strength: 3, note: '从医疗物资交易到并肩' },
  { id: t('r-2'), fromId: t('c-chenye'), toId: t('c-wangdapeng'), type: '挚友', strength: 5, note: '发小，囤货执行人' },
  { id: t('r-3'), fromId: t('c-chenye'), toId: t('c-zhoushan'), type: '上下级', strength: 4, note: '据点基建总工' },
  { id: t('r-4'), fromId: t('c-chenye'), toId: t('c-xiaoman'), type: '亲人', strength: 4, note: '亦兄亦父的守护' },
  { id: t('r-5'), fromId: t('c-chenye'), toId: t('c-zhaotianhao'), type: '敌对', strength: 5, note: '秃鹫盯上了仓储物资' },
  { id: t('r-6'), fromId: t('c-chenye'), toId: t('c-hanxue'), type: '其他', strength: 3, note: '征召与反征召的博弈' },
  { id: t('r-7'), fromId: t('c-chenye'), toId: t('c-shenjiming'), type: '敌对', strength: 4, note: '猎人盯上了持面板者（面板来历伏笔）' },
  { id: t('r-8'), fromId: t('c-sunian'), toId: t('c-xiaoman'), type: '亲人', strength: 3, note: '医患如母女' },
  { id: t('r-9'), fromId: t('c-shenjiming'), toId: t('c-linghao'), type: '其他', strength: 5, note: '造物主与造物' },
  { id: t('r-10'), fromId: t('c-xiaoman'), toId: t('c-linghao'), type: '其他', strength: 4, note: '抗体与病毒同源（核心伏笔）' },
  { id: t('r-11'), fromId: t('c-zhaotianhao'), toId: t('c-hanxue'), type: '敌对', strength: 3, note: '劫掠与围剿' },
  { id: t('r-12'), fromId: t('c-chenye'), toId: t('c-linghao'), type: '敌对', strength: 4, note: '二次尸潮的死敌' },
];

// ---------- 分卷 ----------
const volumes = [
  { id: t('v-1'), name: '末日七十二小时', startOrder: 1, endOrder: 40 },
  { id: t('v-2'), name: '堡垒崛起', startOrder: 41, endOrder: 90 },
  { id: t('v-3'), name: '曙光与獠牙', startOrder: 91, endOrder: 140 },
  { id: t('v-4'), name: '回声', startOrder: 141, endOrder: 200 },
];

// ---------- 第一卷分章大纲（20 章骨架，status=草稿，content 留空） ----------
const vol1Chapters = [
  ['仓库夜班', '日常开篇：陈野夜巡仓储园，监控大面积雪花，城西方向传出闷响——异响即泄漏爆发的前兆（暗线伏笔）。'],
  ['结算面板', '手机多出黑色面板，弹出「末日预报：72小时后尸潮」；测试规则：囤入一件矿泉水，D0 零点百倍刷新。'],
  ['七十二小时', '对表新闻异象确认预报可信，决定搏命：信用贷＋全部积蓄＋变卖退役费。'],
  ['清空卖场', '连夜扫空三家卖场，临期品渠道全动；王胖子被拉入伙，负责「合法搬空」他自己的超市。'],
  ['囤爆仓库', '仓储园尾货整库划走，面板提示「结算额度上限升级」——金手指成长线开启。'],
  ['尸变前夜', '暴雨、断网、急救车潮，城市异象步步紧逼；预报二次弹窗锁定 D0 零点。'],
  ['尸潮之夜', '零点爆发全城尸变；百倍结算触发，仓库炸出物资山——第一爽点顶点。'],
  ['第一夜', '断水断电的守仓夜，陈野击杀第一只丧尸，掉落首枚晶核。'],
  ['园区幸存者', '幸存者围仓求收留，收留与驱逐的抉择；立下「以工换物」的进园规矩。'],
  ['保卫战', '劫掠者强攻仓储园，陈野以物资＋晶核武器立威，收服周铁山工程队。'],
  ['晶核复利', '晶核投入面板的意外发现：每七天一周期复利刷新——金手指第二规则（滚雪球线）。'],
  ['撤离决定', '囤货体量守不住，决策：把「家」搬去青杨镇，安全屋计划启动。'],
  ['世纪花园', '回城救人：废墟超市救出小满，免疫体质首露端倪（不显山露水的伏笔）。'],
  ['医生苏念', '苏念带队伤员求援，以医疗物资换入队；据点医疗线奠基。'],
  ['车队出城', '装载大作战：重型卡车队撕开尸群出城口，爽点＋牺牲的分量。'],
  ['青杨镇', '抵达青杨镇，面板首次外化「安全屋」实体落地——基建流正式开张。'],
  ['邻居们', '收拢镇上散落幸存者，立规矩分岗位；王胖子掌物资库。'],
  ['秃鹫的试探', '秃鹫团前哨现身，「赵天豪」之名首次入耳；下一卷冲突预告。'],
  ['一期落成', '安全屋一期（围墙/水电网）落成，面板推送二期图纸：供暖系统。'],
  ['极寒预报', '卷末钩子：末日预报第三弹——七日后极寒潮，零下四十度。'],
];
const chapters = vol1Chapters.map(([title, synopsis], i) => ({
  id: `${ID}-ch${String(i + 1).padStart(3, '0')}`,
  title: `第${['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'][i]}章 ${title}`,
  content: '',
  synopsis,
  status: '草稿',
  order: i + 1,
  updatedAt: now,
  versions: [],
}));

// ---------- 组装 ----------
const project = {
  id: ID,
  name: BOOK.name,
  genre: BOOK.genre,
  description: BOOK.description,
  createdAt: now,
  updatedAt: now,
  characters,
  relations,
  events,
  items,
  locations,
  factions,
  chapters,
  volumes,
  ignoreWords: [],
  settings: { ai: { baseUrl: '', apiKey: '', model: '' } },
};

// ---------- 引用完整性校验 ----------
function validate(p) {
  const errs = [];
  const ids = new Set();
  for (const list of [p.characters, p.relations, p.events, p.items, p.locations, p.factions, p.chapters, p.volumes]) {
    for (const e of list) {
      if (ids.has(e.id)) errs.push(`重复 ID: ${e.id}`);
      ids.add(e.id);
    }
  }
  const charIds = new Set(p.characters.map((c) => c.id));
  const locIds = new Set(p.locations.map((l) => l.id));
  const eventIds = new Set(p.events.map((e) => e.id));
  for (const c of p.characters) if (c.factionId && !ids.has(c.factionId)) errs.push(`${c.name}.factionId 悬空`);
  for (const f of p.factions) if (f.leaderId && !charIds.has(f.leaderId)) errs.push(`势力 ${f.name}.leaderId 悬空`);
  for (const i of p.items) {
    if (i.ownerId && !charIds.has(i.ownerId)) errs.push(`物品 ${i.name}.ownerId 悬空`);
    if (i.locationId && !locIds.has(i.locationId)) errs.push(`物品 ${i.name}.locationId 悬空`);
  }
  for (const l of p.locations) if (l.parentId && !locIds.has(l.parentId)) errs.push(`地点 ${l.name}.parentId 悬空`);
  for (const e of p.events) {
    if (!eventIds.has(e.id)) continue;
    for (const pid of e.participantIds) if (!charIds.has(pid)) errs.push(`事件 ${e.name}.participant 悬空`);
    if (e.locationId && !locIds.has(e.locationId)) errs.push(`事件 ${e.name}.locationId 悬空`);
    for (const cid of [...e.causeIds, ...e.effectIds]) if (!eventIds.has(cid)) errs.push(`事件 ${e.name}.因果 悬空: ${cid}`);
  }
  for (const r of p.relations) {
    if (!charIds.has(r.fromId) || !charIds.has(r.toId)) errs.push(`关系 ${r.id} 悬空`);
  }
  const orders = new Set();
  for (const ch of p.chapters) {
    if (orders.has(ch.order)) errs.push(`章节 order 重复: ${ch.order}`);
    orders.add(ch.order);
    if (ch.title.length < 5 || ch.title.length > 12) errs.push(`章节标题长度异常: ${ch.title}`);
  }
  for (const v of p.volumes) if (v.startOrder > v.endOrder) errs.push(`卷区间异常: ${v.name}`);
  return errs;
}

// ---------- 写入 ----------
fs.mkdirSync(projectsDir, { recursive: true });
const file = path.join(projectsDir, `${ID}.json`);

const existing = fs.readdirSync(projectsDir).filter((f) => f.endsWith('.json'));
let duplicate = false;
for (const f of existing) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(projectsDir, f), 'utf8'));
    if (p.name === BOOK.name && p.id !== ID) duplicate = true;
  } catch { /* 跳过损坏文件 */ }
}
if (duplicate) {
  console.log('已存在同名作品，跳过写入。');
} else {
  fs.writeFileSync(file, JSON.stringify(project, null, 2), 'utf8');
  const errs = validate(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (errs.length) {
    console.error('校验失败：\n' + errs.join('\n'));
    process.exit(1);
  }
  console.log(`已创建：${file}`);
  console.log(`书名：${BOOK.name}（${BOOK.genre}）`);
  console.log(`人物 ${characters.length} · 关系 ${relations.length} · 势力 ${factions.length} · 地点 ${locations.length} · 物品 ${items.length} · 事件 ${events.length} · 分卷 ${volumes.length} · 章节（草稿大纲） ${chapters.length}`);
}

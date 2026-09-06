# -*- coding: utf-8 -*-
"""把 yrdy 的 AI 上下文 md 数据源同步进 novel-context.json（应用导入的既定数据源）。

用法: python scripts/sync-ai-context.py [yrdy数据源目录] [novel-context.json路径]
缺省路径指向 yrdy/九州烟云-ai-context/九州烟云-ai-context/。
md 文件（01/02/03/05/06/07）为结构化事实源；novel-context.json 为全量结构化镜像。
"""
import json, re, sys, time, uuid, os

base = sys.argv[1] if len(sys.argv) > 1 else r'E:\work\gogogogo\sk-ms-main\yrdy\九州烟云-ai-context\九州烟云-ai-context'
jp = sys.argv[2] if len(sys.argv) > 2 else os.path.join(base, 'novel-context.json')

d = json.load(open(jp, encoding='utf-8'))
proj = d['project']
now = int(time.time() * 1000)

def read(name):
    return open(os.path.join(base, name), encoding='utf-8').read()

def field(block, label):
    m = re.search(r'- ' + label + r'：(.*)', block)
    return m.group(1).strip() if m else ''

def dim(s):
    return '' if s.strip() in ('—', '无', '') else s.strip()

def split_aliases(s):
    if not s or s == '—':
        return []
    return [a.strip() for a in re.split('[、,，]', s) if a.strip() and a.strip() != '—']

ROLE_MAP = {'主角': '主角', '女主': '主角', '女主之二': '主角', '配角': '配角', '关键配角': '配角',
            '反派': '反派', '终极反派': '反派', '小反派': '反派'}
REL_TYPE_MAP = {'亲人': '亲人', '师徒': '师徒', '挚友': '挚友', '恋人': '恋人', '敌对': '敌对', '同门': '同门',
                '上下级': '上下级', '守护': '其他', '宿敌': '敌对', '夺舍': '敌对', '君臣': '上下级',
                '勾结': '其他', '父女': '亲人', '兄妹对立': '亲人', '暗助': '其他', '对手挚友': '挚友',
                '救命之恩': '其他', '反叛': '敌对', '器重': '上下级', '同门宿敌': '同门', '博弈': '其他'}
FAC_TYPE_MAP = {'宗门': '宗门', '王朝': '王朝', '组织': '组织', '家族': '家族', '联盟': '组织', '商盟': '组织', '军镇': '组织'}

# ---------------- characters ----------------
chars = []
for b in re.split(r'^## ', read('01-characters.md'), flags=re.M)[1:]:
    head = b.split('\n', 1)[0].strip()
    m = re.match(r'(.+?)（(.+?) · (.+?) · (.+?)）', head)
    if not m:
        continue
    name, role_s, facname, status_s = m.group(1).strip(), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
    # 兼容「主名／别名」写法：主名取第一段，其余并入别名
    name_parts = re.split('[／/]', name)
    name = name_parts[0].strip()
    extra_aliases = [p.strip() for p in name_parts[1:] if p.strip()]
    cid_m = re.search(r'- ID：`(.+?)`', b)
    wx = re.search(r'五维：力量 (\d+) · 智谋 (\d+) · 魅力 (\d+) · 意志 (\d+) · 机缘 (\d+)', b)
    g_age = field(b, '性别 / 年龄')
    age = g_age.split('/')[-1].strip() if '/' in g_age else ''
    chars.append({
        '_name': name, '_fac': facname,
        'id': cid_m.group(1) if cid_m else '', 'name': name,
        'aliases': split_aliases(field(b, '别名')) + extra_aliases,
        'description': dim(field(b, '一句话')), 'tags': [],
        'role': ROLE_MAP.get(role_s, '配角'),
        'gender': '女' if '女' in g_age else '男', 'age': age,
        'factionId': None,
        'status': '在世' if '在世' in status_s else ('死亡' if ('死亡' in status_s or '消散' in status_s) else '未知'),
        'appearance': dim(field(b, '外貌')), 'personality': dim(field(b, '性格')),
        'background': dim(field(b, '背景')), 'goals': dim(field(b, '目标动机')),
        'avatar': None,
        'attributes': ({'power': int(wx.group(1)), 'wisdom': int(wx.group(2)), 'charm': int(wx.group(3)),
                        'will': int(wx.group(4)), 'fortune': int(wx.group(5))} if wx
                       else {'power': 50, 'wisdom': 50, 'charm': 50, 'will': 50, 'fortune': 50}),
        'createdAt': now, 'updatedAt': now,
    })
print('parsed characters:', len(chars))

# ---------------- locations ----------------
locs = []
for b in re.split(r'^## ', read('05-locations.md'), flags=re.M)[1:]:
    head = b.split('\n', 1)[0].strip()
    m = re.match(r'(.+?)（区域：(.+?)）', head)
    name, region = (m.group(1).strip(), m.group(2).strip()) if m else (head, '')
    locs.append({
        '_name': name, '_parent': dim(field(b, '上级地点')),
        'id': '', 'name': name, 'aliases': split_aliases(field(b, '别名')),
        'description': dim(field(b, '描述')), 'tags': [],
        'region': region, 'parentId': None, 'createdAt': now, 'updatedAt': now,
    })
print('parsed locations:', len(locs))

# ---------------- factions ----------------
facs = []
for b in re.split(r'^## ', read('06-factions.md'), flags=re.M)[1:]:
    head = b.split('\n', 1)[0].strip()
    m = re.match(r'(.+?)（(.+?)）', head)
    name, ftype = (m.group(1).strip(), m.group(2).strip()) if m else (head, '其他')
    leader_s = field(b, '首领')
    leader_name = re.split('[（(→]', leader_s)[0].strip() if leader_s and leader_s != '—' else ''
    facs.append({
        '_name': name, '_leader': leader_name if leader_name not in ('', '—', '无') else '',
        'id': '', 'name': name, 'aliases': split_aliases(field(b, '别名')),
        'description': dim(field(b, '描述')), 'tags': [],
        'type': FAC_TYPE_MAP.get(ftype, '其他'), 'stance': dim(field(b, '立场')), 'leaderId': None,
        'createdAt': now, 'updatedAt': now,
    })
print('parsed factions:', len(facs))

# ---------------- items ----------------
items = []
for b in re.split(r'^## ', read('07-items.md'), flags=re.M)[1:]:
    head = b.split('\n', 1)[0].strip()
    m = re.match(r'(.+?)（(.+?) · (.+?)）', head)
    name, itype, rarity = (m.group(1).strip(), m.group(2).strip(), m.group(3).strip()) if m else (head, '其他', '普通')
    items.append({
        '_name': name, '_owner': field(b, '持有者'), '_loc': field(b, '所在地'),
        'id': '', 'name': name, 'aliases': split_aliases(field(b, '别名')),
        'description': dim(field(b, '描述')), 'tags': [],
        'type': itype, 'rarity': rarity, 'ownerId': None, 'locationId': None,
        'origin': dim(field(b, '来历')), 'status': dim(field(b, '现状')),
        'createdAt': now, 'updatedAt': now,
    })
print('parsed items:', len(items))

# ---------------- events ----------------
events = []
for b in re.split(r'^## ', read('03-events.md'), flags=re.M)[1:]:
    head = b.split('\n', 1)[0].strip()
    m = re.match(r'(\d+)\.\s*(.+?)〔(.+?)〕', head)
    if not m:
        continue
    num, name, tlabel = int(m.group(1)), m.group(2).strip(), m.group(3).strip()
    eid_m = re.search(r'- ID：`(.+?)`', b)
    imp = re.search(r'重要度：(\d)/5', b)
    locname = re.search(r'地点：(.+?) · 参与', b)
    participants = []
    for line in b.split('\n'):
        if line.startswith('- 重要度'):
            pm = re.search(r'参与：(.*)', line)
            if pm:
                participants = [p.strip() for p in pm.group(1).strip().split('、') if p.strip() and p.strip() != '—']
    causes, effects = [], []
    for line in b.split('\n'):
        cm = re.match(r'- 前因：(.*)', line)
        em = re.match(r'- 后果：(.*)', line)
        if cm and cm.group(1).strip() != '—':
            causes = re.findall(r'(.+?)（\d+）', cm.group(1))
        if em and em.group(1).strip() != '—':
            effects = re.findall(r'(.+?)（\d+）', em.group(1))
    alias_s = field(b, '别名')
    events.append({
        '_name': name, '_causes': causes, '_effects': effects, '_participants': participants,
        '_loc': locname.group(1).strip() if locname and locname.group(1).strip() != '—' else '',
        'id': eid_m.group(1) if eid_m else '', 'name': name,
        'aliases': [alias_s] if alias_s and alias_s != '—' else [],
        'description': dim(field(b, '描述')), 'tags': [],
        'timeLabel': tlabel, 'sortIndex': num,
        'locationId': None, 'participantIds': [], 'causeIds': [], 'effectIds': [],
        'importance': int(imp.group(1)) if imp else 3, 'chapterId': None,
        'createdAt': now, 'updatedAt': now,
    })
print('parsed events:', len(events))

# ---------------- relations ----------------
rels = []
for frm, rel, to, strength, note in re.findall(r'^\| (.+?) \| (.+?) → \| (.+?) \| (\d) \| (.*?) \|$', read('02-relationships.md'), flags=re.M):
    t = rel.strip()
    mapped = REL_TYPE_MAP.get(t, '其他')
    extra = '' if mapped == t else ('（原关系：' + t + '）')
    rels.append({'_from': frm.strip(), '_to': to.strip(), 'type': mapped, 'strength': int(strength),
                 'note': (note.strip() + extra).strip()})

# ---------------- ID 分配与引用解析（尽量沿用应用内已有 ID） ----------------
old_by_name = {}
for key, arr in (('c', proj['characters']), ('l', proj['locations']), ('f', proj['factions']), ('i', proj['items'])):
    for x in arr:
        old_by_name.setdefault((key, x['name']), x['id'])

def nid():
    return uuid.uuid4().hex[:10]

for c in chars:
    if not c['id']:
        c['id'] = old_by_name.get(('c', c['name'])) or nid()
name2id = {c['name']: c['id'] for c in chars}
alias2id = {}
for c in chars:
    for a in c['aliases']:
        alias2id.setdefault(a, c['id'])

def char_id(name):
    n = name.strip()
    if not n:
        return None
    return name2id.get(n) or alias2id.get(n)

for f in facs:
    f['id'] = old_by_name.get(('f', f['name'])) or nid()
fac_name2id = {f['name']: f['id'] for f in facs}
fac_alias2id = {}
for f in facs:
    for a in f['aliases']:
        fac_alias2id.setdefault(a, f['id'])
for f in facs:
    f['leaderId'] = char_id(f['_leader']) if f['_leader'] else None
for c in chars:
    target = c['_fac']
    c['factionId'] = (fac_name2id.get(target) or fac_alias2id.get(target)) if target and target != '无' else None

for l in locs:
    l['id'] = old_by_name.get(('l', l['name'])) or nid()
loc_name2id = {l['name']: l['id'] for l in locs}
loc_alias2id = {}
for l in locs:
    for a in l['aliases']:
        loc_alias2id.setdefault(a, l['id'])
for l in locs:
    l['parentId'] = (loc_name2id.get(l['_parent']) or loc_alias2id.get(l['_parent'])) if l['_parent'] else None

for i in items:
    i['id'] = old_by_name.get(('i', i['name'])) or nid()
for i in items:
    i['ownerId'] = char_id(i['_owner']) if i['_owner'] else None
    i['locationId'] = (loc_name2id.get(i['_loc']) or loc_alias2id.get(i['_loc'])) if i['_loc'] else None

ev_name2id = {}
for e in events:
    if not e['id']:
        e['id'] = nid()
    ev_name2id[e['name']] = e['id']
for e in events:
    e['locationId'] = (loc_name2id.get(e['_loc']) or loc_alias2id.get(e['_loc'])) if e['_loc'] else None
    e['participantIds'] = [cid for c in e['_participants'] if (cid := char_id(c))]
    e['causeIds'] = [ev_name2id[n] for n in e['_causes'] if n in ev_name2id]
    e['effectIds'] = [ev_name2id[n] for n in e['_effects'] if n in ev_name2id]

new_rels = []
for r in rels:
    fid, tid = char_id(r['_from']), char_id(r['_to'])
    if not fid or not tid:
        print('!! 悬空关系（已跳过）:', r['_from'], '->', r['_to'])
        continue
    new_rels.append({'id': nid(), 'fromId': fid, 'toId': tid, 'type': r['type'],
                     'strength': r['strength'], 'note': r['note']})

# ---------------- 写回 ----------------
def clean(arr):
    return [{k: v for k, v in x.items() if not k.startswith('_')} for x in arr]

proj['characters'] = clean(chars)
proj['locations'] = clean(locs)
proj['factions'] = clean(facs)
proj['items'] = clean(items)
proj['events'] = clean(events)
proj['relations'] = new_rels
proj['updatedAt'] = now
d['exportedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
json.dump(d, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# ---------------- 校验 ----------------
d2 = json.load(open(jp, encoding='utf-8'))
pj = d2['project']
cids = {c['id'] for c in pj['characters']}
eids = {e['id'] for e in pj['events']}
lids = {l['id'] for l in pj['locations']}
fids = {f['id'] for f in pj['factions']}
bad = []
for r in pj['relations']:
    if r['fromId'] not in cids or r['toId'] not in cids:
        bad.append(('rel', r['id']))
for e in pj['events']:
    for x in e['causeIds'] + e['effectIds']:
        if x not in eids:
            bad.append(('event-cause/effect', e['name']))
    for x in e['participantIds']:
        if x not in cids:
            bad.append(('event-participant', e['name']))
for c in pj['characters']:
    if c['factionId'] and c['factionId'] not in fids:
        bad.append(('char-faction', c['name']))
for e in pj['events']:
    if e['locationId'] and e['locationId'] not in lids:
        bad.append(('event-location', e['name']))
print('FINAL: chars=%d rels=%d events=%d locs=%d facs=%d items=%d chapters=%d dangling=%d' % (
    len(pj['characters']), len(pj['relations']), len(pj['events']), len(pj['locations']),
    len(pj['factions']), len(pj['items']), len(pj['chapters']), len(bad)))
if bad:
    print(bad[:20])

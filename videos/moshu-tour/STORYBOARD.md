---
format: 1920x1080
duration: 60s
message: "墨枢 NovelAtlas：把小说设定沉淀为知识图谱，让 AI 写长篇不崩人设"
arc: Demo Loop
audience: 网文作者 / AI 长篇写作者
mode: autonomous
music: restrained ambient electronic, dark gold, data-driven
VO_MODE: none
captions: baked-in
---

## Video direction

- palette（源自 frame.md 反转后的暗金系统）：canvas 近黑 #14161A（铺底由 assembler 按 frame.md canvas 绘制）；ink 暖白 #E6CF95/#FAFAE9 作主文字；accent 金 #C9AC67 只用于关键词、角标、高亮描边与脉冲点；琥珀 #E6CF95 兼作警示色；辅助冷灰 #1B1E23 作面板分层。禁止出现本系统以外的彩色。
- motion grammar + reveal model：power3 长尾缓动为默认，克制不弹跳；本片无配音，**字幕行本身就是 VO**——每条字幕行出现即一条 cue，元素在其对应字幕行落点揭示；严禁 t=0 一次性倾倒全部内容（slideshow 失败态），也禁止元素各自漂浮（screensaver 失败态）。
- rhythm：Frame 3（总览）与 Frame 7（导出）为半静帧——内容揭示后稳定持读；Frame 5（图谱）为全片最慢的一拍，像镜头巡星；Frame 1/2/8 是文字驱动的快节奏帧。
- 常驻元素：全片底部 ~17% 为字幕带（keep-out，内容排进上方 83%）；每帧左上角小号「墨枢」字标 + 金色菱形节点作为水印级 brand mark，右上角帧序号 01–08 等宽数字。
- negative list：不用紫色/蓝色渐变、bokeh 光斑、浏览器 chrome、真实光标；不用除 frame.md 之外的任何色相；截图页的导航栏允许出现（它是产品 UI 本体），但不夸大。
- app-frame-push 约定（Frame 3–7 通用）：真实截图作为全幅 `class="clip"` 背景层，其上叠一层 1px 金色 hairline 视口框 + 四角 L 形角标，角标围合的「镜头」区域做缓推/平移（截图用 transform 缩放平移实现 push），字幕条挂在视口框下缘上方。

## Frame 1 — 钩子：名字即主张

- scene: 暗金 HUD 底上「墨枢 NOVEL ATLAS」字标亮起，一句话主张逐条打出
- duration: 7s
- transition_in: cut
- status: animated
- voiceover: （无旁白，字幕文案）「写到 30 万字，主角的眼睛换了颜色，你知道吗？」
- blueprint: kinetic-type-beats (Adapt)
- type: hook
- poster: 5s
- src: compositions/frames/01-hook.html
- focal: 字标（纯排版，无摄影资产）
- roles: 字标 = foreground · 点阵装饰 = background
- sfx: 无

Adapt：保留 kinetic-type 的关键词换位签名，但用中文长句逐段点出。
Scene 1 (0.0–2.0s)：近黑底上点阵括号装饰淡入（background，低透明度）；第一段「写到 30 万字」大字从下方 8% 处浮入，Centered 略偏上，display 字重 700。
Scene 2 (2.0–4.0s)：第二段「主角的眼睛换了颜色」接续浮入并换行，其中「眼睛换了颜色」以金色 #C9AC67 强调；密度克制，3 层深度（底纹/主行/高光字）。
Scene 3 (4.0–7.0s)：问句收尾「你知道吗？」小型浮现；同时「墨枢 NOVEL ATLAS」字标 + 金色菱形节点在上方 1/3 处亮起（描边脉冲一次）；整帧收在持读，无镜头移动。

## Frame 2 — 痛点：自由文本 = 崩设之源

- scene: 大字等式逐段落下：自由文本引用 → AI 拿不到设定 → 写崩的源头
- duration: 7s
- transition_in: crossfade
- status: animated
- voiceover: （无旁白，字幕文案）「自由文本引用 = AI 拿不到设定 = 写崩的源头」
- blueprint: kinetic-type-beats (Adapt)
- type: pain_point
- poster: 5s
- src: compositions/frames/02-pain.html
- focal: 等式三段大字
- roles: 等式 = foreground · 琥珀警示条 = supporting · 底纹 = background
- sfx: 无

Adapt：保留关键词逐段点出签名；三段式等式结构替代单词换位。
Scene 1 (0.0–1.8s)：第一段「自由文本引用」从上落入中带，amber 琥珀色 #E6CF95 描边卡片包裹，Centered，display 700。
Scene 2 (1.8–3.6s)：金色「=」亮起，第二段「AI 拿不到设定」左滑入位；两段上下排布成等式塔，60% 宽度居中。
Scene 3 (3.6–7.0s)：第三段「写崩的源头」以更大字号砸入下带（重量层级 3:1），底部细金线从中心向两侧展开划出结论；尾段 1.5s 持读，末尾「源头」二字脉冲一次。

## Frame 3 — 总览：数据大屏

- scene: 总览页真实截图推入，镜头缓推主角英雄卡，指标数字滚动
- duration: 9s
- transition_in: crossfade
- status: animated
- voiceover: （无旁白，字幕文案）「总览 · 一屏掌握全局：主角雷达 / 事件统计 / 章节健康度」
- blueprint: device-surface-showcase (Reproduce)
- type: feature_showcase
- poster: 6s
- asset_candidates: capture/assets/screens/dashboard.png
- src: compositions/frames/03-dashboard.html
- focal: capture/assets/screens/dashboard.png
- roles: dashboard.png = background（全幅截图即主角）· 视口框+角标 = supporting · 字幕条 = supporting
- sfx: 无

Scene 1 (0.0–2.5s)：dashboard.png 全幅淡入 + 从 1.08 缓落至 1.0（long-tail ease）；金色视口框与四角 L 角标同时描边生长；字幕条「总览」浮现在下缘上方。
Scene 2 (2.5–5.5s)：字幕行「一屏掌握全局」点出时，镜头（截图 transform）缓推向英雄卡区域（图左上 1/3），视口框随之收拢；对应字幕词「主角雷达」在框旁打点。
Scene 3 (5.5–9.0s)：字幕依次点出「事件统计」「章节健康度」，每点一处，对应截图区域的角标轻闪一次 + 旁侧小 count-up 数字（7 / 9 / 100）依次滚出；结尾 1.5s 全帧稳定持读（半静帧，无后续运动）。

## Frame 4 — 写作台：边写边校验

- scene: 写作台截图，实体高亮被逐一圈出，右侧一致性面板滑入强调
- duration: 9s
- transition_in: cut
- status: animated
- voiceover: （无旁白，字幕文案）「写作台 · 实体实时高亮 / 未登记名词琥珀警示 / 一键建档」
- blueprint: device-surface-showcase (Adapt)
- type: feature_showcase
- poster: 6s
- asset_candidates: capture/assets/screens/writing.png
- src: compositions/frames/04-writing.html
- focal: capture/assets/screens/writing.png
- roles: writing.png = background · 高亮圈注 = supporting · 右侧面板描边 = supporting · 字幕条 = supporting
- sfx: 无

Adapt：保留 push 签名；把三处「圈注」作为逐条揭示的焦点动作。
Scene 1 (0.0–2.0s)：writing.png 整屏淡入；字幕条「写作台」落位；视口框就位。
Scene 2 (2.0–4.5s)：镜头缓推正文编辑区；字幕「实体实时高亮」点出时，两个金色 L 角标在正文高亮词位置先后圈出（近似对位截图中的高亮即可）。
Scene 3 (4.5–6.5s)：字幕「未登记名词琥珀警示」落点，右侧面板区域用琥珀色 1px 描边框轻闪 + 一枚琥珀警示点脉冲。
Scene 4 (6.5–9.0s)：字幕「一键建档」点出，光标位一枚金色小按钮浮起（合成元素，非截图）微亮；结尾稳定持读。

## Frame 5 — 图谱中心：关系一目了然

- scene: 图谱页整屏截图如星图缓慢巡移，节点发光脉动，三种视图名依次点出
- duration: 9s
- transition_in: crossfade
- status: animated
- voiceover: （无旁白，字幕文案）「图谱中心 · 关系网络 / 事件因果 / 人物轨迹」
- blueprint: device-surface-showcase (Adapt)
- type: benefit_highlight
- poster: 6s
- asset_candidates: capture/assets/screens/graph.png
- src: compositions/frames/05-graph.html
- focal: capture/assets/screens/graph.png
- roles: graph.png = background · 节点光点 = supporting · 字幕条 = supporting
- sfx: 无

Adapt：保留慢速镜头签名；整帧是全片最慢的一拍，靠光点脉动供能，不做大位移。
Scene 1 (0.0–2.5s)：graph.png 全幅淡入（本身就是 1920 整屏），镜头以极慢速度从图谱左区向中心缓移（Ken Burns）；字幕条「图谱中心 · 设定即图谱」浮现。
Scene 2 (2.5–5.0s)：在中心人物节点（林霄）与两三个相邻节点位置叠加金色小光点，缓慢呼吸脉动（不要求像素级对位）；字幕「关系网络」点出。
Scene 3 (5.0–9.0s)：字幕「事件因果」「人物轨迹」先后点出，每点一处右上角对应小标签浮现后淡出；镜头滑向图谱右下区域后静止，尾段 2s 持读。

## Frame 6 — 人物设计器：档案与雷达

- scene: 人物页截图推入，五维雷达区被金色角标框选，能力点字幕逐条落位
- duration: 8s
- transition_in: cut
- status: animated
- voiceover: （无旁闭，字幕文案）「人物设计器 · 档案 / 五维雷达 / 关系与别名」
- blueprint: device-surface-showcase (Reproduce)
- type: feature_showcase
- poster: 5s
- asset_candidates: capture/assets/screens/characters.png
- src: compositions/frames/06-characters.html
- focal: capture/assets/screens/characters.png
- roles: characters.png = background · 雷达框选 = supporting · 字幕条 = supporting
- sfx: 无

Scene 1 (0.0–2.0s)：characters.png 整屏淡入 + 轻推；字幕条「人物设计器」落位。
Scene 2 (2.0–5.0s)：镜头推到五维雷达区域，金色 L 角标框选收拢；字幕「五维雷达」点出时框线描边生长完成。
Scene 3 (5.0–8.0s)：字幕「档案」「关系与别名」先后点出，对应页面区域各一次角标轻闪；结尾 1.5s 持读。

## Frame 7 — 导出：一次创作，多端交付

- scene: 导出页截图左置，四个格式徽章依次点亮，本地存储徽章压轴
- duration: 8s
- transition_in: crossfade
- status: animated
- voiceover: （无旁白，字幕文案）「TXT / Markdown / DOCX / EPUB3 / JSON 备份 · 数据 100% 本地」
- blueprint: grid-card-assemble (Adapt)
- type: benefit_highlight
- poster: 5s
- asset_candidates: capture/assets/screens/export.png
- src: compositions/frames/07-export.html
- focal: capture/assets/screens/export.png
- roles: export.png = background 左置 · 格式徽章 = foreground · 字幕条 = supporting
- sfx: 无

Adapt：保留网格逐格点亮签名；截图与徽章做 60/40 非对称分栏。
Scene 1 (0.0–2.0s)：export.png 全幅淡入后镜头略收，字幕条「导出」落位。
Scene 2 (2.0–5.5s)：右侧 40% 区域四枚格式徽章（TXT / Markdown / DOCX / EPUB3）按字幕节奏逐枚点亮（描边+微浮起，每枚间隔 ~0.8s）；截图侧同步轻微降透明度让位。
Scene 3 (5.5–8.0s)：字幕「数据 100% 本地」压轴，第五枚「JSON 备份 · 100% 本地」徽章以金色填充压轴亮起并轻脉冲；尾段持读（半静帧）。

## Frame 8 — 收束：CTA

- scene: 字标回归 + 主张句 + 三枚信任徽章，定格脉冲
- duration: 8s
- transition_in: crossfade
- status: animated
- voiceover: （无旁白，字幕文案）「墨枢 NovelAtlas · 让任何模型写长篇都不崩人设」
- blueprint: kinetic-type-beats (Adapt)
- type: cta
- poster: 6s
- src: compositions/frames/08-cta.html
- focal: 字标 + 主张句（纯排版）
- roles: 字标 = foreground · 主张句 = foreground · 徽章行 = supporting · 点阵装饰 = background
- sfx: 无

Adapt：保留关键词强调签名；结尾以描边脉冲定格。
Scene 1 (0.0–2.0s)：点阵装饰淡入；「墨枢 NOVEL ATLAS」字标从 Frame 1 的位置语言回归（居中上 1/3），金色菱形节点亮起。
Scene 2 (2.0–4.5s)：主张句「让任何模型写长篇都不崩人设」整行浮入，「不崩人设」金色强调；display 700，Centered。
Scene 3 (4.5–8.0s)：三枚小徽章「纯前端 / 数据 100% 本地 / 图谱一致性」依次点亮成一排；字标金色描边脉冲一次后全帧定格持读 2s 收尾。

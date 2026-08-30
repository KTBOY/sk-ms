---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "墨枢 NovelAtlas：把小说设定沉淀为知识图谱，让 AI 写长篇不崩人设"
destination: web-embed
aspect: 1920x1080
language: zh
length: 60s
angle: product-tour
voice: none
music: bgm
VO_MODE: none
captions: on
---

## Intent

界面展示/导览片（show-it-as-is）：以真实运行界面截图为主角，按产品核心工作流（总览 → 写作台 → 图谱中心 → 导出/一致性体检）走一遍，突出「和图谱对不上」的三层提示这一产品灵魂。观众是网文作者与 AI 写作工具用户。氛围：数据大屏感、沉稳、可信，中文界面。

## Assets

- http://localhost:5199 — 墨枢 NovelAtlas 本地运行实例（Vite dev server），capture 的真实来源。
- README.md（仓库根目录）— 产品功能与卖点文案来源。

## Customizations

- 无旁白：不生成 TTS。文案以动态字幕呈现。
- BGM：背景音乐烘托节奏（若本地/免费渠道不可得，降级为静音并在交付时说明）。
- 全片 16:9 1920x1080，约 60 秒。

## Notes

- 产品为纯前端应用，数据本地存储；界面为简体中文。
- 示例作品《九州烟云》预置数据可用于展示（人物关系/事件因果/图谱）。

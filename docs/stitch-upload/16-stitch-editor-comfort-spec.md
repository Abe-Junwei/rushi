# 编辑页平衡紧凑版（Comfort）— Stitch 需求文档

## 0. 目标

输出一版“平衡紧凑”编辑页，在紧凑与可读性之间做中间方案，适合大多数用户默认使用。

适用人群：日常编辑用户、混合鼠标/键盘用户。

---

## 1. 视觉定位

- 风格：Notion Zen / Balanced Productivity
- 气质：稳定、温和、清晰
- 原则：舒适优先，但避免低效留白

---

## 2. 布局参数（硬约束）

### 2.1 垂直节奏

- 顶栏高度：60px
- 工具条高度：46px
- 波形区高度：230-250px
- 语段行高：58-66px
- 底部状态条：30px

### 2.2 间距

- 顶栏与工具条：0
- 工具条与波形区：10px
- 波形区与语段区：10px
- 语段区与底栏：0
- 卡片内边距：8px~10px

### 2.3 控件尺寸

- 一级按钮高度：32px
- 次级按钮高度：30px
- 图标尺寸：14/18/20
- 交互最小点击区：30px

---

## 3. 布局规则

1. 顶栏保留项目路径与环境入口，允许更舒展留白。
2. 工具条仍单行优先，窄屏可横向滚动。
3. 波形区保持清晰主次，缩放条与状态提示可读性优先。
4. 语段区采用中等密度卡片，适度圆角与轻阴影。
5. 底栏维持单行三段结构（缩放/提示/快捷入口）。

---

## 4. 交互要求

- Busy 态：禁用清晰、层级稳定。
- 历史弹层：信息结构清晰，行间距略大于 Dense。
- 无音频态：保留提示与引导按钮，不扩张为大型空态插画。

---

## 5. Stitch 提示词（Comfort）

```text
Design a balanced compact desktop transcription editor in Notion Zen style.

Priority:
- Keep the layout tighter than current, but preserve comfortable readability.

Layout:
- Top bar 60px
- Toolbar 46px (single-row first)
- Waveform area 230-250px
- Transcript rows 58-66px
- Bottom status bar 30px

Constraints:
- Keep click targets >= 30px.
- Moderate spacing, no decorative large empty gaps.
- Clear hierarchy for toolbar, waveform, transcript, footer.
- Stable in normal and narrow window sizes.

Need frames:
1) default comfort state
2) busy state
3) history popover open
4) no-audio state
5) narrow-window comfort state
```

---

## 6. 验收清单

- [ ] 相比旧版更紧凑
- [ ] 相比 Dense 更易读
- [ ] 单行工具条策略保持一致
- [ ] 状态页完整（busy/无音频/窄窗）
- [ ] 视觉基调与 DESIGN 保持一致

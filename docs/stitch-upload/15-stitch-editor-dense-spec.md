# 编辑页极限紧凑版（Dense）— Stitch 需求文档

## 0. 目标

输出一版“极限紧凑”编辑页，用于高频专业校对场景，强调单位屏幕信息密度与操作到达效率。

适用人群：重度键盘用户、长时段连续校对用户。

---

## 1. 视觉定位

- 风格：Notion Zen / Professional Dense
- 气质：克制、锐利、效率优先
- 原则：高密度优先，舒适性次之

---

## 2. 紧凑参数（硬约束）

### 2.1 垂直节奏

- 顶栏高度：52px
- 工具条高度：40px
- 波形区高度：200-220px
- 语段行高：52-58px
- 底部状态条：28px

### 2.2 间距

- 顶栏与工具条：0
- 工具条与波形区：6px
- 波形区与语段区：6px
- 语段区与底栏：0
- 卡片内边距：6px~8px

### 2.3 控件尺寸

- 一级按钮高度：30px
- 次级按钮高度：28px
- 图标尺寸：14/18（尽量不用 20）
- 交互最小点击区：30px（不可低于）

---

## 3. 布局规则

1. 顶栏只保留核心路径与环境入口，不放冗余状态。
2. 工具条单行优先，超窄宽度用横向滚动，不换两行。
3. 波形状态栏压缩为单行短文案。
4. 语段列表改“薄卡片 + 小间距”，避免厚重块。
5. 底栏保留缩放信息和最小帮助入口，不新增模块。

---

## 4. 交互要求

- Busy 态：按钮 disable + 文案保持可读。
- 历史弹层：允许覆盖，但弹层间距和字号同步 Dense。
- 无音频态：保持紧凑，不出现大面积空白占位。

---

## 5. Stitch 提示词（Dense）

```text
Design a dense desktop transcription editor in Notion Zen style.

Priority:
- Maximum information density while preserving usability.
- Remove decorative whitespace aggressively.

Layout:
- Top bar 52px
- Toolbar 40px (single-row, horizontal scroll on narrow screens)
- Waveform block 200-220px
- Compact transcript list rows 52-58px
- Bottom status bar 28px

Constraints:
- Keep click targets >= 30px.
- Minimal shadows, subtle separators.
- Focus on speed and scan efficiency.
- Avoid oversized cards or tall paddings.

Need frames:
1) default dense state
2) busy/disabled state
3) history popover open
4) no-audio state
5) narrow-window dense state
```

---

## 6. 验收清单

- [ ] 一屏可见信息量明显提升
- [ ] 模块间距较紧凑版再缩减一档
- [ ] 工具条保持单行
- [ ] 交互可点击性未下降
- [ ] 视觉仍保持 Notion Zen

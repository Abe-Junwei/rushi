# 品牌 Mark「如」— Stitch 出图需求稿

> **版本**：2026-06-19  
> **字符**：**如**（书法单字 mark）  
> **真源**：仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen）  
> **工程需求**：[`rushi-brand-logo-requirements.md`](../../../docs/execution/specs/rushi-brand-logo-requirements.md)（尺寸验收、交付物）  
> **参考截图**：[`stitch-brand-logo-reference.png`](../stitch-brand-logo-reference.png)（**须自行放入**）  
> **静态对照**：[`stitch-brand-logo-layout.html`](../stitch-brand-logo-layout.html)

本文描述 **如是我闻** 桌面端图形标 Mark 的 Stitch 出图流程。Mark 为书法字体单字 **「如」**；字标「如是我闻」已存在（Noto Serif SC），**无需重设计汉字 wordmark**。

---

## 0. 上传前准备

1. 将书法「如」截图保存为：

   ```text
   apps/desktop/stitch-brand-logo-reference.png
   ```

   建议：正方形、透明或白底、字占画布 **60–70%**、四周 **≥15%** 安全边距。

2. 刷新上传包：

   ```bash
   bash scripts/prepare-stitch-upload.sh
   ```

3. 上传到 Stitch（Experimental / Thinking with Pro 模式）：

   ```text
   01-DESIGN.md
   27-stitch-brand-logo-spec.md          ← 本文副本
   28-stitch-brand-logo-layout.html      ← 静态 Frame 对照
   29-stitch-brand-logo-reference.png    ← 你的书法截图（若已放入）
   ```

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| **保留原字** | 严格沿用参考截图中「如」的笔画气质与粗细，不改成几何抽象标 |
| **可缩放** | 16 / 32 / 128 / 1024 px 均可读；Dock 圆角蒙版下不裁切关键笔画 |
| **系统色** | 仅 ink / saffron / paper / white；无渐变、无阴影、无位图纹理 |
| **场景验证** | 侧栏 saffron 方底组合标、白底标准版、尺寸对照行 |

**不做什么**

- 不把「如是我闻」四字变形塞进 16px 图标
- 不用麦克风、波形、宗教具象
- 不新增 hex；不 drop shadow

---

## 2. 配色变体

| 变体 ID | 字色 | 底 | 场景 |
|---------|------|-----|------|
| **V1 · 标准** | ink `#2C2C2C` | 透明或 white | 关于页、README |
| **V2 · 侧栏** | white / paper | saffron `#C58A43` 圆角方 32×32（圆角 4px @32） | `WelcomeSidebarNav` |
| **V3 · 单色** | ink | 任意 | 打印 / 单色场景 |
| **V4 · 反色** | white | saffron 或 ink 满底 | 深色底预览 |

侧栏默认：**V2**（对齐现 `bg-zen-primary-action-bg` 方块）。

---

## 3. Stitch Frame 总表（必出 5 张）

| Frame | 画布 | 内容 |
|-------|------|------|
| **L1 · Mark-1024** | 1024×1024 | 单字「如」居中，15% 安全区，flat vector-like |
| **L2 · Mark-V2-saffron** | 32×32 | saffron 圆角方底 + 浅色「如」 |
| **L3 · Lockup-sidebar** | 320×120 | 32px mark + gap 12px + 字标 + tagline（见 §4） |
| **L4 · Size-test** | 600×200 | 同一 mark 在 16 / 32 / 128 px，白底 + saffron 底各一行 |
| **L5 · Dock-mock** | 256×256 | macOS 风格圆角图标预览（仅 mark，无字） |

静态 HTML 对照：[`stitch-brand-logo-layout.html`](../stitch-brand-logo-layout.html) 含 L2–L4 结构标注。

---

## 4. 侧栏组合标（Lockup A）

对齐 [`WelcomeSidebarNav.tsx`](../src/components/WelcomeSidebarNav.tsx)：

| 元素 | 规格 |
|------|------|
| Mark 容器 | 32×32 px，`rounded` 4px，saffron 底 |
| Mark 内字 | ~18px 视觉高度（容器内 ~70%） |
| 与字标间距 | **12px**（`gap-3`） |
| Wordmark | **如是我闻** — Noto Serif SC Medium 18px，`#37352f` |
| Tagline | **本地课录音转写与校对** — Inter 11px muted |

Mark 与 Wordmark 首行 **cap height 视觉居中**。

---

## 5. 尺寸验收（§8 摘要）

定稿须通过：

| 尺寸 | 背景 | 通过标准 |
|------|------|----------|
| 16×16 | white | 可辨认为「如」，非色块 |
| 16×16 | saffron | V2 反色清晰 |
| 32×32 | saffron 方底 | 可替代侧栏 Mic 占位 |
| 1024×1024 | white | 无锯齿；可生成 icns/ico |

---

## 6. Stitch 提示词（英文 · 主）

```text
Task: App icon mark for desktop app「如是我闻 Rushi」— local Chinese lecture transcription and proofreading.

Reference image: attached screenshot shows my finalized calligraphy character「如」(ru). Preserve exact stroke rhythm, weight, and glyph shape from the reference. Do NOT redesign into abstract geometry, microphone, waveform, or religious imagery.

Deliver 5 separate frames on one canvas:

1) L1 Mark-1024: 1024×1024 square, character「如」centered, 15% safe margin, flat vector-like appearance, NO gradient, NO shadow, NO photo texture.

2) L2 Mark-V2-saffron: 32×32 container, saffron #C58A43 rounded square (4px radius at 32px scale), white or paper-tinted「如」inside, character ~70% of inner area.

3) L3 Lockup-sidebar: 320px wide header — 32px saffron mark + 12px gap + wordmark「如是我闻」Noto Serif SC Medium 18px #37352f + tagline「本地课录音转写与校对」Inter 11px muted #6b6b6b. Align mark with wordmark cap height.

4) L4 Size-test: one row at 16 / 32 / 128 px on white; duplicate row on saffron #C58A43. Same glyph, no redesign between sizes.

5) L5 Dock-mock: macOS-style squircle app icon preview, mark only, no text.

Colors ONLY: ink #2C2C2C, saffron #C58A43, paper #F2EFE8, white #ffffff, notion-text #37352f, notion-text-muted #6b6b6b.

Mood: Minimalist-Editorial, calm academic tool — warm, trustworthy, not flashy.

Cross-check layout proportions with attached stitch-brand-logo-layout.html.
```

若 Stitch 改形，追加：

```text
Keep the exact calligraphy「如」from my reference PNG. Adjust only margin, flat colors, and container — never simplify or replace strokes.
```

---

## 7. Stitch 提示词（中文 · 备选）

```text
桌面应用「如是我闻」图标 Mark。参考图为书法单字「如」，须严格保留笔画形态，不得改成抽象几何或麦克风/波形。

出 5 个 Frame：
L1 1024×1024 居中「如」，15% 安全区，扁平矢量感，无渐变无阴影。
L2 32×32 琥珀色 #C58A43 圆角方底，内为浅色「如」。
L3 侧栏组合：32px 图标 + 12px 间距 + 衬线「如是我闻」18px + 副标题 Inter 11px 灰色。
L4 尺寸对照：16/32/128 px，白底一行、saffron 底一行。
L5 Dock 圆角图标预览，仅 mark 无字。

色板限定：ink #2C2C2C、saffron #C58A43、paper #F2EFE8、白 #ffffff。气质：安静、学术工具感。
```

---

## 8. 工程接入（已实现）

| 步骤 | 动作 |
|------|------|
| 1 | 参考图放入 `apps/desktop/stitch-brand-logo-reference.png` |
| 2 | `python3 scripts/generate-brand-mark.py` → 生成 `mark-ru-standard.png` / `mark-ru-on-primary.png` / `icon-source.png` |
| 3 | `cd apps/desktop && npm run tauri icon src/assets/brand/icon-source.png` |
| 4 | [`BrandMark.tsx`](../src/components/BrandMark.tsx) 渲染 `markPaths.ts` 矢量 |

**注意**：UI 使用 potrace 矢量路径；Tauri 图标仍用 `icon-source.png`。重生成：`pip3 install potracer && python3 scripts/generate-brand-mark.py`

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-19 | 初版：字符「如」、5 Frame、上传包 27–29 |

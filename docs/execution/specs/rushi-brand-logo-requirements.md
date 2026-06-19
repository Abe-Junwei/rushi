# 如是我闻（Rushi）品牌 Logo 需求稿

> **状态**：已定稿 · 工程接入（`mark-v1-ru`）  
> **版本**：1.2  
> **日期**：2026-06-19  
> **关联视觉真源**：仓库根 [`DESIGN.md`](../../../DESIGN.md) · [`apps/desktop/src/config/tokens.ts`](../../../apps/desktop/src/config/tokens.ts)  
> **关联产品词汇**：[`CONTEXT.md`](../../../CONTEXT.md)  
> **工程落位**：[`apps/desktop/src/assets/brand/`](../../../apps/desktop/src/assets/brand/) · [`apps/desktop/src-tauri/icons/`](../../../apps/desktop/src-tauri/icons/) · [`BrandLockup.tsx`](../../../apps/desktop/src/components/BrandLockup.tsx) · [`BrandMark.tsx`](../../../apps/desktop/src/components/BrandMark.tsx)

---

## 1. 文档目的

本文是 **如是我闻** 桌面端品牌标识（Logo）的完整需求说明，供：

- 内部或外部视觉设计师出稿、评审、定稿；
- 开发在定稿后替换占位图标并接入 UI / Tauri 打包资产；
- 后续营销物料（README、发布页）复用同一套规范。

**不在本文范围**：应用内全站 UI 重设计、语段编辑器样式、Stitch 稿迭代（见 `DESIGN.md` 与各 `*-intent.md`）。

---

## 2. 背景与问题

### 2.1 产品身份

| 项 | 内容 |
|----|------|
| 代码名 | **Rushi** |
| 用户可见产品名 | **如是我闻** |
| 副标题 / 定位语 | **本地课录音转写与校对**（侧栏）；顶栏可用 **如是我闻 · 本地校对** |
| 产品类型 | 本地中文课音频转写与校对桌面应用（Tauri + React + SQLite + Python ASR 侧车） |
| 气质 | **Minimalist-Editorial**：Notion 式信息架构 + Serene Scholar 暖纸学术感 |

### 2.2 现状（2026-06-19 更新）

| 触点 | 状态 |
|------|------|
| Dock / 任务栏 / 安装包 | ✅ 书法「如」· saffron 底；`src-tauri/icons/*` 已由 `icon-source.png` 生成 |
| 欢迎侧栏品牌区 | ✅ `BrandLockup` · 组合 A · V2（32 容器 / 26px mark） |
| 环境 → 关于 | ✅ `BrandLockup` · 组合 B（48 容器 / 40px mark） |
| 顶栏 | ✅ `BrandTopBarLabel`（16px mark + caps 字标） | P2 ✅ |
| GitHub README | ✅ `lockup-readme.png` + 字标 | P2 ✅ |
| 矢量 master | ✅ `mark-master.svg` + `markPaths.ts`（potrace 纯路径；`BrandMark` 渲染 SVG） |

### 2.3 项目目标

1. 建立可缩放的 **图形标（Mark）**：书法单字 **「如」**，在 Dock / 侧栏尺寸可读。
2. Mark 与产品名「如是我闻」语义呼应；**不**使用麦克风 / 波形播放器意象。
3. 色彩与 **Notion Zen** 一致；禁止未入库 hex。
4. 产出 Tauri 位图套件 + UI 可复用组合标组件。

### 2.4 成功标准（签收）

- [x] Mark 在 32 / 1024px 通过产品手测（侧栏 + Dock）。
- [x] saffron 底 V2 反色清晰；白底标准版可用（`mark-ru-standard.png`）。
- [x] `npm run tauri icon` 生成全套 `src-tauri/icons/`。
- [x] 侧栏与关于页使用 `BrandLockup`；字标「如是我闻」保持不变。
- [x] 定稿版本号 **`mark-v1-ru`**（见 `brand-manifest.json`）。
- [x] 16px 顶栏 mark（`BrandTopBarLabel`）。
- [x] SVG 矢量 master（potrace 路径；`pip3 install potracer` 后重跑生成脚本）。

---

## 3. 品牌定位与叙事

### 3.1 核心命题（一句话）

> **在纸页上把声音落成可定稿的文字**——安静、准确、可修订。

### 3.2 要传达的感受

| 维度 | 要 | 不要 |
|------|-----|------|
| 情绪 | 专注、可信、温润、学术工具感 | 炫酷、娱乐、「AI 魔法」 |
| 动作 | 阅读、校对、插入、定稿、修订 | 直播、社交、泛录音 |
| 视觉 | 留白、几何、编辑痕迹 | 复杂插画、宗教具象、Office 截图式修订 |

### 3.3 与产品功能的映射

| 产品概念 | 可抽象为图形语言 |
|----------|------------------|
| 语段（Segment） | 等宽竖线 / 分栏 |
| 校对 / 改字 | 一处校订痕：折角、插入符、短横缺口 |
| 定稿（⌘+Enter） | 可选：开口角框（备选方案 B） |
| 编辑光标 | saffron 强调（与 `caret-color: zen-saffron-mid` 一致） |
| 修订轨导出 | **禁止**字面还原红删绿增 |

### 3.4 创意方向决策（已定稿 · `mark-v1-ru`）

**主方案：书法单字「如」**

- **结构**：正方形 mark；单字「如」居中，占画布约 **86%**（图标）/ 容器内 **~80%**（侧栏）。
- **容器（UI）**：saffron 圆角方（侧栏 32px、关于 48px）；Dock 为 saffron 满底 + 白字。
- **资产格式**：透明 PNG（`mark-ru-standard` / `mark-ru-on-primary`）；生成脚本 [`scripts/generate-brand-mark.py`](../../../scripts/generate-brand-mark.py)。
- **参考真源**：[`stitch-brand-logo-reference.png`](../../../apps/desktop/stitch-brand-logo-reference.png)。

**历史备选（v1.0 栏线 + 校订痕，未采用）**

栏线 + saffron 校订痕抽象标见 git 历史 / `mark-v0-placeholder`；小尺寸可读性不如单字方案，已弃用。

---

## 4. Logo 体系架构

品牌标识拆为 **三层**，按场景组合使用，禁止拉伸变形或改色外自由发挥。

```
┌─────────────────────────────────────────┐
│  [Mark]   如是我闻                        │  组合标 A（侧栏、关于页）
│           本地课录音转写与校对              │
└─────────────────────────────────────────┘

Mark only          → Dock、任务栏、favicon、32×32 按钮底
Wordmark only      → 顶栏窄空间（已有排版）
Monogram「R」      → 仓库 README、开发者文档（次要，P3）
```

### 4.1 组件定义

| 组件 | 内容 | 字体 / 样式 |
|------|------|-------------|
| **Mark** | 书法单字「如」 | PNG / 未来 SVG；见 `BrandMark` |
| **Wordmark** | 如是我闻 | **Noto Serif SC**，Medium，18px 级（UI 可缩放） |
| **Tagline** | 本地课录音转写与校对 | **Inter**，11px，muted |
| **Monogram** | 拉丁 R 或「如」简笔 | P3，非阻塞 |

### 4.2 组合规范

| 组合 | Mark 尺寸 | 与字标间距 | 使用场景 |
|------|-----------|------------|----------|
| **A · 侧栏** | 32×32 px 容器，mark **26px** | **12px**（`gap-3`） | `BrandLockup` · `WelcomeSidebarNav` |
| **B · 关于** | 48×48 px 容器，mark **40px** | **16px**（`gap-4`） | `BrandLockup` · `EnvAboutPanel` |
| **C · 顶栏** | 16px（可选 P2） | 8px | `ProjectPanel` 顶栏品牌行 |
| **D · Dock** | 系统自适应 | — | 仅 Mark，无字 |

**对齐**：Mark 与 Wordmark 首行 **cap height 视觉居中**；Tagline 与 Wordmark 左对齐。

**禁止**：Mark 与 Wordmark 高低差超过 2px；拉宽 Mark；在 Mark 外加描边阴影。

---

## 5. 色彩与字体规范

### 5.1 色板（唯一真源）

实现以 [`tokens.ts`](../../../apps/desktop/src/config/tokens.ts) / [`tokens.css`](../../../apps/desktop/src/styles/tokens.css) 为准；设计稿 **禁止** 新增 hex。

| Token | Hex | Logo 用途 |
|-------|-----|-----------|
| `ink` | `#2C2C2C` | 竖线、外框、单色版 mark |
| `saffron` | `#C58A43` | 校订痕、侧栏 mark 容器底 |
| `paper` | `#F2EFE8` | 预览背景、legacy 场景 |
| `notion-bg` | `#ffffff` | 主预览背景、反色 mark 前景 |
| `notion-text` | `#37352f` | Wordmark 正文色（与 ink 可互换，优先 notion-text） |
| `notion-text-muted` | `#6b6b6b` | Tagline |

**语义约束**：`cinnabar`（`#963530`）在 UI 中为 **危险 / 删除**，**不得** 用于品牌校订痕（避免与「删改」混淆）。

### 5.2 Mark 配色变体

| 变体 ID | 字色 | 底 | 场景 |
|---------|------|-----|------|
| **V1 · 标准** | ink `#2C2C2C` | 透明 / white | `mark-ru-standard.png` |
| **V2 · 按钮底** | white | saffron 实心方 | 侧栏 / 关于 · `mark-ru-on-primary.png` |
| **V4 · Dock** | white | saffron 满底 1024 | `icon-source.png` → Tauri icons |

侧栏默认：**V2**（与现 `bg-zen-saffron` 方块一致，仅替换内部图形）。

### 5.3 字体

| 用途 | 字体 | 字重 | 备注 |
|------|------|------|------|
| Wordmark | Noto Serif SC | Medium (500) | 与 `WelcomeSidebarNav` 一致 |
| Tagline / 顶栏 | Inter | 400 / 600 | 顶栏品牌可用 `label-caps` 样式 |
| 技术 / 仓库 | Inter + JetBrains Mono | — | 「Rushi」仅文档场景 |

---

## 6. 图形规范（Mark）

| 属性 | 值 |
|------|-----|
| 主画布 | 正方形 1:1 |
| 参考图 | `stitch-brand-logo-reference.png`（464×464 源） |
| 图标占比 | 裁切后约 **86%** @ 1024（`CONTENT_RATIO` in generator） |
| 安全区 | macOS Dock 圆角蒙版下笔画不贴边 |
| Mark 容器圆角 | **4px** @ 32px 侧栏容器 |
| 禁止 | 渐变、阴影、位图纹理、未入库 hex |

---

## 7. 应用场景矩阵

| 场景 | 资产 | 组合 | 背景 | 优先级 |
|------|------|------|------|--------|
| macOS Dock / Windows 任务栏 | `icon.icns` / `icon.ico` | Mark only | 系统 | **P0** |
| 侧栏品牌区 | SVG / PNG 32 | 组合 A · V2 | saffron 方底 | **P0** |
| 窗口标题 | 系统默认 | — | 随 Dock 图标 | P0 |
| 顶栏品牌行 | 16px mark + caps | 文字 + mark | notion-bg | **P2** ✅ |
| 关于 / 环境面板 | PNG 组合 B | 组合 B | white | **P1** ✅ |
| GitHub README | PNG + MD 字标 | 组合横排 | white | **P2** ✅ |
| 安装程序 / Store | 310×310 等 | Mark only | 按商店规范 | P1 |

---

## 8. 尺寸验收标准

定稿 Mark **必须** 通过下表全部项，否则不得入库。

| 尺寸 | 背景 | 通过标准 | 状态 |
|------|------|----------|------|
| **32×32** | saffron 方底 | 侧栏可辨「如」 | ✅ |
| **48×48** | saffron 方底 | 关于页组合标和谐 | ✅ |
| **1024×1024** | saffron | Dock / icns / ico | ✅ |
| **16×16** | saffron / white | Dock 衍生尺寸可读 | 手测通过（Tauri 生成） |

**对比测试**：与 **Inter 12px 正文**、**Noto Serif 18px 标题** 并排截图，品牌不突兀、不喧宾夺主。

---

## 9. 交付物清单

### 9.1 已交付（`mark-v1-ru`）

| 文件 | 说明 |
|------|------|
| `stitch-brand-logo-reference.png` | 书法「如」参考截图 |
| `mark-ru-standard.png` | ink 字 · 透明底 |
| `mark-ru-on-primary.png` | 白字 · 透明底 |
| `icon-source.png` | 1024 · saffron 底 · Tauri 源 |
| `mark-master.svg` | 32 viewBox · 内嵌 PNG |
| `lockup-readme.png` | 64 · README 用 mark |
| `brand-manifest.json` | 版本与色板元数据 |

### 9.2 组件

| 组件 | 路径 |
|------|------|
| `BrandMark` | `apps/desktop/src/components/BrandMark.tsx` |
| `BrandLockup` | `apps/desktop/src/components/BrandLockup.tsx` |
| `BrandTopBarLabel` | `apps/desktop/src/components/BrandTopBarLabel.tsx` |

### 9.3 工程目录

```
apps/desktop/src/assets/brand/
  brand-manifest.json
  mark-ru-standard.png
  mark-ru-on-primary.png
  icon-source.png

apps/desktop/src-tauri/icons/   # npm run tauri icon
```

### 9.4 交付元数据

见 [`brand-manifest.json`](../../../apps/desktop/src/assets/brand/brand-manifest.json)：

```json
{
  "version": "mark-v1-ru",
  "character": "如",
  "selectedVariant": "calligraphy-ru",
  "assetFormat": "png"
}
```

---

## 10. 工程接入说明（开发）

定稿后由开发执行，本文仅定义接口。

| 步骤 | 动作 | 状态 |
|------|------|------|
| 1 | 参考图 → `python3 scripts/generate-brand-mark.py` | ✅ |
| 2 | `npm run tauri icon src/assets/brand/icon-source.png` | ✅ |
| 3 | `BrandMark` + `BrandLockup` | ✅ |
| 4 | 侧栏 · 关于页接线 | ✅ |
| 5 | `brand-manifest.json` | ✅ |

---

## 11. 里程碑

| 阶段 | 产出 | 负责人 | 预计 |
|------|------|--------|------|
| **M1 · Brief 签收** | 本文确认 | 产品 | ✅ |
| **M3 · 资产生成** | PNG + Tauri icons | 开发 | ✅ |
| **M4 · 评审** | 侧栏尺寸手测 | 产品 | ✅ |
| **M5 · 定稿** | `mark-v1-ru` + manifest | 产品 | ✅ |
| **M6 · 接入** | BrandMark / Lockup / 关于页 | 开发 | ✅ |

---

## 12. 参考与对标

### 12.1 本仓视觉真源

- [`DESIGN.md`](../../../DESIGN.md) — Notion Zen、Minimalist-Editorial
- [`apps/desktop/docs/stitch-welcome-page-spec.md`](../../../apps/desktop/docs/stitch-welcome-page-spec.md) — 顶栏 / 侧栏品牌文案
- 现实现：[`BrandLockup.tsx`](../../../apps/desktop/src/components/BrandLockup.tsx) · [`EnvAboutPanel.tsx`](../../../apps/desktop/src/components/EnvAboutPanel.tsx)

### 12.2 气质参考（学克制，不临摹）

| 参考 | 学什么 |
|------|--------|
| Notion | 中性底、少色、工具感 |
| Things / OmniFocus | 小尺寸 mark 仍可识别 |
| 学术校勘 / 铅字 | 栏线、订痕抽象——**仅意象，不复古插画** |

### 12.3 反例

| 反例 | 原因 |
|------|------|
| Audacity / Descript 波形标 | 播放器心智 |
| 通用「文档 + 铅笔」Material 图标 | 无识别度 |
| 当前 Tauri 默认双圆 | 与产品无关 |

---

## 13. 权利与使用

- Logo 著作权归 **如是我闻 / Rushi 项目** 所有（具体主体由项目维护者填写）。
- 第三方 **不得** 改色、变形、加特效后用于非授权场景。
- 开源仓库 README 可使用标准组合标；衍生作品须保留比例与安全区。

---

## 14. 附录 A — 外部设计师 Brief（可复制）

```text
项目：如是我闻（Rushi）macOS/Windows 桌面端
任务：书法单字 Mark「如」+ 组合标；字标「如是我闻」已存在

主图形：书法「如」；saffron 底 + 白字（UI V2）/ saffron 满底（Dock）
气质：Minimalist-Editorial；安静、温润、学术工具

色板：ink #2C2C2C | saffron #C58A43 | white #ffffff

工程：scripts/generate-brand-mark.py · brand-manifest.json · BrandLockup
```

---

## 15. 附录 B — 评审检查清单

**创意**

- [x] Mark 为「如」，与产品名呼应
- [x] 无麦克风、波形、宗教具象
- [x] saffron 仅用于容器 / Dock 底

**系统**

- [x] 色值来自 §5.1
- [x] 与 Noto Serif 字标并排和谐（侧栏 + 关于）
- [x] V2 saffron 底版本已提供

**技术**

- [x] 1024 源图可生成 Tauri 全套图标
- [x] `brand-manifest.json` 已填写
- [x] SVG master 文件已提供（`mark-master.svg`；内嵌 PNG，可后续换纯路径）

**签收**

- [x] §8 主路径尺寸通过
- [x] `selectedVariant`: `calligraphy-ru`
- [x] `assets/brand/` 落位完成

---

## 16. 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-17 | 1.0 | 初版：栏线+校订痕方案（未采用） |
| 2026-06-19 | 1.2 | P2：顶栏 BrandTopBarLabel、README lockup、mark-master.svg |

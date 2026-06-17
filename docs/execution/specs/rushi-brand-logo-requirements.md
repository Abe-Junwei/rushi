# 如是我闻（Rushi）品牌 Logo 需求稿

> **状态**：已定稿（创意方向）· 待设计交付  
> **版本**：1.0  
> **日期**：2026-06-17  
> **关联视觉真源**：仓库根 [`DESIGN.md`](../../../DESIGN.md) · [`apps/desktop/src/config/tokens.ts`](../../../apps/desktop/src/config/tokens.ts)  
> **关联产品词汇**：[`CONTEXT.md`](../../../CONTEXT.md)  
> **工程落位预告**：`apps/desktop/src/assets/brand/` · `apps/desktop/src-tauri/icons/` · `WelcomeSidebarNav.tsx`

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

### 2.2 现状与缺口

| 触点 | 现状 | 问题 |
|------|------|------|
| Dock / 任务栏 / 安装包 | `apps/desktop/src-tauri/icons/` 为 **Tauri 默认占位图**（青橙双圆） | 与产品无关，缺乏专业识别度 |
| 欢迎侧栏品牌区 | saffron 方底 + **Lucide Mic** + Noto Serif「如是我闻」 | Mic 强调「录音采集」，与品牌重心 **校对** 不一致 |
| 顶栏 | 纯文字 `如是我闻 · 本地校对`，11px caps | 无图形标，窄窗仍可接受 |
| 关于页 / README | 无统一 mark | 缺少可复用标识 |

### 2.3 项目目标

1. 建立可缩放的 **图形标（Mark）**，在 16px 仍可识别。
2. 图形标叙事锚定为 **校对**（纸面定稿、修订、语段），而非麦克风 / 波形播放器。
3. 色彩、线宽、圆角与 **Notion Zen** 设计系统一致，禁止引入未入库色值。
4. 产出可工程化接入的矢量源文件与 Tauri 所需位图尺寸集。

### 2.4 成功标准（签收）

- [ ] Mark 在 16 / 32 / 128 / 1024px 通过 §8 验收表。
- [ ] 白底、paper 底、saffron 底三背景均可读。
- [ ] SVG master 仅使用 §5 色板；无渐变、无位图嵌入、无滤镜阴影。
- [ ] `npm run tauri icon`（或等价流程）生成全套 `src-tauri/icons/` 并替换占位图。
- [ ] 侧栏品牌区用 Mark 替换 Mic，字标「如是我闻」保持不变。
- [ ] 设计负责人与产品方书面确认定稿版本号（如 `mark-v1`）。

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

### 3.4 创意方向决策（已采纳）

**主方案：栏线 + 校订痕**

- **结构**：2–3 条等粗竖线，象征语段栏 / 稿纸分栏。
- **焦点**：**仅一处** saffron 校订痕（三选一，定稿时择一）：
  1. **插入符** — 极简 `^` 一笔；
  2. **折角** — `⌐` 形单笔画；
  3. **短横缺口** — 某条竖线上的 saffron 短划（表示「此处改过」）。
- **容器（可选）**：极浅圆角矩形外框（6px 逻辑圆角），暗示纸页；**禁止**便签折角 cliché。

**备选（仅当主方案小尺寸未通过时启用）**

| 代号 | 描述 | 优先级 |
|------|------|--------|
| B · 定稿框 | 开口角括号 `⌜` 框住竖线 | 中 |
| C · 修订一笔 | 基线 + 上方单弧 | 低（易像通用写作 App） |

**明确放弃的方向**

- 麦克风、耳机、声波纹、满屏波形；
- 佛像、莲花、经文装饰等宗教具象；
- 彩虹渐变、霓虹、3D 纸纹、drop shadow；
- 将「如是我闻」四字变形塞进 16px 图标。

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
| **Mark** | 栏线 + 校订痕图形 | 矢量路径，见 §6 |
| **Wordmark** | 如是我闻 | **Noto Serif SC**，Medium，18px 级（UI 可缩放） |
| **Tagline** | 本地课录音转写与校对 | **Inter**，11px，muted |
| **Monogram** | 拉丁 R 或「如」简笔 | P3，非阻塞 |

### 4.2 组合规范

| 组合 | Mark 尺寸 | 与字标间距 | 使用场景 |
|------|-----------|------------|----------|
| **A · 侧栏** | 32×32 px 容器，mark 占内区 ~70% | 字标左缘距 mark 右缘 **12px**（`gap-3`） | `WelcomeSidebarNav` |
| **B · 关于** | 48–64px | 16px | 关于面板（若有） |
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

| 变体 ID | 竖线 / 结构 | 校订痕 | 底 |
|---------|-------------|--------|-----|
| **V1 · 标准** | ink | saffron | 透明或 white |
| **V2 · 按钮底** | notion-bg 或 paper | notion-bg 或 saffron 点缀 | saffron 实心方（32×32 侧栏） |
| **V3 · 单色** | ink | ink（加粗或负空间区分） | 任意 |
| **V4 · 反色** | paper / white | paper / white | saffron 或 ink 满底 |

侧栏默认：**V2**（与现 `bg-zen-saffron` 方块一致，仅替换内部图形）。

### 5.3 字体

| 用途 | 字体 | 字重 | 备注 |
|------|------|------|------|
| Wordmark | Noto Serif SC | Medium (500) | 与 `WelcomeSidebarNav` 一致 |
| Tagline / 顶栏 | Inter | 400 / 600 | 顶栏品牌可用 `label-caps` 样式 |
| 技术 / 仓库 | Inter + JetBrains Mono | — | 「Rushi」仅文档场景 |

---

## 6. 图形规范（Mark 几何）

### 6.1 画布

| 属性 | 值 |
|------|-----|
| 主画布 | **正方形** 1:1 |
| 推荐 viewBox | `0 0 32 32`（主）及 `0 0 1024 1024`（导出） |
| 安全区 | 图形实体占画布 **60–70%**；四周留 **15%** 以上边距（适配 macOS 圆角蒙版） |

### 6.2 笔画与圆角

| 属性 | 值 | 对齐 |
|------|-----|------|
| 逻辑描边宽度 | **2**（32px 画布下）；16px 导出可 **1.5** | 与 Lucide `strokeWidth={2}` 一致 |
| 竖线数量 | **2 或 3** 条，等间距 | 禁止 4 条以上 |
| 竖线端点 | 平头或微圆角 | 禁止尖刺 |
| 外框圆角（若用） | **6px** @ 32px 画布（等比缩放） | 对齐卡片 `rounded-md` |
| Mark 容器圆角（侧栏） | **4px** @ 32px | 对齐 `rounded` 按钮 |

### 6.3 构图示意（非最终稿）

```
方案 1 · 插入符          方案 2 · 折角           方案 3 · 短横缺口

    ^                         ╱                      │
    │  │  │                  │  │  │                  │  ▌  │
    │  │  │                  │  │  │                  │  │  │
    │  │  │                  │  │  │                  │  │  │
   (saffron)               (saffron)                 (saffron 短横)
```

设计交付时须出 **三变体矢量稿**，评审后 **择一定稿**。

### 6.4 视觉层级

1. **结构**（竖线）为主，ink，占视觉重量 ~70%。
2. **校订痕**为唯一 accent，saffron，占 ~30%，**不得** 大于竖线视觉权重。
3. 无外框时，竖线组 **几何居中**；有外框时，竖线组在框内居中。

---

## 7. 应用场景矩阵

| 场景 | 资产 | 组合 | 背景 | 优先级 |
|------|------|------|------|--------|
| macOS Dock / Windows 任务栏 | `icon.icns` / `icon.ico` | Mark only | 系统 | **P0** |
| 侧栏品牌区 | SVG / PNG 32 | 组合 A · V2 | saffron 方底 | **P0** |
| 窗口标题 | 系统默认 | — | 随 Dock 图标 | P0 |
| 顶栏品牌行 | 16px PNG 可选 | 文字为主 | notion-bg | P2 |
| 关于 / 环境面板 | 48–64 SVG | 组合 A 或 B | paper / white | P1 |
| GitHub README | SVG | Mark + 字标横排 | white | P2 |
| 安装程序 / Store | 310×310 等 | Mark only | 按商店规范 | P1 |

---

## 8. 尺寸验收标准

定稿 Mark **必须** 通过下表全部项，否则不得入库。

| 尺寸 | 背景 | 通过标准 |
|------|------|----------|
| **16×16** | `#ffffff` | 可分辨「多条竖线」与「一处校订」；不可糊为色块 |
| **16×16** | `#C58A43` | V2 反色清晰 |
| **32×32** | saffron 方底 | 侧栏占位可替代 Mic，不依赖字标可联想到「编辑/栏」 |
| **32×32** | `#ffffff` | V1 标准版清晰 |
| **128×128** | `#F2EFE8` | 笔画比例均衡，校订痕不抢眼 |
| **1024×1024** | `#ffffff` | 无锯齿；安全区满足 §6.1；可生成 icns/ico |

**对比测试**：与 **Inter 12px 正文**、**Noto Serif 18px 标题** 并排截图，品牌不突兀、不喧宾夺主。

---

## 9. 交付物清单

### 9.1 设计源文件

| 文件 | 格式 | 说明 |
|------|------|------|
| `mark-master.svg` | SVG | 主矢量；路径精简；无嵌入字体 |
| `mark-v1-[variant].svg` | SVG | 三变体各一（插入符 / 折角 / 短横） |
| `lockup-sidebar.svg` | SVG | 组合 A，含字标轮廓或外链字体说明 |
| `rushi-brand-logo.fig` | Figma | 源稿（可选，建议提供） |

### 9.2 位图导出

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `icon.png` | **1024×1024** | Tauri 主图标源 |
| `128x128.png` / `128x128@2x.png` | 128 / 256 | Tauri 套件 |
| `32x32.png` | 32 | 内嵌 / 预览 |
| `mark-16.png` | 16 | 顶栏验收 |
| `mark-32-saffron.png` | 32 | 侧栏 V2 |

### 9.3 工程目录（定稿后）

```
apps/desktop/src/assets/brand/
  mark-master.svg
  mark-v2-saffron.svg          # 侧栏默认
  lockup-sidebar.svg
  README.md                    # 版本号、禁用规则摘要

apps/desktop/src-tauri/icons/  # 由 tauri icon 或脚本生成，覆盖占位图
  icon.png
  icon.icns
  icon.ico
  Square*.png
  ...
```

### 9.4 交付元数据

设计师须在交付包内附 `brand-manifest.json`（或 README 表格）：

```json
{
  "version": "mark-v1",
  "date": "YYYY-MM-DD",
  "selectedVariant": "caret | corner | notch",
  "colors": {
    "ink": "#2C2C2C",
    "saffron": "#C58A43"
  },
  "author": ""
}
```

---

## 10. 工程接入说明（开发）

定稿后由开发执行，本文仅定义接口。

| 步骤 | 动作 |
|------|------|
| 1 | 将 `mark-master.svg` 放入 `src/assets/brand/` |
| 2 | `npm run tauri icon path/to/icon.png` 生成 `src-tauri/icons/*` |
| 3 | `WelcomeSidebarNav.tsx`：`<Mic />` 换为 `<BrandMark size={32} variant="saffron" />` |
| 4 | 新增 `BrandMark.tsx`：仅渲染 SVG，props：`size`、`variant` |
| 5 | 手测 Dock 图标、侧栏、深色模式（若适用） |
| 6 | 无需改 `productName`（已为「如是我闻」，`tauri.conf.json`） |

**约束**：`BrandMark` 内 **禁止** 硬编码 hex；从 CSS 变量或 `tokens.ts` 读取。

---

## 11. 里程碑

| 阶段 | 产出 | 负责人 | 预计 |
|------|------|--------|------|
| **M1 · Brief 签收** | 本文确认 | 产品 | ✅ |
| **M2 · 草图** | 每变体 ≥5 草图，黑白 | 设计 | 2–3 天 |
| **M3 · 矢量精修** | 3 变体 SVG + 32/1024 预览 | 设计 | 2–3 天 |
| **M4 · 评审** | §8 验收表打勾 | 产品 + 设计 | 1 天 |
| **M5 · 定稿** | 全量 §9 交付物 | 设计 | 1 天 |
| **M6 · 接入** | PR：icons + BrandMark + 侧栏 | 开发 | 0.5 天 |

---

## 12. 参考与对标

### 12.1 本仓视觉真源

- [`DESIGN.md`](../../../DESIGN.md) — Notion Zen、Minimalist-Editorial
- [`apps/desktop/docs/stitch-welcome-page-spec.md`](../../../apps/desktop/docs/stitch-welcome-page-spec.md) — 顶栏 / 侧栏品牌文案
- 现侧栏实现：[`WelcomeSidebarNav.tsx`](../../../apps/desktop/src/components/WelcomeSidebarNav.tsx)

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
任务：图形标 Mark + 侧栏组合标；字标「如是我闻」已存在，无需重设计汉字

叙事：校对（proofreading）— 语段栏线上的编辑痕迹
主图形：2–3 条 ink 竖线 + 一处 saffron 校订痕（插入符 / 折角 / 短横三选一）
气质：Minimalist-Editorial；安静、温润、学术工具；非宗教具象、非 AI 炫酷

色板（禁止新增）：
  ink #2C2C2C | saffron #C58A43 | paper #F2EFE8 | white #ffffff

约束：
  - 正方形画布，60–70% 图形占比，15% 安全区
  - stroke 逻辑宽度 2；无渐变、无阴影、无照片
  - 16px 必须可识别
  - 字标：Noto Serif SC Medium「如是我闻」

交付：
  - SVG master + 1024 PNG + 三变体
  - 通过白 / paper / saffron 底预览

参考文档：docs/execution/specs/rushi-brand-logo-requirements.md
```

---

## 15. 附录 B — 评审检查清单

**创意**

- [ ] 叙事是「校对」而非「录音」
- [ ] 仅一处 saffron 强调
- [ ] 无宗教具象、无波形、无麦克风

**系统**

- [ ] 色值全部来自 §5.1
- [ ] 与 Noto Serif 字标并排和谐
- [ ] V2 侧栏 saffron 底版本已提供

**技术**

- [ ] SVG 路径可简化，无多余节点
- [ ] 1024 源图可生成 Tauri 全套图标
- [ ] `brand-manifest.json` 已填写

**签收**

- [ ] §8 全部尺寸通过
- [ ] 产品方确认 `selectedVariant`
- [ ] 开发已知晓 `assets/brand/` 落位

---

## 16. 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-17 | 1.0 | 初版：校对方向、栏线+校订痕主方案、交付与验收完整定义 |

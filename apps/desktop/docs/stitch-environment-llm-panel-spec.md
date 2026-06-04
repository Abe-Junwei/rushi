# 环境与 LLM 面板 — Stitch 重设计需求稿

本文描述 **浮动对话框「环境与 LLM」**（`FloatingPanelTemplate` · `preset="environment"`）及其中的 **本机 ASR**、**LLM 配置** 两个主 section 的布局重设计。在线 STT、配置迁移、使用说明 section 仅保留导航位与视觉一致性，**本轮 Stitch 重点交付 LLM + ASR 主路径**。

**代码真源（现状）：**

| 区域 | 入口 |
|------|------|
| 面板壳 | [`PanelTemplate.tsx`](../src/components/PanelTemplate.tsx) · `environment` preset |
| 编排 | [`EnvironmentPanel.tsx`](../src/components/EnvironmentPanel.tsx) |
| LLM | [`EnvLlmConfigPanel.tsx`](../src/components/EnvLlmConfigPanel.tsx) 及子组件 |
| 本机 ASR | [`EnvLocalAsrPanel.tsx`](../src/components/EnvLocalAsrPanel.tsx) 及 `envLocalAsr/*` |
| LLM 文案真源 | [`llmEnvStatus.ts`](../src/services/llm/llmEnvStatus.ts) · `buildLlmEnvPresentation` |
| ASR 文案真源 | [`asrEnvStatus.ts`](../src/services/asr/asrEnvStatus.ts) · `buildAsrEnvPresentation` |
| 能力—UI 纪律 | [`desktop-capability-ui-state-alignment.md`](../../../docs/architecture/desktop-capability-ui-state-alignment.md) |

**设计系统：** 仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen）。

**静态对照稿：** [`stitch-environment-llm-layout.html`](../stitch-environment-llm-layout.html)（F1–F6 Frame；**F1 本机就绪已与 Stitch 定稿对齐**）。

**Stitch 定稿记录（2026-06-04）：**

| 项 | 定稿 |
|----|------|
| LLM 主布局 | **单列连体卡片**（非两列）：Status Banner `rounded-t` + Connection Form `rounded-b`，共用外边框 |
| 模式切换 | `secondary-container` 底上的 **Segmented control**（白底选中 + shadow-sm） |
| 能力区 | 卡片**下方**独立 compact 条：`自动标点 · [徽章]` |
| 左 nav | 宽 **192px**（`w-48`）；选中项 **4px saffron 左条** + 可选 **6px 状态点** |
| CTA 排布 | 左：`恢复厂商默认`；右：`探测连接` + `保存配置`（Primary saffron） |
| 禁止项 | 无 Upgrade Plan；无 Zen Transcription 品牌（面板标题固定「环境与 LLM」） |

---

## 1. 用户目标与心智模型

| 场景 | 用户目标 | 成功标准 |
|------|----------|----------|
| **首次配置 LLM** | 在「本机 Ollama」与「云端 API」间二选一，完成连接验证 | 顶栏芯片变绿；自动标点 / 导出润色不再拦截 |
| **切换 LLM 来源** | 本机 ↔ 云端互斥切换，云端记住上次厂商 | 切换后表单与顶栏芯片一致；无需重新找 DeepSeek |
| **排障 ASR** | 看懂「当前所选模型」是否可转写，而非全局侧车状态 | 状态条、下载区、顶栏芯片三者不矛盾 |
| **从顶栏跳入** | 点击 `本机 LLM` / `云端 Kimi` 芯片直达 LLM section | `focusLlmSeq` 打开面板并滚动到 `#llm-config` |
| **从导出/标点跳入** | 能力不可用时有明确「去设置」路径 | blockReason 文案与设置页 banner 一致 |

**心智模型（须在设计中强化）：**

1. **转写（ASR）** 与 **文本后处理（LLM）** 是两条独立管道——LLM 页眉必须保留「转写仍走本机 ASR / 在线 STT」说明，但视觉上不要与 ASR section 混为一谈。
2. **本机 Ollama** 与 **云端 API** 是 **互斥模式**，不是并列勾选；切换即换运行时，不是「同时启用两个 LLM」。
3. **就绪 ≠ 已验证**：Ollama 服务可达（tags）与 chat 探测成功是两阶；云端 Key 已保存与探测成功也是两阶。UI 须区分 **服务就绪 / 待验证 / 可用（已验证）**。

---

## 2. 现状问题（重设计动机）

| # | 问题 | 影响 |
|---|------|------|
| P1 | LLM 页 **能力区块夹在状态与表单之间** | ✅ Stitch：能力下沉至卡片外底部 |
| P2 | 状态 banner 与表单 **视觉分离** | ✅ Stitch：连体卡片成组 |
| P3 | 云端 **7 个厂商 chip** 换行占满宽度，与模式切换视觉权重相同 | 主次不清 |
| P4 | 左导航 **仅 112–156px**，描述文字 2 行，与右侧宽内容区比例失调 | 小窗下 scale 变换（0.72–1.35）加剧模糊感 |
| P5 | ASR 面板 **8+ 区块** 用 `hr` 硬分隔，Wizard / Advanced / 模型 / 下载 / 缓存纵向过长 | 与 LLM 面板信息密度不一致 |
| P6 | 顶栏芯片与设置页 banner **已统一文案真源**，但 **视觉层级未统一**（ASR 有 status rows，LLM 没有） | Stitch 需一并规范 |

---

## 3. 面板外壳（不变约束）

```
┌─ FloatingPanelTemplate「环境与 LLM」────────────────────────────┐
│ [标题栏] 环境与 LLM                                    [× 关闭]   │
├──────────────┬──────────────────────────────────────────────────┤
│ 左 nav       │ 右 main（scroll-y）                               │
│ 5 sections   │ 当前 section 内容                                 │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

| 属性 | 值 | 说明 |
|------|-----|------|
| preset | `environment` | max 920×700，margin 24 |
| 标题 | `环境与 LLM` | 与顶栏按钮一致 |
| 左 nav 宽 | **192px**（`w-48`） | Stitch 定稿；描述单行 `truncate` |
| 右 main padding | `px-6 py-5`（24×20） | 与 Stitch `main-padding-x/y` 对齐 |
| 右 main 最大宽 | `max-w-[860px]` 内容居中可选 | 浮动面板内可省略 mx-auto |
| scale | 保留 ResizeObserver 缩放 | 设计稿按 **860×620 逻辑像素** 出图 |

**视觉层级（Two-Layer Border Rule）：** 面板壳（第 1 层 border）→ 左 nav 右边线（第 2 层）。**右 main 内 section 禁止第 3 层容器 border**；用 `bg-notion-sidebar/60`、`gap`、`rounded-lg` 背景差区分。

---

## 4. 设计令牌

与 [`DESIGN.md`](../../../DESIGN.md) 一致；Stitch 出图禁止散落 hex。

| Token | 用途 |
|-------|------|
| `notion-bg` / `notion-sidebar` | 主内容 / 左 nav |
| `notion-divider` | 分割线（section 间可用 `h-px`，不算容器 border） |
| `notion-text` / `notion-text-muted` | 正文 / 辅助 |
| `zen-saffron` | Primary CTA、选中 chip、focus ring |
| `zen-success` / `zen-cinnabar` / `zen-saffron` | 状态点：绿 / 红 / 黄 |
| `zen-indigo` + JetBrains Mono | baseUrl、模型 ID、路径 |

**排版（`PANEL_TYPOGRAPHY`）：**

| 级别 | 用途 |
|------|------|
| sectionTitle | 「LLM 配置」「ASR 状态」 |
| sectionDescription | 一段式说明 |
| fieldLabel | 字段标签、banner 标题 |
| meta | 辅助说明、密钥提示 |
| navLabel / navDescription | 左 nav |

**按钮：** `controlStyles.ts` — Primary saffron 32px；Secondary notion-sidebar 底。

---

## 5. 左导航（5 sections）

| id | 标签 | 描述 | 图标 (Lucide) | 本轮 |
|----|------|------|---------------|------|
| `local-asr` | 本机 ASR | FunASR 环境、模型与诊断 | `Cpu` | **重设计** |
| `online-stt` | 在线 STT | 在线转写 API | `Cloud` | 占位一致 |
| `llm` | LLM 配置 | 本机 Ollama 或云端 | `Sparkles` | **重设计** |
| `profile` | 配置迁移 | 导入 / 导出 | `Download` | 占位 |
| `help` | 使用说明 | 快捷键与 FAQ | `HelpCircle` | 占位 |

**Stitch 定稿（左 nav）：**

- 选中态：`bg-notion-sidebar-active` + **左侧 4px `zen-saffron` 竖条**（`absolute left-0`）。
- 每项：图标 + **标题一行** + **描述一行**（`text-[11px]`，`truncate`）。
- ASR / LLM nav item 右侧：**6px 圆点**（`zen-success` / `zen-saffron` / `zen-cinnabar`），与顶栏芯片同色语义。
- nav 顶区标题：**「环境与 LLM」**（与浮动面板标题栏一致；**不是**产品品牌名）。
- **禁止**侧栏底部 Upgrade / 订阅类 CTA。

**图标：** Stitch 用 Material Symbols；**编码仍用 Lucide**（`Cpu` / `Cloud` / `Sparkles` / `Download` / `HelpCircle`），尺寸与间距对齐 Stitch 即可。

---

## 6. LLM 配置页 — 目标信息架构（Stitch 定稿）

### 6.1 主布局：单列连体卡片（F1 已定稿）

**首屏目标：** 模式 → 连体卡片（状态 + 表单）→ 能力 compact；**860×620 内无需滚动**即可看到 CTA。

```
┌─ LLM 配置 ──────────────────────────────────────────────────────┐
│ [页眉] display-md 标题 + body-md 一行说明                          │
├──────────────────────────────────────────────────────────────────┤
│ [Segmented]  secondary-container 底 · 本机 Ollama | 云端 API      │
├──────────────────────────────────────────────────────────────────┤
│ ┌─ 连体卡片（单层外边框）──────────────────────────────────────┐  │
│ │ [Banner] rounded-t-lg · tone 背景 · border-x border-t       │  │
│ │   · 8px 状态点 + bannerTitle (semibold, tone 色)             │  │
│ │   · bannerDetail (muted)                                     │  │
│ │   · 本机：右上「刷新检测」+ refresh 图标                        │  │
│ ├──────────────────────────────────────────────────────────────┤  │
│ │ [Form] rounded-b-lg · bg-notion-sidebar/40 · border 全包     │  │
│ │   · label-caps 字段标签                                       │  │
│ │   · API 基址 / 模型 ID /（云端）厂商 chip + API Key           │  │
│ │   · border-t 分隔 CTA 行                                     │  │
│ │   · [恢复厂商默认] ←左    [探测连接] [保存配置●] →右          │  │
│ └──────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│ [能力 compact] rounded-lg · bg-notion-sidebar/60                 │
│   自动标点                                    [可用] badge          │
└──────────────────────────────────────────────────────────────────┘
```

**宽屏可选（≥960px，P2）：** 仅在 ASR section 保留「左 status + 右模型」两列；**LLM section 维持单列连体卡片**，不再拆两列。

**动线规则：**

1. Segmented 模式切换 **在页眉下、卡片上**（切换即持久化，互斥）。
2. Banner 与 Form **共用一层 border**；banner 仅 `border-t border-x`，form 补 `border-b`，视觉上一张卡。
3. **能力区在卡片外、下方**，不插入 banner 与 form 之间。
4. 反馈 `msg` 在 CTA 行下方（form 内），错误色 `zen-cinnabar`。

### 6.2 模式切换（`EnvLlmModeSwitch`）

| 属性 | 定稿值 |
|------|--------|
| 容器 | `inline-flex p-1 bg-secondary-container rounded-lg` |
| 选中项 | `bg-white shadow-sm text-primary`（或 `text-notion-text`） |
| 未选中 | `text-on-surface-variant hover:text-on-surface` |
| 辅助说明 | **移除** fieldset 下方长文案（信息并入 banner）；或保留一行 muted 在 segmented 下 |

### 6.3 状态 Banner（`EnvLlmStatusBanner`）

文案 **禁止设计稿写死**；实现从 `buildLlmEnvPresentation()` 读取。Stitch 需出 **6 个 tone 变体**：

| tone | 背景 class | banner 标题色 |
|------|------------|---------------|
| `ok` | `bg-zen-success/10` | `text-zen-success` + 8px 绿点 |
| `warn` | `bg-zen-saffron/10` | `text-zen-saffron` 或 notion-text |
| `error` | `bg-zen-cinnabar/10` | `text-zen-cinnabar` |
| `idle` | `bg-notion-sidebar-hover` | muted |

**本机模式** banner 右侧：**刷新检测**（text 按钮 + `refresh` 图标，`text-zen-success hover:bg-zen-success/10`）；云端无此按钮。

**bannerTitle / bannerDetail 示例（实现真源，可作 Stitch placeholder）：**

| mode | connection | bannerTitle | bannerDetail（摘要） |
|------|------------|-------------|----------------------|
| local | verified | 本机 LLM（Ollama）· 连接就绪 | 本机 Ollama 已验证… |
| local | unverified, tags ok | 本机 LLM（Ollama）· 服务就绪 | 请点击「探测连接」… |
| local | error | 本机 LLM（Ollama） | Ollama 未响应… |
| cloud | verified | 云端 LLM（DeepSeek）· 连接就绪 | API Key 已验证… |
| cloud | unverified | 云端 LLM（Kimi） | 尚未验证连通性… |
| cloud | missing key | 云端 LLM（DeepSeek） | 请填写并保存 API Key… |

**本机模式** banner 右侧：**刷新检测**（见上）。

### 6.4 状态明细 rows（P2 可选）

F1 定稿 **不含** rows。若后续加，放在 banner 与 form 字段之间、**无额外 border**：

| row id | 本机 Ollama | 云端 API |
|--------|-------------|----------|
| service | Ollama 服务：可达 / 不可达 | 厂商：DeepSeek |
| config | 模型：qwen2.5:7b | Key：已保存 / 未保存 |
| verify | 连接：已验证 / 待验证 | 连接：已验证 / 待验证 |

### 6.5 连接表单（`EnvLlmConnectionForm` — 连体卡片下半）

| 字段 | 本机 | 云端 | 控件 |
|------|------|------|------|
| 厂商 | 隐藏 | 显示 | chip row（DeepSeek / Kimi / 通义 + 更多） |
| API 基址 | 显示 | 显示 | `h-8` input · `font-mono-sm` · focus ring saffron |
| 模型 ID | 显示 | 显示 | 同上 + datalist |
| API Key | 隐藏 | 显示 | password + keychain 状态行 |

**CTA 行（Stitch 定稿）：** `border-t border-outline-variant` 分隔；`flex justify-end` + `恢复厂商默认` **`mr-auto`** 靠左；右侧 **探测连接**（Secondary）→ **保存配置**（Primary `bg-zen-saffron text-on-primary`）。

**反馈：** `msg` 在 CTA 下；失败 `zen-cinnabar`。

### 6.6 已接入能力（`EnvLlmCapabilitiesSection` — 卡片外）

| 能力 | label | 徽章（来自 presentation） |
|------|-------|---------------------------|
| auto_punctuate | 自动标点 | `可用` / `待验证` / `未配置` |

**Stitch compact（定稿）：** 独立 `rounded-lg p-4 bg-notion-sidebar/60`；单行 `flex justify-between`：`自动标点`（muted）+ badge（`bg-secondary-container` · label-caps「可用」/「待验证」）。

描述收进 tooltip / `<details>`（P2），F1 可不展示。

### 6.7 云端厂商列表（设计约束）

实现真源 7 家：`deepseek`, `kimi`, `qwen`, `siliconflow`, `doubao`, `openai`, `openrouter`。

Stitch 稿中 **至少展示 4 家** + overflow；选中 Kimi 时顶栏芯片应为「云端 Kimi」而非 DeepSeek。

---

## 7. 本机 ASR 页 — 目标信息架构（简版）

本轮与 LLM **同一面板壳**，须视觉节奏一致。

```
┌─ ASR 状态 ───────────────────────────────────────────────────────┐
│ [页眉]                                                            │
├───────────────────────────────┬──────────────────────────────────┤
│ [Col 左] 状态 banner + rows   │ [Col 右] 所选模型 + 下载进度      │
│ （与 LLM 同宽比）             │ + 主 CTA（下载/应用/取消）        │
├───────────────────────────────┴──────────────────────────────────┤
│ [折叠] 安装向导 · 高级诊断 · 缓存管理  （默认收起，chevron）       │
└──────────────────────────────────────────────────────────────────┘
```

**能力—UI 硬规则（Stitch 标注，编码必守）：**

| 维度 | 含义 | UI 须 |
|------|------|-------|
| D1 | 用户所选 hub 模型 | 下拉、下载进度、「可直接转写」 |
| D2 | 侧车实际运行模型 | mismatch 时显式警告 |
| D5 | 全局 ready_for_transcribe | **禁止**代替 D1 表示所选模型就绪 |

**status rows（已有，保持）：** 环境 / FFmpeg / 运行时 / 转写就绪 — 四行 list，绿点/红点。

---

## 8. 顶栏芯片 ↔ 设置页一致性

顶栏组件：[`AsrTopStatusChips`](../src/components/AsrTopStatusChips.tsx)、[`LlmTopStatusChip`](../src/components/LlmTopStatusChip.tsx)，共用 [`TopBarStatusIndicator`](../src/components/TopBarStatusIndicator.tsx)。

| 芯片 | 就绪示例 | 未就绪示例 | 点击 |
|------|----------|------------|------|
| FFmpeg | `FFmpeg` · 绿 | 红 | 无 |
| ASR | `ASR 就绪` | `ASR 未就绪` | 无（欢迎页可打开环境） |
| LLM | `本机 LLM` / `云端 Kimi` | `…待验证` / `…未就绪` | 打开环境面板 → LLM section |

**Stitch 可选 Frame：** 顶栏 3 芯片 + 打开的环境面板 LLM section 同屏，验证文案一致。

---

## 9. Stitch 交付 Frame 清单

| Frame | 尺寸 | 内容 |
|-------|------|------|
| F1 | 860×620 | **LLM · 本机 · 连接就绪** — **Stitch 定稿基准** |
| F2 | 860×620 | **LLM · 本机 · 服务就绪待验证**（warn 连体卡） |
| F3 | 860×620 | **LLM · 本机 · Ollama 未连接**（error banner，form 可弱化） |
| F4 | 860×620 | **LLM · 云端 · Kimi · 已验证**（+ 厂商 chip + Key） |
| F5 | 860×620 | **LLM · 云端 · DeepSeek · 待验证**（warn badge「待验证」） |
| F6 | 860×620 | **本机 ASR · 可直接转写**（连体卡 + 底部折叠提示） |

左 nav 在 F1–F6 中 **LLM 或 ASR 对应项高亮**。

---

## 10. 组件映射（编码回写）

| Stitch 区域 | 目标文件 |
|-------------|----------|
| 面板壳 / nav | `EnvironmentPanel.tsx` |
| LLM 页编排 | `EnvLlmConfigPanel.tsx` |
| 连体卡片 | 新 `EnvLlmConnectionCard.tsx`（banner + form 同 border）或合并现有 banner/form |
| 模式 segmented | `EnvLlmModeSwitch.tsx` |
| 状态 banner | `EnvLlmStatusBanner.tsx`（`rounded-t-lg`，无独立外边框） |
| 连接表单 | `EnvLlmConnectionForm.tsx`（`rounded-b-lg`，`bg-notion-sidebar/40`） |
| 能力 compact | `EnvLlmCapabilitiesSection.tsx`（卡片外底部） |
| 状态 rows（P2） | `EnvLlmStatusRows.tsx` |
| ASR 连体卡 + 折叠 | `EnvLocalAsrPanel.tsx` |

**禁止：** 在组件内硬编码状态文案；须继续消费 `buildLlmEnvPresentation` / `buildAsrEnvPresentation`。

---

## 11. 明确不做（Out of Scope）

- 不合并 ASR 与 LLM 为单一 section。
- 不增加「同时使用本机 + 云端 LLM」。
- 不在本 panel 内做自动标点 / 导出润色的完整 preview（仅能力徽章）。
- 不改在线 STT、配置迁移、帮助 section 的业务逻辑。
- 面板路径最多 2 层 container border（壳 + nav 右边线）；连体卡片内 banner/form 共用一层外边框，不算第 3 层。
- 无 Upgrade Plan / 订阅按钮。
- 无 Zen Transcription / 移动端-only 顶栏（Tauri 桌面浮动面板不需要）。
- 编码图标用 Lucide，不用 Material Symbols。

---

## 12. Stitch 提示词

### 12.1 English（主提示）

```text
Redesign the "Environment & LLM" settings panel for Rushi (Chinese desktop transcription app).
Style: Notion Zen — notion-sidebar #f7f7f5, saffron #C58A43, Inter + JetBrains Mono for URLs.
Left nav 192px, 5 items, saffron 4px left bar on active item, optional 6px status dot on ASR/LLM.
Panel title: "环境与 LLM" — NOT "Zen Transcription". No upgrade/subscription CTAs.

LLM section (PRIMARY — match signed-off F1):
- Header + segmented control (Local Ollama | Cloud API) on secondary-container track
- ONE connected card: green/amber/red status banner (rounded-t) + form body (rounded-b, bg notion-sidebar/40), shared outer border
- Form: API base URL, model ID, cloud vendor chips + API key when in cloud mode
- CTA row: "Restore defaults" left; "Probe connection" + saffron "Save" right
- Below card: compact capability row "Auto punctuation" + badge
Deliver F1–F5 LLM states + F6 Local ASR. Match stitch-environment-llm-layout.html DOM.
860×620 logical px inside floating dialog max ~920×700.
```

### 12.2 中文（补充）

```text
如是我闻（Rushi）「环境与 LLM」浮动面板。Notion 极简 + saffron。
左 nav 192px，五项，选中 saffron 左条 + 状态点。禁止 Upgrade Plan 与 Zen Transcription 品牌。
LLM 页：Segmented → **单列连体卡片**（上 banner 下表单，共用边框）→ 底部能力 compact 条。
CTA：左「恢复厂商默认」，右「探测连接」「保存配置」。
补 F2–F5 云端态与 F6 ASR。对照 stitch-environment-llm-layout.html。
```

---

## 13. 上传与回写流程

```bash
# 1. 生成本轮 Stitch 上传包
bash scripts/prepare-stitch-upload.sh

# 2. 上传到 Stitch
#    01-DESIGN.md
#    21-stitch-environment-llm-panel-spec.md
#    22-stitch-environment-llm-layout.html

# 3. 定稿后编码：EnvLlmConnectionCard 连体 → EnvironmentPanel nav → EnvLocalAsrPanel
# 4. 验证：npm run typecheck && npm run test && 手测 本机↔云端 + 顶栏芯片
```

---

## 14. 验收清单（设计签收）

- [x] F1 连体卡片：banner `rounded-t` + form `rounded-b`，共用 border（Stitch 2026-06-04）
- [x] Segmented 模式切换在 `secondary-container` 轨道内
- [x] 能力 compact 在卡片**外**底部
- [x] CTA：恢复默认左 / 探测+保存右
- [x] 左 nav 192px + saffron 左条 + 状态点
- [ ] F2–F5 云端/ warn / error 变体（HTML 对照稿已补）
- [ ] 本机/云端 banner 色调与顶栏芯片一致（编码时接真源）
- [ ] 云端 Kimi 时 banner 含「Kimi」
- [ ] 无 Upgrade Plan、无错误品牌名
- [ ] ASR F6 下载进度绑 **所选模型（D1）**

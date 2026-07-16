# 调研：本机转写耗时推算 / 进度 ETA

> **状态**：误瞄准 · 归档参考 · 2026-07-16  
> **更正**：用户实际问题是 **交付导出干净稿 LLM 润色耗时预估**，见 [`export-polish-eta-research.md`](./export-polish-eta-research.md)。本文仅作转写进度对照保留。
> **关联路线图**：转写 UX / R3e 长音频进度  
> **关联**：[`r3e-b-long-audio-chunking-research.md`](./r3e-b-long-audio-chunking-research.md) · [`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md)  
> **门禁**：未完成本文不得进入「转写剩余时间」类业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 本机/在线转写时，用户想知道「还要多久」或进度是否可信；现状感觉「耗时推算太不精确」 |
| 本仓现状 | **转写 UI 没有真正的剩余时间 ETA**。忙碌遮罩展示：窗进度 `第 i/n 段` + `已出 N 条语段` + 墙钟 **`已等待 Ns`**（不定进度条）。`duration×4+300`（clamp 600–7200）是 **超时预算**，不是给用户看的预计。唯一带「预计约 X 秒/分钟」的是 **导出润色**（字数启发式），易与转写混淆 |
| 成功标准 | 选定 ≥1 条业内成熟路线；明确「做什么 / 不做什么」；可落位到 window 进度与可选 EMA 剩余时间，且不把超时公式当 ETA |

### 1.1 本仓链路（真源）

| 层 | 路径 | 角色 |
|----|------|------|
| 超时公式 | `services/asr/rushi_asr/transcribe_timeouts.py` · `apps/desktop/src-tauri/src/project/transcribe_timeout.rs` | `ceil(dur×4)+300`，安全上限 |
| 窗进度 | `transcribe_job.py` → `window_index/count` | 分段真源 |
| UI 文案 | `projectStatusFeedbackCopy.ts` · `BlockingProgressCard` | 段号 + 已等待，**无** remaining |
| 润色 ETA（非转写） | `exportDocxPolish.ts` `estimateExportPolishSeconds` | 字数启发式 |
| RTFx | `eval_metrics.py` | **仅 eval**，未接 UI |

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 核心机制 | 可验证链接 |
|---|------|------|----------|------------|
| **A** | **音频位置 / 窗进度 %**（诚实进度，弱/无墙钟 ETA） | MacWhisper CLI（`Transcribing: 47%`）；FunASR `progress_callback(processed, total)`；WhisperKit `progress.fractionCompleted` | 进度 = 已处理音频/窗 ÷ 总量；Descript 官方文案甚至不给精确 remaining，只说「取决于时长与网络」 | [MacWhisper CLI](https://macwhisper.helpscoutdocs.com/article/57-macwhisper-command-line-tool) · [FunASR PR #2608](https://github.com/modelscope/FunASR/pull/2608) · [Descript Automatic transcription](https://help.descript.com/hc/en-us/articles/10249424286477-Automatic-transcription) |
| **B** | **运行时 RTF / EMA 外推剩余** | WhisperKit 社区进度条（`elapsed/progress` + EMA）；faster-whisper 批处理（均文件耗时 × 剩余文件数） | 暖机后再估：`remaining ≈ (1−p)/p × elapsed`（或按已完成窗的平均墙钟）；平滑避免跳动 | [WhisperKit #202](https://github.com/argmaxinc/WhisperKit/issues/202) · [faster-whisper batch ETA](https://github.com/ThePlasmak/faster-whisper/blob/master/SKILL.md) |
| **C** | **静态 RTF 表 × 音频时长**（开箱「预计」） | OpenWhispr 等模型尺寸指南（按机型/模型给出 RTF 表）；部分云厂商营销页「约实时 0.x」 | `ETA₀ = duration × RTF_table(model, device)`；首跑常严重偏离（冷启动、MPS、VAD、窗重叠） | [OpenWhispr model speeds](https://openwhispr.com/blog/whisper-model-sizes-explained) |
| **D** | **不定式 + 阶段文案**（故意不估秒） | Descript 转写；多数云 ASR 上传后「Transcribing…」 | 强调存活与阶段（上传/排队/识别），用户用「是否卡住」判断，而非秒表 | Descript help / Canny 反馈（用户反过来要 % / remaining） |

### 2.1 业内共识（可复用结论）

1. **不要把超时公式当 ETA** — 超时是安全余量（Rushi `×4+300` 与导出润色注释同一原则：超时下限会明显高估典型耗时）。
2. **墙钟 ETA 在本地 ASR 上天然不稳** — 冷启动、模型切换、窗大小、GPU/MPS、静音占比都会让 RTF 变一个数量级；成熟产品要么给 **% 进度**，要么 **暖机后用 EMA**，要么 **干脆不定式**。
3. **批任务**（多文件）比单文件好估：均文件耗时 × 剩余文件（faster-whisper）；单文件长音频更适合 **窗/采样进度**。
4. **用户真正怕的是「卡住」** — 阶段标签 + 已等待 + 有前进的 %，往往比「预计 183 秒」更可信。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 冲突 | 进度 UX |
|------|--------|----------|---------------|---------|
| **A 窗/% 进度** | **高** | 已有 `window_index/count`；可映射为确定进度条 `i/n`；FunASR 样本进度可后补 | 无 | 诚实；单窗路径仍弱 |
| **B EMA 剩余** | **中** | 可在桌面轮询层用已完成窗的墙钟平均外推；不改侧车协议也能做粗估 | 首 1～2 窗误差大；须「估计中…」门槛（如 p>5% 或 ≥1 窗完成） | 有「约剩余」但会抖，需平滑 |
| **C 静态 RTF 表** | **低** | eval 已有 RTFx，可积累表 | 与「本机硬件/SKU 多样」冲突；易重蹈「不精确」 | 开箱有数，准度差 |
| **D 不定式** | **高（已部分采用）** | 现状即此 | 用户明确抱怨「推算不精确」时，纯 D 不够 | 稳，但不满足「还要多久」 |

**本仓已有可复用模块（禁止另造进度真源）**：

- `transcribe_job` 的 `window_index` / `window_count` / `segments_total`
- `transcribePreviewState` / `transcribeLocalJobRun` 轮询
- `projectStatusFeedbackCopy` + `BlockingProgressCard`（已支持 elapsed；可接确定进度）
- `eval_metrics` RTFx（仅作事后校准数据，不直接当 UI ETA）
- 导出润色 `estimateExportPolishSeconds` 的注释纪律：**超时 ≠ 预计**

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定** | **A 为主 + B 为辅（可选）**：① 把多窗转写做成**确定进度**（`i/n` 或 %）；② 至少完成 1 窗（或 p≥阈值）后再显示 **「约剩余 Xm」**，用 EMA/窗均时外推；③ 文案用「约」+ 粗粒度（分钟级），禁止秒级假精确 |
| **不做什么** | 不把 `duration×4+300` 展示给用户当预计；不建静态跨机 RTF 表当主路径；不 fork 第二套 VAD/窗进度；不在冷启动前强报 ETA |
| **与 architecture** | 进度仍属任务态（R3-STATE）；窗计数仍是侧车真源；UI 只消费 status，不本地瞎猜窗总数 |
| **风险** | 单窗短音频仍难估 → 只显示已等待 +「识别中」；在线云端保持不定式或「已识别 N 条」 |

### 4.1 推荐 UX 分层

| 阶段 | 展示 |
|------|------|
| 排队 / 规范化 / 模型加载 | 阶段文案 + 已等待（不定条） |
| 多窗识别中 | **确定条** `窗 i/n`（或 %）+ 已出语段 + 已等待 |
| 暖机后（可选） | 「约剩余 X–Y 分钟」（EMA，带宽而非单点） |
| 单窗 / 在线无窗 | 不定条 + 语段数 / 厂商文案；**不报假 ETA** |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `projectStatusFeedbackCopy.ts` · `BlockingProgressCard` | 多窗确定进度；可选 remaining 文案 |
| TS | 新建小纯函数 `estimateTranscribeRemainingSecs(windowsDone, elapsed, …)` | EMA/窗均时；单测 |
| 轮询 | `transcribeLocalJobRun.ts` / busy shell | 传入 elapsed + window 快照 |
| 侧车 | **默认不改**；可选后续接 FunASR `progress_callback` 做窗内细粒度 | 后置 |
| 文档 | acceptance + 能力—UI：转写 busy 矩阵 | 补「有/无 ETA」态 |
| **禁止** | 改 `transcribe_timeouts.py` 公式去「凑」UI 数字 | 超时与预计分离 |

---

## 6. 签收

- [x] 调研 brief 完成
- [ ] intent / plan / acceptance 已链接本文（编码前）
- [ ] 用户确认可进入 Plan（A+可选 B）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 初版：对照本仓超时/窗进度 + Descript / MacWhisper / FunASR / WhisperKit EMA / faster-whisper 批 ETA |

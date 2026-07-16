# 调研：交付导出干净稿（LLM 润色）耗时预估

> **状态**：规划门禁 · 2026-07-16  
> **关联**：干净稿 / 讲稿导出润色 · EXP-WORD  
> **关联代码**：`exportDocxPolish.ts` · `postprocess_http.rs` · `postprocess_export_polish_cmd.rs`  
> **更正**：先前 [`transcribe-eta-progress-research.md`](./transcribe-eta-progress-research.md) 针对转写——**用户实际抱怨的是本议题**（干净稿「处理预计」偏差过大）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 交付导出选 **干净稿**（必走大模型润色）时，忙碌遮罩显示「处理预计约 X 秒/分钟」；与真实等待差太多，削弱信任 |
| 本仓现状 | 预估是**开跑前**的静态字数启发式，与真实链路（**多 batch 串行 LLM** + 本机冷启动 + 失败再切分重试 + 再写 DOCX）脱节 |
| 成功标准 | 选定路线后，短稿/长稿/本机/云端四象限手测：预估与实测墙钟的相对误差可接受，或改为「不定式+阶段」而不再报假秒数 |

### 1.1 本仓公式对照（偏差根因）

**UI 预估**（`estimateExportPolishSeconds`）：

| | 本机 loopback | 云端 |
|--|---------------|------|
| 基线 | **15s** | **5s** |
| 字速 | 500 字/秒 | 1500 字/秒 |
| 封顶 | 900s | 180s |
| 公式 | `min(base + floor(chars/rate), max)` | 同左 |

**Rust 请求超时**（`export_polish_timeout_secs`，**不是**给用户看的）：

| | 本机 | 云端 |
|--|------|------|
| 下限 | **120s** | **45s** |
| 字速 | 500 字/秒 | 1500 字/秒 |
| 封顶 | 900s | 180s |

| 场景 | UI 预计 | 超时下限 | 真实常见情况 |
|------|---------|----------|--------------|
| 本机短稿（暖机） | ~15s | 120s | 可能 20–60s → UI **略低估或尚可** |
| 本机短稿（冷启动 Ollama） | ~15s | 120s | 常 60–180s → UI **严重低估** |
| 本机长稿（多 batch） | 按总字数线性 | 按**单 batch** 字数计超时 | 串行 N 批 + 每批 TTFT → UI **按总字估算，未乘批次数开销** → 易低估 |
| 云端短稿 | ~5s | 45s | 注释称实测 ~5s → 短稿尚可 |
| 云端长稿 | 线性至 180s 封顶 | 同封顶 | 批次数↑时仍可能低估 |

**链路真源**（`postprocess_export_polish_cmd.rs`）：

1. `plan_export_polish_batch_bodies` → **多批**  
2. **串行** `run_export_polish_batch`（每批一次 HTTP；失败可再 **对半切分重试**）  
3. merge → 前端/ Rust 写 DOCX（修订轨等）  

UI 只吃 **总字符数**，**不知道 batch 数**，也 **收不到已完成 batch 进度**。

展示：`busyOverlayCopy("export_polish")` → `处理预计约 N 秒/分钟`（`ProjectPanel` 用 `estimateExportPolishSecondsForSegments`）。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **不定式 + 阶段文案**（不报墙钟 ETA） | ChatGPT / Claude / Perplexity 长任务；LLM UX 通识 | 「正在润色…」「第 2/5 批…」+ 已等待；**避免不准的剩余秒数**（不准的 ETA 反而增加焦虑） | [Designing for LLM Latency](https://ai-tldr.dev/learn/building-ai-apps/ai-ux-patterns/designing-for-llm-latency/) |
| **B** | **流式可见进展**（改感知，非改总时长） | 主流 LLM 产品默认 streaming | 首 token 后持续出字；总墙钟不变，感知更快；适合对话，结构化 JSON 批处理较难 | 同上 · [Streaming UX](https://dev.to/pockit_tools/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534) |
| **C** | **按批进度 + 跑后 EMA** | 批处理流水线 / WhisperKit 类 EMA | 已知 `batch_i/N` → 确定进度；≥1 批完成后 `remaining ≈ avg_batch_ms × left` | 与本仓已有 `batches={batch_total}` 日志对齐 |
| **D** | **静态字数/ token 表**（现状） | 本仓 UI；部分「预计处理时间」表单 | `base + chars/rate`；实现简单，**无法覆盖冷启动与批次数** | 本仓 `exportDocxPolish.ts` |

### 2.1 业内共识（针对「LLM 长任务」）

1. **不准的剩余时间不如不报** — 假 ETA 伤害信任。  
2. **阶段 / 批进度** 比秒表更稳。  
3. **超时公式 ≠ 用户预计**（本仓注释已写明；但 UI 仍用同源字速、更低基线）。  
4. Streaming 是感知优化；干净稿要稳定 JSON 行对齐，**全量 stream 进 UI 成本高**，优先批进度即可。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | UX |
|------|--------|----------|------|-----|
| **A 不定式+阶段** | **高** | 已有 busy 遮罩、`已等待`；可改文案为「润色中」 | 用户可能仍想要「多久」 | 诚实 |
| **C 批进度+EMA** | **高** | Rust 已有 `batch_no/batch_total` 与 `batch_latency_ms`；补事件/轮询即可 | 需 IPC 进度通道（现无前端 batch 进度） | 可信度最高 |
| **B Streaming** | **低～中** | 云端易接 SSE；loopback/Ollama + 强制 JSON schema 难 | 与「整批 JSON 行对齐」真源冲突大 | 感知好，工程重 |
| **D 调参字数表** | **中** | 改 `baseSecs` / rate | **治标不治本**（冷启动、多批仍炸） | 仍易偏 |

**本仓可复用（禁止第二套润色栈）**：

- `plan_export_polish_batch_bodies` / merge / retry-split  
- `export_polish_timeout_secs`（仅超时）  
- `busyOverlayCopy` + elapsed  
- 诊断日志里的 `batches=` · `batch_latency_ms=`

---

## 4. 决策摘要（建议）

| 问题 | 结论 |
|------|------|
| **选定** | **A + C 薄片**：① 去掉或弱化开跑前「处理预计约 X 秒」（改为「本机模型可能需数分钟」类带宽文案，或干脆不报秒）；② 把 **batch i/N** 推到 UI（确定进度）；③ 可选：完成 ≥1 批后显示「约剩余」EMA |
| **不做什么** | 不把超时下限当 ETA；不为「凑准」继续拧静态字速表当主方案；不做完整 token streaming 进干净稿主路径（可后置 spike） |
| **与 ADR** | 超时与预计分离（已有注释纪律）→ UI 落实；进度属导出任务态 |
| **风险** | 需最小 IPC：Rust 导出润色循环 emit `export_polish_progress { batch, total }`；漏接则仍只有不定式 |

### 4.1 推荐文案分层

| 阶段 | 展示 |
|------|------|
| 开始～首批返回前 | 「大模型润色中」+ 已等待；本机可加「首次加载模型可能较慢」 |
| 多批进行中 | **第 i/N 批**（确定条）+ 已等待 |
| ≥1 批完成（可选） | 「约剩余 X–Y 分钟」 |
| 写 DOCX | 「正在写入 Word」 |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| Rust | `postprocess_export_polish_cmd.rs` | 每批前后 emit 进度事件（或回调 channel） |
| TS | `exportDocxPolish` / export controller / busy copy | 消费 batch 进度；弱化静态 ETA |
| 纯函数 | `estimateExportPolishSeconds` | 降级为可选提示或删除主路径调用；单测更新 |
| 测试 | copy + polish tests | 无秒数 / 有 batch 文案 |
| **禁止** | 用 `export_polish_timeout_secs` 填遮罩 detail | |

---

## 6. 签收

- [x] 调研 brief 完成  
- [ ] intent / plan / acceptance 链接本文  
- [x] 用户确认：A+C（去掉假 ETA + 第 i/N 批进度）  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 初版：纠正议题为干净稿润色 ETA；对照 UI vs 超时 vs 多 batch 串行；业内 LLM 延迟 UX |
| 2026-07-16 | 用户确认 A+C：实现 `export-polish-progress` 事件 + 遮罩「第 i/N 批」 |

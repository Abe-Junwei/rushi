# Plan：音视频预处理 + 基础必要剪辑（AV-PRE / EDIT-BASIC）

> **调研 brief**（必读）：[`av-preprocess-import-flow-research.md`](./av-preprocess-import-flow-research.md)  
> **技术栈 / 坑规避**：[`phase-1-2-tech-stack-paths-research.md`](./phase-1-2-tech-stack-paths-research.md) §3  
> **时间轴契约**：[`media-timeline-interval-mapping.md`](../../architecture/media-timeline-interval-mapping.md)  
> **评估吸收**：[`phase-2-external-review-absorb-2026-07-18.md`](./phase-2-external-review-absorb-2026-07-18.md)  
> **阶段排期**：[`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md) **Wave M**  
> **关联**：ACC L0 · [`audio-import-container-normalize-research.md`](./audio-import-container-normalize-research.md) · [`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md)

---

## 0. 一句话

本机建立 **`source`（只读母带）/ `working`（可预处理、可剪辑）**；支持预处理三入口与 Trim/删区/Split；转写读 `working`，**语段落库为 Source 时间**（经区间映射）；播放/波形走 peaks + 可选 Proxy（**禁止**长轨全量 Web AudioBuffer）。

---

## 1. 目标与非目标

### 1.1 目标

1. 导入前后均可跑轻量预处理（容器/抽轨；可选响度/降噪）。  
2. 编辑器内完成基础媒体剪辑（头尾 Trim、Ripple 删区、Split）。  
3. 处理完可自动进入项目编辑，或先入库再处理（三入口见调研）。  
4. 不破坏现有语段校对能力；母带可重置。

### 1.2 非目标

| 不做 | 原因 |
|------|------|
| 云 Enhance / 云剪辑 | 本机优先 |
| 多轨 / 转场 / B-roll | 超出基础必要 |
| 删字即删媒体（Descript） | EDIT-TEXT 远期 |
| 默默覆盖母带 | 数据安全 |

---

## 2. 数据模型（最小）

| 概念 | 存储 | 说明 |
|------|------|------|
| `source_audio_path` | 项目媒体目录 | 导入时副本；只读 |
| `working_audio_path` | 同项目目录 | 缺省可等于 source；预处理/剪辑后指向新文件 |
| `media_mapping` | JSON 列或旁路表 | Working↔Source 区间映射；见 architecture 文 |
| `media_dirty` | bool | 剪辑后相对「上次转写媒体」已变；UI 提示 |
| `preprocess_job` | SQLite 或旁路表 | 状态、进度、错误、配置快照 |
| peaks | 现有 peaks 目录 | working 变更后**全量重生**（沿用现管线，非 Web Audio 全量解码） |
| 实体 ID | **ULID 字符串**（`TEXT`/`VARCHAR(26)`） | **M0**；SQLite 与 PG **同形 TEXT**；禁止 PG 原生 `UUID` 类型（Phase 2 §8.2 **ID-TEXT**） |

转写：读 `working` → ASR 输出 working 时间 → **`toSourceTime` 后写入语段**。  
播放/UI：语段 source 时间 → **`toWorkingTime`** 投影；删区死区 → 隐藏/置灰。

---

## 3. 产品入口

| 入口 | 行为 |
|------|------|
| A 导入时 | Create/Import 确认勾选预处理 → 任务 → 打开编辑 |
| B 项目内 | Hub/编辑器「预处理…」对已有 File |
| C 工作台 | Welcome 无项目处理 → 新建并打开 / 加入已有 / 仅导出文件 |

剪辑工具：波形选区 + 播放头；工具条 **Trim / 删除 / 切开 / 重置 working**。

---

## 4. 薄片与验收（与 Phase 2 Wave M 对齐）

| ID | 范围 | 验收 |
|----|------|------|
| **ID-STABLE** | 对外 ID → ULID/UUIDv4 | 新建语段不依赖 AUTOINCREMENT 同步 |
| AV-PRE-1 | source/working + 恒等 mapping + 任务 + demux/remux + 入口 A/B | 视频可出工作音频；映射恒等可测 |
| EDIT-BASIC-1 | Trim + Ripple + 映射更新 + peaks + `media_dirty` | 投影正确；删区→working null；**不**批量改写语段行 |
| EDIT-BASIC-2 | Split→第二 File；重置 working（映射回恒等） | source 仍在 |
| AV-PRE-2 | 入口 C | 三去向手测 |
| AV-PRE-3 | 可选响度 | 默认不强制 |
| AV-PRE-4 | 降噪 Gate | 不过则不上默认开 |
| EDIT-BASIC-3 | 压长静音 | 可选 |
| AV-PRE-5 | Proxy 低码率听音 | **禁止** 2h 全量 AudioBuffer；peaks 管线不变 |

每薄片开编码前补 `*-intent.md` / `*-acceptance.md`（可合并短片），顶部链接本 plan + research。

---

## 5. 落位预告

| 层 | 模块 |
|----|------|
| Rust | `media_preprocess/`、`media_edit/`；扩展 `files` 列或等价 |
| UI | Import 确认、Welcome 工作台、波形编辑工具条；逻辑下沉 controller |
| ASR | 不改职责；吃桌面给出的工作文件路径 |
| 测试 | trim/ripple/split/重置；导入回归 |

---

## 6. 与协作支柱衔接

- Wave M 完成的 `working` 命名与协作 `source_audio`/`proxy_audio` 对齐，避免 R8 再造。  
- 协作上传默认推送 `working`（策略在 COL 薄片 acceptance 写明）。

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版；挂 Phase 2 Wave M |
| 2026-07-18 | 吸收评估：区间映射、media_dirty、ID-STABLE、Proxy 纪律 |

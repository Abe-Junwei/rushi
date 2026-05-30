# Spec: B12 — 占位语段从启发式升级为显式类型

> **状态**：✅ 已实施（方案 A 持久化列；全量闸门通过）
> **关联**：[`fix-backlog.md` B12](./waveform-audit-2026-05/fix-backlog.md)、[`desktop-waveform-engine.md` §语段语义真源](../../architecture/desktop-waveform-engine.md)

## 背景

「整轨占位语段」（dominant span）在波形上不渲染，是 ASR 在**未能产出子句**时的兜底：`transcribe.rs` 输出单个 `{start:0, end:duration, text:full_text}`。当前判定靠启发式 `span/duration ≥ 0.85`（`WAVEFORM_DOMINANT_SPAN_RATIO`），**TS 与 Rust 各维护一份**：

- TS：`isDominantWaveformSpanSegment`（`waveformSegmentBounds.ts`）→ 经 `selectPackableSegments` 供 render/lane/命中/创建重叠共用。
- Rust：`is_dominant_span_segment`（`segment_media_sanitize.rs`）→ 持久化时 `sanitize_segments_for_media` 过滤冗余占位。

## 问题（为什么要升级）

阈值是**脆弱的猜测**：

- **假阳性**：短片段中合法的长单段（如 10s 片段里一条 9s 语段）会被判为占位而从 overlay 隐藏，用户看不到也点不到。
- **假阴性**：恰好 84% 的整轨兜底不被识别。
- 双份阈值（TS/Rust）若漂移，行为分叉。

显式类型让**产生者**（ASR 兜底）直接标明意图，下游不再靠跨度反推。

## 设计

### 不变量

- 显式标记存在时**优先**；缺失时回退 0.85 启发式（兼容旧数据）。
- `selectPackableSegments`（TS）与 `sanitize_segments_for_media`（Rust）共用同一「是否占位」判定语义。
- 默认行为对现有多语段文件**不回归**（多语段文件本就不含占位）。

### 字段

新增可选标记（命名待定，建议 `kind?: "speech" | "placeholder"`，默认视为 `speech`）：

- 产生点 `transcribe.rs` 整轨兜底分支标记为 `placeholder`。
- 判定：`占位 = kind === "placeholder" || (kind 缺失 && 启发式 dominant)`。

### 关键决策：是否持久化（需确认）

落库已在 `sanitize_segments_for_media(filter_dominant_when_redundant=true)` 过滤冗余占位 → **多语段文件不持久化占位**；唯一被持久化的占位是「单条整轨语段」（作为唯一语段被保留）。

| 方案 | 做法 | 解决假阳性？ | 成本 |
|----|----|----|----|
| **A 持久化列** | `segments` 加 `kind TEXT`（SQLite `ALTER TABLE ADD COLUMN`，附加式安全）；Rust DTO + INSERT/UPDATE/SELECT；serde default；TS DTO | ✅ 含重载后的长单段 | 中（迁移 + 三层字段） |
| **B 仅内存** | 仅 transcribe 响应 + 前端内存带标记，不落库；重载后无标记走启发式 | ❌ 重载后仍靠启发式 | 低（无迁移） |

- **A** 是「显式类型」的完整形态，彻底消除假阳性；SQLite 加列为附加式、对旧库安全（旧行该列为 NULL → 视为 `speech`/缺失）。
- **B** 是最小切片：升级**主路径**（新转写），重载后退回启发式；不解决持久化长单段的假阳性。

**建议 A**（#1 的意图是「显式类型」，B 仅半步；加列在 SQLite 成本低、风险可控）。

## 验收

1. ASR 整轨兜底产出的语段带显式 `placeholder` 标记。
2. `selectPackableSegments` / `sanitize_segments_for_media` 对「显式标记」与「无标记 + 启发式」两路都正确。
3. 旧数据（无标记）行为不变：仍走 0.85 fallback。
4. （方案 A）重载后显式标记保留；旧库行（NULL）按缺失处理。
5. TS + Rust focused tests 覆盖：显式标记占位被排除、无标记长段走 fallback、普通多语段不受影响。
6. 架构守卫与现有不变量测试不回归（`npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`；Rust `cargo test`）。

## 落位文件

- `apps/desktop/src/tauri/projectTypes.ts` — TS DTO 增字段
- `apps/desktop/src/utils/waveformSegmentBounds.ts` — selector 优先显式标记
- `apps/desktop/src-tauri/src/project/types.rs` — Rust DTO 增字段（serde default）
- `apps/desktop/src-tauri/src/project/transcribe.rs` — 兜底分支打标记
- `apps/desktop/src-tauri/src/project/segment_media_sanitize.rs` — 判定优先显式标记
- （方案 A）`apps/desktop/src-tauri/src/project/segment_cmd.rs` + DB 迁移 — 列读写 + `ALTER TABLE`
- 对应 `*.test.ts` / Rust `#[test]`

## 完成定义

- [x] 持久化范围确认：方案 A（DB `kind` 列，`migrate_segments_kind` 附加式迁移）
- [x] TS + Rust 实施 + 测试（`isPlaceholderSegment` / `is_placeholder_segment`，显式 + fallback 两路）
- [x] 全量闸门通过：TS typecheck + 502 vitest + 架构守卫 0 错误；Rust 155 `cargo test`
- [x] `desktop-waveform-engine.md` §语段语义真源 已补「显式 kind 优先、启发式 fallback」

## 实施附记

- 顺带修正了早先 `sanitize_segments_for_media` 接线的副作用：仅在**确有删除**时才 reindex，空操作路径保留调用方 idx（恢复 `file_save_segments_swaps_idx` 测试）。
- 用户**创建 / 合并 / 拆分**的语段现已显式标 `speech`（`insertSegmentAfter` / `insertSegmentFromTimeRange` / `mergeTwoSegments` / `buildSplitPair`），彻底消除「手动长单段被 0.85 启发式误隐藏」的假阳性。启发式仅剩旧数据 / 未标记语段的 fallback。

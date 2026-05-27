# Acceptance: TRN-DIAG — 转写任务可观测（单机）

> **状态**：📋 未编码  
> **排期**：路线图 §4.1.1 **⑤′½**（R3t-B 之后）  
> **Backlog**：[`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.2  
> **依赖**：R3t-B 转写编排、R3e 失败分类文案

## 目标

长音频或复杂转写失败时，用户能在 **UI** 与 **诊断包** 中看到：**阶段**、**耗时**、**段进度**、**warnings**，以及 **建议动作**（重试 / 清缓存 / 换模型）。

## 范围

### 做

| # | 交付 |
|---|------|
| 1 | 转写任务时间线：`preflight` → `upload` → `transcribe` → `save`（与 R3t-B 状态机一致） |
| 2 | 每阶段 `started_at` / `ended_at` / `error_code`（若有） |
| 3 | 段级进度（若分段）：`segment_index` / `segment_total` |
| 4 | 并入现有诊断包 JSON（字段名在编码时写入 contract test） |
| 5 | UI：转写失败或 warnings 时展示「阶段 + 建议」摘要（不必单独大面板 v1） |

### 不做

- 云端 queue / farm
- 协作审计日志（R8）

## 验收标准

- [ ] 故意在 **transcribe** 阶段失败（如断侧车）：UI 标明阶段为转写/侧车，非「未知错误」
- [ ] 导出诊断包含 `transcribe_timeline[]`（或等价字段）且与 UI 一致
- [ ] 与 R3e 失败分类文案不矛盾（同一 `error_code` 映射表）
- [ ] focused test：时间线序列化 + 至少 1 条失败映射
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 手测场景（2 组）

1. **侧车未就绪**：preflight 失败 → 建议「一键准备」或检查模型  
2. **长音频中途失败**：时间线显示最后成功阶段与段号 → 建议重试或换 Paraformer

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| Rust | `run_transcribe_cmd.rs`、`transcribe.rs` 事件 |
| TS | `asrTranscribeHints.ts` 或 `useTranscribeJobView` |
| 诊断 | 现有诊断导出 schema 扩展 |

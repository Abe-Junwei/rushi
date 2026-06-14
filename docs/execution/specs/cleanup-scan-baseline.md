# 代码库清理 — Phase 0 基线快照

> **扫描日期**：2026-06-14  
> **HEAD**：`87ee6b95f1bfcbf9297bf2555ffbd94f05ed9120`  
> **关联**：[codebase-cleanup-scan-plan-2026-06.md](./codebase-cleanup-scan-plan-2026-06.md) · [cleanup-candidate-register.md](./cleanup-candidate-register.md)

---

## L0 闸门

| 检查 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run test` | ✅ 277 files / **1372** tests |
| `check-architecture-guard.mjs` | ✅ **0 错误**，**42** 警告 |

## 工作区状态（扫描时）

未提交改动（与 ASR ffmpeg PATH 修复相关，**不计入清理删除**）：

- `apps/desktop/src-tauri/src/asr_sidecar/bundled/process.rs`
- `apps/desktop/src/services/asrTranscribeHints.ts`
- `apps/desktop/src/tauri/projectApi.ts`
- `services/asr/rushi_asr/{__main__,ffmpeg_audio,runtime_caps}.py`
- `services/asr/tests/{test_ffmpeg_audio,test_health}.py`

## 架构守卫 Top 热点（清理时勿叠加功能）

| 文件 | 指标 |
|------|------|
| `useTranscribeJobController.ts` | 412 行 · 14 hooks |
| `segmentListVirtualWindow.ts` | 438 行 |
| `pxPerSec.ts` | 404 行 |
| `postTranscribeStageB.ts` | 383 行 |
| `EditorSegmentList.tsx` | 381 行 |

## 自动扫描工具

| 工具 | 结果摘要 |
|------|----------|
| **knip** (`apps/desktop`) | 14 unused files · 310 unused exports · 2 unused devDeps |
| **rg `@deprecated`** | 50+ 标记（TS/TSX） |
| **Rust `allow(dead_code)`** | 12 处（多为测试辅助或待接线路径） |
| **scripts/*.sh** | 71 个；约 54 个未出现在 `package.json` scripts（多为手测/门禁，非垃圾） |

## 禁止自动删除（扫描已标 KEEP）

- `apps/desktop/src-tauri/spike/sherpa_*` — ADR-0006 Partial Go
- `services/asr/rushi_asr/model_catalog.py` SenseVoice 迁移 — 数据兼容
- `docs/execution/specs/archive/**` — 决策史；只整理索引
- `editorFooterShortcutHints.legacy.ts` — 文案双真源（copy-code-drift ⚪）

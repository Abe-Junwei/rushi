# 全量代码审查修复进度跟踪（2026-06-16）

> **基准报告**：[`full-code-review-architecture-comparison-report.md`](./full-code-review-architecture-comparison-report.md)
> **范围**：对照基准报告 §7.1.3-§7.5.3、§9、§10 列出的问题/建议，复核当前修复进度与剩余项是否真实存在。
> **检查时间**：2026-06-16
> **复查时间**：2026-06-16（当前代码已更新）

---

## 总体进度

| 状态 | 数量 | 说明 |
|------|------|------|
| 已修复 / 已落地门禁 | 25 | P0/P1 代码修复、coverage/Codecov、E2E 深度、Dependabot、性能门禁均已落地 |
| 部分修复 / 后续评估 | 6 | State/Ref 真源、结构化错误全仓迁移、ASR 多 worker、`ready_for_transcribe` 兼容字段、参数 strip、波形监听优化 |
| 未修复 | 1 | #3 mega-file / hook 阈值拆分（本轮明确排除） |

> 注：基准报告 §7 与 §10.6 中 `#9`/`#30`（Rust 错误处理结构化）和 `#10`/`#31`（Windows 8741 清理）为同一问题重复出现，已合并去重。

---

## 复查结论

| 项 | 当前真实状态 | 证据 / 说明 |
|----|--------------|-------------|
| #2 State/Ref 双轨制 | **部分修复，真实存在** | `segments` state 与 `segmentsRef` 仍并存；结构/正文批量变更已大量改走 `publishSegmentStructureMutation` / `publishSegmentTextBulkMutation`，但尚未单一真源化。 |
| #3 mega-file / hook 阈值 | **未修复，真实存在** | `node scripts/check-architecture-guard.mjs` 当前 0 errors / 31 warnings；全部为生产文件行数或 hook 数 warning，测试文件已豁免。 |
| #5 无 React Context | **真实存在，但非当前 blocker** | 全仓 `createContext` / `useContext` 为 0；`useProjectController` 已拆薄，继续保持 controller facade 是当前架构选择。 |
| #7 非池化 SQLite | **已修复** | pool + WAL 已落地；`diagnostic_db_sanitize.rs`、`diagnostic.rs`、`export_docx.rs` 的独立 `Connection::open` 均已显式调用 `configure_sqlite_connection(_readonly)`。 |
| #8 删除项目反向孤儿 | **已修复** | `project_delete_cmd.rs` 当前 `tx.commit()` 在 `cleanup_deleted_project_storage` 之前；最坏只留可清扫孤儿文件，不会出现 DB 记录指向已删媒体。 |
| #9/#30 结构化错误 | **部分修复，真实存在** | `CommandErrorDto` 与 TS parser 已有，delete/rename/export/metadata 等路径已迁移；全仓仍有大量 `Result<..., String>`，后续需按模块迁移。 |
| #12 ASR 多 worker | **部分修复 / 有意不启用真实多 worker** | `inference_queue.py` 保持 `inference_max_workers=1`，新增 `inference_requested_workers` 仅作诊断；真实多 worker 需独立 spike 验证 FunASR 线程安全与内存峰值。 |
| #15 readiness | **部分修复，仍保留兼容字段风险** | `/health` 已新增 `model_loaded_in_memory` / `model_memory_matches_config` / `selected_model_ready` 且修复运行时回归；`ready_for_transcribe` 仍作为兼容字段保留，部分准备流程仍会读取它。 |
| #17 参数 strip | **部分修复，真实存在** | 已通过 warnings/hints 暴露 strip 降级；`funasr_engine.py` 仍按 `strip_order` 对 `TypeError` 逐项剔除参数，尚无 per-SKU 明确参数矩阵。 |
| #21 波形监听重建 | **真实存在** | `WaveformSegmentBandCanvas.tsx` 的监听 effect 依赖仍包含 `segments`、`durationSec` 等；虽已用 `inputRef` 降低部分闭包问题，但监听拆装风险未完全消除。 |
| #24 脏检查 O(n) | **部分修复，不应列为未修复** | `useSegmentDirtyState` 已先比 `segmentsPersistSignature`，相同则 fast path 返回；签名生成本身仍 O(n)，但已新增 `corePerformance.perf.ts` 门禁覆盖大项目热路径。 |
| #25 coverage / PR diff | **已修复** | Vitest thresholds 为 48/38/38/48；`codecov.yml` patch target 80%；CI 上传 coverage。 |
| #27 E2E 深度 | **已补强** | `desktop-core-journey.spec.ts` 覆盖创建项目、打开 Editor、编辑语段、保存、导出 TXT 的 mocked Tauri journey。 |
| #28 测试 guard 噪音 | **已修复** | `check-architecture-guard.mjs` 对 `.test.ts(x)` 行数/hook 阈值豁免；当前 31 warnings 不含测试文件。 |
| #29 Vitest 配置 | **部分修复 / 低优先级** | coverage reporter/include/exclude/thresholds 已配置；shard/retry 仍未加，等 CI 时间恶化再处理。 |

---

## 仍需跟踪

1. **唯一明确未修复项**：#3 mega-file / hook 阈值拆分（当前 31 warnings，本轮排除）。
2. **部分修复项**：#2 State/Ref 真源、#9/#30 结构化错误全仓迁移、#12 ASR 多 worker spike、#15 readiness 兼容字段收敛、#17 参数 strip per-SKU 矩阵、#21 波形监听 effect 优化、#29 Vitest shard/retry。
3. **已从未修复列表移除**：#24 脏检查 O(n) 已有 fast path + perf gate；#28 测试 guard 噪音已豁免；#7/#8/#25/#27 已修复。

---

## 第七轮质量门禁补强

| 项 | 本轮改动 | 验证 |
|----|----------|------|
| ASR worker 策略 | `inference_queue.py` 暴露 `inference_requested_workers` 诊断字段，但 `inference_max_workers` 仍固定为 1；即使设置 `RUSHI_FUNASR_INFERENCE_WORKERS>1` 也不会绕过 FunASR 单 worker 队列。真实多 worker 仍需独立 spike。 | `python -m pytest services/asr/tests/test_inference_queue.py services/asr/tests/test_health.py -q` ✅ |
| E2E 深度 | `desktop-core-journey.spec.ts` 从「创建项目 -> 打开 Editor」扩展到「编辑语段 -> 保存 -> 导出 TXT」，并在 Tauri mock 中记录 invoke 调用验证保存/导出内容。 | `npm run test:e2e:desktop -w @rushi/desktop` ✅ |
| Dependabot | 新增 `.github/dependabot.yml`，覆盖 GitHub Actions、npm workspace、Cargo、ASR pip，并按 weekly + minor/patch grouping 限制 PR 噪音。 | 配置审查 ✅ |
| 性能门禁 | 新增 `src/perf/corePerformance.perf.ts` 与 `test:perf`，覆盖虚拟列表窗口计算与 dirty-state signature 大项目热路径；CI desktop job 新增 Core performance gates 步骤。 | `npm run test:perf -w @rushi/desktop` ✅ |

**边界说明**：本轮没有启用真实 FunASR 多线程/多进程推理。依据 [`asr-runtime-readiness-and-concurrency-research.md`](./asr-runtime-readiness-and-concurrency-research.md)，v1.1 仍采用单 worker + 队列 UX；多 worker 需后续以独立 spike 验证线程安全、内存峰值与取消/超时语义。

---

## 验证记录

```bash
npm run typecheck
npm run test -w @rushi/desktop
npm run test:perf -w @rushi/desktop
npm run test:e2e:desktop -w @rushi/desktop
python -m pytest services/asr/tests -q
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings
node scripts/check-architecture-guard.mjs
```

最近执行结果：typecheck ✅ / desktop tests **279 files, 1390 tests** ✅ / perf **1 file, 2 tests** ✅ / desktop E2E **2 passed** ✅ / ASR pytest **127 passed, 2 skipped** ✅ / clippy ✅ / architecture guard **0 errors, 31 warnings** ⚠️。

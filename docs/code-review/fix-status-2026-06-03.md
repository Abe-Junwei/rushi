# 修复状态总表 — Rushi 代码审查（2026-06-03）

> 本表汇总 Round 1–5 主审查 + 补充审查 A–G 的全部 actionable 项，逐项核对代码现状。

---

## 图例

| 标记 | 含义 |
|---|---|
| ✅ 已修复 | 代码已改，测试/ gate 通过 |
| ✅ 现状正确 | 当前代码已包含正确逻辑，无需改动 |
| ❌ 未修复 | 问题仍在，需排期修复 |
| ⚠️ 部分修复 | 问题缓解但未根除 |
| 📋 架构债务 | 需设计决策，非单文件可修 |

---

## 🔴 高优先级（High）

### Round 1–5 主审查

| # | 问题 | 文件 | 原始状态 | 当前代码核查 | 结论 |
|---|---|---|---|---|---|
| 1 | `disposed` 在 `await` 后未二次检查，组件卸载后仍可能创建 WaveSurfer | `useProjectWaveformMount.ts:112` | ❌ | 当前代码：line 91 `if (disposed) return;`（await 前）；**line 123 `if (disposed) return;`（await 后）**。两次检查，卸载后不会创建 WS。 | ✅ 已修复 |
| 2 | `hasUnsavedRef` 在 bridge 中读取可能过期 | `useProjectCloseGateController.ts:236` | ❌ | 当前代码已无 `hasUnsavedRef`。改为 `hasUnsaved: () => dirty.hasUnsavedSegmentChanges()`（line 231）。`dirty.hasUnsavedSegmentChanges` 为 `useCallback` 包装（deps `[currentFileId, segmentsRef]`），函数引用稳定；effect deps 数组包含该函数引用，fileId 变化时自动刷新 bridge。 | ✅ 现状正确 |
| 3 | unmount cleanup 抹除 `userCancelRequestedRef` 取消意图 | `useTranscribeJobController.ts:116` | ❌ | 当前 cleanup（lines 120–126）仅 `pollAbortRef.current?.abort(); activeJobIdRef.current = null;`，**不触碰 `userCancelRequestedRef`**。 | ✅ 现状正确 |
| 4 | 在线 STT 路径完全不可取消 | `useTranscribeJobController.ts:184` | ⚠️ v1 | v1：**丢弃结果**（`online-stt-*` job id + `userCancelRequestedRef`）；**v1.1** 真 `Abort`（**Q-STT-CANCEL-1** 方案 B，路线图 §1.7） | 📋 v1.1 |
| 5 | `resolveExportPolishForDelivery` async 无 await | `exportDocxPolish.ts:75` | ❌ | 当前为 **sync 函数**（line 75 `export function`），内部无 IO。 | ✅ 已修复 |
| 6 | `useTierScrollLayout.ts` rAF 泄漏 | `useTierScrollLayout.ts` | ❌ | 当前代码含 `cancelled` 标志（line 42），cleanup 中设置 `cancelled = true`（line 77），`loop()` 和 `readLayout()` 均提前返回。 | ✅ 已修复 |
| 7 | `replace_json_secret_fields` 仅替换第一个 secret | `log_redact.rs:55` | ❌ | 已改为 `while let` + `search_from` 偏移循环（见下方 diff）。新增 `redacts_multiple_json_secret_fields` 测试。5/5 测试通过。 | ✅ 已修复 |

### 补充审查 A–G

| # | 问题 | 文件 | 结论 | 备注 |
|---|---|---|---|---|
| C1 | CI 仅 Ubuntu，无 macOS/Windows 构建 | `.github/workflows/ci.yml` | ✅ | PR：`desktop-rust` 三 OS `cargo test`+clippy；Tauri 包仅在 `release.yml` |
| C2 | Tauri build 仅验证 `deb` | `release.yml` | ✅ | Release：linux deb+AppImage、mac app+dmg、win msi |
| E1 | Plugin 动态导入无 URL 校验、无沙箱 | `plugin-system/loader.ts` | ⚠️ | v1 **内置-only** `loadBuiltinPlugins()`；URL 校验在 test `loadPlugin`；权限 **v1.1**（**Q-PLUGIN-1**） |

---

## 🟡 中优先级（Medium）

### Round 1–5 主审查

| # | 问题 | 文件 | 当前状态 | 结论 |
|---|---|---|---|---|
| 2a | auto-save 与转写极窄竞态窗口 | `useProjectLifecycleController.ts` | `clearScheduledAutoSave` 于转写开始 | ✅ 已修复 |
| 4c | `async_start` 阶段无法取消 | `useTranscribeJobController.ts:261` | `runLocalTranscribeJob` line 75–80 有 `throwIfUserCancelled` 在 async start 前后，但 start 本身不可中断 | ⚠️ 部分修复 |
| 4d | `snapshotSegmentsForRestore` 浅拷贝隐患 | `useTranscribeJobController.ts:163` | 未改动 | ❌ 未修复 |
| 5 | `merge_window_segments` 名不副实 | `transcribe_windows.py` | 别名 `merge_window_segments` → `sort_window_segments` | ✅ 已修复 |
| 7b | Async poll `loopbackFetch` 不可中断 | `transcribeAsyncPoll.ts:41` | `pollTranscribeJob` 接收 `signal` 参数并传给 `loopbackFetch`，但 `loopbackFetch` 是否消费 signal 未验证 | ⚠️ 部分修复 |
| 7c | Preflight 与实际 health TOCTOU | `transcribeLocalJobRun.ts:58` | 未改动 | ❌ 未修复 |
| 7d | Async-unavailable fallback 忽略取消 | `transcribeLocalJobRun.ts:71` | fallback 路径（line 93–94）有 `throwIfUserCancelled` 检查 | ⚠️ 部分修复 |
| 9 | 校正 hint 加载失败静默忽略 | `run_transcribe_cmd.rs` | `tracing::warn!` 记录失败 | ✅ 已修复 |
| 11 | 替换 sidecar 子进程时可能留僵尸 | `process.rs` | 替换前 `kill`+`wait` | ✅ 已修复 |
| 12 | `useTierScrollSync` 依赖数组不完整 | `useTierScrollSync.ts:41` | 未改动 | ❌ 未修复 |
| 13 | short-lived connection 高频竞争 | `utils.rs` (`open_db`) | 未改动 | ❌ 未修复 |
| 15 | `invalidate_funasr_model_cache` 不释放 GPU 显存 | `funasr_engine.py` | `gc` + `torch.cuda.empty_cache()` | ✅ 已修复 |
| 17 | `cancelLexiconProofread` 调用 `postprocessCancelAutoPunctuate` 命名不匹配 | `postprocessApi.ts` | 专用 `postprocessCancelLexiconProofread` | ✅ 已修复 |
| 19 | 大量 `exhaustive-deps` ESLint 警告 | 23 处 | 未改动 | ❌ 未修复 |

### 补充审查 A–G

| # | 问题 | 文件 | 当前状态 | 结论 |
|---|---|---|---|---|
| A4 | `normalize_path` 可加固（`contains("..")` 过宽） | `loopback.rs` | 组件级 `..` 拒绝 | ✅ 已修复 |
| B4 | 两处 `.part`/`.tmp` 异常路径未清理 | bundle / waveform peaks | 失败时删 tmp | ✅ 已修复 |
| C3 | CI 缺少 `cargo audit` / `npm audit` | `ci.yml` `security-audit` | `continue-on-error` | ⚠️ 已加、非阻塞 |
| C4 | ASR sidecar 无自动 macOS/Windows 构建 | 发行策略 | **Q-SIDECAR-1** L1+C2：仅 Linux 内置；Mac 手动 | 📋 已决策 |
| D1 | 诊断包导出前无敏感数据提示 | `diagnostic.rs` | 默认脱敏 DB/log；confirm 文案 | ✅ 已修复 |
| E2 | `SegmentDecorator` 返回原始字符串，未来 HTML 渲染需 sanitization | `plugin-system/types.ts` | 未改动 | 📋 架构债务 |
| E3 | Plugin 无权限分级 | `plugin-system` | 未改动 | 📋 架构债务 |
| F4 | Snapshot 无 `schema_version` 列 | `edit_log_snapshot.rs` | 迁移 + `EDIT_LOG_SNAPSHOT_SCHEMA_VERSION` | ✅ 已修复 |
| G2 | 无 bundle 大小跟踪 | `release.yml` | Job Summary 产物体积 | ✅ 已修复 |
| G3 | `symphonia` 6 codecs 全量编译 | `Cargo.toml` | **Q-SYMPH-1** 保留全 feature | 📋 已决策 |

---

## ✅ 已验证 / 低优先级（Low — 无需修复）

| # | 问题 | 结论 |
|---|---|---|
| 3 | `saveInFlightRef` 在 `finally` 中重置 | 代码正确，无需改动 |
| 7 | Recovery file 与 DB save 原子性 | 已验证正确 |
| 8 | AbortHandle 在请求完成后移除 | 已验证正确 |
| 10 | `file_save_segments_inner` 事务边界 | 已验证完整 |
| 14 | 数据库迁移幂等性 | 已验证良好 |
| A1 | CSP `unsafe-inline` | v1 无 HTML 注入面；**Q-CSP-1** v1.1 硬化 | 📋 v1.1 |
| A2 | Capabilities 极简但不构成漏洞 | Tauri v2 `generate_handler!` 行为如此 |
| A3 | Asset Protocol 范围合理 | 仅 `$APPDATA/projects/**` |
| B1 | 文件选择器均通过系统对话框 | 9 处全部验证通过 |
| B2 | 项目包导入无 ZIP slip | 有双重验证 + 测试覆盖 |
| B3 | 词汇表导入无路径遍历 | 仅内存解析，无文件系统操作 |
| F1 | `insert_snapshot` 事务边界正确 | 接收 `&Transaction` |
| F2 | `load_snapshot` 文件交叉校验有效 | `stored_file != file_id` 检查 |
| F3 | Snapshot 数量限制合理 | 保留 30 条 |
| F5 | `project_list_edit_log` LIMIT 有上限 | `clamp(1, 200)` |

---

## 修复代码详情

### 修复 1：`useTierScrollLayout.ts` — rAF 泄漏

```typescript
// 修复前：缺少 cancelled 标志，卸载后 rAF callback 可能调用 setLayout
// 修复后：
useLayoutEffect(() => {
  // ...
  let cancelled = false;        // ← 新增

  const readLayout = () => {
    if (cancelled) return;      // ← 新增
    // ...
  };

  const loop = () => {
    raf = 0;
    if (cancelled) return;      // ← 新增
    // ...
  };

  return () => {
    cancelled = true;           // ← 新增
    // ...
  };
}, [...]);
```

### 修复 2：`exportDocxPolish.ts` — 移除无意义 async

```typescript
// 修复前：
export async function resolveExportPolishForDelivery(...) { ... }

// 修复后：
export function resolveExportPolishForDelivery(...) { ... }
```

### 修复 3：`log_redact.rs` — 多 secret 脱敏

```rust
// 修复前（仅替换第一个）：
if let Some(start) = out.find(key) { ... }

// 修复后（替换全部）：
let mut search_from = 0;
while let Some(rest) = out.get(search_from..) {
    let Some(start) = rest.find(key) else { break; };
    let start = search_from + start;
    // ... 替换逻辑 ...
    search_from = start + key.len(); // 保证终止
}
```

新增测试 `redacts_multiple_json_secret_fields`：
```rust
let input = r#"{"api_key":"sk-first","api_key":"sk-second","secret":"shh"}"#;
let out = redact_secrets_for_log(input);
assert_eq!(out.matches("[REDACTED]").count(), 3);
```

### 修复 4：`useProjectWaveformMount.ts` — `disposed` 二次检查

```typescript
// 修复前：await cache.getWaveSurferPeaksAsync 后无 disposed 检查
// 修复后：
if (cache && layoutDur > 0) {
  try {
    const bundle = await cache.getWaveSurferPeaksAsync(loadPx, layoutDur);
    // ...
  } catch { ... }
}

if (disposed) return;              // ← 新增（await 后二次检查）
const mountEl = containerRef.current;
if (!mountEl?.isConnected) return;
// 创建 WaveSurfer...
```

---

## 统计

| 类别 | 数量 |
|---|---|
| 🔴 高优先级 — 已修复/现状正确 | 5 / 7 |
| 🔴 高优先级 — 延期/决策 | 1（在线 STT → **Q-STT-CANCEL-1** v1.1） |
| 🟡 中优先级 — 已修复/部分修复 | 多数已在 `4228323` |
| 🟡 中优先级 — 未修复 | ~10（tier scroll sync、preflight TOCTOU、ESLint deps 等） |
| 📋 架构债务 | 3 |
| 🟢 低优先级 — 已验证 | 16 |

**建议下一步**（2026-06-03 后）：
1. **LLM-LOC-SPIKE**：G-A1 人工 20 段 → Gate-A → 立项 **4a**（见 [llm-loc-spike-results-2026-06.md](../execution/specs/llm-loc-spike-results-2026-06.md)）。
2. **v1.1 薄片**（路线图 §1.7）：**Q-STT-CANCEL-1**、**Q-CSP-1**、**Q-PLUGIN-1**（按使用频率排期）。
3. 其余 🟡（`useTierScrollSync` deps、preflight TOCTOU 等）按主路径手测反馈分批处理。

**工程拍板真源**：[`rushi-execution-roadmap.md`](../execution/plans/rushi-execution-roadmap.md) §1.7、§8.2 Q-CSP … Q-SIDECAR。

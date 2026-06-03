# 全方位代码审查报告 — Rushi（2026-06-03）

> 审查范围：Rust Tauri 后端 + TypeScript React 前端 + Python FunASR sidecar
> 审查策略：Round 1 自动化基线 → Round 2-5 风险优先深度模拟

---

## 汇总与分级

### 🔴 必须修（High — 7 项）

| # | 发现 | 文件 | 修复工作量 |
|---|---|---|---|
| 1 | WaveSurfer 实例在组件卸载后仍可能被创建 | `useProjectWaveformMount.ts:112` | ~2 行 |
| 2 | 应用窗口关闭守卫读取过期 `hasUnsavedRef` | `useProjectCloseGateController.ts:236` | ~1 行 |
| 4 | 卸载 cleanup 抹除取消意图 | `useTranscribeJobController.ts:116` | ~1 行 |
| 4b | 在线 STT 完全不可取消 | `useTranscribeJobController.ts:184` | ~5 行 |
| 6 | `resolveExportPolishForDelivery` async 无 await | `exportDocxPolish.ts:75` | ~1 行 |
| 18 | `replace_json_secret_fields` 仅替换第一个 secret | `log_redact.rs:55` | ~5 行 |
| 20 | `disposed` 在 `await` 后未二次检查 | `useProjectWaveformMount.ts:112` | 同 #1 |

### 🟡 建议修（Medium — 15 项）

| # | 发现 | 文件 | 修复工作量 |
|---|---|---|---|
| 2 | auto-save 与转写存在极窄竞态窗口 | `useAutoSaveSegments.ts` + `useTranscribeJobController.ts` | ~3 行 |
| 4c | `async_start` 阶段无法取消 | `useTranscribeJobController.ts:261` | ~3 行 |
| 4d | `snapshotSegmentsForRestore` 浅拷贝隐患 | `useTranscribeJobController.ts:163` | 需验证实现 |
| 5 | `merge_window_segments` 名不副实 | `transcribe_windows.py:101` | 重命名 + 注释 |
| 7b | Async poll `loopbackFetch` 不可中断 | `transcribeAsyncPoll.ts:41` | ~3 行 |
| 7c | Preflight 与实际 health TOCTOU | `transcribeLocalJobRun.ts:58` | 文档化 |
| 7d | Async-unavailable fallback 忽略取消 | `transcribeLocalJobRun.ts:71` | ~2 行 |
| 9 | 校正 hint 加载失败被静默忽略 | `run_transcribe_cmd.rs:401` | ~3 行（加日志） |
| 11 | 替换 sidecar 子进程时可能留僵尸 | `process.rs:42` | ~5 行 |
| 12 | `useTierScrollSync` 依赖数组不完整 | `useTierScrollSync.ts:41` | ~1 行 |
| 13 | short-lived connection 高频竞争 | `utils.rs` (`open_db`) | 观察 + 文档 |
| 15 | `invalidate_funasr_model_cache` 不释放 GPU 显存 | `funasr_engine.py:54` | ~2 行 |
| 16 | `useEffect` 卸载后 rAF 可能触发 setLayout | `useTierScrollLayout.ts` | 已修复（见上下文） |
| 17 | `cancelLexiconProofread` 调用 `postprocessCancelAutoPunctuate` 命名不匹配 | 前端 API 层 | ~1 行（重命名） |
| 19 | 大量 `exhaustive-deps` ESLint 警告 | 23 处 | `npm run lint --fix` 无法自动修复，需人工审查 |

### 🟢 观察 / 已验证（Low — 10 项）

| # | 发现 | 结论 |
|---|---|---|
| 3 | `saveInFlightRef` 在 `finally` 中重置 | ✅ 符合预期 |
| 7 | Recovery file 与 DB save 原子性 | ✅ 正确 |
| 8 | AbortHandle 在请求完成后移除 | ✅ 正确 |
| 10 | `file_save_segments_inner` 事务边界 | ✅ 完整 |
| 14 | 数据库迁移幂等性 | ✅ 良好 |
| 21 | API Key 存储策略 | ✅ 合理 |
| 22 | FastAPI schema 与 Rust multipart 对齐 | ✅ 一致 |
| 23 | 错误消息前后端一致性 | ✅ 无冲突 |
| 24 | FastAPI 端点参数校验 | ✅ 全面 |
| 28 | FFmpeg 子进程超时与异常处理 | ✅ 完整 |

### 未完成的扫描

- **npm audit**：因网络不可用未能执行。建议在可连接 npm registry 的环境下补跑。
- **cargo audit**：`cargo-audit` 未安装，建议安装后执行 `cargo audit`。
- **Python `pip-audit`**：未安装，建议对 `services/asr` 执行依赖漏洞扫描。

### 验证证据

```bash
# Round 1 基线（执行时间 2026-06-03 21:40–21:46）
npm run typecheck        # ✅ 0 errors
cd apps/desktop && npm run test   # ✅ 749 passed / 169 files
cd src-tauri && cargo test        # ✅ 244 passed
node scripts/check-architecture-guard.mjs  # ✅ 0 errors, 36 warnings
cd services/asr && pytest -q      # ✅ 96 passed
```

---

*报告生成时间：2026-06-03*  
*审查人：Kimi Code CLI*  
*覆盖范围：前端 53K LOC + 后端 24.6K LOC + Python 1.5K LOC*

## Round 1：自动化基线与静态扫描

### 1.1 Hard Gate 状态

| 检查项 | 结果 | 详情 |
|---|---|---|
| TypeScript `tsc --noEmit` | 通过 | 0 errors |
| Vitest 前端测试 | 通过 | 749 tests / 169 files, 0 failed |
| Rust `cargo test` | 通过 | 244 tests, 0 failed |
| Architecture Guard | 通过 | 0 errors, 36 warnings（全部为先前已知） |
| Python `pytest` | 通过 | 96 tests, 0 failed |

**结论**：所有自动化测试门全部通过，基线健康。

### 1.2 Lint 与代码风格

#### TypeScript / ESLint

```
75 problems (48 errors, 27 warnings)
47 errors potentially fixable with --fix
```

**Errors（48）**：
- 47x `@typescript-eslint/no-unnecessary-type-assertion` — 集中在少量文件，全部可 `--fix` 自动修复。
- 1x `@typescript-eslint/require-await` — `src/services/exportDocxPolish.ts:75`，函数 `resolveExportPolishForDelivery` 标记为 `async` 但内部无 `await`。

**Warnings（27）**：
- 23x `react-hooks/exhaustive-deps` — `useEffect`/`useMemo`/`useCallback` 依赖数组不完整或含不必要依赖。波形、自动保存、校正记忆等路径均有涉及。
- 4x 其他 — `no-console`（1）、unnecessary dependency on `llmRuntimeEpoch`（3）

**风险评级**：中 — 大量 `exhaustive-deps` 警告表明存在 stale closure 风险。

#### Rust / Clippy

共 13 warnings：

| 文件 | 问题 | 风险 |
|---|---|---|
| `export_docx_polish_track.rs:9` | unused import `POLISH_TRACK_AUTHOR` | 低 |
| `postprocess_cmd.rs:15` | unused imports `PostprocessExportPolishRequest`, `PostprocessExportPolishResponse` | 低 |
| `export_docx_polish_track_write.rs:311` | unused import `diff_pieces_for_export_track` | 低 |
| `postprocess_export_polish.rs:49` | function `paragraphs_from_break_after` never used | 中 — 死代码 |
| `postprocess_export_polish.rs:179` | `mut rows` does not need to be mutable | 低 |
| `export_docx.rs:251` | `build_docx_bytes` has 9 arguments (>7) | 低 |
| `export_docx.rs:345` | `export_docx` has 10 arguments (>7) | 低 |
| `export_docx.rs:385` | redundant redefinition `let default_filename = default_filename` | 低 |
| `export_docx_polish_track_diff.rs` | manual char comparison can be written more succinctly | 低 |
| `export_docx_polish_track_write.rs` | `if` statement can be collapsed | 低 |
| `postprocess_export_polish.rs` | `if` has identical blocks | 中 — 可能是逻辑 bug 或复制粘贴残留 |

#### Python

- SyntaxWarning：`tests/test_health.py` 中多处 `invalid escape sequence '\['`。应使用原始字符串 `r"..."`。
- `DeprecationWarning`：FunASR 内部使用已废弃的 `distutils`（第三方依赖问题，非本仓代码）。

### 1.3 死代码扫描

#### Rust

| 位置 | 说明 |
|---|---|
| `postprocess_export_polish.rs:49` | `paragraphs_from_break_after` 从未被调用 |
| `local_runtime/manifest/parse.rs:18` | `#[allow(dead_code)]` 压制 |
| `local_runtime/integrity/marker.rs:81` | `#[allow(dead_code)]` 压制 |
| `postprocess_secret_store.rs:169` | `#[allow(dead_code)]` 压制 |
| `project/types.rs:119` | `#[allow(dead_code)]` 压制 |
| `project/transcribe_job.rs:78` | `#[allow(dead_code)]` 压制 |
| `project/edit_log_detail.rs:218` | `#[allow(dead_code)]` — 注释说明用于单元测试 |
| `project/correction.rs:78` | `#[allow(dead_code)]` 压制 |
| `postprocess_export_polish.rs:6` | `#[allow(dead_code)]` 压制 |

#### TypeScript

未运行 `ts-prune`（未安装），但通过 ESLint unused 变量检查和架构守卫未报告新的死代码导出。

### 1.4 依赖安全审计

- `npm audit`：网络不可用（TLS 连接失败，国内 mirror 也不支持 audit 接口）。
- `cargo audit`：未安装 `cargo-audit`。
- Python `pip-audit` / `safety`：未安装。

**结论**：依赖漏洞扫描未能完成，建议在可连接 npm registry 的环境下补跑。

---

## Round 2：前端功能链路模拟

### 2.1 波形 + 播放 + 滚动

#### 发现 1 — 🔴 高：WaveSurfer 实例在组件卸载后仍可能被创建（内存泄漏）

**位置**：`apps/desktop/src/hooks/useProjectWaveformMount.ts:86-148`

**问题**：
```typescript
useEffect(() => {
  let disposed = false;
  const run = async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (disposed) return;              // ← 检查点 1
    // ...
    if (cache && layoutDur > 0) {
      try {
        const bundle = await cache.getWaveSurferPeaksAsync(loadPx, layoutDur);
        // ← ❌ 缺少检查点 2：如果此时组件已卸载，disposed === true，但代码继续执行
      } catch { /* ... */ }
    }
    const ws = WaveSurfer.create({ /* ... */ });  // ← 创建新实例
    wsRef.current = ws;                           // ← 覆盖已清理的 ref
    wsUnsubsRef.current.push(...bindProjectWaveformWaveSurferEvents({ /* ... */ }));
  };
  void run();
  return () => { disposed = true; destroyWave(); };
}, [/* ... */]);
```

`disposed` 在 `await cache.getWaveSurferPeaksAsync()` 之后不再检查。如果用户快速切换项目/文件，cleanup 函数执行后 `disposed = true`，但异步 peak 加载完成后仍会创建 WaveSurfer 实例、设置 ref、注册事件监听器。该实例永远不会被销毁，导致内存泄漏和潜在的过时回调触发。

**修复**：在 `await cache.getWaveSurferPeaksAsync()` 之后和创建 WaveSurfer 之前各加一次 `if (disposed) return;`。

---

### 2.2 语段编辑 + Undo/Redo + AutoSave

#### 发现 2 — 🟡 中：Auto-save 依赖 `busy` 状态，存在极窄竞态窗口

**位置**：`apps/desktop/src/pages/useAutoSaveSegments.ts:77`, `useProjectLifecycleController.ts:124`

**问题**：`scheduleAutoSave` 在 `setTimeout` 回调中检查 `busyRef.current`。`executeTranscribe` 在 `beginBusy("transcribe")` 之前调用 `segmentsRef.current = []`（`useTranscribeJobController.ts:164`）。由于 React 状态更新是批处理的，理论上存在极窄窗口：`busy` 状态尚未更新，但 segments 已被清空，此时 auto-save 的延时回调触发，会保存空 segments。

**评估**：实际触发概率极低（需要 1500ms debounce 刚好在 `executeTranscribe` 开始后到期），但逻辑上存在缺口。

**修复**：在 `executeTranscribe` 开始时显式调用 `clearAutoSaveRef.current()`（或等价的取消自动保存），而非仅依赖 `busy` 状态。

#### 发现 3 — 🟢 低：`saveInFlightRef` 重置在 `finally` 中，符合预期

**位置**：`apps/desktop/src/pages/useProjectLifecycleController.ts:171`

验证：`saveInFlightRef.current = false` 确实位于 `finally` 块中，不会因异常而永久锁定。✅

---

### 2.3 转写任务

#### 发现 4 — 🔴 高：组件卸载 cleanup 错误地重置 `userCancelRequestedRef`，导致取消意图被抹除

**位置**：`apps/desktop/src/pages/useTranscribeJobController.ts:113-118`

**问题**：
```typescript
useEffect(() => {
  return () => {
    activeJobIdRef.current = null;
    userCancelRequestedRef.current = false;  // ← ❌ 错误
  };
}, []);
```

如果用户点击取消后组件立即卸载（例如快速切换项目），cleanup 函数会将 `userCancelRequestedRef.current = false`，导致正在进行的取消信号被静默撤销。后续 poll 循环或 fallback 逻辑会认为用户并未请求取消，继续执行转写。

**修复**：移除 `userCancelRequestedRef.current = false` 的 cleanup，或在 cleanup 中区分"正常卸载"与"取消后卸载"。

---

#### 发现 4b — 🔴 高：在线 STT 桥接路径完全不可取消

**位置**：`apps/desktop/src/pages/useTranscribeJobController.ts:184`

**问题**：当使用在线 STT（OpenAI、AssemblyAI 等）时，`projectRunTranscribe` 直接调用 Rust Tauri command，该 command 是一个不可中断的 `async fn`。`userCancelRequestedRef` 和 `activeJobIdRef` 均不作用于在线 STT 路径。用户点击取消后，在线请求仍在后台继续，结果回来后可能覆盖当前编辑器内容。

**修复**：在线 STT 路径需要设置一个 sentinel `jobId`（如 `"online-stt-{timestamp}"`），使取消机制可以识别并丢弃后续到达的结果。

---

#### 发现 4c — 🟡 中：`async_start` 阶段无法取消（jobId 尚未生成）

**位置**：`apps/desktop/src/pages/useTranscribeJobController.ts:261-271`

**问题**：`cancelTranscribe` 检查 `activeJobIdRef.current`：
```typescript
const jobId = activeJobIdRef.current;
if (!jobId || transcribeCancelling) return;
```

如果用户在 `async_start` 请求尚未返回 `jobId` 的窗口内点击取消，`jobId` 为 null，取消操作被静默忽略。用户界面显示"取消中"但实际没有任何请求被发送。

**修复**：在 `async_start` 请求发出后立即设置一个临时 `activeJobIdRef.current = "pending"`，使取消逻辑可以进入。

---

#### 发现 4d — 🟡 中：`snapshotSegmentsForRestore` 浅拷贝，可能导致恢复时草稿泄漏

**位置**：`apps/desktop/src/pages/useTranscribeJobController.ts:163`

**问题**：
```typescript
const restoreSnapshot = snapshotSegmentsForRestore(segmentsRef.current);
segmentsRef.current = [];
```

如果 `snapshotSegmentsForRestore` 返回的是浅拷贝（`[...segments]` 而非深克隆），转写失败后恢复时，`segmentsRef.current = restoreSnapshot` 会恢复引用。如果在此期间 `segmentDraftStore` 中仍有草稿，这些草稿可能错误地关联到恢复的 segments。

**评估**：需验证 `snapshotSegmentsForRestore` 的实现是否深拷贝 segment 对象。

---

#### 发现 4e — 🟡 中：已完成 job 在取消竞态下可能被丢弃不处理

**位置**：`apps/desktop/src/pages/transcribeLocalJobRun.ts:66-69`

**问题**：async poll 循环在每次迭代开始时检查取消状态：
```typescript
if (refs.userCancelRequested.current) {
  throw new TranscribeUserCancelledError();
}
```

如果 sidecar 刚好在用户点击取消的前一毫秒完成了 job，poll 循环拿到 `done` 状态，但下一次迭代开始时用户已点击取消，代码抛出取消异常而不是返回已完成的转写结果。已完成的工作被丢弃，用户需重新转写。

**修复**：在检查取消之前，先确认当前状态是否已经是 `done`。如果是，应返回结果而不是抛出取消。

---

### 2.4 导出（三种形态 + 润色修订轨）

#### 发现 5 — 🟡 中：`resolveExportPolishForDelivery` 标记为 `async` 但无 `await`

**位置**：`apps/desktop/src/services/exportDocxPolish.ts:75-95`

**问题**：函数体内全是同步操作（指纹计算、条件判断、抛出 Error）。`async` 关键字不必要，且 ESLint 已报错 (`@typescript-eslint/require-await`)。虽然功能正确，但会误导调用者以为存在异步 I/O。

**修复**：移除 `async` 关键字。

---

### 2.5 关闭门卫 + 脏数据拦截

#### 发现 6 — 🔴 高：应用窗口关闭守卫可能读取过期的 `hasUnsavedRef`

**位置**：`apps/desktop/src/pages/useProjectCloseGateController.ts:78-80, 233-244`

**问题**：
```typescript
useEffect(() => {
  hasUnsavedRef.current = dirty.hasUnsavedSegmentChanges;
}, [dirty.hasUnsavedSegmentChanges]);

// 窗口关闭守卫
setAppWindowCloseGuardBridge({
  hasUnsaved: () => hasUnsavedRef.current(),  // ← 可能过期
  // ...
});
```

`hasUnsavedRef` 通过 `useEffect` 更新，存在一帧延迟。如果用户刚修改语段正文就立即关闭应用窗口（Cmd+Q / Alt+F4），`hasUnsavedRef.current()` 可能仍返回 `false`，导致未保存的修改被静默丢弃。

相比之下，`requestNavigateWithUnsavedCheck` 直接调用 `dirty.hasUnsavedSegmentChanges()`（line 101），没有此问题。说明导航路径是正确的，但应用退出路径使用了错误的间接层。

**修复**：窗口关闭守卫的 `hasUnsaved` 应直接调用 `dirty.hasUnsavedSegmentChanges()`，而非通过 ref。

---

### 2.6 ASR 桥接与设置向导

#### 发现 7 — 🟡 中：`useTierScrollSync.ts` `useLayoutEffect` 缺少 `tierScrollMetrics` 依赖

**位置**：`apps/desktop/src/hooks/useTierScrollSync.ts:39-48`

**问题**：ESLint 报告 `tierScrollMetrics` 缺失于依赖数组。`tierScrollMetrics` 对象由 `useTierScrollLayout` 返回，包含 `scrollLeftPx`, `clientWidthPx`, `refreshLayout`。虽然 `refreshLayout` 函数引用通常稳定，但 `tierScrollMetrics` 整体对象在每次渲染时都是新引用。如果父组件重渲染导致 `useTierScrollLayout` 返回新对象，而依赖数组未包含它，`refreshLayout()` 不会在需要时重新执行。

**修复**：将 `tierScrollMetrics` 加入依赖数组，或解构出 `refreshLayout` 单独依赖。

---

#### 发现 7b — 🟡 中：Async poll `loopbackFetch` 不可中断

**位置**：`apps/desktop/src/pages/transcribeAsyncPoll.ts:41`

**问题**：async job 的 poll 循环使用 `loopbackFetch` 发送 HTTP 请求，但未传递 `AbortSignal`。如果用户点击取消，poll 循环只能在下一次迭代前退出，当前正在进行的 `fetch` 请求会继续直到超时或响应到达。

**修复**：将 `AbortSignal` 传入 `loopbackFetch`，并在取消时调用 `abort()`。

---

#### 发现 7c — 🟡 中：Preflight 与实际 health 存在 TOCTOU（检查时间/使用时间窗口）

**位置**：`apps/desktop/src/pages/transcribeLocalJobRun.ts:58`

**问题**：`localAsrTranscribePreflight` 检查 sidecar health 和模型缓存状态，然后 `executeTranscribe` 开始实际转写。在这两者之间，sidecar 可能被外部杀掉或模型缓存被清除。虽然概率极低，但失败时错误消息可能误导用户（显示"sidecar 未就绪"而非"转写过程中 sidecar 断开"）。

---

#### 发现 7d — 🟡 中：Async-unavailable fallback 忽略用户取消意图

**位置**：`apps/desktop/src/pages/transcribeLocalJobRun.ts:71-74`

**问题**：如果 sidecar 不支持 async 路由（返回 404），代码会 fallback 到同步 `projectRunTranscribe`。但 fallback 前不检查 `refs.userCancelRequested.current`。如果用户在等待 404 响应期间点击了取消，fallback 会静默执行同步转写，违背用户意图。

**修复**：fallback 前检查 `if (refs.userCancelRequested.current) throw new TranscribeUserCancelledError()`。

---

### 2.7 后处理（自动标点 / 分段精修 / 词表校对）

#### 发现 8 — 🟢 低：未发现新的取消句柄泄漏

通过代码走查验证：`postprocess_cancel_auto_punctuate` / `postprocess_cancel_export_polish` 的 `AbortHandle` 在 Rust 侧注册于 `PostprocessCancelState` HashMap 中。HTTP 请求完成后（无论成功或失败），HashMap 中条目仍保留，直到下一次同类型请求覆盖或进程退出。虽然内存泄漏量极小（仅一个句柄），但长期运行后 HashMap 会累积废弃条目。

**建议**：Rust 侧在请求完成后（success / error / cancelled）主动从 `cancel_state` 中移除对应的 `request_id`。

---

## Round 3：Rust 后端命令链路模拟

### 3.1 转写持久化（DB + recovery file）

#### 发现 9 — 🟢 低：Recovery file 与 DB save 的协作符合预期

**位置**：`apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs:407-446`

走查验证：
1. Recovery JSON 在 DB 写入**之前**写入磁盘（line 419）。
2. `file_save_segments_inner` 内部使用 SQLite `transaction()`（`segment_cmd.rs:68`），所有 segment upsert、orphan 删除、file/project 时间戳更新、edit_log 插入、snapshot 插入均在同一事务内（line 195 `tx.commit()`）。
3. 若事务提交成功，recovery 文件被删除（line 431）；若失败，recovery 文件保留，错误消息包含路径（line 442）。

结论：恢复机制正确，无原子性缺口。

#### 发现 10 — 🟡 中：`save_transcribe_segments` 静默忽略 correction hint 加载失败

**位置**：`apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs:401-405`

```rust
if let Ok(conn) = open_db(st) {
    if let Ok(mut hint_warnings) = collect_correction_rule_hints(&conn, &segments) {
        warnings.append(&mut hint_warnings);
    }
}
```

如果 DB 正忙（`open_db` 失败）或 `collect_correction_rule_hints` 失败，校正提示被静默跳过，用户不会收到任何提示。这在高并发或磁盘繁忙时可能导致用户错过重要的校正建议。

**建议**：至少将失败记录到 desktop log（目前已有 `append_desktop_log_line`），或考虑在 warnings 中追加一条"校正提示加载失败"的降级提示。

---

### 3.2 DOCX 导出

#### 发现 11 — 🟢 低：Clippy 已报告 `redundant redefinition`

**位置**：`apps/desktop/src-tauri/src/export_docx.rs:385`

```rust
let default_filename = default_filename;
```

无功能影响，属代码风格问题。已记录在 Round 1。

---

### 3.3 LLM 后处理（取消 + 超时）

#### 发现 12 — 🟢 低：`AbortHandle` 在请求完成后被正确移除

**位置**：`apps/desktop/src-tauri/src/postprocess_cmd.rs:532-546`

走查验证：
```rust
let out = Abortable::new(http_future, registration).await;
if let Ok(mut handles) = cancel_state.0.lock() {
    handles.remove(&id);  // ← 无论成功、失败、取消，均从 HashMap 移除
}
```

`handles.remove(&id)` 在 `Abortable` 结束后执行，不存在泄漏。但 Round 2 发现 8 提到的前端侧 `useEffect` 卸载后 `setSegments` 调用仍可能发生（React 开发模式 warning）。

---

### 3.4 ASR Sidecar 生命周期

#### 发现 13 — 🟡 中：替换 sidecar 子进程时 `wait()` 失败可能留下僵尸进程

**位置**：`apps/desktop/src-tauri/src/asr_sidecar/bundled/process.rs:42-46`

```rust
if let Some(mut old) = g.take() {
    let _ = old.kill();
    let _ = old.wait();
}
```

`std::process::Child` 的 `Drop` 实现**不会**自动调用 `wait()`。如果 `kill()` 发送信号后进程已自行退出（导致 `wait()` 的 `Err` 被 `_` 忽略），PID 可能进入僵尸状态，直到父进程（桌面应用）退出。

**评估**：实际影响有限（僵尸进程占用极少资源），但在长时间运行和频繁重启 sidecar 的场景下会累积。

**建议**：循环调用 `wait()` 直到成功，或使用 `libc::waitpid` 兜底。

---

### 3.5 数据库迁移与连接

#### 发现 14 — 🟢 低：迁移幂等性良好

走查 `db.rs`：所有迁移函数使用 `IF NOT EXISTS`（CREATE TABLE/INDEX）或先 `table_columns` 检查列存在性再 `ALTER TABLE ADD COLUMN`。不存在重复执行导致失败的场景。

#### 发现 15 — 🟡 中：Short-lived connection 模式在高频保存下可能触发 busy

**位置**：`apps/desktop/src-tauri/src/project/utils.rs`（`open_db`）

每个 Tauri command 打开一个独立连接，设置 `PRAGMA busy_timeout = 5000`。在自动保存（1500ms debounce）+ 用户手动保存 + 转写结果保存并发时，可能出现连接竞争。`busy_timeout = 5000` 提供了 5 秒等待窗口，但如果在 5 秒内仍无法获取锁，操作会失败并返回错误。

**建议**：观察生产环境是否出现 "database is locked" 错误。若出现，考虑对写入操作使用连接池或 Serialize 写操作队列。

---

### 3.6 语段 CRUD + Edit Log

#### 发现 16 — 🟢 低：`file_save_segments_inner` 事务边界完整

验证：
- `tx.commit()` 在 line 195，在此之前包含：segment upsert（by uid）、orphan 删除、file 时间戳更新、project 时间戳更新、edit_log 插入、snapshot 插入。
- `upsert_explicit_correction_pairs` 在 `tx.commit()` **之后**执行（line 197），失败仅记录 warning，不影响主事务一致性。这是有意设计。

---

### 3.7 本地运行时下载与恢复

未在本次深度审查范围内（该模块代码量大且当前非活跃路径）。 architecture guard 已报告 `local_runtime/**/*.rs` 无新增错误。

---

### 3.8 波形峰值生成

#### 发现 17 — 🟡 中：`waveform_peaks_cmd.rs` 使用 `tokio::task::spawn_blocking` 但缺少 panic 处理

**位置**：`apps/desktop/src-tauri/src/project/waveform_peaks_cmd.rs`

FFmpeg 子进程生成峰值数据的操作被 offload 到 `spawn_blocking`。若 FFmpeg 进程 panic 或被 kill，`spawn_blocking` 返回 `JoinError`。检查发现部分路径未对 `JoinError` 做显式 `is_panic()` 区分，统一按普通错误处理。功能正确，但调试时无法区分 panic 与普通 IO 错误。

**建议**：低优先级，可在日志中标注 panic 场景以便排障。

---

## Round 4：跨层契约与集成边界

### 4.1 Tauri Command 契约对齐

#### 发现 18 — 🟢 低：共享 Fixture `exportTrackMarkupCases.json` 双端一致

**验证**：
- TS 测试：`apps/desktop/src/services/exportPolishTrackMarkup.test.ts` 导入 `./fixtures/exportTrackMarkupCases.json`
- Rust 测试：`apps/desktop/src-tauri/src/export_docx_polish_track_diff.rs:407` 通过 `include_str!("../../src/services/fixtures/exportTrackMarkupCases.json")` 内联同一文件

结论：TS 与 Rust 读取同一 fixture 源文件，行为一致。✅

#### 发现 19 — 🟡 中：`SegmentDto` 字段在三层之间不完全对称

| 字段 | Rust | TypeScript | Python (TranscriptionSegment) |
|---|---|---|---|
| `uid` | `Option<String>` | `?: string` | **无** |
| `idx` | `i32` | `number` | **无** |
| `start_sec` | `f64` | `number` | `float` |
| `end_sec` | `f64` | `number` | `float` |
| `text` | `String` | `string` | `str` |
| `confidence` | `Option<f64>` | `?: number \| null` | `float \| None` |
| `low_confidence` | `bool` | `?: boolean` | `bool` |
| `detail` | `Option<String>` | `?: string \| null` | `str \| None` |
| `kind` | `Option<String>` | `?: SegmentKind \| null` | `Literal["speech","placeholder"]` |

**分析**：
- `uid` 和 `idx` 是 Rust/TS 层在**接收** sidecar 响应后生成的（`parse_transcribe_segments_from_json` line 45-46：UUIDv4 + enumerate），不在 sidecar schema 中。这是设计上的分层：sidecar 只管声学识别，持久化层负责稳定 ID。
- Python `kind` 默认 `"speech"`，Rust 默认 `None` 但解析时回退为 `"speech"`（line 41）或 `"placeholder"`（line 38-40）。行为一致。

**风险**：无功能风险，但新开发者可能困惑于为何 sidecar 返回的 JSON 缺少 `uid`/`idx`。

---

### 4.2 安全边界

#### 发现 20 — 🟡 中：日志脱敏 `replace_json_secret_fields` 仅处理第一个匹配项

**位置**：`apps/desktop/src-tauri/src/utils/log_redact.rs:45-71`

```rust
for key in ["\"api_key\"", "\"apiKey\"", "\"secret\"", ...] {
    if let Some(start) = out.find(key) {
        // ... 只替换第一个出现的位置
    }
}
```

如果日志中包含多个 `api_key` 字段（例如数组或嵌套对象），只有第一个会被脱敏，后续明文密钥会泄露到日志中。

**修复**：将 `if let Some(start)` 改为 `while let Some(start)` 循环替换所有出现。

#### 发现 21 — 🟢 低：API Key 存储策略合理

**位置**：`apps/desktop/src-tauri/src/postprocess_secret_store.rs`

- macOS 开发构建默认使用 AppData 内 `0600` 文件（避免签名变更导致钥匙串反复弹窗）。
- Linux/Windows 默认使用系统 keyring。
- 提供 `RUSHI_LLM_SECRET_FORCE_FILE=1` 和 `RUSHI_LLM_SECRET_USE_KEYRING=1` 显式覆盖。
- 文件路径：`{app_data}/secrets/postprocess/{api_key_id}.key`，权限 `0o600`。

---

### 4.3 Python Sidecar 接口契约

#### 发现 22 — 🟢 低：FastAPI schema 与 Rust multipart 构造对齐

**位置**：`services/asr/rushi_asr/schemas.py` vs `apps/desktop/src-tauri/src/project/transcribe.rs`

- Python `TranscriptionResult` 包含 `schema_version`、`segments`、`full_text`、`engine`、`duration_sec`、`error`、`warnings`、`segmentation_mode`。
- Rust `post_transcribe_multipart` 读取响应 JSON，检查 `error` 字段，提取 `segments` 数组。字段映射一致。
- `segmentation_mode` 被 Rust 读取并用于 warnings 拼接（`run_transcribe_cmd.rs:144`）。

---

### 4.4 错误消息一致性

#### 发现 23 — 🟢 低：未发现前后端重复/冲突的中文错误消息

Rust 侧错误消息（如 `"项目音频文件缺失"`、`"转写任务不存在"`）与前端 toast 提示分属不同层级，未发现重复或互相覆盖的情况。

---

## Round 5：Python Sidecar 深度审查

### 5.1 端点健壮性

#### 发现 24 — 🟢 低：FastAPI 端点参数校验覆盖全面

**位置**：`services/asr/rushi_asr/app.py`

- 所有 POST 端点使用 Pydantic 模型（`TranscriptionRequest` 等）进行参数校验。
- 文件上传限制 512 MiB，流式读取 1 MiB chunk。
- 同步 IO（FFmpeg、FunASR）均包裹在 `run_in_threadpool` 中。

---

### 5.2 模型加载与内存

#### 发现 25 — 🟡 中：`invalidate_funasr_model_cache()` 仅置空引用，不强制释放 GPU 内存

**位置**：`services/asr/rushi_asr/funasr_engine.py:54-59`

```python
def invalidate_funasr_model_cache() -> None:
    global _model_singleton, _model_loaded_id
    with _runtime_lock:
        _model_singleton = None
        _model_loaded_id = None
```

PyTorch 模型在 Python 层失去引用后，底层 CUDA tensor 不会立即释放。缺少 `torch.cuda.empty_cache()` 或 `gc.collect()`。在 GPU 模式下切换模型时，可能观察到显存峰值叠加。

**评估**：当前 v1 以 CPU 推理为主（MPS/CPU 矩阵），影响有限。若未来启用 CUDA 为主路径，此问题会放大。

---

### 5.3 长音频窗口化

#### 发现 26 — 🟢 低：窗口切片清理可靠

**位置**：`services/asr/rushi_asr/transcribe_windows.py:128-163`

- 切片目录 `slice_dir` 在 `try/finally` 中被 `shutil.rmtree(slice_dir, ignore_errors=True)` 清理。
- 即使 `extract_wav_segment` 或 `generate_and_parse_funasr` 抛出异常，清理仍然执行。

#### 发现 27 — 🟡 中：`merge_window_segments` 仅排序，不合并重叠

**位置**：`services/asr/rushi_asr/transcribe_windows.py:101-102`

```python
def merge_window_segments(segments: list[TranscriptionSegment]) -> list[TranscriptionSegment]:
    return sorted(segments, key=lambda s: (s.start_sec, s.end_sec))
```

函数名暗示"合并"，实际只做排序。相邻窗口的边界可能产生时间戳重叠的 segments。Rust 侧有 `trim_adjacent_segment_overlaps` 做后处理，因此整体链路正确。但函数名具有误导性，建议重命名或添加注释说明。

---

### 5.4 FFmpeg 子进程

#### 发现 28 — 🟢 低：超时与异常处理完整

**位置**：`services/asr/rushi_asr/ffmpeg_audio.py`

- `ffprobe_duration_sec`：120s 超时（line 89）。
- `normalize_to_wav_16k_mono`：动态超时预算 `pipeline_timeout_sec`（line 110）。
- 异常覆盖：`FileNotFoundError`、`CalledProcessError`、`TimeoutExpired`，均转化为带上下文的 `RuntimeError`。

---

### 5.5 测试覆盖盲区

#### 发现 29 — 🟡 中：部分模块缺少边界条件测试

| 模块 | 测试状态 | 盲区 |
|---|---|---|
| `model_manifest_verify.py` | 有测试 | SHA256 校验失败路径已覆盖 |
| `eval_metrics.py` | 有测试 | CER 计算在空字符串/等长字符串边界 |
| `segmentation.py` | 部分覆盖 | `whole-track fallback` 在时长恰为 30s 的边界 |
| `transcribe_timeouts.py` | 有测试 | NaN/Infinity 输入（`duration_sec != duration_sec` 已处理） |

---

### 5.6 Qwen3 死代码影响

#### 发现 30 — 🟢 低：Qwen 分支在正常路径不可达

**位置**：`services/asr/rushi_asr/asr_model_profile.py`

- `is_qwen_asr_model()` 仅在模型 ID 包含 `"qwen"` 时返回 true。
- Qwen3-ASR 不在 `model_catalog.py` 的精选列表中，亦不提供下载/准备路径。
- 正常用户无法通过 UI 选择到 Qwen3 模型，因此这些分支不可达。
- 风险：无。保留代码对未来可能的 Qwen LLM-ASR 融合实验无负面影响。

---
## 补充审查 A–G（2026-06-03 追加）

审查范围：Tauri 安全边界、文件系统安全、CI/CD、诊断包隐私、Plugin System、Edit Log/Snapshot 一致性、性能与包大小。

---

### A. Tauri 安全边界（CSP、Capabilities、Asset Protocol、IPC）

#### A1 — 🟡 中：`script-src 'self' 'unsafe-inline'` 存在理论 XSS 面

**位置**：`apps/desktop/src-tauri/tauri.conf.json:21`

- CSP 声明 `script-src 'self' 'unsafe-inline'`，标准 Vite/React 配置。若前端存在未过滤的 HTML 渲染点，攻击者注入的 `<script>` 可执行。
- **验证结果**：全代码库搜索 `dangerouslySetInnerHTML` / `innerHTML`（含赋值）**零命中**。React 默认转义 + 无显式 HTML 注入点 = 当前无可利用路径。
- **风险**：低（无已知 XSS 向量），但需保持警惕：新增任何富文本渲染组件时必须做 HTML sanitization。

#### A2 — 🟢 低：`capabilities/default.json` 声明极简但不构成漏洞

**位置**：`apps/desktop/src-tauri/capabilities/default.json`

- 仅声明 `core:default`、`core:window:allow-close`、`core:window:allow-destroy`。
- Tauri v2 中，**自定义 command 通过 `generate_handler!` 注册时默认可被前端调用**，无需在 capabilities 中逐一声明。因此 capabilities 文件是否完整不影响命令可用性。
- 若未来迁移到 capability-based command 过滤，需补充所有 command 白名单。

#### A3 — 🟢 低：Asset Protocol 范围合理

**位置**：`tauri.conf.json:23-25`

```json
"assetProtocol": {
  "enable": true,
  "scope": ["$APPDATA/projects/**", "$APPDATA/studio.lingchuang.rushi/projects/**"]
}
```

- 仅允许项目目录下的音频/媒体文件通过 `asset://` 协议读取。攻击者无法通过构造 URL 访问 `$APPDATA` 以外的文件。

#### A4 — 🟡 中：`asr_loopback_request` 路径过滤器可加固

**位置**：`apps/desktop/src-tauri/src/asr_sidecar/loopback.rs:27-33`

```rust
fn normalize_path(path: &str) -> Result<String, String> {
    let p = path.trim();
    if !p.starts_with('/') || p.contains("..") {
        return Err("invalid_loopback_path".into());
    }
    Ok(p.to_string())
}
```

- 过滤器阻止了 `../etc/passwd` 形式的遍历，但对以下变体宽松：
  - 双斜杠 `//health` — 可通过（ASR sidecar 仅服务自有 API，无实际危害）。
  - URL 编码 `%2e%2e` — reqwest 不自动解码路径；ASR sidecar (Starlette) 路由基于解码后路径，但 `%2e%2e` 在 Python `urllib.parse.unquote` 后变成 `..`。如果 ASR sidecar 使用文件系统路径（实际上不这么做），理论上存在绕过。
- **结论**：当前 ASR sidecar 的 API 面仅限于 `/health`、`/transcribe`、`/models` 等固定端点，无文件系统操作，因此该过滤器"足够好"。建议后续将 `contains("..")` 替换为逐段规范化（`std::path::Path::components`），以消除理论疑虑。

---

### B. 文件系统安全（路径遍历、ZIP slip、词汇表解析、Temp 清理）

#### B1 — 🟢 低：所有文件选择器均通过系统对话框，无前端路径注入

| Command | 实现 | 结论 |
|---|---|---|
| `pick_audio_path` | `rfd::FileDialog::pick_file()` | ✅ 用户控制 |
| `pick_text_path` | `rfd::FileDialog::pick_file()` | ✅ 用户控制 |
| `export_project_bundle` | `rfd::FileDialog::save_file()` + 验证目标不存在 | ✅ 用户控制 |
| `import_project_bundle` | `rfd::FileDialog::pick_file()` | ✅ 用户控制 |
| `glossary_import_from_file` | `rfd::FileDialog::pick_file()` | ✅ 用户控制 |
| `export_settings_profile` | `rfd::FileDialog::save_file()` | ✅ 用户控制 |
| `import_settings_profile` | `rfd::FileDialog::pick_file()` | ✅ 用户控制 |
| `export_diagnostic_bundle` | `rfd::FileDialog::save_file()` | ✅ 用户控制 |
| `export_text_file` | `rfd::FileDialog::save_file()` | ✅ 用户控制 |

前端无法直接指定文件系统路径；所有读写路径均来自操作系统原生对话框。

#### B2 — 🟢 低：项目包导入无 ZIP slip 漏洞

**位置**：`apps/desktop/src-tauri/src/project/project_bundle_cmd.rs:153-285`

- `manifest.audio_file` 经过双重验证：
  1. `Path::new(&manifest.audio_file).file_name()` 提取纯文件名；
  2. `audio_file_name != manifest.audio_file` 拒绝含路径分隔符的值。
- ZIP 内音频读取使用硬编码前缀 `audio/{audio_file_name}`，且 `audio_file_name` 已验证为纯文件名。
- 测试覆盖：`import_project_bundle_rejects_unsafe_audio_path` 已验证 `audio/../../evil.wav` 被拦截（`project_bundle_cmd_tests.rs:265-299`）。

#### B3 — 🟢 低：词汇表导入文件解析无路径遍历

**位置**：`apps/desktop/src-tauri/src/project/glossary_import.rs:40-80`

- `calamine::open_workbook_auto(path)` 直接打开用户通过系统对话框选择的文件。
- 解析结果（单元格文本）直接插入数据库，不做文件系统操作。
- 无 ZIP slip、无路径遍历、无反序列化漏洞（calamine 解析为内存中的 `Data` 枚举）。

#### B4 — 🟡 中：两处临时文件在异常路径下可能泄漏

**位置 1**：`project_bundle_cmd.rs:126-149`

```rust
let tmp_path = zip_path.with_extension("zip.part");
let file = File::create(&tmp_path)?;
// ... write zip ...
fs::rename(&tmp_path, zip_path)?;  // 失败时未清理 tmp
```

- 若 `zip.finish()` 或 `fs::rename()` 失败，`.zip.part` 残留于用户选定的目录。

**位置 2**：`waveform_peaks_generate.rs:98-114`

```rust
let tmp_path = path.with_extension("dat.tmp");
let file = File::create(&tmp_path)?;
// ... write dat ...
fs::rename(&tmp_path, path)?;  // 失败时未清理 tmp
```

- 若写入或 rename 失败，`.dat.tmp` 残留于 `$APPDATA/projects/{id}/`。

**对比**：`diagnostic.rs:220-227` 在错误时主动 `fs::remove_file(&tmp_path)`，是良好范例。

**修复建议**：在 `project_bundle_cmd.rs` 和 `waveform_peaks_generate.rs` 的 error 路径中追加 `let _ = fs::remove_file(&tmp_path);`。

---

### C. CI/CD 与跨平台构建（R3h-0 阻塞分析）

#### C1 — 🔴 高：CI 仅验证 Ubuntu，无 macOS/Windows 构建

**位置**：`.github/workflows/ci.yml`

```yaml
desktop:
  runs-on: ubuntu-latest
```

- Tauri 应用在三个平台（macOS/Windows/Linux）的构建行为差异显著：
  - 原生依赖（`libwebkit2gtk` 仅在 Linux）
  - 代码签名与 notarization（macOS）
  - MSI/NSIS 打包（Windows）
- 当前 CI 无法捕获平台专属编译错误，也无法验证 `dmg`/`msi`/`app` 产物。

#### C2 — 🔴 高：Tauri build 仅验证 `deb`，不验证 `dmg`/`msi`/`app`

**位置**：`.github/workflows/ci.yml:76`

```yaml
- name: Tauri build (deb bundle smoke)
  run: npm run tauri -- build --bundles deb
```

- `--bundles deb` 跳过 AppImage、MSI、DMG。R3h-0（跨平台冒烟）阻塞根因在此。

#### C3 — 🟡 中：无依赖安全审计（audit）步骤

- CI 未运行 `cargo audit`、`npm audit`、`pip-audit`。已知漏洞无法被自动发现。

#### C4 — 🟡 中：ASR sidecar 构建为手动触发，无自动跨平台产物

**位置**：`.github/workflows/asr-sidecar-build-nightly.yml`

```yaml
on:
  workflow_dispatch:
```

- 仅 Linux x86_64 有自动化构建。macOS/Windows sidecar 需本地手动构建，易与 desktop 发布不同步。

#### C5 — 🟢 低：`cargo clippy --all-targets -- -D warnings` 在 CI 中通过

- 本地存在 13 个 Clippy warning（未使用 import、dead_code 等），推测为本地 Rust 工具链版本与 CI 不一致，或 CI 只检查 `--all-targets` 但不包含某些 cfg 条件模块。

---

### D. 诊断包与数据隐私（DB/日志/快照脱敏）

#### D1 — 🟡 中：诊断包可能包含完整转写文本，但无导出前警告

**位置**：`apps/desktop/src-tauri/src/diagnostic.rs`

- `rushi.sqlite3`（≤ 5MB）直接嵌入 ZIP。该数据库包含：
  - 所有项目的 `segments.text`（完整转写内容）
  - `projects.name`（项目名，可能含敏感信息）
  - `edit_log.detail`（操作审计日志）
- `recent_edit_log.tsv` 导出 `edit_log` 表最近 500 行，`detail` 列在 `save_segments` 操作中包含 segments JSON，即转写文本。
- `logs/*.log` 尾段：若日志级别为 DEBUG，可能包含 HTTP 请求/响应体，其中可能有转写片段。
- **建议**：在导出对话框中增加显式提示："诊断包将包含应用数据库副本与近期日志，可能含有转写内容。"

#### D2 — 🟡 中：`replace_json_secret_fields` 仅替换首个 secret（已修复）

**位置**：`apps/desktop/src-tauri/src/utils/log_redact.rs:55`（原代码）

- 原实现 `if let Some(start) = out.find(key)` 导致同一 key 出现多次时只脱敏第一个。
- **修复**：改为 `while let` 循环 + `search_from` 偏移，确保全部替换。新增 `redacts_multiple_json_secret_fields` 测试验证（5 项测试全部通过）。

---

### E. Plugin System 边界（sandbox 缺失、权限分级）

#### E1 — 🔴 高：Plugin 动态导入无 URL 校验，且无沙箱

**位置**：`apps/desktop/src/plugin-system/loader.ts:38`

```typescript
const mod = (await import(/* @vite-ignore */ manifest.entry)) as { ... };
```

- `manifest.entry` 可为任意绝对/相对 URL。若攻击者注入指向远程恶意代码的 manifest，插件将在主应用上下文中执行，拥有与主应用同等的 `window.__TAURI_INTERNALS__.invoke` 访问权限。
- **缓解**：当前没有外部插件市场或第三方插件加载 UI；所有插件均为内置（通过静态 import 的 manifest 列表加载）。但代码层面无校验是架构债务。

#### E2 — 🟡 中：`SegmentDecorator.decorate()` 返回原始 HTML 字符串

**位置**：`apps/desktop/src/plugin-system/types.ts:94-95`

```typescript
export interface SegmentDecorator {
  decorate(segmentText: string): string;
}
```

- 若主应用将 `decorate()` 返回值直接写入 DOM（如通过 `innerHTML`），插件可注入任意 HTML/JS。
- **验证**：当前代码库无 `innerHTML` 或 `dangerouslySetInnerHTML` 使用。Segment 文本渲染通过 React 的 `{text}` 完成，天然转义 HTML。但若未来引入 decorator 渲染路径，必须确保使用 `textContent` 或 DOMPurify。

#### E3 — 🟡 中：无权限分级模型

- PluginContext 提供 `register` / `unregister` / `emit` / `on`，无能力隔离。插件可监听所有事件、注册任意扩展点。
- 建议：在 PluginManifest 中声明所需权限列表（如 `invoke:llm_probe_connection`），加载时校验。

---

### F. Edit Log / Snapshot 一致性（事务边界、schema 演进）

#### F1 — 🟢 低：`insert_snapshot` 事务边界正确

**位置**：`apps/desktop/src-tauri/src/project/edit_log_snapshot.rs:8-24`

- 接收 `&Transaction<'_>` 而非 `&Connection`，确保 snapshot 与对应的 `edit_log` 行在同一事务中提交。
- `prune_snapshots_for_file` 在同一事务中执行，保证"插入+修剪"原子性。

#### F2 — 🟢 低：`load_snapshot` 文件交叉校验有效

**位置**：`edit_log_snapshot.rs:38-54`

```rust
if stored_file != file_id {
    return Err("快照与当前文件不匹配".into());
}
```

- 防止通过篡改 `edit_log_id` 恢复其他文件的 segments。`file_id` 为后端生成的 UUID，碰撞概率可忽略。

#### F3 — 🟢 低：Snapshot 数量限制合理

- `SNAPSHOTS_PER_FILE = 30`，`prune_snapshots_for_file` 保留最新的 30 条。对于高频保存（每 30s auto-save），可回溯约 15 分钟历史。

#### F4 — 🟡 中：Snapshot schema 无显式版本，依赖 serde 默认行为

- `SegmentDto` 若新增必填字段，旧 snapshot 的 JSON 反序列化将失败。
- **当前缓解**：`SegmentDto` 字段均使用 `Option<T>` 或带 `Default` 的 serde 属性（如 `#[serde(default)]`），新增可选字段不会破坏旧 snapshot。
- **建议**：在 snapshot 表中增加 `schema_version` 列，为未来的必填字段变更预留迁移路径。

#### F5 — 🟢 低：`project_list_edit_log` LIMIT 有上限

**位置**：`project_query_cmd.rs:49`

```rust
let capped_limit = limit.unwrap_or(40).clamp(1, 200);
```

- 防止前端请求超大 limit 导致内存/响应膨胀。

---

### G. 性能与包大小（bundle 体积、内存峰值）

#### G1 — 🟢 低：Rust 依赖清单合理，无冗余大件

**位置**：`apps/desktop/src-tauri/Cargo.toml`

| 依赖 | 用途 | 评估 |
|---|---|---|
| `symphonia` (6 codecs) | 音频格式解码（AAC/FLAC/MP3/PCM/Vorbis/WAV） | 必要 |
| `reqwest` + `rustls-tls` | HTTP/HTTPS 客户端（LLM API、在线 STT） | 必要 |
| `tungstenite` | 讯飞/火山 WebSocket STT | 必要 |
| `rusqlite` + `bundled` | 嵌入式 SQLite | 必要 |
| `calamine` | Excel/ODS 词汇表导入 | 必要 |
| `docx-rs` | DOCX 导出 | 必要 |
| `zip` + `deflate` | 项目包/诊断包 ZIP | 必要 |
| `ed25519-dalek` | 运行时签名验证 | 必要 |
| `flate2` | 压缩（辅助 zip） | 轻量 |

- 无 obviously-bloated 依赖（如未使用的 async runtime、图形库等）。

#### G2 — 🟡 中：无 bundle 大小跟踪或预算

- CI 未记录 `cargo bloat` 或 `tauri build` 产物体积。
- 建议：在 CI 的 Tauri build 步骤后输出 `.deb` / `.AppImage` / `.dmg` 体积，并与上一次构建对比，防止依赖膨胀。

#### G3 — 🟡 中：`symphonia` 全量编译可能增加 binary 体积

- `symphonia` 启用了 6 个 codec feature。若未来只需要 WAV/MP3 作为主流输入，可考虑裁剪至 2-3 个 feature，减少 ~1-2 MB binary。

---

## 补充审查汇总

### 新增 🔴 高优先级

| # | 发现 | 文件 | 修复工作量 |
|---|---|---|---|
| C1 | CI 仅 Ubuntu，无 macOS/Windows 构建 | `.github/workflows/ci.yml` | 新增 matrix（~15 行） |
| C2 | Tauri build 仅 `deb`，不验证 `dmg`/`msi` | `.github/workflows/ci.yml:76` | 改 `--bundles all`（~1 行） |
| E1 | Plugin 动态导入无 URL 校验、无沙箱 | `plugin-system/loader.ts:38` | 架构决策（非本次修） |

### 新增 🟡 中优先级

| # | 发现 | 文件 | 修复工作量 |
|---|---|---|---|
| A4 | `normalize_path` 可加固（`contains("..")` 过宽） | `loopback.rs:27` | ~8 行（`Path::components`） |
| B4 | 两处 `.part`/`.tmp` 异常路径未清理 | `project_bundle_cmd.rs` / `waveform_peaks_generate.rs` | ~4 行（`remove_file`） |
| C3 | CI 缺少 `cargo audit` / `npm audit` | `.github/workflows/ci.yml` | ~4 行 |
| C4 | ASR sidecar 无自动 macOS/Windows 构建 | `asr-sidecar-build-nightly.yml` | 需新增 job |
| D1 | 诊断包导出前无敏感数据提示 | 前端导出对话框 | ~2 行文案 |
| E2 | `SegmentDecorator` 返回原始字符串，未来 HTML 渲染需 sanitization | `plugin-system/types.ts` | 文档化 |
| E3 | Plugin 无权限分级 | `plugin-system/types.ts` / `loader.ts` | 架构决策 |
| F4 | Snapshot 无 schema_version 列 | `edit_log_snapshot.rs` | ~5 行（ALTER + 逻辑） |
| G2 | 无 bundle 大小跟踪 | CI | ~3 行（`ls -lh`） |
| G3 | `symphonia` 6 codecs 全量编译 | `Cargo.toml` | 观察项（可选裁剪） |

### 已修复项

| # | 发现 | 文件 | 修复说明 |
|---|---|---|---|
| 18 | `replace_json_secret_fields` 仅替换首个 secret | `utils/log_redact.rs` | `while let` + `search_from` 偏移；新增多重 secret 脱敏测试 |

---

*报告完*

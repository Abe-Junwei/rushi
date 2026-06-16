# 全量代码审查修复进度跟踪（2026-06-16）

> **基准报告**：[`full-code-review-architecture-comparison-report.md`](./full-code-review-architecture-comparison-report.md)  
> **范围**：对照基准报告 §7.1.3–§7.5.3、§9、§10 列出的问题/建议，检查当前修复进度与已修复项是否引入新问题。  
> **检查时间**：2026-06-16  
> **复查时间**：2026-06-16（第二轮复核）  
> **检查人**：Kimi Code CLI

---

## 总体进度

| 状态 | 数量 | 占比 |
|------|------|------|
| 已修复 | 18 | 55% |
| 部分修复 | 5 | 15% |
| 未修复 | 10 | 30% |
| **合计** | **33** | 100% |

> 注：原进度表将 `#27 Playwright E2E 依赖真实 ASR 服务` 重复计数（同时列在已修复与部分修复），本版已去重。
>
> **第三轮（实施，2026-06-16）变更**：#8 反向孤儿风险已消除、#16 spec 已完全平台自适应、#18 health 版本字段已补、#34 pyproject 描述已更新；详见文末「§七 修复轮次更新」。统计已据此调整（#16 部分→已；#18/#34 未→已）。

---

## 一、已修复项（15 项）

| # | 标题 | 关键证据 | 是否引入新问题 |
|---|------|----------|----------------|
| 6 | 同步命令直接阻塞 IO | `segment_cmd.rs:236-277`、`project_create_cmd.rs:34-49`、`export_cmd.rs:53-92` 已改为 `async fn` + `spawn_blocking` | 否 |
| 7 | 无 WAL + 无连接池 | 新增 `src-tauri/src/db/pool.rs:12-25`，启用 `r2d2` 连接池、`journal_mode=WAL`、`busy_timeout=5000`、`foreign_keys=ON` | ⚠️ 生产路径仍有独立 `Connection::open`（诊断包、导出等），未接入 pool |
| 8 | 删除项目后磁盘清理失败不回滚 | `project_delete_cmd.rs:8-23` 改为 commit-first：`DELETE` → `tx.commit()` → best-effort `cleanup_deleted_project_storage`（失败仅 WARN 日志）。DB 为真相源，最坏只留可清扫的孤儿文件 | ✅ 第三轮已消除反向孤儿风险（commit 在清理之前；不再可能出现「DB 有记录但媒体已删」） |
| 10 | Windows 无法自动清理 8741 占用进程 | `src-tauri/src/asr_sidecar/bundled/port.rs:29-65` 已实现 Windows PowerShell 清理逻辑 | 否 |
| 13 | 上传文件全量读入内存 | `services/asr/rushi_asr/app.py:53-79` 改为分块流式写入，`_MAX_UPLOAD_BYTES=512MB`、`_READ_CHUNK=1MB` | 否 |
| 14 | 分窗边界无重叠/上下文 | `services/asr/rushi_asr/transcribe_windows.py:19-104` 增加 `DEFAULT_WINDOW_OVERLAP_SEC=2.0`、`plan_windows`、`trim_window_prefix_overlap` | 否 |
| 19 | `peakCacheGeneration` 触发 WaveSurfer 整实例 remount | `useProjectWaveformMount.ts` mount effect 已移除 `peakCacheGeneration` 依赖；文件当前 291 行，未超阈值 | 否 |
| 20 | `mountRefs` 对象每次渲染重建 | `useProjectWaveform.ts:126-151` 已用 `useMemo(() => ({...}), [appliedZoom])` 缓存 | 否 |
| 23 | 播放中 peaks 热切换有间隙风险 | `services/waveform/waveformZoomSyncEngine.ts:185-204` 保存 `resumeTimeSec`/`resumePlaying`，`ws.load` 后恢复播放 | 否 |
| 25 | 无覆盖率收集与门禁 | `apps/desktop/vitest.config.ts:9-19` 配置 `@vitest/coverage-v8` 与 thresholds；`.github/workflows/ci.yml:86-95` 运行 `npm run test:coverage` | ⚠️ 阈值偏低（statements 45 / branches 35 / functions 35 / lines 45）；无 Codecov / PR diff 门禁 |
| 26 | lint-staged 对全量文件跑 `tsc --noEmit` | `apps/desktop/lint-staged.config.mjs:1-8` 仅对 staged 文件跑 ESLint，不再触发全量 typecheck | 否 |
| 29 | Vitest 配置极简 | `vitest.config.ts` 已扩展 coverage reporter、include/exclude、thresholds | ⚠️ 仍缺少 shard/retry 等高级配置 |
| 32 | 诊断包 JSON 脱敏改进 | `src-tauri/src/diagnostic_db_sanitize.rs:24-105` 扩展 redaction，并新增单元测试 | 否 |
| 33 | 移除 `services/fixtures/` 空目录或补充说明 | 目录已不存在 | 否 |
| 其他 | 部分清理 wave（knip 死代码、dead_code allow、exports 清理） | 提交 `d3d61bb`、`5015488` 等 | 否 |

### 已修复项中需要关注的新问题

1. **生产路径仍有非池化 SQLite 打开**：`diagnostic_db_sanitize.rs:19`、`diagnostic.rs:168/363`、`export_docx.rs:288` 仍有独立 `Connection::open`，未统一接入 `DbPool` 的 WAL/busy_timeout 配置。
2. **项目删除反向孤儿风险**：`project_delete_cmd.rs` 在 storage 删除成功但 `tx.commit()` 失败时，会留下 DB 记录但文件已删除。建议评估是否将 commit 提前或对失败做异步孤儿扫描。
3. **覆盖率阈值偏低**：当前 global threshold（statements 45% / branches 35%）对防止回归作用有限，建议后续按模块设置更严格的 diff 阈值或接入 Codecov PR comment。
4. **Vitest 仍缺高级配置**：无 shard/retry，大仓库 CI 时间随测试增长可能恶化。

---

## 二、部分修复项（6 项）

| # | 标题 | 已做 | 未做 / 遗留风险 | 是否引入新问题 |
|---|------|------|-----------------|----------------|
| 4 | `environmentCapabilityCoordinator` 模块级 singleton | `snapshot` 已迁入 Zustand `createModuleStore`（`services/shared/createModuleStore.ts`） | `registeredDeps`、`inflight`、`generation`、`lastFocusRefreshAt` 仍为模块级变量；`resetEnvironmentCapabilityCoordinatorForTests` 仍存在 | ⚠️ store + 模块变量混合，长期维护成本未真正降低 |
| 9 | 错误信息全部扁平化为 String | 新增 `src-tauri/src/command_error.rs`（`thiserror` 枚举）并在 `export_cmd.rs`、`project_delete_cmd.rs` 等使用 | `project/*.rs` 中仍有约 209 处 `Result<..., String>`，仅约 76 处引用 `CommandError`/`CommandResult`；Tauri handler 通过 `map_command_err()` 最终仍转 `String` | ⚠️ 内部结构化、边界仍扁平化，i18n/遥测收益未释放 |
| 12 | ASR 单线程推理执行器 + 全局模型锁 | 新增 `services/asr/rushi_asr/inference_queue.py`，`ThreadPoolExecutor(max_workers=1)` 已完全移除，超时重启更干净 | 仍是单 worker FIFO（`inference_max_workers: 1`），`_runtime_lock` 全局锁仍在（`funasr_engine.py:41/137/309`），并发吞吐量未提升 | 否 |
| 16 | PyInstaller spec 使用绝对路径 | `rushi-asr-sidecar.spec:7-8` 已改用 `SPEC_DIR` 相对路径，不再硬编码 `/Users/junwei/...` | 仍硬编码 `darwin-arm64` 平台子目录，Windows/Linux 打包仍受限 | 否 |
| 21 | `WaveformSegmentBandCanvas` live drag 频繁重建事件监听 | 已用 `inputRef`/`tierMetricsRef` 缓存实时值 | `useLayoutEffect` 依赖仍包含 `segments`、`durationSec` 等，drag 中 segments 变化仍会触发 effect 重建 scroll/wheel/resize 监听 | 否 |
| 27 | Playwright E2E 依赖真实 ASR 服务 | 核心旅程 spec（`desktop-core-journey.spec.ts` / `desktop-lifecycle-smoke.spec.ts`）已使用 `tauri-mock-init.js` mock Tauri 调用 | `asr-health.spec.ts` 与 CI `asr` job 仍启动真实侧车跑契约测试 | 否 |

### 部分修复项中需要关注的新问题

1. **环境能力协调器状态分裂**：`snapshot` 在 store 中，但执行状态（`inflight`、`generation`）仍在模块变量中。这种混合模式可能让热更新/测试 reset 更难推理，未来完整迁移时需谨慎。
2. **结构化错误「半途而废」**：`command_error.rs` 已建立枚举，但 Tauri 边界仍暴露 `String`，前端无法利用错误码做分类或 i18n。建议要么完整迁移到结构化错误暴露，要么推迟到 v1.2。
3. **ASR 推理并发未实质改善**：队列化后超时处理更好，但单 worker 未变。若 Nano/Qwen 等 SKU 速度 slower，长音频排队体验仍是瓶颈。
4. **PyInstaller 跨平台仍受限**：虽然去掉了绝对用户名路径，但 `darwin-arm64` 硬编码意味着 Windows/Linux 打包需要额外处理或单独 spec。

---

## 三、未修复项（12 项）

| # | 标题 | 当前状态证据 | 备注 |
|---|------|--------------|------|
| 1 | `useProjectController` 巨型 facade | `apps/desktop/src/pages/useProjectController.ts` 仍为 322 行，返回对象约 251 个字段（行 85–321） | 架构守卫报「323 行，接近 300 行阈值」 |
| 2 | State/Ref 双轨制 | `useProjectEditorState.ts` 行 35/40/41 同时维护 `segments` state 与 `segmentsRef`；`useSegmentMutationController.ts` 行 164/176 直接读写 `segmentsRef.current` | 未迁移迹象 |
| 3 | 40 个文件超过 300 行 / 12 hooks 阈值 | 架构守卫当前 39 警告：行数警告 35 个、hook 警告涉及 13 个文件 | 基准数据来自审查定稿，当前 guard 输出已变化 |
| 5 | 无 React Context，依赖 controller prop 传递 | 全仓库 `createContext`/`useContext` 检索为 0 | 当前方案可接受，但 mega-facade 问题与之相关 |
| 11 | `pub use *` 汇总增加符号泄露 | `src-tauri/src/project/mod.rs:62-85` 仍大量使用 `pub use ...::*;` | IDE 索引负担未减轻 |
| 15 | `ready_for_transcribe` 基于文件探测 | `services/asr/rushi_asr/runtime_caps.py:48` 仍由 `required_models_cached_guess` + `ffmpeg_on_path` 决定 | 未改为模型真实加载状态 |
| 17 | 参数 strip 回退隐藏模型不兼容 | `funasr_engine.py:282-332` 仍按 `strip_order` 逐个剔除参数并降级重试 | 静默质量风险 |
| 18 | 健康端点未返回侧车版本 | `services/asr/rushi_asr/app.py:119-123` `/health` 无 `version` 字段 | 升级兼容性判断困难 |
| 22 | 大范围多选让 overlay 退化为全量 DOM | `utils/waveformSegmentOverlayVisibility.ts:49-62` 对 `selectedIndices` 全量迭代 | 大语段数时 UI 负担 |
| 24 | 脏检查 O(n) | `pages/useSegmentDirtyState.ts:56-60` 调用 `segmentsEqualForPersist`；`pages/segmentListHelpers.ts:83-104` 逐条比较所有字段 | 大项目时潜在性能问题 |
| 28 | 测试文件本身触发架构守卫警告 | 39 警告中仍含 6 个 `*.test.ts` 超过 300 行 | 警告噪音 |
| 34 | `pyproject.toml` 描述更新 | `services/asr/pyproject.toml:8` 仍为占位文案 | 低风险清理 |

---

## 四、关键回归 / 新风险汇总

| 风险 | 来源 | 建议 |
|------|------|------|
| 生产路径仍有非池化 SQLite 打开 | #7 修复 | 将 `diagnostic_db_sanitize.rs`、`diagnostic.rs`、`export_docx.rs` 的临时 DB 也显式配置 WAL/busy_timeout，或接入 pool |
| ~~项目删除反向孤儿状态~~（✅ 第三轮已解决） | #8 修复 | 已采纳「commit 提前到 storage 删除之前」：DB 提交后再 best-effort 清理，失败仅 WARN 日志 |
| 覆盖率阈值偏低且无 PR diff 门禁 | #25 修复 | 提升阈值或按模块设置；接入 Codecov / SonarQube PR comment |
| 环境能力协调器混合状态 | #4 部分修复 | v1.2 将 `registeredDeps`、`inflight`、`generation`、`lastFocusRefreshAt` 一并迁入 store |
| 结构化错误边界仍扁平化 | #9 部分修复 | 决定是否 v1.2 完整暴露错误码；若否，暂时统一字符串以减少维护分裂 |
| ASR 推理单 worker 未变 | #12 部分修复 | Nano/Qwen 等 SKU spike 时同步评估并发模型；若仍单线程，需在 UI 明确提示「长音频排队」 |
| ~~PyInstaller 跨平台仍受限~~（✅ 第三轮已解决） | #16 部分修复 | committed spec 已按 `platform.system()/machine()` 动态选择 ffmpeg 目录并处理 `.exe` 后缀；注：真实构建本就由 `build-asr-sidecar-*.sh` 用平台正确的 `$ffdir` 重新生成 spec |

---

## 五、下一步建议

1. **高优先级（可能影响 v1.1 稳定性）**
   - #1 `useProjectController` 拆分：至少将 ASR/转写相关字段拆出独立 controller。
   - #8 删除项目回滚优化：消除反向孤儿风险。
   - #7 统一 SQLite 连接配置：将诊断/导出等临时 DB 纳入 WAL/busy_timeout 配置。

2. **中优先级（v1.1 收尾或 v1.2）**
   - #3 文件/钩子阈值：持续拆分 mega-hook / mega-component。
   - #9 结构化错误：完成 Tauri 边界的错误码暴露。
   - #15 `ready_for_transcribe` 状态：结合侧车真实加载状态，减少文件探测误判。

3. **低优先级（技术债）**
   - #11 `pub use *` 显式化
   - #16 PyInstaller 平台动态化
   - #18 health 版本字段
   - #34 pyproject.toml 描述

---

## 六、验证命令

本次检查未修改代码，仅读取。机器守卫当前状态：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

- 上次执行结果：typecheck ✅ / test 278 files / 1374 tests ✅ / architecture guard 0 errors / 39 warnings ⚠️

---

## 七、修复轮次更新（2026-06-16 · 第三轮：实施）

本轮在第二轮复核基础上**落地实施**了一组外科级、低风险且边界清晰的修复（不涉及需先写调研 brief 的中等以上重构）。

| # | 项 | 本轮改动 | 验证 |
|---|----|----------|------|
| 8 | 项目删除反向孤儿 | `project_delete_cmd.rs`：改为 commit-first（`DELETE` → `tx.commit()` → best-effort `cleanup_deleted_project_storage`，失败仅 WARN）。恢复并复用带日志的 `cleanup_deleted_project_storage`；新增回归 `project_delete_commits_db_even_when_storage_cleanup_fails`（断言 DB 行已删 + 孤儿文件残留，验证无反向孤儿） | `cargo test project_delete_cmd::` ✅ / clippy ✅ / fmt ✅ |
| 16 | PyInstaller spec 平台 | `rushi-asr-sidecar.spec`：`platform.system()/machine()` 动态选 `darwin-arm64`/`darwin-x64`/`linux-x64`/`win-x64`，Windows 加 `.exe` 后缀 | `ast.parse` 语法 OK ✅ |
| 18 | health 缺版本字段 | `runtime_caps.py` 新增 `sidecar_version()`（`importlib.metadata`），`/health` 暴露 `version`；`test_health.py` 补断言 | `pytest tests/test_health.py` 6 passed ✅ |
| 34 | pyproject 占位描述 | `pyproject.toml` description 更新为真实文案 | — |

**仍未处理（需先写调研 brief，本轮未动）**：#1 `useProjectController` facade、#2 State/Ref 双轨、#3 文件/hook 阈值、#15 `ready_for_transcribe` 后端文件探测（前端 readiness 已在前序轮移除全局 fallback）、#17 参数 strip 静默降级。

**残留新风险（仍开放）**：#7 生产路径非池化 SQLite（`diagnostic_db_sanitize.rs`、`diagnostic.rs`、`export_docx.rs`）；#25 覆盖率阈值偏低且无 PR diff 门禁。

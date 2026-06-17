# 全量代码审查修复进度跟踪（2026-06-16）

> **基准报告**：[`full-code-review-architecture-comparison-report.md`](./full-code-review-architecture-comparison-report.md)  
> **范围**：对照基准报告 §7.1.3–§7.5.3、§9、§10 列出的问题/建议，检查当前修复进度与已修复项是否引入新问题。  
> **检查时间**：2026-06-16  
> **复查时间**：2026-06-17（第七轮，State/Ref S2.2b–S2.3b、#17 验收对齐、ASR 队列 UX、波形 scroll/playhead 修复）  
> **检查人**：Kimi Code CLI / Cursor Agent

---

## 总体进度

| 状态 | 数量 | 占比 |
|------|------|------|
| 已修复 | 27 | 82% |
| 部分修复 | 6 | 18% |
| 未修复 | 0 | 0% |
| **合计** | **33** | 100% |

> 注：基准报告 §7 与 §10.6 中 `#9`/`#30`（Rust 错误处理结构化）和 `#10`/`#31`（Windows 8741 清理）为同一问题重复出现，已合并去重。`#3` 与 `#28` 已随架构守卫规则调整与实际拆分解决，分别计入已修复。  
> **#2** 与 **#12 吞吐** 归入「部分修复」：前者 S2.1–**S2.5a** 已收敛全部业务 consumer 至 snapshot getter；**S2.5b** state-only / 移除 public `segmentsRef` 未做；后者 C1 队列 UX 已落地，多 worker 仍单线程。

---

## 一、已修复项（27 项）

| # | 标题 | 关键证据 | 是否引入新问题 |
|---|------|----------|----------------|
| 1 | `useProjectController` 巨型 facade | `useProjectController.ts` 从 322 行降至 **63 行**；字段拆到 `projectLifecycleControllerFields.ts` 与 `useProjectAsrBridgeStack.ts` | 否 |
| 3 | 40 个文件超过 300 行 / 12 hooks 阈值 | 架构守卫当前 **0 警告**：>300 行文件与 >12 hooks 的生产代码告警已清空 | 否 |
| 4 | `environmentCapabilityCoordinator` 模块级 singleton | 全部状态迁入 Zustand `createModuleStore`：`snapshot`、`registeredDeps`、`inflight`、`generation`、`lastFocusRefreshAt` 均在 store 中 | 否 |
| 5 | 无 React Context，依赖 controller prop 传递 | 新增 `context/WorkspaceSidebarCollapseContext.tsx`，首个 React Context 已落地 | ⚠️ 仅在 workspace 侧边栏折叠场景使用，未替代项目级 prop drilling |
| 6 | 同步命令直接阻塞 IO | `segment_cmd.rs`、`project_create_cmd.rs`、`export_cmd.rs` 已改为 `async fn` + `spawn_blocking` | 否 |
| 7 | 无 WAL + 无连接池 | 新增 `db/pool.rs`，启用 `r2d2` 连接池、`journal_mode=WAL`、`busy_timeout=5000` | ⚠️ 诊断/导出等临时 DB 仍有独立 `Connection::open` |
| 8 | 删除项目后磁盘清理失败不回滚 | `project_delete_cmd.rs` 已事务化：先 `DELETE`、再 `remove_project_storage_dir`、最后 `tx.commit()` | ⚠️ storage 删除成功但 `tx.commit()` 失败会产生反向孤儿状态 |
| 10/31 | Windows 无法自动清理 8741 占用进程 | `asr_sidecar/bundled/port.rs` 已实现 Windows PowerShell 清理 | 否 |
| 11 | `pub use *` 汇总增加符号泄露 | `project/mod.rs` 的 `pub use ...::*` 已大幅减少，只剩 3 行显式导出 | 否 |
| 13 | 上传文件全量读入内存 | `app.py:53-79` 改为分块流式写入，`_MAX_UPLOAD_BYTES=512MB` | 否 |
| 14 | 分窗边界无重叠/上下文 | `transcribe_windows.py` 增加 `DEFAULT_WINDOW_OVERLAP_SEC=2.0`、`plan_windows`、`trim_window_prefix_overlap` | 否 |
| 16 | PyInstaller spec 使用绝对路径 | `rushi-asr-sidecar.spec` 已改用 `SPEC_DIR` 相对路径 + `_ffmpeg_platform_dir()` 动态选择平台 | 否 |
| 17 | 参数 strip 回退隐藏模型不兼容 | [`asr_model_profile.py`](../../../services/asr/rushi_asr/asr_model_profile.py) `filter_generate_kwargs_for_model()` 按 SKU family 预过滤；过滤时 `funasr_generate_param_filtered:{key}`；[`funasr-param-capability-acceptance.md`](./funasr-param-capability-acceptance.md) 验收通过。`funasr_engine.py` 保留 TypeError strip **为 acceptance 明确的兼容 fallback**（非 silent：有 warn） | 否 |
| 18 | 健康端点未返回侧车版本 | `runtime_caps.py:74` 返回 `"version": sidecar_version()`；`test_health.py` 已覆盖 | 否 |
| 19 | `peakCacheGeneration` 触发 WaveSurfer 整实例 remount | `useProjectWaveformMount.ts` mount effect 已移除 `peakCacheGeneration`；拆出 `projectWaveformMountSupport.ts` | 否 |
| 20 | `mountRefs` 对象每次渲染重建 | `useProjectWaveform.ts` 已用 `useMemo` 缓存 `mountRefs` | 否 |
| 22 | 大范围多选让 overlay 退化为全量 DOM | `waveformSegmentOverlayVisibility.ts` 增加 `MAX_DOM_OVERLAY_SPARSE=32`；大范围选择只渲染首尾/边界 | 否 |
| 23 | 播放中 peaks 热切换有间隙风险 | `waveformZoomSyncEngine.ts` 保存/恢复播放时间，显著降低间隙 | 否 |
| 25 | 无覆盖率收集与门禁 | `vitest.config.ts` 配置 thresholds；CI 运行 `test:coverage`；新增 `codecov.yml` patch target 80% | 否 |
| 26 | lint-staged 对全量文件跑 `tsc --noEmit` | `lint-staged.config.mjs` 仅对 staged 文件跑 ESLint | 否 |
| 27 | Playwright E2E 依赖真实 ASR 服务 | `test:e2e:asr` 使用 `asr-mock-server.mjs`（`PW_ASR_MOCK_WEBSERVER=1`）；CI ASR contract E2E 不再依赖真实侧车 | 否 |
| 21 | `WaveformSegmentBandCanvas` live drag 频繁重建事件监听 | `WaveformSegmentBandCanvas.tsx:82-153` 的 listener effect 依赖已拆分为 `[tierScrollRef, tierScrollLayout.clientWidthPx]`；`segments`/`durationSec` 等可变数据移到第二个 effect 只触发 `schedulePaintRef.current?.()`，不再拆装 listener | 否 |
| 28 | 测试文件本身触发架构守卫警告 | `check-architecture-guard.mjs:30-36` 已豁免测试文件的 line/hook 阈值，消除噪音 | 否 |
| 32 | 诊断包 JSON 脱敏改进 | `diagnostic_db_sanitize.rs` 扩展 redaction，新增单元测试 | 否 |
| 33 | 移除 `services/fixtures/` 空目录或补充说明 | 目录已不存在 | 否 |
| 34 | `pyproject.toml` 描述更新 | `pyproject.toml:8` 已更新为准确描述 | 否 |

### 已修复项中需要关注的新问题

1. **生产路径仍有非池化 SQLite 打开**：`diagnostic_db_sanitize.rs`、`diagnostic.rs`、`export_docx.rs` 仍有独立 `Connection::open`，未统一接入 `DbPool` 的 WAL/busy_timeout 配置。
2. **项目删除反向孤儿风险**：`project_delete_cmd.rs` 在 storage 删除成功但 `tx.commit()` 失败时，会留下 DB 记录但文件已删除。
3. **覆盖率 global threshold 偏低**：`vitest.config.ts` 中 global threshold 为 statements 45 / branches 35 / functions 35 / lines 45，防止回归作用有限（但 `codecov.yml` patch target 80% 已补 PR diff 门禁）。
4. **Context 使用范围有限**：首个 Context 仅解决 workspace 侧边栏折叠，未推广到项目/主题等更广的 prop drilling 场景。

---

## 二、部分修复项（6 项）

| # | 标题 | 已做 | 未做 / 遗留风险 |
|---|------|------|-----------------|
| 2 | State/Ref 双轨制 | **S2.1–S2.5a 已落地**：全部业务 consumer 改 `getCurrentSegmentsSnapshot()`；publish functional updater；guard 禁止 consumer 直接读 `segmentsRef.current`。`useProjectEditorState` 仍维护 `segments` + `segmentsRef` **并存** | **S2.5b**：从 lifecycle API 移除 `segmentsRef` 暴露；publish state-only 终态 |
| 9/30 | 错误信息全部扁平化为 String / Rust 错误处理结构化 | 新增 `command_error.rs`（`thiserror` 枚举 + `error_code()` + `CommandErrorDto`）；前端 `commandError.ts` 可解析 DTO；`export_cmd.rs`、`project_metadata_cmd.rs`、`project_delete_cmd.rs` 等已迁移 | 全仓库仍有约 205 处 `Result<..., String>`，仅约 23 处引用 `CommandErrorDto`；多数 Tauri handler 仍返回 `String` |
| 12 | ASR 单线程推理执行器 + 全局模型锁 | `inference_queue.py` 单 worker FIFO；**C1 队列 UX** 已落地（[`funasr-queue-ux-acceptance.md`](./funasr-queue-ux-acceptance.md)）：`/health` 暴露 pending/running/max_workers；桌面环境页「前方 N 个任务排队 · 正在推理 M 个任务」 | **`inference_max_workers: 1` 未变**；`funasr_engine.py` `_runtime_lock` 仍在；**吞吐未提升**（[`funasr-concurrency-research.md`](./funasr-concurrency-research.md) C2+ 未启动） |
| 15 | `ready_for_transcribe` 基于文件探测 | `runtime_caps.py` 仍基于文件缓存探测，但新增 `model_loaded_in_memory`、`model_memory_matches_config`、`selected_model_ready` 等更精确字段 | `ready_for_transcribe` 本身仍由 `required_models_cached` + `ffmpeg_on_path` 决定，未完全改为真实加载状态 |
| 24 | 脏检查 O(n) | `useSegmentDirtyState.ts:61` 已增加 `segmentsPersistSignature` fast path：signature 相同则跳过逐条比较；新增 `corePerformance.perf.ts` 性能测试 | 最坏情况仍是 O(n) 逐条比较；未引入 version/hash 机制 |
| 29 | Vitest 配置极简 | 主配置已扩展 coverage reporter、thresholds、include/exclude；新增独立的 `vitest.perf.config.ts` 用于性能测试 | 仍缺少 shard/retry 等高级 CI 配置 |

### 部分修复项中需要关注的新问题

1. **结构化错误迁移覆盖率低**：基础设施已就绪，但大部分命令文件未迁移。建议后续按模块分批替换 `Result<..., String>`。
2. **ASR 推理吞吐未实质改善**：C1 队列 UX 已让用户可见排队；单 worker + `_runtime_lock` 仍为设计决策，多 worker 须单独 spike（见 `funasr-concurrency-research.md` C2+）。
3. **`ready_for_transcribe` 语义仍可能误判**：虽然增加了内存状态字段，但 UI 若仍消费 `ready_for_transcribe` 全局字段，可能在模型未真实加载时误判。
4. **State/Ref 双轨未终态**：S2.4b 后 find/replace、transcribe、stage B 已 snapshot 化；export / correction rules 等仍读 ref；state-only 发布未做。
5. **脏检查 fast path 依赖字段全量 fingerprint**：`segmentsPersistSignature` 仍需遍历所有语段生成字符串，只是比逐字段比较便宜；超大项目仍可能受限。

---

## 三、未修复项（0 项）

当前无「完全未启动」的基准项。#2（State/Ref）与 #12 吞吐见 §二；其余高优先级债务均在部分修复或已修复中跟踪。

---

## 四、关键回归 / 新风险汇总

| 风险 | 来源 | 建议 |
|------|------|------|
| 生产路径仍有非池化 SQLite 打开 | #7 修复 | 将诊断/导出临时 DB 纳入 pool 或显式配置 WAL/busy_timeout |
| 项目删除反向孤儿状态 | #8 修复 | 将 `tx.commit()` 提前到 storage 删除之前，或做异步孤儿扫描 |
| 覆盖率 global threshold 偏低 | #25 修复 | 提升 vitest thresholds 或依赖 codecov patch 80% 门禁 |
| 结构化错误迁移覆盖率低 | #9/30 部分修复 | 制定模块迁移计划，分批替换 `Result<..., String>` |
| ASR 推理单 worker 未变（吞吐） | #12 部分修复 | C1 UX 已提示排队；C2 多 worker 须 research spike 后再定 |
| State/Ref S2.5 未完成 | #2 部分修复 | export / correction rules / delete confirm snapshot 化；最终 state-only 发布 |
| `ready_for_transcribe` 仍可能误判 | #15 部分修复 | UI 逐步切换到 `selected_model_ready` 等更精确字段 |
| 脏检查 fast path 仍线性 | #24 部分修复 | 超大项目时考虑引入 immutable version 或 segment-level dirty flag |
| Context 推广不足 | #5 修复 | 评估项目/主题/错误边界等场景是否值得引入更多 Context |

---

## 五、下一步建议

1. **高优先级（v1.1 收尾）**
   - #2 State/Ref **S2.5**：剩余 consumer snapshot 化 + state-only 发布（S2.1–S2.4b 已完成，见 acceptance）。
   - #9/30 结构化错误：完成剩余命令文件的迁移，释放 i18n/遥测收益。
   - #15 `ready_for_transcribe`：彻底改为真实加载状态驱动。

2. **中优先级（v1.2 或持续）**
   - #12 ASR **C2 多 worker**：仅在 spike 证明模型/内存可行后启动（research 已写，勿跳过）。
   - #24 脏检查 O(n)：引入 version/hash 机制，替代 fingerprint 遍历。

3. **低优先级（技术债）**
   - #5 React Context：当前仅在 workspace 侧边栏使用，可延后评估更大范围推广。
   - #29 Vitest shard/retry：CI 时间恶化时再加。
   - #17 TypeError strip fallback：**仅当** acceptance 修订为「硬失败」时再移除；当前为有意保留。

---

## 七、本轮代码变更摘要（2026-06-17）

- **#2 State/Ref**：S2.4b find/replace + transcribe + stage B snapshot 读 + guard 扩展；acceptance S2.1–S2.4b 已勾选。此前：S2.4a publish updater、S2.2b–S2.3b save/undo/time/bounds。
- **#17**：profile-first 参数过滤 + acceptance；TypeError strip 保留为 documented fallback。
- **#12 C1**：ASR 推理队列深度文案（环境页）；[`funasr-queue-ux-acceptance.md`](./funasr-queue-ux-acceptance.md) 已勾选。
- **#21**：`WaveformSegmentBandCanvas` listener / paint effect 分离（此前轮次）；本轮补充 tier wheel-forward（触控板 deltaY→横向）与 segment band mirror paint。
- **波形播放头**：隐藏 WS shadow DOM cursor；视口 playhead 改 saffron 90%；minimap playhead 改 `zen-saffron-mid`。
- 测试：desktop **280 files / 1398 tests**（分支 `cursor/funasr-param-capability-queue-ux` 门禁快照）。

---

## 六、验证命令

本次检查更新了进度文件，未修改业务代码。机器守卫当前状态：

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

- 本次执行结果（2026-06-17）：typecheck ✅ / test **280 files / 1398 tests** ✅ / architecture guard **0 errors / 0 warnings** ✅

# Rushi v1.0.0 发布前全量代码审查报告

> 审查日期：2026-07-15  
> 基准分支：`main` @ `7adada6`  
> 审查范围：13 轮纵向主题审查中的 R1/R3/R4/R6/R8/R11（数据一致性、原生音频/波形、DOCX 导出、自动更新/密钥、Tauri 安全、CI/CD Release），并复核 2026-06 修复方案台账  
> 审查方法：继承 2026-06-06 全量审查的「纵向主题轮次」方法，每轮覆盖 TS/React + Rust Tauri + Python ASR（若涉及），对照 AGENTS.md / CONTEXT.md / architecture / ADR 约束，检查测试覆盖与边界条件

---

## 1. 执行摘要

| 类别 | 数量 | 说明 |
|---|---|---|
| **P0 — 分发阻塞** | 1 | Release 签名 secrets 未配置，本地构建产物未签名 |
| **P1 — 安全/数据/稳定性** | 12 | 文件 move 事务一致性、原生音频 race/线程安全、DOCX 内存/批注嵌套、Tauri 粗粒度 capability/loopback 代理、CSP connect-src 过宽、macOS 密钥文件默认存储 |
| **P2 — 架构/可维护性** | 14 | 大文件/大 hook、测试覆盖缺口、代码卫生、CI 操作细节 |
| **P3 — 体验/文档** | 4 | 时区、文案、密钥轮换流程等（另 1 条 capability 冗余为误报，见 §9.1） |
| **已修复（本次审查中）** | 1 | `export_docx_polish_track_write.rs` clippy `too_many_arguments` 告警 |

**机器闸门当前状态**：

| 检查项 | 结果 |
|---|---|
| `npm run typecheck` | ✅ 通过 |
| `npm run test` | ✅ 2464 tests passed / 441 files |
| `npm run lint` | ⚠️ 32 warnings（全为 exhaustive-deps / no-console） |
| `cargo test --lib` | ✅ 484 passed |
| `cargo clippy --all-targets -- -D warnings` | ✅ 通过（已修复 1 处 too_many_arguments） |
| `node scripts/check-architecture-guard.mjs` | ⚠️ 0 errors / 44 warnings |
| `git status` | ✅ clean |

**关键结论**：
- 机器闸门除 lint 与架构 warning 外已全部通过，基础质量较好。
- 最大新风险来自 **原生音频播放引擎**（CPAL + Symphonia，775 行跨线程状态机，单测严重不足）与 **项目文件 move 的数据一致性**（磁盘先搬、DB 后提交且无回滚）。
- **DOCX 导出**的 P1 债务（内存构建、批注范围嵌套、`settings.xml` 字节级补丁）仍未完全关闭。
- **Tauri 安全面**的 capability 粗粒度问题与 ASR loopback 通用代理仍是 P1，与 6 月审查结论一致。
- **Release 签名**是 v1.0.0 分发前的最后阻塞项：需配置 `APPLE_*` / `WINDOWS_*` secrets 并跑一次 signed tag release 验证。

---

## 2. 基线闸门与修复动作

本次审查开始时跑通全部机器闸门，并立即修复一处 Rust clippy 阻断：

- `apps/desktop/src-tauri/src/export_docx_polish_track_write.rs:215`：`append_polished_with_track_changes` 9 个参数触发 `clippy::too_many_arguments`。已按仓库既有模式添加 `#[allow(clippy::too_many_arguments)]`，clippy 现全绿。

其余基线状态见上表。

---

## 3. 逐轮审查发现

### R1 — 项目/文件生命周期与数据一致性 ⭐⭐⭐

**已审文件**：
- `apps/desktop/src-tauri/src/project/file_cmd.rs`
- `apps/desktop/src-tauri/src/project/project_storage.rs`
- `apps/desktop/src-tauri/src/project/file_import_cmd.rs`
- `apps/desktop/src-tauri/src/project/file_name_unique.rs`
- `apps/desktop/src-tauri/src/project/audio_container_normalize.rs`
- `apps/desktop/src/pages/useProjectFileMutationController.ts`
- `apps/desktop/src-tauri/src/project/cmd_integration_tests.rs`

| 等级 | 问题 | 位置 | 说明 | 修复方向 |
|---|---|---|---|---|
| **P1** | **move_file_to_project_inner：磁盘搬迁成功后 DB 事务失败不会回滚** | `file_cmd.rs:178-210` `project_storage.rs:30-104` | `relocate_file_storage_between_projects` 先移动 peaks/音频，随后才执行 `tx.commit()`。若 DB 事务失败（锁、约束错误），音频已搬到目标项目目录，但 `files` 行仍指向源项目旧路径，形成反向孤儿 | 将文件系统搬迁包装为可回滚操作；DB 失败时把 peaks/音频从目标目录迁回源目录，或改为 DB 事务成功后再执行原子文件系统操作；补充失败回滚测试 |
| **P1** | **唯一文件名检查在事务外且无 DB UNIQUE 约束，并发操作可能产生同名文件** | `file_cmd.rs:73, 174-175, 285-286` `file_name_unique.rs:5-25` | `unique_file_name` / `name_taken` 通过 `SELECT 1 FROM files WHERE name = ?` 判断，但 `files.name` 没有 `UNIQUE` 约束。两个并发 move/copy/rename 可能同时通过检查并提交相同名称 | 给 `files.name` 添加 `UNIQUE` 约束；或在事务内使用 `INSERT` 失败重试机制生成新名字 |
| **P2** | **relocate_file_storage_between_projects 部分移动 peaks 后音频失败不会回滚已迁移 peaks** | `project_storage.rs:43-101` | peaks 各级别依次 rename/copy+remove；若后续音频 rename/copy 失败并返回 Err，前面已成功迁移到目标项目的 peaks 文件不会被撤销 | 在搬迁函数内部维护“已写入目标目录的文件清单”，任何后续步骤失败时清理目标目录中该 `file_id` 对应的 peaks/音频 |
| **P2** | **reveal_file_in_file_manager 直接使用 DB 中的 audio_path，未做应用根目录校验** | `file_cmd.rs:473-476` | 若 `files.audio_path` 被污染或是指向应用数据根之外的符号链接，`is_file()` 会跟随 symlink，可能 reveal 外部文件 | 调用 `resolve_audio_path_under_root` 对路径做 `canonicalize + strip_prefix` 校验；失败时回退到打开项目目录 |
| **P2** | **dest_exists 检查使用 `unwrap_or(false)`，数据库错误被误报为“目标项目不存在”** | `file_cmd.rs:147-156, 235-244` | `query_row(...).unwrap_or(false)` 会同时吞掉非 `QueryReturnedNoRows` 的 rusqlite 错误（如磁盘 IO 错误） | 区分 `QueryReturnedNoRows` 与其它 `SqliteFailure`，前者返回“目标项目不存在”，后者透传真实 DB 错误 |
| **P2** | **delete_file 提交后才清理存储；清理失败仅产生孤儿文件** | `file_cmd.rs:120-128` `project_storage.rs:16-26` | `cleanup_deleted_file_storage` 只删除 audio 和 peaks。未来若增加文件级派生数据不会自动被清理 | 明确文件生命周期涉及的全部派生存储清单，统一清理或文档说明由后台 GC 处理 |
| **P2** | **copy_file_to_project_inner 回滚仅清理 audio 与 peaks，不清理可能已部分写入的其它文件** | `file_cmd.rs:429-432` | 若 `copy_file_storage_between_projects` 在复制 peaks 过程中某些级别已写入目标目录、后续音频复制失败，`cleanup_deleted_file_storage` 可能残留孤立文件 | 让复制函数返回“已写入目标目录清单”，失败时按清单精确清理；补充磁盘失败触发完整清理的集成测试 |
| **P3** | **目标项目目录构造后未统一 canonicalize/relative_to 校验** | `project_storage.rs:39-40, 90, 118-119, 157` | 直接对 `project_storage_dir` 做 `create_dir_all`/`join`，未在操作前 canonicalize 目标目录 | 在写入前对构造的目标路径 `canonicalize` 并与 `canonicalize(root)` 做 `strip_prefix` 校验 |
| **P3** | **cmd_integration_tests.rs 缺少关键边界场景覆盖** | `project/cmd_integration_tests.rs` | 现有测试覆盖正常 move/copy/rename/delete，缺少：move 成功后 DB 事务失败的回滚、外部/非管理音频路径 move/copy、源音频文件缺失、目标项目目录为符号链接、磁盘复制失败后文件清理 | 补充上述边界集成测试 |
| **P3** | **useProjectFileMutationController.ts 操作失败后缺少 UI 状态恢复** | `file_cmd.rs:103-113, 206-214` | `runMove` 先关闭已打开文件再调用后端；若后端失败，前端仅 `setError`，未重新刷新源/目标项目列表 | 在 catch 块中调用 `refreshAfterPlacement(sourceProjectId, destProjectId)` 或至少刷新相关项目 |

---

### R3 — 编辑器/波形/原生音频 ⭐⭐⭐⭐

**已审文件**：
- `apps/desktop/src-tauri/src/native_audio/{engine.rs,decode.rs,output.rs,clock.rs,commands.rs,types.rs,events.rs}`
- `apps/desktop/src/services/waveform/transport/nativeAudioPlaybackTransport.ts`
- `apps/desktop/src/hooks/useWaveformSegmentPlaybackControls.ts`
- `apps/desktop/src/hooks/useWaveformTimelineController.ts`
- `apps/desktop/src/hooks/useWaveformSegmentPlaybackBoundSync.ts`
- `apps/desktop/src/hooks/useProjectWaveform.ts`
- `apps/desktop/src/hooks/useTierScrollSync.ts`

| 等级 | 问题 | 位置 | 说明 | 修复方向 |
|---|---|---|---|---|
| **P0** | **native audio 核心循环几乎没有单元测试** | `native_audio/engine.rs:303-760` `decode.rs:139-344` `output.rs:28-187` | 只测了 `probe_duration_sec`、serde、输出 sanitize；对 `decode_loop` 的 seek/EOF/重采样、`write_output` 的时钟推进与 drain、`engine_main` 的设备重建路径均无覆盖 | 增加 fixture/确定性测试：用内存 producer/consumer 模拟输出回调，验证 drain、seek_seq、EOF、重建后 state 一致性 |
| **P0** | **`decode_loop` 线程 spawn 失败被 `.ok()` 静默丢弃** | `native_audio/engine.rs:336-349` | 若解码线程创建失败，`prod` 被移入未运行的 closure，ring 无数据产出；输出端会持续 underrun，用户只会看到间接错误 | 将 `thread::spawn` 的 `Result` 显式处理，spawn 失败时 `emit(Error)` 并退出 `engine_main` |
| **P1** | **跨线程原子序混用，多处关键 flag 用 `Relaxed`** | `native_audio/clock.rs:49-58` `engine.rs:370-461` `output.rs:110-184` | `playing`/`play_requested`/`at_eof`/`underrun` 等在 engine、decode、CPAL callback 三个线程间读写，大量使用 `Relaxed`，无法保证 happens-before | 统一跨线程 flag 为 `SeqCst` 或成对 `Acquire/Release`，并在模块注释中说明 memory model |
| **P1** | **EOF / Ended 判定存在三处真源，且含魔法阈值 0.02s** | `engine.rs:735` `decode.rs:253-272` `output.rs:178-184` | decode、output callback、engine main 都能设置 `at_eof` 与停止播放；`pos >= dur - 0.02` 会提前触发 Ended，而 output callback 与 decode 的 EOF 信号可能不同步 | 以“output callback 消费完最后一个样本”为单一 EOF 真源；删除 0.02s 提前阈值 |
| **P1** | **`native_audio_stop` 同步 join 引擎线程并持有 state Mutex** | `native_audio/commands.rs:102-106` `engine.rs:170-178` `engine.rs:35-72` | `#[tauri::command] pub fn native_audio_stop` 在主线程执行，内部 `PlayerHandle::stop` 会 join engine/decode 线程；若 CPAL 回调卡住，UI 将被阻塞 | 将 stop 改为 async 或在独立线程执行 join，避免在 Tauri 主线程持有锁并等待音频线程 |
| **P1** | **`decode.rs` 多处硬编码魔数未命名** | `decode.rs:60, 181, 218, 329, 335` | `0.02` 秒启动 seek 阈值、`out_channels * 256` 空闲判断、`drop_n > 2048`、`48_000 * 2` pending 上限、`1024` 最小预缓冲等均为魔法数 | 提取为具名常量并附注释 |
| **P2** | **`engine.rs` 超出架构守卫单模块 600 行阈值** | `native_audio/engine.rs`（775 行） | `check-architecture-guard.mjs` 已报 warning；`engine_main` 内嵌设备重建、重试、underrun 处理、stalled 检测等多个职责 | 将 rebuild/retry/underrun 逻辑拆分为独立模块，保持 `engine_main` 为状态机调度器 |
| **P2** | **前端多个 waveform hook 超出 300/400 行与 hook 数阈值** | `useWaveformTimelineController.ts` 401 行 `useWaveformSegmentPlaybackBoundSync.ts` 437 行 `useWaveformSegmentPlaybackControls.ts` 345 行 `useTierScrollSync.ts` 330 行 `nativeAudioPlaybackTransport.ts` 426 行 | 架构守卫均已报 warning；大 hook 增加了 stale closure、依赖遗漏和 review 难度 | 按职责拆分为更小 hook |
| **P2** | **`nativeAudioPlaybackTransport` emit 可能在迭代 Set 时修改 listeners** | `services/waveform/transport/nativeAudioPlaybackTransport.ts:109-111` | `for (const h of listeners) fn(h);` 期间若某个 handler 调用 `unsubscribe()`，会修改正在迭代的 Set | 发射前复制为数组：`[...listeners].forEach(fn)` |
| **P2** | **输出回调把正常 EOF/最后一帧缺样本也标记为 underrun** | `native_audio/output.rs:168-169` | 只要任一 channel 未 pop 到样本就 `clock.underrun.store(true)`，文件播放到末尾或重建 drain 末期会误报，触发 engine 重建路径 | 仅在 `playing && !clock.at_eof && !drain_pending` 时设置 underrun；区分正常 drain 与真正的 underrun |
| **P2** | **segment end-bound / frozen skip 逻辑无独立单测** | `hooks/useWaveformSegmentPlaybackBoundSync.ts:60-436` | 包含 0.1s/0.05s 阈值、generation 匹配、loop replay 等复杂状态，但没有对应 `*.test.ts` | 增加 `useWaveformSegmentPlaybackBoundSync.test.ts`，用 mock host 覆盖 end-bound 命中、重入、generation 失效、loop 重启 |
| **P2** | **前端存在多处未集中化的魔法常数** | `nativeAudioPlaybackTransport.ts:22-37` `useWaveformSegmentPlaybackBoundSync.ts:157/289` `useWaveformTimelineController.ts:38/188/265` | 这些阈值直接影响播放头平滑、滚动与 end-bound 行为，散落各处难以统一调校 | 将阈值集中到 `apps/desktop/src/config/tokens.ts` 或波形专用常量文件 |
| **P3** | **`EventEmitter` 静默丢弃发送失败的事件** | `native_audio/events.rs:16-18` | `let _ = self.channel.send(event);` 在 Channel 背压或前端未就绪时会丢失事件 | 对 `send` 返回值做 `if let Err(e) = ... { eprintln!(...) }` 或增加 trace 计数 |

---

### R4 — 导出/DOCX/批注/修订轨 ⭐⭐⭐

**已审文件**：
- `apps/desktop/src-tauri/src/export_docx.rs`
- `apps/desktop/src-tauri/src/export_docx_body.rs`
- `apps/desktop/src-tauri/src/export_docx_build.rs`
- `apps/desktop/src-tauri/src/export_docx_polish_track_write.rs`
- `apps/desktop/src-tauri/src/export_docx_polish_track_diff.rs`
- `apps/desktop/src/pages/useExportController.ts`
- `apps/desktop/src/services/exportFormatters.ts`

| 等级 | 问题 | 位置 | 说明 | 修复方向 |
|---|---|---|---|---|
| **P1** | **修订轨导出全量加载 DOCX 到内存，存在 OOM 风险** | `export_docx_build.rs:108-118` `export_docx_polish_track_write.rs:392-423` | `build_docx_to_path` 写入文件后，为满足修订轨会重新 `std::fs::read(path)` 整份 DOCX；`inject_track_revisions_flag` 也先把整份字节读进 `Vec<u8>`。大项目时内存会翻倍 | 先写入临时文件，使用流式 zip 重写；或在 `docx-rs` 打包阶段直接构造 `Settings` 写 `trackRevisions`，避免二次读盘 |
| **P1** | **同一段落多个批注生成非嵌套/交叉的 `commentRange`** | `export_docx_body.rs:284-313` | `build_body_paragraph_with_comments` 先依次 `add_comment_start(id1/id2/…)`，再按相同顺序 `add_comment_end(id1/id2/…)`，得到 `start1 → start2 → text → end1 → end2`，不是合法嵌套顺序。Word/WPS 打开时可能只显示第一条批注或提示修复文档 | 改为嵌套结束顺序（后开始的先结束），或将每条备注独立包裹在单独的 run/段落内 |
| **P1** | **`settings.xml` 修订开关采用脆弱字符串替换** | `export_docx_polish_track_write.rs:357-389` | `patch_settings_track_and_markup` 用精确字符串替换 `<w:trackRevisions w:val="false"/>` 等；一旦 `docx-rs` 输出格式变化（空格、换行、自闭合写法）就无法匹配 | 使用 XML reader/writer 修改 `w:settings`，或在 `docx-rs` 打包前通过 Settings API 设置 |
| **P1** | **缺少大工程压力/兼容性测试** | `export_docx.rs:902-987` | 现有测试都是小数据；R9 strict 只测 `clean` 无批注/无修订轨；没有 >2M 字符、大量批注、长段 diff 的集成测试 | 补充大文本 fixture / property-based 测试，覆盖内存占用、char_budget 命中、批注与修订轨共存场景 |
| **P1** | **XML 转义完全依赖 `docx-rs` 内部实现，缺少防御性测试** | `export_docx_body.rs:35-37` `export_docx_body.rs:68-71` | `sanitize_docx_text` 仅删除非法控制字符，不转义 `&<>"`；虽然 `docx-rs` 会做 escape，但项目里没有针对特殊字符的单元测试，升级依赖后易漏 | 增加对 `&<>"`、模型名作者、批注内容的生成后 XML 断言测试；必要时在传入前显式 XML escape |
| **P2** | **文件写入非原子，崩溃会留下损坏 DOCX** | `export_docx_build.rs:92-118` | 先 `File::create(path)` 写入，再 `read → patch → write` 直接覆盖原路径；若进程在第二次写入时中断，用户得到不完整文件 | 先生成 `.tmp` 临时文件，最终 `std::fs::rename` 覆盖目标路径 |
| **P2** | **修订轨段落截断逻辑与真实输出不一致** | `export_docx_polish_track_write.rs:296-313` | `char_budget` 按 `chunk`（已截断文本）扣减，但当 `pieces_have_markup` 为 true 时实际输出的是完整 `bucket`（含未截断的 ins/del），可能突破 `MAX_LECTURE_BODY_CHARS` | 截断判定应以 `paragraph_from_diff_pieces_with_comments` 实际输出长度为准，或在截断时同步截断 bucket |
| **P2** | **ZIP 重写丢失额外元数据** | `export_docx_polish_track_write.rs:399-418` | `inject_track_revisions_flag` 只保留 `compression_method`，未保留时间戳、extra field、内部顺序等 | 使用 `zip::ZipWriter` 的 raw copy 接口或记录并恢复原始 `ZipFile` 元数据 |
| **P2** | **`recordingFileName` 传入的是导出上下文标签而非真实录音文件名** | `useExportController.ts:232-238` | `recordingFileName: exportContextLabel()` 把“当前打开文件/项目名”作为“录音文件名称”写入 DOCX 文末 | 从 `current` 或音频文件路径中解析真实录音文件名传入，或重命名字段含义 |
| **P3** | **批注/修订日期使用 UTC** | `export_docx_body.rs:206-208` `export_docx_polish_track_write.rs:24-26` | `annotation_comment_date` / `polish_revision_date` 使用 `chrono::Utc::now()` 并格式化为 `Z` 结尾；Word 批注栏会显示 UTC 时间 | 使用用户本地时区（如 `chrono::Local`）生成 ISO 8601 带偏移时间 |
| **P3** | **长语段 LCS diff 退化为单区间** | `export_docx_polish_track_diff.rs:205-213` | `diff_edit_ops` 在 `n*m > 2_500_000` 时退化为前缀/后缀单区间删除/插入；长口述段落中分散的错字无法标出 | 改用 Myers 差分或分块 LCS，保留小修订精度同时控制内存 |

---

### R6 — 环境/设置/自动更新/密钥 ⭐⭐⭐

**已审文件**：
- `apps/desktop/src/services/appUpdate.ts`
- `apps/desktop/src/hooks/useAppUpdateCheckOnLaunch.ts`
- `apps/desktop/src-tauri/src/secret_store_policy.rs`
- `apps/desktop/src-tauri/src/postprocess_secret_store.rs`
- `apps/desktop/src/components/AppUpdateConfirmDialog.tsx`

| 等级 | 问题 | 位置 | 说明 | 修复方向 |
|---|---|---|---|---|
| **P1** | **macOS API Key 默认文件存储，与 2026-06-12 产品决策 A 漂移** | `secret_store_policy.rs:15-31` | 注释明确“Keychain login prompts are disabled on macOS”，`use_keyring_store()` 在 macOS 上永远返回 `false`。Windows/Linux 默认使用 keyring | 重新评估 macOS keyring 策略：若坚持文件存储，需更新 ADR/修复方案并记录决策变更；若恢复 keyring，需解决登录提示问题 |
| **P1** | **自动更新下载安装无二次完整性校验** | `appUpdate.ts:92-95` | `downloadAndInstallAppUpdate` 直接 `await update.downloadAndInstall(); await relaunch();`，依赖 Tauri updater 内部签名验证，失败时只有字符串启发式匹配 | 在 `downloadAndInstall` 前后增加显式日志/校验回调；对签名失败做明确用户提示；考虑在 CI 中对 `latest.json` + `.sig` 做签名校验 |
| **P2** | **后台每小时轮询可能打扰用户** | `useAppUpdateCheckOnLaunch.ts:87-89` | 启动检查通过后设置 1 小时 interval，长期挂后台时可能在用户未操作时弹窗 | 增加“勿扰”时段或仅在前台活跃时弹窗；后台检查失败不 toast |
| **P2** | **`RUSHI_LLM_SECRET_FORCE_FILE` 环境变量可强制所有平台落盘** | `secret_store_policy.rs:3-5` | 无文档说明该环境变量的安全风险；用户若被诱导设置该变量，会导致密钥以文件形式存储 | 在文档/注释中明确标注该变量仅用于调试或 headless CI；或增加启动日志警告 |
| **P3** | **Windows 密钥文件 ACL 设置依赖 `icacls` 外部命令** | `postprocess_secret_store.rs:133-147` | 若 `icacls` 不存在或返回非预期错误，会抛出异常但密钥已写入磁盘 | 写入前检查 `icacls` 可用性；失败时删除已写入文件并返回错误 |
| **P3** | **AppUpdate 错误映射依赖字符串匹配，脆弱** | `appUpdate.ts:55-73` | `mapAppUpdateError` 通过 `lower.includes("signature")` 等判断错误类型，厂商消息变化会导致分类失效 | 维护错误码/错误类型映射表；对未知错误给出通用安全提示 |

---

### R8 — Tauri 安全/CSP/IPC/能力 ⭐⭐

**已审文件**：
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/capabilities/default.json`
- `apps/desktop/src-tauri/capabilities/desktop.json`
- `apps/desktop/src-tauri/permissions/*.toml`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/app_commands.rs`
- `apps/desktop/src-tauri/src/asr_sidecar/loopback.rs`
- `apps/desktop/src-tauri/Cargo.toml`

| 等级 | 问题 | 位置 | 说明 | 修复方向 |
|---|---|---|---|---|
| **P1** | **Capability ACL 粒度过粗，单一窗口拥有全部命令** | `capabilities/default.json:7-10` `permissions/system.toml:25-28` | `default` capability 同时授予 `core:default` 与 `main-window-full`；`main-window-full` 聚合 `project/glossary/llm/asr/system` 五个大集合，共 131 条 domain 命令一次性授予 `main` 窗口 | 按页面/功能拆分为多个 capability（如 `onboarding`、`editor`、`settings`、`asr-env`），避免使用 `main-window-full` 大集合 |
| **P1** | **生产 CSP 仍允许 WebView 直连 ASR loopback** | `tauri.conf.json:23` | `connect-src` 在生产环境仍包含 `http://127.0.0.1:8741`。前端实际通过 `asr_loopback_request` invoke 与侧车通信，保留该来源等于允许 WebView 绕过 Rust 命令层直接访问侧车 | 从生产 CSP 的 `connect-src` 中移除 `http://127.0.0.1:8741`；强制全部侧车流量走 `asr_loopback_request` |
| **P1** | **`asr_loopback_request` 是侧车全功能代理** | `asr_sidecar/loopback.rs:109-118` `asr_sidecar/loopback.rs:67-107` | 该命令接受任意 `path/method/body` 并携带本地 token 转发到 `127.0.0.1:8741`。虽已限制 `..` 遍历、仅允许 GET/POST、锁定端口，但仍把侧车所有写接口暴露给前端 | 增加路径白名单，仅开放只读/必要接口；或按端点拆分为类型化命令，禁止通用代理 |
| **P2** | **ASR 侧车 CORS 配置过宽** | `services/asr/rushi_asr/app.py:90-97` | CORS `allow_origin_regex` 匹配任意端口的 `localhost`/`127.0.0.1`，且 `allow_headers=["*"]`。读接口仍对任意本地 Web 来源开放 | 生产 bundle 的侧车应收紧为 `tauri://localhost` 或应用专属 scheme；dev 模式再通过环境变量放宽 |
| **P2** | **生产 CSP 未声明 `style-src-elem`/`style-src-attr`** | `tauri.conf.json:27` | 生产 CSP 仅声明 `style-src 'self'`，未设置 `style-src-elem`/`style-src-attr`；而 `devCsp` 却声明 `style-src-attr 'unsafe-inline'` | 若确实需要内联样式属性，生产 CSP 应显式配置并评估风险；否则确保生产无内联样式并统一 dev/prod 策略 |
| **P2** | **release 构建需确认未启用 devtools feature** | `Cargo.toml:25-26` `src/lib.rs:98-103` `release.yml:130,145` | `devtools` feature 映射到 `tauri/devtools`；当前 release workflow 未加 `--features devtools`，且 `open_devtools` 还依赖 `RUSHI_DEVTOOLS` 环境变量，但 feature 一旦误启用即可在 release 中打开 Web Inspector | 在 CI/build 脚本中显式校验 release 产物未启用 `devtools` feature；或考虑在 release profile 中强制禁用 |
| **P2** | **dev 模式下侧车写接口缺少 local token 保护** | `asr_sidecar/local_token.rs:32-42` `services/asr/rushi_asr/app.py:39-46` | `resolve_local_token_for_request` 会回退到 `RUSHI_LOCAL_TOKEN` 环境变量；`npm run asr:dev` 默认不设置该变量，导致 dev 侧车所有写接口无 token 保护 | dev 流程也应默认生成随机 token 并注入侧车子进程；或至少在开发文档中强制要求设置 `RUSHI_LOCAL_TOKEN` |
| **P3** | **命令注册列表靠人工维护，易漂移** | `app_commands.rs:1-2` `src/lib.rs:161-294` | `APP_COMMANDS` 注释声明“与 `generate_handler!` 保持同步”，目前两者一致，但无编译期或 CI 校验 | 增加脚本在 CI 中对比 `generate_handler!`、`APP_COMMANDS` 与 permissions 集合 |
| **P3** | **Updater 公钥与签名密钥生命周期** | `tauri.conf.json:52-56` | 公钥已硬编码，endpoint 仅 HTTPS，仓库未暴露私钥；但需确保 `TAURI_SIGNING_PRIVATE_KEY` 仅通过 GitHub Secrets 注入，且公钥与私钥匹配 | release CI 增加对 `latest.json` 及 `.sig` 的签名校验步骤；建立密钥轮换流程 |
| **误报（已核销）** | **`core:window:allow-close/destroy` 重复声明** | `capabilities/default.json:8-9` | 原报告认为 `core:default` 已包含这两项，属冗余。**2026-07-15 复核**：对照 `tauri` 2.11.5 源码，`core:window:default` 不含 `allow-close`/`allow-destroy`；`useProjectCloseGateController.ts` 实际调用 `getCurrentWindow().close()`。删除会破坏窗口关闭 | **无需动作**（见 §9.1） |

---

### R11 — CI/CD/Release/签名/OTA ⭐⭐⭐

**已审文件**：
- `.github/workflows/release.yml`
- `.github/workflows/ci.yml`
- `scripts/ci-upload-updater-cdn.sh`
- `scripts/ci-generate-updater-latest-json.sh`
- `scripts/ci-verify-updater-manifest.sh`
- `apps/desktop/src-tauri/tauri.conf.json` updater 部分

| 等级 | 问题 | 位置 | 说明 | 修复方向 |
|---|---|---|---|---|
| **P0** | **Release 签名 secrets 未配置，本地 DMG 未签名** | `release.yml:93-146` 本地 `如是我闻_1.0.0_aarch64.dmg` | CI 已支持 signed/unsigned 双分支，但本地验证 `codesign -dv` 显示 `code object is not signed at all`。无 `APPLE_CERTIFICATE` / `APPLE_ID` / `WINDOWS_CERTIFICATE` secrets 时 tag push 仍产出 unsigned 安装包 | 配置 GitHub secrets 并发一次 signed tag release，验证 macOS Gatekeeper / Windows SmartScreen |
| **P1** | **NSIS 安装包未签名** | `release.yml:350-390` | Windows main exe 可选择性签名，但 NSIS `*-setup.exe` 安装包本身没有 Authenticode 签名步骤。用户实际运行的安装包会触发 SmartScreen | 在 NSIS bundle 步骤后增加可选 Authenticode 签名步骤，对 `${{ env.BUNDLE_ROOT }}/nsis/*-setup.exe` 签名 |
| **P2** | **`if: always()` 不尊重 workflow 取消** | `release.yml:37` `release.yml:238` | 平台 job 使用 `always()`，即使手动取消 workflow 也会继续运行 | 改为 `if: !cancelled()` |
| **P2** | **NSIS bundle 标记 `continue-on-error: true`** | `release.yml:352` | Windows NSIS 安装包构建失败不会阻塞 release | 对 v1.0.0 应移除 `continue-on-error`，或明确文档化 NSIS 为可选 |
| **P2** | **CDN 验证仅检查 macOS OTA** | `release.yml:464-475` `scripts/ci-verify-updater-manifest.sh:52-85` | `verify-cdn-release` 只验证 macOS `latest.json` + `app.tar.gz`，不验证 Windows portable zip / NSIS installer 是否 landed | 扩展验证 job，对 Windows portable zip 和 NSIS installer URL 做 HEAD 检查 |
| **P2** | **常规 CI 不跑 Tauri bundle build** | `ci.yml:66-114` | `desktop` job 只跑 Vite build，不跑 `cargo tauri build`。打包/资源/sidecar 问题只能在 tag release 时发现 | 增加非上传的 bundle smoke（macOS app/dmg、Windows no-bundle + portable zip 打包）到 CI 或 nightly |
| **P3** | **Windows OTA 缺失** | `tauri.conf.json:52-57` `release.yml:443-462` | Windows 只上传 portable zip / NSIS 手动下载，无 `latest.json` windows-x86_64 入口 | 若产品接受则文档化；若需 OTA 则配置 Windows updater artifacts |
| **P3** | **R2 upload 失败时 artifact 保留 14 天** | `release.yml:207` `release.yml:440` | 上传 workflow artifacts 14 天后自动过期；R2 upload 失败时需人工补救 | 文档化应急流程；考虑在上传失败时发送通知 |

---

## 4. 2026-06 修复方案台账复核

对照 `docs/execution/specs/code-review-2026-06-remediation-plan.md`：

| ID | 主题 | 6 月状态 | 当前状态 | 说明 |
|---|---|---|---|---|
| R-01 | Release 签名 | P0 OPEN | **P0 OPEN** | secrets 未配置，本地 DMG 未签名 |
| R-02 | CSP unsafe-inline | P1 OPEN | **FIXED（prod）** | prod CSP 已硬化；devCsp 仍保留 inline（符合决策） |
| R-03 | Capability 粗粒度 | P1 OPEN | **P1 OPEN** | 仍使用 `main-window-full` + `core:default` |
| R-04 | macOS 密钥文件默认 | P1 OPEN | **P1 OPEN/PARTIAL** | macOS 仍强制文件存储，与 6 月决策 A “强制 keyring” 不一致 |
| R-05 | DOCX 内存/OOM | P1 OPEN | **P1 PARTIAL** | 改 `BufWriter` + `spawn_blocking`，但仍全量内存构建 + 修订轨回读全文件 |
| R-06 | STT 探测 600s | P1 OPEN | **FIXED** | 已降至 120s 并在 `spawn_blocking` 中执行 |
| R-07 | 文案 drift | P2 | **MIXED** | `asrEnvStatus` 已改进；`EnvQualityPanel` 仍含 dev npm 文案 |
| R-08 | 架构 guard 警告 | P2 | **PARTIAL** | 从 47 降到 44，仍大量 >300 行文件/mega-hook |
| R-09 | Lint warnings | P2 | **PARTIAL** | 从 50 降到 32，仍全为 exhaustive-deps |
| R-10 | Rust blocking HTTP | P2 | **PARTIAL** | 已文档化“只在 spawn_blocking 内调用”，未完全 async 化 |
| R-11 | Rust 大文件 | P2 | **OPEN** | `export_docx.rs` 990L、`export_docx_body.rs` 721L、`native_audio/engine.rs` 775L 仍超阈值 |
| R-12 | Python 大文件 | P2 | 未复核 | 本轮未深入；建议单独复核 |
| R-13 | E2E 覆盖 | P2 | **PARTIAL** | 从 1 个增至 6 个 spec，但均为 mock-Tauri 浏览器测试，无 release 手测自动化 |
| R-14 | 平台 smoke | P2 | **PARTIAL** | `v1-release-installed-smoke.sh` 较完整；Windows 仍弱于 macOS |
| R-15 | 插件脚手架 | P2 | **FIXED** | `98053d0` 已删除整个 plugin-system |
| R-16 | SQLite WAL | P3 | **FIXED** | 按决策不启用 WAL，误导注释已删除 |
| R-17 | App Data 路径 | P3 | **FIXED** | 新装单层、旧用户保留 nested |
| R-18 | dead exports | P3 | **FIXED** | `sidecarNotListening*` 已清理 |
| R-19 | 废弃文档 | P3 | **PARTIAL** | 部分 obsolete 引用仍存在 |
| R-20 | Release devtools | P3 | **FIXED** | devtools 为 opt-in feature，release 不启用 |

---

## 5. 架构守卫与 Lint 收敛项

**架构守卫 44 warnings 摘要**：
- **TS 组件/hook 接近/超过 300 行**：36 处，集中在波形、编辑器 core、页面 controller
- **Rust 模块超过 500 行**：5 处（`export_docx.rs`、`export_docx_body.rs`、`native_audio/engine.rs`、`postprocess_export_polish.rs`、`project/waveform_peaks.rs`）
- **hook 数超过 12**：2 处（`useWaveformVisualPlayheadClock.ts` 13 个、`useProjectFileMutationController.ts` 17 个）
- **直接赋值 segmentsRef.current**：1 处（`useTranscriptPlaybackFollow.ts`，已在 guard debt 列表）

**Lint 32 warnings 摘要**：
- 30 处 `react-hooks/exhaustive-deps`
- 2 处 `react-refresh/only-export-components`
- 1 处 `no-console`（`waveformScrollProfile.ts:81`）

最密集的 exhaustive-deps 集中在波形 hook（`useProjectWaveform.ts`、`useProjectWaveformMount.ts`、`useWaveformPeaks.ts` 等）与 `useTranscriptionLayer.ts`，这些是本轮审查中 race/stale closure 高风险的直接信号。

---

## 6. 发布前建议清单

### 阻塞项（P0）
- [ ] **R-01**：配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`、`WINDOWS_CERTIFICATE`、`WINDOWS_CERTIFICATE_PASSWORD` 等 GitHub secrets；推送 signed tag release 并验证 macOS Gatekeeper / Windows SmartScreen

### 高优先级（P1）
- [ ] **R1 move 事务一致性**：修复 `move_file_to_project_inner` 磁盘先搬/DB 后提交且无回滚的问题；优先给 `files.name` 加 UNIQUE 约束
- [ ] **R3 原生音频**：
  - [ ] 修复 `decode_loop` 线程 spawn 失败被静默丢弃
  - [ ] 统一跨线程原子序（`SeqCst` 或 `Acquire/Release` 成对）
  - [ ] 将 `native_audio_stop` 的同步 join 移出 Tauri 主线程
  - [ ] 在 macOS/Windows 真机跑“播放 → seek → 切设备 → 长文件 → 循环”手测清单
- [ ] **R4 DOCX**：
  - [ ] 修复同一段落多个批注的 `commentRange` 非嵌套问题
  - [ ] 将 `settings.xml` 字节级补丁改为 XML reader/writer
  - [ ] 补充大文本/多批注/修订轨共存压力测试
- [ ] **R8 Tauri 安全**：
  - [ ] 拆分 capability，移除 `main-window-full` 大集合
  - [ ] 从生产 CSP `connect-src` 中移除 `http://127.0.0.1:8741`
  - [ ] 将 `asr_loopback_request` 改为白名单/类型化命令，禁止通用代理
- [ ] **R6 密钥**：确认 macOS keyring 策略；若坚持文件存储，更新 ADR 记录决策变更
- [ ] **R11 CI**：为 NSIS `*-setup.exe` 增加 Authenticode 签名步骤；将 `if: always()` 改为 `if: !cancelled()`

### 中优先级（P2）
- [ ] 拆分 `native_audio/engine.rs`、`export_docx.rs`、`export_docx_body.rs`
- [ ] 收敛 32 个 lint warnings（优先波形/TranscriptionLayer 的 exhaustive-deps）
- [ ] 将 `nativeAudioPlaybackTransport.ts` emit 改为数组副本迭代
- [ ] DOCX 写入改为 `.tmp` + `rename` 原子化
- [ ] 常规 CI 增加非上传 Tauri bundle smoke
- [ ] 扩展 `verify-cdn-release` 验证 Windows 产物 URL

### 低优先级（P3）
- [ ] DOCX 批注/修订日期使用本地时区
- [ ] 增加命令注册一致性 CI 校验脚本
- [ ] 建立 Tauri updater 签名密钥轮换流程
- [ ] 清理 docs/execution/specs 中 obsolete 引用

---

## 7. 本轮已完成的修复

| 文件 | 改动 | 原因 |
|---|---|---|
| `apps/desktop/src-tauri/src/export_docx_polish_track_write.rs` | 添加 `#[allow(clippy::too_many_arguments)]` | 消除 clippy 阻断，与仓库既有模式一致 |

---

## 8. 完成标准（发布前）

| 层级 | 条件 |
|---|---|
| 机器闸门 | `npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs` 全绿 |
| Rust 闸门 | `cargo test --lib && cargo clippy --all-targets -- -D warnings && cargo fmt --check` 全绿 |
| 工作区 | `git status --short` 为空 |
| P0/P1 | 所有阻塞项有修复或明确 ADR 决策记录 |
| 手测 | `v1-release-installed-smoke.sh` 主路径通过；DOCX/OTA/原生音频关键路径通过 |
| 签名 | 一次 signed tag release 在 macOS/Windows 上验证通过 |

---

## 9. 核查补记（修复轮次）

> 本节记录 v1.0.0 修复排期执行过程中的**复核结论**，用于避免已核销误报或已完成项被重新当作开放债务。

### 9.1 R5 capability 冗余声明 — 误报核销

**原始结论**（§3 R8）：`capabilities/default.json` 第 8–9 行的 `core:window:allow-close` 与 `core:window:allow-destroy` 与 `core:default` 重复，建议删除。

**核查方法**：

1. 读取 `apps/desktop/src-tauri/Cargo.lock` 锁定版本：`tauri = 2.11.5`
2. 对照 crate 内 `permissions/window/autogenerated/reference.md` 中 **`core:window:default`** 的权限列表
3. 检索前端实际调用：`apps/desktop/src/pages/useProjectCloseGateController.ts` 使用 `getCurrentWindow().close()`

**核查结论**：

| 检查项 | 结果 |
|---|---|
| `core:window:default` 是否含 `allow-close` / `allow-destroy` | **否** — 默认集仅含 getter 类命令与 `allow-internal-toggle-maximize` |
| `default.json` 与 `desktop.json` 权限 ID 是否交叉重复 | **否** — 前者为 `core:*` + `main-window-full`；后者为 `process:default` + `updater:default`，属 Tauri v2 按平台/域合并 capability 的正常拆分 |
| 删除 `allow-close` / `allow-destroy` 的影响 | **会破坏** 项目关闭门控中的 `getCurrentWindow().close()` |

**状态**：从 P3 债务清单**移除**，**无需修复**。后续排期（R5）**不应**再包含「删除 capability 冗余声明」。

### 9.2 R5 后台更新轮询 — 已完成

**决策**：后台轮询间隔由 1 小时改为 **3 天**。

**落位**：`apps/desktop/src/services/appUpdate.ts`（`APP_UPDATE_BACKGROUND_CHECK_INTERVAL_MS`）、`useAppUpdateCheckOnLaunch.ts` 注释、`appUpdate.test.ts`。

### 9.3 R4 Windows OTA — spike 结论（2026-07-15）

**调研 brief**：[`docs/execution/specs/rel-win-ota-spike-research.md`](execution/specs/rel-win-ota-spike-research.md)

| 项 | 结论 |
|----|------|
| 技术可行性 | **GO** — Tauri v2 支持 `windows-x86_64` + NSIS `*-setup.exe` + `.sig`；客户端与 Ed25519 密钥已就绪 |
| v1.0.0 是否实施 | **已编码** — 待下一次 tag release + H-WIN-OTA 手测签收 |
| 主要缺口 | CI 改 NSIS 必填产物、manifest 双平台合并、首装从 portable 迁到 NSIS 基线 |
| 预估工时 | 编码 2～3 人日 + Win 真机 OTA 手测 0.5 人日 |
| P3「Windows OTA 缺失」 | 自 v1.0.0 起**接受**（手动 CDN 下载）；非 v1.0.0 阻塞项 |

---

*报告结束*

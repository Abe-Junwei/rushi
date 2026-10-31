# 本机 FunASR 转写全链路：二次审查问题报告

日期：2026-10-31（Asia/Shanghai）  
基于：[原审计](local-transcribe-flow-audit-2026-10.md)及当前本地工作区。  
状态：**AUD-01…04 + OBS-05 活动时钟已落码（2026-10-31 修复薄片）；本报告保留为缺陷与证据记录。**

## 结论

原审计主要覆盖能力判定与 UI 就绪状态，不能据此认定转写、保存、取消和任务回收全部安全。本次补查确认四项缺陷，并记录一项桌面实测异常。

修复薄片（另提交）：空结果拒存；`fail_and_persist` / start guard 释放 in-flight；轮询失败 cancel；coordinator 快照优先；`note_ready_*` 刷新 `last_activity_ms`。

## 问题清单

| 编号 | 等级 | 问题 | 证据强度 |
|---|---|---|---|
| AUD-01 | P1 | 空转写结果仍保存，删除文件已有语段 | 真实临时 SQLite 最小复现 |
| AUD-02 | P2 | 失败/取消路径未完整释放 in-flight 计数，阻止休眠回收 | Rust 计数/时间线最小复现；调用链检查 |
| AUD-03 | P2 | 状态查询失败后遗忘 jobId，未取消已接受的侧车任务 | 前端 HTTP 503/timeout 两种模拟复现 |
| AUD-04 | P2 | coordinator 已就绪仍回退到过期 React 阻断状态 | hook 最小复现 |
| OBS-05 | P2 候选 | 休眠唤醒成功后立即又被 idle-stop，随后转写报 503 | 隔离桌面日志与可见失败；未完成独立回归 |

等级说明：P1 为数据安全风险，应先修；P2 为条件触发的功能/资源问题。OBS-05 不能表述为已通过独立最小测试证实的根因。

## AUD-01：空结果覆盖旧语段

**落点**：`apps/desktop/src-tauri/src/project/run_transcribe_cmd/save.rs`、`apps/desktop/src-tauri/src/project/segment_cmd.rs`、`apps/desktop/src/pages/transcribeJobExecuteFinish.ts`。

保存函数允许空语段进入替换流程。`kept_uids` 为空时，语段存储层删除该文件全部旧语段；前端完成处理在发布保存结果、重置编辑历史之后，才将零结果显示为失败。

**实际复现**：在独立临时数据库先保存 1 条旧语段，再提交空结果，返回 `Ok(())`，旧语段从 **1 条变为 0 条**。未操作用户已有项目。

**影响**：对已有校对内容重新转写，若识别产出为空，可能清空正文。不能声称“绝对不可恢复”：持久化编辑日志是否仍可恢复旧快照，本轮未验证。

**修复方向**：在转写专用保存边界拒绝空的有效结果，且失败时保留旧持久化数据和当前编辑状态；不要把通用语段保存函数改成一概禁止用户主动清空。

**复现文件**：`apps/desktop/src-tauri/src/project/run_transcribe_cmd/save_audit_tests.rs` 中 `audit_empty_transcribe_preserves_previous_segments`。

## AUD-02：任务计数未在全部终止路径释放

**落点**：`apps/desktop/src-tauri/src/project/run_transcribe_cmd/async_cmd.rs`、`apps/desktop/src-tauri/src/project/transcribe_timeline.rs`、`apps/desktop/src-tauri/src/asr_sidecar/warm.rs`。

异步开始时增加计数；说话人模型准备的 `await?` 错误路径绕过减计数。另一个缺口是前端轮询失败/取消不执行 finalize，而记录轮询失败的命令只持久化时间线，并不释放计数。watchdog 在计数非零时跳过 idle-stop。

**实际复现**：增加计数、登记任务时间线、调用实际失败持久化函数后，`transcribe_in_flight()` 仍为 true。测试自行清理计数与临时数据库。

**影响**：失败或停止后 UI 已恢复，但本机侧车可能持续占用资源。隔离桌面停止长音频后，最后时间线仍为 `in_progress`，与“UI 已停止”不一致；该现象支持收尾不完整，但没有直接测量当时的进程内计数。

**修复方向**：为任务所有终止出口统一且幂等地释放计数、落终态；仅为 start 函数加局部 guard 不足以覆盖跨命令任务生命周期。

**复现文件**：同一 Rust 审查测试文件中 `audit_poll_failure_releases_in_flight`。

## AUD-03：轮询失败留下孤儿任务

**落点**：`apps/desktop/src/pages/transcribeLocalJobRun.ts`、`apps/desktop/src/pages/transcribeAsyncPoll.ts`。

任务已由 Rust/侧车接受后，一次状态查询 HTTP 503 或 request timeout 即抛错。外层记录失败并在 finally 清空 activeJobId，但没有对该已接受任务发 cancel，也不 finalize。

**实际复现**：两种错误均确认调用过 start、记录过失败、未调用 finalize、activeJobId 被清空；“应先发 cancel”断言失败。

**影响**：UI 报失败不等于侧车停止计算。侧车默认活动任务上限为 1，旧任务继续运行时，重试可能被 `transcribe_job_limit` 拒绝。该上限后果是代码推导，未做真实网络故障注入验收。

**修复方向**：保留任务身份，失败时尽力取消并统一收尾；如引入重试，应明确只重试可恢复的查询故障，避免重启已经接受的任务。

**复现文件**：`apps/desktop/src/pages/transcribeLocalJobRun.audit.test.ts`。

## AUD-04：新的就绪结果被旧界面状态否决

**落点**：`apps/desktop/src/pages/useProjectAsrBridgeStack.ts` 的 `localTranscribePreflight`。

当前代码：

```ts
return getEnvironmentCapabilityBlockReason() ?? asr.asrPresentation.blockReason;
```

coordinator 返回 null 既可能是没有快照，也可能是“最新快照已就绪”。后一种情况不该继续读取旧 React presentation 的阻断理由。

**实际复现**：coordinator 返回 null、旧 presentation 为 `not ready` 时，预检返回 `not ready`，而不是允许继续。

**影响**：唤醒或刷新后，刚得到的新就绪状态仍可能被过期闭包阻断；不能将本轮一次成功的唤醒实测当作不存在此竞态的证明。

**修复方向**：区分“无快照”和“有快照且无阻断”，已有有效快照时直接尊重其结论。

**复现文件**：`apps/desktop/src/pages/useProjectAsrBridgeStack.audit.test.ts`。

## OBS-05：唤醒后立即再休眠（待独立回归）

在隔离 release 桌面中，把 idle-stop 缩为 90 秒、watchdog 配置为 3 秒（代码实际最小间隔 5 秒）。长音频启动的一次失败中，日志依次出现：

```text
1793435795898 bundled_sidecar_spawn
1793435796430 bundled_sidecar_health_ok
1793435796444 asr_warmup_deferred_until_transcribe
1793435796553 asr_idle_stop after_idle_sec=90
```

随后 UI 显示“本机 ASR /health 返回 HTTP 503，无法开始转写”，失败时间线保存相同信息。

**根因候选**：`supervisor.rs` 的 ready/spawn 状态更新没有刷新 last_activity_ms；`warm.rs` 的 idle 判断可能继续使用唤醒前的旧活动时间，在转写开始增加计数前就再次停止侧车。日志显示 health-ok 到 stop 仅约 123ms，但还未完成独立的定向测试，因此保留为候选而非宣称全部因果已证实。

**复现步骤**：隔离数据目录启动 release；设置短 idle-stop，完成一次任务后等待休眠；通过自动转录唤醒，检查同次日志中 health-ok 与 idle-stop 的间隔。与 watchdog 调度有关，不保证每次触发。

为继续验证取消路径，后续隔离启动将 idle-stop 设为 0，并设置 loopback NO_PROXY；该轮不能用于宣称休眠问题已解决。

## 原审计结论复核

| 原结论/改动 | 本轮结果 | 边界 |
|---|---|---|
| soft-wake failed 或 woke 但 health 不通过要提示 | 两个 hook 测试通过 | 不等于所有原生启动失败已实机注入 |
| disk 缓存齐不等于当前可转写 | stub + cached 诊断测试通过，禁止 ready | 未实机占用 foreign 8741 |
| presentation 优先新 GET `/` async 能力 | 相关定向测试通过 | AUD-04 表明预检仍存在旧状态回退问题 |
| root=null 不应清掉已确认的 async 能力 | 新增回归测试通过 | 只证明此状态更新分支 |
| TS 缓存兜底要求 ready_for_transcribe | 定向测试及 Rust gate 测试通过 | D1≠D2 未做真实错配环境验收 |
| D7 prepare/runtime install busy 只由 UI 管 | 确认仍是边界限制 | Rust 没有完整同源 busy 闸门 |
| async→sync fallback | 不能认定旧侧车可用 | Rust 能力闸门可能先拒绝旧侧车 |
| “Phase B 落码完成” | 仅可表示已有改动存在 | 不代表本报告缺陷已修或全量验收通过 |

原文 §5/§7 是当时发现与计划，§8 是落码记录；应按时间顺序阅读，不能把旧问题列表直接当作当前全部现状，也不能把 §8 当作完整安全背书。

## 已执行的桌面场景

使用本地重新构建的 release 二进制及仓库侧车资源，包在 `/private/tmp/rushi-audit-20261031/Rushi Audit.app`。HOME 指向独立临时目录，使用公开测试语音及合成静音/长音频。**不是签名 DMG 安装验收。**

| 场景 | 实测结果 |
|---|---|
| 导入公开约 5.6 秒语音，休眠后自动转录 | 成功；UI 显示 1 条语段/29 字；SQLite 有 1 条；时间线 success |
| 两文件批量：8 秒静音 + 语音副本 | UI：完成 1、失败 1；静音“转写未产出可用语段”，后续语音仍完成 |
| 静音结果 | SQLite 0 条；本例原本无语段，不能代替 AUD-01 的已有正文保护测试 |
| 长音频首次启动 | 观察到 OBS-05，UI/时间线记录 health 503 |
| 关闭 idle-stop 后重启，长音频再次启动 | 进入真实本机任务，显示 0/6 分段运行进度 |
| 点击停止转写 | UI 显示“已停止转写，语段已恢复”；SQLite 仍 0 条，其他两个语音文件各 1 条 |
| 停止后的时间线 | 仍 in_progress，未形成终态；未继续验证后台最终释放 |

本轮未完成：签名 DMG、foreign-port/stub/损坏侧车实机注入、D1≠D2 实机错配、真实轮询断网后的后台任务与重试，以及说话人模型准备失败实机注入。用户要求停止后未继续操作。

## 机器验证结果

| 检查 | 已取得结果 |
|---|---|
| TypeScript typecheck | 通过 |
| 审查相关 7 文件定向 Vitest | 37 passed + 3 expected fail（40） |
| 全量前端 | 2676 passed、3 failed、3 expected fail；473 文件中 2 failed |
| Python ASR | 191 passed |
| Rust local_transcribe_gate | 12 passed |
| Rust 全量（显式 loopback NO_PROXY） | 575 passed、0 failed、2 ignored |
| Rust 两项审查缺陷复现 | 2 failed，正好暴露 AUD-01 / AUD-02，不是验收通过 |
| 全量 lint | 9 errors、37 warnings，未通过 |
| 本轮四个前端审查相关测试文件 lint | 无输出，成功 |
| architecture guard | 通过，有体积/复杂度警告 |
| 前端与 release 构建 | 通过；不等于 DMG 发布验收 |

首次 Rust 全量运行有 5 个 local-runtime 校验测试收到 HTTP 503；给 loopback 配置 NO_PROXY 后全量通过。环境相关差异已记录，未将第一次结果删去或伪称从未失败。

全量前端 3 个失败位于 `localAsrTranscribePreflight.test.ts`（2）与 `localAsrSetupModelStep.test.ts`（1）。前者显示 stub 判定先于 ready/mismatch；旧夹具缺少明确 transcription_mode，后者期望“不重启”但实际重启。未为得到全绿而放松生产闸门或改写这些期望。

**known-failure 纪律**：Vitest 的 `it.fails` 与 Rust 的 `#[ignore]` 仅将已知缺陷显式保留，不能计入“功能验证通过”。修复后应转为普通回归测试。

### 可运行命令

从仓库根运行：

```bash
npm exec -w @rushi/desktop -- vitest run src/pages/transcribeLocalJobRun.audit.test.ts src/pages/useProjectAsrBridgeStack.audit.test.ts
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml audit_ -- --ignored --test-threads=1
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

证据日志目录：`/tmp/rushi-audit-20261031/`。其中 `rust-repros.log`、`frontend-final.log`、`rust-full-noproxy.log`、`pytest.log`、`lint-final.log` 保留相应输出。临时证据不是长期归档，可能随系统清理消失；复现测试及本报告在仓库中保留。

## 修复落点（已实施）

1. AUD-01：`save_transcribe_segments` 空结果 `Err`，不调用替换落库。
2. AUD-02：`fail_and_persist_active_timeline` `dec_transcribe_in_flight`；async start 用 Drop guard（含 speaker prepare）。
3. AUD-03：`runLocalTranscribeJob` catch 先 cancel 再记失败（含用户取消）。
4. AUD-04：`hasEnvironmentCapabilitySnapshot()` 时预检不回退 React `blockReason`。
5. OBS-05：`note_ready_spawned` / `note_ready_adopted` 刷新 `last_activity_ms` + global activity。

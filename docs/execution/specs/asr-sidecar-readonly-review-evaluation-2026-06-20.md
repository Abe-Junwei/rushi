# ASR 侧车全链路只读审查反馈评估

**日期**：2026-06-20  
**评估人**：Kimi Code CLI  
**审查来源**：只读静态审查（覆盖 Python sidecar、Rust 壳、TS 状态机、GitHub workflow、签名脚本、产品策略文档）  
**审查范围**：ASR 侧车全链路，重点为运行安全、并发契约、Windows 发行链完整性  

## 1. 总体结论

6 项发现中 **5 项建议直接采纳并修复**，1 项（P2 #5）建议**重构为「产品策略落地」跟踪项**而非单纯代码缺陷。所有 P0/P1 发现均对应已发布产品契约或 README/策略文档的明确承诺，应进入下轮 issue/PR。

| 发现 | 评级 | 采纳建议 | 是否进入下轮 |
|------|------|----------|--------------|
| #1 启动路径误杀 8741 非 Rushi 进程 | P0 | **采纳** | ✅ 紧急修复 |
| #2 `/v1/transcribe/status` 读取即消费 `segments_delta` | P1 | **采纳** | ✅ 契约加固 |
| #3 Windows release workflow 未构建 CUDA onedir | P1 | **采纳** | ✅ 发行修复 |
| #4 Windows 侧车签名未接入 release 硬门禁 | P1 | **采纳** | ✅ 流程修复 |
| #5 模型完整性校验仍依赖可选环境变量 | P2 | **部分采纳**（策略落地项） | ✅ 跟踪项 |
| #6 Windows 侧车缺少 `sidecar-build-stamp.txt` | P2 | **采纳** | ✅ 可追溯性补齐 |

---

## 2. 逐项评估

### #1 P0 — 启动路径会杀掉占用 8741 的非 Rushi 进程

**审查依据**：

- `apps/desktop/src-tauri/src/asr_sidecar/bundled/lifecycle.rs:45-48`：
  ```rust
  if loopback_port_accepts_tcp(ASR_LOOPBACK_PORT) && !bundled_health_looks_like_rushi_asr() {
      append_sidecar_log_line(handle, "INFO bundled_sidecar_port_busy_warming");
      let _ = kill_loopback_listeners_on_port(ASR_LOOPBACK_PORT);
      std::thread::sleep(Duration::from_millis(300));
  }
  ```
- `services/asr/README.md:25` 明确承诺：「8741 已被占用时不启动（请先停本机 `python -m rushi_asr` 再测侧车）」。
- `apps/desktop/src-tauri/src/asr_sidecar/probe.rs` 已具备 `AsrPortStatus::Foreign` 分类能力。

**评估意见**：

- **采纳**。代码与 README 直接冲突；自动启动路径在探测到「端口被占用且不是 Rushi」时应当跳过或降级，而不是 `kill -9` / `Stop-Process -Force`。
- 当前 `kill_loopback_listeners_on_port` 在 Unix 用 `lsof -ti :8741 | xargs kill -9`，在 Windows 用 `Stop-Process -Force`，两者均无进程身份校验，可能终结用户其他本地服务、开发中的侧车实例或模型下载进程。

**建议修复**：

1. `try_start_bundled_inner` 在 `Foreign` 时**不再调用 kill**，而是：
   - 记录 `bundled_sidecar_port_foreign_skip`；
   - 调用 `supervisor::note_degraded(handle, "port_foreign")`；
   - 在 UI / 日志中提示用户手动处理。
2. `force_restart_bundled`（用户主动触发）可以保留 kill，但应先通过 `probe_asr_port` 分类：
   - `RushiAsr` → 杀掉并重启；
   - `Foreign` → 二次确认或提示「非 Rushi 进程，需手动停止」。
3. 新增单测：模拟 8741 被 foreign HTTP 服务占用时，自动启动路径不调用 kill。

**指派**：Rust 侧车生命周期 + UI 提示文案  
**估算**：0.5–1 轮（2–4 小时）

---

### #2 P1 — `GET /v1/transcribe/status` 读取即消费 `segments_delta`

**审查依据**：

- `services/asr/rushi_asr/transcribe_job.py:304-305`：
  ```python
  delta = [s.model_dump() for s in job.pending_delta]
  job.pending_delta.clear()
  ```

**评估意见**：

- **采纳**。当前虽然只有一个消费者（桌面 UI），但「读取即消费」使 Job 契约对多消费者、重试、诊断工具不友好，且与 status 端点「查询」语义不符。
- 该问题在 UI 轮询断线重连、用户打开第二个窗口、或后端添加诊断接口时会导致增量丢失。

**建议修复（三选一，推荐方案 A）**：

- **方案 A（最小侵入）**：`status` 不再清空 `pending_delta`；UI 以 `window_index` / `segments_total` 作为去重/续接锚点。需确认 TS 层不会重复追加。
- **方案 B（幂等游标）**：接口改为 `GET /v1/transcribe/status?job_id=...&after_segment_count=N`，服务端返回 `segments[N:]`，不再维护 `pending_delta`。
- **方案 C（快照 + 增量）**：保留 `pending_delta` 但增加 `?consume=false` 查询参数；默认 `consume=false`，显式消费场景用 `consume=true`。

**指派**：Python sidecar Job 契约 + TS 轮询适配  
**估算**：0.5–1 轮

---

### #3 P1 — Windows release workflow 只构建 CPU 侧车，缺 CUDA onedir

**审查依据**：

- `.github/workflows/release.yml:386-388`：仅调用 `npm run asr:build-sidecar-windows-cpu`。
- `docs/architecture/asr-sidecar-funasr-policy.md:17,26,103`：明确「默认安装介质同时附带 CPU 与 CUDA 两个可执行文件」。
- `scripts/build-asr-sidecar-windows.ps1` 已支持 `-Variant Cuda`，输出到 `bundled-asr/rushi-asr-sidecar-cuda/`。

**评估意见**：

- **采纳**。这是发行产物与产品策略的直接缺口；Windows N 卡用户下载 release 后将只能使用 CPU 路径，与文档承诺不符。

**建议修复**：

1. 在 `tauri-windows` job 中增加一步：
   ```yaml
   - name: Build Windows FunASR sidecar (CUDA)
     run: npm run asr:build-sidecar-windows-cuda
     timeout-minutes: 120
   ```
2. 验证产物：检查 `rushi-asr-sidecar-cuda/rushi-asr-sidecar-cuda.exe`、`_internal/funasr/version.txt`、`_internal/ffmpeg.exe`。
3. 评估 CI 时间：CPU + CUDA 串行可能接近 4 小时，可考虑拆分为独立 job 后通过 artifact 合并；如当前单 job 容量允许，先串行补齐，再优化。

**指派**：CI / release workflow  
**估算**：0.5–1 轮（含 CI 调试）

---

### #4 P1 — Windows 侧车签名是可选脚本，未在 release 硬门禁

**审查依据**：

- `scripts/sign-windows-sidecar.ps1:17-21`：缺少 `SIGNTOOL`/`SIGN_PFX` 时打印提示并 `exit 0`。
- `.github/workflows/release.yml` 的 `tauri-windows` job 未调用该脚本。
- `docs/architecture/asr-sidecar-funasr-policy.md:54`：要求 Windows 侧车 exe 与 onedir 内 DLL 均须 Authenticode 签名。

**评估意见**：

- **采纳**。签名脚本的「软跳过」与 release 未接入，导致策略无法落地；Windows 用户可能遇到 SmartScreen 拦截或 DLL 加载问题。
- 注意：该修复依赖团队证书策略（PFX 与 `signtool` 路径），当前可能是工程化未就绪状态；但应至少让 workflow **在 release tag 上失败得明显**，而不是静默未签。

**建议修复**：

1. release workflow 增加签名步骤，在 `TAURI_SIGNING_PRIVATE_KEY` 等 secrets 存在时调用 `scripts/sign-windows-sidecar.ps1`。
2. 修改脚本：在明确为 release 构建（如 `RELEASE_BUILD=1`）且缺少签名凭据时 `exit 1`；本地/CI 非 release 仍允许跳过。
3. 同步更新 `docs/execution/windows-release-checklist.md`（如存在），把签名列为 release tag 硬门禁。

**指派**：CI / 证书管理 / 发布流程  
**估算**：1 轮（取决于证书 secret 就绪时间）

---

### #5 P2 — 模型完整性校验仍依赖可选环境变量 `RUSHI_MODEL_VERIFY_MANIFEST`

**审查依据**：

- `services/asr/README.md:57`：manifest 校验为「可选」。
- `docs/architecture/asr-sidecar-funasr-policy.md:14,96`：产品策略要求「校验（哈希或签名）」，但 §9 明确说明「消费版默认仍可选环境变量；内发/企业可在发布 checklist 强制」。

**评估意见**：

- **部分采纳，但应重构为策略落地项**。这不是代码 bug，而是产品策略的故意梯度落地（先 optional，后默认强校验）。
- 当前状态确实与「最终形态」有差距，但已在 §9 列为「仍待工程化」。

**建议后续**：

1. 将本发现从「缺陷」转为「R3h / 强校验 manifest 工程化」跟踪项；不占用 P0/P1 修复队列。
2. 下阶段方案：在构建侧车时生成默认模型 manifest，随侧车资源一起打包；桌面启动时检查 `RUSHI_MODEL_VERIFY_MANIFEST`，若未设置则自动使用 bundled manifest；企业版可通过 env 覆盖。
3. 同步更新 README 与 policy 的「当前状态」章节。

**指派**：侧车构建 + 模型准备流程  
**估算**：1–2 轮

---

### #6 P2 — Windows 构建缺少 `sidecar-build-stamp.txt`

**审查依据**：

- `scripts/build-asr-sidecar-unix.sh:13-23` 定义并写入 `sidecar-build-stamp.txt`（含 git sha、build time、platform）。
- `scripts/build-asr-sidecar-windows.ps1` 全程无 stamp 写入。
- stamp 用于问题排查时确认侧车版本与构建来源。

**评估意见**：

- **采纳**。Unix 与 Windows 构建可追溯性应保持一致；stamp 文件成本低，对后续发行问题诊断价值高。

**建议修复**：

1. 在 `build-asr-sidecar-windows.ps1` 复制 `$DistOnedir` 到 `$Dest` 后，写入 `sidecar-build-stamp.txt`：
   ```powershell
   $stamp = Join-Path $Dest "sidecar-build-stamp.txt"
   $sha = (git -C $Root rev-parse --short HEAD 2>$null) ?? "unknown"
   $ts = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
   @"git_sha=$sha
   built_at=$ts
   platform=windows-x64-$Variant
   "@ | Set-Content -Path $stamp -Encoding UTF8
   ```
2. 同步检查 release workflow 的 verify artifacts 步骤是否校验该文件。

**指派**：Windows 构建脚本  
**估算**：0.25 轮

---

## 3. 优先级排序与行动计划

### 3.1 修复队列（建议）

| 顺序 | 发现 | 原因 |
|------|------|------|
| 1 | **#1 P0 误杀 8741 非 Rushi 进程** | 安全风险，直接违反 README 承诺；可能损坏用户数据 |
| 2 | **#3 P1 Windows release 缺 CUDA** | release 产物不完整，N 卡用户无法使用 CUDA 路径 |
| 3 | **#4 P1 Windows 签名未接入 release** | 发行完整性与安全信任链 |
| 4 | **#2 P1 transcribe status delta 消费** | API 契约脆弱，影响未来多消费者与可观测性 |
| 5 | **#6 P2 Windows build stamp** | 低成本补齐可追溯性 |
| 6 | **#5 P2 manifest 校验可选** | 策略落地项，纳入 R3h 跟踪 |

### 3.2 Issue / PR 映射建议

- **PR A（紧急安全）**：`fix(asr-sidecar): do not kill foreign listeners on auto-start`
  - 修改 `lifecycle.rs` 自动启动路径；保留 `force_restart` 用户确认路径；新增/更新 Rust 单测。
- **PR B（发行链）**：`ci(release): build Windows CUDA sidecar and enforce signing`
  - release.yml 增加 CUDA 构建与签名步骤；`sign-windows-sidecar.ps1` release 模式硬失败；`build-asr-sidecar-windows.ps1` 增加 stamp。
- **PR C（契约）**：`feat(asr): make transcribe status idempotent for delta reads`
  - Python 端不消费 `pending_delta` 或引入游标；TS 轮询适配去重。
- **Tracking Issue D**：`r3h: default bundled model manifest verification`
  - 跟进 #5，记录当前 optional 状态与最终默认强校验方案。

### 3.3 与 Phase B 的关系

Phase B 原计划聚焦「Job 契约 + stale 检测」。建议：

- 将 **#2** 并入 Phase B（Job 契约加固）。
- 将 **#1** 作为独立 hot-fix 提前合入，不等待 Phase B。
- **#3/#4/#6** 可并行由 CI/发行链负责人处理；**#5** 作为 Phase B 之后的 R3h 项。

---

## 4. 验证方式（修复后）

| 发现 | 验证命令 / 步骤 |
|------|-----------------|
| #1 | 1) 在 8741 启动一个非 Rushi HTTP 服务；2) 启动桌面/触发自动 bundled 启动；3) 确认该服务进程未被 kill；4) `cargo test -p rushi-desktop` 新增用例通过 |
| #2 | Python pytest 新增双消费者轮询测试；TS `asrTranscribeAsync.test.ts` 验证 delta 不重复；`npm run test` |
| #3 | 在 Windows runner 上完整跑 release workflow 的 `tauri-windows` job，确认 `rushi-asr-sidecar-cuda/` 产物存在并通过 smoke |
| #4 | release tag 构建时若缺少签名 secret 则失败；存在时 `rushi-asr-sidecar.exe` / DLL 已签名（可用 `signtool verify`） |
| #5 | 策略文档更新 + 后续 PR 的 pytest 覆盖默认 manifest 校验 |
| #6 | Windows 构建产物根目录存在 `sidecar-build-stamp.txt`，内容含 git sha / timestamp / platform |

---

## 5. 附录：既有 warning 处理建议

审查反馈同时提到以下**既有** warning，未由 Phase A 引入：

- TS lint：`useEnvOnlineSttPanel.ts` `useMemo` 多余依赖；`useAsrBridgeController.ts` 未使用的 `eslint-disable`。
- Cargo：`asr_sidecar/mod.rs` 未使用 `probe_asr_port` 导入；`probe.rs` 中 `probe_asr_port` 未使用。
- 架构守卫：`usePrepareModelController.ts` 414 行，建议 ≤300 行。

**建议**：这些不是本次审查发现，不阻塞上述 P0/P1 修复；可在 Phase B 收尾或下一次「架构体检」轮次中统一清理。若 `usePrepareModelController.ts` 拆分与 #2 的 TS 轮询改动存在重叠，可合并到同一 PR。

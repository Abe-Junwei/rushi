# Plan：FunASR 侧车依赖升级

> **Research**：[`funasr-sidecar-dependency-upgrade-research-2026-08.md`](./funasr-sidecar-dependency-upgrade-research-2026-08.md)
> **Intent**：[`funasr-sidecar-dependency-upgrade-intent.md`](./funasr-sidecar-dependency-upgrade-intent.md)
> **Acceptance**：[`funasr-sidecar-dependency-upgrade-acceptance.md`](./funasr-sidecar-dependency-upgrade-acceptance.md)
> **架构真源**：[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) · [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3h-ASR-VER**
> **估时说明**：3.5–5d；包含金标、完整 lock 和双平台 PyInstaller，超出原 `1–2d` 依赖 spike 范围

## 0. 落地结论

本轮是“依赖升级 + 发行验证”薄片，不是模型或服务架构迁移。默认目标为 `funasr==1.3.30`；`1.4.1` 只作为对照候选。最终版本必须经过两层验证：

1. **隔离验证**：保持当前其余 pins，仅替换 FunASR wheel，确认 FunASR 自身行为。
2. **发行验证**：刷新完整依赖锁、构建 PyInstaller onedir，再跑同一组质量与平台门禁。

任何一层失败都不进入正式锁。

## 1. 执行切片

### Slice A：冻结 `1.3.16` 基线（约 0.5 天）

1. 使用当前 canonical locks 创建干净 Python 3.12 环境，不复用日常 `.venv`。
2. 记录：FunASR、ModelScope、torch/vision/audio、Python、平台、device、CPU/GPU 型号。
3. 跑 `services/asr/tests`，记录通过数和 wall time。
4. 用 ffmpeg 从 D3 音频生成临时 30s 与 130s 切片；不提交派生音频。130s 用于在默认 120s async 窗策略下强制跨窗。
5. 对以下路径保存 JSON/CSV：
   - 30s blocking `/v1/transcribe`
   - 130s async `/v1/transcribe/async`，确认 `window_count >= 2` 并收到跨窗增量
   - D3 gold（约 1195s）hotwords on/off
   - warmup → transcribe → unload → health
6. 记录 D3 的 CER、segment count、`segmentation_mode`、term hit、wall、RTFx、warnings；校验 timestamp 单调且在 duration 内。
7. 记录源码侧车启动时间、warmup wall、峰值 RSS；记录当前 bundled onedir 大小作为包体基线。

证据目录使用 `docs/execution/spike-output/funasr-sidecar-upgrade-2026-08/`（gitignored），固定文件名如下，最终摘要回填 acceptance：

| 版本 | D3 hotwords A/B | 30s tracer | 130s async |
|------|------------------|------------|------------|
| baseline `1.3.16` | `baseline-1.3.16-d3-hotwords-ab.csv` | `baseline-1.3.16-30s.json` | `baseline-1.3.16-130s-async.json` |
| candidate `1.3.30` | `candidate-1.3.30-d3-hotwords-ab.csv` | `candidate-1.3.30-30s.json` | `candidate-1.3.30-130s-async.json` |
| candidate `1.4.1` | `candidate-1.4.1-d3-hotwords-ab.csv` | `candidate-1.4.1-30s.json` | `candidate-1.4.1-130s-async.json` |
| final full lock | `final-lock-d3-hotwords-ab.csv` | `final-lock-30s.json` | `final-lock-130s-async.json` |

### Slice B：候选隔离 spike（约 0.5-1 天）

按 `1.3.30`、`1.4.1` 顺序执行，每个候选使用独立临时 venv：

1. 先安装当前 CPU lock，再用 `--no-deps` 仅替换候选 FunASR wheel；用 `pip check` 确认元数据兼容。若 `pip check` 失败，记录候选新增约束并停止该轮隔离比较。
2. 跑 Python 全量测试与 30s/130s tracer。
3. 只有 tracer 全绿才跑 D3 gold hotwords on/off，避免为明显失败候选消耗长时间。
4. 按 acceptance 计算相对 `1.3.16` 的质量、速度与分段差异。
5. 记录候选 wheel 的依赖声明与 import 行为，不修改 canonical lock。
6. ModelScope 在隔离 spike 中固定 `1.38.1`；若候选的包元数据令 `pip check` 失败，记录新增约束，不在该 venv 中顺手升级 ModelScope。

选择规则：

| 情况 | 选择 |
|------|------|
| `1.3.30` 全绿，`1.4.1` 无额外可测收益 | `1.3.30` |
| `1.3.30` 失败，`1.4.1` 明确修复同一问题且全绿 | `1.4.1`，在 acceptance 说明理由 |
| 两者都全绿，`1.4.1` 对 Paraformer 有可复现收益且无包体/依赖代价 | 可选 `1.4.1` |
| 两者任一出现质量硬回归 | 淘汰该候选，不写兼容补丁绕过 |
| 两者均失败 | 保持 `1.3.16`，结果记为 No-go |

### Slice C：固化版本与锁（约 0.5 天）

候选签入前先做以下最小改动：

1. `services/asr/pyproject.toml`
   - `rushi-asr` sidecar version 从 `0.1.0` bump 到 `0.1.1`。
   - `funasr` 改为本轮验证过的精确 pin。
   - `modelscope` 默认精确 pin 为 `1.38.1`；只有候选元数据或 full-lock `pip check` 强制时才 bump，且须记录原因并重跑 Slice A/B 门禁。
2. `scripts/regen-sidecar-cpu-lock.sh`
   - 安装项目声明的精确 pins。
   - 在输出前打印并校验 FunASR、ModelScope、torch family 版本。
   - 保留现有 CVE floor，不趁本轮修改 PyTorch 渠道策略。
3. 重新生成 CPU canonical lock，再生成 Windows CUDA lock。
4. 确认 macOS x86_64、Windows CPU、Linux 工程锁仍仅通过 `-r` 引用 canonical CPU lock。
5. 新增 `services/asr/tests/test_sidecar_dependency_policy.py`：
   - pyproject FunASR/ModelScope exact pins 与 CPU lock 一致；
   - CUDA lock 的非 torch FunASR/ModelScope pins 与 CPU 一致；
   - CUDA torch family 仍为脚本声明的 `cu126` 组合。
6. 对完整新 lock 重建干净 venv，重跑 Slice A 全部评测。隔离 wheel 结果不能替代本步骤。

如 full lock 与隔离结果不同，先用 lock diff 定位传递依赖；不把无关大版本升级与 FunASR bump 混在同一提交。

### Slice D：可观测性与契约回归（约 0.5 天）

1. `services/asr/rushi_asr/runtime_caps.py`
   - `/health` 增加可选 `funasr_version`、`modelscope_version`、`torch_version`。
   - 字段获取失败返回 `null`，不得令 `/health` 500。
   - 字段只用于诊断，不参与 D4/D5/D8 或 `ready_for_transcribe` 计算。
2. `services/asr/tests/test_health.py`
   - 覆盖已安装/未安装可选依赖时的版本字段。
   - 重申原有 ready、loaded、cached 关系不变。
3. 根路由、所有现有端点、错误码和 response schema 保持兼容。
4. Rust/TS 只跑既有 health parser 与能力展示回归；因为 JSON 新字段是 additive，不新增 UI 消费。
5. `services/asr/rushi_asr/app.py` 的 FastAPI `version="0.1.0"` 改为读取 `sidecar_version()` 或同一版本真源，避免 OpenAPI 与 `/health.version` 漂移。

### Slice E：PyInstaller 与平台矩阵（约 1-2 天，取决于构建机）

按以下顺序执行，前一层失败即停止发布推进：

| 平台 | 必做验证 | 发布判定 |
|------|----------|----------|
| macOS arm64 | clean build、post-build smoke、内置 ffmpeg、warmup、30s、D3、unload、签名前包体 | 必须全绿 |
| macOS x86_64 | CI/对应构建机 clean build + smoke + 30s tracer | mac universal/双架构发布前必须全绿 |
| Windows x64 CPU | clean build、PowerShell smoke、30s、D3 或等价 gold、NSIS 资源预检 | Windows 发布前必须全绿 |
| Windows x64 CUDA | 用 `cu126` lock 构建、`torch.cuda.is_available()`、30s、D3、CPU fallback | CUDA CDN 组件发布前必须全绿；不能用 macOS 代验 |
| Linux x64 | nightly build + smoke | 工程信号，不提升为正式桌面支持 |

每个平台记录：onedir 大小、启动到 health 时间、warmup wall、30s wall、D3 wall/RTFx、峰值 RSS、实际 device 与依赖版本。

### Slice F：发布、观测与回滚（约 0.5 天）

1. 更新 `services/asr/README.md` 的真实 pins（同时修正当前 README 中 torch `2.12.1` 与 lock `2.13.0` 的漂移）。
2. 更新 `asr-sidecar-funasr-policy.md` §2/§6/§9：sidecar `0.1.1`、最终 FunASR pin、验证日期。
   - 明确当前代码对外字段名是 `/health.version`，不是策略文档示例中的 `rushi_asr_sidecar_version`。
3. 把 acceptance 的 baseline/candidate/final-lock/platform 表填完整，再允许进入 release 物料。
4. 新侧车只随下一版桌面安装包和对应 CUDA manifest 发布，不做独立热替换。Partial Go 必须按平台安装包分开：
   - macOS 可携带新版本、Windows 保持旧版本，但发布说明与诊断必须列出各平台实际 sidecar/FunASR 版本；
   - 同一 Windows 发布物料内 CPU 与 CUDA 不得混用新旧 FunASR；
   - Windows CUDA CDN/manifest 组件版本必须与该平台 CPU 侧车对齐。
5. 首轮安装包手测覆盖：已有缓存、首启 seed、D1≠D2、D4=true/D8=false、转写取消、卸载后再转写。
6. 发布后若出现启动、分段或时间轴事故：恢复 `0.1.0 + funasr 1.3.16` 精确 pins 和旧 locks，重建侧车；模型缓存与 SQLite 无需回滚。

## 2. 文件清单

| 文件 | 动作 |
|------|------|
| `services/asr/pyproject.toml` | sidecar version + 精确 FunASR/ModelScope pins |
| `services/asr/requirements-sidecar-cpu-macos-arm64.lock` | 重生成 canonical CPU lock |
| `services/asr/requirements-sidecar-cuda-win_amd64.lock` | 同步非 torch pins，保留 cu126 torch family |
| `scripts/regen-sidecar-cpu-lock.sh` | 关键版本校验与可重复生成 |
| `scripts/regen-sidecar-cuda-win-lock.sh` | CPU/CUDA 关键 pin 一致性校验 |
| `services/asr/rushi_asr/runtime_caps.py` | additive 依赖版本诊断 |
| `services/asr/rushi_asr/app.py` | FastAPI/OpenAPI version 改读 sidecar 同一版本真源 |
| `services/asr/tests/test_health.py` | health 版本字段与状态语义回归 |
| `services/asr/tests/test_sidecar_dependency_policy.py` | 新增 lock/pin policy 测试 |
| `scripts/eval-run.py` 或薄 wrapper | 仅在现有输出不足以比较版本元数据时扩展；不复制指标实现 |
| `services/asr/README.md` | pins、构建和诊断说明 |
| `docs/architecture/asr-sidecar-funasr-policy.md` | 已验证版本与发布日期 |
| 本组三件套/acceptance | 回填实测证据与 Go/No-go |

原则上不修改 `apps/desktop`、Tauri Rust、模型 catalog、bundled weights 或 UI。

## 3. TDD / 验证顺序

```text
baseline 1.3.16
  -> candidate import + Python tests
  -> 30s blocking
  -> 130s async under 120s window policy + cancel
  -> D3 gold + hotwords A/B
  -> choose candidate
  -> RED: pin/lock consistency test
  -> GREEN: pyproject + regenerated locks
  -> rerun all quality gates on full lock
  -> RED/GREEN: health dependency version fields
  -> PyInstaller build/smoke per platform
  -> installed-app state matrix hand test
```

## 4. 自动化命令组

Implement 阶段至少执行：

```bash
npm run asr:test
python3 scripts/eval-run.py --filter-id d3-tang32-zhikong-gaijiang --hotwords-ab --format csv
bash scripts/regen-sidecar-cpu-lock.sh
bash scripts/regen-sidecar-cuda-win-lock.sh
npm run asr:build-sidecar-unix
bash scripts/r3h-0-machine-gate.sh
npm run typecheck
npm run test
npm run lint
node scripts/check-architecture-guard.mjs
```

Windows 构建机另跑：

```powershell
npm run asr:build-sidecar-windows-cpu
npm run asr:build-sidecar-windows-cuda
```

## 5. 能力—UI 状态矩阵

本薄片不改变 UI 和状态派生。验收仍必须证明 additive health 字段没有污染这些维度：

| UI / 能力 | 维度 | 既有数据源 | 本轮要求 |
|-----------|------|------------|----------|
| 用户选择的本机 SKU | D1 | hub preference / catalog view | 仍为 Paraformer，版本字段不参与 |
| 实际运行 SKU | D2 | `/health.funasr_model_id` | 与依赖版本独立 |
| 所选 SKU 已落盘 | D1+D4 | selected catalog/cache state | 不读 `/health.funasr_version` |
| 侧车全局可转写 | D5 | `/health.ready_for_transcribe` | 语义不变 |
| 权重在内存 | D8 | `funasr_loaded_model_id` / `selected_model_ready` | warmup/unload 后状态不变 |
| 依赖版本 | 诊断维度，无 UI 状态 | additive health fields | 只进日志/诊断，不驱动 chip、按钮或 ready |

矛盾场景至少手测：D1≠D2；D4=true 且 D8=false；D5=true 但切换后的 D1 尚未由 D2 加载。

## 6. 风险与止损

| 风险 | 早期信号 | 止损动作 |
|------|----------|----------|
| `sentence_info` 变化导致语段骤减 | segment count、fallback warning | 淘汰候选，不放宽 min segments |
| CER 或热词退化 | D3 CER/term hit | 回到 `1.3.16`；单独上游复现，不在产品层修补 |
| full lock 才出现回归 | 隔离 wheel 绿、regen lock 红 | diff 传递依赖并拆分升级；canonical lock 不落地 |
| PyInstaller 缺数据文件 | 源码绿、bundled `/health` 或 warmup 红 | 检查 collect 清单；无法稳定收集则 No-go |
| mac 绿、Windows wheel 不可用 | Win resolver/build 失败 | Windows 平台整体保持旧 CPU/CUDA 侧车；不得在同一 Windows 物料混发新旧版本 |
| 包体超预算 | onedir 或安装介质增长超阈值 | 分析新增包；不通过盲目 prune 隐藏 import 风险 |
| 新 health 字段影响 UI | parser 或状态矩阵失败 | 删除消费，仅保留 optional raw diagnostic |

## 7. 完成定义

- acceptance 中最终版本与所有指标有实测值，不留“待测”后宣称完成。
- canonical CPU/CUDA locks、pyproject 和 `/health` 报告版本一致。
- Paraformer D3、async、hotwords、时间轴、warmup/unload 全绿。
- macOS 与 Windows 对应发布产物完成 build smoke；无对应平台证据则该平台不发布新侧车。
- 全仓机器守卫无新增失败。
- rollback 已验证为仅恢复 pins/产物，不触碰模型缓存和用户数据。

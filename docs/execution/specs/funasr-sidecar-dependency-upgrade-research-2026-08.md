# 调研：FunASR 侧车依赖升级（2026-08）

> **状态**：调研、spike 与归因消融完成（2026-08-11）；`1.3.30` / `1.4.1` 均 No-go
> **关联 Intent**：[`funasr-sidecar-dependency-upgrade-intent.md`](./funasr-sidecar-dependency-upgrade-intent.md)
> **关联 Plan**：[`funasr-sidecar-dependency-upgrade-plan.md`](./funasr-sidecar-dependency-upgrade-plan.md)
> **关联 Acceptance**：[`funasr-sidecar-dependency-upgrade-acceptance.md`](./funasr-sidecar-dependency-upgrade-acceptance.md)
> **架构真源**：[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) · [`asr-evaluation-routes.md`](../../architecture/asr-evaluation-routes.md)
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3h-ASR-VER**

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户继续使用内置 Paraformer 对中文长录音做本机转写，希望侧车获得上游稳定性修复，同时不引入新的安装、联网或界面负担。 |
| 本仓现状 | 发布锁固定 `funasr==1.3.16`、`modelscope==1.38.1`，但 `pyproject.toml` 仍声明 `funasr>=1.3.3` / `modelscope>=1.20`；默认仍为 Paraformer + FSMN-VAD + CT-Transformer PUNC；桌面通过 Rushi 自定义 loopback HTTP 契约管理 prepare、warmup、async progress、cancel、unload 与 D1-D8 能力状态。 |
| 待解决问题 | 上游已发布 `1.3.30` 和 `1.4.1`。需要判断是否值得升级、升级到哪一版，以及如何避免质量、时间轴、包体、平台轮子和 PyInstaller 回归。 |
| 成功标准 | 在同机同权重下，候选版本通过 Python 回归、Paraformer 金标、异步长音频、热词、macOS/Windows 侧车构建与状态契约门禁；失败可直接恢复旧锁且无需迁移模型缓存。 |

### 已读清单

- [`services/asr/README.md`](../../../services/asr/README.md)
- [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)
- [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)
- [`asr-evaluation-routes.md`](../../architecture/asr-evaluation-routes.md)
- [`local-asr-gpu-and-windowing-research.md`](./local-asr-gpu-and-windowing-research.md)
- [`r3h-0-asr-sidecar-build-smoke-acceptance.md`](./r3h-0-asr-sidecar-build-smoke-acceptance.md)
- `services/asr/pyproject.toml`、平台 locks、lock regeneration 与 sidecar build/smoke 脚本
- `services/asr/rushi_asr/funasr_*`、`segmentation.py`、`transcribe_windows.py` 及对应测试
- `fixtures/eval/eval_manifest.v1.json`、`scripts/eval-run.py` 与 D3 gold

## 2. 上游事实与相关性

截至 2026-08-09：

| 版本 | 发布内容中与 Rushi 直接相关的部分 | 与本薄片关系 |
|------|----------------------------------|--------------|
| `1.3.30` | 容器音频字节按 codec 解码；标点结果不匹配时保留 VAD segments | **候选基线**。后者可能提升 Paraformer `sentence_info` 稳定性；前者对已由 ffmpeg 规范化的 Rushi 主路径收益有限，但可作防御性修复。 |
| `1.4.0` | `vad_model` 拼写错误快速失败；其余 Python wheel 变化主要涉及本项目不用的模型/训练路径 | 可做兼容性候选，但没有足够理由直接越过 1.3.x 门禁。 |
| `1.4.1` | Paraformer English alias、Nano LoRA/训练 checkpoint 修复；tag 另含原生 runtime 与 realtime 集成 | **观察候选**。当前默认中文 Paraformer 文件转写没有明确新增收益。 |

官方来源：

- [FunASR v1.3.30 release](https://github.com/modelscope/FunASR/releases/tag/v1.3.30)
- [FunASR v1.4.1 release](https://github.com/modelscope/FunASR/releases/tag/v1.4.1)
- [FunASR PyPI release history](https://pypi.org/project/funasr/)

## 3. 成熟路线对照

| # | 路线 | 核心机制 | 优点 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|---|------|----------|------|-------------------|--------------------|
| A | 保留 Rushi sidecar，仅升级 Python 依赖 | 继续使用 `AutoModel`，更新精确 pins 与 PyInstaller 产物 | 复用全部生命周期、长音频、错误语义和能力状态；改动最小，可回滚 | 必须自行做跨平台锁、金标和包体门禁 | 复用现有 async progress；RSS 与包体按 baseline/policy 验收；运维仍是一套 sidecar |
| B | 改用 FunASR 官方 OpenAI-compatible server | 桌面调用 `/v1/audio/transcriptions` | 第三方兼容，减少通用上传接口维护 | 缺少 Rushi 的 prepare/warmup/unload、async window progress、D1-D8 语义；迁移收益不抵重写成本 | 需重建进度与生命周期；并行服务增加内存和运维面 |
| C | 保持 `1.3.16`，只做安全依赖刷新 | FunASR 不动，仅刷新非 ASR 包 | 最低行为风险 | 放弃 `1.3.30` 的 VAD/punctuation 修复，版本继续漂移；下一次升级跨度更大 | 进度/RSS 不变；继续承担旧版兼容与更大升级跨度 |
| D | 同时引入 MCP 或 realtime | Agent 工具调用或 WebSocket 流式识别 | 面向 Agent/实时听写场景有价值 | 不属于现有“音频文件离线转写”产品问题，会新增麦克风、增量文本与断线状态机 | 新增长连接进度、会话内存和断线运维，不适合本薄片 |

## 4. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 主要风险 | 决策 |
|------|--------|----------------|----------|------|
| A 自有 sidecar 内升级 | 高 | 全部 HTTP 契约、模型缓存、device、分窗、segmentation、eval、PyInstaller smoke | 新版传递依赖、分段形态、平台 wheel、包体 | **采用** |
| B 官方 server | 低 | 通用上传接口概念 | 丢失产品专用生命周期与能力状态 | 不采用 |
| C 原地不动 | 高 | 现有发行资产 | 错过修复且扩大未来升级跨度 | 作为回滚目标 |
| D MCP/realtime | 低 | 无当前主链路复用需求 | 新产品范围 | 不进入本薄片 |

**本仓已有可复用模块**：

- `services/asr/rushi_asr/funasr_pipeline.py`、`funasr_engine_infer.py`、`segmentation.py`
- `services/asr/rushi_asr/transcribe_windows.py`（async 默认 120s 窗）
- `services/asr/rushi_asr/runtime_caps.py`（D2/D5/D8 相关 health 真源）
- `scripts/eval-run.py` + `fixtures/eval/`（D3 gold、CER、term hit、RTFx）
- `scripts/regen-sidecar-*.sh`、`build-asr-sidecar-*`、`smoke-asr-sidecar-health.*`
- `.github/workflows/asr-sidecar-build-nightly.yml`

## 5. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 保留现有架构，先隔离比较 `1.3.30` 与 `1.4.1`，再把通过门禁的版本精确写入项目 extra 与发行 locks。 |
| 推荐落地目标 | **默认优先 `1.3.30`**：它包含本项目可解释的 VAD/punctuation 修复且仍在 1.3 系列。`1.4.1` 只有在同样全绿且有可证明收益或解决 1.3.30 阻塞时才升级。 |
| 不做什么 | 不更换默认 Paraformer；不新增 SKU；不使用 SenseVoice；不改 OpenAI-compatible/MCP/realtime 架构；不改 120s/300s 分窗默认；不改模型权重和缓存布局。 |
| 与 architecture 关系 | 不改变 `asr-sidecar-funasr-policy.md` 总形态；D1/D2/D4/D5/D8 数据源和 UI 解释保持不变；仅增加可选依赖版本诊断字段。 |
| 首要风险 | 同一版本在源码 venv 与 PyInstaller onedir 表现不同；CPU/MPS/CUDA 轮子不一致；`sentence_info` 与时间轴回归；全量 regen 意外带入无关依赖升级。 |
| 控制方式 | 先只替换 FunASR wheel 做隔离试验，再刷新完整 lock 重跑；候选失败即停，不用兼容补丁掩盖质量退化。 |

### 执行后结论

`1.3.30` 与 `1.4.1` 在同机、同 MPS、同 Paraformer 权重下的 D3 内容 CER 与基线同为 `0.1433`，识别字符没有回归。原评测脚本只输出含标点 `cer_chars`，文档误将 `0.211 -> 0.321` 标为 `content_cer`。消融证明差异来自上游 `_join_vad_texts()` 改变 PUNC 输入边界，导致用户可见的标点/断句回归。因此候选仍 No-go，但定性修正为“后处理标点回归”，不再称为识别准确率下降。完整数据见 [acceptance](./funasr-sidecar-dependency-upgrade-acceptance.md) 与 [repro](./funasr-1.3.30-vad-punctuation-regression-repro.md)。

### 当前 lock 漂移风险

`regen-sidecar-cpu-lock.sh` 当前执行 `pip install -e ".[funasr]"`。由于项目 extra 只设最低版本，直接 regen 会解析当时最新 FunASR/ModelScope，而不是复现 `1.3.16/1.38.1`。因此 Slice C 的硬顺序是：**先把已验证 FunASR 与 ModelScope 写成精确 pin，再 regen canonical lock**；禁止反序执行。

## 6. 落位预告

| 层 | 文件 / 模块 | 预期变更 |
|----|-------------|----------|
| Python packaging | `services/asr/pyproject.toml` | 侧车版本 bump；最终 FunASR/ModelScope 精确 pin |
| Lock | `requirements-sidecar-cpu-macos-arm64.lock`、CUDA lock 及引用锁 | 按最终候选刷新并保持 CPU/CUDA 非 torch 依赖一致 |
| Lock tooling | `scripts/regen-sidecar-cpu-lock.sh`、`regen-sidecar-cuda-win-lock.sh` | 防止未声明升级；输出并校验关键版本 |
| Diagnostics | `runtime_caps.py`、`test_health.py` | `/health` 增加可选 `funasr_version` / `modelscope_version` / `torch_version`，不参与 ready 派生 |
| Tests | 新增依赖 policy 测试；复用现有 ASR tests | 断言 pyproject 与 locks 的关键 pins 一致 |
| Evaluation | 复用 `eval-run.py`，必要时增加专用比较 wrapper | 生成 baseline/candidate 可比较报告，不复制第二套 CER 逻辑 |
| Docs | ASR README、policy、acceptance | 同步真实版本、验证证据和回滚版本 |
| UI / Rust | 原则上无业务改动 | 只做契约回归，不新增控件或状态字段消费 |

## 7. 签收

- [x] 调研 brief 完成
- [x] 业内路线与本仓复用评估完成
- [x] Intent / Plan / Acceptance 已链接本文
- [x] 候选版本 spike 完成
- [x] 用户已授权完整迭代，依赖修改与 macOS 构建已执行

| 日期 | 说明 |
|------|------|
| 2026-08-09 | 初版；明确 Paraformer-only、现有 sidecar contract 不变，并建立 1.3.30 / 1.4.1 候选门禁 |
| 2026-08-10 | 回填 spike；两候选均因 D3 含标点 CER 硬回归 No-go，保持 1.3.16 |
| 2026-08-11 | 增补消融；确认内容 CER 无回归，定位 `_join_vad_texts()` 导致的 PUNC/断句对齐回归，修正评测指标命名 |

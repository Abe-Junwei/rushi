# Intent：FunASR 侧车依赖升级

> **状态**：已执行；引擎升级 No-go，`0.1.1` 加固发行 Defer（2026-08-11 校正指标定性）
> **Research**：[`funasr-sidecar-dependency-upgrade-research-2026-08.md`](./funasr-sidecar-dependency-upgrade-research-2026-08.md)
> **Plan**：[`funasr-sidecar-dependency-upgrade-plan.md`](./funasr-sidecar-dependency-upgrade-plan.md)
> **Acceptance**：[`funasr-sidecar-dependency-upgrade-acceptance.md`](./funasr-sidecar-dependency-upgrade-acceptance.md)
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3h-ASR-VER**
> **估时**：3.5–5d（含 D3 金标、完整 lock 复跑与 macOS/Windows PyInstaller；原路线图 1–2d 仅覆盖依赖 spike）

## 目标

在不改变 Rushi 本机 ASR 产品形态的前提下，把 `funasr==1.3.16` 升级到通过门禁的精确版本，获得与 Paraformer 长音频链路相关的上游稳定性修复，并让源码环境、发行锁和侧车诊断能够明确回答“实际运行的是哪一版”。

## 用户价值

- 长音频分段与时间轴在标点结果异常时更稳健。
- 应用升级不要求重新下载或迁移内置 Paraformer 权重。
- macOS、Windows CPU 与 Windows CUDA 继续使用同一套产品行为和错误恢复方式。
- 出现问题时，诊断包可确认 FunASR、ModelScope 与 PyTorch 实际版本，回滚无需处理用户数据。

## 范围

1. 比较当前 `1.3.16`、候选 `1.3.30`、观察候选 `1.4.1`。
2. 固化最终 FunASR 与 ModelScope pins，刷新 CPU/CUDA locks。
3. 运行 Paraformer 短音频、D3 gold、热词、异步长音频和时间轴门禁。
4. 重建并 smoke macOS arm64/x86_64、Windows x64 CPU；Windows CUDA 在对应构建机验证。
5. 增加依赖版本诊断和 lock 一致性测试。
6. 更新 ASR 侧车版本与发行文档。

## 非目标

- 不更换、增加或重新评估 Hub model / SKU。
- 不使用 SenseVoice。
- 不接入 FunASR 官方 OpenAI-compatible server、MCP 或 realtime WebSocket。
- 不修改 Rushi `/health` 既有字段以及 prepare、warmup、async progress、cancel、unload 的既有语义；仅允许向 `/health` 增加 optional 诊断字段，且不得参与 D4/D5/D8 或 ready 派生。
- 不修改默认 device、120s async 窗、300s blocking 窗与阈值。
- 不修改 bundled default weights、first-launch seed、模型缓存目录或 manifest。
- 不做 UI 重设计；依赖版本只用于 health/诊断，不生成新的用户状态。

## 约束

- 默认模型必须保持 `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch`。
- D1 用户所选、D2 侧车运行、D4 磁盘缓存、D5 全局就绪、D8 内存加载继续彼此独立。
- 版本升级不得通过 whole-track fallback、降低语段数或放宽时间轴校验来“通过”。
- CPU 必须可用；MPS/CUDA 是加速路径，不得成为转写前提。
- 完整 lock refresh 后必须重跑质量门禁，不能只用单 wheel 隔离结果签收。
- macOS 结果不能替代 Windows CPU/CUDA 构建证据。

## 决策原则

1. `1.3.30` 是首选落地目标，因为其修复与当前 Paraformer VAD/PUNC 管线可建立直接关系。
2. `1.4.1` 是观察候选；只有在全部门禁通过且解决 `1.3.30` 的阻塞或带来可测收益时才选择。
3. 任一候选出现内容 CER、含标点 CER/断句可读性、语段、时间轴、热词或包体硬回归，即不为追版本而修改产品阈值。
4. 候选均不通过时保持 `1.3.16`，记录 No-go 证据，后续按新的上游修复重开。
5. ModelScope 默认保持 `1.38.1`；只有候选元数据或完整 lock 的 `pip check` 明确要求时才单独 bump，并重跑全部门禁，禁止顺手升级到最新。

## 执行结果

- `1.3.30` / `1.4.1` 的 D3 内容 CER 与基线同为 `0.1433`；但上游 VAD 文本拼接使含标点 CER 从约 `0.211` 升至约 `0.321`，断句可读性回归，因此仍 No-go；默认引擎保持 `1.3.16`。
- `rushi-asr 0.1.1` 已完成精确 pin、诊断、安全审计与 macOS arm64 构建加固。
- 产物发行 Defer：首次 frozen warmup 约 `205.5s`，且缺 Intel macOS / Windows 独立证据。

# Rushi — `docs/adr`

本目录记录 **Architecture Decision Records**（ADR），以本仓为真源。

| ADR | 标题 |
|-----|------|
| [0001](./0001-independent-repo-default-sqlite-python-asr.md) | 独立仓库、默认 SQLite、ASR 独立 Python 进程 |
| [0002](./0002-local-collab-dual-source-review-mode.md) | 本地独立与联机协作双轨、项目来源与工作模式分离 |
| [0003](./0003-asr-engine-funasr-first-sherpa-spike-gate.md) | ASR 引擎：方案 A（FunASR + LRC 先行，Sherpa Spike 门控）；**附录 A** 轻量/高精度双轨预期 |
| [0006](./0006-sherpa-onnx-paraformer-spike-evaluation.md) | R3h-3.5 Sherpa Paraformer Spike：**Partial Go**（轻量候选；v1 仍 FunASR 主路径） |
| [0007](./0007-sherpa-qwen3-default-asr-engine.md) | **R3s-A** Sherpa Qwen3 为将来默认本机 ASR（phased 迁移；**proposed**） |
| [0004](./0004-waveform-peaks-content-tile-renderer.md) | ~~桌面端波形 content-tile canvas peaks~~ **superseded** → [`desktop-waveform-engine.md`](../architecture/desktop-waveform-engine.md) |
| [0005](./0005-waveform-single-scroll-authority.md) | ~~tier scroll + layout/draw 双轨~~ **superseded** → 同上 |

与 Jieyu 对齐的跨仓规范仍以 sibling 文档为准；见 [`../architecture/README.md`](../architecture/README.md)。

波形历史规格归档：[`execution/specs/archive/waveform-pre-ws-only-2026-05/`](../execution/specs/archive/waveform-pre-ws-only-2026-05/README.md)。

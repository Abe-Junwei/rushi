# Rushi — `docs/architecture`

本目录预留架构真源；当前 **权威对齐说明** 仍在 sibling 仓库 Jieyu 中维护，避免双份文档漂移。

从本文件出发的相对链接（须与 `Jieyu` 平级）：

- [如是我闻-独立新仓库与-Jieyu-对齐策略.md](../../../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md)
- [如是我闻-本地版改进计划书-2026-05-11.md](../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md)

本仓 ADR 索引见 [`../adr/README.md`](../adr/README.md)。

## 本仓独立架构说明

- [`p1-stt-online-providers.md`](./p1-stt-online-providers.md) — 在线 STT Provider 调研、与解语式合约对齐及后续接线说明。
- [`asr-sidecar-funasr-policy.md`](./asr-sidecar-funasr-policy.md) — ASR 侧车 + FunASR：目标用户、联网与磁盘预算、CPU/GPU（MPS + CUDA）策略。
- [`asr-pyinstaller-collect-notes.md`](./asr-pyinstaller-collect-notes.md) — PyInstaller `collect-submodules` 取舍与 nightly 构建说明。

当 Rushi 出现更多独立于 Jieyu 的架构说明文件时，于本目录追加并在此索引。

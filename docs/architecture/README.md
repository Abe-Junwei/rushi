# Rushi — `docs/architecture`

本目录预留架构真源；当前 **权威对齐说明** 仍在 sibling 仓库 Jieyu 中维护，避免双份文档漂移。

从本文件出发的相对链接（须与 `Jieyu` 平级）：

- [如是我闻-独立新仓库与-Jieyu-对齐策略.md](../../../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md)
- [如是我闻-本地版改进计划书-2026-05-11.md](../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md)

本仓 ADR 索引见 [`../adr/README.md`](../adr/README.md)。

## 本仓独立架构说明

- [`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md) — rushi-asr 热词是否进模型、`warnings` 与前端 `supportsHotwordBias` 占位说明（计划书 §4.3 / §6.1 对齐）。
- [`stt-online-providers.md`](./stt-online-providers.md) — 在线 STT Provider 调研、与解语式合约对齐及后续接线说明。
- [`asr-sidecar-funasr-policy.md`](./asr-sidecar-funasr-policy.md) — ASR 侧车 + FunASR：目标用户、联网与磁盘预算、CPU/GPU（MPS + CUDA）策略。
- [`asr-pyinstaller-collect-notes.md`](./asr-pyinstaller-collect-notes.md) — PyInstaller `collect-submodules` 取舍与 nightly 构建说明。
- [`collaboration-storage-schema.md`](./collaboration-storage-schema.md) — 联机协作版服务端真源、PostgreSQL schema、事件流与本地缓存/项目包分层草案。
- [`collaboration-review-domain-api.md`](./collaboration-review-domain-api.md) — 批注、审阅、建议修改、活动流与 Word 导出的领域模型和 API 草案。
- [`self-hosted-collab-deployment.md`](./self-hosted-collab-deployment.md) — 用户自购协作服务器时的单节点部署建议、职责边界、备份与安全基线。
- [`../../deploy/self-hosted-collab/README.md`](../../deploy/self-hosted-collab/README.md) — 单节点协作部署包目录、启动步骤与备份说明。

当 Rushi 出现更多独立于 Jieyu 的架构说明文件时，于本目录追加并在此索引。

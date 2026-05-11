---
adr: "0001"
title: 独立仓库、默认 SQLite、ASR 独立 Python 进程
status: accepted
date: 2026-05-11
---

# ADR-0001：独立仓库、默认 SQLite、ASR 独立 Python 进程

## 上下文

Rushi（如是我闻）与 Jieyu（解语） sibling 平级，产品范围以 Jieyu 内 [如是我闻-本地版改进计划书-2026-05-11.md](../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md) 为阶段真源。对齐策略要求用 ADR 固定若干运行时与仓库边界，避免无意识复制 Jieyu 的历史折衷。

## 决策

1. **物理独立 Git 仓库**  
   应用代码、CI、依赖锁与 Jieyu 分仓；不通过 Jieyu 子目录承载本产品。跨仓依赖默认禁止 `workspace:*` 与 submodule 直挂 Jieyu 应用树；共享仅经独立发布的包或经评审的 types-only 子模块（见对齐策略 §2）。

2. **本地元数据默认 SQLite**  
   首版本地持久化以 SQLite 为默认存储形态（单用户、可备份、易分发）；若日后引入同步或多端，再通过新 ADR 扩展存储策略，而非在首版默认假设多租户或远端为真源。

3. **ASR 以独立 Python 进程（或服务）承载**  
   推理与模型加载放在与桌面壳（如 Tauri + WebView）解耦的 Python 侧进程，经稳定 IPC/HTTP 契约与 UI 通信；桌面层不直接捆绑重型模型运行时。契约面（例如 `TranscriptionProvider`）以本仓与计划书 §6.1 为真源，Jieyu 实现仅作参考。

## 后果

- **正面**：依赖边界清晰，CI/发布与 Jieyu 解耦；本地默认路径简单；ASR 升级与崩溃隔离更好。  
- **负面**：需维护跨进程契约与运维故事（启动、健康检查、版本对齐）；贡献者需同时熟悉两条运行时边界。  
- **后续**：出现与上述三条冲突的架构变更时，应新增 ADR 废止或修订本记录，并更新本目录索引。

## 参考

- [如是我闻-独立新仓库与-Jieyu-对齐策略.md](../../../Jieyu/docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md) §2、§6  
- [如是我闻-本地版改进计划书-2026-05-11.md](../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md)

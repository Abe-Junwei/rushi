# Intent: R3e-C — 转写增量出段

> **Plan**：[`r3e-c-incremental-transcribe-plan.md`](./r3e-c-incremental-transcribe-plan.md)  
> **Research**：[`r3e-c-incremental-transcribe-research.md`](./r3e-c-incremental-transcribe-research.md)  
> **Impact**：[`r3e-c-incremental-transcribe-impact.md`](./r3e-c-incremental-transcribe-impact.md)  
> **Acceptance**：[`r3e-c-incremental-transcribe-acceptance.md`](./r3e-c-incremental-transcribe-acceptance.md)

## 目标

长音频 **本机 FunASR** 转写时，用户在 Job 进行中 **逐步看到语段**；终稿 **一次写库**；失败与取消 **不污染 SQLite**。

## 用户任务

1. 打开长音频项目，点「从 ASR 拉取语段」。
2. 遮罩显示 **第 i/N 段**；列表/波形 **陆续出现** 语段条与文本。
3. 预览期间 **不能** 编辑语段、**不能** 跑 LLM 校准。
4. Job 完成 → 语段刷新为终稿（可能与预览略有 trim 差异）→ 可编辑、可保存。
5. 若取消或失败 → 界面回到转写前语段状态。

## 明确不做

- mic 流式、partial 落库、转写中 LLM、用户改稿驱动 ASR、在线 STT 增量、断点续传。

## 边界

- **preview** 仅内存；**stable** 仍为 ASR 终稿 + 现有 normalize/save。
- blocking `/v1/transcribe` 保留供测试与短路径。

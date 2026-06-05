# R3t-D — LLM 段界整理 手测清单

**状态**：**产品已移除**（2026-06；历史签收档案保留）

> **前置**：R3t-C ✅；LLM 配置 + 探测可用；项目含 ≥2 条有正文语段  
> **关联**：[`recording-transcribe-llm-refine-acceptance.md`](./recording-transcribe-llm-refine-acceptance.md) §R3t-D

## 环境

- [x] 设置 → LLM：DeepSeek（或兼容 OpenAI API）已保存 Key，自动标点/探测可用
- [x] 打开含多语段项目，选中一条触发 **段界整理**

## 功能

- [x] 预览：显示 `rationale`、语段条数变化（如 182→181）、操作摘要（时间+正文，非裸 uid）
- [x] **merge / update_text**：模型建议合并邻段 + 改字；确认写回后条数/正文符合预期
- [x] **取消**：不写回（或写回前取消），原文不变
- [x] 修复：`startSec`/`endSec` camelCase 与预览文案（2026-05-31）

## 签收

| 日期 | 结果 | 备注 |
|------|------|------|
| 2026-05-31 | ✅ | 用户验收通过；split 路径未单独手测（可选补） |

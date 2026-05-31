# R3g-C — AsrModelProfile 验收（待立项）

> **状态**：📋 待立项 · 排期见 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤g**。  
> **架构真源（待写）**：[`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md)

占位文档，供路线图链接解析；立项后替换为完整 acceptance 三件套。

## 已拍板约束（2026-05-30 评估吸收）

| 子片 | 约束 |
|------|------|
| **C4 SKU 文案** | Paraformer：**保留**「推荐转写」；SenseVoice：**不加「推荐」**（平台弃用预警，为 Qwen3 预留默认位） |
| **C4 识别语言** | 默认 `zh`；v1 至少 `zh` + `auto` |
| **不做** | FunASR 全参数 UI；SenseVoice 从 catalog **删除**（v1 仍保留 SKU） |

## 关联

- [`r3-asr-landscape-2026-05-improvement-backlog.md`](./r3-asr-landscape-2026-05-improvement-backlog.md) §3.3 SenseVoice 弃用跟踪
- [`r3g-local-asr-model-catalog-acceptance.md`](./r3g-local-asr-model-catalog-acceptance.md) v1 双 SKU 表

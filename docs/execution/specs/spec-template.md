# Spec: [功能名]

> **调研门禁**：中等及以上复杂度须先完成 [`research-brief-template.md`](./research-brief-template.md) 或 `*-research.md`，并在下文链接；见 [`AGENTS.md`](../../../AGENTS.md) Research 阶段。

**Research brief**：（链接，无则填 N/A — 仅适用于 trivial 修复）

## 目标
[一句话说明要做什么]

## 受影响代码地图
[列出预计改动的文件，2–5 行]

## 拆分方案（如涉及重构）
1. `[文件1]` — [职责]
2. `[文件2]` — [职责]

## 约束
- [约束1：如"不改动 UI 层，只更新 import"]
- [约束2：如"保持现有测试通过"]
- [约束3：如"拆分后每个文件 ≤300 行"]

## 验收标准
- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过
- [ ] `npm run lint` 无 error
- [ ] 架构守卫无新增 error
- [ ] 新增代码路径有测试覆盖
- [ ] 功能手动验证通过

## 能力—UI 状态矩阵（环境 / ASR / 设置类 **必填**）

> 模板与维度定义：[`docs/architecture/desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)  
> 路线图闸门：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.4

| UI 控件 / 文案 | 状态维度 | 数据源（API/字段/hook） | 手测场景 |
|----------------|----------|-------------------------|----------|
| （示例）模型下载进度 | 用户所选 SKU 缓存 D1+D4 | `selectedModelPrepareState` | 已选 Paraformer 未下载时不得 100% |
| | | | |

至少 **2 组** 可能矛盾的手测场景须在 acceptance 正文中列出（如「D1≠D2」「D4 与 D5 不一致」）。

## TDD（Implement 阶段，service / controller / Rust 边界 **推荐**）

> 源自 [mattpocock/skills `tdd`](https://github.com/mattpocock/skills)；术语对齐 [`CONTEXT.md`](../../../CONTEXT.md)。

**禁止 horizontal slice**（先写完全部测试再写全部实现）。必须 **vertical tracer bullet**：

```text
RED → GREEN → RED → GREEN → … → Refactor
```

每个循环：

- [ ] 一个测试只验证一种**可观察行为**（非实现细节）
- [ ] 只通过**公开 interface**（service 导出、Tauri command、HTTP API）
- [ ] 测试名使用 `CONTEXT.md` 词汇
- [ ] 实现代码仅够当前测试通过；不 speculative
- [ ] Refactor 仅在 GREEN 后进行

验收时在 acceptance 正文列出本薄片的关键测试文件路径（如 `*.test.ts`、`cargo test` 名）。

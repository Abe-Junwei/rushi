# 调研：Project Controller / State-Ref 重构

> **状态**：已采纳（2026-06-16）  
> **关联进度**：[`full-code-review-remediation-progress-2026-06-16.md`](./full-code-review-remediation-progress-2026-06-16.md) #1 / #2 / #5  
> **门禁**：本文完成后方可继续 facade 拆分与 State/Ref 收敛编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 编辑页加载项目、转写、环境页 ASR 准备、语段 CRUD、保存/关闭门禁需稳定；当前 `useProjectController` 322 行 / ~237 返回字段，维护与测试成本高 |
| 本仓现状 | `apps/desktop/src/pages/useProjectController.ts` 聚合 lifecycle + ASR bridge + setup + env capability sync；`useProjectEditorState.ts` 同时维护 `segments` state 与 `segmentsRef`；全仓无 React Context |
| 成功标准 | facade ≤300 行且 ASR slice 独立；segments 结构性 mutation 单一入口；typecheck + 现有 controller 测试 + 手测主路径通过 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 |
|---|------|------|----------|
| A | **Slice controllers + prop drilling** | 本仓既有 `useProjectLifecycleController` 等 | 页面 hook 组合多个 domain controller，UI 消费 typed API |
| B | **Scoped Context** | React 官方 Context + selector hooks | 编辑器子树注入 `{ lifecycle, asr }`，减少 prop 层数 |
| C | **External store（Zustand/Jotai）** | 本仓已用 `createModuleStore` 于 env/LLM | 模块级 store 作跨组件真源；React 订阅 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A | **高** | 现有 lifecycle / mutation / transcribe controllers | 需继续拆 ASR stack，禁止再增 facade 字段 |
| B | 中 | 可选 `ProjectEditorContext` 仅 editor 子树 | 与当前零 Context 纪律冲突；引入 re-render 风险 |
| C | 中 | `createModuleStore` 模式 | segments 迁 store 影响 dirty/save/undo 全链路 |

**本仓可复用**：`useProjectLifecycleController`、`useAsrBridgeController`、`useAsrSetupController`、`environmentCapabilityCoordinator`、`publishSegmentStructureMutation`。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A 优先**：`useProjectAsrBridgeStack` + 保持 flat `ProjectControllerApi` 兼容；**不引入 Context**（v1.1）；segments 暂留 React state + ref，ref 仅作同步读缓存 |
| 不做什么 | 不在同一 PR 把 segments 迁入 Zustand；不一次性改 20+ consumer 签名 |
| ADR 对齐 | 编排层分离（Jieyu 规则）；R3-STATE 能力矩阵不变 |
| 风险 | 拆分顺序错误导致 env sync 与 lifecycle 循环依赖 — 保持「ASR core → lifecycle → env sync」顺序 |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| UI | `useProjectAsrBridgeStack.ts`（新） | ASR bridge + setup + localTranscribePreflight |
| UI | `useProjectController.ts` | 变薄，组装 lifecycle + asr stack + env sync |
| UI | `useProjectEditorState.ts` | Phase 5：mutation 入口不变量 |
| 测试 | `useProjectController.test.ts` | 回归 flat API |
| 守卫 | `check-architecture-guard.mjs` | segmentsRef 直接写检测（结构 mutation 文件除外） |

---

## 6. 签收

- [x] 调研 brief 完成
- [ ] intent / plan / acceptance（后续薄片）
- [x] 可进入 Phase 4–5 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-16 | 初版 |

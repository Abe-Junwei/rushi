# Acceptance: R3h-3 — 环境三盏灯与 R3d IA 收口

> **状态**：✅ **编码完成**（2026-06-10）；手测 ⏳  
> **Research / 实施真源**：[`rushi-local-runtime-catalog-remediation-plan.md`](./rushi-local-runtime-catalog-remediation-plan.md) §5 Phase 3、[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)  
> **IA 合并**：[`r3d-settings-ia-acceptance.md`](./r3d-settings-ia-acceptance.md)  
> **依赖**：R3h-2 ✅ · ACC-STT-UNIFY U1/U2 ✅

## 目标

环境与顶栏 **共用同一 presentation 真源**（顶栏芯片 + 左导航状态点），不在内容区重复「就绪总览」；本机 ASR 内区块顺序与帮助路径收口，避免新用户迷路。

## 范围

### 做

| # | 交付 | 落位 |
|---|------|------|
| 1 | 顶栏 + 左导航状态点（不重复内容区总览） | `EnvironmentPanel` 导航、`asrEnvStatus` / `readOnlineSttEnvNavPresentation` / `useLlmEnvStatus` |
| 2 | 汇总既有 presentation，不新造真源 | 同上 |
| 3 | 顶栏 ASR 可点、FFmpeg 仅异常显示 | `AsrTopStatusChips.tsx`、`focusLocalAsrSeq` |
| 4 | 编辑页 ASR 芯片仅未就绪时 | `EditorToolbar.tsx` |
| 5 | R3d：未就绪时主路径展示一键准备/安装向导 | `EnvLocalAsrPanel.tsx` |
| 6 | 折叠区去重安装向导 | `EnvLocalAsrUtilitiesSection.tsx` `hideSetupWizard` |
| 7 | ACC U3：本机 hotwords vs 在线厂商术语偏置对照 | `EnvOnlineSttPanel` 说明区 |

### 不做

- 顶栏芯片与环境页状态 **完全合并**（仍各消费同一 presentation 真源）
- 首次转写前仅检查将用通道（remediation Phase 3 后续项）
- 诊断 zip 扩展各组件 version（独立薄片）
- Sherpa Spike（→ R3h-3.5）

## 能力—UI 状态矩阵（R3-STATE）

| UI / 信号 | 维度 | 数据源 | 状态 |
|-----------|------|--------|------|
| 顶栏 ASR 芯片 | D1 就绪 + D2 阻断 | `AsrEnvPresentation` | ✅ |
| 左导航状态点（ASR / STT / LLM） | D1–D3 | 同上三通道 presentation | ✅ |
| 本机 ASR 主路径向导 | D4 引导 | `!chipOk` → `LocalAsrSetupWizard` | ✅ |
| 术语偏置对照注记 | ACC U3 | `EnvOnlineSttPanel` | ✅ |

## 验收

### 自动

- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `node scripts/check-architecture-guard.mjs`

### 手测

详见 [`r3h-3-hand-test-checklist.md`](./r3h-3-hand-test-checklist.md)。

- [ ] 欢迎/Hub：ASR 芯片可点 → 环境 · 本机 ASR；就绪时无常驻 FFmpeg 芯片
- [ ] 环境页：左导航点与顶栏一致；**无**内容区重复总览
- [ ] 本机 ASR 未就绪：主路径向导；折叠区不重复
- [ ] 编辑页：仅 `!chipOk` 时显示 ASR 芯片，可点跳转
- [ ] 在线 STT 说明区：本机 hotwords vs 厂商术语偏置一句对照

## 完成定义

- [x] 代码与测试
- [x] 本 spec + R3d spec 更新
- [x] 路线图 §⑧ 标记完成
- [ ] 手测勾选（上表）

# 调研：ONBOARD（Welcome 首跑清单）

> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Step 9a–b  
> **状态**：已采纳 · 2026-06-12

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 首启用户不知 **ASR → 建项 → 转写 → 导出** 顺序；需 outcome 导向清单，非 blocking tour |
| 本仓现状 | `WelcomeView` 仅有「新建项目」+ 最近文件；`EnvHelpPanel` 为被动 L2 帮助 |
| 成功标准 | H-ONBOARD-1/2/3（首显/关闭/恢复/能力态勾选/CTA 链环境页） |

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | Product checklist | MacWhisper onboarding | 5 步清单 + 勾选持久化 |
| B | Spotlight tour | Otter | 逐步高亮 — **不采用**（阻断） |

## 3. 决策

| 项 | 结论 |
|----|------|
| 选定 | **O-1**：Welcome 清单壳 + `localStorage` 进度 + 关闭/侧栏恢复；**O-2** 能力态自动勾选 + CTA |
| 不做什么 | 全屏 tour；第二套 ASR 安装 UI；替代 `EnvHelpPanel` |
| 5 步 P0 | ① ASR 就绪 ② 建项+音频 ③ 自动转录 ④ 场次信息（可选）⑤ 导出/定稿 |

## 5. 落位

| 层 | 路径 |
|----|------|
| 纯函数 | `services/onboarding/onboardingChecklist.ts`、`onboardingProgress.ts` |
| Hook | `hooks/useOnboardingChecklistController.ts` |
| UI | `components/WelcomeOnboardingChecklist.tsx` |
| 入口 | `WelcomeView` home；`WelcomeSidebar` 恢复 |

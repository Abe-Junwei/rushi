# Spec(plan): ONBOARD O-2

> **Research**：[`onboarding-first-run-research.md`](./onboarding-first-run-research.md)

## 改动

1. `services/onboarding/onboardingAutoSync.ts` — 能力态自动勾选
2. `hooks/useOnboardingAutoSync.ts` — ProjectPanel 挂载
3. `WelcomeOnboardingChecklist` — export CTA「打开上次编辑 → 定稿模式」
4. 转写成功 / 导出 / 定稿继续 — 同步勾选对应步骤

## 验证

`npm run typecheck && npm run test onboarding && guard`

## 手测

H-ONBOARD-2 / H-ONBOARD-3

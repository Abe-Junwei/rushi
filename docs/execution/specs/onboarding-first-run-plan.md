# Spec(plan): ONBOARD O-1

> **Research**：[`onboarding-first-run-research.md`](./onboarding-first-run-research.md)

## 改动

1. `services/onboarding/onboardingChecklist.ts` — 5 步定义
2. `services/onboarding/onboardingProgress.ts` — localStorage 读写
3. `hooks/useOnboardingChecklistController.ts`
4. `components/WelcomeOnboardingChecklist.tsx`
5. `WelcomeView` home 嵌入；`WelcomeSidebar` 恢复入口

## 验证

`npm run typecheck && npm run test onboarding && guard`

# DELIV-MODE — 手测清单

> **验收真源**：[`delivery-mode-acceptance.md`](./delivery-mode-acceptance.md)

## 机器闸门（编码签收前）

```bash
npm run typecheck && npm run test -- onboarding deliveryMode deliveryModeTranscribe onboardingAutoSync toast
node scripts/check-architecture-guard.mjs
```

---

## H-DELIV-1 — 定稿模式全链路

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | 打开含音频项目 → **自动转录** 完成 | 底部 success toast 含 **「定稿模式…」** | ✅ |
| 2 | 点 toast **定稿模式…** | 打开 **定稿模式** 浮窗；终检「已有语段 / 含正文」通过 | ✅ |
| 3 | **继续 → 交付导出 Word** | 打开 **交付导出 Word** 对话框 | ✅ |
| 4 | 选 **讲稿** 或 **逐字稿** → 导出 | 生成 `.docx` | ✅ |
| 5 | 编辑器 **导出 → 定稿模式…**（路径 B） | 同上向导可用 | ✅ |
| 6 | （A-2 可选）向导内 **规则纠错 / 智能改稿** | 委托现有 F1/Stage B 预览，不自动写回 | ✅ |

---

## 签收记录

| 日期 | 平台 | H-DELIV-1 | 操作员 |
|------|------|-----------|--------|
| 2026-06-12 | macOS dev | ✅ | junwei |

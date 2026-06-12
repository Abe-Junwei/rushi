# ONBOARD — 手测清单

> **验收真源**：[`onboarding-first-run-acceptance.md`](./onboarding-first-run-acceptance.md)

## 重置（H-ONBOARD-1 前）

Dev 控制台：

```javascript
localStorage.removeItem('rushi.onboarding.v1');
location.reload();
```

---

## H-ONBOARD-1 — 清单显示 / 关闭 / 恢复

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | 清空 `localStorage` 后进 Welcome 首页 | 见 **上手清单** 5 步 | ✅ |
| 2 | 点清单 **×** 关闭 | 清单消失 | ✅ |
| 3 | 刷新 / 重启后再进 Welcome | 清单 **不** 自动弹出 | ✅ |
| 4 | 侧栏底栏 **上手清单** | 清单恢复显示 | ✅ |

---

## H-ONBOARD-2 — 能力态自动勾选

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | ASR 就绪后回 Welcome | Step **准备本机 ASR** ✓ | ✅ |
| 2 | 建项 + 导入音频 + 打开文件后回 Welcome | Step **创建项目并导入音频** ✓ | ✅ |
| 3 | 完成一次转写后回 Welcome | Step **自动转录** ✓ | ✅ |
| 4 | 填写场次信息 / 定稿导出后 | Step **场次信息** / **导出 Word** ✓（按操作） | ✅ |

---

## H-ONBOARD-3 — CTA → 环境页本机 ASR

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | 清单 Step1 **打开环境 → 本机 ASR** | 打开 **环境与 LLM** 浮层 | ✅ |
| 2 | 内容区 | 聚焦 **LocalAsrSetupWizard**（非第二套安装 UI） | ✅ |

---

## 签收记录

| 日期 | 平台 | H-ONBOARD-1 | H-ONBOARD-2 | H-ONBOARD-3 | 操作员 |
|------|------|-------------|-------------|-------------|--------|
| 2026-06-12 | macOS dev | ✅ | ✅ | ✅ | junwei |

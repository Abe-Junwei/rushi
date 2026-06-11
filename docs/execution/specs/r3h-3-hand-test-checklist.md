# R3h-3 手测清单 — 环境 IA 与顶栏能力芯片

> **Acceptance**：[`r3h-3-environment-readiness-acceptance.md`](./r3h-3-environment-readiness-acceptance.md)

## 前置

- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 场景 1 — 欢迎页 / Hub 顶栏

| 步 | 操作 | 期望 |
|----|------|------|
| 1 | 打开欢迎页，看顶栏 ASR 芯片 | tone 与「环境 → 本机 ASR」状态一致 |
| 2 | 点击 ASR 芯片 | 打开环境浮层，左侧停在「本机 ASR」 |
| 3 | 侧车就绪时看顶栏 | **无** 常驻 FFmpeg 芯片 |
| 4 | 点击 LLM 芯片 | 打开环境浮层，停在「LLM 配置」 |

## 场景 2 — 环境页 IA

| 步 | 操作 | 期望 |
|----|------|------|
| 1 | 打开环境任意子页 | **无** 内容区「就绪总览」三行重复块 |
| 2 | 本机 ASR 未就绪 | 状态条下「一键准备」或「安装向导」；折叠「环境与维护」内无重复向导 |
| 3 | 本机 ASR 已就绪 | 主路径无突出向导；维护区可展开 |
| 4 | 在线 STT 说明区 | 一句本机 hotwords + 当前厂商术语偏置 |
| 5 | 使用说明 | 推荐顺序：本机 ASR → 在线 STT → LLM |

## 场景 3 — 编辑页顶栏

| 步 | 操作 | 期望 |
|----|------|------|
| 1 | 打开项目文件，ASR 已就绪 | 顶栏 **无** ASR 芯片，有 LLM 芯片 |
| 2 | 侧车未就绪或模型未备齐 | 顶栏出现 ASR 芯片（黄/红） |
| 3 | 点击编辑页 ASR 芯片 | 打开环境 · 本机 ASR |

## 签收

- [ ] 三场景通过
- [ ] 在 acceptance 手测表勾选

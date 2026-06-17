# REL-1.1 手测清单（v1.1 signoff）

> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Step 12  
> **前置**：BATCH-TXN B-1/B-2 编码完成  
> **Release 操作**：[`rel-1.1-release-signoff-runbook.md`](./rel-1.1-release-signoff-runbook.md)（构建 · H-CSP · tag/CI）

## 发行与安全

| ID | 项 | 状态 |
|----|-----|------|
| H-CSP-1 | Release 包 Editor 波形加载；Console 无 style CSP violation | 见 [runbook §C](./rel-1.1-release-signoff-runbook.md) |
| H-CSP-2 | 交付导出 Dialog、环境页三盏灯正常 | 见 [runbook §C](./rel-1.1-release-signoff-runbook.md) |
| H-PROD-1 | 设置 → 关于：版本与诊断 `build-info.txt` 一致 | ✅ 2026-06-12 |
| H-PROD-2 | 关于页可打开 ffmpeg 等第三方许可全文 | ✅ 2026-06-12 |

## STT 取消（已签收项回归）

| ID | 项 | 状态 |
|----|-----|------|
| H-STT-1 | 在线 STT 转写中停止，语段恢复 | ✅ 2026-06-12 |
| H-STT-2 | TRN-DIAG / 诊断包 outcome=`cancelled` | ✅ 2026-06-12 |
| H-STT-3 | 本机侧车 async 停止回归 | ✅ 2026-06-12 |

## 定稿与引导

| ID | 项 | 状态 |
|----|-----|------|
| H-DELIV-1 | 定稿模式：转写 → 终检 → 讲稿/逐字稿导出 | ✅ 2026-06-12 |
| H-ONBOARD-1 | Welcome 5 步清单 / dismiss / 恢复 | ✅ 2026-06-12 |
| H-ONBOARD-2 | ASR 就绪与转写步骤自动勾选 | ✅ 2026-06-12 |
| H-ONBOARD-3 | 清单 CTA → LocalAsrSetupWizard | ✅ 2026-06-12 |

## BATCH-TXN（本轨新增）

| ID | 步骤 | 预期 | 状态 |
|----|------|------|------|
| H-BATCH-1a | 打开有文件的项目 Hub →「导入音频」多选 **≥3** 个 mp3 | 列表出现 3+ 文件；无多次全页闪烁 | ✅ 2026-06-18 |
| H-BATCH-1b | 对 **≥2** 个空语段音频点「批量转写」 | 队列串行；完成后均有语段 | ✅ 2026-06-18 |
| H-BATCH-1c | 其中一个文件已有语段再批量 | 该文件 **跳过**；其余正常 | ✅ 2026-06-18 |
| H-BATCH-1d | 批量进行中尝试关窗或换项目 | 被阻塞（与单文件转写一致） | ✅ 2026-06-18 |
| H-BATCH-1e | 批量进行中「停止并离开」或队列「停止批量转写」 | 当前项停止；剩余未处理；可继续导航 | ✅ 2026-06-18 |

## 签收

| 项 | 值 |
|----|-----|
| 签收人 | |
| 日期 | |
| 版本/tag | |

# Phase C/D 手测清单 — Prepare 展示统一 + Diagnose 投影

> **Plan**：[asr-model-download-status-remediation-plan.md](./asr-model-download-status-remediation-plan.md)  
> **Acceptance**：[asr-model-download-status-remediation-acceptance.md](./asr-model-download-status-remediation-acceptance.md)（M1–M4 仍适用）  
> **机器闸门**：`bash scripts/asr-model-download-phase-cd-hand-test.sh`

---

## 前置

- macOS 打包或 `npm run desktop:dev`（侧车可连 `127.0.0.1:8741`）
- 所选 hub 模型 **未**齐备（fresh app data 或清空 models 缓存）
- 可选：VPN 开关（M3）

---

## 0. 机器闸门（提交前 / 手测前）

```bash
bash scripts/asr-model-download-phase-cd-hand-test.sh
```

**期望**：退出码 0；Vitest / Rust diagnose / supervisor 单测全绿。

| 项 | 结果 | 日期 |
|----|------|------|
| §0 机器闸门 | ☐ | |

---

## 1. Phase C — 展示同源（C-1/C-2）

### C1 — 模型卡与 wizard model 步

**前置**：侧车 ready，所选模型未下载完。

| 步骤 | 期望 |
|------|------|
| 1. 环境页点「下载当前模型」 | 顶栏 chip/banner **立即**「正在下载」；模型卡 `下载中… N%` |
| 2. 打开「一键准备」wizard | `model` 步 detail 为「正在下载模型（N%）」或「正在下载模型」，与模型卡 **同一进度语义** |
| 3. 取消下载 | 模型卡与 banner 显示「正在取消下载…」 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C1 展示同源 | ☐ | |

### C2 — 长下载不误续传（复查修复）

**前置**：开始下载 Paraformer 主模型；保持联网 **>2 分钟** 且进度仍在涨。

| 步骤 | 期望 |
|------|------|
| 1. 观察 2–5 分钟 | **不**出现「网络中断，正在续传」；**不**自动 cancel/restart |
| 2. sidecar `GET /v1/models/prepare-status` | 可有 `stale:true`（stage 久未变），但 UI 仍显示下载中且 percent 继续变 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C2 长下载不误续传 | ☐ | |

---

## 2. Phase C — D7 与 defer（C-3）

| 步骤 | 期望 |
|------|------|
| 1. 下载进行中切到其他 tab / 等待 env 自动刷新 | 顶栏 **保持**「正在下载模型」，不闪「已就绪」 |
| 2. LRC 运行时安装 + 模型下载（若可复现） | LRC 优先于 prepare 的 D7 banner（运行时安装文案） |

| 项 | 结果 | 日期 |
|----|------|------|
| §2 D7 defer | ☐ | |

---

## 3. Phase D — Diagnose 投影（D-1/D-2）

### D1 — 向导「刷新诊断」

**前置**：下载进行中。

| 步骤 | 期望 |
|------|------|
| 1. 一键准备页点「刷新诊断」 | `diagnose` 步 detail 含「模型下载中」或 job_id |
| 2. 若 sidecar 返回 `running+stale` 且 progress 停住 >2min | detail 为「模型下载可能卡住」，**非**「模型下载中」 |

| 项 | 结果 | 日期 |
|----|------|------|
| §3 D1 diagnose | ☐ | |

### D2 — 导出诊断包

| 步骤 | 期望 |
|------|------|
| 1. 关于 / 导出诊断 zip | zip 含 `asr-setup.txt` 行 `prepare_phase` / `prepare_job_id` / `lrc_install_phase` |
| 2. 下载进行中导出 | 含 `prepare-job.json`（侧车 prepare-status 快照） |

| 项 | 结果 | 日期 |
|----|------|------|
| §3 D2 诊断 zip | ☐ | |

---

## 4. 回归 — Acceptance M1–M4（抽样）

| 场景 | 要点 | 结果 | 日期 |
|------|------|------|------|
| **M1** | 下载中无假就绪 | ☐ | |
| **M3** | VPN 切换可续传、进度不跳 0 | ☐ | |
| **M4** | prepare 中 /health 瞬断不杀侧车 | ☐ | |

---

## 5. 证据记录（可选）

手测完成后可追加：

- 截图：环境页下载中 banner + 模型卡进度
- `prepare-job.json` 片段（脱敏 job_id 可留）
- 记录到 `docs/execution/specs/asr-model-download-status-phase-cd-hand-test-evidence.md`

---

## 签收

| Phase | 机器闸门 | 手测 | 备注 |
|-------|----------|------|------|
| C presentation | ☐ | §1–§2 | |
| D diagnose | ☐ | §3 | |
| M1–M4 回归 | — | §4 | |

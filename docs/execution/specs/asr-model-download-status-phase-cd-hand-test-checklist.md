# Phase C/D 手测清单 — Prepare 展示统一 + Diagnose 投影

> **Plan**：[asr-model-download-status-remediation-plan.md](./asr-model-download-status-remediation-plan.md)  
> **Acceptance**：[asr-model-download-status-remediation-acceptance.md](./asr-model-download-status-remediation-acceptance.md)（M1–M4 仍适用）  
> **机器闸门**：`bash scripts/asr-model-download-phase-cd-hand-test.sh`

---

## 前置

- macOS 打包或 `npm run desktop:dev`（侧车可连 `127.0.0.1:8741`）
- 所选 hub 模型 **未**齐备（fresh app data 或清空 models 缓存）
- 可选：VPN 开关（M3）

### 本地打 `.app`（无 OTA 签名钥）

`tauri.conf.json` 启用了 updater（`createUpdaterArtifacts: true`）。**没有** `TAURI_SIGNING_PRIVATE_KEY` 时，勿用 `npm run tauri build` / `desktop:build-app`，会报 public key without private key。

```bash
# 手测用：只打 .app，跳过 updater 签名产物
npm run desktop:build-app:local
npm run desktop:open-release-app
```

发版 / OTA 才需要设置 `TAURI_SIGNING_PRIVATE_KEY`（+ 可选 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`），再跑 `npm run desktop:build-app`。

**Fresh App Data 自动化手测**（隔离首装，**推荐 `--interactive`**，无需辅助功能）：

```bash
bash scripts/r3f-fresh-appdata-hand-test.sh --interactive
```

在弹出的应用里手动点 **设置 → 本机 ASR → 一键准备**；终端只轮询 `/health`。  
勿用 `--with-ui`，除非已在 **辅助功能** 里授权 Terminal/Cursor（否则会因 osascript 失败而退出并关掉应用）。

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

### C3 — 取消下载不再自动续传

**前置**：下载进行中；可模拟网络抖动（关 VPN / 断网 5–10 秒）。

| 步骤 | 期望 |
|------|------|
| 1. 点「取消下载」 | UI 显示「正在取消下载…」，进度冻结 |
| 2. 若侧车进入 network error | **不**出现「正在从已下载部分续传…」；**不**第二次 `prepare/async` |
| 3. 结束后 | 文案为「已停止后台模型下载…」，非失败面板 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C3 取消不续传 | ☐ | |

### C4 — 应用侧车不误报可转写

**前置**：fresh app data，所选模型 **未**下载。

| 步骤 | 期望 |
|------|------|
| 1. 环境页点「应用并重启侧车」 | **info** toast：「请先点下载当前模型…」，**非**绿色 success「可以开始转写」 |
| 2. 模型卡 | 进度 **非** 100% 绿；按钮仍为「下载当前模型」 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C4 应用不误报 | ☐ | |

### C5 — 网络错误中文文案

**前置**：下载时断网或 ModelScope 不可达。

| 步骤 | 期望 |
|------|------|
| 1. 下载失败 | 错误标题为「网络中断」类中文，**非** raw `HTTPSConnectionPool…` 英文 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C5 网络错误文案 | ☐ | |

### C6 — 部分缓存不误标已就绪

**前置**：仅主模型落盘、`funasr_required_models_cached=false`（或 fresh 后中断于主模型）。

| 步骤 | 期望 |
|------|------|
| 1. 环境页模型卡 | 进度 **非** 100% 绿；文案「主模型已缓存 · 辅助模型待补齐」 |
| 2. 主操作 | 仍为「补齐辅助模型」/「下载当前模型」，**非**「当前模型已就绪，可直接转写」 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C6 部分缓存 | ☐ | |

### C7 — Wizard 刷新诊断不误标 model/done（M2 回归）

**前置**：磁盘有 **其他** 模型或全局 `required_models_cached=true`，但 UI 所选 Paraformer **未**齐备。

| 步骤 | 期望 |
|------|------|
| 1. 打开一键准备，点「刷新诊断」 | `model` 步 **非** ok「模型已就绪」；`done` 步 **不出现** |
| 2. 下载完成且 D1=D2 对齐后刷新 | 此时 `model` ok + `done` 可开始转写 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C7 wizard 诊断 D4 | ☐ | |

### C8 — 下载中勿重启侧车

**前置**：模型下载进行中。

| 步骤 | 期望 |
|------|------|
| 1. 环境页「高级诊断 → 重试内置侧车」 | 按钮 **禁用**（或等价 busy），避免中断 prepare |
| 2. 取消下载或完成后 | 按钮恢复可用 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C8 下载中禁重启 | ☐ | |

### C9 — 命令层与 UI 对齐（R3-STATE）

**前置**：侧车 `funasr_ready=true`，全局 `required_models_cached=true`，但所选 SKU 未齐备 / 未加载。

| 步骤 | 期望 |
|------|------|
| 1. 环境页 | blockReason 仍阻止转写；诊断摘要 **不**写「可直接转写」 |
| 2. 点「自动转录」 | Rust gate 拒绝（非 stub 误放行） |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C9 gate 对齐 | ☐ | |

### C10 — 下载中禁清缓存

| 步骤 | 期望 |
|------|------|
| 1. 下载中打开「缓存与校验」 | 「清除模型缓存」禁用；若从代码路径调用应 toast 提示 |

| 项 | 结果 | 日期 |
|----|------|------|
| §1 C10 禁清缓存 | ☐ | |

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

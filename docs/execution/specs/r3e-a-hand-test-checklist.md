# R3e-A — 长音频动态超时与失败可诊断手测清单

> **关联**：[`r3e-long-audio-transcribe-acceptance.md`](./r3e-long-audio-transcribe-acceptance.md) · **硬门禁 Q-R3e-1**：50min 手测**不**验收多段质量，只验超时/文案/OOM 提示  
> **自动化**：`bash scripts/r3e-a-hand-test.sh`

## 0. 环境

| 项 | 要求 |
|----|------|
| 模型 | Paraformer（VAD+标点）已缓存 |
| 素材 | **~48.6min / 2918s** 中文音频（与 R3e-B 同素材可复用） |
| 侧车 | `/health` → `ready_for_transcribe: true` |

---

## 1. 自动化

- [x] `bash scripts/r3e-a-hand-test.sh`（2026-06-07）
- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`（2026-06-07）

---

## 2. 长音频超时（~50min）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 打开 ~48min 项目 → **从 ASR 拉取语段** | 桌面等待 ≥ 原 600s；不因 HTTP 600s 提前断开 |
| 2 | `desktop.log` | `audio_duration_sec=Some(2918…)` + **`timeout_s=7200`** + `transcribe_stage=preflight→parse→save` |
| 3 | UI | 转写 busy 期间可见长音频提示（>30min） |

**历史日志（2026-05-30，R3e-B 同会话）**

```text
transcribe local audio_duration_sec=Some(2918.24325) timeout_s=7200
transcribe_stage=preflight → parse → save
```

---

## 3. 失败可诊断（R3e-A §C）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 停止 `rushi-asr`（或杀侧车进程） | — |
| 2 | 对任意项目执行拉取语段 | 错误为**中文可行动文案**（侧车未响应/连接失败），**非**裸 `error sending request` |
| 3 | 恢复侧车 | 短音频可再次成功 |

- [ ] 2026-05-27 手测已签收（acceptance 表）

---

## 4. 短音频回归（≤10min）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | ≤10min 素材 → 拉取语段 | 一次完成；`timeout_s` 为推导下限 600 或按公式 <7200 |
| 2 | 语段 | 可编辑、保存、重启后仍在 |

---

## 签收

| 项 | 日期 | 执行人 | 备注 |
|----|------|--------|------|
| 自动化 | 2026-06-07 | Agent | `r3e-a-hand-test.sh` + L0 |
| ~50min timeout 主路径 | 2026-05-30 | 用户+Agent | log `timeout_s=7200`；2026-06-07 单测复验 |
| 失败可诊断 | 2026-05-27 | 用户 | 停侧车中文文案 |
| **R3e-A 签收** | **2026-06-07** | **✅** | [signoff](./r3e-a-phase-signoff-2026-06.md) |

**3 行日志**

```text
改动：R3e-A 复验闸门（r3e-a-hand-test.sh + signoff）
验证：transcribe_* 20/20 · L0 1142 tests · 50min timeout 2026-05-30 log
下一轮：TRN-DIAG / ASR-WARM
```

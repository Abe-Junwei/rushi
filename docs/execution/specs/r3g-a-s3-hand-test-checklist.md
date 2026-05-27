# R3g-A ⑤b — S3 手测清单（R3-STATE）

> **闸门**：路线图 §4.1.4 **S3**、§8.2 **Q-R3g-2** — **签收前不得进入 ⑤c**  
> **自动化前置**：`npm run test` 含 `localAsrModelCatalog.test.ts`；`./scripts/r3g-s3-preflight.sh`（侧车已起时）  
> **关联**：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) §5、[`r3g-local-asr-model-catalog-acceptance.md`](./r3g-local-asr-model-catalog-acceptance.md)

## 环境准备

- [ ] `npm run desktop:dev`（或安装包）+ 侧车 health 正常（8741）
- [ ] 已跑：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [ ] 可选：`bash scripts/r3g-s3-preflight.sh` 记录基线 JSON

**建议磁盘状态（可二选一达到场景 A）**

| 状态 | SenseVoice | Paraformer |
|------|------------|------------|
| **场景 A 推荐** | 已缓存 | **未**缓存 |
| 若 Paraformer 已缓存 | 先删其缓存目录或换干净 `MODELSCOPE_CACHE` 子目录后再测 |

---

## 场景 1 — D1≠D2（已选 Paraformer，侧车仍为 SenseVoice）

**目的**：顶栏/环境页不得显示「可直接转写」，模型区须有 mismatch 提示。

| 步 | 操作 | 预期（全文案无矛盾） |
|----|------|----------------------|
| 1 | 环境 → 本机 ASR；确认侧车 **运行中** 且当前为 **SenseVoice**（侧车报告 / `preflight`） | 侧车报告 `funasr_model_id` = `iic/SenseVoiceSmall` |
| 2 | 下拉选 **Paraformer 长音频**；**不要**点「应用并重启侧车」 | 列表 Paraformer 显示 **未下载** 或未完成；**不得**因 SenseVoice 已缓存而显示 Paraformer「已缓存 100%」 |
| 3 | 看 **模型下载区** 进度/按钮 | 绑定 **所选** SKU（D1+D4），非全局 `funasr_required_models_cached` |
| 4 | 看 **「可直接转写」**（环境页 + 欢迎顶栏 + 项目 Header 绿点） | **未就绪** / 灰点 |
| 4b | 看 **转写模型** 区 | **黄色提示框** 和/或 **模型下载** 区「请先应用并重启侧车」（二者任一即算 mismatch 提示） |
| 5 | `bash scripts/r3g-s3-preflight.sh` | `funasr_model_id` 仍为 SenseVoice；与 D1 不一致 |
| 6 | 截图 | 保存 `s3-scenario1-mismatch.png` |

> **未看到黄框？** 若 `funasr_model_id` 已与下拉一致（例如曾点过「应用并重启」），则 **不会** 再显示 D1≠D2 黄框——此时应改测：先选 SenseVoice 应用侧车，再只改下拉为 Paraformer **不点应用**。

- [x] 场景 1 通过（2026-05-27：**可直接转写 = 未就绪**；未误用 SenseVoice 缓存表示 Paraformer；黄框未出现因 D1=D2 或已见模型下载区提示）

---

## 场景 2 — D1 已选未缓存 SKU（Paraformer 未下载）

**目的**：下载区、转写就绪、文案一致；不误用 D5/D6 表示「所选已就绪」。

| 步 | 操作 | 预期 |
|----|------|------|
| 1 | 保持选中 **Paraformer**；确认 **未缓存** | 「下载当前模型」可点；进度 **0%**（非 busy 时） |
| 2 | 点 **下载当前模型**；若已缓存则点 **校验/刷新缓存** | 已缓存时可能 **秒级完成** 并提示「或已在缓存中」——**属预期**，不是误用 SenseVoice 缓存 |
| 2b | （可选）点 **取消** | 文案「正在停止…」→ 最终「已停止后台下载」；`prepare-status` → `cancelled`（**Q-R3g-3**） |
| 3 | 下载完成或取消后 **刷新状态** | 「可直接转写」仅当 **D1 缓存齐 + 侧车 D2 一致** 时为就绪 |
| 4 | 点 **应用并重启侧车**（若已缓存） | 侧车报告变为 Paraformer；`preflight` 与 D1 一致 |
| 5 | `bash scripts/r3g-s3-preflight.sh` | `funasr_model_id` = Paraformer hub id |
| 6 | 截图 | `s3-scenario2-paraformer.png` |

- [x] 场景 2 通过（2026-05-27：下载/校验缓存、侧车与所选一致）

---

## 场景 3（可选）— Stale 侧车 / D3

| 步 | 操作 | 预期 |
|----|------|------|
| 1 | 用旧侧车占 8741（无 catalog）或文档化步骤 | UI 有 stale / 需重启提示 |
| 2 | 一键准备或 force-restart 后 | catalog API 200；下拉正常 |

- [ ] 场景 3 通过或 **N/A**（本轮跳过，记入 3 行日志）

---

## 签收

| 项 | 日期 | 执行人 | 备注 |
|----|------|--------|------|
| S3 场景 1 | 2026-05-27 | 手测 | 可直接转写 **未就绪** ✅ |
| S3 场景 2 | 2026-05-27 | 手测 | ✅ |
| Q-R3g-3 取消手测 | | | 可选；未测则 ⑤c 前补 |
| **⑤b 签收** | 2026-05-27 | 手测 | S3 场景 1–2 ✅ |

### ⑤c 结果

| 项 | 2026-05-27 初测 | 2026-05-27 复测 |
|----|-----------------|-----------------|
| 时长 | ~13:18 | ~13:18 |
| 语段数 | 1（整轨 fallback） | **≥10** |
| UI | `funasr_whole_track_fallback` | 无整轨 fallback 横幅 |
| 判定 | 未通过 | **✅ 通过** |

| **⑤c 签收** | 2026-05-27 | 手测 | preflight + 13min Paraformer ✅ |

---

### ⑤c 前 preflight 快照（示例 2026-05-27）

`bash scripts/r3g-s3-preflight.sh` 期望大致为：

- `funasr_model_id` = Paraformer hub id，`active: true`
- 两项 `cached: true`，Paraformer `ready_for_transcribe: true`
- `prepare-status.phase` = `done`（或 `idle`），无 `error`

**3 行日志模板**（贴入轮次记录或 commit 说明）：

```text
改动：R3g-A ⑤b S3 手测（场景1 D1≠D2 + 场景2 下载/取消）
验证：截图 + preflight JSON；npm test 194 passed
下一轮：HOT-UX（路线图 ⑤½）→ R3t-A
```

签收后请在 [`r3g-local-asr-model-catalog-acceptance.md`](./r3g-local-asr-model-catalog-acceptance.md) 将「2 组矛盾场景手测」勾选为 `[x]`。

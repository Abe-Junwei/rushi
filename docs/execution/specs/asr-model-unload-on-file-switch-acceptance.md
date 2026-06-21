# Acceptance：空闲换 File 卸载侧车权重（v0.1.8.1）

> **Research**：[`asr-model-unload-on-file-switch-research.md`](./asr-model-unload-on-file-switch-research.md)  
> **Plan**：[`asr-model-unload-on-file-switch-plan.md`](./asr-model-unload-on-file-switch-plan.md)  
> **Grill**：编辑优先 A · 空闲换 File B2 · busy C2 · 范围 D1

---

## 目标

转写/warmup 后 Editor 滚动发涩（~3GB 侧车 RAM）→ **空闲换 File 自动 unload**，编辑期 RSS ~500MB；**D8** UI 与 D4/D5 不混维。

---

## 能力—UI 状态矩阵

> 维度定义：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) §2

| UI 控件 / 文案 | 维度 | 数据源 | 手测场景 |
|----------------|------|--------|----------|
| 四灯「本机 ASR」chip | D5 + D8 overlay | `buildAsrEnvPresentation` | D4 真（磁盘齐）+ D8=disk 时 chip 可绿；D8=loaded 时不暗示「仅磁盘」 |
| 模型区进度/状态行 | **D4** 磁盘 | catalog / health cache 字段 | 不得用 D5 表示所选 SKU 已下载 |
| （若展示）内存提示 | **D8** RAM | `funasr_loaded_model_id` | warmup 后 loaded；换 File 后 disk |
| 一键准备 / 转写按钮 | D7 + busy | `prepareModelBusy` / `busy` | busy 时 Close Gate 阻止换 File |

### 矛盾场景（必测）

1. **D4 真 + D8=disk + D5 可转写**：seed 完成、未 warmup — chip 绿，RSS ~500MB。  
2. **D4 真 + D8=loaded**：转写完成后 — 四灯仍可用，但 D8 不得伪装成「仅磁盘就绪」。  
3. **D8 disk 与 D5**：unload 后 `ready_for_transcribe` 仍可为 true（磁盘齐），`selected_model_ready=false`。

---

## 验收标准

### 机器闸门

- [ ] `cd services/asr && pytest tests/test_model_unload.py -q`
- [ ] `npm run typecheck && npm run test && npm run lint`
- [ ] `node scripts/check-architecture-guard.mjs`
- [ ] `bash scripts/smoke-asr-sidecar-health.sh`（含 unload 断言）
- [ ] `npm run asr:build-sidecar-unix` 后 preflight 通过

### 行为

- [ ] `POST /v1/models/unload` 在 warmup 后使 `funasr_loaded_model_id=null`
- [ ] 重复 unload **200 幂等**
- [ ] transcribe 进行中 unload 返回 **409**（或 sidecar 等价拒绝）
- [ ] 空闲 `currentFileId` A→B 触发 unload（单测 + 手测）
- [ ] transcribe busy 时 **无法**换 File（现有 Close Gate，回归）
- [ ] unload **不**删除 App Data `models/` 目录（D4 仍真）

### 性能（手测 · release .app）

| # | 步骤 | 通过标准 |
|---|------|----------|
| H1 | 转写 2min 音频 → 记 sidecar RSS | ≥2GB |
| H2 | 同 File 内滚 waveform + 列表 10s | 主观记录（baseline 卡顿） |
| H3 | 空闲切到 Project Hub 或另一 File | ≤3s 内 RSS **<600MB**；health `loaded=null` |
| H4 | 再滚 waveform + 列表 10s | 主观 **优于 H2** |
| H5 | 回到原 File 再转写 | wall time 较 H1 **≤+8s**（reload 可接受） |

### 文档

- [ ] `CONTEXT.md` 含 D8 / Model unload / Unload on idle file switch
- [ ] v0.1.8 checklist §WARN 或 signoff 引用本 acceptance

---

## TDD 交付物

| 测试 | 路径 |
|------|------|
| unload API | `services/asr/tests/test_model_unload.py` |
| memory state | `apps/desktop/src/services/asr/asrModelMemoryState.test.ts` |
| client | `apps/desktop/src/services/asr/asrModelUnload.test.ts` |
| hook | `apps/desktop/src/pages/useAsrModelUnloadOnFileSwitch.test.ts` |
| presentation | `apps/desktop/src/services/asr/asrEnvStatus.test.ts`（D8 行） |

---

## 不做什么（回归 guard）

- 不修改 `useTierScrollSync` / band canvas 行为
- 不默认 `POST /v1/models/warmup` on app ready（保持 defer）
- 不在 prepare/seed 路径调用 unload

---

## 签收

| 项 | 填写 |
|----|------|
| 日期 | |
| 版本 | v0.1.8.1 |
| H1–H5 | ☐ |
| 机器闸门 | ☐ |
| 结论 | ☐ Go ☐ No-Go |

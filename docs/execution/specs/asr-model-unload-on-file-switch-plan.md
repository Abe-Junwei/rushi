# Plan：空闲换 File 卸载侧车权重（v0.1.8.1 · D1）

> **Research**：[`asr-model-unload-on-file-switch-research.md`](./asr-model-unload-on-file-switch-research.md)  
> **Acceptance**：[`asr-model-unload-on-file-switch-acceptance.md`](./asr-model-unload-on-file-switch-acceptance.md)  
> **术语**：[`CONTEXT.md`](../../../CONTEXT.md) — D8 · Model unload · Unload on idle file switch

---

## 0. 目标与非目标

### 目标

- 空闲 **换 File**（`currentFileId` 变化，含回 **Project Hub**）后，侧车 **卸 FunASR RAM**，RSS 回到 ~500MB 级。
- **D8** 进入 chip / 四灯 / env banner；不与 D4/D5 混用。
- 侧车暴露 **`POST /v1/models/unload`**；smoke gate 覆盖。

### 非目标（v0.1.8.1）

- 波形 scroll unified stage / band-ruler 优化
- 环境页「释放内存」手动按钮（v0.1.8.2 可选）
- 修改 `RUSHI_ASR_IDLE_STOP_SEC` 默认值
- 清除 App Data 模型缓存

---

## 1. 实现步骤

### Step 1 — Sidecar API（Python）

1. 在 [`app.py`](../../../services/asr/rushi_asr/app.py) 增加 `POST /v1/models/unload`：
   - 持 `runtime_lock()` 调用现有 `invalidate_funasr_model_cache()`
   - 200：`{ status, funasr_loaded_model_id: null, funasr_model_id }`
   - 若 transcribe job 进行中 → **409** `model_unload_transcribe_busy`（与 TS 侧 C2 双保险）
2. 根路由 `/` JSON 增加 `unload_model` 文档键（与 `warmup_model` 并列）。
3. 测试：[`test_model_unload.py`](../../../services/asr/tests/test_model_unload.py) — warmup → unload → health `loaded=null`；重复 unload 幂等。

**验证**：`cd services/asr && pytest tests/test_model_unload.py -q`

### Step 2 — Desktop service

1. 新 [`asrModelUnload.ts`](../../../apps/desktop/src/services/asr/asrModelUnload.ts)：
   - `postAsrModelUnload(): Promise<UnloadResult>`
   - loopbackFetch + 8s timeout；失败 swallow + log（不阻塞换 File）
2. 新 [`asrModelMemoryState.ts`](../../../apps/desktop/src/services/asr/asrModelMemoryState.ts)（纯函数）：
   - `deriveModelMemoryState(healthJson): 'disk' | 'loaded' | 'unloading'`
   - 读 `funasr_loaded_model_id` / `selected_model_ready`

**验证**：`npm run test -w @rushi/desktop -- asrModelUnload asrModelMemoryState`

### Step 3 — 生命周期 hook

1. 新 [`useAsrModelUnloadOnFileSwitch.ts`](../../../apps/desktop/src/pages/useAsrModelUnloadOnFileSwitch.ts)：
   - 监听 `currentFileId`（prev !== next）
   - 跳过：首次 mount、`busy`（transcribe/prepare）、`!isTauriRuntime()`
   - 调用 `postAsrModelUnload()`；可选短 debounce 0ms（同 tick 内 hub→file 不双调）
2. 接入 [`useProjectLifecycleWiring.ts`](../../../apps/desktop/src/pages/useProjectLifecycleWiring.ts)（或 `useProjectAsrBridgeStack`）— **仅 wiring**，业务在 hook/service。

**验证**：hook 单测 mock fileId A→B、busy 时不调用。

### Step 4 — D8 presentation

1. [`asrEnvStatus.ts`](../../../apps/desktop/src/services/asr/asrEnvStatus.ts)：
   - `buildAsrEnvPresentation` 输入增 `modelMemoryState`
   - D4 仍驱动「磁盘/cache」；D8 驱动「内存已加载」文案（如四灯一行「权重在内存 · 占 RAM」仅 loaded）
2. [`useAsrBridgeController.ts`](../../../apps/desktop/src/pages/useAsrBridgeController.ts)：`refreshAsrHealth` 后 derive D8。
3. 更新 [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) §2 表格 **D8** 行。

**验证**：[`asrEnvStatus.test.ts`](../../../apps/desktop/src/services/asr/asrEnvStatus.test.ts) — loaded vs disk chip 不矛盾。

### Step 5 — Smoke + 文档

1. [`scripts/smoke-asr-sidecar-health.sh`](../../../scripts/smoke-asr-sidecar-health.sh)：warmup OK 后 unload OK，`funasr_loaded_model_id` empty。
2. v0.1.8 checklist §WARN 一条（转写后换 File 可恢复 scroll；同 File 再转写 +reload）。
3. 重建 sidecar + `npm run asr:build-sidecar-unix`（release 手测前）。

**验证**：`bash scripts/smoke-asr-sidecar-health.sh` · 全仓 `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

---

## 2. 文件清单

| 文件 | 动作 |
|------|------|
| `services/asr/rushi_asr/app.py` | +unload route |
| `services/asr/tests/test_model_unload.py` | 新增 |
| `apps/desktop/src/services/asr/asrModelUnload.ts` | 新增 |
| `apps/desktop/src/services/asr/asrModelMemoryState.ts` | 新增 |
| `apps/desktop/src/pages/useAsrModelUnloadOnFileSwitch.ts` | 新增 |
| `apps/desktop/src/pages/useProjectLifecycleWiring.ts` | 接线 |
| `apps/desktop/src/services/asr/asrEnvStatus.ts` | D8 |
| `docs/architecture/desktop-capability-ui-state-alignment.md` | D8 |
| `scripts/smoke-asr-sidecar-health.sh` | gate |

---

## 3. TDD 顺序（vertical）

```text
1. pytest unload endpoint (no model → 200 noop)
2. pytest warmup → unload → loaded null
3. TS deriveModelMemoryState tests
4. TS postAsrModelUnload mock fetch
5. hook: file switch calls unload; busy skips
6. asrEnvStatus D8 row copy
7. smoke script
```

---

## 4. 回滚

- 侧车无 unload 路由时 hook catch 静默失败（旧包兼容）。
- Feature flag 非必须；若需：`RUSHI_ASR_UNLOAD_ON_FILE_SWITCH=0` env（默认开）— 仅当手测异常再加。

---

## 5. 后续薄片（不在本 plan）

| 薄片 | 内容 |
|------|------|
| v0.1.9 scroll | [`waveform-unified-scroll-stage-plan.md`](./waveform-unified-scroll-stage-plan.md) |
| v0.1.8.2 UX | 环境页「释放内存」按钮 |
| ASR-WARM 文档 | 修订 acceptance「连续两次转写」为 **同 File 不 unload** 场景 |

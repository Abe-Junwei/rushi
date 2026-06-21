# 调研：空闲换 File 卸载侧车权重（D8 · v0.1.8.1）

> **状态**：已采纳（2026-06-21 · grill + 实测）  
> **Grill 结论**：编辑滚动优先（A）· 空闲换 File unload（B2）· busy 不换 File（C2）· v0.1.8.1 仅 ASR 轨（D1）  
> **术语**：[`CONTEXT.md`](../../../CONTEXT.md) — **D8 侧车权重内存**、**Model unload**、**Unload on idle file switch**  
> **关联**：[`asr-warm-acceptance.md`](./asr-warm-acceptance.md) · [`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md)（scroll 重构 **另薄片**）· [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) §2 D8  
> **Plan / Acceptance**：[`asr-model-unload-on-file-switch-plan.md`](./asr-model-unload-on-file-switch-plan.md) · [`asr-model-unload-on-file-switch-acceptance.md`](./asr-model-unload-on-file-switch-acceptance.md)  
> **门禁**：Plan 定稿前本文 ✅；编码前须链接 plan + acceptance

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | v0.1.8 release 手测 **场景 C**：四灯绿、纯 **Editor** 内滚波形/语段列表仍明显发涩；未改 scroll 代码。 |
| **本仓现状** | **Plan B** seed 后侧车常驻；**ASR-WARM** 默认 defer warmup（`asr_warmup_deferred_until_transcribe`）→ 编辑前 RSS ~**518MB**。**转写或 `POST /v1/models/warmup` 后** Paraformer 三件套进 RAM → RSS ~**2982MB**（2026-06-21 实测，`/Applications/如是我闻.app`）。波形 scroll 热路径见 [`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md)；JS mock 绘制 ~0.02ms/帧，卡顿主因是 **系统内存压力 + WebView**，非 scroll 算法回归。Python 已有 **`invalidate_funasr_model_cache()`**（[`funasr_engine_load.py`](../../../services/asr/rushi_asr/funasr_engine_load.py)），**无**对外 `POST /v1/models/unload`；换 File 路径经 **`useProjectCloseGateController.openFileWrapped`**（[`useProjectLifecycleWiring.ts`](../../../apps/desktop/src/pages/useProjectLifecycleWiring.ts)）。 |
| **成功标准** | 空闲换 File 后 sidecar RSS **<600MB**；`/health.funasr_loaded_model_id=null`；同 File 再转写 reload **≤8s**（接受 +3–8s vs 常驻 hot）；手测同项目换 File 后 scroll 主观优于转写后 hot 态。 |

### 1.1 实测摘要（2026-06-21）

| 状态 | sidecar RSS | `funasr_loaded_model_id` | `selected_model_ready` |
|------|-------------|--------------------------|------------------------|
| defer warmup（磁盘就绪） | ~518 MB | `null` | `false` |
| `POST /v1/models/warmup` 后 | ~2982 MB | Paraformer hub id | `true` |
| `kill 8741` 后 | 0 | — | — |

`vm_stat Pages free` 在 kill ~3GB 侧车后约 **+3GB** 可用页。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **显式 unload + idle 计时** | Epicenter ModelManager、Yapper WhisperService | `load → transcribe → unload_model()`；5min idle 卸权重 | [Epicenter #889](https://github.com/onel/epicenter/commit/41dfbced4abc326eb97d5aaf857e71524e5f8744) |
| **B** | **推理与 UI 生命周期分离** | Descript Web/Desktop 新引擎 | 重 ML 放后端/流式；编辑客户端轻量 | [Descript changelog 2024](https://descript.canny.io/changelog/instant-performance-upgrades-with-descript-for-web-and-the-new-desktop-preview) |
| **C** | **Scroll 零 React + 虚拟化** | Figma Layers、WaveSurfer v7 | 滚动热路径不 commit；canvas 分块 lazy | [Figma blog](https://www.figma.com/blog/improving-performance-in-the-layers-panel/) · [WS performance](https://wavesurfer.xyz/docs/performance/) |
| **D** | **进程级 idle stop** | Rushi ASR-WARM `RUSHI_ASR_IDLE_STOP_SEC` | 杀 bundled 侧车进程 | [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 冲突 | 备注 |
|------|--------|----------|---------------|------|
| **A unload** | **高** | `invalidate_funasr_model_cache()` + 新 HTTP 路由 | 须与 transcribe lock 共存 | **v0.1.8.1 选定** |
| **B 云 offload** | 低 | — | 产品约束：本机 ASR | 不选 |
| **C scroll 重构** | 中 | tierScrollFrameCoordinator、band 可见窗 | 工作量大 | **v0.1.9+ 另薄片**（见 waveform research） |
| **D idle stop** | 中 | `warm.rs` `maybe_idle_stop` | 杀进程 → 再转写冷启动更重 | 保留；与 unload **互补**（unload=RAM，stop=进程） |

**本仓必须先复用：**

- `invalidate_funasr_model_cache()` — 已实现 gc + `torch.cuda.empty_cache()`（prepare 路径已在用）
- `loopback_models_cached_not_memory_ready()` + defer warmup — 保持默认
- `mergeArtifactBusyState` / Close Gate — busy 时不换 File（C2）
- `buildAsrEnvPresentation` / D7 overlay — 扩展 **D8**，禁止 D5 暗示 RAM 已加载

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **空闲换 File → `POST /v1/models/unload`**（包装 `invalidate_funasr_model_cache`）；保留 sidecar 进程与 **D4 磁盘缓存**；UI 暴露 **D8**（disk / loaded / unloading） |
| **不做什么** | ❌ v0.1.8.1 不改 waveform scroll 架构 · ❌ 不清 App Data 模型目录 · ❌ busy 时换 File unload · ❌ 默认常驻 ~3GB「转写性能优先」（不设为默认） · ❌ 替代 ASR-WARM idle stop |
| **与 ADR / architecture** | 对齐 [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)「CPU 可用」；**修订 ASR-WARM 产品默认**：编辑优先 > 连续两次转写零劣化（手测 WARN：换 File 后再转写 +reload） |
| **风险** | unload 与进行中的 sidecar 推理竞态 → **C2 + runtime_lock**；MPS/CUDA 释放不完全 → 手测 RSS 阈值；adopt 外部 8741 时 unload 仍有效 |

### 4.1 与 ASR-WARM 关系

| 策略 | 粒度 | v0.1.8.1 |
|------|------|----------|
| defer warmup | 不在启动时 load RAM | 保持 |
| unload on file switch | 卸 AutoModel singleton | **新增** |
| idle stop | 杀 bundled 进程 | 保持默认 900s；不改为本薄片主路径 |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| Python | `services/asr/rushi_asr/app.py` | `POST /v1/models/unload` |
| Python | `funasr_engine_load.py` | 可选 `unload_funasr_model()` 薄包装 + 返回 body |
| Python | `services/asr/tests/test_model_prepare.py` 或新 `test_model_unload.py` | unload 503/200、health 字段 |
| TS service | `apps/desktop/src/services/asr/asrModelUnload.ts`（新） | loopback POST |
| TS lifecycle | `useProjectLifecycleWiring.ts` 或 `useAsrModelUnloadOnFileSwitch.ts` | `currentFileId` 空闲变化 → unload |
| TS presentation | `asrEnvStatus.ts` / `asrEnvPresentationRows.ts` | **D8** chip/四灯 |
| Rust | 无必须改动 | smoke 脚本可选断言路由存在 |
| 脚本 | `scripts/smoke-asr-sidecar-health.sh` | `POST /v1/models/unload` ≠ 404 |
| 文档 | `desktop-capability-ui-state-alignment.md` §2 | D8 行 |
| 测试 | `asrModelUnload.test.ts`、hook 单测 | RED→GREEN 垂直薄片 |

---

## 6. 签收

- [x] 调研 brief 完成
- [ ] plan / acceptance 定稿并链接本文
- [ ] 用户确认进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：grill A/B2/C2/D1 + release 实测 518MB→2982MB |

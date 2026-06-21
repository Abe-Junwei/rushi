# Plan：方案 E — 可选离线 ASR 模型包

> **历史状态**：v0.1.8 起已停止离线模型包（Route E）；当前为 Plan B（随包模型）。本文档及关联脚本仅保留历史记录，实现以 [`asr-bundled-models-plan-v2.md`](./asr-bundled-models-plan-v2.md) 及当前代码为准。

> **Research**：[`asr-bundled-models-research.md`](./asr-bundled-models-research.md)  
> **状态**：**已由 v0.1.8 方案 B 取代** — 见 [`asr-bundled-models-plan-v2.md`](./asr-bundled-models-plan-v2.md)；路线 E 代码 **待拆除**；**暂停** P8–P10 zip 手测  
> **路线**：~~**E**~~ — ~~主 DMG 不带模型；Release 额外产出 zip~~ **（撤回）**

---

## 1. 目标

| 项 | 内容 |
|----|------|
| 用户场景 | 无法或不愿用 ModelScope 在线下载；希望 U 盘/第二下载获得默认 Paraformer 三件套 |
| 成功标准 | 导入 zip → App Data `models/modelscope/…` 齐备 → `/health.funasr_required_models_cached=true` → 可转写 |
| 非目标 | 主 DMG 增肥；改默认引擎；SenseVoice 随包 |

---

## 2. 产物布局

### 2.1 离线包 zip（平台无关，一份/tag）

```text
manifest.json
NOTICE.txt
modelscope/models/iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch/
modelscope/models/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch/
modelscope/models/iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch/
```

`manifest.json`：`pack_version`、`bundle_id`（`default-paraformer-v1`）、`models[]`（hub_id + required_files）。

### 2.2 App Data（与现有一致）

Seed 目标：`{app_data}/models/modelscope/models/iic/…`（同 `model_prepare_cache.py` / `apply_asr_model_env`）。

Marker：`{models_root}/.rushi-offline-seed.json`（pack `bundle_id` + 导入时间）。

---

## 3. 实现切片

| # | 项 | 落位 |
|---|-----|------|
| E1 | 发版构建 + preflight | `scripts/build-offline-asr-models-pack.sh`、`scripts/preflight-offline-asr-models-pack.sh` |
| E2 | 壳导入 seed | `apps/desktop/src-tauri/src/project/offline_asr_models_pack.rs` |
| E3 | UI | `EnvLocalAsrModelCard`：导入离线包 + Release 下载说明 |
| E4 | Release 第二 asset | CI tag 构建 zip + `gh release upload`（与 DMG 并列） |
| E5 | Policy 增补 | `asr-sidecar-funasr-policy.md` § 可选离线包 |

保留：**ModelScope prepare** 为在线路径；**清除模型缓存** 语义不变。

---

## 4. UX 文案

- 说明：**「默认 Paraformer 可下载离线模型包（约 1.2 GB），导入后无需联网。」**
- 进行中：**「正在准备内置语音模型…」**（不用「下载」）
- 就绪：沿用 **「当前模型已就绪」**

---

## 5. 验证

```bash
# 构建离线包（需联网，~1.2 GB）
npm run asr:build-offline-models-pack
npm run asr:preflight-offline-models-pack

# 壳单测
cargo test offline_asr_models_pack --manifest-path apps/desktop/src-tauri/Cargo.toml

# 机器闸门
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

手测（Release .app）：

1. Fresh App Data，断网。
2. 环境页 → **导入离线模型包** → 选 zip。
3. 等待 seed → 重启侧车 → 转写短音频。

---

## 6. 能力—UI 状态矩阵

| UI | 维度 | 数据源 |
|----|------|--------|
| 「导入离线模型包」 | D1 + D4 | 导入成功后 refresh `/health` |
| 下载说明链接 | — | GitHub Release asset URL |
| 在线「下载当前模型」 | D1 | 保留 prepare 路径 |

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 路线 E Plan 初版 |
| 2026-06-21 | **取代**：v0.1.8 改方案 B（[`asr-bundled-models-plan-v2.md`](./asr-bundled-models-plan-v2.md)）；E 待拆除 |

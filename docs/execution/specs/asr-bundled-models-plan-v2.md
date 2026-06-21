# Plan v2：随包默认 Paraformer + 首启 seed（方案 B · v0.1.8）

> **Research**：[`asr-bundled-models-research.md`](./asr-bundled-models-research.md)（§5.2 路线 E → **本 Plan 取代**）  
> **Grill 定稿**：2026-06-21（B / B1 / S1 / M3 / P-both / DMG-only / 无老用户）  
> **Implementation**：[`asr-bundled-models-implementation-v2.md`](./asr-bundled-models-implementation-v2.md)  
> **取代**：[`asr-bundled-models-plan.md`](./asr-bundled-models-plan.md)（路线 E — **v0.1.8 撤回，代码待拆除**）  
> **Policy**：[`docs/architecture/asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) §0 / §5（须同步修订）

---

## 1. 目标

| 项 | 内容 |
|----|------|
| 用户场景 | **纯小白**：安装 macOS/Windows 安装包 → **首次打开** → 自动准备默认 Paraformer → **断网可转写** |
| 成功标准 | 首启 seed 完成 → App Data `models/modelscope/…` 齐备 → D1 就绪 → 短音频可转写 |
| 平台 | **macOS DMG + Windows 安装包**（P-both）；Linux 终端矩阵仍不含随包 seed |
| 非目标 | ONNX 随包；SenseVoice 随包或目录展示；ModelScope prepare；路线 E zip；**v0.1.8 OTA**；老用户/向后兼容 |

---

## 2. 产物与体积

### 2.1 安装包内布局（每平台一份）

```text
Resources/…/bundled-asr-models/   # 或 tauri bundle.resources 等价路径
  manifest.json
  NOTICE.txt
  LICENSE-APACHE-2.0.txt
  modelscope/models/iic/…           # 默认 Paraformer 三件套（与 E 包同构）
```

体积预估（research §4.2）：安装包 **+~1.21 GB** 模型；DMG/Windows 安装包压缩后约 **1.3–1.6 GB**（须发版前 **实测**）。

### 2.2 App Data（与现有一致）

Seed 目标：`{app_data}/models/modelscope/models/iic/…`（同 `model_prepare_cache.py` / `apply_asr_model_env`）。

Marker：可复用 `.rushi-offline-seed.json` 或重命名为 `.rushi-bundled-seed.json`（实现时二选一，勿双 marker 真源）。

### 2.3 发布渠道

| 条件 | 动作 |
|------|------|
| 单文件 **< 2 GB** | 上传 **GitHub Release**（同 tag 下 macOS + Windows asset） |
| 单文件 **≥ 2 GB** | **该平台**安装包改 **站外下载** + checksum；Release 页/应用内说明链接 |

**v0.1.8**：**不做 OTA**（不产 `app.tar.gz` / `latest.json` updater 推送）。

---

## 3. UX（S1 + M3）

| 阶段 | 行为 |
|------|------|
| 首次打开应用 | 自动 **首启 seed**（前台/阻塞）；文案 **「正在准备内置语音模型…」** |
| seed 完成前 | **不可本机转写**（D1 未就绪） |
| seed 完成后 | 默认 Paraformer **D1 就绪**；**断网可转写** |
| 环境页 | **无**「准备当前模型 / ModelScope 下载」主路径；**无** SenseVoice 选项（目录仅 Paraformer） |
| 清除模型缓存后 | 可从 **随包资源再次 seed**（非 zip 导入） |

---

## 4. 实现切片（编码前落位预告）

| # | 项 | 落位 / 动作 |
|---|-----|------------|
| B1 | 构建：模型进 bundle | `tauri.conf.json` `bundle.resources`；CI 构建前 `snapshot_download` + preflight |
| B2 | 首启 seed | 复用/瘦身 `offline_asr_models_pack.rs` **copy/validate** → `bundled_asr_models_seed.rs`；**删除** zip 导入 UI/命令 |
| B3 | 移除路线 E | 删 zip 脚本 CI job、导入 UI、`pick_and_import_*`、Release 第二 asset |
| B4 | 目录 | `localAsrModelCatalog` / UI：**仅默认 Paraformer** |
| B5 | prepare 栈 | 移除或 gate 默认 SKU 的 ModelScope prepare（M3） |
| B6 | Policy / 清单 | 本 Plan + policy §0/§5 + v0.1.8 手测 P8'–P10' |
| B7 | 合规 | Apache 2.0 NOTICE 随 `bundled-asr-models` |

**复用评估**：E2 的 copy、manifest 校验、rollback 可迁移；E3/E4 **整段删除**。

---

## 5. 手测（取代原 P8–P10 · zip 导入 **暂停**）

在 **Release 候选安装包**（非 dev）上：

| ID | 操作 | 期望 |
|----|------|------|
| **P8′** | Fresh App Data + **断网** + **首次打开应用** | 自动 seed；文案「正在准备内置语音模型…」+ 进度；**无** zip 导入、**无** ModelScope |
| **P9′** | P8′ 完成后 | 本机 ASR 可转写短音频；仍断网 |
| **P10′** | 环境页「所选模型」 | **仅 Paraformer**；**无** SenseVoice 条目 |

**Tag 闸门**：P8′–P10′ + 既有 P1–P7 **Go** 后方可 `v0.1.8` tag。

---

## 6. 能力—UI 状态矩阵（v0.1.8）

| UI | 维度 | 数据源 |
|----|------|--------|
| 首启 seed 进度 | D1 + D4 | seed 事件 + `/health` |
| 转写模型区 | D1 | seed 完成后 `selected_model_ready` |
| ~~导入离线包~~ | — | **移除** |
| ~~在线 prepare~~ | — | **移除（M3）** |

---

## 7. 验证（机器闸门）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
# 构建含模型的 release 候选（mac + win）
# cargo test bundled_asr_models_seed --manifest-path apps/desktop/src-tauri/Cargo.toml
```

---

## 8. 明确不做什么

- 路线 E 离线 zip 与 Release 第二 asset  
- v0.1.8 macOS OTA / `latest.json`  
- SenseVoice SKU 与 ModelScope 下载 UI  
- ONNX / 多 SKU 随包  
- v0.1.7 升级 / 路线 E 导入兼容  

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-21 | Grill 定稿 v2：方案 B 取代 E；tag 阻塞至 P8′–P10′ |

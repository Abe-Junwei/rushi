# 调研：ASR 模型「开箱即用」方案评估

> **状态**：调研完成（2026-06-20）  
> **关联架构**：[`docs/architecture/asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)  
> **关联代码**：
> - `services/asr/rushi_asr/defaults.py`
> - `services/asr/rushi_asr/model_prepare_cache.py`
> - `services/asr/rushi_asr/runtime_caps.py`
> - `apps/desktop/src-tauri/src/bundled_asr_assets.rs`
> - `apps/desktop/src-tauri/src/project/app_data_paths.rs`
> - `apps/desktop/src-tauri/tauri.conf.json`
> - `scripts/build-asr-sidecar-unix.sh`

---

## 1. 目标重述

让用户安装 DMG 后**无需联网下载默认模型**即可转写。当前默认路径是「侧车随包、模型首次联网下载」；本调研评估改为「默认模型权重随包 + 首次启动 seed 到 App Data」的可行性、代价与风险。

---

## 2. 当前架构真源

### 2.1 默认 SKU（Paraformer 三件套）

| 角色 | ModelScope repo ID | 当前获取方式 |
|------|-------------------|-------------|
| 识别（ASR） | `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch` | 首次启动联网 `snapshot_download` |
| VAD | `iic/speech_fsmn_vad_zh-cn-16k-common-pytorch` | 同上 |
| 标点（PUNC） | `iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch` | 同上 |

代码真源：`services/asr/rushi_asr/defaults.py:8-12`

### 2.2 缓存路径

- `RUSHI_MODELS_ROOT` = `~/Library/Application Support/studio.lingchuang.rushi/models`
- `MODELSCOPE_CACHE = {RUSHI_MODELS_ROOT}/modelscope`
- 侧车启动时通过 `apply_asr_model_env` 注入这些环境变量（`asr_sidecar/bundled/process.rs:135-145`）。
- `/health` 通过 `funasr_required_models_cached` / `ready_for_transcribe` 反映缓存是否完整（`runtime_caps.py:32-68`）。

### 2.3 打包现状

`tauri.conf.json` 当前 `bundle.resources` 只包含侧车（`resources/bundled-asr`，约 **839 MB**），**不包含模型权重**。

---

## 3. 方案对比

| 方案 | 描述 | 安装包增量 | 首启体验 | 技术复杂度 | 与现有策略冲突 |
|------|------|-----------|----------|-----------|---------------|
| **A（现状）** | 侧车随包，模型首次联网下载 | 0 | 需下载约 1.2 GB | 低 | 无 |
| **B（用户提案）** | 侧车 + PyTorch 三件套随包，首启 copy 到 App Data | **+1.2 GB** | 本地 copy 几十秒～几分钟 | 中 | **与 ADR 直接冲突** |
| **C（只读 bundle）** | 把 `MODELSCOPE_CACHE` 指向 `.app/Resources/asr-models` 只读路径 | +1.2 GB | 无 copy | 中低 | 与 ADR 冲突；升级/签名/写缓存风险 |
| **D（ONNX 量化 bundle）** | 用 `fixtures/sherpa-paraformer-zh-2023-09-14` 等 ONNX 路径替代 PyTorch 三件套 | **+~500 MB**（估算） | 本地 copy 或只读 | 高（需验证推理等价性） | 需更新策略 |
| **E（可选离线包）** | 主 DMG 仍不带模型；首次启动时从可选 `rushi-models.dmg`/下载包 seed | 0（主包） | 用户主动选择后离线可用 | 中 | 最小 |

---

## 4. 关键事实与代价

### 4.1 模型体积（用户提案低估）

| 模型 | ModelScope 标称大小 |
|------|-------------------|
| Paraformer-large-vad-punc | **909.6 MB** |
| FSMN-VAD | **4.0 MB** |
| CT-Transformer-punc（272727） | **296.4 MB** |
| **合计** | **~1.21 GB** |

> 用户原提案写 "+0.3～2 GB"，实际默认 PyTorch 三件套就是 **1.21 GB**，接近上限。

### 4.2 安装包/OTA 影响

当前 macOS arm64 产物体积：

| 产物 | 当前大小 | +1.2 GB 模型后预估 |
|------|---------|-------------------|
| `.app` | ~1.1 GB | ~2.3 GB |
| DMG | ~378 MB | **~1.3–1.6 GB** |
| updater `.tar.gz` | ~386 MB | **~1.3–1.6 GB** |

**风险**：
- GitHub Release 单文件上限 **2 GB**；DMG/tar.gz 很可能触碰或突破。
- 每次小版本 OTA 更新都要重新下载 ~1.5 GB，失去增量更新意义。
- macOS notarization 上传时间与失败风险显著增加。
- CI runner 磁盘/artifact 配额压力。

### 4.3 许可证/合规

- 三个模型均为 **Apache License 2.0**，**允许再分发**。
- 但必须：保留版权声明、附带 Apache 2.0 许可证副本、保留 `NOTICE`（如有）、标注来源（Alibaba / 通义实验室 / ModelScope）。
- 建议：在 `resources/asr-models/` 内放置 `LICENSE` + `NOTICE` 文件，列明模型 ID 与来源 URL。

### 4.4 策略冲突

`docs/architecture/asr-sidecar-funasr-policy.md` 当前明确：

> “采用 B. 推理侧车：torch + FunASR 打进侧车；**模型权重外置**（首次联网下载到本机缓存）。”
> 磁盘预算：用户侧总计约 5GB，其中侧车 ≤2.0–2.5GB，模型缓存占用余量。

若改为随包带权重，**必须同步修订该 ADR**。

---

## 5. 建议

### 5.1 对用户原提案（方案 B）的评估

**方向正确，但默认 PyTorch 三件套体积过大，直接塞进主 DMG 会触发 GitHub 2 GB 上限、OTA 膨胀、notarization 风险，并与已定 ADR 冲突。**

不建议直接按原提案实施，除非：
- 能接受安装包 >2 GB 并更换发布渠道；
- 或改用更小的模型 SKU。

### 5.2 更稳妥的路线

| 优先级 | 路线 | 理由 |
|--------|------|------|
| **推荐** | **方案 E：可选离线包** | 主 DMG 不变；首次启动检测到无网络/无缓存时，引导用户下载一个离线模型包（或 CI 额外产出 `rushi-models.dmg`），seed 到 App Data。保留当前架构，不触碰 2 GB 上限。 |
| **次选** | **方案 D：ONNX 量化 bundle** | 若推理质量等价，可把安装包增量压到 ~500 MB，DMG 仍可能 <1 GB。但需要一次完整的精度/性能验证。 |
| **可选** | **方案 B'：仅 bundle 最小必需模型** | 例如只 bundle VAD（4 MB）+ 一个小 ASR，首启后后台拉 Paraformer。体验不极致，但降低阻塞。 |
| **不推荐** | **方案 B：原样 bundle PyTorch 三件套** | 体积、OTA、策略三重风险。 |

### 5.3 如果坚持方案 B，必须接受的硬条件

1. 修订 `docs/architecture/asr-sidecar-funasr-policy.md`。
2. 解决 GitHub Release 2 GB 上限（分拆产物、换 CDN、或放弃 GitHub Release）。
3. 重新设计 OTA 更新策略（模型与壳分离更新）。
4. 在产物中加入 Apache 2.0 license/attribution。
5. 手测验证 notarization 与 CI runner 磁盘。

---

## 6. 待决策问题

1. 是否能接受主 DMG 超过 1 GB？上限是多少？
2. 是否允许修订 `asr-sidecar-funasr-policy.md` 的「模型外置」决策？
3. 是否愿意评估 ONNX 量化路径（方案 D）？
4. OTA 更新是否必须与模型解耦？
5. 目标用户中「首次安装时完全离线」的比例有多高？

---

## 7. 落位预告（若进入实施）

| 文件 | 作用 |
|------|------|
| `docs/execution/specs/asr-bundled-models-plan.md` | 选定路线后的实施计划 |
| `scripts/build-bundled-asr-models.sh` | 发版前拉取/校验模型 |
| `apps/desktop/src-tauri/resources/asr-models/` | 模型权重落位 |
| `apps/desktop/src-tauri/src/bundled_asr_models.rs` | 首启 seed / marker / 版本比对 |
| `apps/desktop/src-tauri/tauri.conf.json` | 注册模型资源目录 |

---

## 8. 签收

- [x] 当前架构与模型体积已核实
- [x] 许可证与策略冲突已识别
- [x] 产品/决策层确认路线（**E — 可选离线包**）
- [ ] 进入 Plan 阶段 → 见 [`asr-bundled-models-plan.md`](./asr-bundled-models-plan.md)

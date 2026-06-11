# R3s-A 完整实现路径（代码对照版）

> **Research**：[r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md)  
> **Intent / Acceptance**：同目录 `*-intent.md` / `*-acceptance.md`  
> **ADR**：[ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md)  
> **状态**：2026-06-11 代码审查后定稿

---

## 0. 现状快照（代码真源）

### 已有、可复用

| 资产 | 路径 | 说明 |
|------|------|------|
| Sherpa Qwen3 spike | `apps/desktop/src-tauri/spike/sherpa_qwen3/` | `resolve_qwen3_model_dir`、`build_qwen3_recognizer`、`recognize_wav_vad`；**独立 crate**，未链入主 `rushi-desktop` |
| sherpa-onnx 依赖 | spike `Cargo.toml` | `sherpa-onnx = 1.13.2`；主 crate **无** 此依赖 |
| ONNX 下载 | `scripts/r3g-b-download-sherpa-qwen3-onnx.sh` | ModelScope / GitHub → `fixtures/sherpa-qwen3-asr-0.6B` |
| VAD 模型 | `fixtures/sherpa-vad/silero_vad.onnx` | spike `p2_vad.rs` 已用 |
| 段契约解析 | `project/transcribe_response.rs` | `parse_transcribe_segments_from_json` 要求 `start_sec/end_sec/text` |
| 段落库 | `run_transcribe_cmd.rs` → `save_transcribe_segments` | 统一 SQLite 写入；**所有引擎必须产出同形 JSON** |
| 音频解码 | `symphonia` + `waveform_peaks_ffmpeg.rs` | 主 crate 已有 MP3/WAV；Sherpa 需 **16 kHz mono** |
| bundled ffmpeg | `bundled_asr_assets::resolve_bundled_ffmpeg` | 可复用 remux → PCM WAV |
| LRC 侧车下载 | `local_runtime/` | 现仅 **PyInstaller 侧车** artifact；**无 ONNX 权重 manifest** |
| Catalog | `localAsrModelCatalog.ts` + `model_catalog.py` | **仅 Paraformer** 一条 SKU |
| 转写门控 | `local_transcribe_gate.rs` | **100% 绑定 8741 /health + FunASR 字段** |
| 本机转写入口 | `run_transcribe_cmd.rs` | blocking + async **均** `post_transcribe_*` → 8741 |
| 环境 UI | `asrEnvStatus.ts` + `computeLocalAsrTranscribeReady` | transcribeReady = 侧车 D2/D5；**无引擎维度** |
| 评估 | `eval-run.py` + D3 金标 | Phase 0 数据已有 |

### 明确不存在（须新建）

- `src/asr_sherpa/` 产品模块  
- `local_asr_engine` pref / 路由  
- Sherpa 就绪探测 Tauri 命令  
- LRC manifest 中 Qwen3 ONNX + Silero VAD artifact  
- catalog 中 `qwen3-asr-vad-0.6b`  
- `eval-run.py` 对 Sherpa 内嵌路径的支持（可选 P2）  
- async 长音频 Sherpa 路径（R3e-C 等价）

### 架构约束（须遵守）

1. **禁止** UI / 页面层调用 spike bin  
2. **禁止** fork 第二套 `save_transcribe_segments`  
3. **禁止** 用 `/health.ready_for_transcribe` 表示 Sherpa SKU 状态（R3-STATE）  
4. `run_transcribe_cmd.rs` 已 ~640 行 — 新逻辑 **下沉** `asr_sherpa/` + `local_transcribe_router.rs`，不在此文件堆业务  
5. ADR-0003/0006 仍有效：Phase 3 前默认不变

---

## 1. 目标架构

```text
                    ┌─────────────────────────────────────┐
  project_run_      │  local_transcribe_router (新)        │
  transcribe_*  ──► │  read pref: local_asr_engine         │
                    └──────────┬──────────────┬───────────┘
                               │              │
                    funasr-sidecar      sherpa-onnx
                               │              │
                    assert_local_asr_*   assert_sherpa_ready
                    post_transcribe_*    asr_sherpa::transcribe_file
                    curl 8741            symphonia/ffmpeg → 16k wav
                               │              │
                               └──────┬───────┘
                                      ▼
                         parse_transcribe_segments_from_json
                                      ▼
                         save_transcribe_segments → SQLite
```

新增状态维度（扩展 alignment doc）：

| 维度 | FunASR | Sherpa |
|------|--------|--------|
| **E1 引擎选择** | `local_asr_engine=funasr-sidecar` | `local_asr_engine=sherpa-onnx` |
| **E2 权重就绪** | D4 hub 缓存 + D5 | ONNX 目录 + VAD 文件存在 |
| **E3 运行时** | 8741 进程 | 进程内 ORT（无端口） |

---

## 2. Phase 1 — 内嵌同步转写（~2w）

### 2.1 模块升格：`asr_sherpa`

**新建** `apps/desktop/src-tauri/src/asr_sherpa/`：

```
asr_sherpa/
  mod.rs           # pub use + re-exports
  model.rs         # 从 spike/lib.rs 迁：resolve_qwen3_model_dir, build_qwen3_recognizer
  vad_pipeline.rs  # 从 spike/p2_vad.rs 迁：recognize_wav_vad
  audio.rs         # 新：任意项目音频 → 16k mono f32/wav 临时文件
  transcribe.rs    # 新：transcribe_file(path, config) -> TranscribePayload JSON
  config.rs        # 新：SherpaAsrConfig { model_dir, vad_path, provider, threads, hotwords }
  error.rs
```

**Cargo.toml 主 crate 增加**：

```toml
sherpa-onnx = "1.13.2"
```

**迁移策略**：spike crate **保留**作 CLI/benchmark；产品代码 **copy+adapt**（去掉 `Spike*` 命名），spike 可 later 依赖 `asr_sherpa` 或继续独立。

### 2.2 音频前处理 `audio.rs`

Sherpa `Wave::read` 仅稳定支持 WAV。路径：

1. 若已是 16 kHz mono WAV → 直读  
2. 否则复用 `waveform_peaks_ffmpeg::remux_audio_to_pcm_wav` 到 `app_data/tmp/sherpa-{uuid}.wav`  
3. 可选：symphonia 解码 + 重采样（后续优化，P1 可只用 ffmpeg）

参考：`waveform_peaks_cmd.rs` 已有 symphonia 解码链。

### 2.3 输出 JSON 契约

`transcribe.rs` 产出与侧车兼容的 `serde_json::Value`：

```json
{
  "engine": "sherpa-onnx-vad-qwen3-asr",
  "funasr_model_id": null,
  "segmentation_mode": "sherpa_vad",
  "duration_sec": 1195.15,
  "segments": [
    { "start_sec": 50.1, "end_sec": 51.2, "text": "…", "kind": "speech" }
  ],
  "warnings": ["segmentation_mode:sherpa_vad", "punctuation:none"]
}
```

映射：`SpikeVadSegment.index` → 丢弃；`start_sec/end_sec/text` 直传；`kind=speech`；无 `confidence` 时可省略。

### 2.4 引擎路由层

**新建** `project/local_transcribe_router.rs`：

```rust
pub enum LocalAsrEngine { FunasrSidecar, SherpaOnnx }

pub fn read_local_asr_engine(st: &DbState) -> LocalAsrEngine;
pub async fn transcribe_local_blocking(
    st: &DbState,
    audio_path: &Path,
    hotwords: Option<&str>,
    tl: Option<&mut TranscribeTimelineRecorder>,
) -> Result<(Value, Vec<String>), String>;
```

- `read_local_asr_engine`：pref 文件 `prefs/local_asr_engine.txt` 或 env `RUSHI_LOCAL_ASR_ENGINE`；默认 `FunasrSidecar`  
- Funasr 分支：现有 `assert_local_asr_ready` + `post_transcribe_multipart`  
- Sherpa 分支：`assert_sherpa_ready` + `spawn_blocking` 内 `asr_sherpa::transcribe_file`

**改** `run_transcribe_cmd.rs`：

- blocking 路径（~L397–429）：替换为 `transcribe_local_blocking`  
- async 路径（~L62–120）：Phase 1 **仍仅 FunASR**；Sherpa 返回明确错误「Sherpa 引擎暂不支持增量转写，请用 blocking 或切换 Paraformer」（Phase 2 再补）

### 2.5 Sherpa 就绪门控

**新建** `project/sherpa_transcribe_gate.rs`：

```rust
pub fn assert_sherpa_ready(st: &DbState) -> Result<SherpaResolvedPaths, String>
```

检查：

- `{models_root}/sherpa-qwen3-asr-0.6B/conv_frontend.onnx`（或 LRC 安装路径，Phase 1 可用 env `RUSHI_SHERPA_QWEN3_MODEL_DIR`）  
- `{models_root}/sherpa-vad/silero_vad.onnx`  
- 可选：bundled ffmpeg 可用（与波形一致）

**不改** `local_transcribe_gate.rs` 语义；FunASR 路径保持原样。

### 2.6 Tauri 命令（dev 诊断）

| 命令 | 用途 |
|------|------|
| `sherpa_asr_diagnose` | 返回 model/vad 路径、exists、版本 |
| （可选）`sherpa_asr_transcribe_file` | dev-only 直转写，不写 DB |

注册于 `lib.rs` + `app_commands.rs`。

### 2.7 测试

| 测试 | 落位 |
|------|------|
| `resolve_qwen3_model_dir` 缺文件 | `asr_sherpa/model.rs` 单测（从 spike 迁） |
| JSON → SegmentDto | 复用 `transcribe_response` 测 + 集成样例 |
| router 默认 funasr | `local_transcribe_router` mock HTTP |
| E2E（可选 gated） | `CARGO_TEST_SHERPA=1` + fixture ONNX 跑 3s clip |

### 2.8 Phase 1 验证清单

```bash
RUSHI_LOCAL_ASR_ENGINE=sherpa-onnx \
RUSHI_SHERPA_QWEN3_MODEL_DIR=fixtures/sherpa-qwen3-asr-0.6B \
npm run desktop:dev
# → 打开「对照」→ Sherpa 文件 → 转写 → ≥50 段
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml asr_sherpa
```

**Phase 1 出口**：G5（E2E 写库）、G7（关 8741 仍可转写）在 dev flag 下成立。

---

## 3. Phase 2 — LRC + Catalog + 双轨 UI（~2–3w）

### 3.1 LRC manifest 扩展

现 LRC（`local_runtime/manifest/`）管 **侧车 tarball**。ONNX 权重需 **新 artifact 类型** 或 **独立 manifest 条目**：

建议（与 remediation plan 对齐）：

```yaml
# runtime-manifest 新增 components[] 或 model_artifacts[]
- id: sherpa-qwen3-asr-0.6B-int8
  kind: sherpa_onnx_model
  install_dir: models/sherpa-qwen3-asr-0.6B
  sources: [modelscope..., github...]
  files_required: [conv_frontend.onnx, encoder.int8.onnx, decoder.int8.onnx, tokenizer.json]
- id: sherpa-silero-vad
  kind: sherpa_onnx_aux
  install_dir: models/sherpa-vad
  files_required: [silero_vad.onnx]
```

**Rust 落位**：

- `local_runtime/manifest/` — schema 扩展  
- `local_runtime/installer/` — 解压 / 校验 ONNX 包（可复用 `download.rs` 断点续传）  
- `local_runtime/catalog/diagnose.rs` — 报告 ONNX 缺失  

**脚本对齐**：`r3g-b-download-sherpa-qwen3-onnx.sh` 逻辑迁入 installer 或作为 fallback CLI。

### 3.2 Catalog 双 SKU

**TS** `localAsrModelCatalog.ts`：

```typescript
{
  catalogId: "qwen3-asr-vad-0.6b",
  label: "Qwen3 本机转写（ONNX）",
  hubModelId: "sherpa-onnx-qwen3-asr-0.6B-int8", // 新命名空间，非 ModelScope PyTorch id
  engine: "sherpa-onnx",  // 新字段
  description: "…无标点；专名/长音频推荐",
  diskHint: "约 4–5 GB",
  recommendLongAudio: true,
},
// 原 paraformer 保留，engine: "funasr-sidecar"
```

**Python** `model_catalog.py` — 同步；侧车 catalog API **仅 FunASR SKU**；Sherpa SKU 由 **Rust diagnose 命令** 提供状态（新 endpoint 或 Tauri command）。

### 3.3 能力—UI 改造

按 [desktop-capability-ui-state-alignment.md](../../architecture/desktop-capability-ui-state-alignment.md) 扩展：

| 文件 | 改动 |
|------|------|
| `asrEnvStatus.ts` | `buildAsrEnvPresentation` 分支 E1：Sherpa 不查 8741 |
| `localAsrModelCatalog.ts` | `computeLocalAsrTranscribeReady` 按 `engine` 分流 |
| `EnvLocalAsrPanel.tsx` | 下载区：Paraformer → 侧车 prepare；Qwen → LRC ONNX 进度 |
| `useAsrHealthPoll.ts` | Sherpa 选中时 poll `sherpa_asr_diagnose` 而非仅 `/health` |
| `usePrepareModelController.ts` | Sherpa SKU 走 LRC install，非 `/v1/models/prepare` |
| `environmentCapabilityCoordinator.ts` | blockReason 含引擎维度 |

**硬规则**：选 Qwen ONNX 时，禁止显示「侧车模型不一致」类 FunASR 文案。

### 3.4 长音频 async（最小）

R3e-C 现依赖侧车 `POST /v1/transcribe/async`。Sherpa Phase 2 选项：

**方案 A（推荐 P2）**：Rust 内 `tokio::task::spawn_blocking` + 进度 channel；UI 复用现有 job polling 壳，**job 状态存 app 内存**（非 8741）  

**方案 B（Defer）**：Sherpa 仅 blocking；长音频提示「转写中请保持窗口打开」  

实现 A 落位：

- `project/transcribe_job_sherpa.rs`（新）  
- `run_transcribe_cmd.rs` async_start 分支  

### 3.5 hotwords

spike 已支持 `OfflineQwen3ASRModelConfig.hotwords`。Phase 2：

- `build_glossary_hotwords` 输出 → Sherpa config  
- `SttVocabularyChannel` 新增 `LocalSherpaInline`  
- acceptance 复验 D3 term_hit

### 3.6 eval 双列

- `scripts/eval-sherpa-run.py`（新）：调 Tauri dev 命令或内嵌 CLI  
- ACC-EVAL-2 报告同时含 `engine=paraformer|sherpa`

### 3.7 Phase 2 出口

G6 LRC 零终端安装；catalog 双条目；环境页 Sherpa 绿灯；ACC-EVAL-2 双列。

---

## 4. Phase 3 — 默认切换（~1w）

| 任务 | 落位 |
|------|------|
| 默认 pref | `local_asr_engine=sherpa-onnx` + 默认 catalogId `qwen3-asr-vad-0.6b` |
| 新装迁移 | 首次启动读旧 pref → 不强制迁移；新用户默认 Sherpa |
| bundled 侧车 | `lib.rs` setup：`try_start_bundled` 仅当 engine=funasr 或用户启用「兼容模式」 |
| catalog 文案 | Paraformer →「兼容 / 含标点」 |
| ADR-0007 | proposed → accepted |
| 路线图 | R3s-A ✅ |

**回滚**：环境页一键「切回 FunASR Paraformer」→ 写 pref + force_restart 侧车。

---

## 5. 横切关注点

### 5.1 标点（Phase 3 blocker）

Sherpa Qwen3 无 ct-punc。选项：

1. Phase 2 产品文案明示「无标点」  
2. 并行薄片：R3t 后 LLM 标点 或规则标点  
3. **不** 在 Phase 1 阻塞

### 5.2 二进制体积

`sherpa-onnx` 静态链 ORT → 主 binary 增大。需：

- release 构建实测 DMG 体积  
- 与 ~2.5GB 侧车 **optional** 对比（用户磁盘可能两者并存）

### 5.3 Windows

- Phase 2 末：`sherpa-onnx` ORT CPU provider Win smoke  
- Phase 3 默认 **仅 macOS**；Win 仍 FunASR 直至 signoff

### 5.4 架构守卫

新增 guard 规则建议：

- 禁止 `apps/desktop/src/**` import `spike/`  
- `run_transcribe_cmd.rs` 行数上限（router 拆分后应下降）  
- catalog `engine` 字段与 `local_asr_engine` pref 一致性测试

---

## 6. 文件改动清单（按 Phase）

### Phase 1（最小可手测）

| 操作 | 路径 |
|------|------|
| 新建 | `src/asr_sherpa/*` |
| 新建 | `src/project/local_transcribe_router.rs` |
| 新建 | `src/project/sherpa_transcribe_gate.rs` |
| 改 | `src/project/run_transcribe_cmd.rs`（blocking 委托 router） |
| 改 | `src/project/mod.rs` |
| 改 | `src/lib.rs`（mod + commands） |
| 改 | `Cargo.toml`（sherpa-onnx） |
| 新建 | `prefs/local_asr_engine.txt` 读写（可复用 `local_asr_model.rs` 模式） |
| 测 | `asr_sherpa/*` + router 单测 |

### Phase 2

| 操作 | 路径 |
|------|------|
| 改 | `local_runtime/manifest/*`, `installer/*` |
| 改 | `localAsrModelCatalog.ts`, `model_catalog.py` |
| 改 | `asrEnvStatus.ts`, `EnvLocalAsrPanel.tsx`, `useAsrHealthPoll.ts` |
| 改 | `usePrepareModelController.ts` |
| 新建 | `project/transcribe_job_sherpa.rs`（async 可选） |
| 改 | `docs/architecture/desktop-capability-ui-state-alignment.md`（E1–E3） |

### Phase 3

| 操作 | 路径 |
|------|------|
| 改 | 默认 pref / 迁移逻辑 |
| 改 | `lib.rs` `try_start_bundled` 条件 |
| 改 | ADR-0007, roadmap |

---

## 7. 依赖与风险序

```text
P1 asr_sherpa + router + blocking E2E
    ↓
P2 LRC ONNX install + catalog + UI 双轨
    ↓
P2b async 进度（可与 P2 并行）
    ↓
P2c hotwords + eval 双列
    ↓
标点文案 / LLM 薄片（可与 P3 并行，但 P3 需文案）
    ↓
P3 默认切换（G1–G8）
```

| 风险 | 缓解 |
|------|------|
| `run_transcribe_cmd` 膨胀 | router 拆分；async Sherpa 独立模块 |
| UI 仍绑 8741 | Phase 2 必须改 `computeLocalAsrTranscribeReady` |
| ONNX 4.4GB 弱网 | LRC 断点续传已有；manifest 签名 |
| 双栈磁盘 | catalog 文案「互斥可选」；LRC 卸载旧 SKU |
| spike / 产品漂移 | Phase 1 后 spike 改调 `asr_sherpa` lib |

---

## 8. 建议下一 PR 范围（Phase 1a）

**仅一个 PR，可手测闭环**：

1. `asr_sherpa` 模块 + `Cargo.toml`  
2. `local_transcribe_router` + `sherpa_transcribe_gate`  
3. `run_transcribe_cmd` blocking 分支  
4. env：`RUSHI_LOCAL_ASR_ENGINE=sherpa-onnx`  
5. 单测 + 「对照」项目手测记录  

**不含**：LRC manifest、catalog UI、async、默认切换。

---

## 9. 参考命令

```bash
# Phase 0 已完成
npm run eval:run:long-form
SPIKE_OUTPUT_DIR=docs/execution/spike-output/d3-tang32-eval-2026-06-11 \
  bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 1200 --pipeline vad --skip-funasr

# Phase 1 目标
RUSHI_LOCAL_ASR_ENGINE=sherpa-onnx npm run desktop:dev
```

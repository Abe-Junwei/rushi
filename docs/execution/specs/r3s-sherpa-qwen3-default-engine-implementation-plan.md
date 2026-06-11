# R3s-A 完整实现路径（代码对照版）

> **Research**：[r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md)  
> **Intent / Acceptance**：同目录 `*-intent.md` / `*-acceptance.md`  
> **ADR**：[ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md)  
> **状态**：2026-06-11 代码审查定稿 · **2026-06-11 外部审查修订**（LRC manifest / eval / audio / Phase 2 拆分）  
> **执行模式**：**Defer** — 本文 §2+ 为 **Active 后** 实施清单；G1 前 **不得** 按 Phase 1 开工（见 [plan §Defer](./r3s-sherpa-qwen3-default-engine-plan.md)）

---

## 0.1 审查修订摘要（2026-06-11）

| 审查项 | 结论 | 本版修订 |
|--------|------|----------|
| 现状快照 | ✅ 准确 | 保留 §0 |
| Phase 1 架构 | ✅ 合理 | 补充 eval / spike 依赖 / 体积基线出口 |
| LRC Phase 2 | ⚠️ 低估 | **不改造 `RuntimeComponent`**；新增 `RuntimeModelArtifact` + 独立 installer |
| `audio.rs` | ⚠️ remux 无 `-ar 16000` | Sherpa 专用 ffmpeg 须显式 **16 kHz mono** |
| eval 优先级 | ⚠️ 与 acceptance 矛盾 | **`eval-sherpa-run` 升为 Phase 1 出口** |
| async Sherpa | ⚠️ 设计不足 | **P2c 前须 design doc / spike** |
| alignment E1–E3 | 建议 P1 预标注 | Phase 1 同步更新 architecture doc（标注 Phase 2 实现） |

**门禁**：Phase 2 LRC **编码**须在 `RuntimeModelArtifact` schema 定稿后开始；Phase 1 可立即启动。

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
| LRC 侧车下载 | `local_runtime/` | 现 **`RuntimeComponent` 仅可执行侧车**（`exe_relpath`、`verify_installed_runtime`→启动 exe+/health）；**无模型 artifact schema** |
| Catalog | `localAsrModelCatalog.ts` + `model_catalog.py` | **仅 Paraformer** 一条 SKU |
| 转写门控 | `local_transcribe_gate.rs` | **100% 绑定 8741 /health + FunASR 字段** |
| 本机转写入口 | `run_transcribe_cmd.rs` | blocking + async **均** `post_transcribe_*` → 8741 |
| 环境 UI | `asrEnvStatus.ts` + `computeLocalAsrTranscribeReady` | transcribeReady = 侧车 D2/D5；**无引擎维度** |
| 评估 | `eval-run.py` + D3 金标 | Phase 0 数据已有 |

### 明确不存在（须新建）

- `src/asr_sherpa/` 产品模块  
- `local_asr_engine` pref / 路由  
- Sherpa 就绪探测 Tauri 命令  
- LRC manifest 中 Qwen3 ONNX + Silero VAD（**`RuntimeModelArtifact`**，见 §3.1）  
- catalog 中 `qwen3-asr-vad-0.6b`  
- `scripts/eval-sherpa-run.py`（**Phase 1 出口**，见 §2.9）  
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

**迁移策略（修订）**：Phase 1 完成后 **spike crate 必须依赖 `asr_sherpa` lib**（path dependency），CLI 仅作薄包装；**禁止** spike 与产品代码长期 copy 双轨。

### 2.2 音频前处理 `audio.rs`

Sherpa `Wave::read` 要求 **16 kHz mono WAV**。

**注意**：`waveform_peaks_ffmpeg::remux_audio_to_pcm_wav` 为波形峰值服务，当前仅 `-ac 1` + `pcm_s16le`，**未指定采样率**（见 `waveform_peaks_ffmpeg.rs` L30–47），输出可能是 **源采样率 mono**，不满足 Qwen3。

Phase 1 须在 `asr_sherpa/audio.rs` 使用 **Sherpa 专用 ffmpeg 参数**（不复用波形 remux 原样）：

```text
ffmpeg -y -i INPUT -vn -ac 1 -ar 16000 -c:a pcm_s16le OUTPUT.wav
```

路径：

1. 若已是 16 kHz mono WAV → 直读  
2. 否则 ffmpeg 显式重采样到 `app_data/tmp/sherpa-{uuid}.wav`  
3. 单测：ffprobe 断言输出 `16000 Hz`、`mono`（可用 bundled ffmpeg）

可选后续：symphonia 解码 + 重采样（减少 temp 文件）。

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
| E2E（gated） | `CARGO_TEST_SHERPA=1` + fixture ONNX 跑 3s clip |
| ffmpeg 输出规格 | `asr_sherpa/audio.rs` 单测：16 kHz mono |
| release 体积基线 | `cargo build --release` 对比 with/without `sherpa-onnx`（阈值见 §5.2） |

### 2.9 Eval（Phase 1 必要出口）

**修订**：acceptance G1–G4 依赖金标 CER；Sherpa 产品路径须可重复回归，**不得推迟到 Phase 2**。

| 交付 | 落位 |
|------|------|
| `scripts/eval-sherpa-run.py` | 读 manifest → 调 `asr_sherpa`（或 `cargo run` 薄 CLI）→ 输出与 `eval-run.py` 同形 JSON（含 `cer_chars`） |
| npm script | `eval:run:sherpa` → `--filter-id d3-tang32-zhikong-gaijiang` |
| Phase 1 出口 | D3 样本 Sherpa 列 CER/RTFx/term_hit 可一键复跑 |

ACC-EVAL-2 **双列**（Paraformer + Sherpa 同 manifest）可在 Phase 2 产品化；Phase 1 至少 Sherpa 单列自动化。

### 2.10 Phase 1 文档（与代码同步）

- [desktop-capability-ui-state-alignment.md](../../architecture/desktop-capability-ui-state-alignment.md) §2.1：预留 **E1–E3**（标注「Phase 2 实现 UI」）
- spike `Cargo.toml`：`rushi-desktop` 内 `asr_sherpa` 为 path dep

### 2.11 Phase 1 验证清单

```bash
RUSHI_LOCAL_ASR_ENGINE=sherpa-onnx \
RUSHI_SHERPA_QWEN3_MODEL_DIR=fixtures/sherpa-qwen3-asr-0.6B \
npm run desktop:dev
# → 打开「对照」→ Sherpa 文件 → 转写 → ≥50 段
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml asr_sherpa
```

**Phase 1 出口**：

- G5（E2E 写库）、G7（关 8741 仍可转写）在 dev flag 下成立  
- G1–G4 可通过 `npm run eval:run:sherpa`（或等价）复跑  
- spike 依赖 `asr_sherpa`，无独立推理副本  
- release binary 体积基线已记录（§5.2）

---

## 3. Phase 2 — 拆分 P2a / P2b / P2c（~3–4w）

> **禁止**在 §3.1 schema 定稿前启动 LRC 模型安装编码。

### 3.1 LRC：模型 artifact 与可执行组件分离（P2a，~2w）

**现状（代码真源）**：`local_runtime/manifest/types.rs` 中 `RuntimeComponent` **必须**含 `exe_relpath`、`min_shell_version`；installer `verify_installed_runtime` **启动 exe 并轮询 `/health`**（`install_support/verify/`）。该流程 **语义上仅适用于侧车**，不可将 ONNX 模型包硬塞进 `components[]`。

**修订设计**：manifest 顶层新增 **`model_artifacts: Vec<RuntimeModelArtifact>`**（与 `components` 并列），**不修改**现有 `RuntimeComponent` / 侧车 install 路径。

```rust
// 拟议：local_runtime/manifest/types.rs
pub struct RuntimeModelArtifact {
    pub id: String,              // e.g. sherpa-qwen3-asr-0.6B-int8
    pub version: String,
    pub platform: String,
    pub artifact: RuntimeArtifact,
    pub install_relpath: String,  // e.g. models/sherpa-qwen3-asr-0.6B
    pub files_required: Vec<String>,
    pub unpack: ModelUnpackKind, // tar_bz2 | zip | directory
}
```

**独立安装流程**（新模块 `local_runtime/model_install/` 或 `installer/model.rs`）：

```text
download (复用 download.rs 断点续传)
  → extract
  → verify_files_required (无 exe、无 /health)
  → promote + write model_marker.json
```

| 步骤 | 侧车 `RuntimeComponent` | `RuntimeModelArtifact` |
|------|-------------------------|---------------------------|
| verify | 启动 exe + `/health` | `files_required` 存在 + 可选 sha256 |
| marker | `exe_relpath`, shell version | `install_relpath`, artifact id/version |
| diagnose | `local_runtime_diagnose` | 扩展 `sherpa_model_artifacts[]` 状态 |

**Manifest 示例条目**：

```yaml
model_artifacts:
  - id: sherpa-qwen3-asr-0.6B-int8
    install_relpath: models/sherpa-qwen3-asr-0.6B
    files_required:
      - conv_frontend.onnx
      - encoder.int8.onnx
      - decoder.int8.onnx
      - tokenizer.json
  - id: sherpa-silero-vad
    install_relpath: models/sherpa-vad
    files_required: [silero_vad.onnx]
```

**Rust 落位（P2a only）**：

- `local_runtime/manifest/types.rs` — `RuntimeModelArtifact` + parse  
- `local_runtime/model_install/` — download / extract / verify / promote  
- `local_runtime/catalog/diagnose.rs` — ONNX 缺失报告  
- `scripts/r3g-b-download-sherpa-qwen3-onnx.sh` — 逻辑迁入 installer 或 dev fallback  

**P2a 出口**：G6（零终端安装 ONNX）；`sherpa_asr_diagnose` 读 LRC 路径。

### 3.2 Catalog 双 SKU（P2b，~1–2w）

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

### 3.3 能力—UI 改造（P2b，续）

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

### 3.4 长音频 async Sherpa（P2c，design 先行）

R3e-C 现依赖侧车 `POST /v1/transcribe/async` + **HTTP job_id 轮询**（`project_transcribe_async_start/finalize`）。Sherpa 无 8741 job API。

**P2c 编码前必须交付** mini design（`docs/execution/specs/r3s-sherpa-async-transcribe-design.md` 或 acceptance 附录），至少定义：

| 议题 | 须明确 |
|------|--------|
| job 状态存储 | app 内存 vs `app_data/jobs/` 持久化；重启后行为 |
| 进度通道 | `mpsc` / `watch` + Tauri event vs 新 poll command |
| 前端接口 | 复用 `job_id` 字符串 vs 新 `sherpa_job_id`；与 `TranscribeTimelineRecorder` 集成 |
| 取消 | 与 `postprocess` cancel 模式对齐 |
| 长音频策略 | 全轨 blocking + 进度估算 vs 窗式 decode |

**实现选项（design 后选型）**：

- **方案 A**：`tokio::task::spawn_blocking` + Rust 内 job map + 新 Tauri `project_transcribe_sherpa_async_*`  
- **方案 B（Defer 至 P3 后）**：Sherpa 仅 blocking；UI 长音频提示「请保持窗口打开」

**不在 P2b 默认范围**；可与 P2b 并行，但 **无 design 不得开编码**。

落位（P2c Go 后）：`project/transcribe_job_sherpa.rs`、`run_transcribe_cmd.rs` async 分支。

### 3.5 hotwords（P2b）

spike 已支持 `OfflineQwen3ASRModelConfig.hotwords`。Phase 2：

- `build_glossary_hotwords` 输出 → Sherpa config  
- `SttVocabularyChannel` 新增 `LocalSherpaInline`  
- acceptance 复验 D3 term_hit

### 3.6 eval 双列（P2b 末 / P2c 后）

- Phase 1 已有 Sherpa 单列（§2.9）  
- P2b 末：`eval-run.py` 或统一 runner 输出 **paraformer + sherpa** 两列 CSV（ACC-EVAL-2）

### 3.7 Phase 2 出口

| 子阶段 | 出口 |
|--------|------|
| **P2a** | G6；model manifest 签名 + installer 单测 |
| **P2b** | catalog 双条目；环境页 Sherpa 绿灯；E1–E3 UI 实现 |
| **P2c** | async 手测清单（若 Go）；否则文档化 Defer |

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

`sherpa-onnx` 静态链 ORT → 主 binary 增大。

**Phase 1 必做基线**（首次 `cargo build --release` 链入 `sherpa-onnx` 后）：

| 指标 | 记录方式 | 阈值（初版） |
|------|----------|--------------|
| `rushi-desktop` binary | `ls -lh target/release/rushi-desktop` | 对比未链入前增量 |
| DMG（若可） | release 脚本 | **+200MB 可接受**；**+500MB 需 ADR 修订或动态库方案** |

与 ~2.5GB 侧车 optional 对比用户磁盘（双栈并存期）。

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

| 子阶段 | 操作 | 路径 |
|--------|------|------|
| **P2a** | 新增 | `local_runtime/manifest/types.rs`（`RuntimeModelArtifact`） |
| **P2a** | 新建 | `local_runtime/model_install/` |
| **P2b** | 改 | `localAsrModelCatalog.ts`, `model_catalog.py` |
| **P2b** | 改 | `asrEnvStatus.ts`, `EnvLocalAsrPanel.tsx`, `useAsrHealthPoll.ts` |
| **P2c** | 新建 | `r3s-sherpa-async-transcribe-design.md` → `transcribe_job_sherpa.rs` |

### Phase 3

| 操作 | 路径 |
|------|------|
| 改 | 默认 pref / 迁移逻辑 |
| 改 | `lib.rs` `try_start_bundled` 条件 |
| 改 | ADR-0007, roadmap |

---

## 7. 依赖与风险序（修订）

```text
P0 金标 + eval（D3 已有数据）          ✅
P1 asr_sherpa + router + blocking E2E
    + eval-sherpa-run + spike→lib + 体积基线 + alignment E1–E3 预留
    ↓
P2a RuntimeModelArtifact + model_install（无 UI）
    ↓
P2b catalog 双 SKU + 环境页双轨 UI
    ↓
P2c async design doc →（可选）async 实现
    ↓
标点文案 / LLM 薄片（P3 前）
    ↓
P3 默认切换（G1–G8）
```

| 风险 | 缓解 |
|------|------|
| LRC schema 扭曲 | **`RuntimeModelArtifact` 独立**，不改 `RuntimeComponent` |
| `run_transcribe_cmd` 膨胀 | router 拆分；async Sherpa 独立模块 |
| UI 仍绑 8741 | P2b 改 `computeLocalAsrTranscribeReady` |
| ONNX 4.4GB 弱网 | P2a 断点续传；manifest 签名 |
| 双栈磁盘 | catalog 文案；可选互斥安装 |
| spike / 产品漂移 | **P1 出口：spike 依赖 `asr_sherpa` lib** |
| remux 采样率 | **P1：`audio.rs` 显式 `-ar 16000`** |
| async 重启丢 job | P2c design 定持久化策略 |

---

## 8. 建议下一 PR 范围（Phase 1a）

**仅一个 PR，可手测闭环**：

1. `asr_sherpa` 模块 + `Cargo.toml`  
2. `local_transcribe_router` + `sherpa_transcribe_gate`  
3. `run_transcribe_cmd` blocking 分支  
4. env：`RUSHI_LOCAL_ASR_ENGINE=sherpa-onnx`  
5. 单测 + 「对照」项目手测记录  
6. `npm run eval:run:sherpa`（D3 CER 复跑）  
7. release binary 体积基线记录  

**不含**：LRC manifest（P2a）、catalog UI（P2b）、async（P2c）、默认切换。

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

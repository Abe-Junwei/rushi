# rushi-asr 热词 / `supportsHotwordBias` 真值表

对照 Jieyu 计划书 **§4.3 能力分级** 与 **§6.1 `TranscriptionProvider`**：以 **HTTP 响应 `warnings` + `engine`** 为服务端真源；前端 `TranscriptionProvider.supportsHotwordBias` 当前为 **保守占位**（见下）。

## 1. 请求路径（桌面 → ASR）

- **Tauri `p1` 拉取语段**：将 SQLite 术语表拼成空格串，随 `multipart/form-data` 字段 **`hotwords`** 一并 `POST /v1/transcribe`（见 `apps/desktop/src-tauri/src/project/glossary_hotwords.rs`）。
- **术语库粘贴 / 导入**：换行 + Tab（Excel 选区）、CSV/TSV、`.xlsx/.xls` 首工作表文本单元格 → 多条 `glossary_terms`（见 `glossary_bulk_parse.rs` / `glossary_import.rs`）。
- **rushi-asr**：`engine.py` 在规范化 WAV 后调用 `funasr_engine.transcribe_with_funasr(..., hotwords=...)`；失败或未就绪时走 **stub**，并对热词给出明确 `warnings`。

## 2. 引擎 × 热词是否进入识别模型

| 运行态（`transcription_mode` / 实际 `engine`） | 热词是否传入 `generate(..., hotword=...)` | 用户可见信号（`warnings` 等） |
|---------------------------------------------|------------------------------------------|--------------------------------|
| **FunASR 就绪**（`funasr+{model_id}`） | **是**（非空 `hotwords` 时尝试带 `hotword=`） | 若当前 FunASR 接口不接受该参数：`hotword_param_unsupported`，并 **自动无热词重试** 一次 |
| **FunASR 就绪，热词超长** | 传入前截断至 12k **字符**（Rust/Python 均按 Unicode 字符计，非 UTF-8 字节） | `hotwords_truncated_12k` |
| **stub**（未装 FunASR、模型未配置、或其它跳过 FunASR 的原因） | **否** | 若有非空热词：`hotwords_ignored_stub`；常伴随 `funasr_skipped:*` 或 `stub_no_placeholder_segment:*` |

> **SenseVoice vs Paraformer 热词差异**：两者均通过 `hotword=` 参数统一传入。Paraformer 对热词参数的敏感度通常更高；SenseVoice 虽接受该参数，但实际热词召回效果可能弱于 Paraformer。TypeError 回退可处理「完全不支持」的情况，但无法覆盖「支持但效果不佳」的灰度场景。
>
> **Online STT（OpenAI、AssemblyAI、Deepgram）**：术语经 **`SttVocabularyPlan`** 分 adapter 映射（OpenAI `prompt`、AssemblyAI `keyterms_prompt`、Deepgram `keywords`）；其它 native adapter 返回 **`online_vocabulary_unsupported`** warning（ACC-STT-UNIFY U1/U2，2026-05-30）。

## 3. 在线 STT 能力矩阵（ACC-STT-UNIFY U2）

真源：`apps/desktop/src/services/stt/sttVocabularyBias.ts`（与 Rust `SttVocabularyChannel` 对齐）。

| 厂商 id（环境页） | 术语偏置 | 映射字段 |
|-------------------|----------|----------|
| `openai` | ✅ | `prompt`（≤224 字） |
| `assemblyai` | ✅ | `keyterms_prompt` |
| `deepgram` | ✅ | URL `keywords` |
| `custom-proxy` | ✅ | multipart `hotwords`（代理须兼容 Rushi） |
| 其它壳直连（腾讯/百度/阿里/讯飞等） | ❌ | 转写前 warning：`online_vocabulary_unsupported` |

`TranscriptionProvider.supportsHotwordBias`（`contracts/transcription.ts`）在需要时可按厂商 id 调用 `supportsHotwordBiasForProviderId`；**运行时仍以 `warnings` 为准**。

UI：`deriveTranscribeHints`（`asrTranscribeHints.ts`）、环境页在线 STT 说明、厂商卡片「术语偏置」角标。

## 4. 与计划书 §4.3 对齐

- 支持热词进模型时：下一次走 FunASR 的请求应携带术语拼接串（已由 Tauri 提交）。
- 不支持时：**不得**假造「已注入模型」；以 **`hotwords_ignored_stub` / `hotword_param_unsupported`** 等明确降级，并由 UI 提示（与 stub / 旧版 API 行为一致）。

## 5. 变更纪律

若调整 FunASR 调用签名或 stub 行为，须同步：

1. `services/asr/README.md` 中 `hotwords` 说明；
2. `apps/desktop/src/services/asrTranscribeHints.ts` 与对应测试；
3. 本文件 **§2** 行。

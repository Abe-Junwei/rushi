# ACC-STT-IFLYTEK — Plan：讯飞极速录音转写原生接入

> **Research**：[`r3-china-iflytek-lfasr-research.md`](./r3-china-iflytek-lfasr-research.md)  
> **Acceptance**：[`acc-stt-iflytek-acceptance.md`](./acc-stt-iflytek-acceptance.md)  
> **手测**：[`acc-stt-iflytek-hand-test-checklist.md`](./acc-stt-iflytek-hand-test-checklist.md)

---

## 0. 实施前提

- Research brief §1–§3、§7（不做什么）已读；**Grill 2026-06-18** 定稿见下表
- Provider id：**`iflytek-speed-asr`**；adapter：**`xunfeiSpeedAsr`**；engine：**`iflytek:speed-transcription:file`**
- 凭证：**Vendor credential triplet**（AppID 持久化 + APIKey / APISecret 会话内存）

| Grill 结论 | 选择 |
|------------|------|
| 第三 Secret 字段 | ✅ 接受 → speedTranscription |
| ≥30 MB 分块上传 | **P1 必做**（非 P2） |
| 非 wav/mp3/pcm | **壳内 ffmpeg 归一**（复用 `resolve_bundled_ffmpeg()`） |
| 在线转写失败 | **仅报错**，不回落本机 |
| accent UI | **8 项 preset 下拉**（见 §1.2） |

---

## 1. 架构总览

```text
环境页 OnlineSttRuntimeForm
  → memorySecrets (apiKey + apiSecret) + localStorage appKey + accent preset
  → probeExternalSttOnlineHealth (credentials-only)
主舞台 project_run_transcribe
  → bridge (nativeAdapter=xunfeiSpeedAsr, appKey, apiKey, apiSecret, accent?)
  → xunfei_speed_asr::transcribe
       normalize (ffmpeg 16k mono wav, 若非已兼容格式)
       → auth → upload (直传或 mpupload 分块) → task (pro_create) → poll → parse
  → online_segment_normalize → TranscriptionResult schema_version:1
```

### 1.1 健康探测（credentials-only）

厂商端点仅 POST，**不做** GET 网络探测（与 [`presetEndpoints.ts`](../../../apps/desktop/src/services/stt/sttOnlineProviderContract/presetEndpoints.ts) 纪律一致）：

| 条件 | 探测结果 |
|------|----------|
| 未启用在线 STT | `disabled` |
| AppID 空 | `unconfigured`（`requiresPersistedAppKey`） |
| APIKey 或 APISecret 空 | `unconfigured` |
| 三者齐全 | `available` + 文案「凭证已填写；首次使用以实际识别结果为准」 |

Implement 时扩展 `health.ts`：当 `def.requiresApiSecret` 为 true 时校验 `getSttOnlineApiSecretFromMemory()`。

### 1.2 Xunfei accent preset（v1 固定 8 项）

`language` 固定 **`zh_cn`**；`accent` 由环境页下拉写入 runtime（持久化 non-secret 字段，如 `rushi.stt.online.accent`）：

| accent 码 | UI 标签 | 默认 |
|-----------|---------|------|
| `mandarin` | 普通话 | ✅ |
| `cantonese` | 粤语 | |
| `lmz` | 四川话 | |
| `henanese` | 河南话 | |
| `dongbeiese` | 东北话 | |
| `shanghainese` | 上海话 | |
| `minnanese` | 闽南话 | |
| `uighur` | 维语 | |

Implement 前 spike 核对码与控制台授权；未开通项转写失败须可读提示（**不**回落本机）。

---

## 2. Phase 分解

### Phase P0 — Provider 合约 + UI（无 Rust 转写）

| # | 任务 | 文件 |
|---|------|------|
| P0.1 | 类型：`requiresApiSecret`、`OnlineNativeAdapterId` | `types.ts`、`definitions.ts` |
| P0.2 | 内存 secret + bridge 透传 | `memorySecrets.ts`、`bridge.ts`、`online_stt_bridge.rs` |
| P0.3 | 第三输入框 + AppID 标签 + **accent 下拉** | `OnlineSttRuntimeForm.tsx` |
| P0.4 | credentials-only probe + 国内分组 | `presetEndpoints.ts`、`health.ts`、`definitions.ts` |
| P0.5 | 术语 channel 声明（TS 侧） | `sttVocabularyBias.ts` |

**验证**：`npm run typecheck && npm run test`；环境页手测三字段 + accent 下拉。

---

### Phase P1 — Rust 全链路 E2E（含分块 + ffmpeg）

| # | 任务 | 文件 |
|---|------|------|
| P1.0 | spike：accent 码与官方文档对齐 | research 附录或单测 fixture |
| P1.1 | HMAC-SHA256 签名单元测试 | `xunfei_speed_asr/auth.rs` |
| P1.2 | **ffmpeg 归一** 16 kHz mono wav | `xunfei_speed_asr/normalize.rs`（复用 bundled ffmpeg） |
| P1.3 | 小文件 upload + **mpupload 分块** | `upload.rs` |
| P1.4 | pro_create（含 accent）+ query 轮询 | `task.rs`、`poll.rs` |
| P1.5 | lattice 解析 + normalize | `parse.rs`、`mod.rs` |
| P1.6 | dispatch + online_fetch 接线 | `stt_native/mod.rs`、`online_fetch.rs` |
| P1.7 | 术语 `business.dhw` | `stt_vocabulary.rs` |

**验证**：

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml xunfei_speed_asr
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml stt_vocabulary
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

---

### Phase P2 — 文档 + 手测收口

| # | 任务 |
|---|------|
| P2.1 | 手测 checklist 全绿（含 ≥30 MB + mp4 归一） |
| P2.2 | 更新 [`stt-online-providers.md`](../../architecture/stt-online-providers.md) §3 |

---

## 3. 约束

- 每个新增 `.rs` 文件 ≤500 行；TS 修改文件 ≤300 行或仅 guard warning
- **v1 不做**：见 research §7 + acceptance §不做
- 在线失败 **禁止** silent / 弹窗回落本机 ASR
- 禁止用 `/health.ready_for_transcribe` 表示讯飞就绪（能力—UI 矩阵见 acceptance）

---

## 4. 模块落位

| 层 | 路径 |
|----|------|
| Rust adapter | `apps/desktop/src-tauri/src/stt_native/xunfei_speed_asr/{mod,auth,normalize,upload,task,poll,parse}.rs` |
| Bridge | `online_stt_bridge.rs`、`run_transcribe_cmd/online_fetch.rs` |
| TS 合约 | `sttOnlineProviderContract/*`、`envOnlineStt/OnlineSttRuntimeForm.tsx` |
| Hints | `asrTranscribeHints.ts`、`projectStatusFeedbackCopy.ts` |

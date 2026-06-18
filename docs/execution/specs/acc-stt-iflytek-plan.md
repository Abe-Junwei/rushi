# ACC-STT-IFLYTEK — Plan：讯飞极速录音转写原生接入

> **状态**：🟡 编码 ✅（2026-06-18）· **手测 ⏳**  
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

厂商端点仅 POST。**实现已增强为「真实验签探测」**（2026-06-18）：`probe.rs` 对 `/v2/ost/query` 发一次签名 POST（假 task_id），`10401 no data found` 判为凭证通过、`401`/HMAC 报文判为 unauthorized；query 对无效 task 不消耗转写配额。下表的状态判定仍成立（仅 available 由真实验签得出，而非纯凭证存在性）：

| 条件 | 探测结果 |
|------|----------|
| 未启用在线 STT | `disabled` |
| AppID 空 | `unconfigured`（`requiresPersistedAppKey`） |
| APIKey 或 APISecret 空 | `unconfigured` |
| 三者齐全 | `available` + 文案「凭证已填写；首次使用以实际识别结果为准」 |

Implement 时扩展 `health.ts`：当 `def.requiresApiSecret` 为 true 时校验 `getSttOnlineApiSecretFromMemory()`。

### 1.2 Xunfei accent（v1 收敛为 `mandarin`，2026-06-18 修订）

`language` 固定 **`zh_cn`**；`accent` 固定 **`mandarin`**。

**修订原因**：官方 speedTranscription 文档 `business.accent` **取值范围仅 `mandarin`**；中英 + 202 种方言为「**免切识别**」（zh_cn 下自动检测，无需切 accent）。原 8 项方言码下拉（cantonese/lmz/uighur…）会触发参数错误（10303），故 v1 收敛：

- `xunfeiAccentPresets.ts` 仅保留 `mandarin`；`normalizeXunfeiSpeedAsrAccent` 把任意旧持久化方言码归一为 `mandarin`。
- `bridge.ts` 对 `iflytek-speed-asr` 强制经 `normalizeXunfeiSpeedAsrAccent`，确保只发合法码。
- 环境页：单一 preset 时渲染只读说明「普通话（zh_cn 自动识别中英 + 202 种方言，无需手动选择）」，不再暴露下拉。

未来若控制台确认支持显式方言码，再在 `XUNFEI_SPEED_ASR_ACCENT_PRESETS` 增项即可恢复下拉（接线已保留）。

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

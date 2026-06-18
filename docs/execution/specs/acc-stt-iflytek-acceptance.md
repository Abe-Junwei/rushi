# Acceptance: ACC-STT-IFLYTEK — 讯飞极速录音转写

> **状态**：✅ **编码 ✅ · 手测签收 ✅**（2026-06-18）  
> **Research**：[`r3-china-iflytek-lfasr-research.md`](./r3-china-iflytek-lfasr-research.md)  
> **Plan**：[`acc-stt-iflytek-plan.md`](./acc-stt-iflytek-plan.md)  
> **手测**：[`acc-stt-iflytek-hand-test-checklist.md`](./acc-stt-iflytek-hand-test-checklist.md)

## 范围

- 新增 **`iflytek-speed-asr`** provider（讯飞极速录音转写 / speedTranscription）
- Rust **`xunfeiSpeedAsr`**：**ffmpeg 归一** + 直传/分块上传 + 异步 Job + `lattice` 归一
- **Vendor credential triplet** UI + 真实验签健康探测（`/v2/ost/query` 签名 POST）
- **Xunfei accent**：v1 收敛 `mandarin`（`language: zh_cn` 固定；202 方言免切自动识别）
- 术语库 → `business.dhw`（逗号分隔热词）

## 不做

- 讯飞标准 LFASR v2（`raasr.xfyun.cn`）— Grill 已确认走三件套 + 极速版
- 路线 C（spark `asr_llm` / Ifasr_llm）
- 说话人分离（`vspp_on` / `speaker_num` 固定 0）
- 方言码下拉（v1 收敛 mandarin；202 方言由 zh_cn 免切自动识别，不暴露会报 10303 的方言码）
- 非 `zh_cn` 的 language 选择器
- 在线失败 **回落本机 ASR**（含静默与弹窗提议）
- 流式 WebSocket 听写（已移除的 `iflytek-speech` 形态）

## 验收

- [x] TS：`iflytek-speed-asr` 定义表行 + `market: china` + capabilities（`asyncJob`、`segmentTimestamps`） — `definitions.ts:29-54`（`market:"china"`、`asyncJob:true`、`segmentTimestamps:true`、`wordTimestamps:true`）
- [x] TS：`requiresApiSecret` + `requiresPersistedAppKey` + 第三输入框 — `definitions.ts:46-48`、`OnlineSttRuntimeForm.tsx`（APISecret 密码框）。**accent 改为 v1 收敛 `mandarin` 只读说明**（非 8 项下拉，F2 决策；详见能力—UI 矩阵 accent 行）
- [x] TS：凭证探测齐全 → `available` — `health.ts:235-249`；**实现增强为真实验签 probe**（`probe.rs` 对 `/v2/ost/query` 签名 POST，`10401` 判 available），缺任一字段 → `unconfigured`
- [x] Rust：`xunfei_speed_asr::auth` 签名与官方示例一致 — 逐行对照官方 Python demo（`signature_origin`、`headers="host date request-line digest"`、`SHA-256=` digest）；单测 2 项通过
- [x] Rust：`normalize` → 16 kHz mono s16 wav（bundled ffmpeg，**除 `.pcm` 外一律归一**，F1）— `normalize.rs`；决策单测 `only_pcm_passes_through`（mp4/m4a 真机 E2E 见手测）
- [x] Rust：`upload` 小文件 `/file/upload` + **≥30 MB 分块** `mpupload/{init,upload,complete}` — `upload.rs`（`CHUNK_THRESHOLD=30MB`）；multipart 字段顺序单测 2 项（≥30MB 真机 E2E 见手测）
- [x] Rust：`xunfei_speed_asr::parse` mock lattice → ≥2 segments — `parse.rs` 真实形态夹具（顶层 `begin/end` + `st.bg/ed` + `cw[0]`）单测通过
- [x] Rust：`SttVocabularyChannel::XunfeiSpeedAsrHotword` + truncation warning — `stt_vocabulary.rs`；单测 `channel_for_xunfei_speed_asr`、`xunfei_hotword_joins_with_comma`
- [x] engine：`iflytek:speed-transcription:file`（`mod.rs:21`）；`pro_create` 携带 `accent`（`task.rs:135`，v1 恒 `mandarin`）
- [x] 在线 401/配额/超时：**仅错误**，无本机 fallback — `run_transcribe_cmd/sync.rs` 在线/本机分支前置互斥，在线 `Err` 经 `?` 直接上抛，无回落分支（真机 401/quota 文案映射见手测）
- [x] 自动化：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` — typecheck ✓ / test **1489 通过** / guard **0 错误**
- [x] 自动化：`cargo test … xunfei_speed_asr`（9 通过）+ `… stt_vocabulary`（11 通过）
- [x] 手测：见 hand-test checklist — **签收 ✅ 2026-06-18**

## 能力—UI 状态矩阵

> 维度定义：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)

| UI 控件 / 文案 | 状态维度 | 数据源 | 手测场景 |
|----------------|----------|--------|----------|
| 厂商 chip「讯飞极速录音转写」 | 用户所选在线 provider D-Online-1 | `selectedProviderId=iflytek-speed-asr` | 切换百炼 ↔ 讯飞，表单字段数变化（2 vs 3 密钥） |
| AppID 输入框 | 可持久化应用标识 | `runtime.appKey` / localStorage | 重启后 AppID 仍在；APIKey/Secret 需重填 |
| APIKey / APISecret | 会话根凭证 | `memorySecrets` | 仅填 Key 不填 Secret → 探测 `unconfigured` |
| 连接探测结果 | 厂商可达性（非本机 ASR D5） | `probeExternalSttOnlineHealth` | **禁止**用侧车 `ready_for_transcribe` 表示讯飞可用 |
| 术语偏置角标 | provider capability | `sttVocabularyBias` | 选讯飞时显示「术语偏置」；OpenAI 等同理 |
| 转写 preflight 文案 | 所选 provider 术语通道 | `glossaryBiasPreflightLineForProviderId` | 浮动框含「在线讯飞：术语同步为请求热词。」 |
| 预置端点只读展示 | 厂商预置 URL | `resolveSttOnlinePresetEndpointDisplay` | 展示 OST 任务 base，非旧听写 WS |
| accent（v1 收敛 mandarin） | 固定普通话（202 方言免切自动识别） | `normalizeXunfeiSpeedAsrAccent` | 环境页显示只读说明，无下拉；`pro_create.business.accent` 恒为 `mandarin`（旧持久化方言码亦归一） |

**矛盾场景手测（必填）**：

1. **D-Online-1 ≠ 本机 D5**：侧车 Paraformer 未就绪，但讯飞三件套已填 → 在线转写仍应可发起（仅在线路径）。
2. **探测 available ≠ 转写必成功**：凭证格式正确但配额用尽 → 转写失败应有可读错误，非 silent fallback 本机。

## 自动化

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml xunfei_speed_asr
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml stt_vocabulary
cd apps/desktop && npx vitest run \
  src/services/stt/sttOnlineProviderContract.test.ts \
  src/services/stt/sttVocabularyBias.test.ts \
  src/services/asrTranscribeHints.test.ts
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

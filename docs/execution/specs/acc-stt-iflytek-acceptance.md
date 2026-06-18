# Acceptance: ACC-STT-IFLYTEK — 讯飞极速录音转写

> **状态**：编码完成（2026-06-18，待手测）  
> **Research**：[`r3-china-iflytek-lfasr-research.md`](./r3-china-iflytek-lfasr-research.md)  
> **Plan**：[`acc-stt-iflytek-plan.md`](./acc-stt-iflytek-plan.md)  
> **手测**：[`acc-stt-iflytek-hand-test-checklist.md`](./acc-stt-iflytek-hand-test-checklist.md)

## 范围

- 新增 **`iflytek-speed-asr`** provider（讯飞极速录音转写 / speedTranscription）
- Rust **`xunfeiSpeedAsr`**：**ffmpeg 归一** + 直传/分块上传 + 异步 Job + `lattice` 归一
- **Vendor credential triplet** UI + credentials-only 健康探测
- **Xunfei accent preset**（8 项下拉，`language: zh_cn` 固定）
- 术语库 → `business.dhw`（逗号分隔热词）

## 不做

- 讯飞标准 LFASR v2（`raasr.xfyun.cn`）— Grill 已确认走三件套 + 极速版
- 路线 C（spark `asr_llm` / Ifasr_llm）
- 说话人分离（`vspp_on` / `speaker_num` 固定 0）
- 202 方言全量下拉（仅 8 项 preset）
- 非 `zh_cn` 的 language 选择器
- 在线失败 **回落本机 ASR**（含静默与弹窗提议）
- 流式 WebSocket 听写（已移除的 `iflytek-speech` 形态）

## 验收

- [ ] TS：`iflytek-speed-asr` 定义表行 + `market: china` + capabilities（`asyncJob`、`segmentTimestamps`）
- [ ] TS：`requiresApiSecret` + `requiresPersistedAppKey` + 第三输入框 + **accent 下拉（8 项）**
- [ ] TS：credentials-only probe（AppID + APIKey + APISecret 齐全 → `available`）
- [ ] Rust：`xunfei_speed_asr::auth` 签名与官方示例一致
- [ ] Rust：`normalize` mp4/m4a → 16 kHz mono wav（bundled ffmpeg）
- [ ] Rust：`upload` 小文件 + **≥30 MB 分块** mpupload
- [ ] Rust：`xunfei_speed_asr::parse` mock lattice → ≥2 segments
- [ ] Rust：`SttVocabularyChannel::XunfeiSpeedAsrHotword` + truncation warning
- [ ] engine：`iflytek:speed-transcription:file`；`pro_create` 携带所选 `accent`
- [ ] 在线 401/配额/超时：**仅错误**，无本机 fallback
- [ ] 自动化：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [ ] 自动化：`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml xunfei_speed_asr stt_vocabulary`
- [ ] 手测：见 hand-test checklist

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
| accent 下拉 | 用户所选 accent D-Online-2 | `runtime` accent 字段 | 切换粤语后 `pro_create.business.accent=cantonese` |

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

# ASR-VOC-1 手测清单 — 转写前术语偏置可见性

> **状态**：✅ 手测签收（2026-06-02）  
> **验收真源**：[`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md) § ASR-VOC-1  
> **实现**：`transcribeVocabularyPreflight.ts`、`TranscribeOverwriteConfirmDialog.tsx`、`useTranscribeJobController.ts`  
> **契约回归**：`apps/desktop/src/services/asr/transcribeVocabularyPreflight.test.ts` → `VOC-1 hand-test sign-off (contract)`

## 环境

- [x] `npm run desktop:dev`（或已安装包）；本机 ASR 侧车可用（`curl -sf http://127.0.0.1:8741/health`）
- [x] **热词与记忆**：至少 2 条词条，均勾选 **纳入下次转写（热词）**（`hotword_enabled`）
- [x] 已打开含音频的项目，且当前文件 **已有 ≥1 条含正文的语段**（用于触发「覆盖并拉取」确认框）

## §1 — 本机 Paraformer + 2 条术语

**设置**

1. **环境与 ASR → 本机**：转写模型选 **Paraformer 长音频（推荐转写）** → 应用并重启侧车（已缓存即可）。
2. **关闭**在线 STT（或未配置在线 Key，确保走本机 `hotwords`）。
3. **热词与记忆** → 页顶 **本次转写将携带** 区块：
   - [x] 摘要主行含 **自动转录时将提交**、**已纳入词条** 数
   - [x] 灰底 `<pre>` 预览与热词数一致（见 [`hot-ux-hand-test-checklist.md`](./hot-ux-hand-test-checklist.md) §1）

**操作**

4. 编辑器点 **自动转录** → 弹出确认浮动框（`AutoTranscribeStartDialog`；有语段时为覆盖确认）。

**期望（「本次术语偏置」区块 — 与术语页标题不同）**

- [x] **自动转录**确认框与转写进行中浮动框均含 **本次术语偏置** 列表
- [x] 一行 **将携带 N 个热词（M 条词条）**（与术语页 preview 一致）
- [x] 在线：一行 **在线百炼：术语同步为厂商热词表。**（或对应厂商短句）；**无** `vocabulary_id` / `speech-biasing` 等技术参数
- [x] 本机：一行 **本机 …Paraformer…：术语随转写提交。**
- [x] **无** SenseVoice 弱热词长句

**可选（首次拉取）**：清空当前文件语段正文后拉取 → 无覆盖框，转写开始时 **toast** 含上述摘要首行（与确认框同源）。

## §2 — 在线不支持厂商 + 有术语

**设置**

1. **环境与 ASR → 在线 STT**：启用；厂商选 **腾讯云**（或百度/阿里等 **无** 术语偏置 adapter 的壳）。
2. 填有效 API Key 并 **保存在线配置**（使 `tryBuildOnlineTranscribeBridgePayload()` 非空）。
3. 术语库仍保持 ≥1 条纳入热词。

**操作**

4. 再次 **从 ASR 拉取语段** → 覆盖确认框。

**期望**

- [x] 「本次术语偏置」含 **不支持将术语表传入识别 API** / **转写仍可进行** 类文案（`glossaryBiasSummaryForProviderId`）
- [x] 点 **覆盖并拉取** → **不因词表被 gate 阻断**（若失败，应为 Key/网络/厂商 API，而非「请先配置术语」）

**契约**：`resolveTranscribeExecuteBlock` 不因 `onlineChannel===unsupported` 返回 block（Vitest 见 `transcribeVocabularyPreflight.test.ts` §2）。

## §3 — 本机 SenseVoice + 有术语

**设置**

1. 关闭在线 STT，回到本机。
2. 本机模型改 **SenseVoice 轻量** → 应用并重启侧车。
3. 术语库仍有纳入热词。

**操作**

4. **从 ASR 拉取语段** → 覆盖确认框。

**期望**

- [x] 「本次术语偏置」含 **SenseVoice** 且说明热词效果 **弱于 Paraformer** / 建议换模型或转写后改稿

## 自动化闸门（签收前必过）

```bash
cd apps/desktop && npx vitest run src/services/asr/transcribeVocabularyPreflight.test.ts src/services/asrTranscribeHints.test.ts
cd apps/desktop/src-tauri && cargo test glossary_hotwords --quiet
```

## 签收记录

| 日期 | §1 Paraformer | §2 在线不支持 | §3 SenseVoice | 备注 |
|------|---------------|---------------|---------------|------|
| 2026-06-02 | ✅ | ✅ | ✅ | 契约 Vitest 3/3 + 用户 UI 手测通过 |

**ASR-VOC-1 手测签收完成**（契约 + UI）。

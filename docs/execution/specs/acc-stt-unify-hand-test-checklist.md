# ACC-STT-UNIFY 手测清单

> **前置**：术语库至少 1 条热词（如「制控」），且勾选 **纳入热词**。  
> **UI 真源**：术语摘要见 [`hot-ux-hand-test-checklist.md`](./hot-ux-hand-test-checklist.md) § UI 落位；在线厂商映射见 [`asr-voc-3-hand-test-checklist.md`](./asr-voc-3-hand-test-checklist.md) §1。

## 本机 FunASR（可独立签收）

**环境**：**关闭**「启用在线 STT」（或未填在线 API Key，确保走本机 8741）。

1. **热词与记忆**（非「环境与 ASR」）：
   - 新增「制控」等词条 → 勾选 **纳入下次转写（热词）** 并保存。
   - 页顶 callout 区块标题为 **本次转写将携带**；摘要主行含 **自动转录时将提交 … 个热词**；灰底 `<pre>` 预览非空。
   - 详见 [`hot-ux-hand-test-checklist.md`](./hot-ux-hand-test-checklist.md) §1。
2. **环境与 ASR → 本机**：模型 **Paraformer 长音频（推荐转写）** → **应用并重启侧车** → 已缓存。
3. 打开有音频的项目 → 转写来源选 **在线 STT** → 点 **自动转录**（短音频 1～3 分钟即可）。
4. 项目面板 **转写提示条**（`TranscribeHintsBanner`）：
   - [x] **不应**出现 `hotwords_ignored_stub`（说明未走 FunASR 本机）
   - [x] **不应**出现「在线识别引擎不支持术语偏置」（说明误走在线）
   - [x] 能出语段（0 语段时先确认模型为 Paraformer、非 SenseVoice 短句 SKU）
5. （可选）术语拼接超 12k → hints 含截断提示 — 日常可跳过。

- [x] 本机 Paraformer 路径通过

## 在线（条件不足时可整段跳过）

> U2 能力矩阵 UI 已由 Vitest 覆盖；**端到端在线拉取**待有 OpenAI/AssemblyAI/Deepgram/百炼 Key 后再补。

**环境页共同期望**（**环境与 ASR → 在线 STT**）：

- 选中厂商 chip 后，其 **描述段落下方** 出现角标行；支持术语的厂商含 **术语偏置** 圆角标签（`OnlineSttProviderPicker`，**不在** chip 文字内）。
- 面板底部 info 区（`EnvOnlineSttPanel`）含一行：`本机 FunASR 通过 hotwords 携带术语偏置。术语表 → …`（随所选厂商变化）。

### OpenAI（有 API Key 时）

- [ ] 厂商描述下方角标含 **术语偏置**
- [ ] 底部 info 含 `OpenAI 音频转写 prompt（≤224 字…）`
- [ ] 拉取转写 → 无 `online_vocabulary_unsupported`
- [ ] （VOC-3）100+ 术语时 hints 含 OpenAI prompt 截断说明 — 见 [asr-voc-3-hand-test-checklist.md](./asr-voc-3-hand-test-checklist.md) §2

### AssemblyAI / Deepgram（可选各测一条）

- [ ] 角标含 **术语偏置**；底部 info 含 `keyterms_prompt` / `keywords` 映射摘要
- [ ] 拉取 → 无 `online_vocabulary_unsupported`（配置正确时）

### 百炼 Fun-ASR（ACC-STT-ALI）

> 细则见 [`acc-stt-ali-hand-test-checklist.md`](./acc-stt-ali-hand-test-checklist.md)。

- [ ] 厂商 **术语偏置** 角标；描述含 `Fun-ASR` / `vocabulary_id` / `fun-asr`
- [ ] 底部 info 含 `百炼 speech-biasing 热词表（vocabulary_id…fun-asr）`
- [ ] 预置转写端点只读展示为 `…/api/v1/services/audio/asr/transcription`（非 Qwen3 chat/completions）
- [ ] 拉取 → 无 `online_vocabulary_unsupported`；日志含 `vocabulary=vocab-rushi-…`
- [ ] engine 为 `dashscope:fun-asr:file`（或历史 SSE 路径 `dashscope:fun-asr-realtime`）

### 不支持厂商（如腾讯云）

- [ ] 启用该厂商并拉取 → hints 含「在线识别引擎不支持术语偏置」类文案

## 签收

| 日期 | 范围 | 结果 | 备注 |
|------|------|------|------|
| 2026-05-31 | 本机 only | ✅ | Paraformer 拉取语段正常；无 stub/在线 unsupported；热词 L2 偏置有限（预期） |
| 2026-06-02 | 在线 E2E | 豁免 | ASR-VOC-3 §1 文案 ✅；无 API Key；见 [asr-voc-3-signoff-2026-06.md](./asr-voc-3-signoff-2026-06.md) |
| 2026-06-12 | 百炼 E2E | ✅ | §1–§3 用户手测；§4 日志验收（[`acc-stt-ali-hand-test-checklist.md`](./acc-stt-ali-hand-test-checklist.md)） |

**ACC 在线 E2E ≥1 家**：百炼 ✅（OpenAI/AssemblyAI/Deepgram 仍可选补测）。

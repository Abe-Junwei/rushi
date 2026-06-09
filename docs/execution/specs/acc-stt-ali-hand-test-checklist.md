# ACC-STT-ALI 手测清单 — 百炼 Fun-ASR + 术语热词

> **前置**：百炼 API Key（`sk-…`，与 LLM 通义千问可共用）；术语库至少 1 条 **纳入热词** 的专名。  
> **验收**：[`acc-stt-ali-acceptance.md`](./acc-stt-ali-acceptance.md) · **调研**：[`asr-cloud-model-tuning-feasibility-research.md`](./asr-cloud-model-tuning-feasibility-research.md)

## 环境准备

1. **环境 → 在线 STT**：启用；厂商选 **阿里云百炼语音识别（Fun-ASR）**。
2. 内存凭证填入百炼 **API Key**；连接探测通过（或手动确认 Key 有效）。
3. 确认默认转写 URL 为 `…/aigc/multimodal-generation/generation`（非旧 Qwen3 chat/completions）。
4. 厂商卡片显示 **术语偏置** 角标；说明区含 `vocabulary_id` / `fun-asr-realtime` 文案。

## 术语同步（热词 CRUD）

1. 术语库新增 1–2 个专名（如产品名），勾选 **纳入热词**。
2. 打开有音频的项目 → **在线**拉取转写（短音频 30s–3min 即可）。
3. 查看桌面日志（或 `~/Library/Logs/…` 应用日志）：
   - [ ] 出现 `INFO dashscope vocabulary create` 或 `update`（首次 create，改术语后 update）
   - [ ] 出现 `INFO dashscope fun-asr-realtime vocabulary=vocab-rushi-…`（非 `none`）
4. 再次拉取且**未改术语**：
   - [ ] 不应重复 create（会话内 hash 缓存；日志仍带同一 `vocabulary_id`）

## 转写结果

- [ ] 拉取成功，engine 含 `dashscope:fun-asr-realtime`
- [ ] **不应**出现 `online_vocabulary_unsupported`
- [ ] 有术语时 **不应**出现 `online_vocabulary_sync_failed`（若出现：检查 Key 权限 / 网络 / 北京地域）

## 负例（可选）

| 场景 | 预期 |
|------|------|
| 术语库为空 | 转写正常；日志 `vocabulary=none`；无 sync_failed |
| 超长英文术语（>7 词） | hints 含百炼热词长度说明；其余有效词仍同步 |
| 改回腾讯云等不支持厂商 | hints 含「不支持术语偏置」 |

## 与 Qwen3 路径差异（回归）

- [ ] 环境页描述为 **Fun-ASR**，非 Qwen3-ASR-Flash
- [ ] 旧 endpoint `compatible-mode/v1/chat/completions` 仅当用户手动覆盖时出现

## 签收

| 日期 | 结果 | 备注 |
|------|------|------|
| | ⏳ | Key / 网络 / 音频待测 |

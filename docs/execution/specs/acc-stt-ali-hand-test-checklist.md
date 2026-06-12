# ACC-STT-ALI 手测清单 — 百炼 Fun-ASR + 术语热词

> **前置**：百炼 API Key（`sk-…`，与 LLM 通义千问可共用）；术语库至少 1 条 **纳入热词** 的专名。  
> **验收**：[`acc-stt-ali-acceptance.md`](./acc-stt-ali-acceptance.md) · **调研**：[`asr-cloud-model-tuning-feasibility-research.md`](./asr-cloud-model-tuning-feasibility-research.md)  
> **术语 UI**：[`hot-ux-hand-test-checklist.md`](./hot-ux-hand-test-checklist.md) · **ACC 共用**：[`acc-stt-unify-hand-test-checklist.md`](./acc-stt-unify-hand-test-checklist.md)

## 0. 机器闸门（无 Key 可做）

```bash
bash scripts/asr-voc-3-hand-test.sh
```

## 1. 术语页（热词与记忆）

1. 新增 1–2 个专名（如「制控」），勾选 **纳入下次转写（热词）** 并保存。
2. 页顶 callout 标题 **本次转写将携带**；摘要含 token / 词条数；`<pre>` 预览非空。
3. （可选）改术语后刷新页面，预览与 token 数同步更新。

- [ ] §1 术语摘要可见且与勾选一致

## 2. 环境页（在线 STT）

1. **环境 → 在线 STT**：启用；厂商选 **阿里云百炼语音识别（Fun-ASR）**（`dashscope-asr`）。
2. 填入百炼 **API Key** → **保存在线配置** → **连接探测**（有延迟 ms 或模型列表即通过）。
3. **UI 核对**（选中百炼 chip 后）：
   - [ ] 描述段含 **Fun-ASR**、**vocabulary_id** / **fun-asr**
   - [ ] 角标行含 **术语偏置**（位于描述下方，非 chip 文字内）
   - [ ] 只读 **预置转写端点** 为  
         `https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription`  
         （**不是** `…/aigc/multimodal-generation/generation` 或 Qwen3 `chat/completions`）
   - [ ] 面板底部 info：`术语表 → 百炼 speech-biasing 热词表（vocabulary_id…）`

## 3. 术语同步 + 转写（E2E）

1. 打开有音频的项目 → 转写来源选 **在线 STT**。
2. 点 **自动转录**（短音频 30s–3min）；浮动框 **本次术语偏置** 应含：
   - `将携带 N 个热词（M 条词条）。`
   - `在线百炼：术语同步为厂商热词表。`（**无** API 字段名堆砌）
3. 查看桌面日志（或 `~/Library/Logs/…` 应用日志）：
   - [ ] `INFO dashscope vocabulary create` 或 `update`（首次 create，改术语后 update）
   - [ ] `INFO dashscope fun-asr-realtime vocabulary=vocab-rushi-…`（非 `none`）
4. 再次拉取且**未改术语**：
   - [ ] 不应重复 create（会话内 hash 缓存；日志仍带同一 `vocabulary_id`）

## 4. 转写结果

- [x] 拉取成功（`transcribe_timeline_last.json` → `outcome: success`，`source: online`）
- [x] engine 为 **`dashscope:fun-asr:file`**（录音文件异步 Job；旧清单写的 `fun-asr-realtime` 指 SSE 路径，当前默认走 file ASR）
- [x] **不应**出现 `online_vocabulary_unsupported`（全量 `desktop.log` 无匹配）
- [x] 有术语时 **不应**出现 `online_vocabulary_sync_failed`（全量 `desktop.log` 无匹配；本次 `vocabulary=vocab-rushi-a09794a760d14e578034b1bdbb7aea04`）

**2026-06-12 日志摘录**（`~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log`）：

```
INFO dashscope vocabulary update
INFO dashscope file_asr submit model=fun-asr vocabulary=vocab-rushi-a09794a760d14e578034b1bdbb7aea04
INFO dashscope file_asr fetch_result
INFO dashscope file_asr segments=267 full_text_len=5049
INFO transcribe_stage=parse
INFO transcribe_stage=save
```

`transcribe_timeline_last.json` 仅含 `correction_rule_hint:*`，无词表类 warning。

## 5. 负例（可选）

| 场景 | 预期 |
|------|------|
| 术语库为空 | 转写正常；日志 `vocabulary=none`；无 sync_failed |
| 超长英文术语（>7 词） | hints 含百炼热词长度说明；其余有效词仍同步 |
| 改回腾讯云等不支持厂商 | 环境页无 **术语偏置** 角标；hints 含「不支持术语偏置」 |

## 6. 与 Qwen3 路径差异（回归）

- [ ] 环境页描述为 **Fun-ASR 录音文件异步转写**，非 Qwen3-ASR-Flash
- [ ] 旧 endpoint `compatible-mode/v1/chat/completions` 仅出现在 **探测 URL** 或用户手动覆盖自定义代理时

## 签收

| 日期 | §1 术语 UI | §2 环境 UI | §3–§4 E2E | 备注 |
|------|------------|------------|-----------|------|
| 2026-06-12 | ✅ 用户手测 | ✅ 用户手测 | ✅ 代理验日志 | `vocab-rushi-a09794a760d14e578034b1bdbb7aea04`；engine `dashscope:fun-asr:file`；267 语段 |

# Intent: auto_punctuate

## 目标
为当前选中的中文语段提供一次性「自动标点」能力：将无标点或标点较弱的正文发送到一个远程 OpenAI-compatible 文本模型，返回候选结果与差异预览，用户确认后再写回当前语段。

## 为什么现在做

1. UI 根部、语段 `uid`、草稿 store、波形同步与关窗收口已稳定，具备在编辑链路中插入一个新动作的条件。
2. 相比多厂商统一推理层或本地 LLM，`auto_punctuate` 是业务价值最高、边界最清晰的后处理薄片。
3. 该能力不要求更改 SQLite 真源、导出链路或 ASR 侧车矩阵，适合单人按 1～1.5 周做最小闭环验证。

## 用户任务

1. 用户在编辑器中选中一条语段。
2. 点击「自动标点」。
3. 系统展示原文与候选正文的 diff 预览，并明确提示文本将发送到云端。
4. 用户选择：
   - 确认写回当前语段
   - 取消，不改动正文

## 目标内范围

- 仅支持 **单语段**、**中文自动标点**。
- 仅支持 **1 个 OpenAI-compatible HTTP provider**。
- 仅支持 **显式预览 + 用户确认写回**。
- 请求由 **Tauri/Rust** 直接发起；不进入 `services/asr` PyInstaller 侧车。
- 输入文本以当前编辑器可见正文为准；请求前需对齐草稿 store。

## 明确不做

- 不做 `smart_segment`、`normalize_text`、`speaker_diarization`。
- 不做整文件批量标点。
- 不做静默覆盖。
- 不做本地 vLLM / Transformers / llama.cpp。
- 不抽象为通用 `InferenceEngine`。
- 不把术语库、翻译词典、纠错记忆自动拼进提示词；R2 首轮仅处理当前语段正文与轻量上下文摘录。

## 边界决策

### 调用边界

```text
React（语段工具栏动作）
  → invoke('postprocess_auto_punctuate', { segment_uid, text, neighbor_snippets? })
  → Rust（读取 postprocess 配置与 api_key_id → keychain）
  → HTTPS 调 OpenAI-compatible
  → 返回 { text, diff, provider, latency_ms }
  → 用户确认 → updateSegmentText 写回
```

### 配置与密钥

- **非密钥配置**：provider、base_url、model 可由桌面配置持久化。
- **密钥**：通过 `api_key_id` 引用 OS keychain 中的 secret；**不**直接明文落盘。
- 若 keychain 不可用或 `api_key_id` 无法解析，功能应 fail closed，并向用户返回中文提示。

### 隐私与错误

- 首次使用必须向用户说明「语段文本将发送到云端服务」。
- 错误只返回用户可读中文文案；不把 provider 原始 stack trace 透给 UI。
- 超时、取消、网络失败均不改动原文。

## 成功标准

- 10 条无标点中文样本中，人工判定合理率 > 80%。
- 取消、关闭预览、网络失败时，当前语段不被改写。
- 确认写回后，语段正文、草稿 store、未保存状态保持一致。

## 依赖与前置

- R0 已完成：架构守卫 0 警告，主编排层可继续承载新动作。
- 术语页 GLY-1 手测可独立进行，但 **不阻塞** `auto_punctuate` 规格与实施。
- R3 的 `profile.rs` 尚未落地；R2 需要预留向 typed profile 迁移的兼容位，但不等待 R3 才能开始。

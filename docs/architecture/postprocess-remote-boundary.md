# 后处理远程调用边界（R1 定稿）

> 日期：2026-05-25  
> 范围：`auto_punctuate` 首轮实现  
> 与实现冲突时：以代码、ADR 与本文件为准。

---

## 1. 结论

`auto_punctuate` 采用 **桌面壳直连远程 provider** 的方式实现：

```text
React 预览 UI
  → Tauri command
  → Rust 读取 postprocess 配置 + keychain secret
  → HTTPS 调 OpenAI-compatible
  → 返回候选正文 + diff
```

**明确不进入**：

- `services/asr` Python/FastAPI 侧车
- PyInstaller wheel / sidecar 依赖矩阵
- 统一 `InferenceEngine`

---

## 2. 为什么不进 ASR 侧车

### 2.1 依赖边界不同

ASR 侧车当前承载的是：

- FunASR / SenseVoice 推理
- 模型下载与校验
- CPU / MPS / CUDA 矩阵
- stub 回退与 `/health`

将 LLM 后处理塞进去会把：

- 文本类 provider SDK / HTTP 契约
- API key 管理
- 云端隐私提示
- 文本 diff / prompt 规则

一起耦合进侧车，直接扩大发布物、测试矩阵与故障面。

### 2.2 发布节奏不同

后处理 provider 的：

- base_url
- model
- headers / 鉴权
- 提示词细节

比 ASR 侧车的二进制与模型矩阵更容易变化。放在桌面壳 Rust 层，改动与回归成本更低。

### 2.3 信任边界更清晰

`auto_punctuate` 是一个**显式云端动作**。由桌面壳直接发起请求，更容易做到：

- 首次使用隐私明示
- provider / latency 可见
- 配置错误直接反馈到 UI

而不是藏进 ASR 侧车后被误认为「本地推理的一部分」。

---

## 3. 首轮架构边界

### 3.1 做

- 单一 `postprocess_auto_punctuate` 命令
- 单一 OpenAI-compatible provider
- 单语段请求
- 用户确认写回
- Rust 侧统一返回 `text + diff + provider + latency_ms`

### 3.2 不做

- 本地 LLM
- 批量后处理
- 多任务后处理平台
- 通用推理引擎
- 把 glossary / correction_memory 自动拼成复杂 prompt

---

## 4. 配置与密钥

### 4.1 首轮要求

- **非密钥配置**：provider、base_url、model 可持久化。
- **密钥**：通过 `api_key_id` 引用 OS keychain 中的 secret。
- **UI / 文档 / 日志** 不得回显 secret 明文。

### 4.2 与现有在线 STT 的关系

在线 STT 当前采用：

- 非密钥配置进 storage
- 根密钥仅内存保存

`auto_punctuate` **不复用**该内存 secret 路径作为长期方案，原因是：

1. 后处理动作需要由 Rust/Tauri 直接出站请求。
2. 路线图 R3 已规划 `profile.rs` / `api_key_id`。
3. 让 Rust 自己解析 keychain 更符合信任边界。

若实施时 keychain 接入复杂度明显超出预期，允许回退到「临时内存 secret」原型，但必须单独登记为例外，不得静默替换本决策。

---

## 5. 与后续阶段的关系

### R2

R2 只实现 `auto_punctuate`，不引入更多任务。

### R3

R3 的 `profile.rs` 负责把 postprocess 非密钥配置纳入 typed profile；**不改变本文件定义的远程调用边界**。

### R5

MCP 只读服务不应直接调用 postprocess 写路径；后处理仍是桌面内显式用户动作。

---

## 6. 失败与降级

- 配置缺失 / keychain 解析失败：返回中文错误，功能不可用。
- provider 超时：返回中文错误，原文不变。
- 用户取消：中断 in-flight 请求，原文不变。
- provider 返回异常内容：不写回，提示失败。

---

## 7. 后续若要改边界，必须重新评审

以下任一项若要引入，必须更新本文件：

1. **本地 LLM**（loopback Ollama 或 LRC `llm-runtime`）— 规划 [`llm-local-runtime-backlog.md`](../execution/specs/llm-local-runtime-backlog.md)；v1 不做，v1 后 **LLM-LOC-4a/4b**
2. 多 provider 抽象层
3. 批量后处理
4. 将后处理并入 ASR sidecar
5. 将 glossary / correction_memory / 词典自动拼成复杂 prompt

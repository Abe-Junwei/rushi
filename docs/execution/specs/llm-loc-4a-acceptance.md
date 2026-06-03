# Acceptance: LLM-LOC-4a（Ollama loopback）

> **状态**：✅ 编码签收（2026-06-03）  
> **Spike**：[llm-loc-spike-results-2026-06.md](./llm-loc-spike-results-2026-06.md)  
> **Backlog**：[llm-local-runtime-backlog.md](./llm-local-runtime-backlog.md) §4.1

## 范围

- 环境页 **本机 LLM（Ollama）** 检测条 + 厂商预设 `Ollama（本机）`
- loopback 无需 API Key；`postprocess_cmd` 占位密钥 + `allow_insecure_http`
- **R3t-C 自动标点** 可走本机；R3t-D/E 仍默认云端（产品文案）

## 验收

- [x] `ollama_detect_status`：11434 `/api/tags` 可达性
- [x] 设置 → LLM：选 Ollama → 保存 → 探测成功（本机已 `ollama pull qwen2.5:7b`）
- [x] `tryBuildPostprocessRuntimeBridge` / `isLlmRuntimeReady` 对 loopback 无 Key 就绪
- [x] Rust：`resolve_runtime_postprocess_config` loopback 占位 key
- [x] 单测：`postprocessRuntimeContract` · `postprocess_cmd_tests` loopback

## 手测（发布前）

1. 停止 Ollama → 环境页检测条为红/黄，探测失败文案可读  
2. 启动 Ollama → 检测就绪 → 保存 → 编辑器自动标点一条语段 → diff 预览确认  

## 不做

- LLM-LOC-4b LRC 自管 runtime  
- 环境页 Promote 为默认 provider（仍默认 DeepSeek）

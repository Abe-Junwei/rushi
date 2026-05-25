# Batch 6 — 在线 STT Provider

## 链路模拟

| Step | 结论 |
|------|------|
| 启用在线 STT 但配置不全 | `isSttOnlineEnabledButIncomplete` 拦截转写 | OK |
| 构建 bridge payload | `sttOnlineProviderContract` + bridge tests | OK |
| 自定义 URL | `is_allowed_stt_transcribe_url` + SSRF tests | OK |
| Native 适配器 | `stt_native::dispatch_native` | 需密钥，手测 |

## 架构

- 密钥存前端 env/localStorage（实验性）— 见 `docs/architecture/stt-online-providers.md`；勿打进 diagnostic zip（当前 diagnostic 不含 env）

## 与 R2-001 关系

在线/离线转写共用 `project_run_transcribe` 错误 file_id 路径

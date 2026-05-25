# Acceptance: R3a — LLM Keychain 持久化与连通性探测

> **状态**：已完成（自动化 + 手测通过）  
> **规划门禁**：已确认 — 不引入捆绑网关；STT/LLM **分通道**；薄片顺序 R3a→b→c→d  
> **关联**：[`r3-provider-configuration-research.md`](./r3-provider-configuration-research.md)、[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md)、R2 [`auto-punctuate-acceptance.md`](./auto-punctuate-acceptance.md)

## 目标

在 **不合并 STT/LLM 通道**、**不引入 LiteLLM 等网关** 前提下，让「设置 → LLM 配置」的 API Key **重启后仍可用**，并提供与在线 STT 同构的 **连通性探测**；自动标点继续走 `postprocess_auto_punctuate` + 可选 `runtime` 桥接。

## 范围

### 做

| 项 | 说明 |
|----|------|
| Keychain 读写 | Tauri 命令：`llm_save_api_key` / `llm_delete_api_key`（或合并为 `llm_set_api_key`）；service `studio.lingchuang.rushi.postprocess`（与现有 Rust 一致） |
| `api_key_id` 持久化 | localStorage 键 `rushi.llm.apiKeyId`（默认 `default`）；**不**存明文 Key |
| 解析顺序 | `postprocess_auto_punctuate`：若 `runtime.api_key` 非空 → 用会话桥接；否则 `api_key_id` → keychain → 开发 env `RUSHI_POSTPROCESS_API_KEY` |
| 探测 | Tauri `llm_probe_connection`：`GET {base}/models` 或最小开销请求；返回 `{ ok, status?, message, latency_ms? }` |
| UI | `EnvLlmConfigPanel`：保存 Key 写 keychain；显示「已保存 / 未配置」；「探测连接」按钮 + 结果文案 |
| 契约 | `postprocessRuntimeContract.ts`：`LLM_STORAGE_KEYS.apiKeyId`、读写 helper；探测类型与 STT probe 状态机对齐 |

### 不做（R3a）

- `profile` 导入导出（R3b）
- 本机 ASR 引导 / 缓存 UI（R3c）
- 设置页三分栏 IA 大改（R3d，仅允许 R3a 必要文案）
- 新增 LLM 厂商（可后续小 PR）
- STT keychain 迁移（保持 STT 内存密钥策略不变）

## 非功能约束

- API Key **不得**写入 localStorage、`profile`、日志、错误正文全文。
- HTTPS 策略与 `parse_postprocess_endpoint` 一致；loopback HTTP 仅开发。
- 探测超时 ≤ 15s；不触发计费型长 chat（优先 `/v1/models`）。
- 中文用户可见错误；Rust 侧 `append_desktop_log` 可记 status，不记 Key。

## 落位文件（实施时）

| 层 | 路径 |
|----|------|
| Rust | `apps/desktop/src-tauri/src/postprocess_cmd.rs`（或拆 `llm_config_cmd.rs`）、`lib.rs` 注册命令 |
| TS 契约 | `apps/desktop/src/services/postprocess/postprocessRuntimeContract.ts` |
| API | `apps/desktop/src/tauri/postprocessApi.ts`（或 `llmConfigApi.ts`） |
| UI | `apps/desktop/src/components/EnvLlmConfigPanel.tsx` |
| 测试 | `postprocessRuntimeContract.test.ts`、`postprocess_cmd` 单元测试 |

## 自动化验收

- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run lint`
- [x] `node scripts/check-architecture-guard.mjs`
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

## Focused tests

### TypeScript

- [x] `apiKeyId` 默认与持久化 round-trip
- [x] `isLlmRuntimeReady()`：keychain 已配置时，**无**内存 Key 也可 ready（storage + bridge 回归）
- [x] 探测结果 UI 状态：busy / ok / fail 文案

### Rust

- [x] `resolve_postprocess_config`：`runtime` 优先于 `api_key_id` + keychain
- [ ] 无 `api_key_id`、无 runtime、无 env → 中文错误
- [x] `parse_postprocess_endpoint` 回归不退化
- [x] `llm_probe_connection`：mock HTTP 2xx/401/超时 → 结构化响应

## 手测清单

### A. Keychain 持久化

1. 打开「设置 → LLM 配置」，选择 DeepSeek，填写有效 API Key，点击保存。
2. 完全退出并重启应用。
3. 打开同一项目，触发「自动标点」（无需重新粘贴 Key）。
4. 确认预览流程可用（或探测显示可达）。

### B. 探测 — 成功

1. 配置有效 Key 与 `https://api.deepseek.com/v1`。
2. 点击「探测连接」。
3. 确认显示成功类文案与耗时；无 Key 泄露到界面持久字段。

### C. 探测 — 失败

1. 故意填错 Key 或错误 base_url。
2. 探测应显示失败说明（含 HTTP 状态或网络类中文提示）。
3. 自动标点触发时应同类错误，**不**写回语段。

### D. 会话桥接优先（回归 R2）

1. 保存 Key 到 keychain 后，仅在内存覆盖另一 Key（若 UI 仍支持「本次会话」输入）。
2. 确认当次请求使用会话 Key；清除会话后回退 keychain。

### E. STT 不受影响

1. 在线 STT 配置与探测仍独立可用；未改动 `sttOnlineProviderContract` 存储键。

## 手测记录

| 日期 | Provider | 结果 | 备注 |
|------|----------|------|------|
| 2026-05-25 | DeepSeek | ✅ 通过 | A 重启后 keychain 持久化通过；B probe 成功通过；C 失败路径经 UI 状态修复后复测通过 |

## 完成定义

- [x] 上述自动化项全绿
- [x] 手测 A + B 通过（C 至少抽查一次）
- [x] 路线图 R3a 标 ✅，§10 入口切至 R3b

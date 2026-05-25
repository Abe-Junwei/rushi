# Acceptance: R3b — Profile 导入导出（无 secret）

> **状态**：已完成（自动化 + 手测通过）  
> **规划门禁**：已确认 — 不引入捆绑网关；STT/LLM **分通道**；薄片顺序 R3a→b→c→d  
> **关联**：[`r3-provider-configuration-research.md`](./r3-provider-configuration-research.md)、[`r3a-llm-keychain-probe-acceptance.md`](./r3a-llm-keychain-probe-acceptance.md)

## 目标

提供一套可落地、可备份、**不包含密钥** 的环境 profile 导入导出能力，覆盖当前已经真正可持久化的云侧配置：

- LLM（provider/base_url/model/api_key_id）
- 在线 STT（enabled/provider/endpoint/app_key/timeout）

首版 **不**把 profile 升级成运行时第一真源，也 **不**把 API Key 明文写入文件。

## 范围

### 做

| 项 | 说明 |
|----|------|
| Rust `profile.rs` | 负责系统文件对话框、YAML 读写、schema 版本检查、secret 字段拒绝 |
| TS profile contract | 负责从现有 storage 合成 profile，并把导入结果回写到现有 storage |
| 设置页入口 | 在环境页提供「导出 profile」「导入 profile」按钮与结果提示 |
| 导出内容 | `version: 1` + `llm` + `online_stt`；`api_key_id` 允许导出，`api_key` 不允许 |
| 导入校验 | 拒绝 `api_key` / `authorization` / `secret` 等字段；未知 schema 版本报中文错误 |

### 不做（R3b）

- profile 作为运行时唯一真源
- STT 根密钥导出
- LLM API Key 导出
- 本机 ASR 缓存/manifest/首次引导（R3c）
- 本机 ASR 可写配置（当前仅健康信息，不是稳定设置源）

## 建议 schema（首版）

```yaml
version: 1
llm:
  provider_id: deepseek
  base_url: https://api.deepseek.com/v1
  model: deepseek-chat
  api_key_id: default
online_stt:
  enabled: false
  provider_id: openai
  endpoint: null
  app_key: null
  timeout_ms: 30000
```

## 非功能约束

- 导出文件 **不得**包含 `api_key`、`authorization`、`token`、`secret` 等明文凭证。
- 导入时若检测到 secret 字段，必须直接拒绝并给中文错误。
- YAML 应尽量可读；字段名统一 snake_case。
- 导入成功后仍沿用现有 storage/keychain 路径，不引入第二套运行时状态。

## 落位文件（实施时）

| 层 | 路径 |
|----|------|
| Rust | `apps/desktop/src-tauri/src/profile.rs`、`lib.rs` |
| TS 契约 | `apps/desktop/src/services/profile/profileContract.ts` |
| API | `apps/desktop/src/tauri/profileApi.ts` |
| UI | `apps/desktop/src/components/EnvironmentPanel.tsx`（可拆小组件） |
| 测试 | `profile.ts`/`profile.rs` focused tests |

## 自动化验收

- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run lint`
- [x] `node scripts/check-architecture-guard.mjs`
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

## Focused tests

### TypeScript

- [x] 从现有 storage 生成 profile 时不包含明文 `api_key`
- [x] 导入 profile 后，LLM 与在线 STT 配置能正确回写 storage
- [ ] 未知 provider / 非法字段给出中文错误或按约定回退

### Rust

- [x] YAML round-trip：导出后可再次导入
- [x] 含 `api_key` / `authorization` / `secret` 字段的文件被拒绝
- [x] `version != 1` 被拒绝
- [ ] 用户取消文件选择时返回 `None`

## 手测清单

### A. 导出

1. 在「设置 → LLM 配置」与「在线 STT」中准备一组非默认配置。
2. 点击「导出 profile」并保存到本地。
3. 打开导出的 YAML。
4. 确认：
   - 有 `llm` 与 `online_stt`
   - 有 `api_key_id`
   - **没有** `api_key`

### B. 导入

1. 手动修改导出的 YAML 中的 provider/base_url/model/timeout。
2. 点击「导入 profile」。
3. 确认设置页反映新值。

### C. 拒绝 secret

1. 在 YAML 中手动加入 `api_key: sk-xxx`。
2. 点击导入。
3. 确认导入失败，并提示 profile 含敏感字段。

## 手测记录

| 日期 | 场景 | 结果 | 备注 |
|------|------|------|------|
| 2026-05-25 | A 导出 / B 导入 / C 拒绝 secret | ✅ 通过 | 用户确认验证通过；导入导出入口已调整为环境页左侧「配置迁移」 |

## 完成定义

- [x] 自动化项全绿
- [x] 手测 A + B + C 通过
- [x] 路线图 §10 下一刀切至 R3c 或下一优先事项

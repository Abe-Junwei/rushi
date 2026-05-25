# Acceptance: auto_punctuate

## 目标
确认 `auto_punctuate` 在桌面端形成完整闭环：请求云端 provider、展示 diff 预览、确认写回、失败可恢复，并且不破坏现有语段草稿 / 保存 / 关窗链路。

## 自动化验收

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `node scripts/check-architecture-guard.mjs`
- [ ] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

## focused tests

### 前端

- [ ] `useAutoPunctuateController`：
  - 选中语段时可触发请求
  - 无选中语段时禁用
  - 关闭预览 / 取消请求后不写回
  - 确认写回后调用 `updateSegmentText`
- [ ] `AutoPunctuatePreviewDialog`：
  - 正确展示 diff / provider / latency
  - busy 时按钮禁用
  - 取消不会触发写回

### Rust

- [ ] `postprocess_auto_punctuate`：
  - 缺少配置 / `api_key_id` / keychain secret 时返回中文错误
  - provider 非 2xx 时返回规范化错误
  - 超时返回中文错误
  - 返回体能产出 `diff`

## 手测清单

### A. 正常路径

1. 打开一个中文项目，选中一条无标点或弱标点语段。
2. 点击「自动标点」。
3. 确认出现预览对话框，展示：
   - 原文与候选文
   - diff
   - provider
   - latency
   - 隐私说明
4. 点击「确认写回」。
5. 确认：
   - 当前语段正文被替换
   - 未保存状态被正确标记
   - 其余语段不受影响

### B. 取消路径

1. 再次触发「自动标点」。
2. 点击「取消」或关闭预览。
3. 确认当前语段正文不变。

### C. 失败路径

1. 模拟网络失败 / 无效配置 / provider 非 2xx。
2. 触发「自动标点」。
3. 确认顶部出现中文错误提示。
4. 确认正文未被修改。

### D. 草稿一致性

1. 在语段输入框中修改正文但不保存项目。
2. 直接触发「自动标点」。
3. 确认请求处理的是当前可见文本，而不是旧快照。
4. 点击确认写回后，草稿 store 与语段列表内容一致。

### E. 关窗与恢复

1. 确认写回后，不保存项目，直接点关闭按钮。
2. 确认未保存对话框仍按既有逻辑工作。
3. 选择留在应用中，文本保持不变。

## 人工样本表（10 条）

| # | 原文 | 候选 | 是否可接受 | 备注 |
|---|------|------|-----------|------|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |
| 6 |  |  |  |  |
| 7 |  |  |  |  |
| 8 |  |  |  |  |
| 9 |  |  |  |  |
| 10 |  |  |  |  |

**通过门槛**：10 条中至少 8 条被人工判定为可接受。

## 明确不验

- 不验整文件批量标点。
- 不验本地 LLM。
- 不验协作项目路径。
- 不验 MCP 调用。

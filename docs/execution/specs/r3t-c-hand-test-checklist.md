# R3t-C — LLM 自动标点（邻段上下文）手测清单

> **前置**：R3t-B ✅；R2 `postprocess_auto_punctuate` ✅；LLM 配置 + 探测可用  
> **自动化**：`bash scripts/r3t-c-hand-test.sh`  
> **关联**：[`recording-transcribe-llm-refine-acceptance.md`](./recording-transcribe-llm-refine-acceptance.md) §R3t-C

## 0. 环境

| 项 | 要求 |
|----|------|
| LLM | 设置 → LLM 配置：DeepSeek（或兼容 OpenAI API）已保存 Key + 探测/自动标点成功 |
| 项目 | 打开含 **≥3 条语段** 的文件，选中中间一条触发自动标点 |

```bash
bash scripts/r3t-c-hand-test.sh
```

---

## 1. 邻段上下文契约

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 自动化 | `autoPunctuateNeighbors.test.ts`：prev/next 收集 + 摘要文案 |
| 2 | 自动化 | `useAutoPunctuateController.test.ts`：请求含 `neighbor_context` |
| 3 | 自动化 | Rust `build_auto_punctuate_prompt` 含「上一语段/下一语段」 |

- [x] 场景 1 — vitest + `cargo test postprocess_cmd`（2026-05-30）

---

## 2. UI 预览与写回

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 选中中间语段 → **自动标点** | 对话框显示 **「含邻段上下文（上一语段、下一语段）」**（有邻段时） |
| 2 | 预览 diff → **确认写回** | 语段正文更新；取消则不变 |
| 3 | 自动化 | `AutoPunctuatePreviewDialog` + controller 单测 |

- [x] 场景 2 UI — 本会话手测：DeepSeek 自动标点成功（~1.6–2.2s）  
- [x] 场景 2 自动化 — controller + neighbors vitest

---

## 3. 隐私与取消

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 首次使用 | 隐私明示对话框；接受后才发请求 |
| 2 | 预览阶段取消 | 不改语段；in-flight 可取消 |
| 3 | 自动化 | `useAutoPunctuateController.test.ts` consent + cancel |

- [x] 场景 3 自动化 — vitest（4 cases）  
- [x] 场景 3 UI — 与 R2 一致（沿用 `AutoPunctuatePreviewDialog`）

---

## 4. LLM 运行时

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | `desktop.log` | `postprocess_auto_punctuate` → `postprocess_auto_punctuate_done` |
| 2 | 设置页 | 探测连接成功或「连接已验证」（指纹/探测） |
| 3 | 契约 | `postprocessRuntimeContract` keychain + `resolveLlmConnectionUiStatus` |

- [x] 场景 4 — 日志复验 + 本会话 LLM 探测/标点手测（2026-05-30）

---

## 签收

| 项 | 日期 | 执行人 | 备注 |
|----|------|--------|------|
| TS + Rust 自动化 | 2026-05-30 | Agent | `r3t-c-hand-test.sh` **16+17 tests PASS** |
| 邻段上下文 | 2026-05-30 | Agent | neighbors + prompt 单测 |
| UI 预览写回 | 2026-05-30 | 用户+Agent | DeepSeek 自动标点 + 探测 ✅ |
| 隐私/取消 | 2026-05-30 | Agent | controller 单测 |
| **R3t-C 签收** | **2026-05-30** | **✅** | R9 Mid 硬门禁之一；§10 切 **R3t-D** |

**3 行日志模板**：

```text
改动：R3t-C 邻段上下文自动标点签收（R2 扩展 + LLM 运行时）
验证：bash scripts/r3t-c-hand-test.sh；desktop.log postprocess_auto_punctuate_done
下一轮：R3t-D 段界 ops（R3e-B ✅ 2026-05-30）
```

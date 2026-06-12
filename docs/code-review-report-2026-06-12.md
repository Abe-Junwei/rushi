# Rushi 端到端深度审查报告

> **后续**：问题合并与修复排期见 [`docs/execution/specs/code-review-2026-06-remediation-plan.md`](./execution/specs/code-review-2026-06-remediation-plan.md) · 全计划 v2 [`code-review-report-2026-06-v2.md`](./code-review-report-2026-06-v2.md)

**审查时间**：2026-06-12  
**审查范围**：Rushi 全项目（Tauri + React + SQLite + Python ASR 侧车）  
**审查目标**：动静结合，验证功能、架构、安全、性能与可维护性基线，识别并修复可立即消除的问题。

---

## 1. 执行摘要

项目整体健康状况良好：

- TypeScript / Rust / Python 三层核心测试全部通过。
- ASR 侧车已在本地启动并加载 Paraformer 长音频模型，真实转写链路可用。
- Playwright ASR E2E 通过；桌面 UI E2E 原有一个选择器歧义失败，已修复。
- `npm audit` 发现的 1 个 moderate 漏洞（`ws`）已通过 `npm audit fix` 消除。

剩余问题主要是**可控的架构债务**：组件/Hook 文件偏大、部分 Rust 同步 HTTP 调用、少量 lint warning。这些不影响当前发布，但应纳入后续技术债计划逐步治理。

---

## 2. 基线验证结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| TypeScript 类型检查 | `npm run typecheck` | ✅ 通过 |
| ESLint | `npm run lint` | ⚠️ 通过，50 warnings（无 error） |
| 前端单元测试 | `npm run test` | ✅ 268 files / 1306 tests 通过 |
| Rust 单元测试 | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | ✅ 360 tests 通过 |
| Clippy | `cargo clippy ... -D warnings` | ✅ 通过 |
| ASR Python 测试 | `npm run asr:test` | ✅ 117 passed, 2 skipped |
| 架构守卫 | `node scripts/check-architecture-guard.mjs` | ⚠️ 0 errors / 47 warnings |
| 安全审计（修复前） | `npm audit` | ⚠️ 1 moderate（`ws` GHSA-58qx-3vcg-4xpx） |
| 安全审计（修复后） | `npm audit` | ✅ 0 vulnerabilities |

---

## 3. 动态功能验证

### 3.1 ASR 侧车健康

```bash
curl -sf http://127.0.0.1:8741/health
```

返回：

- `status: ok`
- `ready_for_transcribe: true`
- 已加载模型：`iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch`
- `local_token_required: false`

### 3.2 真实转写链路

使用 fixture 中的 `fixtures/eval/samples/clear.wav` 直接调用 `/v1/transcribe`：

```bash
curl -sf -F file=@fixtures/eval/samples/clear.wav http://127.0.0.1:8741/v1/transcribe
```

返回结构正常，转写服务可用（该文件时长仅 0.15s，无有效文本输出属于预期）。

### 3.3 E2E 测试

| 测试 | 结果 |
|------|------|
| `npm run desktop:test:e2e:asr` | ✅ 2 tests 通过 |
| `npm run desktop:test:e2e:desktop`（修复前） | ❌ `getByRole('button', { name: /新建项目/ })` strict mode violation |
| `npm run desktop:test:e2e:desktop`（修复后） | ✅ 1 test 通过 |

---

## 4. 已修复问题

### 4.1 Playwright 选择器歧义

**文件**：`apps/desktop/tests/e2e/desktop-lifecycle-smoke.spec.ts`

**问题**：欢迎页存在两个「新建项目」按钮（hero 主按钮 + onboarding checklist 按钮），`getByRole('button', { name: /新建项目/ })` 在 strict mode 下匹配到 2 个元素。

**修复**：改用明确的 `data-purpose="welcome-actions"` 定位 hero 主按钮。

```ts
await expect(
  page.locator('[data-purpose="welcome-actions"]'),
).toBeVisible();
```

### 4.2 `ws` 依赖安全漏洞

**漏洞**：`ws 8.0.0 - 8.20.0`，CVE GHSA-58qx-3vcg-4xpx（Uninitialized memory disclosure）。

**修复**：执行 `npm audit fix`，升级到 `ws@8.21.0`。

**验证**：`npm audit` 已无漏洞；`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 全部通过。

---

## 5. 架构债务（非阻塞）

架构守卫报告 47 个 warnings，均为文件大小 / Hook 数量 / 同步调用提示，无错误。

### 5.1 前端组件 / Hook 膨胀

| 文件 | 问题 |
|------|------|
| `apps/desktop/src/components/ProjectPanel.tsx` | 415 行，17 个 hook |
| `apps/desktop/src/components/WaveformTimeRuler.tsx` | 346 行，13 个 hook |
| `apps/desktop/src/hooks/useWaveformZoom.ts` | 13 个 hook |
| `apps/desktop/src/pages/useTranscribeJobController.ts` | 389 行，14 个 hook |
| `apps/desktop/src/pages/useTranscriptionLayer.ts` | 432 行 |
| `apps/desktop/src/utils/editorShortcutRegistry.ts` | 498 行 |
| `apps/desktop/src/utils/segmentListVirtualWindow.ts` | 438 行 |
| `apps/desktop/src/services/postprocess/postTranscribeStageB.ts` | 383 行 |

**建议**：

- 对 >300 行的组件/Hook 按「数据流 / 副作用 / UI 计算」拆分子 Hook。
- `ProjectPanel`、`useTranscribeJobController` 等核心控制器可优先拆分，避免 mega-hook。

### 5.2 Rust 同步 HTTP 调用

**文件**：

- `apps/desktop/src-tauri/src/asr_sidecar/probe.rs`
- `apps/desktop/src-tauri/src/asr_sidecar/warm.rs`

两者使用了 `reqwest::blocking`，可能在 Tauri 的线程池中阻塞。

**建议**：

- 评估是否可在异步上下文中统一使用 `reqwest` async client。
- 若必须同步（例如在命令入口同步调用），应使用 `spawn_blocking` 或最小化超时，避免长时间占用线程池。

### 5.3 Rust / Python 超大文件

| 文件 | 行数 | 建议 |
|------|------|------|
| `apps/desktop/src-tauri/src/project/online_segment_normalize.rs` | 811 行 | 拆分为多个模块文件 |
| `apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs` | 764 行 | 拆分为多个模块文件 |
| `services/asr/rushi_asr/model_prepare.py` | 487 行 | 拆分为 ≤300 行的子模块 |

---

## 6. Lint Warnings 清单

`npm run lint` 共 50 warnings，0 errors：

- **47 条** `react-hooks/exhaustive-deps`：多为缺失/多余依赖。虽然多数是“稳定引用”或“故意忽略”，但仍建议逐个确认，避免闭包过期。
- **2 条** `react-refresh/only-export-components`：`EnvLlmModeSwitch.tsx`、`ProjectStatusFeedback.tsx` 同时导出了非组件内容。
- **1 条** `no-console`：`pages/transcribeAsyncPoll.ts:18` 使用了 `console.info`（虽有 `import.meta.env.DEV` 保护，仍触发规则）。

**建议**：在下一轮技术债中统一处理 `exhaustive-deps`，将潜在的闭包过期问题显性化。

---

## 7. 安全与加固

### 7.1 已确认的安全实践

- **CSP 生产配置**：`script-src` / `style-src` 含 `'self'` 与 **`'unsafe-inline'`**（Vite/React 兼容；非 strict CSP）。`style-src-attr 'unsafe-inline'` 保留以兼容行内 style。
- **ASR 侧车绑定**：`127.0.0.1:8741`，仅本地回环。
- **本地 Token**：`generate_local_token()` 使用 UUID；写接口通过 `_require_local_token()` 保护；桌面端通过 `RUSHI_LOCAL_TOKEN` 或 managed token 注入。
- **CORS**：仅允许 `tauri://localhost`、`http://localhost`、`http://127.0.0.1`。
- **项目包导入校验**：`validate_bundle_archive()` 检查 `..`、绝对路径、解压总体积（500MB）和语段数（100k）。
- **密钥存储**：默认使用 AppData 内 `0600` 文件，可选 keyring。
- **SQLite**：`PRAGMA busy_timeout = 5000`、`PRAGMA foreign_keys = ON`。
- **Python 同步 IO**：异步端点中使用 `run_in_threadpool`，上传文件流式处理。

### 7.2 建议进一步评估

- **CSP `connect-src`** 包含 `http://127.0.0.1:8741`，这是 ASR 侧车所需，已最小化。
- **`style-src-attr 'unsafe-inline'`**：若未来能完全迁移到 Tailwind/className，可考虑移除以进一步收紧 CSP。

---

## 8. 性能观察

- **模型目录路径**：`rushi_models_root` 当前为 `.../studio.lingchuang.rushi/studio.lingchuang.rushi/models`，存在重复嵌套。这是历史兼容路径，不影响功能，但建议在产品化阶段统一为单层目录。
- **转写上传限制**：ASR 侧车 `_MAX_UPLOAD_BYTES = 512MB`，与项目包导入限制（500MB）量级一致。
- **波形 / 虚拟滚动**：`segmentListVirtualWindow.ts` 已做虚拟化，但文件较大，后续拆分有助于维护。

---

## 9. 推荐后续行动

按优先级排列：

1. **中优先级：治理 `react-hooks/exhaustive-deps` warning**  
   逐个确认依赖数组，消除闭包过期风险；同时处理 `react-refresh/only-export-components`。

2. **中优先级：拆分核心大文件**  
   优先处理 `ProjectPanel.tsx`、`useTranscribeJobController.ts`、`useTranscriptionLayer.ts`、`editorShortcutRegistry.ts`。

3. **低优先级：Rust 同步 HTTP 调用改造**  
   将 `probe.rs`、`warm.rs` 中的 `reqwest::blocking` 评估改为异步或 `spawn_blocking`。

4. **低优先级：超大 Rust/Python 文件拆分**  
   `online_segment_normalize.rs`、`run_transcribe_cmd.rs`、`model_prepare.py`。

5. **低优先级：清理模型目录路径**  
   统一 `rushi_models_root`，避免重复嵌套目录。

---

## 10. 变更记录

本次审查产生以下实际修改：

- `apps/desktop/tests/e2e/desktop-lifecycle-smoke.spec.ts`：修复 Playwright 选择器歧义。
- `package-lock.json`：通过 `npm audit fix` 升级 `ws@8.21.0`，消除 moderate 漏洞。

> 工作区中已有的未提交改动（如 `DeleteSegmentConfirmDialog.tsx`、`segmentContextMenuModel.ts/.test.ts`）不属于本次审查修改，未触碰。

---

## 11. 结论

Rushi 当前代码库处于一个**健康、可发布**的状态：

- 所有自动化闸门（typecheck / lint / test / cargo / pytest / architecture-guard）均通过。
- 动态验证确认 ASR 侧车可正常提供 `/health` 与 `/v1/transcribe` 服务。
- 两个可直接修复的问题（E2E 选择器、`ws` 漏洞）已就地解决并验证。

建议后续以“技术债薄片”方式逐步处理架构守卫警告与 lint warning，避免 debt 继续累积。

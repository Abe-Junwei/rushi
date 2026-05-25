# Spec: auto_punctuate

## 目标
在桌面编辑器中增加单语段「自动标点」动作：请求远程 OpenAI-compatible provider 生成候选正文，展示 diff 预览，并在用户确认后写回当前语段。

## 用户任务

1. 选中一条语段。
2. 点击「自动标点」。
3. 查看原文/候选文的差异预览与 provider/耗时信息。
4. 选择确认写回或取消。

## UI 落点

- 入口：`apps/desktop/src/components/editor/EditorSegmentToolbar.tsx`
  - 仅在存在选中语段、未 busy 时启用。
- 主体：新增 `AutoPunctuatePreviewDialog`
  - 展示原文、候选文、行内 diff、provider、耗时、隐私说明。
- 错误：沿用现有 `setError` 顶部错误条。

## 状态模型

- 空态：无选中语段，按钮禁用。
- 忙碌态：按钮 loading / disabled，请求进行中，可取消。
- 成功态：弹出预览对话框，用户可确认写回。
- 失败态：顶部错误条展示中文文案，原文不变。
- 恢复路径：取消预览或关闭对话框后回到编辑器；可再次触发。

## 受影响代码地图

1. `apps/desktop/src/components/editor/EditorSegmentToolbar.tsx` — 新增「自动标点」动作入口。
2. `apps/desktop/src/components/AutoPunctuatePreviewDialog.tsx` — 预览 diff 与确认/取消 UI。
3. `apps/desktop/src/pages/useAutoPunctuateController.ts` — 前端编排：读取选中语段、发起 invoke、管理取消与预览状态。
4. `apps/desktop/src/tauri/projectApi.ts` — request/response 类型与 invoke wrapper。
5. `apps/desktop/src/pages/useProjectController.ts` / `useProjectLifecycleController.ts` — 将动作接入编辑器 controller。
6. `apps/desktop/src-tauri/src/postprocess_cmd.rs` — Tauri 命令，负责配置、keychain、HTTP 调用与响应规范化。
7. `apps/desktop/src-tauri/src/utils/http.rs` — 抽出共享 reqwest client（完成 T-002，供转写与后处理共用）。
8. `apps/desktop/src-tauri/src/lib.rs` — 注册新命令。

## 拆分方案（如涉及重构）

1. `useAutoPunctuateController.ts` — 页面级单功能 controller；不把后处理状态继续塞回 `useProjectLifecycleController`。
2. `postprocess_cmd.rs` — 单命令 + 单 provider；不引入 `services/llm/` 或通用引擎层。
3. `utils/http.rs` — 仅承接共享 reqwest client；不顺手重构其它网络模块。

## 前后端契约

```ts
export interface PostprocessAutoPunctuateRequest {
  task: "auto_punctuate";
  segment_uid: string;
  text: string;
  neighbor_snippets?: string[];
}

export interface TextDiffSpan {
  start: number;
  end: number;
  kind: "insert" | "delete" | "replace";
}

export interface PostprocessAutoPunctuateResponse {
  text: string;
  diff: TextDiffSpan[];
  provider: string;
  latency_ms: number;
}
```

```rust
#[tauri::command]
async fn postprocess_auto_punctuate(
    req: PostprocessAutoPunctuateRequest
) -> Result<PostprocessAutoPunctuateResponse, String>
```

### 输入约束

- `text` 必须使用当前语段的最新可见正文；触发前先 `flushSegmentTextDrafts()`。
- `neighbor_snippets` 可选，首轮最多带前后各 1 条、每条截断到 80 个字符。
- 若正文为空或仅空白，前端直接禁止触发。

### 后端约束

- 仅允许 HTTPS `base_url`；本地开发例外需单独显式开关，不作为默认。
- 超时默认 30s。
- 响应必须回传 provider 名称与耗时。
- diff 在 Rust 或前端均可生成，但返回体格式固定为 `TextDiffSpan[]`。

## 最小实现范围

- 单 provider（OpenAI-compatible）。
- 单动作入口（编辑器语段工具栏）。
- 单对话框预览。
- 单条语段写回。

## 约束

- 不改动 ASR 侧车目录、PyInstaller 依赖或模型下载链路。
- 不把密钥明文写入 repo、localStorage 或普通 JSON。
- 不新增批量处理、后台队列或历史记录。
- 新增 TS 文件保持 ≤300 行；`.rs` 文件若接近 500 行需继续拆。
- 实施时保持现有测试与架构守卫通过。

## 实施步骤

1. 新增 `projectApi.ts` wrapper 与 request/response 类型。
2. 新增 `useAutoPunctuateController.ts`，负责：
   - 读取选中语段
   - flush drafts
   - 发起 invoke
   - 使用 `AbortController` / 取消标记管理对话框关闭
3. 新增 `AutoPunctuatePreviewDialog.tsx`。
4. 在 `EditorSegmentToolbar.tsx` 增加入口按钮。
5. Rust 新增 `postprocess_auto_punctuate` 命令：
   - 读 provider/base_url/model/api_key_id
   - keychain 解析 secret
   - 发 HTTPS 请求
   - 规范化 provider 响应为 `text + diff + latency`
6. 将共享 reqwest client 从 `project/types.rs` 迁到 `utils/http.rs`。
7. 补测试与验收清单。

## 验收标准

- [ ] `docs/execution/specs/auto-punctuate-intent.md`、`plan.md`、`acceptance.md` 与架构短文齐全。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run test` 通过。
- [ ] `npm run lint` 无 error。
- [ ] `node scripts/check-architecture-guard.mjs` 无新增 error / warning。
- [ ] 新增代码路径有 focused tests。
- [ ] 至少 1 条端到端手测：请求 → 预览 → 确认写回。

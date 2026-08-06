# 导出 LLM 保真整理与讲稿优化：Plan

> **Research**：[`export-llm-fidelity-and-lecture-optimize-research.md`](./export-llm-fidelity-and-lecture-optimize-research.md)  
> **Intent**：[`export-llm-fidelity-and-lecture-optimize-intent.md`](./export-llm-fidelity-and-lecture-optimize-intent.md)  
> **Acceptance**：[`export-llm-fidelity-and-lecture-optimize-acceptance.md`](./export-llm-fidelity-and-lecture-optimize-acceptance.md)  
> **状态**：待用户确认，未进入编码

## 1. 数据契约

新增独立语义，不在 `export_polish` 上增加“放宽模式”：

```ts
type DocxExportMode = "verbatim" | "fidelity" | "lecture_optimize";

type ExportLectureOptimizeItem = {
  id: number;
  text: string; // 必须非空，一个输入 ID 对应一个输出
};
```

- 请求：`items: [{id,text}]` + 词表/稳定规则上下文。
- 返回：完整 ID 集合 + `break_after_line`。
- 校验：缺失、重复、越界、错类型、空文本使该批回退输入。
- 优化不允许 merge/reorder，以保持语段与导出注释对齐。

## 2. 实施步骤

### Step 1：产品命名与处理模式

- `DeliveryExportDialog` 一级模式收敛为：逐字稿、LLM 保真整理、讲稿优化。
- 移除普通“讲稿/按当前语段”选项，不再增加第二层内容处理段控。
- 现有 `clean` 语义迁移为 `fidelity`；现有无 LLM `lecture` 不再从 UI 触发；新增 `lecture_optimize`。
- 繁忙文案区分“保真整理”和“生成讲稿优化建议”。

### Step 2：Rust 独立优化命令

- 新增 `postprocess_export_lecture_optimize*.rs`，包含批计划、Prompt、解析、契约校验、取消/进度。
- 复用现有 LLM runtime/HTTP 边界，不复制密钥与 Provider 适配。
- 保真 `postprocess_export_polish` 协议与测试保持不变。

### Step 3：导出专用预览

- 新建 `useDeliveryLectureOptimizeController.ts`，状态为 `closed | loading | preview | empty`，避免扩大 `useExportController.ts` 热点。
- 新建紧凑预览 dialog，复用 `FloatingPanelSegmentRow`、`CorrectionRulesChangeText`、`resolveTextChangeRowDisplay`。
- 默认勾选全部建议；用户可逐语段取消；点击“确认并导出”才打开保存流程。
- 取消、关闭或 LLM 失败时不导出、不写库。

### Step 4：DOCX 完整修订轨

- DOCX 参数增加 `polishTrackMode: "fidelity" | "lecture_optimize"`。
- `fidelity` 继续使用现有小改过滤。
- `lecture_optimize` 使用完整字符 diff，大段删除/插入也写入 `w:del/w:ins`。
- 两个模式均校验：接受修订视图 = 用户确认的导出行。
- 讲稿优化额外校验：拒绝全部修订视图 = 导出前原语段。不等则降级为原文讲稿，不交付不可逆改稿。

### Step 5：审计与文案

- edit log 区分 `export_llm_fidelity` / `export_llm_lecture_optimize`，只记摘要和计数，不写回语段。
- LLM 设置页、状态文案、忙态覆盖中的“润色”改为准确的能力名。

## 3. 预计落位

| 类型 | 文件 |
|---|---|
| 修改 | `DeliveryExportDialog.tsx`、`ProjectPanelDialogs.tsx`、`ProjectPanel.tsx`、`exportDeliveryPlan.ts`、`exportDocxApi.ts`、`export_docx_build.rs`、`export_docx_polish_track_*.rs` |
| 新增 | `exportLectureOptimize.ts`、`exportLectureOptimizePipeline.ts`、`useDeliveryLectureOptimizeController.ts`、`DeliveryLectureOptimizeDialog.tsx`、`postprocess_export_lecture_optimize*.rs` |
| 测试 | 同名 TS/Rust 测试；DOCX 双视图提取测试；导出 UI 状态矩阵测试 |

## 4. 验证顺序

1. `npm run typecheck`
2. 导出模式 / 预览 / 计划定向 Vitest
3. Rust 协议、分批、DOCX 双视图定向测试
4. `npm run test`
5. `cargo test` + `cargo clippy --all-targets --all-features -- -D warnings`
6. `node scripts/check-architecture-guard.mjs`
7. 真实长文稿手测：保真整理 100% 正文覆盖；讲稿优化预览取消/部分采纳/全采纳；Word 全接受/全拒绝

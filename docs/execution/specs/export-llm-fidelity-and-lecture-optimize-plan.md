# 导出 LLM 保真整理与讲稿优化：Plan

> **Research**：[`export-llm-fidelity-and-lecture-optimize-research.md`](./export-llm-fidelity-and-lecture-optimize-research.md)  
> **Intent**：[`export-llm-fidelity-and-lecture-optimize-intent.md`](./export-llm-fidelity-and-lecture-optimize-intent.md)  
> **Acceptance**：[`export-llm-fidelity-and-lecture-optimize-acceptance.md`](./export-llm-fidelity-and-lecture-optimize-acceptance.md)  
> **状态**：已实施并通过自动化验收；真实长稿 Word 回归待执行

## 1. 数据契约

新增独立语义，不在 `export_polish` 上增加“放宽模式”：

```ts
// 内部值为兼容既有版式保持不变；UI 名称分别为逐字稿、讲稿优化、LLM 保真整理。
type DocxExportMode = "verbatim" | "lecture" | "clean";

type ExportLectureOptimizeInput = {
  uid: string; // 导出快照内全局稳定且唯一
  text: string;
};

type ExportLectureOptimizeResponse = {
  edits: Array<{ uid: string; text: string }>;
  break_after_uid: string[];
};
```

- 请求：`items: [{uid,text}]` + 词表/稳定规则上下文；仍可分批，但 uid 不随批次重编号。
- 返回：只包含明确修改的稀疏 `edits` + 独立的 `break_after_uid`；两者都允许为空。
- 校验：未返回 uid = 原文不变；未知/重复/错类型/空文本只丢弃对应 edit，不连坐同批。
- 兼容：旧完整 `items: [{id,text}]` 在迁移期可解析为 edits，但不得成为新 Prompt 或新测试的主契约。
- 优化不允许 merge/reorder，以保持语段与导出注释对齐。

## 2. 实施步骤

### Step 1：产品命名与处理模式

- `DeliveryExportDialog` 一级模式收敛为：逐字稿、LLM 保真整理、讲稿优化。
- 移除普通“讲稿/按当前语段”选项，不再增加第二层内容处理段控。
- 内部值保持兼容：`clean` 对应保真整理，`lecture` 对应讲稿优化；两者均由模式强制执行对应 LLM 任务。
- 繁忙文案区分“保真整理”和“生成讲稿优化修订稿”。

### Step 2：Rust 独立优化命令

- `export_lecture_optimize` 使用稳定 uid 稀疏 Prompt/解析；复用批计划、取消/进度、HTTP/runtime 边界。
- 解析器先以客户端原文构造完整目标行，再逐条应用合法 edit；模型无权创建、删除、合并或换序语段。
- 保真 `postprocess_export_polish` 协议与测试保持不变。

### Step 3：直接导出编排

- 用户选择“讲稿优化”后直接执行 LLM、选择保存位置并生成 Word 修订稿，不增加 Rushi 内预览状态机。
- 缺席 uid 合法且保持原文；坏 edit 只丢弃该条。只有整个响应不可解析时才按既有拆批/重试策略处理。
- omission 不触发重试；可识别 uid 的格式坏 edit 可定点重试，未知 uid 直接丢弃并诊断。
- 取消或 LLM 失败时不产生部分 DOCX、不写库。

### Step 4：DOCX 完整修订轨

- Rust 写入层按内部导出模式选择 `PolishTrackMode::Fidelity` / `LectureOptimize`，不扩大前端 IPC 参数。
- `fidelity` 继续使用现有小改过滤。
- `lecture_optimize` 使用完整字符 diff，大段删除/插入也写入 `w:del/w:ins`。
- 两个模式均校验：接受修订视图 = 目标导出行。
- 讲稿优化额外校验：拒绝任一修订可恢复该处原文，拒绝全部修订视图 = 导出前原语段。不等则降级为原文讲稿，不交付不可逆改稿。
- 双视图以 UTF-8 SHA-256 比较并记录摘要；输入 uid 去向覆盖率必须为 100%。

### Step 5：审计与文案

- edit log 区分 `export_llm_fidelity` / `export_llm_lecture_optimize`，只记摘要和计数，不写回语段。
- 诊断区分 omission、unknown uid、duplicate uid、empty text、malformed edit、legacy response 与 parse failure。
- Word 修订作者使用本次实际模型名，修订时间统一写 UTC `Z`。
- LLM 设置页、状态文案、忙态覆盖中的“润色”改为准确的能力名。

## 3. 预计落位

| 类型 | 文件 |
|---|---|
| 修改 | `DeliveryExportDialog.tsx`、`exportDeliveryPlan.ts`、`useExportController.ts`、`exportDocxApi.ts`、`export_docx_build.rs`、`export_docx_polish_track_*.rs` |
| 实际新增语义 | `fetchExportLectureOptimizeResult`、`export_lecture_optimize` task、`PolishTrackMode::LectureOptimize` |
| 测试 | 同名 TS/Rust 测试；DOCX 双视图提取测试；导出 UI 状态矩阵测试 |

## 4. 验证顺序

1. `npm run typecheck`
2. 导出模式 / 预览 / 计划定向 Vitest
3. Rust 协议、分批、DOCX 双视图定向测试
4. `npm run test`
5. `cargo test` + `cargo clippy --all-targets --all-features -- -D warnings`
6. `node scripts/check-architecture-guard.mjs`
7. 真实长文稿手测：保真整理 100% 正文覆盖；讲稿优化直接导出；Word 逐条接受/拒绝、全接受/全拒绝

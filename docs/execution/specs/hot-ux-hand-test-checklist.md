# HOT-UX 手测清单 — 术语页「本次转写将携带」

> **验收真源**：[`hot-ux-acceptance.md`](./hot-ux-acceptance.md)  
> **实现**：`GlossaryHotwordsSummarySection.tsx`、`glossary_hotwords.rs`、`glossaryHotwords.ts`  
> **机器闸门**：`npm run test` 含 `glossaryHotwords.test.ts`；`cargo test glossary_hotwords`

## UI 落位（2026-06-11 自检）

| 元素 | 页面 / 组件 | 说明 |
|------|-------------|------|
| 页标题 | **热词与记忆**（`GlossaryPage`） | 非「术语管理」 |
| 摘要区块标题 | **本次转写将携带**（`GlossaryHotwordsSummarySection` h2） | 页顶第一个带边框 callout 区 |
| 摘要主行 | `g.hotwordsSummary` | 加载中：`正在加载热词摘要…`；有热词：`自动转录时将提交 … 个热词（… 条已纳入词条）…` |
| 统计行 | 同区块第二段 meta | `共 N 条词条，M 条已勾选「纳入下次转写（热词）」；共 K 个不重复热词。` |
| 预览框 | 同区块 `<pre>`（灰底 mono） | 仅当 preview 非空；显示空格分隔热词串（如 `制控`） |
| 截断提示 | 同区块 saffron 色 meta | 仅当 `truncated=true` |
| 热词勾选 | 术语表「热词」列 / 编辑器「纳入下次转写（热词）」 | 勾选后应触发 `glossary_hotwords_preview` 刷新 |

> **与转写对话框区分**：编辑器拉取前的浮动框标题为 **「本次术语偏置」**（`AutoTranscribeStartDialog`），不是「本次转写将携带」。

## §1 — 有热词（主路径）

**设置**

1. 打开 **热词与记忆**。
2. 新增词条「制控」（或任意专名），勾选 **纳入下次转写（热词）** 并保存。

**期望**

- [ ] 区块标题为 **本次转写将携带**（勿与页眉「转写词汇表（Custom Vocabulary）」混淆）。
- [ ] 摘要主行含 **自动转录时将提交 … 个热词**、**已纳入词条** 数（别名另计热词数）。
- [ ] 统计行 `M ≥ 1` 且 **共 K 个不重复热词** 中 `K ≥ 1`。
- [ ] 预览框显示 `制控`（或对应正形）。
- [ ] 取消勾选热词 → 摘要变为 **无词条纳入热词** / **不会携带术语表** 类文案；预览框消失。

## §2 — 全部移出热词（可选）

1. 批量 **移出热词** 或筛选「仅已纳入热词」后清空。

**期望**

- [ ] 摘要主行：`当前无词条纳入热词（0 个 token）…` 或 `当前无热词 token 纳入转写…`。
- [ ] 统计行仍显示总词条数；**不**再出现「将提交 … 个唯一热词 token」后缀。

## §3 — 跨词条 alias 去重（可选）

1. 词条 A：主术语 `三乘`；词条 B：主术语 `主任`、别名 `三乘`；均纳入热词。

**期望**

- [ ] **2 条已纳入词条**，但 **唯一热词 token = 2**（`三乘` 不重复计数）。
- [ ] 预览框为 `主任 三乘` 或 `三乘 主任`（按 `updated_at_ms` 排序，Rust 单测为准）。

## §4 — VOC-GUARD 过滤（可选）

1. 纠错记忆存在 `智控 → 制控`；术语表 `制控` 别名含 `智控`，均纳入热词。

**期望**

- [ ] 预览框 **仅** `制控`（错形 `智控` 不进 hotwords）。

## 自动化（签收前）

```bash
cd apps/desktop && npx vitest run src/services/glossaryHotwords.test.ts
cd apps/desktop/src-tauri && cargo test glossary_hotwords --quiet
```

## 签收

| 日期 | §1 | §2–§4 | 备注 |
|------|-----|-------|------|
| | ⏳ | 可选 | 2026-06-11：恢复 h2「本次转写将携带」+ 加载态文案 |

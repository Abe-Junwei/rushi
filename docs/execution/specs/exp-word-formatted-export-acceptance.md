# Acceptance: EXP-WORD — 定稿 Word 格式化导出（L6）

> **状态**：📋 未编码  
> **排期**：路线图 §4.1.1 **⑤‴**（R3t-E 之后、R4 之前）  
> **Backlog**：[`word-formatted-export-backlog.md`](./word-formatted-export-backlog.md)  
> **基线**：P3 [`p3-acceptance.md`](../p3-acceptance.md) 已有最小 DOCX — **本 Epic 为交付版式收口**

## 目标

用户完成 **ASR +（可选）LLM + 人工校对** 后，导出 Word：**版式稳定**、与编辑器语段一致，可选 **修订摘要附录**；**不等**协作 C6。

## 范围

### 做（v1）

| # | 形态 | 说明 |
|---|------|------|
| 1 | **逐字稿** | 时间码 + 正文；样式用 token/命名样式，禁止 arbitrary hex |
| 2 | **讲稿** | 连写正文；段落与编辑器分段策略一致 |
| 3 | **干净稿** | 无时间码、无低置信标记 |
| 4 | 可选 | **修订摘要附录**（来自 `edit_log` / 导出前 diff，若 REV-LOC 未做可仅附录） |
| 5 | 导出真源 | SQLite `segments` 当前定稿 + 项目元数据 |

### 不做（v1）

- OpenXML Track Changes 往返编辑
- 协作批注真源（C6）
- CAT 双语排版

## 验收标准

- [ ] 三种形态各导出 1 份，Word 打开无乱码、段落与编辑器一致（抽检 3 段）
- [ ] 低置信标记策略与 P3 一致或文档化差异
- [ ] 重启应用后再次导出，与 DB 一致
- [ ] Rust 或 TS 层 focused test：至少 1 个 fixture 文档结构断言
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 手测场景

1. 仅 ASR + 手改 → 干净稿  
2. R3t-E 写回后 → 逐字稿 + 可选修订附录  

## 依赖

- **R3t-B** 语段落库稳定  
- **建议** R3t-E 签收后编码（词表校对写回与导出脚注一致）  
- **不依赖** R6–R8

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| Rust | `export_docx.rs` 扩展或 `export_docx_delivery.rs` |
| TS | 导出菜单 / 格式选择 UI |

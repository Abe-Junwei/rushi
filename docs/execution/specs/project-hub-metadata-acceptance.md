# Acceptance: Phase 10 — 项目 Hub 导航 + 项目管理与场次元信息

> **Research**：[`project-hub-metadata-research.md`](./project-hub-metadata-research.md)  
> **Plan**：[`project-hub-metadata-plan.md`](./project-hub-metadata-plan.md)  
> **Architecture**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md)  
> **状态**：Phase 10 签收完成 ✅（机器闸门 + 手测 2026-06-08）

---

## 总闸门

- [x] `npm run typecheck` — pass
- [x] `npm run test` — **1099 passed**（含 `projectDuplicateName`、`exportDeliveryAppendix`、`projectRecordedAt`、`projectApi`）
- [x] `node scripts/check-architecture-guard.mjs` — **0 错误**
- [x] `cargo test project_metadata --lib` — **4 passed**

---

## 自动验收

| 区域 | 测试 |
|------|------|
| 重名软提示 | `projectDuplicateName.test.ts` |
| DOCX 导出头 | `exportDeliveryAppendix.test.ts` |
| 时间 IPC | `projectApi.test.ts` — `recordedAt` camelCase |
| 时间输入 | `projectRecordedAt.test.ts` |
| Hub 副标题 | `projectFileDisplay.test.ts` |
| Rust rename / metadata | `project_metadata_cmd.rs` |
| Rust DOCX 多行 meta | `export_docx.rs` |

---

## 能力—UI 状态矩阵

| UI / 动作 | 条件 | 预期 |
|-----------|------|------|
| 面包屑项目名 | 编辑中 | `closeFile` → 文件 Hub（经 Close Gate） |
| `⌘⇧E` | 编辑中、非 busy | 同上 |
| Hub 主标题副行 | 已填时间/主题/讲述人 | `时间 · 主题 · 讲述人`（有值才显示） |
| Hub「项目信息」 | Hub header | `ProjectMetadataDialog`；保存 → `refreshProjectHub` |
| Hub 删项目 | header / Welcome 侧栏 | `DeleteProjectConfirmDialog` |
| 创建项目 | 同名已存在 | 黄色提示 + 建议 `name (2)` |
| 创建后 | 成功 | 可选填元信息 |
| 时间字段 | 项目信息 | 年月 / 日期 / 描述三态；`recordedAt` 持久化 |
| 交付导出 Word | 勾选「附带项目场次信息」 | Word 抬头预览 + 写入已填字段 |
| 快捷 DOCX 菜单 | 未勾选交付对话框 | 仅导出行，不含场次字段 |

**显式 waive（产品拍板）**

- 顶栏独立「文件」按钮：不实施；面包屑 + `⌘⇧E` 已满足 ≥2 路径
- Hub header 内联重命名：不实施；项目名在「项目信息」对话框修改

---

## 手测清单

> 手测签收：2026-06-08 ✅

### 10-A 导航

- [x] 面包屑项目名 → Hub（含 Close Gate）
- [x] `⌘⇧E` → Hub

### 10-B 项目 CRUD

- [x] Hub 删项目 / Welcome 侧栏删 → 同一 modal
- [x] 新建同名项目 → 黄色提示 → 仍可创建
- [x] Hub header：项目信息 + 删除两图标常显

### 10-C 元信息

- [x] 项目信息保存 5 字段 + 项目名 → 重开仍在
- [x] Hub 标题下副行显示时间 · 主题 · 讲述人
- [x] 时间年月/日期/描述可保存（`recordedAt` 修复）

### 10-D 导出

- [x] 交付导出 Word：可选附带场次信息 + 预览面板
- [x] 勾选后 Word 抬头含已填字段

---

## 非目标（本薄片不做）

- 采访人 / 摘要 / 项目级语言
- OHMS / Omeka 同步
- `UNIQUE(name)` 硬约束
- 完整 Dublin Core XML
- P1 扩展列（keywords、rights_note 等）

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-08 | 初版 acceptance |
| 2026-06-08 | 签收：recordedAt IPC、时间三态输入、Hub 副行、交付导出可选元信息、对话框尺寸 |

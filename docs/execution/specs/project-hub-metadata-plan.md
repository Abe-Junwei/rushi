# Plan：Phase 10 — 项目 Hub 导航 + 项目管理与场次元信息

> **Research**：[`project-hub-metadata-research.md`](./project-hub-metadata-research.md)  
> **Intent**：[`project-hub-metadata-intent.md`](./project-hub-metadata-intent.md)  
> **Acceptance**：[`project-hub-metadata-acceptance.md`](./project-hub-metadata-acceptance.md)

## 落位

| 薄片 | 内容 | 主要文件 |
|------|------|----------|
| 10-A | 编辑 → Hub：「文件」按钮、面包屑、`⌘⇧E` | `EditorToolbar.tsx`、`EditorWorkspaceNav.tsx`、`EditorView.tsx` |
| 10-B | `rename_project`、Hub/Welcome 删项目、重名软提示 | `project_metadata_cmd.rs`、`useProjectMutationController.ts`、`ProjectFilesHubPanel.tsx`、`CreateProjectModal.tsx`、`DeleteProjectConfirmDialog.tsx`、`projectDuplicateName.ts` |
| 10-C | DB 5 列、`update_project_metadata`、Hub「项目信息」 | `db.rs`、`ProjectMetadataDialog.tsx`、`projectApi.ts`、`ProjectPanelDialogs.tsx` |
| 10-D | acceptance、lifecycle 文档、DOCX 抬头读 metadata（交付导出可选） | `exportDeliveryAppendix.ts`、`DeliveryExportDialog.tsx`、`projectRecordedAt.ts` |

## 编码顺序

A → B → C → D（B/C 已在 prior commits；本关单补 A 按钮 + D 导出/文档）。

## 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test -p rushi-desktop rename_project update_project_metadata build_docx_bytes --lib
```

定向：

- `projectDuplicateName.test.ts`
- `exportDeliveryAppendix.test.ts`
- `project_metadata_cmd.rs`（rename + metadata round-trip）
- `export_docx.rs`（multiline metadata paragraph）

## 文档

- [`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) — 项目级 CRUD / Hub 导航矩阵

# Intent：语段标注（右键 · 弹窗 · 行尾图标）

> **Research**：[`segment-annotation-research.md`](./segment-annotation-research.md)  
> **Plan**：[`segment-annotation-plan.md`](./segment-annotation-plan.md)  
> **Acceptance**：[`segment-annotation-acceptance.md`](./segment-annotation-acceptance.md)

## 目标

转录员在 **单条语段** 上添加 **与正文分离** 的自由文本标注（背景、存疑、待核对项等），通过 **右键菜单** 打开弹窗编辑；有标注的语段在列表 **右侧** 显示 **FileText 小图标**，hover 可预览，点击可再次编辑。标注随文件 **本地持久化**，与定稿阶段徽标 **正交** 展示。

## 非目标（v1）

- 选区内字符范围标注、多条标注线程、@mention、协作审阅模式
- 标注自动写入术语表 / 更正记忆
- DOCX / 交付包导出附录（Phase B）
- 工具栏「仅有标注」筛选、底栏计数
- 复用或写入 `SegmentDto.detail`（ASR 专用）

## 成功标准

1. 右键「添加标注…」/「编辑标注…」→ 弹窗保存后，重开文件仍可见  
2. 非空标注语段行尾 **FileText** 图标 + tooltip 首行预览  
3. 合并 / 拆分 / 撤销 / 重转写行为符合 Plan 边界矩阵  
4. `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过  

详见 acceptance 手测清单与自动化项。

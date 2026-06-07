# Acceptance：语段标注

> **Research**：[`segment-annotation-research.md`](./segment-annotation-research.md)  
> **Plan**：[`segment-annotation-plan.md`](./segment-annotation-plan.md)

## 能力—UI 状态矩阵

| 能力 | UI 表面 | 无标注 | 有标注 | `busy` |
|------|---------|--------|--------|--------|
| 查看 marker | 行尾 `FileText` | 不渲染 | 渲染；`title` 为首行预览（≤80 字） | 渲染；按钮 disabled |
| 添加 | 右键「添加标注…」 | 可用 | — | disabled |
| 编辑 | 右键「编辑标注…」/ 点 icon | — | 可用；弹窗预填 | disabled |
| 清除 | 弹窗「清除标注」 | 隐藏或 disabled | 可用；保存后 icon 消失 | disabled |
| 保存 | 弹窗「保存」 | 写入 `annotation` | 覆盖正文 | disabled |
| 定稿 stage | `SegmentRowStageBadge` | 与标注独立 | 同行并列 | — |
| 持久化 | 自动保存 | — | 重开文件仍在 | — |

## 手测清单

### 基础

1. [ ] 打开有语段的文件 → 某段正文区右键 →「添加标注…」→ 输入多行文字 → 保存 → 行尾出现 **FileText** 图标  
2. [ ] hover 图标 → tooltip 显示标注首行；点击图标 → 弹窗预填，可修改保存  
3. [ ] 无标注段右键显示「添加标注…」；有标注段显示「编辑标注…」  
4. [ ] 弹窗「清除标注」→ 保存后 icon 消失，重开文件仍为空  

### 生命周期

5. [ ] 两段分别加标注 →「与下一条合并」→ 合并结果为 `\n\n---\n\n` 拼接（或仅一侧时保留该侧）  
6. [ ] 有标注段在指针时间拆分 → **左段保留**标注，**右段无** icon  
7. [ ] 改标注后 **⌘Z 撤销**（或编辑历史恢复）→ 标注回到上一版  
8. [ ] 关闭文件再打开 → 标注与 icon 仍在  

### 边界

9. [ ] `busy`（转写中）→ 右键标注项 disabled，icon 不可点  
10. [ ] 仅修改标注、不改正文 → 定稿 stage **不变**（仍为原 badge）  
11. [ ] **重转写**后标注全部清空（若 UI 有确认框，文案提及标注将丢失）  
12. [ ] 窗口宽度较窄时，icon + 定稿 chip **不遮挡**正文（可扫读）  

## 自动化

- [ ] `segmentListHelpers.test.ts`：merge B5–B7、split B8、`segmentsEqualForPersist` 含 `annotation`  
- [ ] `segmentTextContextMenuModel.test.ts`：无标注 / 有标注菜单 label；waveform 无标注项  
- [ ] Rust：`migrate_segments_annotation` 旧库补列；save/load roundtrip 含非空 `annotation`  
- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 全绿  

## 签收

- [ ] 手测 1–12 通过  
- [ ] 自动化项通过  
- [ ] 无 `detail` 误写用户标注（code review）  

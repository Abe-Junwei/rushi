# Acceptance：语段编辑阶段

> **Research**：[`segment-edit-stage-indicator-research.md`](./segment-edit-stage-indicator-research.md)  
> **Plan**：[`segment-edit-stage-indicator-plan.md`](./segment-edit-stage-indicator-plan.md)

## 能力—UI 矩阵

| 能力 | UI |
|------|-----|
| `auto_transcribe` | Badge **自转** |
| `ai_revised` | Badge **AI改** |
| `manual_transcribe` | Badge **手转** |
| `finalized` + `confirm_edit` | Badge **定稿**；tooltip 已确认改词 |
| `finalized` + `mark_only` | Badge **定稿**；tooltip 已标记认可 |
| draft 未落库 | 琥珀圆点 |
| 非 finalized | ⌘Enter、右键「标记定稿」可用 |
| finalized | 两入口 disabled |

## 手测清单

1. [ ] 转写后全段 **自转**
2. [ ] 智能改稿写回 → 变更段 **AI改**
3. [ ] 手改后自动保存 → **手转**
4. [ ] AI改稿段零手改 → 右键定稿 → **定稿**（标记认可）
5. [ ] 自动转写段改一字 → ⌘Enter → **定稿** + 跳下一条
6. [ ] 定稿段再改字保存 → **手转**
7. [ ] 重转写 → 全段 **自转**
8. [ ] 窄窗 badge 可读

## 自动化

- [ ] `segmentTextStage.test.ts`
- [ ] `segmentFinalize.test.ts` / `segmentStagePersist.test.ts`
- [ ] Rust migrate + roundtrip save/load

# Acceptance：语段冻结（Freeze）

> **Research**：[segment-freeze-research.md](./segment-freeze-research.md)  
> **Intent**：[segment-freeze-intent.md](./segment-freeze-intent.md) · **Plan**：[segment-freeze-plan.md](./segment-freeze-plan.md)

## 能力—UI 矩阵

| 能力 | UI / 快捷键 | 期望 |
|------|-------------|------|
| 冻结/解冻 | 右键；`Mod-Shift-F` | toggle；持久化 |
| 斜纹视觉 | 文本行 + 波形色带 | 中性淡斜纹（仅正文区）；选中用 callout 底 + 左侧浅发丝线，**不用** saffron 高亮 |
| 全局通读跳过 | Space / 主钮 | 进入冻结窗 seek 到窗尾；相邻合并 |
| 语段试听 | 浮层 play/loop | 冻结段 **可播** |
| 正文锁 | CM | 冻结行不可打字/粘贴；不可进入编辑 caret |
| 结构锁 | 合并/拆分/删 | 涉及冻结 → 拒绝 + 提示；菜单直接隐藏不可用项 |
| 导出 | DOCX/SRT/文本 | **不含** 冻结语段 |
| 存档重开 | 打开文件 | `frozen` 仍在 |

## 手测脚本

1. 中部两段冻结 → 斜纹出现于列表与波形；选中后斜纹仍清晰  
2. 点击冻结行 → 仅选中，无编辑光标；打字无效  
3. Space 通读越过冻结 → 听感跳过；浮层仍可播冻结段  
4. 冻结行右键 → 仅见解冻/备注（有选区时含复制）；无灰色禁用项  
5. 合并含冻结段失败；解冻后可合并  
6. 导出 DOCX/SRT 无冻结正文；重开项目冻结仍在 

## 机器闸门

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

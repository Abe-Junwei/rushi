# Intent：全局播放 vs 语段播放（产品入口恢复）

> **Research**：[global-vs-segment-playback-ux-research.md](./global-vs-segment-playback-ux-research.md)  
> **Plan**：[global-vs-segment-playback-ux-plan.md](./global-vs-segment-playback-ux-plan.md)  
> **Acceptance**：[global-vs-segment-playback-ux-acceptance.md](./global-vs-segment-playback-ux-acceptance.md)  
> **状态**：编码完成（待手测）

## 意图

恢复听打主路径：**Space / 工作条主钮 = 从 playhead 全局续播**；语段 scoped 播放保留在波形浮层 play/loop。

## 用户价值

- 通读整轨无需先选语段
- 校对单句仍可用浮层段播 / loop
- 与 Descript / Otter / Trint 心智对齐

## 范围

| 薄片 | 交付 |
|------|------|
| **UX-1** | research / intent / plan / acceptance |
| **UX-2** | 工作条主钮 + `playback.toggle` → `togglePlay` |
| **UX-3** | 快捷键文案 + architecture / acceptance 对齐 |
| **UX-4** | 翻转相关单测 + typecheck / 定向 test |

## 不做

- 双义 Space（有选中=语段）
- 语段独立倍速
- 工作条第二圆钮（窄窗；浮层已够用）
- 新播放引擎 / 改 Transport Authority 架构

## 验证

见 acceptance。

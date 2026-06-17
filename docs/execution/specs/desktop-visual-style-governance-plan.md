# Plan：桌面端视觉样式治理（6 轮薄片）

> **调研**：本任务为样式/token 收敛，沿用既有 [`desktop-tailwind-v4.md`](../../architecture/desktop-tailwind-v4.md) 与 [`DESIGN.md`](../../../DESIGN.md)，无独立 research brief。  
> **架构真源**：[`desktop-visual-style-governance.md`](../../architecture/desktop-visual-style-governance.md)

---

## 目标

消除 env 页 spacing 漂移、按钮/输入 ad-hoc 类、状态条圆角不一致；建立 `controlStyles` + guard 可持续治理。

## 轮次

| 轮 | 主题 | 状态 |
|----|------|------|
| R1 | `controlStyles` 扩展 + guard + 治理文档 | ✅ |
| R2 | 分段 toggle + `CONTROL_BTN_ICON_GHOST` 收拢 | ✅ |
| R3 | 输入控件 → `CONTROL_TEXT_*` | ✅ |
| R4 | 按钮漂移 + dialog layout token | ✅ |
| R5 | `ENV_STATUS_*` 命名 + 清理 alias/shadow | ✅ |
| R6 | 全量验证 + README 索引 | 本 commit |

## 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

手测：环境页 LLM/ASR 表单 CTA 间距、状态条圆角、查找替换对话框、备注对话框。

## 不做什么

- 不重构 glossary 卡片 `GLOSSARY_CARD`（面板级，非控件 token）
- 不改 context menu / popover 浮层圆角（overlay 语义独立）
- 不删除 `LLM_STATUS_*` 别名（向后兼容，新代码用 `ENV_STATUS_*`）

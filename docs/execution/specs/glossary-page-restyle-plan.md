# 热词与记忆页 Notion Zen 对齐重构（glossary-page-restyle）

> 类型：纯 UI 层样式 / 信息架构对齐（不动 controller 数据流、不动 Tauri 接口）。
> 视觉真源：仓库根 `DESIGN.md`（Notion Zen） + `apps/desktop/src/config/controlStyles.ts` + `apps/desktop/src/config/typography.ts`。
> 不触发新功能调研门禁（无新数据流 / 新架构）；本文件为落位与验收真源。

## 问题（2026-06 截图评估）

1. **控件规格漂移**：页面按钮/输入大量 inline `min-h-[36px] rounded-lg`（36px/8px），真源为 `h-8 rounded-sm`（32px/4px）；同页 `GlossaryMineSection` 已用 `CONTROL_*`，两套并存。
2. **灰底卡堆叠**：摘要、词表包、两个编辑表单全是 `bg-notion-callout-bg` 大块灰卡，违背「白底为主、卡片白底+1px border、灰底只做 callout」。
3. **排版层级平**：页 h1 hardcode 18px，所有区块标题 12px `sectionTitle`，与 11px meta 无层级差；未跟进 `envPageTitle`/`envSectionTitle` 体系。
4. **信息结构**：术语列表（页面主体）沉到第二屏；新建表单、批量添加、词表包占首屏；说明文过载。
5. **表格**：行内常驻「移出热词」+「删除」按钮（与 Flame toggle 功能重复），违背 DESIGN.md Lists hover-reveal 规范；两张表风格分叉。

## 落位

| 改动 | 文件 |
|------|------|
| 控件变体补齐（icon-only 按钮、textarea、内联 select） | `src/config/controlStyles.ts` |
| 页面共享样式（表格/卡片/错误条/空态/行操作 reveal/复选框） | `src/components/glossary/glossaryPanelStyles.ts`（新） |
| 编辑器折叠开关 UI 态（termEditorOpen / memEditorOpen） | `src/pages/useGlossaryPageController.ts` |
| 页面排版 + 区块顺序 | `src/components/GlossaryPage.tsx` |
| 各 section 重排 | `src/components/glossary/*.tsx` |

折叠摘要复用 `envLocalAsr/envLocalAsrPanelUi.tsx` 的 `ENV_COLLAPSIBLE_DETAILS` + `EnvCollapsibleSectionSummary` / `EnvCollapsibleMetaSummary`（既有真源，不另造）。

## 结构决策

- 区块顺序：携带摘要（压缩 callout + 折叠详情）→ **转写词汇表**（工具栏 + 折叠编辑器 + 折叠批量添加 + 列表）→ 推荐加入术语表 → **纠错记忆**（工具栏 + 折叠编辑器 + 列表）→ 词表包（页尾折叠）。
- 「添加词条」「新建记忆」收进各自列表工具栏的 primary 按钮；点击表格行 = 打开编辑器并滚动到位。
- 唯一保留的灰底 callout：携带摘要（真 callout 语义）。编辑表单 = 白底卡 + 1px `notion-border`。
- 表格行操作 hover-reveal（`group-hover` + `group-focus-within` 保键盘可达）；删除二次确认态强制常显；去掉与 Flame toggle 重复的「移出热词」文字按钮。

## 不做

- 不动 `useGlossaryController` / `useCorrectionMemoryController` 等数据 hooks。
- 不改导出/导入对话框（已是 `compactDialog` 体系）。
- 不引入虚拟滚动、不新增颜色 token。

## 验收

- [x] `npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`（2026-06-12：typecheck 通过；lint 0 错误（46 条既有 warning）；1275/1275 测试通过；guard 仅既有 hotspot warning，无 glossary 文件）
- [x] `grep -rn "min-h-\[36px\]\|rounded-lg" src/components/glossary src/components/GlossaryPage.tsx` 无残留（rounded-lg 仅允许真源常量内出现）
- [ ] 手测：添加词条 → 勾热词 → 摘要刷新；行点击 → 编辑器展开回填；删除二次确认在 hover-reveal 下仍可见；纠错记忆新建 → 采纳；批量条操作。
- [ ] 对照 `hot-ux-hand-test-checklist.md` 相关条目回归。

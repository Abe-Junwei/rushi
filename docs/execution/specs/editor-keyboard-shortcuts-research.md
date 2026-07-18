# 调研：编辑器全键盘快捷键系统

> **状态**：已落地（2026-06）  
> **真源**：`apps/desktop/src/utils/editorShortcutRegistry.ts`  
> **关联**：`segment-text-row-model-plan.md` · 波形/语段 mutation 链路  
> **翻案注记（2026-07-18）**：§4「不做用户自定义绑定」已由 [`custom-keyboard-shortcuts-research.md`](./custom-keyboard-shortcuts-research.md) 翻案；registry / 分发架构仍以本文为准。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 听打/校对时希望**不点光标**即可合并、拆分、切语段、播放；macOS **⌘M / ⌘Space** 等为系统保留键 |
| 本仓现状（改造前） | 快捷键分散在波形 focus、`useSegmentKeyboard`；正文/列表焦点下合并无效 |
| 成功标准 | 打开文件后任意焦点下结构键生效；环境设置展示完整表；右键菜单带快捷键；macOS 避开 ⌘M、⌘Space |

---

## 2. 业内成熟路线（≥2）

| # | 产品 | 合并 | 拆分 | 导航 | 机制 |
|---|------|------|------|------|------|
| A | **Otter** | 段首 Backspace / 段尾 Delete | Enter 分段 | ⌘K 搜索 | 正文边界键 + 全局播放 |
| B | **Descript** | 右键 Merge | 时间轴工具 | ⌘K 命令面板 | 工具键 + palette |
| C | **Trint** | 手动 | 面板说明 | Shortcuts 按钮 | 文档型 |

链接：[Otter](https://help.otter.ai/hc/en-us/articles/29431724341399-Keyboard-Shortcuts) · [Descript](https://help.descript.com/hc/en-us/articles/10255582172173-Keyboard-shortcuts) · [Trint](https://info.trint.com/knowledge/keyboard-shortcuts-trint-help-center)

---

## 3. 可复用评估

| 路线 | 复用度 | 采用 |
|------|--------|------|
| Otter 边界并段 | **高** | 保留：正文行首/行尾 Backspace/Delete |
| 2 键优先合并 | **高** | **⌘J / ⌘K**（不用 ⌘M） |
| 命令面板 | 低 | **明确不做**；已有 ⌘F + registry + 设置页/右键 hint，⌘K 永久用于合并上一条 |
| Tauri Menu Accelerator | 中 | **未做**；Web capture 为主 |

---

## 4. 落地决策（v2）

| 问题 | 结论 |
|------|------|
| 架构 | **`editorShortcutRegistry` 真源** + **`useEditorShortcutDispatcher` window capture** + **`executeEditorShortcut`**；正文专用键留在 **`useSegmentKeyboard`** |
| 组合上限 | 每条 **≤3 键** |
| 合并 | **⌘J** 下一条 / **⌘K** 上一条 |
| 拆分 | **⌘D** @ 播放头 |
| 播放 | **正文外 Space**；**正文内 ⇧Space**（裸 Space 输入空格）；语段 scoped 见波形浮层 |
| 语段跳转 | 正文 **↑ / ↓**（原 Tab 已移除） |
| 备注 | **⌘N** |
| 设置 | **⌘,**（无打开文件也可用） |
| 更正记忆 | **⌘L**（需正文选区） |
| 展示 | `EnvEditorShortcutsPanel` 读 `formatEditorShortcutPanelSections()`；右键 `editorShortcutMenuHint`（**sans**，不用 mono） |
| 不做什么 | 用户自定义绑定 UI、OS 全局 hotkey、**命令面板（产品确认不做）** |

### 已知系统冲突

| 键 | 说明 |
|----|------|
| ⌘M | macOS 最小化；**未绑定** |
| ⌘Space | Spotlight；正文外播放用裸 Space，正文内用 ⇧Space；不绑 ⌘Space |
| ⌘K | 合并上一条（**不**改为命令面板；与 Descript/Otter 搜索习惯不同，可接受） |
| ⌘N | 可能与「新建」冲突；产品接受 |

---

## 5. 落位

| 层 | 文件 |
|----|------|
| 绑定真源 | `utils/editorShortcutRegistry.ts` |
| 菜单 hint | `utils/editorShortcutMenuHint.ts` |
| 执行 | `utils/executeEditorShortcut.ts` |
| 分发 | `hooks/useEditorShortcutDispatcher.ts` |
| 正文专用 | `hooks/useSegmentKeyboard.ts`（↑↓、段界并段） |
| 设置 UI | `components/EnvEditorShortcutsPanel.tsx` |
| 右键 | `utils/segmentContextMenuModel.ts` · `segmentTextContextMenuModel.ts` · `SegmentContextMenu.tsx` |

---

## 6. 签收

- [x] 调研 brief
- [x] 编码与单测（1265+ tests）
- [x] 手测通过（2026-06）
- [x] 命令面板：**明确不做**（2026-06 产品确认）
- [ ] Tauri Menu Accelerator（可选后续，非必须）

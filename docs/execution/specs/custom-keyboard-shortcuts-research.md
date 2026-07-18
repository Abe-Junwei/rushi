# 调研：自定义快捷键（用户可改绑）

> **状态**：规划门禁（2026-07-18）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（编辑器快捷键后续；非阻塞主序）  
> **关联 spec**：[`custom-keyboard-shortcuts-plan.md`](./custom-keyboard-shortcuts-plan.md)（编码前须再补 intent / acceptance）  
> **前置真源**：[`editor-keyboard-shortcuts-research.md`](./editor-keyboard-shortcuts-research.md)（registry 已落地；当时 **明确不做** 用户改绑）· [`editor-preferences-settings-research.md`](./editor-preferences-settings-research.md) §2.3 / §5（快捷键只读）  
> **门禁**：未完成本文 **不得** 进入业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 听打/校对用户希望把高频动作（一校、定稿、合并、播放、跳段）改成自己习惯的键位；左利手、跨工具迁移（Audacity / IDE）、避开本机 IME / 系统热键冲突。 |
| **本仓现状** | **真源硬编码**：[`editorShortcutDefinitions.ts`](../../../apps/desktop/src/utils/editorShortcutDefinitions.ts) → match（[`editorShortcutMatch.ts`](../../../apps/desktop/src/utils/editorShortcutMatch.ts)）→ 分发（[`useEditorShortcutDispatcher.ts`](../../../apps/desktop/src/hooks/useEditorShortcutDispatcher.ts)）→ 执行（[`executeEditorShortcut.ts`](../../../apps/desktop/src/utils/executeEditorShortcut.ts)）。**UI 只读**：[`EnvEditorShortcutsPanel.tsx`](../../../apps/desktop/src/components/EnvEditorShortcutsPanel.tsx)。右键 / 底栏 hint 读 `bindings[0]` + 静态 `keysLabel`。**无** override 持久化；Profile 导出不含快捷键。正文 ↑↓ / 段界并段仍有部分逻辑在 [`useSegmentKeyboard.ts`](../../../apps/desktop/src/hooks/useSegmentKeyboard.ts)。产品文档此前将「自定义绑定」标为 **不做**。 |
| **成功标准** | （1）环境页可对 registry 内动作 **改绑 / 清除 / 恢复默认**；（2）改后立即生效于分发、右键 hint、底栏、设置表；（3）同作用域冲突有明确处理；（4）重启后保留；（5）硬闸门 + 聚焦单测通过。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表产品 | 核心机制 | 可验证链接 |
|---|------|----------|----------|------------|
| **A** | **命令表 + 录制改绑 + 冲突提示**（媒体编辑轻量） | [Audacity Shortcuts Preferences](https://manual.audacityteam.org/man/keyboard_preferences.html) · [Aegisub Hotkeys](http://docs.aegisub.org/3.2/Options/#hotkeys) | 动作列表 → 选中 → **按键录制** → Set；若键已被占用则 **确认后抢占**（原命令变无绑定）；Defaults 一键恢复；可导入/导出整表 | Audacity Manual · Keyboard Preferences |
| **B** | **Keymap 层叠 + UI/JSON 双入口**（IDE 重量） | [VS Code keybindings](https://code.visualstudio.com/docs/configure/keybindings) · [JetBrains Keymap](https://www.jetbrains.com/help/idea/configuring-keyboard-and-mouse-shortcuts.html) | 稳定 **command id**；用户层覆盖默认；录制改绑；搜索命令/键；冲突高亮；VS Code 另有 `keybindings.json` + 可选 `when` 上下文；JetBrains 改默认会 **克隆 keymap** | VS Code Docs · IntelliJ Keymap |
| **C** | **只读表 / 无改绑**（转写竞品主流） | [Descript](https://help.descript.com/hc/en-us/articles/10255582172173-Keyboard-shortcuts) · Otter · Trint | 固定默认 + Help 快捷键页；Descript 用户长期在 Canny 求 remapping，**至今无一等公民改绑** | Descript Help · [Canny: Custom Keyboard Shortcuts](https://feedback.descript.com/feature-requests/p/custom-keyboard-shortcuts) |

### 2.1 与 Rushi 场景对照

| 维度 | Rushi 目标 | A Audacity/Aegisub | B VS Code/JetBrains | C Descript 系 |
|------|------------|--------------------|---------------------|---------------|
| 动作规模 | ~35 `EditorShortcutId` | 数百 | 上千 | 数十～百 |
| 改绑 UX | 环境页内嵌即可 | Preferences 专用页 | 独立 Keybindings 编辑器 | 无 |
| 上下文 | 已有 `textareaOnly` / `scope: waveform` / `requiresOpenFile` | 简单焦点组 | 富 `when` | 工具模式键 |
| 冲突策略 | 需明示 | 确认后抢占 | 列表标冲突 / 系统冲突弹窗 | — |
| 持久化 | 本机 localStorage（+ 可选 Profile） | 配置文件 / XML | JSON / keymap 文件 | — |
| 复杂度 | 忌 IDE 级 | **合适量级** | 过重 | 与诉求相反 |

**结论**：转写竞品（C）普遍不做改绑，但 **媒体/字幕工具（A）** 与 **IDE（B 的简化子集）** 已是成熟标准。Rushi 应采用 **A 的 UX 骨架**（录制 + 冲突确认 + 恢复默认），数据模型对齐 **B 的「稳定 command id + 用户覆盖层」**，**不做** VS Code 级 `when` DSL、命令面板、chord（多击序列）、完整 keymap 预设市场。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A Audacity/Aegisub** | **高** | 录制框、冲突确认抢占、Clear、Defaults、按分类列表 | 导入 XML/双 Defaults 集 v1 可不做 | 纯 UI + localStorage |
| **B IDE keymap** | **中** | command id 稳定、覆盖层、搜索、派生展示文案 | `when` / chord / JSON 双入口过重；违反轻量 IA | 实现与测试面大 |
| **C Descript** | **低** | 只读表已有 | 与本议题目标相反 | — |

**本仓已有可复用模块**（须扩展，禁止平行真源）：

| 模块 | 路径 | 说明 |
|------|------|------|
| 动作 / 默认绑定真源 | `editorShortcutDefinitions.ts` + `EditorShortcutId` | **默认层**不变；用户层只存 diff |
| 匹配 | `editorShortcutMatch.ts` | 改为消费 **effective definitions** |
| 展示 | `editorShortcutFormat.ts` · `editorShortcutMenuHint.ts` | 从 effective `bindings` **派生** `keysLabel`，消灭静态漂移 |
| 分发 / 执行 | `useEditorShortcutDispatcher` · `executeEditorShortcut` | 仍按 **id** 执行，不改业务 |
| Pref 模式 | `waveformPrefs.ts`（`rushi.p1.*` + subscribe/notify） | 新建 `rushi.editor.shortcuts.v1` |
| 设置壳 | `EnvEditorShortcutsPanel.tsx` | 只读表 → 可编辑行 |
| Profile | `profileContract.ts` | P1：可选纳入 `editor.shortcuts` |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **覆盖层 keymap（Audacity UX + IDE id 模型）**：`defaults ∪ userOverrides` → `getEffectiveShortcutDefinitions()`；环境「快捷键」页支持 **点选动作 → 录制新键 → 冲突确认 → 写入**；Clear 解绑；「恢复默认」清该条或全部 override。 |
| **冲突策略（v1）** | 同 **match 作用域**（global vs waveform；textareaOnly 视为不同槽）内若 chord 已被另一 `EditorShortcutId` 占用 → 确认后 **抢占**（对方该 binding 移除；若对方无剩余 binding 则该动作无快捷键）。不静默双绑。 |
| **绑定约束** | 延续现有：`mod`=⌘/Ctrl、≤3 键、禁止空绑定写入非法组合；**继续避开** macOS ⌘M / ⌘Space（录制到系统保留键时拒绝并提示）。 |
| **展示真源** | 禁止手写与 binding 不一致的 `keysLabel` 作为运行时真源；format/menu/footer **一律由 effective bindings 生成**（默认定义里的 `keysLabel` 可保留作文档 fallback，但 UI 以派生为准）。 |
| **不做什么（v1）** | ❌ VS Code `when` DSL / chord 多击序列；❌ 命令面板；❌ OS 级全局 hotkey（应用未聚焦）；❌ 多套命名 keymap 市场（JetBrains 风格）；❌ 鼠标手势改绑；❌ 把 `useSegmentKeyboard` 段界 Backspace/Delete **一并**做成可改（仍属正文编辑器语义，v1 仅 registry id）；❌ Tauri 原生 Menu Accelerator 同步（可选后续）。 |
| **与既有决策关系** | **翻案** [`editor-keyboard-shortcuts-research.md`](./editor-keyboard-shortcuts-research.md) §4「不做用户自定义绑定」与 preferences research「改键不做」；registry / 分发架构 **保留**，仅加覆盖层。命令面板仍 **不做**。 |
| **风险与 spike** | （1）`keysLabel` 与多 binding（如 Space + ⇧Space）派生文案；（2）改绑后 footer 轮换 / 右键 hint 订阅刷新；（3）未知 `EditorShortcutId` 的旧 storage 须忽略不炸；（4）录制时勿被 dispatcher 自己吃掉按键。 |

### 4.1 建议产品切片

| 薄片 | 内容 | 预估 |
|------|------|------|
| **K1** | 覆盖层 + effective resolve + 持久化 + 匹配/展示切到 effective；设置页改绑/清除/恢复；冲突确认 | 主切片 |
| **K2** | Profile 导出/导入含 shortcuts；搜索过滤动作 | 跟随 |
| **K3**（可选） | 将剩余 `useSegmentKeyboard` 可映射动作收入 registry；系统冲突只读提示列表 | 后置 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 偏好 | 新建 `apps/desktop/src/utils/editorShortcutOverrides.ts`（或 `services/editor/shortcutOverrides.ts`） | `read/write` + subscribe/notify；schema `v1` |
| 解析 | `editorShortcutDefinitions.ts` / 新 `getEffectiveShortcutDefinitions` | 合并默认与 override |
| 匹配 / 格式 / hint | `editorShortcutMatch` · `editorShortcutFormat` · `editorShortcutMenuHint` | 改读 effective |
| UI | `EnvEditorShortcutsPanel.tsx` + 小组件（录制行） | 可编辑 |
| 分发 | `useEditorShortcutDispatcher` | 录制模式短路；订阅 override 刷新 |
| Profile | `profileContract.ts` | K2 |
| 测试 | overrides merge / conflict / match / panel | 聚焦单测 |
| 文档 | 本 brief · plan · 翻案注记进旧 research | 门禁 |

**禁止**：第二套 shortcut id 枚举；在组件内散落 `localStorage` 读写。

---

## 6. 签收

- [x] 调研 brief 完成（2026-07-18）
- [ ] intent / plan / acceptance 已链接本文（plan 已起稿；intent/acceptance 编码前补齐）
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版：翻案「不做改绑」；选定 Audacity UX + IDE command-id 覆盖层 |

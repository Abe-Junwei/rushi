# Plan：自定义快捷键（K1 主切片）

> **调研**：[`custom-keyboard-shortcuts-research.md`](./custom-keyboard-shortcuts-research.md) ✅  
> **状态**：规划稿（待 intent / acceptance 与用户确认后编码）  
> **范围**：K1 — 覆盖层 + 环境页改绑 + 冲突确认 + 展示/匹配切到 effective  
> **不做**：见 research §4「不做什么」

---

## 0. 目标与验收口径（摘要）

| # | 目标 | 验证 |
|---|------|------|
| G1 | 用户可改绑任一 `EditorShortcutId` 的主绑定（v1：每动作 **一条** 用户 binding；多默认 binding 的动作改绑替换「展示用主绑定」，其余默认保留或按 §2.2） | 手测 + 单测 |
| G2 | 改绑后 match / 右键 hint / 设置表 / footer **立即**一致 | 手测 + format 单测 |
| G3 | 同作用域冲突 → 确认后抢占 | 单测 |
| G4 | 重启保留；「恢复默认」可清除 override | 单测 + 手测 |
| G5 | `npm run typecheck && npm run test` 相关包绿；architecture guard | CI 本地 |

---

## 1. 数据模型

### 1.1 Storage

```ts
// localStorage key: rushi.editor.shortcuts.v1
type ShortcutOverridesV1 = {
  v: 1;
  /** 仅存相对默认的差异；缺省 id = 使用默认 bindings */
  byId: Partial<Record<EditorShortcutId, ShortcutBinding[] | null>>;
};
```

| `byId[id]` | 语义 |
|------------|------|
| 缺省 | 使用 `EDITOR_SHORTCUT_DEFINITIONS` 原 bindings |
| `[]` 或 `null` | **显式无快捷键**（用户 Clear） |
| 非空数组 | 用户绑定（v1 UI 只编辑 `[0]`；写入时存长度为 1 的数组即可） |

校验写入时：复用 `countShortcutBindingKeys` ≤ 3；拒绝空 `key`；可选拒绝已知系统保留（⌘M / ⌘Space）。

### 1.2 Effective resolve

```ts
function getEffectiveShortcutDefinitions(): EditorShortcutDefinition[]
```

- 对每个默认 def：若 override 存在则 `bindings = override`（null/[] → `bindings: []`），并 **派生** `keysLabel`。
- `keysLabel` 派生：与 `formatShortcutBindingMenuLabel` 同规则，多绑定用 ` / ` 连接（对齐现有 Space 文案风格）。
- Match / format / menuHint **只**读 effective 列表（或注入 getter），禁止再直接扫静态数组做运行时展示。

### 1.3 冲突键

两 binding 冲突当且仅当：

1. `key` + `mod` + `alt` + `shift` 相等；且  
2. 作用域兼容：`scope` 相同（缺省 global）；且  
3. `textareaOnly` 相同（皆 true 或皆非 true）。

（`allowInTextarea` 差异不单独开槽，避免过度细分。）

---

## 2. UI（环境 → 快捷键）

### 2.1 行交互（Audacity 型）

每行：`动作文案 | 当前键 | [改绑] [清除]`  

- **改绑**：进入录制态（按钮文案「按下新快捷键…」）；捕获 `keydown`（**须**在 dispatcher 之前 `preventDefault` + 忽略本次匹配）；Enter 确认 / Esc 取消。  
- **冲突**：弹 `compactDialog`：「已用于「{其他动作}」。改绑到此并移除对方快捷键？」→ 确认则写双方 override。  
- **清除**：`byId[id] = []`。  
- **页脚**：「全部恢复默认」→ 删 storage key / 空 `byId`。  
- 已改绑行可显示轻量标记（如「已自定义」），用 token 色，禁散落 hex。

### 2.2 多默认 binding 动作（如 `playback.toggle`）

v1 策略（简单）：

- 设置表展示 **全部** effective bindings 的派生标签。  
- 「改绑」只替换 / 设置 **第一条**；若用户改绑，写入 `byId[id] = [newBinding]`（**单条**），即用户自定义后不再保留该动作的其它默认键。  
- Tooltip 说明：「自定义后仅保留所设组合」。  

（K3 再做「为同一动作添加第二条」。）

### 2.3 录制与分发互斥

`editorShortcutOverrides` 或 panel 设 `isShortcutCaptureActive()`；`useEditorShortcutDispatcher` 在 capture 为 true 时 **直接 return**，避免录制时触发保存/跳段等。

---

## 3. 代码落位

| 步骤 | 文件 | 工作 |
|------|------|------|
| 1 | 新建 `utils/editorShortcutOverrides.ts` | schema、parse、read/write、subscribe、`getOverride`、`setOverride`、`clearAllOverrides`、`findConflictingShortcutId` |
| 2 | 新建或扩 `utils/editorShortcutEffective.ts` | `getEffectiveShortcutDefinitions`、`deriveKeysLabel` |
| 3 | `editorShortcutMatch.ts` / Registry facade | match 使用 effective |
| 4 | `editorShortcutFormat.ts` · `editorShortcutMenuHint.ts` · `editorFooterShortcutHints.ts` | 读 effective；footer 订阅 prefs 变更可重算 |
| 5 | `EnvEditorShortcutsPanel.tsx` | 可编辑 UI + 录制 + 冲突 dialog |
| 6 | `useEditorShortcutDispatcher.ts` | capture 短路；可选依赖 version 无必要（match 每次读 LS/内存缓存即可） |
| 7 | 测试 | merge、conflict、clear、match 用 override、派生 label |
| 8 | 旧 research 注记 | 在 `editor-keyboard-shortcuts-research.md` / preferences research 顶部加「已被 custom-keyboard-shortcuts-research 翻案」一行 |

**不改**：`executeEditorShortcut` 业务分支（仍只认 id）。

---

## 4. 验证计划

```bash
# 聚焦
npx vitest run src/utils/editorShortcutOverrides.test.ts \
  src/utils/editorShortcutEffective.test.ts \
  src/utils/editorShortcutMatch.ts \
  src/utils/editorShortcutRegistry.test.ts \
  src/utils/editorShortcutMenuHint.test.ts \
  src/utils/editorFooterShortcutHints.test.ts

# 仓级（编码结束）
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

**手测**

1. 改「一校」为 `Alt+Enter` → 正文内生效；右键「标记一校」hint 更新。  
2. 把已占用键改到另一动作 → 确认抢占 → 原动作无键且不再触发。  
3. 清除定稿键 → Ctrl+Enter 无效；恢复默认后恢复。  
4. 录制过程中乱按其它快捷键不落业务动作。  
5. 重启应用 override 仍在。

---

## 5. 后续薄片（非本 Plan）

| ID | 内容 |
|----|------|
| K2 | Profile `editor.shortcuts`；面板搜索 |
| K3 | 段界键 registry 化；系统冲突只读提示；同动作多绑定编辑 |

---

## 6. 编码前检查清单

- [ ] 用户确认本 Plan / research 决策（尤其：冲突抢占、多 binding 改绑变单条）  
- [ ] 补 `custom-keyboard-shortcuts-intent.md` + `…-acceptance.md`（链 research）  
- [ ] 路线图薄片标注「调研 ✅」后再标「编码中」  

# F2 — 查找替换 手测清单

> **状态**：✅ UI 已签收（2026-06-04）· **机器闸门 ✅**（`bash scripts/r3-5f-a-machine-gate.sh`）  
> **验收真源**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F2  
> **⑤″f-A**：F2 手测 ✅（R3t-E 词表校对已从产品移除，2026-06）

## 机器闸门

```bash
bash scripts/r3-5f-a-machine-gate.sh
```

- [x] `segmentFindReplace.test.ts` — 字面匹配、Replace All、单字替换边界  
- [x] 工具栏 + `Mod+F`；busy 时不响应（编码 ✅）

---

## 环境

- [x] `npm run desktop:dev`；打开含 **≥10 条语段** 的长稿项目（可用制控转写结果）  
- [x] 准备 3 个需统一的专名错形（例：`制控`→`自控`、`山通`→`禅宗`、`觉观`→`决观`）

## §1 — 查找与跳转

1. `⌘F` 打开查找替换面板。  
2. 查找 **「制控」** → 显示 **第 k/N 处**；上/下条跳转对应语段。

**期望**

- [x] 语段正文内高亮当前匹配  
- [x] 跳转后列表行与正文高亮一致  
- [x] 编辑中未 flush 的草稿：打开查找前先写入语段（flush）

## §2 — 替换当前 + 快捷键

1. 在某匹配处用 **Enter** 替换并下一处；**Shift+Enter** 上一处；**⌘Enter** 替换当前。  
2. **撤销**（⌘Z）恢复。

**期望**

- [x] 单次替换正确；可撤销  
- [x] 计数 k/N 随进度更新

## §3 — 全部替换（Replace All）

1. 查找专名错形 A，替换为正确形 B。  
2. 点 **全部替换** → 预览 diff → 确认一次写回。

**期望**

- [x] 全稿所有字面匹配一次更新  
- [x] 写回后可撤销  
- [x] **点击次数**：改 3 处专名 **≤10 次**（不含保存）— ⑤″f-A ROI 指标

## §4 — Correct 浮层

1. 选中语段内错词 → 浮层列出 memory + glossary 候选（无谐音猜）。  
2. 点 **改正** 或 **⌘F** 预填查找框。

**期望**

- [x] 候选来自记忆/词表  
- [x] 改正后语段更新

## §5 — 记忆闭环（F2 → correction_memory）

1. §3 Replace All 写回后 **保存**（或等自动保存）。  
2. 打开 **热词与记忆 → 纠错记忆**。

**期望**

- [x] 出现对应 `before→after` 记录（`explicit_pairs` 路径）

---

## 签收

| 日期 | 结果 | 备注 |
|------|------|------|
| 2026-06-04 | ✅ | UI 手测全绿 |
| 2026-06-11 | ✅ | 复测（语段 P0 后）；`r3-5f-a-machine-gate.sh` ✅；§1–§5 + P0 回归 |

**签收后**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F2 手测项已勾选；**⑤″f-A** 可闭合 → 开 **⑤″f-B**（F1 + F6 + MEM-P0）。

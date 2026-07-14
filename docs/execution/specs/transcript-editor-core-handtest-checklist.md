# Transcript Editor Core — 手测总清单

> **真源**：本文件汇总终态手测；勾选结果回写 [`transcript-editor-core-remediation-acceptance.md`](./transcript-editor-core-remediation-acceptance.md) §6。  
> **调研 / 计划**：[`transcript-editor-core-remediation-research.md`](./transcript-editor-core-remediation-research.md) · [`transcript-editor-core-remediation-plan.md`](./transcript-editor-core-remediation-plan.md)  
> **前提**：CM6 恒 on（无 flag 开关）；机器门禁已绿。  
> **素材建议**：日常 ≥193 段工程文件；性能项另备 ~2000 段。

**签收人**：用户　**日期**：2026-07-11　**构建 / commit**：`ee5298d`（工作区含后续输入延迟 / Tab 不定稿等未提交修复）

---

## 0. 最短冒烟（约 10 分钟）

按顺序跑一遍；任一项失败则停，记入 §8。

| # | 步骤 | 期望 | 过 |
|---|------|------|----|
| S1 | 打开转写文件，单击某语段 | 光标可见、可打字 | [x] |
| S2 | 编辑中按空格、删一字 | 插入空格 / 删字；**不**播放、**不**丢焦 | [x] |
| S3 | ↑↓ 连按数次 | 选中跟随；波形 band 与列表一致 | [x] |
| S4 | 波形单击另一语段 | 列表同步选中 + seek 段首 | [x] |
| S5 | 打几个字后立刻 ⌘S | 保存成功；重开或 reload 后字仍在 | [x] |
| S6 | 再改一字，关文件触发 dirty 门禁 | 提示未保存；保存后可关 | [x] |
| S7 | 开 filter → ↑↓ → 清 filter | 只见匹配行；↑↓ 不进隐藏段；清除后恢复 | [x] |

---

## 0b. 筛选全链路修复冒烟（2026-07-14）

关联：[`segment-filter-chain-remediation-acceptance.md`](./segment-filter-chain-remediation-acceptance.md)

| # | 步骤 | 期望 | 过 |
|---|------|------|----|
| SF-1 | 筛冻结/阶段 → 滚列表 → 点可见行打字 | 无回跳；条纹/gutter 无残影；输入流畅 | [ ] |
| SF-2 | 选一隐藏 primary（筛选后） | banner + 波形 chrome；不可拖边界/右键/lasso | [ ] |
| SF-3 | 筛选下 merge/split/delete | 无错藏；可见性立即正确 | [ ] |
| SF-4 | 波形 lasso / 空白点击 | 不命中隐藏段；重叠约束仍认全量 | [ ] |
| SF-5 | 冻结多选（非 primary） | 文本弱 callout + 条纹；与波形一致 | [ ] |
| SF-6 | 清筛选 | 行/band/交互立即恢复 | [ ] |

---

## 1. 编辑—聚焦矩阵（E-1..E-7）

| # | 步骤 | 期望 | 过 |
|---|------|------|----|
| E-1 | 单击任意语段 | 立即编辑态、**光标闪烁可见** | [x] |
| E-2 | 双击语段内一词 | 选中该词、可继续编辑 | [x] |
| E-3 | 编辑中删除一个字符 | **保持编辑态、不 blur** | [x] |
| E-4 | 编辑中按 **空格** | 插入空格，**不触发播放** | [x] |
| E-5 | 编辑中按 **回车** | 按产品语义（确认/前进或忽略），**不误触播放** | [x] |
| E-6 | 中文 IME 连续输入（拼音组字） | 无丢字、光标不跳、组合态正确 | [x] |
| E-7 | 连按 ↑/↓ **20** 次跨语段 | 选中平滑跟随、不卡、焦点不丢到全局 | [x] |

---

## 2. 选区一致性（SC-H1..H12）

真源 = CM6；列表与波形须**双向零 desync**（无需 reconcile）。

| # | 场景 | 期望 | 过 |
|---|------|------|----|
| SC-H1 | 列表单击 | primary=该段，唯一选中；gutter/高亮正确 | [x] |
| SC-H2 | 波形单击语段 | 列表同步选中 + seek 到段首 | [x] |
| SC-H3 | Cmd/Ctrl+单击 | toggle 多选，primary 更新 | [x] |
| SC-H4 | Shift+单击 | anchor→target 区间选中 | [x] |
| SC-H5 | ↑/↓ | primary 移动，单选替换 | [x] |
| SC-H6 | Shift+↑/↓ | 区间扩展 | [x] |
| SC-H7 | 选中后滚出视口再滚回 | 选区视觉仍正确 | [x] |
| SC-H8 | 开 filter / 隐藏部分段 | 不可见段不画；banner/计数正确；↑↓ 不进隐藏段；清 filter 恢复 | [x] |
| SC-H9 | split 段 | 选区落在合理段；时间戳正确 | [x] |
| SC-H10 | merge 段 | 选区 / 时间戳 / 持久化正确 | [x] |
| SC-H11 | delete 段 | 选区回落相邻段 | [x] |
| SC-H12 | 波形拖拽调整边界 | 波形边界更新；**列表 gutter 时间戳同步**；保存后仍正确 | [x] |

**附加（选区运输）**

| # | 场景 | 期望 | 过 |
|---|------|------|----|
| SC-X1 | 列表单击 | **不** seek（与波形点选区分） | [x] |
| SC-X2 | Space（无编辑焦点 / 选中语段） | 播选中语段；编辑焦点内 Space 仍走 E-4 | [x] |

---

## 3. 持久化 / dirty / 旁路写回（D + P9b2b）

| # | 场景 | 期望 | 过 |
|---|------|------|----|
| D-1 | 打开文件 → 浏览/轻编辑 → 保存 → 重开 | uid/start/end/stage/text 与预期一致（换行按 U+240A 策略） | [x] |
| D-2 | 打字后等 autosave（或不手动存） | dirty 指示合理；autosave 后与磁盘一致 | [x] |
| D-3 | split / merge / delete / insert 后 ⌘S，再 undo/redo | meta+文本同步；undo/redo 后 CM6 与列表一致 | [x] |
| D-4 | 打字后 **立即** ⌘S（不等 48ms） | 无丢字 | [x] |
| D-5 | IME 组合输入过程中 | **不**误触发 autosave 打断组字 | [x] |
| D-6 | 关闭门禁：有未保存改动 | 提示 dirty；保存/丢弃行为正确 | [x] |
| D-7 | 导出（常用一种格式即可） | 导出正文含最近编辑 | [x] |
| D-8 | 行内纠错 popover 改一词 | CM6 与列表同步；保存后仍在 | [x] |
| D-9 | Undo / Redo 各一次（文本或结构） | CM6 聚焦时也能正确还原，不「弹回」旧字 | [x] |
| D-10 | （若有）Stage B / 纠错规则写回预览确认 | 写回后列表+CM6 一致；保存不丢改 | [x] |

> 验收文档 D-1..D-5 的自动化/守卫部分仍以 acceptance §5 为准；上表为**可手测**展开。

---

## 4. 性能与主观手感（本机）

| # | 指标 | 达标线 | 素材 | 过 |
|---|------|--------|------|----|
| P-1 | 选区切换 firstPaint | 主观 <50ms | 193 + 可选 2000 段 | [x] |
| P-2 | 选区切换总延迟 | 明显优于旧 listCommit（≈400ms） | 2000 段 | [x] |
| P-3 | 长表滚动 | 不掉帧、gutter 与正文锁步 | 2000 段 | [x] |
| P-4 | meta rail 锁步 | 滚动时时间戳列无肉眼错位 | 2000 段 | [x] |

机器侧 spike / profile 数字见 research §7；本表只记**主观手测**。

---

## 5. 发版前硬门禁（可延后）

| # | 场景 | 期望 | 过 |
|---|------|------|----|
| W-1 | Windows 11 + WebView2 + 长段中文 IME | 无丢字/光标乱跳；`EDIT_CONTEXT=false` 行为可接受 | [ ] 发版前再测 |
| W-2 | 含历史换行文本的真实导出 | 按 U+240A 策略可逆；禁止静默空格替换破坏语义 | [x] |

---

## 6. 签收汇总

| 块 | 结果 |
|----|------|
| §0 最短冒烟 | [x] 全过 |
| §1 E-1..E-7 | [x] 全过 |
| §2 SC-H1..H12 + SC-X | [x] 全过 |
| §3 D / dirty / 旁路 | [x] 全过 |
| §4 性能主观 | [x] 全过 |
| §5 Windows / 导出 | [x] 导出过；Windows IME **发版前再测** |

全部应勾项通过后，在 acceptance §6 勾「用户手测确认」，并在下方记三行日志。

**三行日志**

- 改动：CM6 Transcript Editor Core 终态（选区/编辑单一真源；输入延迟对齐；Tab 不定稿 / ⌘Enter 定稿）  
- 验证：手测总清单 §0–§4 全过；§5 W-2 过；W-1 Windows WebView2+CJK IME 仍为发版前硬门禁  
- 下一轮：Windows 发版前补测 W-1；视需要提交本轮未入库改动  

---

## 7. 失败记录

| ID | 现象 | 复现步骤 | 严重度 | 备注 |
|----|------|----------|--------|------|
| | | | | （本轮无开放失败项） |

---

## 8. 与旧文档的编号说明

- 本清单 **SC-H\*** = remediation acceptance（CM6 真源）编号。  
- 旧 [`selection-chrome-bus-acceptance.md`](./selection-chrome-bus-acceptance.md) 的 SC-H1–H13 为 **SC2 时代**矩阵，语义不同，**勿混勾**；仅作历史对照。  
- Grill / waveform H1–H20 等其它薄片手测不在本文件范围。

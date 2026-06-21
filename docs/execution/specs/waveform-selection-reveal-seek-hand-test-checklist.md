# 手测清单：波形 + 列表交互与绘制统一修复（H1–H20）

> **Acceptance**：[`waveform-selection-reveal-seek-acceptance.md`](./waveform-selection-reveal-seek-acceptance.md)  
> **Plan**：[`waveform-selection-reveal-seek-plan.md`](./waveform-selection-reveal-seek-plan.md)  
> **S8 调研**：[`waveform-list-ux-boundaries-research.md`](./waveform-list-ux-boundaries-research.md)  
> **架构矩阵**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)

---

## 签收头（手测开始前填写）

| 项 | 填写 |
|----|------|
| 日期 | 2026-06-20 |
| 测试人 | （手测完成） |
| Git SHA | `aba1a15` |
| 运行方式 | ☑ Release `.app`（`apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`） |
| macOS / 引擎 | arm64 · WebKit |
| 测试项目 | 转写页主路径 + H10 长稿（≥500 段） |
| 语段规模 | H10 ≥500 段；其余 20–50 段 |
| 本地 ASR | ☑ 跳过（仅 UI 交互） |

**Blocker**：任一 **P0** 行（H1、H2、H4、H7、H10、H13、H16–H18）标 **FAIL** → Plan 不得签收。

---

## 测前准备

### 机器闸门（编码侧，手测前须绿）

```bash
cd /path/to/Rushi
npm run typecheck && npm run test
node scripts/check-architecture-guard.mjs
```

| 项 | 结果 | 日期 |
|----|------|------|
| typecheck + test + guard 0 error | ☑ PASS | 2026-06-20 |

### 数据与入口

1. 打开**转写页**（含波形 tier + 语段列表 + 时间尺）。
2. **H10**：导入或打开 **≥500 语段** 的长稿；其余用中等长度即可。
3. **H12**：至少 1 条语段正文 **≥3 行换行**（选中行 + 非选中长行各 1 条）。
4. **H14**：开启列表**筛选**，使当前 `selectedIdx` 被过滤隐藏。
5. **H19**：波形上 **Shift+框选** 或等价操作，先建立 **多选**（≥2 段），再测空白短 tap。
6. 测 **H16–H18** 时准备 **≥2 min** 可播放音频，便于 zoom / 横滚 tier。

### 观察要点（通用）

- **tier 滚** = 波形视口 horizontal scroll 变化；**播放头不跳** = 时间码 / 竖线位置不变（或仅随播放推进）。
- **seek** = 播放头跳到点击/选中语段起点（波形源选中时）。
- 列表 **reveal** = 选中语段滚入列表视口 + tier 对准语段时间（F3/L1）。

---

## Grill + 列表（S0–S5, S8）

### H1 — Hub 点语段（P0）

| 步骤 | 操作 |
|------|------|
| 1 | 播放头停在非目标语段时间 |
| 2 | 在列表 **Hub/行首** 或语段行（非 textarea）点击切换语段 |

| 期望 | 结果 | 备注 |
|------|------|------|
| tier 滚到对准该语段 | ☐ PASS ☐ FAIL | |
| **播放头时间不跳**（不 seek） | ☐ PASS ☐ FAIL | |

---

### H2 — textarea ↑↓（P0）

| 步骤 | 操作 |
|------|------|
| 1 | focus 某语段 **textarea** |
| 2 | **↑ / ↓** 切换语段（非 Tab） |

| 期望 | 结果 | 备注 |
|------|------|------|
| tier **reveal** 新语段（F3 门控：失焦时可能不 reveal，记录实际） | ☐ PASS ☐ FAIL | |
| **不 seek**（播放头不跟选中跳） | ☐ PASS ☐ FAIL | |

---

### H3 — 同一行再点 T2

| 步骤 | 操作 |
|------|------|
| 1 | 选中语段 A，tier 已对准 |
| 2 | **再次点击同一行**（Hub/行，非换段） |

| 期望 | 结果 | 备注 |
|------|------|------|
| tier **不二次滚动/不抖** | ☐ PASS ☐ FAIL | |
| 仅 focus 行为（可进 textarea） | ☐ PASS ☐ FAIL | |

---

### H4 — 波形 / minimap / 空白（P0）

| 步骤 | 操作 |
|------|------|
| 1a | 波形上点击 **语段带** |
| 1b | 点击 **minimap**（若有） |
| 1c | 点击波形 **空白** |

| 期望 | 结果 | 备注 |
|------|------|------|
| 1a：选中 + reveal + **seek** 到语段 | ☐ PASS ☐ FAIL | |
| 1b：视口/seek 符合 minimap 策略 | ☐ PASS ☐ FAIL | |
| 1c：空白 tap **seek** 到点击时间 | ☐ PASS ☐ FAIL | |

---

### H7 — 时间尺单击 R2（P0）

| 步骤 | 操作 |
|------|------|
| 1 | 记录当前播放头时间 |
| 2 | **单击**嵌入时间尺（非拖拽 scrub） |

| 期望 | 结果 | 备注 |
|------|------|------|
| tier **滚动**到点击时间居中/对准 | ☐ PASS ☐ FAIL | |
| **播放头不 seek**（时间不变） | ☐ PASS ☐ FAIL | |

---

### H8 — Tab confirmAdvance

| 步骤 | 操作 |
|------|------|
| 1 | textarea 内编辑后 **Tab**（confirmAdvance） |
| 2 | 偏好：**不**开启「Tab 跳下一段并 loop」 |

| 期望 | 结果 | 备注 |
|------|------|------|
| 选中下一段（`listKeyboard`） | ☐ PASS ☐ FAIL | |
| **不 seek** | ☐ PASS ☐ FAIL | |

---

### H9 — Tab loop-play 例外

| 步骤 | 操作 |
|------|------|
| 1 | 设置开启 **Tab 跳下一段并 loop 播放**（若产品有该项） |
| 2 | textarea 内 Tab confirmAdvance |

| 期望 | 结果 | 备注 |
|------|------|------|
| 跳下一段 + **loop/seek 播放**（K1 例外） | ☐ PASS ☐ FAIL ☐ N/A | |

---

### H10 — 500+ 段虚拟列表（P0）

| 步骤 | 操作 |
|------|------|
| 1 | 打开 **≥500 语段** 项目 |
| 2 | 点击 **远离当前视口** 的语段（如第 400 段） |

| 期望 | 结果 | 备注 |
|------|------|------|
| 列表 **无长时间空白/白闪** | ☐ PASS ☐ FAIL | |
| 选中行最终可见 | ☐ PASS ☐ FAIL | |

---

### H11 — 选中后立即手动滚列表

| 步骤 | 操作 |
|------|------|
| 1 | 选中远处语段（触发列表自动滚入） |
| 2 | **立刻**手动滚轮/拖拽列表 scrollbar 到另一位置 |

| 期望 | 结果 | 备注 |
|------|------|------|
| 列表 **跟手**，不被 rAF correction 拉回 | ☐ PASS ☐ FAIL | |

---

### H12 — 选中行长文本

| 步骤 | 操作 |
|------|------|
| 1 | 选中 **多行换行** 语段，上下滚列表 |
| 2 | 观察 **非选中** 长语段 |

| 期望 | 结果 | 备注 |
|------|------|------|
| **仅选中行**正文可读（overflow visible） | ☐ PASS ☐ FAIL | |
| 非选中长行可被裁切（v0.1.8 预期） | ☐ PASS ☐ FAIL | |

---

### H13 — range drag auto-scroll（P0）

| 步骤 | 操作 |
|------|------|
| 1 | Shift+拖拽或 range 拖选，指针移到列表 **顶/底边缘** |
| 2 | 继续按住，指针移出列表视口（仍按住） |

| 期望 | 结果 | 备注 |
|------|------|------|
| 列表 **auto-scroll**，选区随 hover 扩展 | ☐ PASS ☐ FAIL | |
| 离屏时仍滚动；hover 钳在首/末行 | ☐ PASS ☐ FAIL | |
| 边缘越近滚越快（非固定慢速） | ☐ PASS ☐ FAIL | |

---

### H14 — 过滤隐藏当前选中

| 步骤 | 操作 |
|------|------|
| 1 | 选中语段后，设筛选使该段 **不可见** |

| 期望 | 结果 | 备注 |
|------|------|------|
| 出现 **banner** 提示 | ☐ PASS ☐ FAIL | |
| 「清除过滤并定位」可用 | ☐ PASS ☐ FAIL | |

---

### H15 — focus=selected（S2′）

| 步骤 | 操作 |
|------|------|
| 1 | 选中 **段 0**；DOM focus 在 **段 1 textarea**（点击段 1 正文不切换选中） |
| 2 | 触发 merge/split（或等价结构快捷键） |
| 3 | 再测：点击段 1 正文应先 **选中段 1** |

| 期望 | 结果 | 备注 |
|------|------|------|
| 步骤 2 作用在 **段 0**（selectedIdx） | ☐ PASS ☐ FAIL | |
| 步骤 3 点击正文先选中再编辑 | ☐ PASS ☐ FAIL | |

---

### H15a — Tab 进列表 / a11y

| 步骤 | 操作 |
|------|------|
| 1 | 键盘 **Tab** 进入语段 textarea |
| 2 | 失焦状态下用快捷键（不 focus textarea） |

| 期望 | 结果 | 备注 |
|------|------|------|
| Tab 后 textarea 与 **selectedIdx** 一致 | ☐ PASS ☐ FAIL | |
| 失焦 shortcut 无意外 reveal | ☐ PASS ☐ FAIL | |

---

## 波形绘制（S6–S7, S9–S10）

### H16 — 播放中 zoom（P0）

| 步骤 | 操作 |
|------|------|
| 1 | **播放中** zoom in / out（滚轮或快捷键） |

| 期望 | 结果 | 备注 |
|------|------|------|
| band visited 色与 playhead **同帧**，无 1 帧撕裂 | ☐ PASS ☐ FAIL | |

---

### H17 — seek / 点选语段

| 步骤 | 操作 |
|------|------|
| 1 | 暂停或播放中 **seek**（点语段 / 空白） |

| 期望 | 结果 | 备注 |
|------|------|------|
| segment band **立即**重绘，无明显延迟 | ☐ PASS ☐ FAIL | |

---

### H18 — 快速横滚 tier（P0）

| 步骤 | 操作 |
|------|------|
| 1 | 长音频下 **快速** 横向拖滚 tier / 波形 |

| 期望 | 结果 | 备注 |
|------|------|------|
| band 与 tier scroll **同步**，无明显拖尾 | ☐ PASS ☐ FAIL | |

---

### H19 — Shift + 空白短 tap（P0）

| 步骤 | 操作 |
|------|------|
| 1 | 已有 **多选** |
| 2 | **Shift + 短 tap** 波形空白（未拖动） |

| 期望 | 结果 | 备注 |
|------|------|------|
| **不清空**多选 | ☐ PASS ☐ FAIL | |
| 不误 seek（或符合 S9 no-op 策略） | ☐ PASS ☐ FAIL | |

---

### H20 — 框选新建大段

| 步骤 | 操作 |
|------|------|
| 1 | 空白处 **拖拽** 框选较大时间范围（新建 preview） |

| 期望 | 结果 | 备注 |
|------|------|------|
| preview **流畅**，无明显卡顿 | ☐ PASS ☐ FAIL | |

---

## 汇总矩阵

| # | 场景 | P0 | 结果 | 备注 |
|---|------|:--:|------|------|
| H1 | Hub 点语段 | ● | ☑ P | |
| H2 | textarea ↑↓ | ● | ☑ P | |
| H3 | 同一行再点 | | ☑ P | |
| H4 | 波形/minimap/空白 | ● | ☑ P | |
| H7 | 时间尺单击 | ● | ☑ P | |
| H8 | Tab confirmAdvance | | ☑ P | loop 偏好关 |
| H9 | Tab loop 例外 | | ☑ P | loop 偏好开 |
| H10 | 500+ 虚拟列表 | ● | ☑ P | |
| H11 | 选手动滚列表 | | ☑ P | |
| H12 | 选中行长文本 | | ☑ P | |
| H13 | range drag auto-scroll | ● | ☑ P | |
| H14 | 过滤 banner | | ☑ P | |
| H15 | focus=selected | | ☑ P | |
| H15a | Tab / a11y | | ☑ P | |
| H16 | 播放中 zoom | ● | ☑ P | |
| H17 | seek 重绘 | | ☑ P | |
| H18 | 快速横滚 tier | ● | ☑ P | |
| H19 | Shift 空白短 tap | ● | ☑ P | |
| H20 | 大段新建 preview | | ☑ P | |

**签收**：☑ **Go**（无 P0 FAIL） ☐ **No-Go**

---

## 证据附录（可选）

| 项 | 路径 / 说明 |
|----|-------------|
| 录屏 | |
| 截图 | |
| 控制台 / parity log | |
| 失败复现步骤 | |

---

## 回填 acceptance

手测完成后：

1. 在本文件汇总矩阵勾选 **P/F** 并填签收头。  
2. 更新 [`waveform-selection-reveal-seek-acceptance.md`](./waveform-selection-reveal-seek-acceptance.md) §3 各行或链到本文件。  
3. 若并入 v0.1.8，可在 [`v0.1.8-mac-release-hand-test-checklist.md`](./v0.1.8-mac-release-hand-test-checklist.md) 增一行引用。

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-21 | 初版：H1–H20 步骤 + 汇总矩阵 + 签收头 |
| 2026-06-20 | 手测 **Go**：H1–H20 全 PASS；机器闸门 1749 tests + guard 0 error |

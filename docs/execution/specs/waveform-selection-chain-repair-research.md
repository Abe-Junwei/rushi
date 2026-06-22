# 调研：Waveform Selection Chain Repair

> **状态**：已采纳
> **关联 spec**：`waveform-selection-repair_72caf131.plan.md`
> **门禁**：本文完成后进入分薄片实现；禁止继续以 timeout / fallback 堆叠掩盖选择链竞态。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 在 Editor 中点击 waveform segment，应立即看到稳定选中 chrome，播放头与 viewport 按产品矩阵移动，随后段内再点、拖拽、取消、shift/meta 多选都不产生错位或二次提交。 |
| 本仓现状 | `WaveformSegmentOverlay`/`useWaveformSegmentDrag` 处理 pointer 事件，`waveformSelectionGesture` 做 pointerdown/up，`useTranscriptionLayerSelection` 同时协调 SC1/SC2/ref、seek/reveal、list scroll，`WaveformSegmentBandCanvas` 与 DOM overlay 各自推导渲染归属。 |
| 成功标准 | 快速连续点选、播放中点选、重叠 lane 点击、pointercancel、DOM overlay 缺失 fallback、多选超过 sparse cap 均有自动化或手测覆盖，且 canvas/DOM/imperative chrome 由单一 projection 判定归属。 |

---

## 2. 业内成熟路线

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | Transcript-first editing | Descript | 文本为主要编辑对象；停止播放时文本光标与 playhead 联动，播放中允许独立；timeline 主要用于 timing 精修。 | https://help.descript.com/hc/en-us/articles/10164534109837-Playback-and-navigation |
| B | Cursor / time selection / clip selection 分离 | Audacity | Selection Tool 点击/拖拽产生 cursor 或 time range；Selection Toolbar 独立显示精确起止时间；clip/track selection 不等于 cursor。 | https://manual.audacityteam.org/man/audacity_selection.html |
| C | Mouse modifier 分离 item selection 与 edit cursor | REAPER | Media item 左键行为可配置为 select item 或 select item and move edit cursor，说明“选对象”和“移动播放头”是独立命令。 | https://www.reapertips.com/post/select-item-without-cursor-moving |
| D | Region plugin event model | WaveSurfer Regions | Region 是插件对象；`click`、`update`、`update-end` 分层派发，播放器 core 不承载 region 交互状态。 | https://wavesurfer.xyz/plugins/regions |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| Descript | 中 | Transcript 是业务真源，waveform 只做定位/精修；播放中 playhead 与文本 cursor 可暂时独立。 | Rushi 仍需要 waveform segment 的拖拽边界编辑，不能完全隐藏 timeline。 | 无额外依赖；影响交互矩阵与命令命名。 |
| Audacity | 高 | cursor、time selection、object selection 分离；点击/拖拽语义由工具/状态机决定。 | Rushi 需要文本列表与 waveform 双向同步，不能只按 track selection 设计。 | 适合落为纯状态机和 contract tests。 |
| REAPER | 高 | select-only 与 select-and-seek 分离；modifier 不应隐式复用默认 click 行为。 | Rushi 暂不暴露用户可配置 mouse modifier，只固化产品矩阵。 | 适合落为 selection command 层。 |
| WaveSurfer Regions | 中 | region lifecycle 事件分层、`update` vs `update-end` 区分。 | 不引入 WaveSurfer Regions 作为第二套 segment truth；Rushi 已有 canvas + sparse DOM 策略。 | 只借鉴事件模型，无新增包。 |

**本仓已有可复用模块**：

- `apps/desktop/src/services/waveform/waveformSelectionGesture.ts`：现有 pointerdown/up 语义入口。
- `apps/desktop/src/hooks/waveformSegmentDragHelpers.ts`：drag finish 与 lasso 纯逻辑已部分下沉。
- `apps/desktop/src/utils/waveformSegmentOverlayVisibility.ts`：DOM overlay / canvas skip 归属的现有算法。
- `apps/desktop/src/services/selection/publishSelectionChromeForInput.ts`：SC2 publish 的既有入口。
- `apps/desktop/src/utils/selectionRevealSeekPolicy.ts`：reveal / seek 产品矩阵真源。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 采用“输入状态机 + 选择命令层 + 渲染 projection”三层。输入层只处理 session 生命周期；命令层决定 select/seek/reveal；projection 层决定 canvas/DOM/imperative chrome/fallback 归属。 |
| 不做什么 | 不引入 WaveSurfer Regions，不把 SC2 变成业务真源，不恢复 React overlay viewport cull，不用更长 timeout 掩盖竞态。 |
| 与 ADR / architecture 关系 | 延续 `desktop-waveform-engine.md` 的 WaveSurfer-only、canvas bands + sparse DOM overlay、SC1/SC2 分离；细化其点选矩阵为命令语义和渲染归属。 |
| 风险与 spike 项 | `useTranscriptionLayerSelection.ts` 当前仍集中，需分薄片迁移；session id 替代 TTL 必须保留 pointerdown fast path 性能。 |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `apps/desktop/src/hooks/useWaveformSegmentDrag.ts` | 只保留 React event wiring，调用状态机与 helper。 |
| UI | `apps/desktop/src/hooks/useWaveformSegmentOverlay.ts` | 只保留 overlay 接线、click fallback 与 draft state。 |
| Service | `apps/desktop/src/services/waveform/waveformSegmentInteractionStateMachine.ts` | 新增纯状态机。 |
| Service | `apps/desktop/src/services/selection/waveformSelectionCommand.ts` | 新增 waveform select/seek/reveal 命令解析。 |
| Service | `apps/desktop/src/services/waveform/waveformSelectionRenderProjection.ts` | 新增 canvas/DOM/chrome/fallback 归属 projection。 |
| Tests | `*.test.ts` / `*.test.tsx` | 增加状态机、命令层、projection 与边界回归测试。 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] plan 已链接本文
- [x] 可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-22 | 初版：采纳三层修复路线。 |

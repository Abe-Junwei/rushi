# 媒体时间线：Source / Working 区间映射（Interval Mapping）

> **地位**：第二阶段 Wave M / 协作上传的时间轴契约。  
> **关联**：[`av-preprocess-edit-basic-plan.md`](../execution/specs/av-preprocess-edit-basic-plan.md) · [`rushi-phase-2-roadmap.md`](../execution/plans/rushi-phase-2-roadmap.md) · 评估吸收 2026-07-18  
> **原则**：语段持久化时间戳以 **Source（母带）绝对时间** 为真源；UI 播放 / 本机 ASR 输出以 **Working** 时间为准，经映射互转。

---

## 1. 为什么需要映射表

Trim / Ripple 删区会改变 Working 文件的物理时长与「播放器第 N 秒」含义。若直接改写所有语段的 `start_sec`/`end_sec`：

- 协作高频同步时易丢更新、难审计；  
- 撤销剪辑成本高；  
- 甲剪辑后的 Working 与乙未剪辑母带无法对齐同一语段。

因此：**库内语段时间永远表示母带绝对时间**；剪辑只更新轻量 `media_mapping`，不批量改写语段行（除非用户显式「烘焙/重转写」）。

---

## 2. 数据结构

每个 **File**（或项目主音频）维护一份映射（SQLite JSON 列或旁路表；协作可随项目元数据同步）：

```json
{
  "fileId": "…",
  "sourceDurationSec": 1200.0,
  "workingDurationSec": 1050.0,
  "segments": [
    { "workingStart": 0.0, "workingEnd": 300.0, "sourceOffset": 30.0 },
    { "workingStart": 300.0, "workingEnd": 1050.0, "sourceOffset": 120.0 }
  ],
  "revision": 3
}
```

| 字段 | 含义 |
|------|------|
| `workingStart` / `workingEnd` | Working 时间线上的连续区间（秒） |
| `sourceOffset` | 该区间内：`sourceTime = workingTime + sourceOffset` |
| `revision` | 映射版本；与 `media_dirty` 联动 |

**恒等映射**（未剪辑）：

```json
[{ "workingStart": 0.0, "workingEnd": <dur>, "sourceOffset": 0.0 }]
```

区间数随剪辑次数增长，通常 ≪ 50；查找可用线性扫描或按 `workingStart` 二分。

---

## 3. 操作如何更新映射

### 3.1 Trim 头（砍掉 Source 前 30s）

```json
[{ "workingStart": 0.0, "workingEnd": 1170.0, "sourceOffset": 30.0 }]
```

### 3.2 再 Ripple 删除 Working 上 [300, 390)（90s）

区间在删除点分裂，后方 `sourceOffset` 累加删除长度：

```json
[
  { "workingStart": 0.0, "workingEnd": 300.0, "sourceOffset": 30.0 },
  { "workingStart": 300.0, "workingEnd": 1080.0, "sourceOffset": 120.0 }
]
```

实现时应用纯函数：`applyRippleDelete(mapping, deleteWorkingStart, deleteWorkingEnd) → mapping'`，附单元测试。

### 3.3 Split → 两 File

每个 File 各自一份映射（相对各自 working 文件）；母带区间在 source 上不重叠或显式记录 `sourceRange`。

### 3.4 重置 Working（EDIT-BASIC-2）

恢复恒等映射 + 丢弃 working 剪辑产物；语段仍按 source 时间，无需改行。

---

## 4. 双向转换（纯函数）

```typescript
/** Working（播放器 / ASR 输出）→ Source（持久化 / 协作） */
function toSourceTime(workingTime: number, mapping: MappingSegment[]): number

/** Source（库 / 协作）→ Working（波形高亮）；落在已删死区则 null */
function toWorkingTime(sourceTime: number, mapping: MappingSegment[]): number | null
```

- **ASR 写库**：侧车返回 working 时间 → `toSourceTime` 再写入 `segments.start_sec/end_sec`。  
- **UI 渲染**：读库 source 时间 → `toWorkingTime`；`null` 则隐藏或置灰（落在删区）。  
- **协作**：上传/下载语段一律 **source 时间**；各端用本地 mapping（或空映射=完整母带）投影到自己的 Working。

---

## 5. 与 `media_dirty` 的关系

| 标志 | 含义 |
|------|------|
| `media_dirty = true` | Working 相对「上次成功转写所用媒体」已变；UI 提示「时间轴以当前 Working 为准；可重转或继续在映射下校对」 |
| 映射 `revision` 递增 | 任意 Trim/Ripple/Split apply 成功后 +1 |

**不**要求每次剪辑后强制清空语段；有映射则可继续展示。用户可选「重转写（覆盖）」清除 dirty。

---

## 6. 非目标

- 二维变速 / 曲速映射（非线性时间扭曲）  
- 把 mapping 当成 CRDT 多端合并（单端 apply 后同步整份 mapping JSON 即可）  
- MVP 用映射代替物理写出 Working 文件（仍须 ffmpeg 产出可播放 working，供 ASR）

---

## 7. 验收要点（薄片）

- [ ] 恒等映射下 toSource/toWorking 为恒等  
- [ ] Trim 头 + Ripple 中段后，已知 source 锚点投影正确  
- [ ] 落在删区的 source 时间 → working `null`  
- [ ] 重置 working 后映射回恒等，旧语段重新可见  
- [ ] 协作：甲带 mapping 上传的语段，乙无剪辑母带可 1:1 显示  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版：吸收 Phase 2 外部评估之区间映射方案 |

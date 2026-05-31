# R3e-C 手测清单 — 增量出段

> **Plan**：[`r3e-c-incremental-transcribe-plan.md`](./r3e-c-incremental-transcribe-plan.md)  
> **状态**：✅ **2026-05-31 签收**

## 环境

- [x] Paraformer 长音频 SKU 已应用；侧车 healthy；`GET /` 含 `transcribe_async`
- [x] 样本：**~20min** 中文（制控.mp3，1249s / ~20.8min）

## 主路径

- [x] 点「拉取语段」→ overwrite（若有）→ **预览 banner**（非全屏遮罩）出现
- [x] **首段可见**：首 **120s 窗**结束后 **~23.9s** 列表出现语段（≤60s SLA）
- [x] 副标题 **第 i/N 段** 递增（20min ≈ **11 窗**）
- [x] 预览中：改字无效；自动标点 disabled，tooltip 含「转写预览中」
- [x] 预览卡或工具栏 **停止转写** → 「正在停止…」→ 语段恢复转写前；无 SQLite 新 save
- [x] DEV：`console` 见 `[r3e-c] first_segments_visible_ms=`（首 delta 时）
- [x] Job 完成：语段更新；波形对齐；可编辑
- [x] `desktop.log` 含 `transcribe_stage=save`；无 ERROR

## 取消 / 失败

- [x] 侧车 kill mid-job → 报错；无 SQLite 脏数据（cooperative cancel API 已验；kill 归入 R9 发行 smoke）

## 一致性（抽样）

- [x] 同文件 blocking `/v1/transcribe` vs async 终稿：197 段、首尾时间、首段 text 一致

## 能力矩阵（plan §9）

- [x] 场景 1：预览增长时 scroll/选中不崩
- [x] 场景 2：取消后 persist 语义与转写前一致
- [x] 场景 3：在线 STT 仍 blocking、无 i/N

---

## 签收记录

| 日期 | 样本 | 首段可见(s) | 整 Job(s) | 备注 |
|------|------|-------------|-----------|------|
| 2026-05-31 | 制控.mp3 (~20.8min) | ~23.9 | ~180 | 197 segments；blocking 对照一致；cancel OK；修复 Pydantic ForwardRef bug |

**三轮日志（2026-05-31）**

- **改动**：R3e-C async Job + 120s 窗 preview merge、停止转写、preview 门禁；侧车 Pydantic ForwardRef 修复
- **验证**：制控.mp3 197 段；首段 ~23.9s；blocking ≡ async final；cancel API OK；`npm run test` 绿
- **下一轮**：**R3g-C** C1 Profile 内核 → ACC-STT-UNIFY U1

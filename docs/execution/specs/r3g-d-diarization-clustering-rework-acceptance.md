# Acceptance：R3g-D 聚类重构

> **状态**：DC1–DC2 已执行；**Partial Go**（2026-08-13 拍板：8 人可用）；DC0/DC3 等用户金标
> **Research**：[`r3g-d-diarization-clustering-rework-research.md`](./r3g-d-diarization-clustering-rework-research.md)
> **Intent**：[`r3g-d-diarization-clustering-rework-intent.md`](./r3g-d-diarization-clustering-rework-intent.md)
> **Plan**：[`r3g-d-diarization-clustering-rework-plan.md`](./r3g-d-diarization-clustering-rework-plan.md)
> **前序 Acceptance**：[`r3g-d-speaker-diarization-acceptance.md`](./r3g-d-speaker-diarization-acceptance.md)（§3 spike 门禁继续有效，本页只加聚类质量门禁）

## 1. 最终判定

| 判定 | 条件 |
|---|---|
| **Go** | 用户金标上 DER / confusion 达标 + §4 可见性全过 + §6 机器守卫全绿 |
| **Partial Go** | 碎片清零、说话人数为个位数且用户接受可用；金标或 DER 尚未取得。能力保持默认关闭 |
| **Defer** | 再次出现大量单段碎片（roster 不可用），或金标证明系统性误合 |
| **No-go** | 放宽后合成双人样例误合，且无参数组合可同时满足双向门禁 |

判定结果：**Partial Go**（2026-08-13 拍板）

## 2. 反例收敛门禁（本次核心）

对象：`20260712-师资部会议-惟海法师-节选`（33 分钟，重构前 `run_id = e4645848b22c4b82b3d7dfb89a86504c`，20 个说话人）。

| 指标 | 门禁 | 重构前实测 | 重构后（DC1+DC2） | 判定 |
|---|---|---|---|---|
| 说话人数 | **个位数**（不以 3–6 为硬门禁；用户拍板 8 人可用） | 20 | **8** | ✅ |
| 非 dominant 语音时长集中度 | 前 4 簇覆盖 **≥90%** | 前 4 簇 97.0%，尾部另有 16 簇 | **94.3%** | ✅ |
| 仅 1 段的说话人数量 | **≤1** | 14 | **0** | ✅ |
| 最短说话人语音时长 | **≥ 生效 floor** | 0.5 s | **9.7 s**（floor 8.0 s） | ✅ |
| 连续发言是否同人 | 金标到位后核对；当前不作为硬失败 | 分属 spk 10/11/12 | 分属 spk 7/4/2 | ⏳ 待金标 |
| 单窗产出说话人数 | 金标到位后核对；当前不作为硬失败 | 窗口 65 为 6、窗口 50 为 5 | 最多 4（窗口 49、52） | ⏳ 待金标 |
| 无归属段 | 0 | 0 | **0** | ✅ |
| clamp warning | 不应触顶 | — | **无**（未达上限 10） | ✅ |

- [x] 重构前后同一音频、同一模型 revision（FunASR 1.3.16 / ModelScope 1.38.1 / CAM++ `iic/speech_campplus_sv_zh-cn_16k-common`）。
- [x] 参数组合：`threshold=0.72`、`min_observation_speech_sec=1.5`、`min_speaker_speech_sec=8.0`（自适应生效值 8.0）、`max_speakers=10`、`absorb_floor=0.20`。
- [x] warnings 实测：`speaker_small_clusters_absorbed:count=4:speech_sec=15.65`，无 clamp、无 center 缺失。
- [ ] **口径说明**：重构后数据取自侧车 `/v1/transcribe` 原始响应；重构前数据取自 SQLite（已过 Rust 端 `sanitize_segments_for_media` / overlap trim）。**说话人数可比**（同一 Python 聚类阶段产出），段数与总语音时长不可直接比。

### 2.1 中等簇 cannot-link（金标前冻结）

小簇回收对**碎片**有效（14 个单段说话人清零）。越过 floor 的中等簇仍被阶段 1 cannot-link 钉住——这在「样例本就约 8 人」的前提下**可能是正确行为**，也可能仍在拆同一人。2026-08-13 拍板：**金标到位前不绕过 cannot-link、不调高 floor。**

| spk | 语音秒 | 跨窗数 | 与 spk2 共窗数 |
|---|---:|---:|---:|
| 2（dominant） | 1274.2 | 51 | — |
| 7 | 256.4 | 16 | 3 |
| 8 | 104.9 | 11 | 1 |
| 5 | 55.8 | 6 | 4 |
| 6 | 45.8 | 5 | 3 |
| 4 | 28.7 | 5 | 5（全部） |
| 1 | 18.6 | 3 | 1 |
| 3 | 9.7 | 7 | 2 |

spk4 的 5 个窗口全部与 dominant 共窗，故无法并入 spk2，又高于 8 秒 floor，不会被回收。是否该并，等金标。

## 3. 双向回归（防止只把碎片压掉而误合）

| 样例 | 门禁 | 结果 |
|---|---|---|
| 130 秒合成双人跨窗（既有） | DER 不劣化超过 **3 个百分点**（基线 6.83%），仍正确得到 2 人 | 待填 |
| 9.027 秒合成双人无停顿（既有） | 不得比现状更差（现状已欠分为 1 人） | 待填 |
| 真实单人 3–5 分钟（DC0 新增） | 除 dominant 外其余簇合计语音 **≤5%**；不得出现第二个 ≥5% 的 speaker | 待填 |
| 真实三人轮换 5–8 分钟（DC0 新增） | 说话人数 = 3；DER median ≤25% | 待填 |
| 真实会议讨论段 5 分钟（DC0 新增） | DER 记录并作为后续基线 | 待填 |

- [ ] 小簇回收带来的 **confusion 增量已量化并书面接受**（不得只报说话人数变好看）。
- [ ] 标定网格记录在案：每组参数的 DER / confusion / 说话人数。
- [ ] 真实金标 fixture 可被 [`scripts/eval-diarization.py`](../../../scripts/eval-diarization.py) 读取，评分协议仍为 `collar=0.25s`、`skip_overlap=True`、最优 label permutation。

**金标交付（用户后续提供）**：在应用内把说话人改派正确后保存即可。交付时说明文件名 / `file_id`，以及是否只标了讨论段。我从 SQLite `segments.speaker_id` + `file_speakers.display_name` 导出评分 fixture，不必另做表格。

## 4. 可见性与 warnings 贯通

- [ ] `speaker_count_clamped:from=N:to=M` 在超上限时产生，未超上限时不产生。
- [ ] Rust [`save.rs`](../../../apps/desktop/src-tauri/src/project/run_transcribe_cmd/save.rs) 读取并透传 `diarization.warnings`（重构前**被丢弃**）。
- [ ] [`asrTranscribeHints.ts`](../../../apps/desktop/src/services/asrTranscribeHints.ts) 把 clamp 与 center 缺失转成用户可读提示，有单测锁定文案。
- [ ] 小簇回收**不产生**用户提示（只记 warning）。
- [ ] 未新增 Tauri 命令、DTO 字段、SQLite 列或 UI 面（契约零变更）。

### 能力—UI 状态矩阵

| 状态 | 数据源 | 期望 UI | 结果 |
|---|---|---|---|
| 结果可信 | `status=final`，无 clamp / center 缺失 | 正常 roster，无提示 | 待填 |
| 说话人数触顶 | `warnings` 含 `speaker_count_clamped:*` | 提示需人工核对 | 待填 |
| center 大量缺失 | `warnings` 含多条 `speaker_center_missing:*` | 提示可信度下降 | 待填 |
| 小簇被回收 | 内部 warning | 无用户提示 | 待填 |
| 能力关闭 | 设置偏好 | 行为与今日一致 | 待填 |

- [ ] 禁止用 `/health.ready_for_transcribe` 代替上述任一状态（[能力—UI 对齐](../../architecture/desktop-capability-ui-state-alignment.md)）。

## 5. 算法单测

- [ ] dominant 簇不再因窗口并集永久锁死碎片（针对根因 1 的定向用例）。
- [ ] 短于 `min_observation_speech_sec` 的 observation 不独立成簇，且最终被分配（不留 null）。
- [ ] 自适应门槛 `min(cfg, max(2.0, 0.1 × 总语音))` 在短录音上不吃光全部簇。
- [ ] 无大簇时把最大簇提升为唯一簇，结果非空。
- [ ] 相似度低于 `absorb_floor` 时仍吸收并记 warning，不产生孤儿说话人。
- [ ] 超 `max_speakers` 时按最小簇优先吸收至上限，且**不得**并入 `spk0`。
- [ ] 阶段 1 的同窗 cannot-link 仍生效（真实两人同窗不被凝聚阶段误合）。
- [ ] 关闭 diarization 时 `strip_speaker_ids` 路径与今日一致。

## 6. 机器守卫与平台

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

- [ ] 上述四项全绿。
- [ ] `services/asr` pytest 全绿，`speaker_diarization` 相关覆盖率不低于重构前。
- [ ] `cargo test` 全绿（save.rs warnings 透传有测试）。
- [ ] 既有 ASR 门禁未放宽：CER、segment count 90%–120%、不得退化为 whole-track fallback。
- [ ] macOS arm64 源码侧车实测；Windows 与冻结产物**若未取得须明确写出**。

## 7. 手测主路径

- [ ] 反例文件重跑，roster 收敛且可改名、可改派。
- [ ] 关闭「区分说话人」重跑，结果与今日一致、无 speaker 列。
- [ ] 人为把 `RUSHI_FUNASR_SPK_MAX_SPEAKERS` 调至 2 制造触顶，确认用户提示出现。
- [ ] 改名、改派后保存重开与项目包往返不丢失（回归前序 D4/D5 能力）。

## 8. 结果摘要（执行后填写）

| 项 | 结论 |
|---|---|
| Go / Partial / Defer / No-go | **Partial Go**（2026-08-13 拍板）：20→8、碎片清零、8 人可用；能力默认关闭。转 Go 等用户金标 |
| 反例说话人数（前 → 后） | **20 → 8**；单段说话人 14 → 0；单窗最多 6 → 4 |
| 最终参数组合 | `threshold=0.72` / `min_obs=1.5` / `min_speaker=8.0` / `max_speakers=10` / `absorb_floor=0.20`（金标前不重标） |
| 合成双人 DER（前 → 后） | 未复测（DC3）；单测已锁「同窗真实两人不被误合」 |
| confusion 增量与书面取舍 | **未量化**，等用户金标 |
| 残余风险 | ① 中等簇 cannot-link 是否拆了同一人，等金标；② DER 未复测；③ 触顶提示未实机验证 |

## 9. 已完成切片

- [x] **DC1**：`max_speakers` 上限与 clamp warning；`save.rs` 透传 `diarization.warnings`（原被丢弃，per-window center 缺失折叠为计数）；`asrTranscribeHints.ts` 两条提示分支 + 3 条单测。
- [x] **DC2**：observation 准入、无约束小簇就近吸收、自适应 floor、无大簇提升最大簇、`absorb_floor` 兜底 warning；8 条新单测。
- [ ] **DC0**：真实金标由用户后续提供。
- [ ] **DC3**：等 DC0。
- [x] **DC4**：本页判定改为 Partial Go；路线图同步。

机器守卫（2026-08-13 实测）：ASR pytest 184 passed / 2 skipped；`cargo test` 573 passed；`npm run typecheck` 通过；`npm run test` 2643 passed；`npm run lint` 0 error / 37 既有 warning；architecture guard exit 0。

**变更记录**

| 日期 | 说明 |
|---|---|
| 2026-08-13 | 初版：随 Research / Intent / Plan 三件套建立，门禁以 33 分钟真实会议反例为核心 |
| 2026-08-13 | DC1+DC2 落地：说话人数 20 → 8，碎片清零 |
| 2026-08-13 | 用户拍板：样例可能本就约 8 人、8 人可用、金标后续提供。判定改为 **Partial Go**；cannot-link 放宽冻结 |

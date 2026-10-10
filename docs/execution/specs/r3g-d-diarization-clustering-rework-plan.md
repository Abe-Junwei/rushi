# Plan：R3g-D 聚类重构

> **状态**：待确认后实施
> **Research**：[`r3g-d-diarization-clustering-rework-research.md`](./r3g-d-diarization-clustering-rework-research.md)
> **Intent**：[`r3g-d-diarization-clustering-rework-intent.md`](./r3g-d-diarization-clustering-rework-intent.md)
> **Acceptance**：[`r3g-d-diarization-clustering-rework-acceptance.md`](./r3g-d-diarization-clustering-rework-acceptance.md)
> **被取代**：本文 §1 取代 [`r3g-d-speaker-diarization-plan.md`](./r3g-d-speaker-diarization-plan.md) §3.1；该文其余部分继续有效
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3g-D**

## 0. 最终落地结论

在现有 [`speaker_diarization.py`](../../../services/asr/rushi_asr/speaker_diarization.py) 内把单阶段约束凝聚聚类改为**三阶段**：约束凝聚 → 无约束小簇回收 → 上限钳制。取 pyannote 的小簇剪枝重分配与 3D-Speaker 的上限参数，**不引入任何新依赖**。同时把 `diarization.warnings` 从 Python 贯通到用户提示（当前在 Rust 边界被丢弃）。

## 1. 目标算法

### 1.1 三阶段

输入仍为 `_observations()` 产出的 `(window_index, local_id, center, duration, first_seen)`。

**阶段 1 — 约束凝聚（保留现有语义，仅收窄参与者）**

1. `duration < min_observation_speech_sec` 的 observation **不参与建簇**，暂存待阶段 2 分配。理由：CAM++ 在极短语音上 center 不可靠，让它自立门户是当前 14 个单段说话人的直接来源。
2. 其余 observation 按现有方式凝聚：贪心取最大 cosine，`>= threshold` 才合并，同窗 cannot-link 仍生效且合并后窗口集合仍取并集。**此处不放宽**——约束传播本身是正确的受约束聚类。

**阶段 2 — 无约束小簇回收（新增，本次修复主力）**

3. 计算每簇加权语音时长。`duration >= min_speaker_speech_sec` 的为**大簇**；其中 `min_speaker_speech_sec` 取 `min(配置值, max(2.0, 0.1 × 全文可评分语音时长))`，避免短录音被门槛吃光（借 pyannote `clustering.py:364-367` 的自适应启发式）。
4. 若无任何大簇，则把时长最大的簇提升为唯一大簇，保证结果非空。
5. 小簇与阶段 1 暂存的短 observation，**按 cosine 就近并入大簇，且忽略 cannot-link 与窗口约束**（对齐 pyannote `clustering.py:462-481`）。这一步是安全网：它使窗内 local `spk` 的过度拆分可被回收，而阶段 1 的约束仍能防止真正的两人在窗内被误合。
6. 就近相似度低于 `absorb_floor`（远低于 threshold 的兜底值）时仍并入最近大簇，但记 warning；不得留下第二类「孤儿说话人」。

**阶段 3 — 上限钳制（新增）**

7. 大簇数超过 `max_speakers` 时，反复把时长最小的簇并入其最近簇，直到等于上限；写 warning `speaker_count_clamped:from=N:to=M`。**不得**静默截断，**不得**把溢出项并入 `spk0`。
8. 最终簇按全文首次出现时间排序，生成 run-scoped opaque ID 与 ordinal（与现状一致）。

### 1.2 与现有实现的差异

| 现状（`speaker_diarization.py`） | 改为 |
|---|---|
| `_cluster_observations:159-162` 每个 observation 无条件建簇 | 短于 `min_observation_speech_sec` 者不建簇，暂存 |
| 凝聚结束即为最终结果 | 凝聚后增加阶段 2 / 3 |
| 无最小簇门槛、无小簇回收 | 新增大簇判定与无约束就近吸收 |
| 无 `max_speakers` | 新增上限与钳制 warning |
| `warnings` 仅 center 缺失与 local id 泄漏（`:238-248`） | 增加 clamp、低相似度吸收两类 |

### 1.3 默认值（DC3 前为起点，非终值）

| 常量 | 起点 | 依据 | 环境覆盖 |
|---|---|---|---|
| `DEFAULT_SIMILARITY_THRESHOLD` | `0.72`（**待重标**） | 现值由 130 秒合成样例标定，不可迁移 | `RUSHI_FUNASR_SPK_SIMILARITY_THRESHOLD`（已有） |
| `DEFAULT_MIN_OBSERVATION_SPEECH_SEC` | `1.5` | CAM++ 短语音不可靠；3D-Speaker subsegment 量级 | `RUSHI_FUNASR_SPK_MIN_OBS_SPEECH_SEC` |
| `DEFAULT_MIN_SPEAKER_SPEECH_SEC` | `8.0` | 3D-Speaker `min_cluster_size=4` × 约 1.5–2 秒 subsegment | `RUSHI_FUNASR_SPK_MIN_SPEAKER_SPEECH_SEC` |
| `DEFAULT_MAX_SPEAKERS` | `10` | 介于 NeMo meeting `8` 与 3D-Speaker `15` | `RUSHI_FUNASR_SPK_MAX_SPEAKERS` |
| `DEFAULT_ABSORB_FLOOR` | `0.20` | 仅兜底，防止孤儿簇 | `RUSHI_FUNASR_SPK_ABSORB_FLOOR` |

常量与读取放 [`defaults.py`](../../../services/asr/rushi_asr/defaults.py)（该文件已是 `RUSHI_FUNASR_*` 读取真源），`speaker_diarization.py` 只消费。

### 1.4 预期效果（可先验校验）

对反例文件推演：低于 8 秒 floor 的碎片被吸收。实测 **20 → 8 人**（2026-08-13）。用户拍板：该样例可能本就约 8 人，**8 人可用**；不以 3–4 / 3–6 为硬目标。金标到位前**不**绕过 cannot-link、**不**调高 floor。

## 2. warnings 贯通（契约不变）

现状：Python 已产出 `diarization.warnings`；TS 契约 [`transcription.ts:50-55`](../../../apps/desktop/src/contracts/transcription.ts) 已有该字段；但 Rust [`save.rs:88-99`](../../../apps/desktop/src-tauri/src/project/run_transcribe_cmd/save.rs) 只读 `status` 与 `run_id`，**warnings 被丢弃**，UI 因此永远看不到。

改法：`save.rs` 读取 `diarization.warnings`，合入已存在的 `warnings: &mut Vec<String>` 通道；[`asrTranscribeHints.ts`](../../../apps/desktop/src/services/asrTranscribeHints.ts) 增加分支把 `speaker_count_clamped:*` 与 `speaker_center_missing:*` 转成用户可读提示。**不加 Tauri 命令、不加 DTO 字段、不加 UI 面。**

用户提示口径：仅在**说话人数触顶**或**大量 center 缺失**时提示（属结果可信度问题）；小簇回收属正常运作，只记 warning 不打扰用户。

## 3. 执行切片

### DC0：真实金标（0.5–1 人日，含用户标注）

- 三份真实录音：单人 3–5 分钟、三人轮换 5–8 分钟、本次会议讨论段 5 分钟。
- **标注工具复用 D4 已有改派 UI**：在应用内把说话人改对，导出 user-corrected 结果作为金标，转成 `scripts/eval-diarization.py` 可读的 speaker-time 格式；不新建标注工具。
- 另设**全长廉价指标**（不需逐段标注）：说话人数、非 dominant 语音时长分布——用于 33 分钟整文件把关。
- 验证：`scripts/eval-diarization.py` 能读入新 fixture 并算出 DER。

### DC1：上限与可见性（0.5–1 人日）

- `defaults.py` 加常量与环境覆盖；`speaker_diarization.py` 实现阶段 3 与 clamp warning。
- `save.rs` 透传 warnings；`asrTranscribeHints.ts` 加提示分支。
- 验证：RED/GREEN 覆盖「超上限钳制并 warning」「未超上限不 warning」「warning 抵达 hints」。

### DC2：小簇回收（1–1.5 人日）

- 实现阶段 1 的 observation 准入与阶段 2 的无约束就近吸收、自适应门槛、空结果保护、`absorb_floor` 兜底。
- 验证：RED/GREEN 覆盖「dominant 簇不再因窗口并集锁死碎片」「短 observation 不独立成簇」「无大簇时提升最大簇」「低相似度仍吸收并 warning」。

### DC3：真实标定与双向回归（1–2 人日）

- 在 DC0 金标上网格标定 `threshold` / `min_speaker_speech_sec` / `min_observation_speech_sec`，记录每组的 DER、confusion、说话人数。
- **双向门禁**：同一组参数须同时满足碎片收敛与既有 130 秒合成双人样例不误合（DER 不劣化超 3 个百分点）。
- 量化并书面接受小簇回收带来的 confusion 增量。

### DC4：回写与判定（0.5 人日）

- 回填本文 Acceptance 实测证据；更新 [`spike-results`](./r3g-d-speaker-diarization-spike-results.md) 与前序 [`acceptance`](./r3g-d-speaker-diarization-acceptance.md) §12；路线图 R3g-D 重新判定。
- 收口执行：`npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`，另跑 ASR pytest 与 `cargo test`。

## 4. 能力—UI 状态矩阵（本次新增行）

| 状态 | 数据源 | UI 表现 | 禁止 |
|---|---|---|---|
| 结果可信 | `diarization.status=final` 且无 clamp/center 缺失 warning | 正常显示 roster，无额外提示 | 不因开启 diarization 就提示风险 |
| 说话人数触顶 | `warnings` 含 `speaker_count_clamped:*` | 转写完成提示一句「说话人数超过上限，结果可能不准，请人工核对」 | 不静默交付；不阻断结果落库 |
| center 大量缺失 | `warnings` 含多条 `speaker_center_missing:*` | 提示可信度下降 | 不伪装为正常结果 |
| 小簇被回收 | 内部 warning | **不打扰用户** | 不把正常回收报成错误 |
| 能力关闭 | 用户偏好 | 与今日完全一致 | 不引入任何行为差异 |

数据源分别是 sidecar final response 的 `diarization.warnings` 与设置偏好；禁止用 `/health.ready_for_transcribe` 代替其中任一项。

## 5. TDD 与验证顺序

```text
DC0 真实金标 fixture 可被 eval-diarization 读取
  → RED/GREEN: max_speakers 钳制 + clamp warning
  → RED/GREEN: warnings 贯通 save.rs → asrTranscribeHints
  → RED/GREEN: observation 准入 + 无约束小簇吸收 + 自适应门槛 + 兜底
  → 回归: 130 秒合成双人不误合（双向门禁）
  → 标定: 真实金标 DER / confusion / 说话人数网格
  → asr pytest + cargo test + typecheck + test + lint + architecture guard
  → 手测：反例文件重跑，确认 roster 收敛且无 clamp 提示
```

## 6. 风险与止损

| 风险 | 早期信号 | 止损 |
|---|---|---|
| 放宽后把两人误合 | 合成双人 DER 恶化、confusion 上升 | 提高 `min_speaker_speech_sec` 而非降 threshold；仍不过则只交付 DC1 可见性，聚类保持现状 |
| 小簇回收把真实短插话并错 | confusion 增量大于碎片收益 | 按 DER 净收益决定门槛；必要时只回收 `< min_observation_speech_sec` 的极短项 |
| center 质量 / 中等簇 cannot-link | 金标证明真人被拆或人数明显偏多 | **等用户金标后再决策**；金标到位前不绕过 cannot-link、不调高 floor |
| 真实金标标注成本超预期 | DC0 拖过 1 人日 | 先只做全长廉价指标 + 单人样例，三人样例后置；但**不得**用合成样例替代标定 |
| warnings 提示过噪 | 正常文件也弹提示 | 提示仅限触顶与 center 缺失两类；小簇回收不提示 |
| 改动外溢 | 触及 schema / Tauri 命令 / 新 UI 面 | 本次严格限定 Python 聚类层 + Rust 透传 + hints 分支 |

## 7. 工期与完成定义

| 切片 | 估时 |
|---|---|
| DC0 真实金标 | 0.5–1 人日（含用户标注） |
| DC1 上限与可见性 | 0.5–1 人日 |
| DC2 小簇回收 | 1–1.5 人日 |
| DC3 标定与双向回归 | 1–2 人日 |
| DC4 回写与判定 | 0.5 人日 |
| **合计** | **3.5–6 人日** |

完成必须同时满足：

- 反例文件碎片清零、说话人数为个位数；**8 人视为可用**（2026-08-13 拍板），不以 3–6 为硬门禁。
- 既有 130 秒合成双人样例 DER 不劣化超过 3 个百分点（未误合）。
- 说话人数触顶时用户可见提示已实机验证；关闭 diarization 行为零变化。
- 机器守卫全绿，ASR pytest 与 `cargo test` 通过。
- Acceptance 填入实测证据并作出书面 Go / Partial / Defer 判定。

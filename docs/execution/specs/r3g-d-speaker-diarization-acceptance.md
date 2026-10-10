# Acceptance：R3g-D 本机说话人分离

> **状态**：D1–D5 代码已落地，自动化全绿；D0 判定 Partial Go。**样例集与平台发行证据仍缺**，未达 Go  
> **证据回填日期**：2026-08-12  
> **Research**：[`r3g-d-speaker-diarization-research.md`](./r3g-d-speaker-diarization-research.md)  
> **Intent**：[`r3g-d-speaker-diarization-intent.md`](./r3g-d-speaker-diarization-intent.md)  
> **Plan**：[`r3g-d-speaker-diarization-plan.md`](./r3g-d-speaker-diarization-plan.md)

## 1. 最终判定

| 判定 | 条件 |
|------|------|
| **Go** | D0 全部硬门禁通过；短/长音频、契约/DB/侧车/UI/导出闭环；关闭路径回归；macOS 与 Windows CPU 冻结/发行路径 smoke 通过 |
| **Partial Go** | 单窗质量通过但跨窗或某发行平台未通过；产品在发起前硬限制对应范围并明确说明，不允许“可用但静默串号” |
| **Defer** | DER、单人误拆、center 可用性或平台分发未达标；保留调研和 spike，不向普通用户暴露设置 |
| **No-go** | 必须更换默认引擎/第二套 VAD，或导致 CER/时间轴硬回归且无法隔离 |

最终选择：`Partial Go`（见 [`r3g-d-speaker-diarization-spike-results.md`](./r3g-d-speaker-diarization-spike-results.md)）

阈值如需修改，必须在 spike report 中列出原值、实测值、原因和用户影响，并回写 Research / Plan；不得为通过测试只改 Acceptance。

## 2. 评分协议与样例

- [ ] **未达标** 至少 5 类样例：单人、双人干净、双人跨 120 秒边界、三人轮换、噪声/远场。实际仅 2 类，且均为 CAM++ 官方示例拼接的合成音频（130 秒双人跨窗、9.027 秒双人无停顿）。单人、三人、噪声/远场缺失。
- [ ] **未达标** 多人样例有 RTTM 或等价 speaker-time 金标。实际 truth 由拼接边界推导，不是真实录音标注。
- [x] diarization 主指标使用 `pyannote.metrics` 等价实现的 DER，`collar=0.25s`、`skip_overlap=True`。证据：[`scripts/eval-diarization.py`](../../../scripts/eval-diarization.py) + `services/asr/tests/test_eval_diarization.py`。
- [x] overlap 占比已说明：合成样例按时间顺序拼接，overlap 占比为 0，`skip_overlap` 未掩盖样例构成。
- [x] label permutation 由评分器最优映射。证据：`test_optimal_label_permutation_scores_zero`。
- [ ] **部分达标** 三组对比中「整段单次 CAM++ 参考」（欠分为 1 人，wall 29.19 s）与「分窗 + 全局聚类」已比；**无 CAM++ ASR 基线**未跑同音频对照，因此 CER 增量与 wall 比值无法计算。
- [x] 记录 OS、CPU/GPU、FunASR/CAM++ model revision、阈值与音频时长。证据：spike report §环境与制品。

## 3. D0 Spike 硬门禁

| 指标 | 阈值 | 结果 / 证据 |
|------|------|-------------|
| 双人干净 DER | median ≤ 18%，每条 ≤ 25% | ✅ 6.83%（130 秒合成 clean，单条样例，非 median） |
| 三人 / 远场 DER | median ≤ 25%；超出只能 Partial 且说明范围 | ⛔ **未取得**，无样例 |
| speaker confusion | 双人干净 median ≤ 12% | ✅ 0.02% |
| speaker coverage | 可评分非重叠 speech 中 `speaker_id` 非空 ≥ 95% | ❌ **93.19%，未过**（主因 VAD 边缘空隙） |
| 单人误拆 | 除 dominant speaker 外，其余 cluster 合计 speech duration ≤ 5%；不得产生第二个 ≥5% speaker | ⛔ **未取得**，无单人样例。反向已知风险：9.027 秒无停顿双人被欠分为 1 人 |
| 跨窗增量 | windowed DER ≤ 同音频整段参考 DER + 3 个百分点 | ✅ 分窗优于整段参考（整段欠分为 1 人，分窗正确得到 2 人） |
| 跨窗连续性 | 所有边界 fixture 中，跨边界回归的同一真人 final ID 一致 | ✅ 5 窗 ID 一致 |
| D3 content CER | ≤ 无 CAM++ baseline + 0.02（绝对比率） | ⛔ **未取得**，未跑无 CAM++ 同音频基线 |
| segment count / mode | 90%–120%；不得退化为 whole-track fallback | ✅ `transcribe_windowed`，无 whole-track fallback |
| wall / RTFx | wall ≤ baseline 1.35×，否则只能书面 Partial/默认关 | ⛔ 实测 17.02 s / RTFx 7.64×；**baseline 缺失，比值未计算** |
| peak RSS | 记录实测和相对增量；不得触发目标平台 OOM | ⛔ **未记录** |
| 模型制品 | 记录实际大小、revision、manifest/hash；不得再写“约 7 MB” | ✅ `campplus_cn_common.bin` 28,036,335 bytes；SHA-256 `3388cf5f…6d5ada8` |
| macOS / Windows | macOS arm64 + Windows CPU 源码 smoke 均通过；冻结 smoke 最迟 D5 通过 | ⚠️ macOS arm64 源码 ✅；**Windows CPU 源码、macOS/Windows 冻结均未取得** |

- [x] `return_spk_center=True` 的 center 与 local `spk` 映射已用测试锁定。证据：`test_speaker_centers_accepts_matrix_and_normalizes`，加 spike 中 5 窗真实运行。
- [x] per-request disable 的真实性能行为已验证：cache/load key 与 request 分离，关闭时不解析、不加载 CAM++。
- [x] `r3g-d-speaker-diarization-spike-results.md` 已写并链接本页。
- [x] `_row_text` 不再把 `spk` 当作正文。证据：`test_sentence_info_reads_speaker_and_never_uses_it_as_text`。

## 4. 跨窗与异步正确性

- [x] 同窗两个不同 local speaker 有 cannot-link 测试。证据：`test_same_window_speakers_are_hard_cannot_link`。
- [x] 同一 speaker 离开多个窗口后再次出现，仍能通过 center 聚为同一 final ID。证据：`test_cross_window_clusters_same_voice_and_keeps_run_scoped_ids`。
- [ ] **未覆盖** 2 秒 overlap 只作 tie-breaker；无移除文本后的对照测试。
- [x] center 缺失不默认为 `spk0`。证据：`test_multi_window_missing_center_yields_null_not_local_label`、`test_single_window_without_center_can_use_local_recording_labels`。
- [ ] **仅实现未测** async preview 的 `speaker_id` 恒 null。实现见 `transcribe_job.py` preview delta 分支；缺针对性单测。
- [x] final 结果一次性带 `diarization.status=final`、run id、speaker count。证据：`test_requested_diarization_never_falls_back_to_fake_success`、`run_transcribe_cmd/save.rs` 要求 final 必带 `run_id`。
- [ ] **未覆盖** cancel / failed job 不覆盖旧 segments、run id 或 roster。现有 `disabled_retranscribe_clears_run_and_roster_atomically` 覆盖的是「关闭后重转写」，不是取消/失败路径。
- [x] offset、overlap trim、sort 均保留 final `speaker_id`。证据：`test_offset_and_trim_preserve_final_speaker_id`。
- [x] diarization job 强制短窗。证据：`test_diarization_job_forces_short_windows`、`test_diarization_window_sec_defaults_to_empirical_safe_slice`。

## 5. 契约、数据库与项目包

- [x] Python `TranscriptionSegment.speaker_id` optional；旧 JSON 缺字段可读。证据：`schemas.py` + `pytest` 全绿。
- [x] Rust / TS 契约为 additive optional/null；手工 DTO literal 与转换点全部更新。证据：`cargo test` 573 项、`tsc --noEmit` 全绿。
- [ ] **仅实现未测** migrations 可重复运行。实现见 `db/migrations/speakers.rs::migrate_speaker_diarization`；缺幂等性专测。
- [x] 打开旧数据库、旧文件：speaker 全 null 不崩溃。证据：`segment_cmd_tests.rs` 无 diarization 分支用例 + 既有 573 项回归。
- [x] save/reload 保留 segment speaker、run id、ordinal 和 display name。证据：`diarization_save_reload_and_manual_edit_preserve_roster`。
- [x] file copy 保留 roster；delete 通过 FK cascade 清理。证据：`cmd_integration_tests.rs` copy 用例、`speaker_crud_reassign_and_file_cascade`。
- [x] 项目包 export/import 往返保留 speaker 与 `diarization_run_id`。证据：`project_bundle_cmd_tests.rs`。
- [x] `segmentsEqualForPersist` 纳入 `speaker_id`，改派触发 dirty/save。证据：`segmentListHelpers.test.ts::speaker changes participate in dirty equality`。
- [x] 关闭 diarization 后重转写原子清空 run/roster。证据：`disabled_retranscribe_clears_run_and_roster_atomically`。
- [ ] **部分达标** 重转写前提示。`AutoTranscribeStartDialog` 为**静态**说明文案（“重新转写会生成新分组，已有姓名需重新确认”），不是「检测到非空 `display_name` 才弹出」的条件式确认。Plan §2.3 第 1 条未按原设计实现。

## 6. Sidecar、准备与能力状态

- [x] 设置关：CAM++ 不必存在；全局 `ready_for_transcribe` 不受影响。证据：`runtime_caps.py` 中 spk 字段与全局 ready 相互独立 + `test_health.py`。
- [x] 设置开、CAM++ 未缓存：返回结构化“组件未准备”，不返回无 speaker 的假成功。证据：`test_requested_diarization_never_falls_back_to_fake_success`。
- [ ] **未按原设计实现** 下载 staging → atomic promote。实际为「必需文件清单 + 权重存在性校验」（`DEFAULT_SPK_REQUIRED_FILES`、`verify_speaker_model_artifact`），走 ModelScope 缓存目录，无独立 staging 与原子 promote 步骤。
- [x] 人为删除模型必需文件后判为“不完整”而不是“已缓存”。证据：`test_speaker_cache_requires_real_campplus_artifacts`。
- [ ] **未实现** 设置开、已缓存但侧车未加载时的“配置待应用”UI 态。代码内无该状态文案，能力—UI 矩阵第 3 行缺失。
- [x] 请求 true、模型已加载：transcribe 产出 final speaker。证据：spike 真实运行 5 窗。
- [x] 请求 false：结果 `disabled` 且无 speaker，且不加载 CAM++。证据：`test_transcribe.py` + spike。
- [x] health/caps 分别暴露 `funasr_spk_model_cached` / `funasr_spk_model_loaded` / `funasr_spk_model_id`，不复用全局 ready。证据：`test_health.py:68-70`。
- [ ] **未验证** local token、unload、cancel、sidecar restart 的 diarization 回归。`prepare_speaker_model` 已接 local token，但无对应测试或手测记录。

## 7. 文稿 UI 与编辑

- [x] final 且 speaker 非空的行显示 compact chip，null 不显示空壳。证据：`buildTranscriptEditorState.test.ts::round-trips speaker metadata`、`buildTranscriptEditorState.ts:45` 对 null 返回 null。
- [x] 重命名更新 roster，相同 `speaker_id` 的显示同步变化。证据：`speaker_cmd.rs::file_rename_speaker` + `EditorSegmentList.confirmRename` 重载 roster。
- [x] 单段和多选段可改派到已有 speaker；可创建新 speaker。证据：`file_reassign_segments_speaker`、`speaker_crud_reassign_and_file_cascade`、`EditorSegmentList.reassignSelected`/`createAndAssignSpeaker`。
- [x] 筛选支持全部、指定 speaker、未标注，且不修改 segment 数据。证据：`EditorSegmentList.tsx:85-90` 仅过滤索引。
- [x] 拆段两个子段继承 speaker。证据：`segmentListHelpers.test.ts::preserves speaker on split…`。
- [x] 合段同 ID 保留；一个 null 一个非 null 保留非 null。证据：同上测试的 `mergeTwoSegments` 分支。
- [x] 合段两个不同非 null 时必须选择 A/B/不标注，否则抛 `speaker_merge_choice_required`。证据：`segmentListHelpers.test.ts`、`useSegmentMutationController.mergeDelete.test.ts::requires an explicit speaker choice before merging different speakers`。
- [x] rename 支持撤销重做。证据：`confirmRename` 经 `pushExternalHistoryAction` 注册 undo/redo；reassign/split/merge 走既有 segment 历史。
- [x] 对话框使用既有 `compactDialog` 与 token。证据：`SpeakerMergeChoiceDialog.tsx`；`npm run lint` 与架构守卫 0 错误，无硬编码 hex。

## 8. 导出

- [x] TXT / SRT / DOCX 使用同一个 speaker display resolver。证据：三条路径共用 `services/speakerLabels.ts::resolveSpeakerLabel`；DOCX 在 `useExportController.exportDeliveryDocx` 里用同一个 `formatSpeakerPrefixedText` 预置前缀后再交 Rust。测试：`exportFormatters.test.ts::uses one shared speaker resolver for txt switch markers and every srt cue`。
- [x] 有 speaker 时“包含说话人标签”可开关。证据：`useExportController.test.ts::TXT speaker labels can be explicitly disabled`。
- [ ] **部分达标** TXT / SRT 有格式测试；**DOCX 缺 speaker 结构测试**（`export_docx.rs` 全部 fixture 的 `speaker_id` 均为 `None`）。
- [x] speaker 全 null 或选项关闭时输出与当前版本一致。证据：`exportFormatters.ts:55` 在无 `speaker_id` 或未开选项时原样返回；`exportTxt still works` 回归。
- [ ] **未覆盖** roster 中无段的 speaker 不进入导出正文；无针对性用例。

## 9. 能力—UI 状态矩阵

| 场景 | 预期 | 结果 |
|------|------|------|
| 偏好关，CAM++ 未下载 | 正常转写；无 chip；全局 ready 不受影响 | ✅ 自动化（`runtime_caps` 独立字段 + `test_health`） |
| 偏好开，CAM++ 未下载 | 显示准备入口；job 不启动 | ✅ 自动化（`test_requested_diarization_never_falls_back_to_fake_success` + `prepare_speaker_model`） |
| 偏好开，已缓存，侧车未加载 | 显示应用/重启；不伪造 ready | ❌ **未实现**，无“配置待应用”状态 |
| 已加载，job 未请求 | 普通转写，status=disabled | ✅ 自动化（`test_transcribe.py`） |
| 已加载，job 请求，preview | 正文更新，speaker 暂不显示 | ⚠️ 已实现，**无自动化**（`transcribe_job.py` preview 分支） |
| 已加载，job 请求，final | 段上 final ID；可改名/改派 | ✅ 自动化 + spike 真实运行 |
| job 取消/失败 | 旧数据不变，错误可解释 | ⚠️ **未验证**，无取消/失败路径用例 |
| 旧项目无 speaker 数据 | 正常打开与导出 | ✅ 自动化（573 项 Rust 回归 + `exportTxt still works`） |

## 10. 自动化与平台证据

2026-08-12 实测（全部在 macOS arm64 本机执行）：

| 命令 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run test` | ✅ 468 文件 / 2640 用例 |
| `npm run lint` | ✅ 0 error（37 warning 均为既有存量） |
| `node scripts/check-architecture-guard.mjs` | ✅ **0 错误**，62 warning 为既有热点 |
| `cargo test`（src-tauri） | ✅ 573 用例 |
| `pytest`（services/asr） | ✅ 178 用例 |

- [x] Python：schema / CAM++ 缓存校验 / center mapping / constrained clustering / 短窗 / offset-trim 保留。`test_speaker_diarization.py`（5）、`test_eval_diarization.py`（2）、`test_model_prepare_cache.py`、`test_transcribe_windows.py`、`test_transcribe_job.py`、`test_funasr_engine.py`、`test_health.py`。
- [x] Rust：DTO / save-load / copy-cascade / bundle / 关闭态重转写。`segment_cmd_tests.rs`、`speaker_cmd.rs` 内联测试、`cmd_integration_tests.rs`、`project_bundle_cmd_tests.rs`。
- [x] TypeScript：contract / dirty signature / chip resolver / split-merge。`segmentListHelpers.test.ts`、`buildTranscriptEditorState.test.ts`、`useSegmentMutationController.mergeDelete.test.ts`。
- [ ] **部分** Export：TXT / SRT 已测；**DOCX speaker 结构测试缺失**。
- [ ] **缺** migration 幂等、async preview null、取消/失败保留旧数据、overlap tie-breaker、筛选、roster 无段不导出 六项针对性用例。
- [ ] **未取得** macOS arm64 冻结 smoke（仅源码侧车）。
- [ ] **未取得** Windows x64 CPU 源码与冻结 smoke，含“不完整模型 → 识别 → 修复 → warmup”。

### 命令注册链路（2026-08-12 补齐）

三个新命令 `file_create_speaker` / `file_rename_speaker` / `file_reassign_segments_speaker` 原先只注册在 `lib.rs` 的 `generate_handler!`，下游两层缺失，架构守卫报错：

- [x] `app_commands.rs` 的 `APP_COMMANDS` 清单已补。
- [x] `permissions/project.toml` 域分组 ACL 已补三条 `allow-file-*-speaker`。
- [x] `permissions/autogenerated/` 三个单命令 toml 已由 build.rs 生成（此前从未生成，会导致运行时 invoke 被 ACL 拦截而单测全绿）。

## 11. 手测主路径

> **状态（2026-08-12）**：以下 8 条**均未执行**，无手测记录。转 Go 前必须逐条跑通并回填结果。

1. 偏好关、模型不存在：单人录音正常转写，结果与升级前一致。
2. 打开能力：完成 CAM++ 准备与应用；多人短音频 final 后出现 speaker chip。
3. 重命名“说话人 1”为姓名，将一条错分段改派给“说话人 2”，保存重开。
4. 拆段、同 speaker 合段、不同 speaker 合段并分别选择 A/B/不标注；撤销重做。
5. 导出 TXT/SRT/DOCX，比较包含/不包含 speaker；确认全 null 文件无格式变化。
6. 130 秒以上 async：预览阶段无跳号 chip，final 后跨边界同人 ID 一致。
7. 有自定义姓名时全文重转写：取消不改旧数据；确认并成功后生成新 run 和新 roster。
8. Windows 手工制造 CAM++ 缺文件：应用识别为不完整，重新准备后可用。

## 12. 结果摘要（执行后填写）

| 项 | 结论 |
|----|------|
| Go / Partial / Defer / No-go | **Partial Go**（2026-08-13：聚类重构 DC1+DC2 后 20→8 人、碎片清零；用户拍板 8 人可用。能力默认关闭。转 Go 等金标，见 [`clustering-rework-acceptance`](./r3g-d-diarization-clustering-rework-acceptance.md)） |
| 实测 DER / confusion / 单人误拆 | DER 6.83%、confusion 0.02%（单条 130 秒合成双人）；单人误拆**无样例未测** |
| 默认开关策略 | 默认关；`AutoTranscribeStartDialog` 标注“区分说话人（实验）” |
| CAM++ 分发 | 按需下载，不入安装包；`iic/speech_campplus_sv_zh-cn_16k-common`，权重 28,036,335 bytes，SHA-256 `3388cf5f…6d5ada8` |
| 跨窗阈值 / max speakers | cosine `0.72`，同窗 hard cannot-link；diarization 走 30 秒窗 + 2 秒 overlap（普通 ASR 仍用原窗口策略） |
| 支持平台与长度范围 | 仅 macOS arm64 源码侧车已验证；Windows 与冻结产物未验证。长度上仅验证到 130 秒，30 分钟／2 小时样例未跑 |
| 残余风险 | ⓪ 真实金标未交付，8 人是否拆/合仍待证（§12.1）；① coverage 93.19% 未过 95%；② 短而无停顿的多人音频会欠分；③ 合成拼接曾是唯一 DER 依据；④ 无 CAM++ 基线，CER/wall 增量不可计算；⑤ “配置待应用”能力态未实现；⑥ 取消/失败路径未验证；⑦ 峰值 RSS 未记录 |

### 12.1 真实音频（2026-08-12 反例 → 2026-08-13 收敛）

33 分钟真实会议 `20260712-师资部会议-惟海法师-节选` 首次跑出 **20 个说话人**（14 个仅 1 段、最短 0.5 秒、无 warning），据此曾下调为 Defer。DC1+DC2 后同一音频为 **8 人、单段碎片 0**。用户 2026-08-13 拍板：该样例可能本就约 8 人，**8 人可用**。详细数据见 [`clustering-rework-acceptance`](./r3g-d-diarization-clustering-rework-acceptance.md) §2。

### 转完整 Go 的前置条件

0. 用户交付金标后复测 DER / confusion；不以 3–6 为硬门禁。

1. 补齐单人、三人轮换、噪声/远场三类**真实录音** RTTM 金标，并复测 DER / confusion / 单人误拆。
2. 跑无 CAM++ 同音频基线，计算 CER 增量与 wall 比值，记录峰值 RSS。
3. 把 coverage 从 93.19% 提到 ≥95%，或书面接受并改写门槛（须同步回写 Research / Plan）。
4. 实现“配置待应用”能力态，补齐能力—UI 矩阵第 3 行。
5. 补 §10 列出的六项缺失用例与 DOCX speaker 结构测试。
6. 跑通 macOS/Windows 冻结 smoke 与 §11 全部 8 条手测。

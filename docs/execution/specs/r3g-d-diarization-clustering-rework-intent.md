# Intent：R3g-D 聚类重构 — 让真实会议音频的说话人数可用

> **状态**：DC1–DC2 已实施；Partial Go（8 人可用）；DC3 等用户金标
> **Research**：[`r3g-d-diarization-clustering-rework-research.md`](./r3g-d-diarization-clustering-rework-research.md)
> **Plan**：[`r3g-d-diarization-clustering-rework-plan.md`](./r3g-d-diarization-clustering-rework-plan.md)
> **Acceptance**：[`r3g-d-diarization-clustering-rework-acceptance.md`](./r3g-d-diarization-clustering-rework-acceptance.md)
> **前序**：[`r3g-d-speaker-diarization-intent.md`](./r3g-d-speaker-diarization-intent.md)（产品语义与非目标继续生效，本文只收窄聚类质量）
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3g-D**（2026-08-13 聚类重构 Partial Go）

## 目标

修复 run 级聚类在真实多人会议音频上的过度分簇，使 33 分钟会议这类样例的说话人数落在个位数且与真人数量同量级；并在结果不可信时**必须**给出用户可见提示，不再静默交付。不改产品语义、不改契约字段、不引入新依赖、不改默认关闭策略。

## 用户结果

- 真实会议转写完成后，roster 里是「几个人」而不是几十个碎片，用户改名后即可逐段核对。
- 极短的应答词（「嗯」「对对对」）不再各自占据一个说话人条目。
- 当算法自己判断结果不可信（说话人数触顶、大量碎片被回收）时，用户在转写完成提示里能看到一句可理解的说明。
- 关闭「区分说话人」时行为与今天完全一致。

## 问题依据

33 分钟真实会议 `20260712-师资部会议-惟海法师-节选` 重构前分出 **20 个说话人**（14 个仅 1 段、最短 0.5 秒、无 warning）。DC1+DC2 后为 **8 人、无单段碎片**。用户 2026-08-13 拍板：该样例可能本就约 8 人，**8 人可用**；真人数量以后续金标为准。详见 [Research §1.1](./r3g-d-diarization-clustering-rework-research.md#11-实测反例可复现)。

## 范围

1. **DC0 真实金标**：用户标注后提供（不阻塞 DC1/DC2）。建议用已有改派 UI；格式见 Acceptance §3。
2. **DC1 上限与可见性**：实现 `max_speakers` 上限与超限 warning，并把 `diarization.warnings` 从 Python 贯通到用户提示（当前在 Rust 边界被丢弃）。
3. **DC2 小簇回收**：引入最小说话时长准入与**无约束**小簇重分配，回收碎片。
4. **DC3 真实标定与双向回归**：在真实金标上重新标定阈值与门槛，同时验证不因放宽而误合两人。
5. **DC4 回写与判定**：回填 Acceptance 实测证据，重新作出 Go / Partial / Defer 书面判定。

## 核心语义

- `speaker_id` 仍是 run 内 opaque 聚类键，本次不改其含义、不改 `display_name` 分离、不改重转写产生新 run 的规则。
- **说话人上限是安全护栏，不是准确性手段**。触顶只允许「钳制并 warning」，不允许静默截断，也不允许把溢出项并入 `spk0`。
- **小簇回收是有意的精度取舍**：把短碎片并入最近的大簇，用少量 confusion 换取 roster 可用。该取舍必须由 DER 证明净收益，不能只看说话人数变好看。
- 窗内 local `spk` 从此被视为**不可靠先验**：它只在凝聚阶段作约束，不得阻断小簇回收阶段。

## 非目标

- 不引入 pyannote / NeMo / 3D-Speaker 运行时依赖，不 fork 第二套 VAD 或分段真源。
- 不改 `speaker_id` / `diarization_run_id` / `file_speakers` 契约与 SQLite schema。
- 不新增用户设置项，不要求用户填写预计人数（spike 已证 `preset_spk_num` 不可靠）。
- 不做重叠语音多标签、跨文件声纹身份、说话人色轨。
- 不通过只调 `DEFAULT_SIMILARITY_THRESHOLD` 交差——该阈值无法修复主要错误类别。
- 不改默认关闭与「实验」标签；本次不申请转默认开启。

## 约束

- 仅改 `services/asr/rushi_asr/speaker_diarization.py` 及其默认值；Rust 侧只做 warnings 透传，不加字段。
- 用户提示复用 [`asrTranscribeHints.ts`](../../../apps/desktop/src/services/asrTranscribeHints.ts) 既有「warnings → 提示」真源，不新建 UI 面。
- 阈值、最小时长、上限**必须**由真实音频标定；合成拼接样例不得作为唯一依据。
- 放宽约束后必须回归既有合成双人样例，证明未把两人误合（双向门禁）。
- 关闭 diarization 时不得有任何行为与性能变化；不得放宽既有 ASR CER / segment count 门禁。

## 决策原则

1. **先可见再变准**：DC1 让不可信结果暴露出来，优先于把结果调准。
2. **取业内成熟机制，不取其依赖**：复用 pyannote 的小簇剪枝重分配与 3D-Speaker 的上限参数，在本仓聚类层内实现。
3. **双向门禁**：每次放宽都要同时证明「碎片减少」与「未误合」。
4. **真实数据优先**：合成样例只做回归，不做标定。
5. **取舍写在文档里**：小簇回收带来的 confusion 增量必须量化并被书面接受。

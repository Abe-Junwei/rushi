# 调研：R3g-D 聚类重构 — 真实会议音频过度分簇的修复路线

> **状态**：已采纳（DC1–DC2 已落地；DC0/DC3 等用户金标）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 `R3g-D`
> **前序 spec**：[`r3g-d-speaker-diarization-research.md`](./r3g-d-speaker-diarization-research.md) · [`plan`](./r3g-d-speaker-diarization-plan.md) · [`acceptance`](./r3g-d-speaker-diarization-acceptance.md) · [`spike`](./r3g-d-speaker-diarization-spike-results.md)
> **架构真源**：[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（[`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 33 分钟师资部会议录音（前段单人讲授、后段多人讨论）。用户改名后即可逐段核对 |
| 实测结果 | 重构前 **20 个说话人**（14 个仅 1 段、最短 0.5 秒、无 warning）；DC1+DC2 后 **8 人、单段碎片 0**。用户 2026-08-13 拍板：该样例可能本就约 8 人，**8 人可用**；真人数量以用户后续金标为准，不再把「3–4 人」当事实 |
| 本仓现状 | 见 §1.2 链路与文件 |
| 成功标准 | 说话人数为个位数、无单段碎片；超上限必须 warning。**不以 3–6 为硬门禁**（2026-08-13 拍板） |

### 1.1 实测反例（可复现）

文件 `20260712-师资部会议-惟海法师-节选`，`diarization_run_id = e4645848b22c4b82b3d7dfb89a86504c`，2026-08-12 22:01 落库。侧车为源码路径，FunASR 1.3.16 / ModelScope 1.38.1 / CAM++ `iic/speech_campplus_sv_zh-cn_16k-common`，阈值取默认 `0.72`，diarization 窗口 30 秒。

| speaker | 段数 | 语音时长 | 占比 | 跨窗口数 | 窗口范围 |
|---|---:|---:|---:|---:|---|
| 2 | 401 | 1574.5 s | 85.6% | **64 / 66** | 0–65 |
| 5 | 21 | 104.5 s | 5.7% | 6 | 42–49 |
| 13 | 24 | 95.1 s | 5.2% | 10 | 52–64 |
| 其余 17 个 | 合计 25 | 合计约 65 s | 3.5% | 多为 1 | 集中在 48–65 |

关键观测：

1. 472 段全部有归属，`speaker_id` 无 null，管线端到端连通；问题纯在聚类质量。
2. 碎片集中诞生于讨论段。窗口 48–65（1440–1980 秒）产出 20 个里的 16 个；窗口 0–47 的讲授段基本只有 speaker 2。
3. **单窗口内即被拆成多人**：窗口 65 产出 6 个 final speaker（2、16、17、18、19、20），窗口 50 产出 5 个（2、7、8、9、10），窗口 51 产出 4 个。
4. 连续同一人被拆成 3 个：`idx 349/350/351`（1528.6 / 1535.8 / 1537.7 秒）文本为同一人连续发言，却分属 speaker 10、11、12。

### 1.2 本仓现状与根因

链路：`funasr_engine_infer` 取 `sentence_info.spk` 与 `return_spk_center` → `transcribe_windows` 按 30 秒切窗（[`transcribe_windows.py`](../../../services/asr/rushi_asr/transcribe_windows.py) `DEFAULT_DIARIZATION_WINDOW_SEC = 30.0`）→ [`speaker_diarization.py`](../../../services/asr/rushi_asr/speaker_diarization.py) `finalize_speaker_windows` 做 run 级聚类 → 回填 `speaker_id`。

三个根因，按影响排序：

**根因 1 — cannot-link 与窗口并集造成结构性锁死（设计缺陷，非调参）。**
`_cluster_observations`（`speaker_diarization.py:155-183`）在 `left.windows & right.windows` 相交时 `continue` 跳过合并，而 `_merged_cluster` 把 `windows` 取并集（`:150`）。dominant speaker 2 跨 64/66 个窗口，其簇累积了几乎全部窗口号，因此**任何与它同窗出现过的碎片永久无法与它合并**；同窗碎片之间同样互相锁死。

由于 cannot-link 是**不看相似度的硬否决**，调低 `DEFAULT_SIMILARITY_THRESHOLD = 0.72` 在结构上无法修复最大的那一类错误——碎片与 dominant 簇根本走不到比较相似度那一步。

该约束的隐含前提是「FunASR 窗内 local `spk` 可靠」。实测在真实会议短轮次上不成立（窗口 65 自己就拆出 6 个 local speaker），而约束保证该错误不可回收。

**根因 2 — 无最小簇门槛、无小簇重分配。**
`_cluster_observations:159-162` 把每个 observation 无条件初始化为独立簇，0.5 秒的应答词也能自立门户并存活到最终 roster。CAM++ embedding 在 2 秒以下语音上极不稳定。[`plan`](./r3g-d-speaker-diarization-plan.md) §3.1 第 4 条只做了「center 按语音时长加权」，未做**准入门槛**与**小簇回收**。

**根因 3 — `max_speakers` 从未实现。**
[`plan`](./r3g-d-speaker-diarization-plan.md) §3.1 第 7 条要求「超过 `max_speakers`…写 warning；不得静默把未知项并到 `spk0`」。全仓搜索 `max_speaker` 在实现代码中**无任何命中**；`warnings` 仅覆盖 center 缺失与 local id 泄漏（`speaker_diarization.py:238-248`）。因此 20 个说话人静默落库。

**阈值标定来源不可迁移**：`0.72` 由 130 秒**合成拼接**双人样例标定，每人有 40 秒以上连续语音，与真实会议短插话分布差异极大。这也印证了 [`acceptance`](./r3g-d-speaker-diarization-acceptance.md) §12 残余风险第 ③ 条。

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **谱聚类 + 上下限 + 小簇剪枝**（CAM++ 同源官方） | ModelScope **3D-Speaker** `Diarization3Dspeaker` | 自带 VAD → subsegment → CAM++ embedding → **整段一次**谱聚类；`cluster_type='spectral'`、`min_num_spks=1`、**`max_num_spks=15`**、**`min_cluster_size=4`**、`mer_cos=0.8`、`pval=0.012`；支持 `speaker_num` oracle | [`infer_diarization.py`](https://github.com/modelscope/3D-Speaker/blob/main/speakerlab/bin/infer_diarization.py) · [recipe](https://github.com/modelscope/3D-Speaker/tree/main/egs/3dspeaker/speaker-diarization) |
| B | **凝聚聚类 + 小簇剪枝后重分配** | **pyannote.audio 3.1** `AgglomerativeClustering` | cosine + centroid linkage，先 unit-normalize；`min_cluster_size ∈ [1,20]`，**小于门槛的簇被剪枝并按余弦相似度重分配到存活大簇**；启发式 `min_cluster_size = min(cfg, max(1, round(0.1 * N)))`；`min/max/num_clusters` 约束；同 chunk 约束由 `constrained_argmax` 处理；新版默认转向 `VBxClustering` | [`clustering.py`](https://github.com/pyannote/pyannote-audio/blob/main/src/pyannote/audio/pipelines/clustering.py)（剪枝重分配见 `:462-481`，启发式 `:364-367`） |
| C | **自动估计人数的谱聚类（免调阈值）** | **NVIDIA NeMo** NME-SC | Normalized Maximum Eigengap 谱聚类，**自动估计说话人数**、不需要 dev-set 调阈值；`max_num_speakers: 8`（meeting/telephonic 配置）；`enhanced_count_thres: 80` 段数偏低时启用增强人数估计；长音频用 `chunk_cluster_count: 50` 过聚类 + `embeddings_per_chunk` 分块；多尺度窗口 `[1.5,1.25,1.0,0.75,0.5]` 加权 | [`diar_infer_meeting.yaml`](https://github.com/NVIDIA/NeMo/blob/main/examples/speaker_tasks/diarization/conf/inference/diar_infer_meeting.yaml) · [NME-SC](https://github.com/tango4j/Auto-Tuning-Spectral-Clustering) |

### 2.1 三条路线的共同点（对本仓的直接结论）

1. **全部设置说话人数上限**：3D-Speaker `max_num_spks=15`、pyannote `max_clusters`、NeMo `max_num_speakers=8`。本仓**无上限**。
2. **全部做小簇处理**：3D-Speaker `min_cluster_size=4`、pyannote 剪枝 + 重分配。本仓**无门槛、无回收**。
3. **没有一条把 ASR 窗口当作聚类单元**。三者都按 VAD / subsegment 独立切分，与 ASR 分窗解耦。本仓把 30 秒 ASR 窗口既当推理单元又当 cannot-link 单元。
4. cannot-link **本身不是错的**——文献中确有「同 chunk 的 embedding 不得合并」（Han et al. 2024，WavLM+Conformer），但它与 `min_cluster_size=30` 级别的剪枝重分配**成对出现**。本仓取了约束却没取安全网，这是本次过度分簇的直接机理。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 3D-Speaker | **中** | 参数与算法**思路**高度可复用（CAM++ 同源、同为 ModelScope 生态）；`min_cluster_size` / `max_num_spks` / `mer_cos` 可作标定起点 | 整包引入会带来第二套 VAD 与第二套分段真源，**违反** `feature-research-gate` 「禁止 fork 第二套 VAD」与 Plan「不得第二套并行真源」；且需整段 embedding，与现有分窗 ASR 编排不合 | 整段聚类内存随时长增长；33 分钟约数千 subsegment embedding（192 维）尚可接受 |
| B pyannote 3.1 | **中高（仅聚类层）** | **只取聚类后处理逻辑**：小簇剪枝 + 余弦重分配 + `min/max_clusters` + `min_cluster_size` 自适应启发式。算法短小、无需引入依赖，可在 `speaker_diarization.py` 内实现 | 整包引入需 HF token 与 `pyannote/segmentation-3.0` 条款接受，**违反**本地优先与离线可用；仅复用算法则无冲突 | 纯向量运算，内存与当前实现同量级 |
| C NeMo NME-SC | **低（整包）／中（思路）** | 「自动估计人数、免调阈值」的方向最契合「用户不想填人数」；`enhanced_count_thres` 对短会议的思路可借 | 整包依赖重（NeMo + Hydra），与侧车 PyInstaller 打包体积和 `funasr==1.3.16` 精确 pin 冲突 | 谱聚类需特征分解，长音频要分块过聚类；实现与验证成本高于 A/B |

**本仓已有可复用模块**（先列再决定是否扩展）：

- [`speaker_diarization.py`](../../../services/asr/rushi_asr/speaker_diarization.py)：`_Observation` / `_Cluster` / `_cosine` / `_l2_normalize` / `_merged_cluster` 与时长加权 center —— 数据结构可保留，只换聚类决策与后处理
- [`transcribe_windows.py`](../../../services/asr/rushi_asr/transcribe_windows.py)：`diarization_window_sec()` 已可由 `RUSHI_FUNASR_DIARIZATION_WINDOW_SEC` 覆盖，便于实验
- [`scripts/eval-diarization.py`](../../../scripts/eval-diarization.py)：DER / miss / false alarm / confusion 与最优 label permutation，**已有**，重构后可直接回归
- [`segmentation.py`](../../../services/asr/rushi_asr/segmentation.py)：现有 VAD / 分段真源，**不得** fork 第二套

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **路线 B 的聚类后处理 + 路线 A 的参数上限，在现有 `speaker_diarization.py` 内实现**，不引入 pyannote / NeMo / 3D-Speaker 依赖。改为**三阶段**：① **阶段 1 保留**约束凝聚（含窗口并集传播——受约束聚类中该传播本身是正确的，错的是把窗内 local `spk` 当可靠先验）；② **阶段 2 新增无约束小簇回收**：小簇与过短 observation 按 cosine 就近并入大簇，**忽略 cannot-link**，这正是 pyannote 让同 chunk 约束可用的安全网（`clustering.py:462-481`），也是 dominant 簇碎片得以回收的唯一途径；③ **阶段 3 新增 `max_speakers` 钳制**与超限 warning；④ 大簇门槛用语音时长而非 observation 计数，并取 `min(cfg, max(2.0, 0.1 × 总语音))` 自适应（借 `clustering.py:364-367`）。<br>**修正说明**：本节初稿曾提出「合并后不再累积窗口否决」，经 Plan 推导后放弃——那会使约束传播在受约束聚类意义上不自洽；改由无约束的阶段 2 承担回收职责，机制更贴近路线 B 原型 |
| 不做什么 | **不**引入 pyannote / NeMo / 3D-Speaker 运行时依赖（离线优先 + PyInstaller 体积 + 精确 pin）；**不** fork 第二套 VAD 或第二套分段真源；**不**改默认关闭与实验标签；**不**做重叠语音多标签与声纹身份识别；**不**要求用户填写预计人数作为准确性前提（spike 已证 `preset_spk_num` 不可靠）；**不**通过只调 `0.72` 来交差 |
| 与 ADR / architecture 关系 | 与 [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) 「CAM++ 为可选组件、不影响全局 ready」一致；不改 sidecar 契约字段，`speaker_id` 仍为 opaque run-scoped；`diarization.warnings` 复用现有通道承载超限提示 |
| 风险与 spike 项 | ① 放宽 cannot-link 可能反向把两人误合 → 必须同时用真实多人金标与合成双人样例双向回归；② 小簇剪枝会把真实短插话并入他人（miss 换 confusion），需在 DER 上确认净收益；③ `max_speakers` 上限触发时的产品语义待定（降级提示 / 拒绝出结果 / 仅 warning）；④ 阈值与 `min_cluster_size` 必须由**真实音频**重新标定，合成样例不得作为唯一依据 |

### 4.1 门禁前置

本次反例已使 [`spike-results`](./r3g-d-speaker-diarization-spike-results.md) 的适用范围收窄为「每人有较长连续语音的双人音频」。**DC3 标定等用户提供金标后再测**（2026-08-13 拍板）；在此之前不绕过 cannot-link、不调高 floor 去压说话人数。

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Python ASR | `services/asr/rushi_asr/speaker_diarization.py` | `_cluster_observations` 后新增小簇回收与上限钳制两阶段；新增最小时长准入与 warning |
| Python ASR | `services/asr/rushi_asr/defaults.py` | 新增 `min_observation_speech_sec` / `min_speaker_speech_sec` / `max_speakers` / `absorb_floor` 默认值与 `RUSHI_FUNASR_SPK_*` 覆盖 |
| Rust | `project/run_transcribe_cmd/save.rs` | **契约零变更**，但需修 bug：现仅读 `status` / `run_id`，`diarization.warnings` **被丢弃**，须合入已有 `warnings` 通道 |
| UI | `services/asrTranscribeHints.ts` | 复用既有「warnings → 提示」真源加分支；仅触顶与 center 缺失提示，不新增设置项与 UI 面 |
| 测试 | `services/asr/tests/test_speaker_diarization.py` | 新增：dominant 簇不得因窗口并集锁死、小簇剪枝重分配、超上限 warning、短时长不独立成簇、合成双人不因放宽约束而误合 |
| 评测 | `scripts/eval-diarization.py` | 复用，不改；新增真实音频金标 fixture |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文 —— [`intent`](./r3g-d-diarization-clustering-rework-intent.md) · [`plan`](./r3g-d-diarization-clustering-rework-plan.md) · [`acceptance`](./r3g-d-diarization-clustering-rework-acceptance.md)
- [x] 用户拍板（2026-08-13）：样例可能本就约 8 人；**8 人可用**；金标用户后续提供再测。DC1–DC2 已编码；DC3 等金标

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-08-12 | 初版：由 33 分钟真实会议音频过度分簇（20 个说话人）触发；对照 3D-Speaker / pyannote / NeMo 三条路线，决定在本仓聚类层内补上限与小簇回收，不引入外部依赖 |
| 2026-08-13 | 三件套建立；§4 选定方案改为三阶段（保留约束凝聚 + 新增无约束小簇回收 + 上限钳制），§5 补 `save.rs` warnings 丢弃的落位 |
| 2026-08-13 | 用户拍板：不以 3–4 / 3–6 为事实或硬门禁；8 人可用；金标后续提供。冻结 cannot-link 放宽 |

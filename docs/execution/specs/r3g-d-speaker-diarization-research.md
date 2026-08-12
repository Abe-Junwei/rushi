# 调研：R3g-D 本机说话人分离（Diarization）

> **状态**：调研门禁完成；方案待确认，尚未进入业务编码  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3g-D**  
> **关联 Intent / Plan / Acceptance**：[`r3g-d-speaker-diarization-intent.md`](./r3g-d-speaker-diarization-intent.md) · [`r3g-d-speaker-diarization-plan.md`](./r3g-d-speaker-diarization-plan.md) · [`r3g-d-speaker-diarization-acceptance.md`](./r3g-d-speaker-diarization-acceptance.md)  
> **既有调研**：[`asr-landscape-top4-research-2026-06.md`](./asr-landscape-top4-research-2026-06.md) §③（本稿替代其中的 Nano 前置假设）  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 多人座谈、访谈、问答课：转写完成后区分“谁在何时说话”，纠正错分、重命名，并在 TXT / SRT / DOCX 中选择是否保留说话人。 |
| 本仓现状 | 默认 **Paraformer + fsmn-vad + ct-punc**；`AutoModel` 未挂 `spk_model`；Python / Rust / TS / SQLite 语段均无 speaker 真值；CM6 `speakerId` 预留但恒为 `null`；异步长音频按 120 秒分窗。 |
| 核心难点 | FunASR 每次 `generate` 独立聚类，窗口 A 的 `spk0` 不等于窗口 B 的 `spk0`；聚类标签也不是可跨重转写复用的真人身份。只“加一列 spk”会在长音频和重转写时产生静默串号。 |
| 成功标准 | 本地、可关闭；短音频和分窗长音频均输出运行内一致的 `speaker_id`；用户能重命名及纠正单段；保存、重开、项目包和导出不丢失；以 DER / speaker confusion / 单人误拆而非仅 speaker 数量验收；关闭时不改变现有转写就绪语义。 |

### 已读清单

- [`AI_QUICKSTART.md`](../../../AI_QUICKSTART.md) · [`CONTEXT.md`](../../../CONTEXT.md)
- [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)
- [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)
- `services/asr/rushi_asr/{schemas,segmentation,funasr_engine_load,funasr_pipeline,transcribe_windows}.py`
- `apps/desktop/src/{contracts/transcription.ts,tauri/projectTypes.ts,pages/segmentListHelpers.ts}`
- `apps/desktop/src-tauri/src/project/{types,file_cmd,transcribe_response}.rs` · `db/migrations/segments.rs`
- 本文 §2 的商业产品、云 API 与开源实现官方资料

## 2. 业内成熟路线（≥2）

### 2.1 商业产品：产品交互与数据语义

| 产品 | 检测 / 触发 | 命名与纠错 | 持久化范围 | 导出 / 后续动作 | 对 Rushi 的启示 |
|------|-------------|------------|------------|-----------------|-----------------|
| **Descript** | 转写后自动检测，或由用户指定人数；明确分成 Detect 和 Identify 两步 | 可新增、移动、修改、重命名、替换 speaker；一次识别应用到项目内对应 speaker | 项目级；编辑后标签保留 | TXT / MD / DOCX / SRT / VTT 可选 speaker labels | 聚类与真人姓名分离；单段纠错是 v1 必需，不应只有整组重命名 |
| **Otter** | 先给 `Speaker #`，转写后再识别 | 标记一次可更新同一 conversation；支持全局 speaker profile、合并与重命名 | conversation；另有 account/workspace 声纹 profile | 可按说话人组织内容 | 跨文件认人属于独立声纹产品，隐私与误认成本高；Rushi v1 明确不做 |
| **Adobe Premiere** | 转写前可选 speaker labeling | 可按 speaker 筛选并批量处理其所有片段 | 项目 / sequence | 字幕工作流可保留标签 | “转写前选择 + 转写后筛选/纠错”比隐藏环境变量更符合用户心智 |
| **AssemblyAI** | 请求级 `speaker_labels`；对完整音频做 diarization | 返回通用 speaker labels，不认真人姓名 | 单次 job | utterance / word 结果可消费 | 官方明确：分块上传不会自动保持全局标签，需额外 speaker embeddings |
| **ElevenLabs Scribe** | 请求级 diarization；另有 multichannel 模式 | word 级 `speaker_id` | 单次 job | 下游自行格式化 | diarization 与“已知声道分离”是两种能力；Rushi v1 只做前者 |

官方资料：

- Descript：[Detect and label speakers](https://help.descript.com/hc/en-us/articles/10249423506061-Detect-and-label-speakers-in-your-transcript) · [Speakers](https://help.descript.com/hc/en-us/articles/10164803814285-Speakers) · [文本导出](https://help.descript.com/hc/en-us/articles/10255753048589-Export-your-transcript-as-a-text-file) · [字幕导出](https://help.descript.com/hc/en-us/articles/10255811669773-Exporting-subtitles)
- Otter：[Tagging speaker names](https://help.otter.ai/hc/en-us/articles/360048465453-Tagging-speaker-names-in-a-conversation) · [Speaker Identification Overview](https://help.otter.ai/hc/en-us/articles/21665587209367-Speaker-Identification-Overview) · [Speaker Management](https://help.otter.ai/hc/en-us/articles/40586357592471-Speaker-Management)
- Adobe Premiere：[转写时启用 speaker labeling](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/transcribe-individual-source-files.html) · [按 speaker 批量操作](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/remove-all-instances-of-one-speaker-in-transcript.html)
- AssemblyAI：[Speaker diarization](https://www.assemblyai.com/docs/pre-recorded-audio/label-speakers) · [标签语义](https://www.assemblyai.com/docs/faq/how-are-individual-speakers-identified-and-how-does-the-speaker-label-feature-work) · [分块音频限制](https://www.assemblyai.com/docs/faq/can-i-send-audio-to-assemblyai-in-segments-and-still-get-speaker-labels-for-the-whole-recording)
- ElevenLabs：[Speech to Text](https://elevenlabs.io/docs/overview/capabilities/speech-to-text/) · [Multichannel transcription](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/multichannel-transcription)

### 2.2 开源实现：算法阶段与工程代价

| 路线 | 代表实现 | 阶段 | 长音频 / 对齐方式 | 优点 | 与 Rushi 的冲突 |
|------|----------|------|-----------------|------|-----------------|
| **FunASR 同栈** | Paraformer + VAD + Punc + CAM++ | VAD → ASR → speaker embedding → 聚类 → `sentence_info[].spk` | 单次调用内聚类；官方源码支持返回 speaker centers | 最大复用现有链路；中文与本地部署匹配 | 120 秒多次调用需自行做全局聚类；重建段对象的路径会漏字段 |
| **独立整文件 diarization** | pyannote `community-1` | segmentation → embedding → clustering → exclusive diarization | 整文件先 diarize，再按时间与 ASR 对齐；可处理 overlap | 算法闭环成熟，有公开 DER benchmark | gated Hugging Face 权重、第二套分段/依赖与打包，偏离单分段真源 |
| **ASR 后对齐** | WhisperX + pyannote | ASR → word alignment → diarization → interval overlap 赋 speaker | 全音频 diarization 后按最大时间交集分配 word/segment | 对齐逻辑可借鉴 | 需要 Whisper / wav2vec / pyannote 三套栈，不可直接复用 |
| **模块化聚类 diarizer** | NVIDIA NeMo | VAD → embedding → spectral clustering → resegmentation / scoring | 支持多尺度窗口、保存 embeddings、限制 speaker 数 | 阶段清晰，证明“向量 + 全局聚类 + DER”是成熟路线 | NVIDIA 栈过重，不适合桌面发行 |

官方资料：

- FunASR：[仓库与 AutoModel 示例](https://github.com/modelscope/FunASR) · [教程](https://modelscope.github.io/FunASR/tutorial.html) · [`AutoModel` v1.3.16 源码](https://github.com/modelscope/FunASR/blob/v1.3.16/funasr/auto/auto_model.py)
- CAM++：[ModelScope 模型页](https://www.modelscope.cn/models/damo/speech_campplus_sv_zh-cn_16k-common/s)（模型制品约 **28.86 MB**）· [3D-Speaker](https://github.com/modelscope/3D-Speaker)（CAM++ 约 **7.2M 参数**，两者不可混写成“7 MB”）
- pyannote：[pyannote.audio](https://github.com/pyannote/pyannote-audio) · [pyannote.metrics](https://github.com/pyannote/pyannote-metrics)（DER 是事实标准）
- WhisperX：[仓库](https://github.com/m-bain/whisperX) · [`assign_word_speakers`](https://github.com/m-bain/whisperX/blob/main/whisperx/diarize.py)
- NVIDIA NeMo：[pipeline stages](https://docs.nvidia.com/nemo/speech/nightly/asr/speaker_diarization/api.html) · [clustering 配置](https://docs.nvidia.com/nemo/speech/nightly/asr/speaker_diarization/configs.html)

## 3. 各阶段横向比较与 Rushi 选择

| 阶段 | 商业产品常见做法 | 开源成熟做法 | Rushi v1 选择 | 不选方案 / 原因 |
|------|------------------|--------------|---------------|-----------------|
| 1. 触发与准备 | 转写前开关；云端按 job 收费/执行 | pipeline 初始化时加载 diarizer | 设置默认关；转写前展示本次状态；CAM++ 未缓存先准备 | 不静默默认开；避免性能回归和安装包扩大 |
| 2. 检测与聚类 | 完整 job 后返回通用标签 | VAD + embedding + clustering | 复用 Paraformer/VAD/Punc，挂 CAM++ | 不引入第二套 VAD / pyannote 主路径 |
| 3. 长音频归一 | 服务端以完整音频为 scope；分块需 embedding | 保存 embedding 后全局聚类 | 收集各窗 local center，完成后做运行级约束聚类 | 禁止用文本邻接猜 speaker；禁止直接拼 `spk0` |
| 4. ASR 对齐 | word/utterance 带 speaker | 时间交集或 sentence_info | `sentence_info.spk` → segment；重分段必须显式继承 | 不从正文推断人名 |
| 5. 身份与命名 | 通用标签；高级产品另建声纹 profile | cluster id 仅对当前 recording 有效 | opaque、run-scoped `speaker_id` + 文件级 `display_name` | 不跨文件认真人；不保证重转写 ID 稳定 |
| 6. 人工纠错 | 整组重命名 + 单段改派 + 合并 profile | 通常交由上层 UI | chip、整组重命名、单段/多选改派 | 只有重命名无法修复错分，不能称完整闭环 |
| 7. 编辑持久化 | project/conversation 保存 | JSON / RTTM | SQLite `segments.speaker_id` + `file_speakers`；项目包往返 | 不用 App Data 单独存，避免项目迁移丢名 |
| 8. 导出与筛选 | 标签可选；按 speaker 筛选 | RTTM / JSON | TXT/SRT/DOCX 可选前缀；v1 加轻量筛选 | 不改变全 null 文件的旧格式 |
| 9. 质量评测 | 产品内部金标 | DER / confusion / false alarm / missed speech | DER + confusion + 单人误拆 + 跨窗增量 + CER/RTFx | speaker_count≥2 不能证明分对 |
| 10. 分发与隐私 | 云端免本地权重 | 本地权重/依赖各异 | CAM++ 按需下载、本机推理；默认关 | v1 不进安装包，避免复现 Windows 复制不完整问题 |

## 4. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------|-------------------|-------------------|
| **Paraformer + CAM++ + Rushi 全局聚类** | **高** | 现有 sidecar、VAD/Punc、分窗、prepare/catalog、SQLite、编辑器与导出 | 需增加运行级聚类、字段传播和人工纠错 | 预计 12–18 人日；新增约 28.86 MB 按需制品；需要 CPU 平台 smoke |
| pyannote 整文件 | 低 | DER 工具和对齐思路可借鉴 | 第二套权重、gated 下载、第二时间轴 | 打包和内存明显更高；作为回退调研，不进 v1 |
| 云 API | 中 | 产品交互、job scope 可借鉴 | 音频出境，不符合本机优先 | 后续在线 provider 单独 Epic |
| FireRed / Nano 换引擎 | 低 | 无 | 第三引擎或未 Go SKU | 不为本功能制造引擎迁移前置 |

**本仓已有可复用模块及已确认缺口**：

- `funasr_engine_load.py` / `funasr_pipeline.py`：可扩展 `spk_model`，但需区分“已缓存 / 已配置 / 已加载 / 本次请求启用”。
- `segmentation.py`：可消费 `sentence_info`；当前 `_row_text` 将 `spk` 当正文兜底，必须修正。
- `transcribe_windows.py`：`offset_segments`、`trim_window_prefix_overlap` 重建 `TranscriptionSegment`，新增字段后必须传播；每窗独立调用不能直接复用 label。
- Rust `transcribe_response.rs`、`SegmentDto`、SQLite save/load/import/bundle：均有手工构造或显式列清单，需全链审计。
- `segmentListHelpers.ts`：dirty equality/signature、merge/split 必须纳入 `speaker_id`，否则会丢改动或静默串号。
- `segmentMetaField.speakerId`：仅是 UI 预留，不是真值；应从 DTO 与文件 speaker roster 接线。

## 5. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **Paraformer + CAM++，按需启用；各窗返回 local speaker center，转写结束后做 recording/run 级全局聚类，再生成最终 segment `speaker_id`。** |
| 跨窗算法 | 将 `(window_id, local_spk, center, speech_duration)` 收集为小型集合；以 cosine 相似度做约束式凝聚聚类，同窗两个 local speaker 禁止合并，2 秒 overlap 只作次级投票；阈值与最大人数由 Slice 0 标定。 |
| 异步预览 | 窗口完成时继续预览正文，但 `speaker_id=null`；全部窗口完成、全局聚类后一次写入最终 speaker。避免预览中编号跳变。 |
| ID 语义 | `speaker_id` 是 opaque、run-scoped 聚类键；显示顺序按最终首次出现时间得到“说话人 1/2…”；不是声纹身份，不保证全文重转写后复用。 |
| 命名真源 | SQLite 文件级 `file_speakers`；项目包复制/导入一起走。重转写创建新 `diarization_run_id`，有自定义姓名时先提示并重建 roster，不做自动认人。 |
| 编辑规则 | 支持整组重命名和单段/多选改派；拆段继承；不同 speaker 合段必须由用户选择 A/B/不标注，禁止“主段优先”静默决策。 |
| 分发策略 | CAM++ v1 **按需下载、默认关**。模型目录按 manifest/必需文件/大小或 hash 验证，不以“目录存在”代表完整；暂不写入安装包。 |
| 不做什么 | 跨文件声纹识别；重叠语音多 speaker 段；实时流式 diarization；pyannote/FireRed/Nano 前置；云端主路径；LLM 猜 speaker。 |
| 架构关系 | 不改变 sidecar 总形态、默认 ASR SKU 与 `ready_for_transcribe`；新增 component capability 和 run finalization 状态。 |
| 最大风险 | CAM++ 是否可稳定返回 center；跨窗聚类阈值的域敏感性；字段传播面大；单 speaker 误拆；Windows CPU/PyInstaller 行为。 |

若当前 FunASR pin 无法稳定返回 speaker center，Slice 0 的回退顺序是：

1. 使用同一个 CAM++ 模型对各句音频单独提 embedding，再做同一全局聚类；
2. 短音频保留单次 FunASR diarization，长音频标记 **Partial Go**；
3. 不以文本邻接、时间相邻或“窗口编号相同”冒充全局说话人。

## 6. 落位预告（非业务编码）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Python ASR | schemas / segmentation / engine load / pipeline / windows / async job | `speaker_id`、CAM++、center 收集、最终聚类、预览 finalization |
| Catalog / 发行 | defaults / prepare / catalog / runtime caps / PyInstaller smoke | 按需组件、完整性 manifest；不加入 v1 安装包 |
| Rust / DB | migrations / `SegmentDto` / file speaker commands / save-load-copy-bundle | `speaker_id`、`diarization_run_id`、`file_speakers` |
| TypeScript / UI | contracts / project types / editor meta / segment helpers / transcribe setup | chip、rename、reassign、filter、合拆段规则、准备态 |
| 导出 | TXT / SRT / DOCX formatter | 可选显示名标签 |
| 评测 | spike report / RTTM fixtures / DER script / platform smoke | Go / Partial / Defer / No-go 证据 |

## 7. 签收

- [x] 调研 brief 完成
- [x] 商业产品与开源实现均使用官方/一手资料
- [x] 各阶段比较、复用评估与“不做什么”已完成
- [x] Intent / Plan / Acceptance 已链接本文
- [ ] 用户确认进入 Slice 0 spike（确认前不写业务代码）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-08-11 | 初版：Paraformer + CAM++，解除 Nano 前置 |
| 2026-08-11 | 补齐商业产品与开源阶段对比；拍板 run-scoped ID、全局聚类、SQLite roster、人工纠错、DER 门禁与按需分发 |

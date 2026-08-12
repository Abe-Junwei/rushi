# Intent：R3g-D 本机说话人分离

> **状态**：已批准实施；Partial Go（默认关闭、实验能力）  
> **Research**：[`r3g-d-speaker-diarization-research.md`](./r3g-d-speaker-diarization-research.md)  
> **Plan**：[`r3g-d-speaker-diarization-plan.md`](./r3g-d-speaker-diarization-plan.md)  
> **Acceptance**：[`r3g-d-speaker-diarization-acceptance.md`](./r3g-d-speaker-diarization-acceptance.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3g-D**

## 目标

在默认 Paraformer 本机转写链路上，可选启用 FunASR **CAM++**，使短音频和 120 秒分窗长音频在一次完整转写运行内得到一致的 `speaker_id`。用户能在文稿中识别、重命名和纠正说话人，并在常用导出中选择是否保留标签；不更换默认 ASR 引擎、不上传音频、不引入第二套 VAD。

## 用户结果

- 转写前能看清本次是否“区分说话人”，模型未准备时有明确准备入口。
- 转写完成后看到“说话人 1 / 2…”，不会在 120 秒窗口边界静默串号。
- 能把一个聚类重命名为姓名，也能把错分的一段或多段改派给其他说话人。
- 改名、纠错、拆合段后保存重开和项目包往返不丢失。
- TXT / SRT / DOCX 可选择带显示名；不带 speaker 的旧文件保持原格式。
- 关闭能力时无需 CAM++，现有本机转写就绪状态和结果不变。

## 范围

1. **D0 调研与 Spike**：验证 CAM++ center、DER、单人误拆、CER/RTFx、130 秒以上跨窗和 macOS/Windows CPU 可行性。
2. **D1 数据契约**：segment `speaker_id`、file `diarization_run_id`、SQLite `file_speakers` roster；全栈传播与项目包。
3. **D2 单窗侧车**：可选加载 CAM++；`sentence_info.spk` → run-scoped speaker；完整性与 component capability。
4. **D3 长音频归一**：收集窗口 local centers，完成后全局聚类；异步正文可预览，speaker 只在 final 结果出现。
5. **D4 文稿闭环**：chip、重命名、单段/多选改派、轻量筛选、拆合段规则、重转写提示。
6. **D5 导出与发行**：TXT / SRT / DOCX 可选标签；CAM++ 按需分发；平台 smoke 与回滚。

## 核心语义

- `speaker_id` 是**当前 diarization run 内的聚类键**，不是姓名，也不是可跨文件识别真人的声纹 ID。
- 默认名称按最终结果首次出现顺序生成“说话人 1 / 2…”，底层 ID 为 opaque 值，不向用户暴露窗口编号。
- `display_name` 是文件级用户数据，与 `speaker_id` 分离；改名不重写所有 segments。
- 全文重转写会产生新的 `diarization_run_id`。若旧 roster 有自定义姓名，覆盖前明确提示；v1 不自动把旧姓名映射到新聚类。
- 单个 segment v1 最多一个 `speaker_id`；重叠语音保持单标签或未标注，不伪造多说话人精度。

## 非目标

- 跨文件 / 跨项目声纹库、自动认出真人、声纹登录。
- Fun-ASR-Nano、SenseVoice、FireRed、pyannote 作为必选路径。
- 在线 STT diarization 产品化、实时麦克风流式说话人。
- 同一时间段多个 speaker 的重叠语音编辑模型。
- 用 LLM 或文本邻接推断说话人。
- 完整说话人色轨、声纹管理后台；可作为后续 Epic。

## 约束

- 默认识别模型保持现有 Paraformer hub id；分段真源仍为 `segmentation.py` 消费的 `sentence_info`。
- CAM++ v1 默认关、按需下载；不因其缺失令全局 `/health.ready_for_transcribe=false`。
- 开启时必须分别呈现“用户想启用 / 模型已缓存 / 侧车已加载 / 本次 job 请求 / 结果已 final”，不得以单一 ready 代替。
- 120 秒分窗不得直接拼接 local `spk`；必须有基于 embedding 的运行级归一。
- 异步预览不得显示可能跳变的 provisional speaker；最终聚类完成后再提交 speaker 真值。
- 权重完整性以 manifest、必需文件及大小/hash 校验，不以目录存在或复制成功作为完成。
- additive schema 兼容旧 JSON、旧 SQLite 与旧项目包；复制、移动、导入、导出路径只设一处真源。

## 决策原则

1. **质量可测**：DER / confusion / 单人误拆优先于“检测到几个人”。
2. **同栈最小增量**：Paraformer + 现有 VAD/Punc + CAM++，只在窗口之上增加轻量全局聚类。
3. **先完成再命名**：实时正文预览和最终 speaker attribution 分层。
4. **机器结果可纠正**：整组重命名和单段改派缺一不可。
5. **身份边界明确**：运行级聚类与真人声纹 profile 不混淆。
6. **可关可回滚**：关闭请求或卸载按需模型即可回到今日路径。

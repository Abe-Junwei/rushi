# Spike Results：R3g-D 本机说话人分离

> **结论**：Partial Go（默认关闭、实验性按需能力）；真实会议 20→8 人后用户拍板「8 人可用」（2026-08-13）  
> **执行日期**：2026-08-11  
> **Research**：[`r3g-d-speaker-diarization-research.md`](./r3g-d-speaker-diarization-research.md)  
> **Plan**：[`r3g-d-speaker-diarization-plan.md`](./r3g-d-speaker-diarization-plan.md)  
> **Acceptance**：[`r3g-d-speaker-diarization-acceptance.md`](./r3g-d-speaker-diarization-acceptance.md)

## 判定

CAM++ 的模型加载、单窗 local speaker、`return_spk_center`、30 秒分窗跨窗归一和请求级关闭均可用。130 秒双人可复现实验中，最终得到 2 个 run-scoped speaker，跨 5 个窗口保持一致，speaker confusion 为 0.02%，DER 为 6.83%。

不判为完整 Go，原因有三项：短至 9 秒且无停顿的人工拼接样例会欠分为 1 人；以整段音频区间作 truth 时 speaker coverage 为 93.19%，低于 95% 门槛（主要为 VAD 边缘空隙）；本机无法产出 Windows CPU 冻结物的实机证据。因此 v1 保持默认关闭并标为实验能力，不把 CAM++ 加入安装包。

## 环境与制品

| 项 | 实测 |
|---|---|
| 主机 | macOS arm64，Apple Silicon，MPS |
| Python / FunASR / ModelScope | 3.12 / 1.3.16 / 1.38.1 |
| ASR | `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch` |
| Speaker | `iic/speech_campplus_sv_zh-cn_16k-common` |
| 权重 | `campplus_cn_common.bin`，28,036,335 bytes |
| SHA-256 | `3388cf5fd3493c9ac9c69851d8e7a8badcfb4f3dc631020c4961371646d5ada8` |
| embedding | 192 维（模型 `configuration.json`） |
| 全局聚类阈值 | cosine `0.72`，同窗 local speaker hard cannot-link |
| diarization 分窗 | 30 秒，2 秒 overlap；普通 ASR 仍沿用原窗口策略 |

## 可复现实验

使用 CAM++ 官方示例：speaker 1 的 `speaker1_a` + `speaker1_b`，speaker 2 的 `speaker2_a`，按 13.933938 秒周期重复并裁到 130 秒。truth 由拼接边界生成；评分器为 [`scripts/eval-diarization.py`](../../../scripts/eval-diarization.py)，`collar=0.25s`、`skip_overlap=True`、最优 label permutation。

| 指标 | 130 秒 / 5 窗结果 |
|---|---:|
| speaker count | 2 |
| DER | 6.83% |
| miss | 6.81% |
| false alarm | 0.00% |
| confusion | 0.02% |
| speaker coverage | 93.19% |
| wall | 17.02 s（热缓存；含进程内模型加载） |
| RTFx | 7.64× |
| segmentation | `transcribe_windowed`，无 whole-track fallback |
| center / local mapping | 5 窗均有 center；最终 ID 跨窗一致 |

同一 130 秒音频以整段单次运行时欠分为 1 人，wall 29.19 秒；30 秒分窗反而同时改善速度和人数分离。9.027 秒无停顿双人拼接样例同样欠分为 1 人，说明 `preset_spk_num=2` 不是可靠硬约束，不能把“预计人数”伪装成准确结果。

## 门禁结果

| 门禁 | 结果 |
|---|---|
| 双人干净 DER ≤ 18% | 通过（合成 clean：6.83%） |
| confusion ≤ 12% | 通过（0.02%） |
| coverage ≥ 95% | 未通过（93.19%） |
| 跨窗连续性 | 通过（5 窗一致） |
| return center 对应关系 | 通过；由单测和真实运行共同锁定 |
| 请求关闭无额外模型要求 | 通过；cache/load key 与 request 分离 |
| 单人、三人、远场真实金标 | 证据不足，不据此声称质量 Go |
| Windows CPU 冻结实机 | 本轮环境不可得；保留发行闸门 |

## 产品约束与后续 Go 条件

- 默认关闭；首次开启按需下载，checksum 不符会判损坏并定向修复。
- UI 明示实验能力；短而无停顿的多人音频可能欠分，用户可逐段改派。
- preview 不显示 provisional speaker，只有 final 才原子落库。
- 完整 Go 仍需补齐真实单人/三人/远场 RTTM 集和 Windows 冻结实机；不得用当前合成样例替代。

## 真实音频反例（2026-08-12，适用范围收窄）

首次在真实会议录音上运行即出现严重过度分簇，本报告结论**不适用于多人短轮次讨论**。

样例：`20260712-师资部会议-惟海法师-节选`，33 分钟，前段单人讲授、后段多人讨论；`diarization_run_id = e4645848b22c4b82b3d7dfb89a86504c`。环境与本报告一致（FunASR 1.3.16 / ModelScope 1.38.1 / CAM++ 同一权重、阈值 `0.72`、30 秒窗）。

| 项 | 实测 |
|---|---|
| 段数 / speaker 数 | 472 段 / **20 个 speaker**（当时推断约 3–4 人；**2026-08-13 拍板：可能本就约 8 人**） |
| 无归属段 | 0（管线连通，问题在聚类质量） |
| 分布 | spk2 401 段 85.6%（跨 64/66 窗）；spk5 5.7%；spk13 5.2%；**其余 17 个合计 3.5%，其中 14 个仅 1 段，最短 0.5 秒** |
| 碎片位置 | 窗口 48–65（讨论段）产出 20 个里的 16 个；窗口 65 单窗产出 6 个，窗口 50 产出 5 个 |
| 典型错误 | `idx 349/350/351`（1528.6 / 1535.8 / 1537.7 秒）为同一人连续发言，被分为 spk 10/11/12 |

机理：`_cluster_observations` 的 cannot-link 是不看相似度的硬否决，且合并后窗口集合取并集；dominant speaker 跨 64/66 窗后，任何与其同窗的碎片永久不可合并。**因此调低 `0.72` 在结构上无法修复主要错误类别。** 另有两处缺失放大问题：无最小簇门槛/小簇回收、`max_speakers` 从未实现（20 个 speaker 静默落库、无 warning）。

本报告的 `0.72` 由 130 秒合成拼接样例标定，每人有 40 秒以上连续语音，与真实会议短插话分布差异极大。**该阈值不得视为通用默认值。**

修复路线见 [`r3g-d-diarization-clustering-rework-research.md`](./r3g-d-diarization-clustering-rework-research.md)。DC1+DC2 后同一音频 **20 → 8 人、单段碎片 0**；用户 2026-08-13 拍板 8 人可用，金标后续提供。

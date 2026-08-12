# Spike Results：R3g-D 本机说话人分离

> **结论**：Partial Go（默认关闭、实验性按需能力）  
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

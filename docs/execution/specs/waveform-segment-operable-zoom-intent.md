# Intent：超长录音语段可操作缩放（WS-2b layout cap）

> **Research**：[waveform-segment-operable-zoom-research.md](./waveform-segment-operable-zoom-research.md)  
> **Acceptance**：[waveform-segment-operable-zoom-acceptance.md](./waveform-segment-operable-zoom-acceptance.md)  
> **状态**：编码完成（自动化）；手测待签  

## 意图

长音频（≥约 30min）打开后，默认水平缩放使典型口语语段可点选/拖边界；「适配语段」不被过时的全轨 peaks 列上限压死；绘制仍走 PeakCache 视口路径。保持**单一线性时间投影**。

## 范围

| 薄片 | 交付 |
|------|------|
| Z1 | layout soft-cap 与 peaks/draw hard-cap 分离 |
| Z2 | 长音频默认 px/s = 视口目标可见秒数（≈45s） |
| Z3 | 极窄语段命中最小宽（时间真源不变） |
| Z4 | 定向测试 + architecture 一句更新 |

## 不做

- 非线性 / 鱼眼时间轴  
- 中位语段反推默认（无语段时的增强，留后续）  
- 修改 peaks `.dat` LOD 生成策略  

## 验证

见 acceptance；自动化以 3h 数值用例为主。

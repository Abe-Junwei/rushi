# Acceptance：WS-2b 视口窗口绘制（Peaks 模型 · Rushi canvas）

> **调研**：[`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)  
> **plan**：[`waveform-ws2b-viewport-render-plan.md`](./waveform-ws2b-viewport-render-plan.md)  
> **前序**：[`waveform-ws-canvas-fps-acceptance.md`](./waveform-ws-canvas-fps-acceptance.md)  
> **状态**：生产化编码完成 · S1/S5/S6 手测 PASS · 待 S3/S4 手感确认

---

## 0. Spike 闸门（已完成）

| 项 | 结果 |
|----|------|
| 深 zoom `playbackFrames≥45` | **PASS**（稳态 ~47–52，峰值 54；2026-07-10） |
| media-only WS（`scrollW=1`） | ✅ |
| silence WS timer/progress | ✅ |
| 本仓 viewport peaks canvas | ✅ |

---

## 1. 生产化自动化

- [x] media-only helpers 去 spike 命名并成为默认路径（`collapseWaveSurferToMediaOnly` / `silenceWaveSurferRendererClock`）
- [x] 默认不向 WS `zoom` / `load(peaks)`；`drawPxPerSec` 仍驱动 Rushi canvas
- [x] WS host ready 后 1×1 + opacity:0（禁止 `display:none`）
- [x] 移除 `WAVEFORM_WS2B_VIEWPORT_CANVAS_SPIKE`
- [x] played tint：DOM overlay 整数宽 + ≥50ms 节流（不每帧重绘 peaks；热路径只写 width）
- [x] focused tests（draw / collapse / silence / stage / tint width）
- [x] zoom sync `disabled` 时仍从 `appliedZoom` 回填 `peaksApplied`（避免 phase 卡在 decode）
- [x] `desktop-waveform-engine.md` 修订为「可见波形 = Rushi viewport canvas；WS = media」
- [x] typecheck + 定向 test（本轮自查已绿）

---

## 2. 手测签收

```js
__rushiScrollProfile.enable()
// 深 zoom 播放 8–10s hands-off
__rushiScrollProfile.print()
__rushiScrollProfile.disable()
```

| ID | 判据 | 状态 |
|----|------|------|
| S1 | 深 zoom 稳态 `playbackFrames≥45`（≥8s） | [x] **PASS**（2026-07-10 tint 节流后）：稳态 `playbackFrames` 42–50（连续 ≥8s 多秒 ≥48），峰值 50；`playbackSub≈0.00–0.05ms`（修复前 ~13–14ms / ~18–20fps） |
| S2 | `band`/`ruler` 稳态 repaint ≈0（或 skip 高） | [x] 稳态播放段 `rulerRepaint=0` · `bandRepaint=0`；横滚/选中另计 |
| S3 | 空格 play/pause、seek、语段 overlay 无回退 | [ ] 手感确认；**语段尾停越界**已修（playback frame enforce + sync 不抢清 bound，2026-07-10） |
| S4 | 快速横滚无明显不可接受右侧空白 | [ ] 日志无法代签 |
| S5 | 已播放着色与 playhead 对齐且不把 fps 打回 &lt;45 | [x] **PASS**：tint 节流后 fps 回到 spike v4 量级（≥45）；路径仍 `mount_media_only` + `scrollW=1` |
| S6 | 切换文件 remount 后仍 media-only | [x] 日志有 `mount_media_only` + `[ws2b]` + `scrollW=1`（含 remount） |

证据摘录（`desktop.log`，tint 节流后稳态窗）：

```
mount_media_only · [ws2b] · scrollW=1
playbackFrames=48/48/49/42/43/48/50/43/49/49/48/49/48/49/48 · playbackSub≈0ms · ruler=0 · band=0
```

---

## 3. 签收

- [x] research ✅ + spike v4 PASS
- [x] Plan 定稿
- [x] 生产化编码完成
- [ ] S1–S6 手测通过（差 S3/S4 手感）
- [ ] 父轨 WS-FPS acceptance 标注 WS-2b 生产化完成

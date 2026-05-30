# 波形区手测矩阵

填表人：Agent  日期：2026-05-29

| # | 场景 | 音频 | 步骤 | 预期 | 自动化替代 | 实测 | 通过 |
|---|------|------|------|------|------------|------|------|
| 1 | 首次打开 | 30s MP3 | 导入并打开 | 数秒内波形+可播放 | mount policy + peaks phase tests | 待手测 | ☐ |
| 2 | 首次打开 | 4h MP3 | 导入并打开 | UI 不卡死；显示生成中；完成后波形+播放 | defer timeout F6 + async peaks B6 | 待手测 | ☐ |
| 3 | 缓存再开 | 4h 已生成 peaks | 关闭再打开同一文件 | peaks 秒开 | Rust cache_fresh B7 | 待手测 | ☐ |
| 4 | 关后台 peaks | 10min | 偏好关闭后台生成 | decode 波形；无「正在生成」误导 | waveformPeaksPhase F4 | 待手测 | ☐ |
| 5 | 换文件 | 30s → 10min | 项目内切换文件 | duration/scroll/zoom 重置；无旧时长闪回 | tier scroll F2/F3 + zoom reset F5 | 待手测 | ☐ |
| 6 | 播放跟随 | 任意 ≥2min | 播放中观察 | playhead 平滑跟随；无 2.5s 停顿循环 | useTierScrollSync F1 test | 待手测 | ☐ |
| 7 | 播放中热切换 | 任意 | 开偏好「播放中热切换」；播放中等 peaks | 立即优化或 pending 角标 | useWaveformZoomSync peaksAlreadyLoaded | 待手测 | ☐ |
| 8 | 滑块 zoom | 任意 | 连续拖动缩放条 | 无拉伸感；跨档无闪跳 | waveformEngineSmoke + pxPerSec tests | 待手测 | ☐ |
| 9 | 语段 fit | 多语段 | 列表点选语段 | 视口滚到语段；单次滚动 | selectSegmentViewportPlan tests | 待手测 | ☐ |
| 10 | Minimap | 4h | 点击 minimap | seek + tier scroll 一致 | minimap draw tests | 待手测 | ☐ |
| 11 | 高密度语段 | 1h 已转写 | 滚动+zoom | 无明显卡顿（记录语段数） | overlay visibility B5 test | 待手测 | ☐ |
| 12 | HMR 热更新 | dev | 改 waveform hook 保存 | 全页刷新后正常；无 hook 数组长度错误 | hook deps 修复已合入 | 待手测 | ☐ |

## 性能记录（可选）

| 指标 | 目标 | 实测 |
|------|------|------|
| 10min MP3 首次 peaks | < 5s | 待手测 |
| 4h MP3 首次 peaks | < 120s，UI 不冻结 | 待手测 |
| 4h cached 打开到波形 | < 3s | 待手测 |

## Vitest 冒烟（B10）

```bash
npm run test -- apps/desktop/src/services/waveform/waveformEngineSmoke.test.ts
```

覆盖：mount defer、overlay 虚拟化、context menu hit、长音频 force 跳过。

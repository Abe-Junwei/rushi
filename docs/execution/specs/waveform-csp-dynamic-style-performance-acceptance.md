# Acceptance：波形高频动态样式回归 CSP 直写

> 调研：[`waveform-csp-dynamic-style-performance-research.md`](./waveform-csp-dynamic-style-performance-research.md) · Plan：[`waveform-csp-dynamic-style-performance-plan.md`](./waveform-csp-dynamic-style-performance-plan.md)

## 1. 自动化

- [x] `cspElementLayout.test.ts` — `setDirectLayoutStyle` 写 `el.style`（kebab/单位/removeProperty），不触碰 registry
- [x] `useWaveformSegmentPlaybackControls.test.ts` — raw media 在段内续播不回退 seek；不在段内从段头；explicit `fromSec` 优先
- [x] `npm run typecheck`
- [x] `npm run test`（定向：cspElementLayout / playback controls / 全量 waveform 308 pass；playhead / ruler track 断言改读 `el.style`）
- [x] `node scripts/check-architecture-guard.mjs`（0 错误；封装点 allowlist；仍拦 `style={{}}`）
- [ ] e2e `desktop-selection-latency-profile` 仍过（需 Tauri harness；待跑）
- [ ] profile probe 复跑：4 次点击 layout 规则 `HTMLStyleElement.textContent` 写入 **→ 0**（需真实音频项目；构造性 + 单测已证迁移路径不再触碰 registry，待 live 复测）

## 2. 手测

| # | 场景 | 期望 | 状态 |
|---|------|------|------|
| H1 | 播放中播放头步进 | 平滑，不一卡一卡 | 待测 |
| H2 | 播放中按空格续播（playhead 在段内） | 从当前位置续播，不往前卡 | 待测 |
| H3 | 点击语段 | 播放头定位/语段渲染即时 | 待测 |
| H4 | center-follow 连续播放 30s | 无明显掉帧 | 待测 |
| H5 | zoom 后横向滚动 band/ruler | 不抖不拖影 | 待测 |
| H6 | **Release 包** Editor 波形 | Console 无 CSP violation（direct style 合法） | 待测 |

## 3. 守卫

- [ ] `element.style.*` 仅 `cspElementLayout.ts` allowlist 放行
- [ ] `style={{}}` / `setAttribute('style')` / `cssText` 仍拦
- [ ] 生产 `style-src` 仍无 `unsafe-inline`

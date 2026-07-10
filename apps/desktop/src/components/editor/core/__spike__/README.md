# Transcript Editor Core — P0 Spike（临时）

> 隔离原型，**不进主干终态**。通过 research §4.1 门禁后，可吸收进 `components/editor/core/`；失败则回退路线 A。

## 本目录验证什么

1. CM6 doc（一行一段）+ line decoration 选区
2. **Gutter / lineMarker** 元信息列（时间戳）同 DOM 视口锁步
3. 2000 段选区切换延迟（`spikeSelectionLatency` + `__rushiSelectionProfile` 风格打点）
4. 历史 `SegmentDto.text` 换行审计（`auditSegmentNewlines`）
5. **Windows WebView2 + CJK IME**（手测清单，见下方）— 本机若非 Windows 不得填「通过」

## 自动化

```bash
# 单元：round-trip / gutter 挂载 / 换行审计
npm run test -w @rushi/desktop -- src/components/editor/core/__spike__

# 性能（jsdom 下的选区 dispatch 延迟）
npm run test:perf -w @rushi/desktop -- src/perf/transcriptEditorCoreSpike.perf.ts

# 真实 Chromium：滚动 FPS + gutter 锁步（需 Vite :1421）
cd apps/desktop && PW_DESKTOP_WEBSERVER=1 npx playwright test --project=desktop-ui tests/e2e/desktop-spike-cm6-scroll.spec.ts

# 手测页
# vite 起后打开 http://127.0.0.1:1421/spike-transcript-editor.html → Run scroll + gutter bench
```

## Windows WebView2 + CJK IME

**P0 状态：显式跳过**（2026-07-10，无 Windows 环境）。

- 不阻塞本机后续编码。
- **Windows 发版前硬门禁**：须补测下表；失败则回退路线 A 或保留 textarea 输入路径。
- 编码默认：`EditorView.EDIT_CONTEXT = false`。

环境：Windows 11 + Tauri WebView2；分别测搜狗拼音、微软拼音。

| 配置 | 首字不丢 | 全角标点一次提交 | composition 不被 seek 打断 | 候选框不漂移 |
|------|----------|------------------|----------------------------|--------------|
| `EditorView.EDIT_CONTEXT = true`（默认） | | | | |
| `EditorView.EDIT_CONTEXT = false` | | | | |

挂载入口：在桌面端临时挂 `mountSpikeEditor(parent, segments, { editContext: false })`（仅 spike 页/DevTools，不进产品路径）。

**禁止**把未在 WebView2 上实测的结果写成「IME 已通过」。

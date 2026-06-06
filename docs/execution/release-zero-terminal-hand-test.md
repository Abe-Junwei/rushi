# Release zero-terminal hand-test (macOS v1)

> No shell required after installing `.app`. Operator checklist for personal release signoff.  
> Linked from [release-packaging-audit-2026-06.md](./specs/release-packaging-audit-2026-06.md) batch 12.

## Preconditions

- Fresh or upgraded install from `如是我闻.app` (not `npm run desktop:dev`)
- Network available for first-time model download (offline models OK if already in App Data)

## 1. Launch & environment

- [ ] Open app from Applications or `.app` bundle
- [ ] Open **环境与 ASR**
- [ ] Tap **一键准备本机 ASR** — completes without terminal instructions mentioning `npm`
- [ ] Status rows: 环境 / FFmpeg / 运行时 / 转写 — green or actionable Chinese copy (no `desktop:dev`)

## 2. Import & waveform

- [ ] Create or open project → import audio (mp3/wav)
- [ ] Waveform appears within ~30s (not stuck on「正在加载波形…」)
- [ ] If error banner shows, copy is actionable (重试内置侧车 / 重新安装) — not dev npm strings

## 3. Transcribe

- [ ] Start transcribe on imported audio
- [ ] Segments appear; no blocking error about missing async route without UI fix path
- [ ] Stop/cancel works; editor state recovers

## 4. Export

- [ ] Export Word (or primary export) succeeds

## 5. Post-transcribe (if enabled)

- [ ] Stage B dialog opens when configured
- [ ] LLM gate copy does not reference `npm run desktop:dev`

## 6. Regression spot-checks

- [ ] Quit app fully (Cmd+Q) → reopen → project + waveform still load
- [ ] Second project import — waveform loads without restart

## Failures → where to look (maintainer, not end user)

| Symptom | Log / artifact |
|---------|----------------|
| Waveform stuck | `~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log` — `asset_scope`, `ui waveform` |
| ASR not ready | Same log — `bundled_sidecar_*`; env page status |
| Peaks missing | `projects/<id>/peaks/*.dat` under App Data root |

Maintainer rebuild path: `npm run release:mac` then re-run this checklist.

## Signoff

| Field | Value |
|-------|-------|
| Date | |
| App version | |
| macOS version | |
| Tester | |
| Result | PASS / FAIL |
| Notes | |

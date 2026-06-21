# Plan B 随包模型体积证据（2026-06-21）

> **Plan**：[`asr-bundled-models-plan-v2.md`](./asr-bundled-models-plan-v2.md) · **Implementation**：[`asr-bundled-models-implementation-v2.md`](./asr-bundled-models-implementation-v2.md)

---

## 构建环境

| 项 | 值 |
|----|-----|
| 日期（UTC） | 2026-06-21 |
| macOS | 26.5.1 · arm64 |
| App 版本 | 0.1.8 |
| Stage 命令 | `npm run asr:stage-bundled-models` |
| Build 命令 | `RUSHI_SKIP_BUNDLED_MODELS_STAGE=1 npm run desktop:build-dmg` |

---

## 体积测量

| 资产 | 大小 | 备注 |
|------|------|------|
| `resources/bundled-asr-models/`（stage 后） | **1.1 GB** | Paraformer + VAD + Punc 三件套 |
| `.app` 内 `bundled-asr-models/` | **1.1 GB** | `Contents/Resources/resources/bundled-asr-models/` |
| **DMG** `如是我闻_0.1.8_aarch64.dmg` | **1.4 GB**（1,509,815,212 bytes） | 含 sidecar + ffmpeg + 模型 |
| v0.1.7 DMG（对照） | 328 MB | 无随包模型 |

---

## GitHub Release 判定

- 单文件上限 **2 GB** → **PASS**（1.4 GB < 2 GB）
- **站外 fallback**：v0.1.8 **不需要**（当前 SKU 可直传 GitHub Release）

---

## Fresh App Data 自动化（P8′ 部分）

```bash
bash scripts/r3f-fresh-appdata-hand-test.sh --exit-after-pass
```

| 项 | 结果 |
|----|------|
| 首启 bundled seed → marker `.rushi-bundled-seed.json` | ✅ ~20s |
| `ready_for_transcribe` + `funasr_default_model_cached=true` | ✅ |
| 证据 | [`r3f-fresh-appdata-hand-test-evidence.md`](./r3f-fresh-appdata-hand-test-evidence.md) |

**仍须人工**：~~P8′ 断网 + 遮罩文案目视；P9′ 短音频转写；P10′ 环境页模型列表。~~ **✅ 2026-06-21 用户手测 PASS** — 见 [`v0.1.8-p8-prime-hand-test-evidence.md`](./v0.1.8-p8-prime-hand-test-evidence.md)

---

## 下一步

1. ~~断网 Fresh 手测 P8′–P10′~~ ✅
2. 补齐清单 §1 / §2 P1–P7 / §5–§7 其余 **B** 项 → §8 **Go** → tag `v0.1.8`

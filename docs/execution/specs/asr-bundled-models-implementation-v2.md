# Implementation：E → B 迁移（v0.1.8）

> **Plan**：[`asr-bundled-models-plan-v2.md`](./asr-bundled-models-plan-v2.md)  
> **状态**：B0–B7 完成 · P8′–P10′ 手测 **PASS** 2026-06-21 · 全量 tag 待 §8 其余 B 项  
> **定稿（2026-06-21）**：不发 Linux · 首启 **强阻塞遮罩** · B1 后实测体积再定站外

---

## 0. 切片与顺序

| 切片 | 内容 | 落位 |
|------|------|------|
| **B0** | 关闭 OTA | `tauri.conf.json`、`lib.rs`、`capabilities/`、`appUpdate.ts`、`release.yml` |
| **B1** | Stage 随包模型 | `scripts/stage-bundled-asr-models.sh`、`resources/bundled-asr-models/` |
| **B2** | Rust 首启 seed | `bundled_asr_models_seed.rs`、`bundled_asr_assets.rs` |
| **B3** | 删路线 E | 删 zip 导入 UI/命令/CI job |
| **B4** | 仅 Paraformer + 文案 | `EnvLocalAsrModelCard`、`LocalAsrSetupWizard` |
| **B5** | 无 ModelScope prepare | 隐藏「准备当前模型」；保留清除缓存 + 重 seed |
| **B6** | CI macOS/Windows | `release.yml` stage 前置；删 Linux job |
| **B7** | 首启遮罩 UI | `BundledAsrModelsSeedOverlay.tsx`、`useBundledAsrModelsSeed.ts`、`App.tsx` |

---

## 1. 首启 seed 状态机（缺口 A · 强阻塞）

| 项 | 决策 |
|----|------|
| 触发 | 前端 `App.tsx` mount → `seed_bundled_asr_models_if_needed`（Rust 在 command 内 `spawn_blocking`） |
| 阻塞 | **全屏遮罩**「正在准备内置语音模型…」+ 进度；seed 完成前 **不渲染** `ProjectPanel` |
| 侧车 | seed 完成后再 `retry_bundled_asr_sidecar` + health poll |
| 取消 | **无**取消按钮；Cmd+Q 中断 → 无 marker → 下次重跑 |
| 进度事件 | `bundled-asr-models-seed-progress` |
| Marker | `.rushi-bundled-seed.json`（**忽略** `.rushi-offline-seed.json`） |
| Dev 无 bundle | command 返回 `skipped_no_bundle` → 遮罩不显示（开发机未 stage 时） |

---

## 2. OTA（缺口 B）

- `createUpdaterArtifacts: false`
- 移除 `plugins.updater`、Rust `tauri_plugin_updater`、capability `updater:default`
- `APP_UPDATER_ENABLED = false` → 启动不 check、关于页隐藏按钮
- CI 删除 updater normalize / latest.json / verify job

---

## 3. Linux

**v0.1.8 不发 .deb** — 删除 `release.yml` `tauri-linux` job。

---

## 4. 体积（缺口 D + 站外）

**实测（2026-06-21）**：[`asr-bundled-models-size-evidence-2026-06-21.md`](./asr-bundled-models-size-evidence-2026-06-21.md)

| 资产 | 大小 |
|------|------|
| staged `bundled-asr-models/` | 1.1 GB |
| DMG `0.1.8_aarch64` | **1.4 GB**（1,509,815,212 bytes） |

**结论**：< 2 GB GitHub 单文件上限 → **无需站外 fallback**（v0.1.8）。

---

## 5. 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test bundled_asr_models --manifest-path apps/desktop/src-tauri/Cargo.toml
```

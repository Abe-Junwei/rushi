# REL-1.1 Release 签收 Runbook（Step 12）

> **手测清单**：[`rel-1.1-hand-test-checklist.md`](./rel-1.1-hand-test-checklist.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Step 12  
> **前置**：Step 5–11 ✅（含 BATCH-TXN · H-BATCH-1 2026-06-18）

CSP 硬化仅在生产 Release 包生效；**勿用 `tauri dev` 代签 H-CSP-***。

---

## A. 机器门禁（打 Release 前）

```bash
cd /path/to/Rushi
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

可选（与 `scripts/v1-personal-release-build.sh` 一致）：

```bash
bash scripts/r9-rel-1-machine-gate.sh
```

---

## B. 本地 macOS Release 包（推荐先本地签 CSP）

```bash
# 1. 侧车（若未编过）
npm run asr:build-sidecar-unix
bash scripts/release-sidecar-preflight.sh

# 2. 打 .app（默认）或 DMG
bash scripts/v1-personal-release-build.sh
# DMG：RUSHI_RELEASE_BUNDLE=dmg bash scripts/v1-personal-release-build.sh
```

产物：

- `.app`：`apps/desktop/src-tauri/target/release/bundle/macos/*.app`
- `.dmg`：`apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg`

从 Finder 打开 **Release .app**（非 dev），按下面 C 节手测。

---

## C. H-CSP 手测（Release 包 + DevTools）

### H-CSP-1 — Editor 波形 + Console

1. 创建/打开项目，导入音频，打开 Editor。
2. 确认波形加载、播放头、语段列表正常。
3. 打开 DevTools（macOS：开发菜单或快捷键）→ **Console**。
4. **通过**：无 `Refused to apply inline style` / `style-src` / CSP violation；波形区域无空白。

### H-CSP-2 — 对话框与环境页

1. 转写完成后走 **定稿模式** → 打开 **交付导出** Dialog（布局、按钮、滚动正常）。
2. 打开 **环境 → 本机 ASR**（及在线 STT / LLM 若已配置）— **三盏灯** / 状态条显示正常，无样式崩坏。

### R9 主路径抽检（~10 min）

1. 新建项目 → 导入音频  
2. 本机 ASR 转写 → 语段出现  
3. 编辑一句 → 保存  
4. 导出 TXT 或 Word  

---

## D. GitHub Release + CI（对外发版）

当前 `tauri.conf.json` 版本：**0.1.0**；v1.1 发版前请确认是否 bump（如 `0.1.1`）。

### 方式 1 — GitHub Release 触发（推荐）

```bash
# 在 main（或已合并的 release 分支）上
git tag v0.1.1
git push origin v0.1.1

# 在 GitHub 创建 Release，选择 tag v0.1.1，Publish
# → 触发 .github/workflows/release.yml（release published）
```

### 方式 2 — 手动跑 CI（测 workflow）

GitHub → **Actions** → **Release build** → **Run workflow** → 分支 `main`。

> 勿对旧 failed run 点「Re-run」— 会沿用旧 workflow 快照（见 `release.yml` 注释）。

### Windows 资产

`v0.1.0` Win zip/manifest 曾缺传；新 tag 的 `release` 事件应一并上传。见 [`r3h-1-r-release-checklist.md`](./r3h-1-r-release-checklist.md) §3。

---

## E. 签收

手测通过后更新 [`rel-1.1-hand-test-checklist.md`](./rel-1.1-hand-test-checklist.md)：

| 项 | 值 |
|----|-----|
| H-CSP-1 / H-CSP-2 | ✅ + 日期 |
| 签收人 | |
| 日期 | |
| 版本/tag | 例 `v0.1.1` |

路线图 Step 12 标 ✅；`AI_QUICKSTART.md` 主刀可切至 v1.2 / 并行轨。

---

## F. v1.1 之后（不挡签收）

| 轨道 | 说明 |
|------|------|
| **R3g-C Nano vLLM** | CUDA 机 spike；[`r3g-c-funasr-nano-vllm-research.md`](./r3g-c-funasr-nano-vllm-research.md) |
| **R3g-B-Align** | Qwen3 + ForcedAligner 手测 |
| **架构 hotspot** | `useProjectLifecycleWiring` / `useTranscribeJobExecute` 等近 300 行 |
| **P2** | STT-CANCEL D-5 |

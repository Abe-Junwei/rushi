# scripts/ 索引

仓库根 `scripts/` 下的 shell / Python / Node 辅助脚本。**约 85 个文件**；其中 **22 个**已通过根 `package.json`（或 `apps/desktop/package.json`）接线。其余多为路线图手测、机器门禁、spike 与发布辅助，按需直接 `bash scripts/…` 运行。

> 产品名与打包路径以 `apps/desktop/src-tauri/tauri.conf.json` 为准。发布产物 staging 见 [`stage-release-artifacts.sh`](./stage-release-artifacts.sh)（DMG 复制到仓库根、`.app` symlink）。

---

## npm 接线（首选入口）

| npm script | 脚本 | 用途 |
|------------|------|------|
| `desktop:dev` | `desktop-dev.sh` | 本地 Tauri 开发 |
| `desktop:build` | `release-cleanup-dmg-staging.sh` + Tauri + `stage-release-artifacts.sh` | 完整桌面构建并 stage 产物 |
| `desktop:build-app` | 同上（仅 app bundle） | 只打 `.app` |
| `desktop:build-dmg` | 同上（仅 dmg） | 只打 DMG |
| `release:sidecar-preflight` | `release-sidecar-preflight.sh` | 发版前侧车预检 |
| `release:waveform-probe` | `waveform-release-probe.sh` | 波形 release 探针 |
| `release:postbuild-verify` | `release-postbuild-verify.sh` | 构建后校验 |
| `release:mac` | `v1-personal-release-build.sh` | 个人 macOS 发版流水线 |
| `release:win` | `v1-windows-release-build.ps1` | 本地 Windows 便携包（CI tag 也会上传 Release） |
| `p0:acceptance` | `p0-acceptance.sh` | P0 验收 |
| `eval:placeholders` | `eval-generate-placeholders.sh` | 评测占位 wav |
| `eval:run` / `eval:run:*` | `eval-run.py` | ASR 评测矩阵 |
| `asr:dev` | `run-asr-dev.sh` | 侧车开发 |
| `asr:test` | `run-asr-pytest.sh` | Python ASR pytest |
| `asr:build-sidecar-unix` | `build-asr-sidecar-unix.sh` | macOS 侧车构建 |
| `asr:smoke-sidecar` | `smoke-asr-sidecar-health.sh` | 侧车健康冒烟 |
| `asr:regen-sidecar-locks` | `regen-sidecar-cpu-lock.sh` + `regen-sidecar-cuda-win-lock.sh` | 侧车 lock 再生 |
| `check:doc-links` | `check-internal-doc-links.mjs` | 内部文档链接检查 |
| `build:user-guide-pdf`（desktop workspace） | `build-user-guide-pdf.sh` | 用户指南 PDF |

**未进 package.json 但常用：**

| 命令 | 用途 |
|------|------|
| `node scripts/check-architecture-guard.mjs` | 架构守卫（提交前与 CI 同级） |
| `bash scripts/prepare-stitch-upload.sh` | Stitch 上传包刷新 |
| `bash scripts/v1-release-installed-smoke.sh` | 已安装 `.app` 冒烟（见 `docs/execution/v1-release-installed-smoke-evidence.md`） |

---

## 按主题分组（未全量 npm 接线）

### 发布 / 打包

| 脚本 | 说明 |
|------|------|
| `release-cleanup-dmg-staging.sh` | 构建前清理根目录 staged DMG |
| `stage-release-artifacts.sh` | 构建后复制 DMG、根目录 `.app` symlink |
| `resolve-bundled-sidecar-stamp-in-app.sh` | 解析已安装包内 sidecar stamp |
| `resolve-bundled-tool-in-app.sh` | 解析包内 bundled 工具路径 |
| `ci-generate-updater-latest-json.sh` | Release CI 生成 macOS OTA `latest.json` |
| `ci-verify-updater-manifest.sh` | Release CI 校验 OTA manifest / 签名包 |
| `sign-windows-sidecar.ps1` | Windows 侧车签名 |

### ASR 侧车 / runtime

| 脚本 | 说明 |
|------|------|
| `bootstrap-asr-venv.sh` | 引导 ASR venv |
| `fetch-ffmpeg-sidecar.sh` | 拉取侧车 ffmpeg |
| `install-funasr-for-desktop.sh` | 桌面 FunASR 安装 |
| `build-asr-sidecar-windows.ps1` | Windows 侧车构建 |
| `smoke-asr-sidecar-health.ps1` | Windows 侧车健康 |
| `resolve-asr-models-root.sh` / `resolve-app-data-root.sh` | 路径解析辅助 |

### 机器门禁（machine-gate）

| 脚本 | 路线图 |
|------|--------|
| `r3-5f-a-machine-gate.sh` … `r3-5f-d-machine-gate.sh` | R3-5f |
| `r3-5f-bhalf-machine-gate.sh` / `r3-5f-mem-p2-machine-gate.sh` | R3-5f 扩展 |
| `r3h-0-machine-gate.sh` | R3h |
| `r9-rel-1-machine-gate.sh` | R9 release |

### 手测（hand-test）

按路线图薄片命名；运行前读对应 `docs/execution/specs/*-hand-test*.md` 或 acceptance。

| 前缀 | 示例 |
|------|------|
| `r3e-*` | `r3e-a-hand-test.sh` … `r3e-c-hand-test.sh` |
| `r3t-*` | `r3t-a-hand-test.sh` … `r3t-c-hand-test.sh` |
| `r3f-*` | `r3f-installed-hand-test.sh`, `r3f-fresh-appdata-hand-test.sh` |
| `r3g-*` | align / Qwen3 spike 手测与 preflight |
| `r9-rel-1-*` | release 手测（含 `strict` 变体） |
| 其它 | `asr-voc-3-hand-test.sh`, `f7-lexicon-bundle-hand-test.sh`, `trn-diag-hand-test.sh`, `rev-loc-slice-*`, `r4-gate-hand-test.sh` |

### Spike / 调研

| 脚本 | 说明 |
|------|------|
| `r3h-3.5-download-sherpa-p1.sh` / `p2.sh` | Sherpa ONNX 下载 |
| `r3h-3.5-run-sherpa-spike.sh` | Sherpa spike 运行 |
| `r3h-3.5-sherpa-*` | Paraformer / long compare |
| `r3g-b-download-sherpa-qwen3-onnx.sh` | Qwen3 ONNX |
| `r3g-b-qwen3-06b-funasr-sherpa-compare.sh` | FunASR vs Sherpa 对比 |
| `llm-loc-spike-*` | LLM 本地化 spike（含 `.py`） |
| `r3g-b-qwen3-spike-run.py` / `r3g-b-qwen3-segment-compare-md.py` | Qwen3 spike Python |

### 评测 / fixture / 开发卫生

| 脚本 | 说明 |
|------|------|
| `eval-extract-docx-reference.py` | 评测 docx 参考提取 |
| `validate_p0_transcription_result.py` | P0 转写结果校验 |
| `seed-duizhao-project.py` | 对照项目种子 |
| `generate-p0-chinese-samples-macos.sh` / `p0-sample-batch.sh` | P0 中文样本 |
| `clean-dev-artifacts.sh` / `npm run clean:artifacts` | 清理可再生的构建/缓存产物（含根目录 staged DMG、Tauri target、ASR PyInstaller build） |
| `audit-copy-shortcuts.sh` | 文案快捷键审计 |
| `test-r3h-2-c-rollback.sh` | R3h 回滚测试 |

---

## Release parity 手测（非本目录自动化）

安装包与 dev  parity 证据模板与清单在 `docs/execution/specs/release-parity-*.md`；已记录冒烟见 [`v1-release-installed-smoke-evidence.md`](../docs/execution/v1-release-installed-smoke-evidence.md)。对应脚本：`v1-release-installed-smoke.sh`（上表「常用」）。

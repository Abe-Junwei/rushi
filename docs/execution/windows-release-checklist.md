# Windows 桌面发布检查清单（ASR 侧车）

与 [`docs/architecture/asr-sidecar-funasr-policy.md`](../architecture/asr-sidecar-funasr-policy.md) 对齐的**人工/发布流水线**备忘（证书与密钥不进仓库）。

**Linux 桌面**：与策略 §1 一致，**不承诺**正式侧车/安装包矩阵；本清单仅覆盖 Windows x64。

**分发策略（2026-07）**：

- **首推（无 Authenticode 阶段）**：CDN `windows-portable-x64.zip` 绿色免安装（解压即用；避免 SmartScreen 蓝网劝退）。CI 在 CUDA 步骤**之前**即上传 artifact + CDN。
- NSIS `rushi-desktop-setup.exe` 仍产出（OTA 用）；**未签名时**下载页应引导「更多信息 → 仍要运行」，不作为小白主路径。
- 介质 **仅含 CPU** onedir（**不含** Plan B 模型权重，首跑 ModelScope）；CUDA 为 CDN 可选组件（见 [`win-nsis-cpu-cuda-cdn-opt-in-research.md`](./specs/win-nsis-cpu-cuda-cdn-opt-in-research.md)）。

## 1. 物料

- [ ] **`windows-portable-x64.zip`**：CI early artifact / CDN `/<tag>/windows-portable-x64.zip` 可下载（**主分发**）。
- [ ] **`rushi-asr-sidecar.exe`** + onedir：已执行 `npm run asr:build-sidecar-windows-cpu`（或等价 `ps1`），并进入 portable / NSIS resources。
- [ ] **`rushi-asr-sidecar-cuda.exe`** + onedir：已执行 `npm run asr:build-sidecar-windows-cuda`（**在 NSIS/portable 之后**），打成 `rushi-asr-sidecar-cuda-windows-x64.zip` 上传 CDN；**不要**打进安装介质。
- [ ] 体积尖刺：`pwsh scripts/ci-measure-windows-bundle-size.ps1`（CPU-only staging；NSIS &lt; 2GB）。
- [ ] 签名 runtime manifest：`scripts/ci-publish-cuda-runtime-manifest.sh` → CDN `runtime/rushi-runtime-manifest.json`。

## 2. 签名（Authenticode）

- [ ] **未签名试水**：优先 portable；NSIS 仅作 OTA/进阶；发版前可将最终 zip/exe **SHA256** 提交 [Microsoft WDSI 误报](https://www.microsoft.com/en-us/wdsi/filesubmission)。
- [ ] 正式对外收费/渠道分发前：主程序、**CPU 侧车**与 **CUDA 侧车** onedir 下 **全部 `*.dll` / `*.pyd` / `*.exe`** 使用团队证书完成签名。
- [ ] 已运行模板脚本（本机配置 `SIGNTOOL` / `SIGN_PFX` / `SIGN_PASS`）：[`scripts/sign-windows-sidecar.ps1`](../../scripts/sign-windows-sidecar.ps1)（对已存在的 `bundled-asr/...` 目录递归签名）。
- [ ] 签名后在本机 **SmartScreen / 企业策略** 环境做一次冒烟安装。

## 2b. 内发 / 企业构建（可选门闸）

- [ ] 若交付要求固定权重校验：在侧车进程环境中设置 **`RUSHI_MODEL_VERIFY_MANIFEST`**（见 `services/asr/README.md`），manifest 由发布物料单独保管，**不进用户仓库**。

## 3. 合规与说明

- [x] 安装包或「关于」中附 **ffmpeg-static 许可**（GPL/LGPL 等，见 `services/asr/third_party/ffmpeg/README.md`）。**编码真源**：路线图 **§10.4 Step 5c PROD-META** — 环境页 **关于**（第三方组件 + 许可正文）+ 随包 `third-party-notices.txt` / `third-party-license-texts.txt`。
- [ ] 用户可见说明：**模型权重**首次使用从 ModelScope 等拉取，占用应用数据目录下 `models/`（与壳内说明一致）；**GPU 加速**为可选下载。
- [ ] 下载页文案：首推 zip；若提供未签名 setup.exe，须写清 SmartScreen「更多信息 → 仍要运行」。

## 4. 冒烟

- [ ] 干净 VM：解压 **portable zip** 启动，确认 **8741** 由 CPU 侧车拉起；可转写（首跑可能需一键准备拉模型）。
- [ ] （可选）NSIS 未签名路径：确认 SmartScreen 引导文案可用。
- [ ] NVIDIA 机：环境页出现「下载 GPU 加速组件」推荐 → 下载 → 重启侧车 → CUDA 优先；失败时 CPU 回退仍可转写（或 `RUSHI_FORCE_BUNDLED_ASR_CPU=1`）。
- [ ] CDN：`/<tag>/windows-portable-x64.zip`、`/<tag>/rushi-desktop-setup.exe`、`/<tag>/rushi-asr-sidecar-cuda-windows-x64.zip`、`/runtime/rushi-runtime-manifest.json` 可访问。

# Windows 桌面发布检查清单（ASR 侧车）

与 [`docs/architecture/asr-sidecar-funasr-policy.md`](../architecture/asr-sidecar-funasr-policy.md) 对齐的**人工/发布流水线**备忘（证书与密钥不进仓库）。

**Linux 桌面**：与策略 §1 一致，**不承诺**正式侧车/安装包矩阵；本清单仅覆盖 Windows x64。

**分发策略（2026-07-18）**：

- **命名**（真源 `scripts/rushi-win-release-artifact-names.*`）：
  - 便携版：`如是我闻_<版本>_Windows_x64_便携版.zip`
  - 安装包：`如是我闻_<版本>_Windows_x64_安装包.exe`
  - CUDA：`如是我闻_<版本>_Windows_x64_CUDA侧车.zip`
- **首推（无 Authenticode 阶段）**：CDN 中文便携版 zip（解压即用；避免 SmartScreen 蓝网劝退）。CI 在 CUDA 步骤**之前**即上传 artifact + CDN。
- **NSIS + portable 硬门禁**：**必须**含 CPU 侧车 onedir + Plan B `bundled-asr-models/`（缺一则 CI fail）。**stage 在 NSIS 之前**。
- NSIS 中文安装包（OTA）：与 portable **同内容边界**（侧车+模型；无 CUDA）。未签名时下载页应引导「更多信息 → 仍要运行」。
- CUDA 为 CDN 可选组件（见 [`win-nsis-cpu-cuda-cdn-opt-in-research.md`](./specs/win-nsis-cpu-cuda-cdn-opt-in-research.md)）。
- **发版顺序（硬）**：① **先走远程** `release.yml`（tag push / Actions）；`tauri-windows` 跑 **self-hosted**（label `rushi-release`，本机 `E:\actions-runner`，须 Online）。② self-hosted 离线或仍 OOM 时，再本机 `npm run release:win` + `npm run release:win:upload`。其它 CI 失败（含 **makensis MAX_PATH**）先修 workflow 重跑。

- **CI / PowerShell 原生命令（易忽略）**：`$ErrorActionPreference=Stop`（及 PS 7.3+ `PSNativeCommandUseErrorActionPreference`）会把 **stderr≠失败** 打成 **NativeCommandError**。真源 helper：`scripts/rushi-resolve-git-sha.ps1`（`Get-RushiGitShaShort` / `Invoke-RushiNativeChecked` / `Invoke-RushiNativeSoft`）与 `.sh`。机器守卫：`scripts/check-pwsh-native-safety.mjs`（挂入 `check-architecture-guard.mjs`）。
  - **覆盖矩阵（须全绿才算收口）**：
    | 面 | 路径 |
    |---|---|
    | stamp | `build-asr-sidecar-windows.ps1` / `build-asr-sidecar-unix.sh` → helper；禁止 git ownership fail closed |
    | 侧车构建 | pip / pyinstaller / post-smoke / prune 全 Checked；npm 入口用 `pwsh`（非 Windows PowerShell 5.1） |
    | smoke | `smoke-asr-sidecar-health.ps1` 内 `python -` 断言 Checked |
    | 发版本地 | `v1-windows-release-build` / `upload-windows-release-cdn` / `sign-windows-sidecar` / portable·CUDA `tar` |
    | 测试本地 | `run-asr-pytest` / `run-desktop-e2e-*` |
    | CI `tauri-windows` | `safe.directory` Soft；Node/Python Soft；`npm ci` / sidecar / tauri / pack / signtool / CUDA Checked |
    | CI `desktop-rust`（windows-latest） | `npm ci` + `cargo test/clippy/fmt` Checked |
    | 纯 .NET（豁免 helper） | `ci-measure-windows-bundle-size.ps1` / `prune-windows-sidecar-for-nsis.ps1` / `rushi-win-release-artifact-names.ps1` |
- **makensis MAX_PATH**：侧车内 `torch-*.dist-info/licenses/third_party/...` 过深会 abort；CI/本地在 NSIS 前跑 `scripts/prune-windows-sidecar-for-nsis.ps1`（删 runtime 不需要的 licenses 树）。
- **portable zip**：真源 `scripts/ci-pack-windows-portable-zip.ps1`（CI + `npm run release:win` 共用）。硬规则：
  1. CI 短路径暂存 `C:\rp`（避免 `D:\a\rushi\rushi\...` + modelscope **MAX_PATH**）；
  2. **`tar.exe` 的 `-f` 只用 ASCII 路径**（create + extract）；校验通过后再 `Move-Item` 成中文便携版名；
  3. **禁止**对中文最终名跑 `tar -xf`（Windows bsdtar 会变成 `????.zip` 并失败）。
  CUDA zip 同理：`scripts/ci-pack-windows-cuda-zip.ps1`。CUDA 汇报勿当成主失败——主失败看「Build + verify Windows portable zip」。

## 1. 物料

- [ ] **便携版 zip**：CDN `/<tag>/如是我闻_<ver>_Windows_x64_便携版.zip`（**主分发**）；内含 `resources/bundled-asr/rushi-asr-sidecar/` + `resources/bundled-asr-models/`。
- [ ] **`rushi-asr-sidecar.exe`** + onedir：已执行 `npm run asr:build-sidecar-windows-cpu`（或等价 `ps1`），并进入 portable / NSIS resources。
- [ ] **Plan B 模型**：CI 在 NSIS **之前** `npm run asr:stage-bundled-models`（与 portable 共用 resources；`preflight-bundled-asr-models` 通过后再打 NSIS）。
- [ ] **CUDA 侧车 zip**：`如是我闻_<ver>_Windows_x64_CUDA侧车.zip` 上传 CDN；**不要**打进安装介质。
- [ ] 体积尖刺：`pwsh scripts/ci-measure-windows-bundle-size.ps1 -RequirePlanBModels`（NSIS 前已含模型；打完后 `-NsisPath`；NSIS &lt; 2GB）。
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
- [ ] 用户可见说明：**portable / NSIS** 均含默认 Plan B，首启本地 seed（无需联网下模型）；**GPU 加速**为可选下载。
- [ ] 下载页文案：zip 与安装包均含侧车+模型；若提供未签名 setup.exe，须写清 SmartScreen「更多信息 → 仍要运行」。

## 4. 冒烟

- [ ] 干净 VM：解压 **portable zip** 启动，确认 **8741** 由 CPU 侧车拉起；Plan B seed 后可转写（断网亦可完成默认 SKU）。
- [ ] （可选）NSIS 未签名路径：确认 SmartScreen 引导文案可用。
- [ ] NVIDIA 机：环境页出现「下载 GPU 加速组件」推荐 → 下载 → 重启侧车 → CUDA 优先；失败时 CPU 回退仍可转写（或 `RUSHI_FORCE_BUNDLED_ASR_CPU=1`）。
- [ ] CDN：`/<tag>/如是我闻_*_便携版.zip`、`/<tag>/如是我闻_*_安装包.exe`、`/<tag>/如是我闻_*_CUDA侧车.zip`、`/runtime/rushi-runtime-manifest.json` 可访问。

## 5. 远程优先（Win = self-hosted）；离线/仍失败再本地上传

1. 发版前确认 GitHub → Actions → Runners：`pc-office-win-release` **Idle/Online**（Windows 服务 `actions.runner.Abe-Junwei-rushi.pc-office-win-release`，延迟自动启动；工具链在 **Machine** PATH：`E:\Python312` / Node / Git；`TEMP`=`E:\Temp`）。
2. tag push 或 `workflow_dispatch` 后盯 Actions：`release.yml` → `tauri-windows`（stage Plan B → NSIS → portable）。
3. **成功**：CDN 验收 §4；不必再手搓本地打包。  
   - **安装 CDN**（便携版/DMG/NSIS）：单侧成功即可上传。  
   - **OTA `latest.json`**：**硬闸门** — 须同时有 mac+win 合法 fragment（url+signature）才覆盖；否则保留旧 latest（Tauri 整文件校验）。  
   - 缺 `.sig` → fragment 软跳过，不影响安装 CDN。  
   - verify：mac 或 win 成功即可跑；portable 硬门禁仅 win 成功时；若本次上传了 latest 则双平台硬验。  
   - 同 tag 重推取消旧跑；Authenticode 失败不挡 NSIS/portable。
4. **Runner 离线或仍 OOM**：再走本地：

```powershell
# 本机 Windows x64，仓库根 — self-hosted 不可用时的回退
npm run release:win
$env:R2_ACCESS_KEY_ID="..."
$env:R2_SECRET_ACCESS_KEY="..."
$env:R2_ENDPOINT="https://....r2.cloudflarestorage.com"
npm run release:win:upload -- --tag v1.0.1
```

产物文件名见 §分发策略；上传脚本 [`scripts/upload-windows-release-cdn.ps1`](../../scripts/upload-windows-release-cdn.ps1)。

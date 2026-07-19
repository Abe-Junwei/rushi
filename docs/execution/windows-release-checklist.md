# Windows 桌面发布检查清单（ASR 侧车）

> 当前操作入口：[`windows-release-current.md`](./windows-release-current.md)。本清单保留为物料/手测备忘，若与当前入口冲突，以当前入口为准。

与 [`docs/architecture/asr-sidecar-funasr-policy.md`](../architecture/asr-sidecar-funasr-policy.md) 对齐的**人工/发布流水线**备忘（证书与密钥不进仓库）。

**Linux 桌面**：与策略 §1 一致，**不承诺**正式侧车/安装包矩阵；本清单仅覆盖 Windows x64。

**分发策略（2026-07-19 路线三）**：

- **命名**（真源 `scripts/rushi-win-release-artifact-names.*`）：
  - **主分发**：`如是我闻_<版本>_Windows_x64_离线安装包.zip`（瘦 setup + 同级 `resources/bundled-asr-models/`）
  - 安装包：`如是我闻_<版本>_Windows_x64_安装包.exe`（OTA；亦为离线 zip 内入口）
  - CUDA：`如是我闻_<版本>_Windows_x64_CUDA侧车.zip`
  - **便携版已退役**（勿再打/勿再传）
- **用户路径**：下载离线 zip → **完整解压** → 同级运行安装包 → POSTINSTALL 拷贝模型 → 断网可 seed。
- **NSIS 载荷**：CPU 侧车 only（无 Plan B）；缺旁路模型则安装 Abort。
- CUDA 为 CDN 可选组件（见 [`win-nsis-cpu-cuda-cdn-opt-in-research.md`](./specs/win-nsis-cpu-cuda-cdn-opt-in-research.md)）。
- **发版顺序（硬）**：① **先走远程** `release.yml`（self-hosted `rushi-release`）。② 离线/仍失败再本机 `npm run release:win` + `release:win:upload`。

- **CI / PowerShell 原生命令**：见 `scripts/rushi-resolve-git-sha.ps1`；守卫 `scripts/check-pwsh-native-safety.mjs`。
- **Runner preflight**：`scripts/check-windows-release-runner.ps1`；在 expensive sidecar / NSIS 前快速暴露 self-hosted 环境漂移。
- **版本硬闸门**：tag、desktop package、Tauri config、Cargo package 四者必须一致；历史补发必须 checkout 源 run SHA。
- **PowerShell 硬规则**：`-LiteralPath` **禁止**带 `*` / `?`（不会展开通配，会当成字面文件名 `*`）。目录内容复制用 `Get-ChildItem -LiteralPath $dir` 再按项 `Copy-Item -LiteralPath $_.FullName`。守卫同上。
- **makensis MAX_PATH**：NSIS 前 `scripts/prune-windows-sidecar-for-nsis.ps1`。
- **离线 zip**：真源 `scripts/ci-pack-windows-offline-installer-zip.ps1`（ASCII `tar -f` → 中文 rename；禁止对中文最终名 `tar -xf`）。

## 1. 物料

- [ ] **离线安装包 zip**：CDN `/<tag>/如是我闻_<ver>_Windows_x64_离线安装包.zip`；内含中文 setup.exe + `resources/bundled-asr-models/`。
- [ ] **`rushi-asr-sidecar.exe` onedir**：打进 NSIS；`npm run asr:build-sidecar-windows-cpu`。
- [ ] **Plan B 模型**：NSIS **之后** stage；进离线 zip 旁路（`preflight-bundled-asr-models`）。
- [ ] **CUDA 侧车 zip**：`windows-cuda-opt-in` 上传 CDN；**不要**打进安装介质；不阻塞 core / verify。
- [ ] 体积：NSIS 前 measure（无模型）；NSIS &lt; 2GB；layout 前 `-RequirePlanBForOfflineLayout`。

## 2. 签名（Authenticode）

- [ ] 未签名阶段：主推离线 zip；NSIS 作 OTA/安装入口；SmartScreen 文案「更多信息 → 仍要运行」。
- [ ] 正式分发前：主程序、NSIS、CPU/CUDA 侧车 onedir 内 `*.dll` / `*.pyd` / `*.exe` 签名；Tauri/NSIS 通过构建期 `signCommand` 签名，禁止生成 updater `.sig` 后再改安装包字节。
- [ ] `scripts/sign-windows-sidecar.ps1`（可选）。

## 3. 合规与说明

- [x] 关于页 / 随包第三方许可（路线图 §10.4 PROD-META）。
- [ ] 下载页：主推「离线完整安装包」；写清须完整解压；OTA 升壳+侧车、大模型随首装。
- [ ] 勿再主推「便携版」。

## 4. 冒烟

- [ ] 断网 VM：解压离线 zip → 安装 → 首启 seed → 可转写。
- [ ] 单独拷贝 setup.exe（无同级 resources）→ 安装 Abort。
- [ ] 单独 setup.exe `/S` 干净首装 → 非零退出，不留下无模型安装。
- [ ] （可选）OTA：瘦 NSIS 升级后侧车更新；App Data 模型保留。
- [ ] NVIDIA：环境页 CUDA CDN 下载 → 优先 CUDA；失败 CPU 回退。
- [ ] CDN：离线 zip / 安装包按发布 `.sha256` 做下载流哈希；CUDA manifest 版本/URL/签名字段正确且主包 SHA256 一致。

## 5. 远程优先；离线再本地上传

1. Runner `pc-office-win-release` Online。
2. `scripts/check-windows-release-runner.ps1` preflight 通过。
3. tag / `workflow_dispatch`：`windows-core-release`（瘦 NSIS → stage → 离线 zip）。
4. 成功：CDN §4；OTA `latest.json` 仍双平台硬闸门。
5. 失败回退：

```powershell
npm run release:win
# R2_* env...
npm run release:win:upload -- --tag v1.0.1
```

**本地产物目录**：默认 `E:\rushi-artifacts\win-release\`（离线 zip + sha）；勿写仓库根。

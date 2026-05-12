# Windows 桌面发布检查清单（ASR 侧车）

与 [`docs/architecture/asr-sidecar-funasr-policy.md`](../architecture/asr-sidecar-funasr-policy.md) 对齐的**人工/发布流水线**备忘（证书与密钥不进仓库）。

**Linux 桌面**：与策略 §1 一致，**不承诺**正式侧车/安装包矩阵；本清单仅覆盖 Windows x64。

## 1. 物料

- [ ] **`rushi-asr-sidecar.exe`** + onedir：已执行 `npm run asr:build-sidecar-windows-cpu`（或等价 `ps1`）。
- [ ] **`rushi-asr-sidecar-cuda.exe`** + onedir：已执行 `npm run asr:build-sidecar-windows-cuda`。
- [ ] 两棵 onedir 已复制到 `apps/desktop/src-tauri/resources/bundled-asr/` 下对应目录后再打 **Tauri** 安装包。

## 2. 签名（Authenticode）

- [ ] 主程序、**两个侧车 exe**、各自 onedir 下 **全部 `*.dll` / `*.pyd` / `*.exe`**（含同目录 `ffmpeg.exe` / `ffprobe.exe`）使用团队证书完成签名（与策略 §4、安装包策略一致）。
- [ ] 已运行模板脚本（本机配置 `SIGNTOOL` / `SIGN_PFX` / `SIGN_PASS`）：[`scripts/sign-windows-sidecar.ps1`](../../scripts/sign-windows-sidecar.ps1)（对两棵 `bundled-asr/...` 目录递归签名）。
- [ ] 签名后在本机 **SmartScreen / 企业策略** 环境做一次冒烟安装。

## 2b. 内发 / 企业构建（可选门闸）

- [ ] 若交付要求固定权重校验：在侧车进程环境中设置 **`RUSHI_MODEL_VERIFY_MANIFEST`**（见 `services/asr/README.md`），manifest 由发布物料单独保管，**不进用户仓库**。

## 3. 合规与说明

- [ ] 安装包或「关于」中附 **ffmpeg-static 许可**（GPL/LGPL 等，见 `services/asr/third_party/ffmpeg/README.md`）。
- [ ] 用户可见说明：**模型权重**首次使用从 ModelScope 等拉取，占用应用数据目录下 `models/`（与壳内说明一致）。

## 4. 冒烟

- [ ] 干净 VM：安装后启动应用，确认 **8741** 在空闲时由 bundled 侧车拉起；**NVIDIA 机**上 CUDA 包可被优先选中（或 `RUSHI_FORCE_BUNDLED_ASR_CPU=1` 验证 CPU 回退）。

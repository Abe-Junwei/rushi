# 调研：Windows NSIS CPU-only + CUDA CDN 可选下载

> **状态**：已采纳  
> **关联 spec**：[`win-release-assets-acceptance.md`](./win-release-assets-acceptance.md) · [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) §10  
> **门禁**：见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | v1.0.0 Windows Release 在 NSIS 打包阶段失败（`makensis` ~2GB 上限）；用户仍希望有 N 卡时 GPU 加速 |
| 本仓现状 | `release.yml` 同时 build CPU+CUDA 侧车 + Plan B 模型并打入 `bundle.resources`；`candidates.rs` 已有 N 卡探针与 CUDA 优先启动；LRC 下载栈存在但 release 未发布 manifest |
| 成功标准 | NSIS &lt; 2GB 通过 CI；有 N 卡且无 CUDA onedir 时环境页推荐下载；下载后 CUDA 优先、失败回退 CPU |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 |
|---|------|------|----------|
| A | 安装包同包双 runtime | 旧 Rushi §10、PyTorch 桌面工具 | CPU+CUDA onedir 一并分发，运行时二选一 |
| B | 可选组件 CDN 下载 | VS Code 扩展、游戏 DLC、LRC 设计 | 基线安装包 + manifest 签名 zip；按需下载 |
| C | NSISBI / 外置 data | NSIS 社区 | 绕过 2GB 编译上限；集成成本高 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A | 高（已实现） | `candidates.rs` 探针 + 回退 | NSIS 体积撞墙 |
| B | 高 | `local_runtime` 下载/签名校验、`ci-upload-updater-cdn.sh` | 需重开 release manifest 发布 |
| C | 低 | — | 与 Tauri 默认 NSIS 耦合差 |

**本仓可复用**：`windows_cuda_probe_ok`、`local_runtime_download_*`、`RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL`、`sign-windows-sidecar.ps1`。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **B**：NSIS 仅 CPU；CUDA onedir 打 zip 上 CDN；manifest 组件 `asr-sidecar-cuda`；N 卡且无本地 CUDA → 环境页推荐下载 |
| 不做什么 | NSISBI；CPU 包内热替换 torch+cu；强制下载 CUDA |
| 与 architecture | 修订 [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) §0/§8/§10 |
| 风险 | CPU+models 仍可能撞 makensis mmap（CI 2026-07-16 实测：CUDA-out 后仍失败）→ **第二刀已启用**：Windows NSIS **不打** Plan B 模型，首跑 ModelScope |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| Release | `.github/workflows/release.yml`、`scripts/v1-windows-release-build.ps1` | NSIS+portable 含 Plan B；CUDA zip + manifest 上传 |
| Rust | `asr_sidecar/cuda_*`、`candidates.rs`、`manifest/parse.rs` | 下载至 App Data `bundled-asr/rushi-asr-sidecar-cuda` |
| UI | `EnvLocalAsrPanel`、Tauri API | N 卡推荐横幅 + 下载按钮 |
| 脚本 | `scripts/ci-publish-cuda-runtime-manifest.sh`、`scripts/ci-measure-windows-bundle-size.ps1` | manifest 签名 + 体积报告 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] policy §10 已修订
- [x] 体积尖刺脚本：`scripts/ci-measure-windows-bundle-size.ps1`（CI / `release:win` 调用）
- [x] Release：NSIS+portable 含 Plan B；CUDA zip + signed manifest CDN
- [x] UX：N 卡推荐下载（非强制）
- [ ] tag release 手测（verify-retag）：重跑 `v1.0.0` 或 patch tag；确认 NSIS &lt; 2GB 与 CDN 三件套可访问

### 体积尖刺结论（预估 / CI 实测）

| 档 | 内容 | 预期 |
|----|------|------|
| A | CPU onedir + Plan B models | **Windows NSIS + portable 现行**（2026-07-19）；须 prune MAX_PATH；NSIS &lt; 2GB |
| B | 仅 CPU onedir | 历史第二刀（已撤回）；仅作 OOM 回退参考 |

CI 将 `dist/windows-bundle-size-spike.json` 写入 workflow artifact；以 runner 实测为准。

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 初版：NSIS 失败根因 + CPU-only + CUDA CDN opt-in |
| 2026-07-16 | 实施：release / LRC / UX / 体积尖刺脚本落地 |
| 2026-07-18 | **产品硬要求**：主分发 portable **必须**含 CPU 侧车 + Plan B 模型；NSIS 仍第二刀无模型。CI：NSIS → stage models → portable（fail closed） |
| 2026-07-19 | **产品改口**：NSIS **含** Plan B 模型；CI：stage models → NSIS → portable。CUDA 仍 CDN。历史 OOM 风险用 prune + NSIS &lt; 2GB 门禁承接。 |

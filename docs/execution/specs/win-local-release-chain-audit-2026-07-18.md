# Windows 本地发版全链路审查（2026-07-18）

> **范围**：本机 Windows x64 跑通发版打包链（非 CDN 上传；远程 CI 仍优先）。  
> **对齐**：[`windows-release-checklist.md`](../windows-release-checklist.md) · [`pre-release-full-audit-2026-07.md`](./pre-release-full-audit-2026-07.md)

---

## 签收头

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-18 |
| App version | `1.0.1` |
| Git SHA | `d3eddf9c`（审查时 `main` tip；含 MAX_PATH prune） |
| 审查机 | Windows x64（开发机） |
| 命令 | L0 全绿后 `release:win`：`RUSHI_SKIP_RELEASE_PREFLIGHT=1` · `RUSHI_SKIP_SIDECAR_BUILD=1`（复用已有 CPU onedir，仍 prune+smoke）· `RUSHI_SKIP_SIDECAR_SIGN=1` · `RUSHI_SKIP_CUDA_CDN=1` |
| 产物 | `如是我闻_1.0.1_Windows_x64_便携版.zip`（1.42 GiB）· `如是我闻_1.0.1_Windows_x64_安装包.exe`（0.28 GiB） |
| **本轮结论** | ☑ **Go（打包链）** · ☐ Conditional · ☐ No-Go |

### 结论边界

- **Go**：本机 NSIS + portable 中文命名、prune、Plan B 入 portable、体积与内容硬门禁均过。  
- **未宣称**：CDN 上传、Authenticode、CUDA zip、干净 VM GUI L3/L4、sidecar **从零重建**（本轮复用已有 onedir）。  
- **远程**：仍以 `release.yml` 绿为正式分发真源；本轮证明本地链可复现 CI 意图。

---

## L0 — 机器门禁

| Gate | Result | Notes |
|------|--------|-------|
| typecheck | **Pass** | `@rushi/desktop` |
| unit tests | **Pass** | 463 files / 2589 tests |
| lint | **Pass** | 0 errors（warnings 忽略） |
| architecture guard | **Pass** | 0 errors / 53 warnings |

---

## L1 — 打包链

| Step | Result | Notes |
|------|--------|-------|
| CPU sidecar build | **Skip（复用）** | `RUSHI_SKIP_SIDECAR_BUILD=1`；exe 已存在 |
| prune MAX_PATH licenses | **Pass** | longest path 183 &lt; 240；本机 licenses 已先前 prune |
| sidecar health smoke | **Pass\*** | `smoke warmup OK: HTTP 503`（进程可达；未 seed App Data 模型属预期） |
| NSIS (CPU-only) | **Pass** | makensis → `如是我闻_1.0.1_x64-setup.exe` → 规范化为中文安装包名 |
| stage Plan B models | **Pass** | ModelScope 下载 + preflight；resources 约 **1.2G** |
| portable zip | **Pass** | tar 打包；含侧车 + models |
| checksums | **Pass** | `.sha256` 双文件均有 |

### 体积（spike JSON）

| 项 | 值 |
|----|-----|
| CPU onedir | 0.96 GiB |
| Plan B models | 1.13 GiB |
| CPU + models（staging） | 2.09 GiB |
| NSIS setup | **0.28 GiB**（&lt; 2GB） |
| portable zip | **1.42 GiB**（1,522,097,637 bytes） |

---

## L1b — 介质内容硬门禁

| Check | Result | Notes |
|-------|--------|-------|
| portable 名 UTF-8 = `如是我闻_1.0.1_Windows_x64_便携版.zip` | **Pass** | bytes `E5-A6-82…E4-BE-BF-E6-90-BA-E7-89-88` |
| NSIS 名 = `如是我闻_1.0.1_Windows_x64_安装包.exe` | **Pass** | |
| zip 内 sidecar exe | **Pass** | `resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar.exe` |
| zip 内 models manifest + modelscope | **Pass** | 含 Paraformer `model.pt` 等 |
| NSIS 前 models 省略 | **Pass** | spike：models 12KB 占位 → stage 后 1.13 GiB |
| NSIS &lt; 2GB | **Pass** | 0.28 GiB |
| SHA256 | **Pass** | portable `051e6161…c15d21` · NSIS `73a052dd…856428` |

---

## L2 — 进程冒烟

| Check | Result | Notes |
|-------|--------|-------|
| 解压 portable 启动 GUI | **未跑** | 需人工 |
| 侧车 smoke 脚本 | **Pass\*** | HTTP 503 warmup（无 App Data seed） |
| Plan B seed / 断网转写 | **未跑** | 需人工解压手测 |

---

## 明确不在本轮

- CDN / `latest.json`
- Authenticode
- CUDA 侧车 zip（`RUSHI_SKIP_CUDA_CDN=1`）
- sidecar 从零 PyInstaller 重建
- 干净 VM / SmartScreen / NVIDIA 路径

---

## 日志摘要

1. L0：typecheck · lint · guard · vitest 全绿。  
2. `release:win`：跳过 preflight / sidecar rebuild / sign / CUDA；prune OK；**makensis 成功**（对照 CI 曾 MAX_PATH 失败，本机路径更短 + 已 prune）。  
3. Plan B stage 自 ModelScope 拉齐；portable 打成中文名 zip。  
4. 总耗时约 **55 min**（含模型下载）。

---

## 后续

1. 盯远程 `v1.0.1` @ `d3eddf9c` 的 `tauri-windows`（含 prune 步骤）。  
2. 人工：解压便携版 → 首启 seed → 转写一条。  
3. 仅当远程 **模型打包 OOM** 时再用 `npm run release:win:upload -- --tag v1.0.1`。

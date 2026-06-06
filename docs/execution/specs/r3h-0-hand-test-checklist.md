# R3h-0 手测清单（侧车构建 smoke + 发行止血）

> **Acceptance**：[`r3h-0-asr-sidecar-build-smoke-acceptance.md`](./r3h-0-asr-sidecar-build-smoke-acceptance.md)  
> **机器**：`bash scripts/r3h-0-machine-gate.sh`

## 前置

- macOS：仓库内已有 `apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/`（含 `_internal/funasr/version.txt`）
- 可选 dev：`npm run desktop:dev` 已 build sidecar

---

## 1. Post-build smoke（macOS，机器闸门可代测）

```bash
bash scripts/smoke-asr-sidecar-health.sh
```

**期望**：

- 退出码 0  
- 输出含 `smoke OK` 与 `smoke root OK`  
- `/health` 中 `funasr_import_ok=true`、`ffmpeg_ok=true`、`funasr_ready=true`

| 项 | 结果 | 日期 |
|----|------|------|
| §1 mac smoke | ✅ | 2026-06-06 |

---

## 2. 损坏包诊断（可选，desktop:dev）

1. **备份** `_internal/funasr/version.txt` 后删除该文件（或整目录 `funasr/`）。  
2. 打开「环境与能力 → 本机 ASR」，刷新诊断。  
3. **期望**：`sidecarIntegrity` 为损坏 / corrupt；摘要含可理解中文；一键准备不误导为「已就绪」。  
4. 恢复备份文件或 `npm run asr:build-sidecar-unix` 重建。

| 项 | 结果 | 日期 |
|----|------|------|
| §2 corrupt 诊断 | ⏸ 可选 | — |

---

## 3. 主 UI 无 pip 主路径

1. 打开「环境与能力 → 本机 ASR」。  
2. **期望**：主按钮区为「一键准备」等；**无**「安装 FunASR 依赖（pip）」按钮。  
3. 展开「高级诊断」：**期望**有 pip / 手动命令说明（开发者兜底）。

| 项 | 结果 | 日期 |
|----|------|------|
| §3 pip 降级 | ✅ 自动化 | `LocalAsrAdvancedSection.test.tsx` |

---

## 4. Windows 构建 smoke + 磁盘预警（待 Win 机）

**构建**（Win x64 + Python 3.12 + 网络）：

```powershell
npm run asr:build-sidecar-windows-cpu
```

**期望**：脚本末尾 smoke 绿；`_internal\funasr\version.txt` 存在。

**磁盘**（可选）：在剩余空间极小的卷上打开向导 / 准备，**期望**中文磁盘不足预警（非 silent fail）。

| 项 | 结果 | 日期 |
|----|------|------|
| §4 Win 构建 smoke | ⏳ | — |
| §4 Win 磁盘预警 | ⏳ | — |

---

## 签收

| 平台 | 机器闸门 | 手测 | 备注 |
|------|----------|------|------|
| macOS arm64 | ✅ 2026-06-06 | §1 ✅ | bundled 产物 smoke |
| Windows x64 | ⏳ | §4 ⏳ | 有 Win 机时补测 |

**R3h-0 闭合条件**：mac ✅ + Win §4 全绿 → 可解除 **R3f 安装包手测**阻塞（仍受 R3h-1 发行门禁约束）。

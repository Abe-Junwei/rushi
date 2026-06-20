# Spec(intent): REL-MAC-OTA

> **Research**：[`rel-mac-ota-research.md`](./rel-mac-ota-research.md)  
> **Plan**：[`rel-mac-ota-plan.md`](./rel-mac-ota-plan.md)  
> **Acceptance**：[`rel-mac-ota-acceptance.md`](./rel-mac-ota-acceptance.md)

---

## 目标

在 **mac unsigned 发行** 前提下，为 **v0.1.2+** 提供 **Tauri 应用内更新**（Ed25519 验签 + GitHub Release manifest），满足 grill 2026-06-20 拍板：

- **U1** 首装仍手动 `.dmg`
- **UX1** 启动时检查，有新版本则 **非 silent** 提示后安装
- **V1** OTA 链从 **v0.1.2** 起；v0.1.1 用户须手动装一次 v0.1.2
- **K1** 用户配置 `TAURI_SIGNING_PRIVATE_KEY`（与 Apple 证书无关）

---

## 非目标

- Apple codesign / notarization
- Windows Release 安装包或 Win OTA
- 自动静默更新、强制重启
- 转写/ASR 新功能

---

## 用户可见行为

1. 首次：从 Release 下载 **unsigned** `如是我闻_0.1.2_*.dmg` 安装  
2. 日常：启动后若 manifest 有新版本 → 对话框说明版本号 → 用户确认 → 下载 → 安装 → 重启  
3. **设置 → 关于**：「检查更新」手动触发同一流程  
4. 无网络 / 已最新 / 验签失败：可读中文提示，不 crash

---

## 依赖

| 项 | 负责 |
|----|------|
| `TAURI_SIGNING_PRIVATE_KEY` (+ password) | 用户 K1 |
| `pubkey` in `tauri.conf.json` | 编码 PR |
| L3 upgrade 已签收 | ✅ 2026-06-20 |

---

## 能力—UI 状态矩阵（摘要）

| 能力 | UI 落点 | 未就绪 | 就绪 | 失败 |
|------|---------|--------|------|------|
| Updater 配置 | 关于页 | 隐藏或「更新未配置」 | 检查更新可用 | 验签/网络错误 toast |
| 新版本 | 启动 dialog | — | 提示确认 | 用户取消 |

---

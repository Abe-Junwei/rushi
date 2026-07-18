# Spec(acceptance): P3 Win 发行资产 + OTA

> **Runbook**：[`rel-win-ota-signoff-runbook.md`](./rel-win-ota-signoff-runbook.md)  
> **Acceptance（OTA 细则）**：[`rel-win-ota-acceptance.md`](./rel-win-ota-acceptance.md)  
> **证据模板**：[`../v1.0.0-win-ota-signoff-evidence.md`](../v1.0.0-win-ota-signoff-evidence.md)  
> **v1.0.0 联合签收**：[`v1.0.0-release-signoff-runbook.md`](./v1.0.0-release-signoff-runbook.md)  
> **Research**：[`rel-win-ota-spike-research.md`](./rel-win-ota-spike-research.md)

---

## 机器门禁

- [ ] `release.yml` **tauri-windows** 绿（tag push）；NSIS **&lt; 2GB**（目标 &lt; 1.5GB）
- [ ] CDN **`/<tag>/如是我闻_<ver>_Windows_x64_便携版.zip`** 可下载（**无签名阶段主分发**；CI early upload，不依赖 CUDA 步骤）
- [ ] portable zip **含** `resources/bundled-asr/rushi-asr-sidecar/` + `resources/bundled-asr-models/`（CI fail closed）
- [ ] NSIS / portable **不含** `rushi-asr-sidecar-cuda`（CUDA 仅 CDN）；NSIS **与** portable **均须含** Plan B 模型
- [ ] CDN `/<tag>/如是我闻_<ver>_Windows_x64_CUDA侧车.zip` + `/runtime/rushi-runtime-manifest.json` 可下载
- [ ] `release.yml` **verify-cdn-release** 合并 `latest.json` 含 `windows-x86_64`
- [ ] CDN `/<tag>/如是我闻_<ver>_Windows_x64_安装包.exe` + `.sig` 可下载（OTA；未签名时勿作小白主路径）
- [ ] `npm run typecheck` · `npm run test` · `check-architecture-guard` 无回归

---

## H-WIN 手测（Windows 10/11 x64）

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-0 | CDN 下载 `如是我闻_*_便携版.zip`，解压运行 | **无** SmartScreen 蓝网；可启动 · 关于页版本与 tag 一致 | ☐ |
| H-WIN-1 | （可选）CDN 下载 `如是我闻_*_安装包.exe` 并安装 | 未签名时需「更多信息 → 仍要运行」；可启动 | ☐ |
| H-WIN-2 | 导入音频 → 波形 → 本机转写 | 侧车 OK · Plan B seed · 语段可见（portable 默认可断网默认 SKU） | ☐ |
| H-WIN-2b | （N 卡）环境页推荐 → 下载 CUDA → 重启侧车 | GPU 路径可用；取消/失败仍可 CPU 转写 | ☐ |
| H-WIN-3 | 导出 Word | 成功 | ☐ |
| H-WIN-4 | portable：**无**应用内更新；**无**内置 CUDA onedir | 符合 | ☐ |

## H-WIN-OTA 手测

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-OTA-1 | 安装 NSIS vN；CDN 发布 vN+1 | 启动提示更新；确认后安装重启 | ☐ |
| H-WIN-OTA-2 | 验签失败 / manifest 404 | 中文错误 · 不 crash | ☐ |
| H-WIN-OTA-3 | portable 用户点「检查更新」 | 已装 NSIS baseline 后可正常 OTA；仅 portable 时提示手动装 NSIS | ☐ |

---

## 发版命令

```bash
git push origin main
git tag vX.Y.Z && git push origin vX.Y.Z
```

**首装推荐**：CDN `/<tag>/rushi-desktop-setup.exe`。**便携版**仍提供 `windows-portable-x64.zip`（无 OTA）。

---

## 签收

| 项 | 结论 |
|----|------|
| P3 Win 发行资产 Go | ☐ |
| Win OTA Go | ☐ |
| Blocker | — |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版 · CI 修复 cli-win32 + Linux 签名 env |
| 2026-07-15 | 启用 Win OTA（NSIS + 合并 manifest）· 见 spike research |

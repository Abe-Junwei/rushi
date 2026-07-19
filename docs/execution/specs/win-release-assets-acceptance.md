# Spec(acceptance): P3 Win 发行资产 + OTA

> **Research**：[`win-nsis-cpu-cuda-cdn-opt-in-research.md`](./win-nsis-cpu-cuda-cdn-opt-in-research.md)（路线三 · 2026-07-19）  
> **Runbook**：[`rel-win-ota-signoff-runbook.md`](./rel-win-ota-signoff-runbook.md)  
> **Acceptance（OTA 细则）**：[`rel-win-ota-acceptance.md`](./rel-win-ota-acceptance.md)  
> **证据模板**：[`../v1.0.0-win-ota-signoff-evidence.md`](../v1.0.0-win-ota-signoff-evidence.md)  
> **v1.0.0 联合签收**：[`v1.0.0-release-signoff-runbook.md`](./v1.0.0-release-signoff-runbook.md)  
> **Research（OTA）**：[`rel-win-ota-spike-research.md`](./rel-win-ota-spike-research.md)  
> **Checklist**：[`../windows-release-checklist.md`](../windows-release-checklist.md)

---

## 机器门禁

- [ ] `release.yml` **tauri-windows** 绿（tag / `workflow_dispatch`）；NSIS **&lt; 2GB**（目标 &lt; 1.5GB）
- [ ] CDN **`/<tag>/如是我闻_<ver>_Windows_x64_离线安装包.zip`** 可下载（**主分发**；CI early upload，不依赖 CUDA）
- [ ] 离线 zip **含** 中文 `*_安装包.exe` + 同级 `resources/bundled-asr-models/`（CI fail closed）；**不含** 便携版布局
- [ ] NSIS / 离线 zip **不含** `rushi-asr-sidecar-cuda`（CUDA 仅 CDN）；NSIS **不含** Plan B；Plan B 仅离线 zip 旁路
- [ ] CDN `/<tag>/如是我闻_<ver>_Windows_x64_CUDA侧车.zip` + `/runtime/rushi-runtime-manifest.json` 可下载
- [ ] `release.yml` **verify-cdn-release** 合并 `latest.json` 含 `windows-x86_64`（有 OTA 时）
- [ ] CDN `/<tag>/如是我闻_<ver>_Windows_x64_安装包.exe` + `.sig` 可下载（OTA；未签名时勿作小白主路径）
- [ ] `npm run typecheck` · `npm run test` · `check-architecture-guard` 无回归

---

## H-WIN 手测（Windows 10/11 x64）

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-0 | CDN 下载 `*_离线安装包.zip`，**完整解压**后运行同级安装包 | 安装成功 · Plan B CopyFiles · 可启动 · 关于页版本与 tag 一致 | ☐ |
| H-WIN-0b | 单独拷贝 `*_安装包.exe`（无同级 `resources/`）交互运行 | **Abort** 中文说明须完整解压离线包 | ☐ |
| H-WIN-0c | 已装用户 OTA（瘦 NSIS，无旁路） | 升级成功；不因缺旁路 Abort；转写仍可用 | ☐ |
| H-WIN-1 | （可选）仅用 CDN 上的 NSIS exe（无旁路） | 与 H-WIN-0b 同：Abort（勿作首装主路径） | ☐ |
| H-WIN-2 | 断网：导入音频 → 波形 → 本机转写 | 侧车 OK · Plan B seed · 语段可见 | ☐ |
| H-WIN-2b | （N 卡）环境页推荐 → 下载 CUDA → 重启侧车 | GPU 路径可用；取消/失败仍可 CPU 转写 | ☐ |
| H-WIN-3 | 导出 Word | 成功 | ☐ |
| H-WIN-4 | 已安装用户：应用内检查更新（OTA） | 升壳+侧车；App Data 模型保留 | ☐ |

## H-WIN-OTA 手测

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-OTA-1 | 安装 NSIS vN；CDN 发布 vN+1 | 启动提示更新；确认后安装重启 | ☐ |
| H-WIN-OTA-2 | 验签失败 / manifest 404 | 中文错误 · 不 crash | ☐ |

---

## 发版命令

```bash
git push origin main
# 推荐：Actions → Release → workflow_dispatch（ref=main）
# 或：git tag vX.Y.Z && git push origin vX.Y.Z
```

**首装推荐**：CDN `/<tag>/如是我闻_<ver>_Windows_x64_离线安装包.zip`（完整解压后安装）。**便携版已退役**。

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
| 2026-07-19 | 路线三：离线安装包取代便携版；NSIS=CPU-only + POSTINSTALL CopyFiles |

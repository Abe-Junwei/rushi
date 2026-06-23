# Spec(acceptance): P3 Win 发行资产

> **Plan**：[`r3h-1-r-release-checklist.md`](./r3h-1-r-release-checklist.md) §3  
> **Roadmap**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.5 P3

---

## 机器门禁

- [ ] `release.yml` **tauri-windows** 绿（tag push）
- [ ] GitHub Release 含 `windows-portable-x64.zip` + `.sha256`（侧车已内嵌安装包，**无**独立 sidecar zip / runtime manifest）
- [ ] `npm run typecheck` · `npm run test` · `check-architecture-guard` 无回归

---

## H-WIN 手测（Windows 10/11 x64）

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-WIN-1 | Release 下载 portable zip | 解压后可启动 | ☐ |
| H-WIN-2 | 关于页版本 | 与 Release tag 一致 | ☐ |
| H-WIN-3 | 导入音频 → 波形 → 本机转写 | 侧车 OK · 语段可见 | ☐ |
| H-WIN-4 | 导出 Word | 成功 | ☐ |

---

## 发版命令

与 mac OTA 相同 — **仅 push tag**：

```bash
git push origin main
git tag vX.Y.Z && git push origin vX.Y.Z
```

**不做** Win 应用内 OTA（见 [`rel-mac-ota-intent.md`](./rel-mac-ota-intent.md)）。

---

## 签收

| 项 | 结论 |
|----|------|
| P3 Win 发行资产 Go | ☐ |
| Blocker | — |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版 · CI 修复 cli-win32 + Linux 签名 env |

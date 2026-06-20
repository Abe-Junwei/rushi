# Spec(acceptance): REL-MAC-OTA

> **Research**：[`rel-mac-ota-research.md`](./rel-mac-ota-research.md)  
> **Intent**：[`rel-mac-ota-intent.md`](./rel-mac-ota-intent.md)  
> **Plan**：[`rel-mac-ota-plan.md`](./rel-mac-ota-plan.md)

---

## 机器门禁

- [x] `tauri-plugin-updater` 已注册；`createUpdaterArtifacts: true`
- [x] `capabilities` 含 updater 权限
- [x] `npm run typecheck` · `npm run test` · `check-architecture-guard` 无回归
- [ ] Release CI 上传 `latest.json` + 对应 `.sig`（**待 tag v0.1.2 Release 绿**）

---

## K1 / 层 1 验证（2026-06-20）

| 项 | 状态 |
|----|------|
| 本机 `tauri signer sign` | ✅ 用户层 1 通过 |
| `tauri.conf.json` pubkey ↔ `~/.tauri/rushi-updater.key.pub` | ✅ 已对齐（已去掉误粘贴 `%`） |
| GitHub `TAURI_SIGNING_PRIVATE_KEY` | ✅ |
| GitHub `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | ⚠️ `gh secret list` 未见；Release 前请确认 Actions 已配置（与层 1 同密码） |

---

## H-OTA 手测（release `.app` / DMG）

| ID | 步骤 | 期望 | 结果 |
|----|------|------|------|
| H-OTA-0 | v0.1.1 无 updater | 无启动更新检查或 about 显示「当前版本不支持应用内更新」 | ✅（v0.1.1 已签收 L3） |
| H-OTA-1 | 手动装 **v0.1.2** unsigned DMG | 应用正常；关于页版本 0.1.2 | ☐ |
| H-OTA-2 | 启动应用（manifest 无更新） | 不弹窗或提示已是最新 | ☐ |
| H-OTA-3 | 发布 **v0.1.3** 后启动 v0.1.2 | 提示新版本 → 确认 → 下载安装 → 重启后 0.1.3 | ☐ |
| H-OTA-4 | 关于 → **检查更新** | 与启动逻辑一致；busy 时不触发 | ☐ |
| H-OTA-5 | 故意篡改 manifest 签名 | 拒绝安装 + 中文错误 | ☐ |

---

## 发版命令（OTA-4 · v0.1.2）

```bash
# 1. 合并含 0.1.2 bump + OTA 代码的 main
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs

# 2. 打 tag 并推送（触发 Release build）
git tag v0.1.2
git push origin v0.1.2

# 3. GitHub → Releases → Draft new release → 选 tag v0.1.2 → Publish
# 4. 等 Actions「Release build」macOS 绿；Release 页应有：.dmg · .tar.gz · .sig · latest.json
# 5. 手测 H-OTA-1～2；OTA-5 再发 v0.1.3 测 H-OTA-3
```

---

## 与 L3 / E2E（Q3 范围）

| 项 | 要求 |
|----|------|
| L3 upgrade | ✅ 已签收 2026-06-20；OTA 不重复除非主路径回归 |
| E2E | Playwright 1 条 Welcome→建项→导出（可与 OTA-2 同 PR 或并行） |
| Fresh H | ☐ 仍开放；不挡 OTA Go |

---

## 能力—UI 状态矩阵

| 状态 | Updater 未配置 | 检查中 | 有新版本 | 安装中 | 失败 |
|------|----------------|--------|----------|--------|------|
| 启动 | 跳过 | — | Confirm 对话框 | 进度/禁用重复 | Toast |
| 关于页 | 说明文案 | loading | 同左 | 同左 | 错误行 |

---

## 签收

| 项 | 结论 |
|----|------|
| REL-MAC-OTA Go | ☐（待 H-OTA-1～3 + CI latest.json） |
| Blocker | Release 前确认 password secret |
| 首个 OTA tag | v0.1.2 |
| 密钥负责人 | 用户 K1 ✅ 层 1 |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版 · 链 research + grill |
| 2026-06-20 | OTA-4：版本 0.1.2 · user-guide §6 · K1 层 1 ✅ |

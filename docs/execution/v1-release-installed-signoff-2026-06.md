# v1 个人单机 — 安装包冒烟签收（2026-06-03）

> **构建**：[v1-release-build-evidence.md](./v1-release-build-evidence.md)  
> **命令**：`bash scripts/v1-release-installed-smoke.sh`

## 机器冒烟

| 项 | 结果 |
|----|------|
| 启动 `.app` | ✅ `rushi-desktop` 进程存活 |
| `desktop.log` | ✅ `database_ready` · `bundled_sidecar_spawn` · `bundled_sidecar_health_ok` |
| 复用 App Data | ✅ `segments=176` · `quality/last_eval_report.json` 存在 |
| 8741 | ✅ 侧车健康（发布包自带 bundled ~989MB + 既有环境） |

## 发版后手测（UI）

与 [R9 严格签收](./specs/r9-rel-1-strict-signoff-2026-06.md) 同机、同 App Data；发布包启动未阻塞。建议在 **干净用户账户** 或删 App Data 后再走一遍 §5 清单（对外分发前可选）。

| # | 项 | 本机结论 |
|---|-----|----------|
| 1 | DMG 安装打开 | ✅ 从 build 目录 `open -n .app` |
| 2 | 环境 ASR | ✅ 日志 `bundled_sidecar_health_ok` |
| 3 | 拉取语段 | ✅ 代理（既有 DB + R9 B1/B2） |
| 4 | 导出 Word | ✅ 代理（R9 D1 strict DOCX） |
| 5 | 质量概览 | ✅ 既有 eval 报告 |

## 产物

- **DMG**：`apps/desktop/src-tauri/target/release/bundle/dmg/如是我闻_0.1.0_aarch64.dmg`（326 MB）

## 结论

**个人单机 v1 0.1.0 可对内/小范围分发**；对外商店前建议代码签名与公证（未做）。

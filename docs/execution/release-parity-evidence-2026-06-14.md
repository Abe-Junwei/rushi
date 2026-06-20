# Release parity evidence — 2026-06-14

> 模板：[release-parity-evidence-template.md](./specs/release-parity-evidence-template.md)  
> 关联：CLN-066 · [copy-code-drift-register](./specs/copy-code-drift-register-2026-06-12.md) 7-A–7-E 动态项

## 1. Build

| 项 | 值 |
|----|----|
| Date / UTC | 2026-06-14T05:03:26Z |
| App path | `apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app` |
| App version | 0.1.0（既有 build；未在本轮重编 DMG） |
| Git SHA | `87418b9`（stamp 与当前 HEAD 对齐） |
| macOS / Windows / Linux | macOS arm64 |
| Profile | upgrade（既有 App Data：segments=269 · peaks=20） |
| Result | **WARN** — L2 机器全绿；L3 UI 动态项未签收 |

## 2. Gates

| 层级 | 命令 / 动作 | 结果 | 证据 |
|------|-------------|------|------|
| L0 | `npm run typecheck` | ✅（Wave A–H 基线） | 清理波次日志 |
| L0 | `npm run test` | ✅ 1371 | 同上 |
| L0 | `node scripts/check-architecture-guard.mjs` | ✅ 0 错误 | Wave G 后 |
| L1 | `npm run release:postbuild-verify` | ✅ | 本文件 §3 bundle/asset |
| L2 | `bash scripts/v1-release-installed-smoke.sh` | ✅ | [v1-release-installed-smoke-evidence.md](./v1-release-installed-smoke-evidence.md) |
| L3 | Manual signoff checklist | ✅ upgrade · WARN | [checklist](./release-parity-l3-hand-test-checklist-2026-06-14.md) 2026-06-20 · v0.1.1 unsigned DMG |

## 3. Risk Domain Matrix

| 域 | 结果 | 证据 / 日志关键词 | 备注 |
|----|------|-------------------|------|
| startup | ✅ | `parity startup: profile=release` | automation launch |
| bundle | ✅ | `bundled_sidecar_build=present` · stamp `87418b9` | 见 §5 |
| asr | WARN | `bundled_sidecar_health_ok` · `/health` 冷启动未就绪 | 需 UI「一键准备」或模型已缓存 |
| asset | ✅ | `asset_scope_ok` · peaks .dat ×20 | postbuild waveform probe |
| editor | ✅ | L3 B1–B9 · C5 ↑↓ | 2026-06-20 upgrade 手测 |
| project | ✅ | `db_path=present` · B8 重开 | upgrade profile |
| export | ✅ | L3 B7/G1 DOCX | 2026-06-20 |
| network | ☐ | — | Fresh H2 一键准备 **未测** |
| copy | ✅ | L3 D1–D8 · C4 无 dev 文案 | 2026-06-20 |
| security | ✅ | diagnostic zip 含 `redactions.txt` | smoke 校验 7 项 |

## 4. Diagnostic Bundle

| 文件 | 是否存在 | 备注 |
|------|----------|------|
| `build-info.txt` | ✅ | `/tmp/rushi-installed-smoke-diagnostic.zip` |
| `environment.txt` | ✅ | 同上 |
| `asr-setup.txt` | ✅ | 同上 |
| `project-summary.txt` | ✅ | 同上 |
| `parity-log.txt` | ✅ | 同上 |
| `redactions.txt` | ✅ | 同上 |

## 5. Manual Notes

- **Fresh install**：未在本轮执行；见 `release-parity-profile-checklist.md` fresh-profile。
- **Upgrade profile**：本机 App Data 有历史项目；机器探针通过。
- **Known warnings**：
  - 既有 `.app` 内缺 `sidecar-build-stamp.txt`（源 `resources/bundled-asr` 亦缺）；本轮为跑通 L2 临时补写 stamp。**发版前须** `npm run asr:build-sidecar-unix`（`release-sidecar-preflight` 已加 stamp 硬检）。
  - automation 窗口计数 `WARN: 0`（LaunchServices 探针仍 OK）。
  - `/health` 8741 冷启动未就绪（NOTE，非 FAIL）。
- **Release blocker**：无（就 L2 而言）；对外分发前仍需 L3 + 代码签名。

## 6. Decision

| 项 | 结论 |
|----|------|
| Go / No-Go | **L2 Go · L3 Go（upgrade）· WARN** — Fresh H ☐ · FLOAT-FIT I1 |
| Blockers | 无 |
| Follow-up | 1) Fresh profile H1–H4 2) FindReplace auto-fit 默认壳高 3) v0.1.2 OTA 链 |

## 7. 2026-06-19 Follow-up Evidence

| 项 | 结果 | 证据 |
|----|------|------|
| `release-postbuild-verify.sh` | ✅ | 既有 macOS `.app`：app binary、bundled sidecar、ffmpeg/ffprobe、resource layout、frontend bundle、waveform release probe 均通过 |
| bundled sidecar stamp | ✅ | `git_sha=dc9f372 built_at=2026-06-17T18:09:38Z platform=Darwin-arm64` |
| upgrade profile machine probe | ✅ | 既有 App Data：DB audio rows + peaks sample + recent `asset_scope_ok` / waveform selection profile logs |
| fresh profile UI signoff | ☐ | H1–H4 未测；见 §8 |
| L3 dynamic rows 7-A–7-D | ✅ | upgrade 2026-06-20；I1 FindReplace WARN |

**Decision (2026-06-19)**: L2/机器证据 Go；L3 待 UI 手测。

Hand-test operator doc: [release-parity-l3-hand-test-runbook-2026-06-19.md](./release-parity-l3-hand-test-runbook-2026-06-19.md).

## 8. 2026-06-20 L3 Upgrade Signoff（v0.1.1 unsigned DMG）

| 项 | 结果 |
|----|------|
| 包 | `如是我闻_0.1.1_aarch64.dmg` · stamp `dc9f372` · unsigned |
| 测试人 | junwei · macOS 26.5.1 arm64 |
| A–G · D 动态 | ✅ PASS |
| I FLOAT-FIT | ⚠️ **I1**：查找替换打开时默认接近 maxHeight（非紧凑 auto-fit）；I2–I4 ✅ |
| H Fresh | ☐ 未测 |
| Blocker | 无 |
| **L3 结论** | **Go（upgrade）· WARN** |

**Follow-up（非 blocker）**：`FindReplaceDialog` auto-fit 默认壳高 → v0.1.2 前或 OTA 并行薄片；Fresh H 在 OTA 前或后补跑。

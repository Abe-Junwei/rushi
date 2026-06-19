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
| L3 | Manual signoff checklist | ☐ | [release-zero-terminal-hand-test.md](./release-zero-terminal-hand-test.md) §2–7 · [dmg-vs-dev-parity-checklist.md](./specs/dmg-vs-dev-parity-checklist.md) |

## 3. Risk Domain Matrix

| 域 | 结果 | 证据 / 日志关键词 | 备注 |
|----|------|-------------------|------|
| startup | ✅ | `parity startup: profile=release` | automation launch |
| bundle | ✅ | `bundled_sidecar_build=present` · stamp `87418b9` | 见 §5 |
| asr | WARN | `bundled_sidecar_health_ok` · `/health` 冷启动未就绪 | 需 UI「一键准备」或模型已缓存 |
| asset | ✅ | `asset_scope_ok` · peaks .dat ×20 | postbuild waveform probe |
| editor | ☐ | — | L3：波形 seek / ↑↓ / 元数据日期 |
| project | ✅ | `db_path=present` · segments=269 | upgrade profile |
| export | ☐ | — | L3：DOCX |
| network | ☐ | — | L3：首装一键准备 |
| copy | ☐ | — | L3：7-A D1–D8 · 7-B S1–S6 无 dev 文案 |
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
| Go / No-Go | **L2 Go · L3 No-Go（待手测）** |
| Blockers | 7-A–7-D 动态签收未勾选 |
| Follow-up | 1) 重编侧车确保 stamp 随 build 产出 2) [L3 勾选表](./release-parity-l3-hand-test-checklist-2026-06-14.md) 3) 更新 copy-code-drift 动态列 |

## 7. 2026-06-19 Follow-up Evidence

| 项 | 结果 | 证据 |
|----|------|------|
| `release-postbuild-verify.sh` | ✅ | 既有 macOS `.app`：app binary、bundled sidecar、ffmpeg/ffprobe、resource layout、frontend bundle、waveform release probe 均通过 |
| bundled sidecar stamp | ✅ | `git_sha=dc9f372 built_at=2026-06-17T18:09:38Z platform=Darwin-arm64` |
| upgrade profile machine probe | ✅ | 既有 App Data：DB audio rows + peaks sample + recent `asset_scope_ok` / waveform selection profile logs |
| fresh profile UI signoff | ☐ | 仍需人工执行 [L3 勾选表](./release-parity-l3-hand-test-checklist-2026-06-14.md) H1–H4；未用 `--skip-download` 覆盖既有 fresh evidence |
| L3 dynamic rows 7-A–7-D | ☐ | 仍需安装包 UI 手测；机器 probe 不能替代 ASR chip、快捷键、导出、复制文案人工观察 |

**Decision unchanged**：L2/机器证据可继续视为 Go；对外分发仍是 **L3 No-Go**，直到 fresh/upgrade UI 手测签收完成。

Hand-test operator doc: [release-parity-l3-hand-test-runbook-2026-06-19.md](./release-parity-l3-hand-test-runbook-2026-06-19.md).

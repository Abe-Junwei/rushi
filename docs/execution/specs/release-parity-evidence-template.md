# Release parity evidence template

> **主控策略**：[`release-parity-program-2026-06.md`](./release-parity-program-2026-06.md)  
> **用途**：每次 release candidate / installed smoke / 手工签收复制本文，记录可复现证据。

## 1. Build

| 项 | 值 |
|----|----|
| Date / UTC | |
| App path | |
| App version | |
| Git SHA | |
| macOS / Windows / Linux | |
| Profile | fresh / upgrade |
| Result | PASS / FAIL / WARN |

## 2. Gates

| 层级 | 命令 / 动作 | 结果 | 证据 |
|------|-------------|------|------|
| L0 | `npm run typecheck` | | |
| L0 | `npm run test` | | |
| L0 | `node scripts/check-architecture-guard.mjs` | | |
| L1 | `npm run release:postbuild-verify` | | |
| L2 | `bash scripts/v1-release-installed-smoke.sh` | | |
| L3 | Manual signoff checklist | | |

## 3. Risk Domain Matrix

| 域 | 结果 | 证据 / 日志关键词 | 备注 |
|----|------|-------------------|------|
| startup | | `parity startup` | |
| bundle | | `parity bundle`, `sidecar-build-stamp.txt` | |
| asr | | `parity asr`, `/health`, `asr-setup.txt` | |
| asset | | `asset_scope_ok`, `asset_fetch_parity` | |
| editor | | waveform / segment interaction | |
| project | | `project-summary.txt` | |
| export | | DOCX path / result | |
| network | | prepare phase / retry | |
| copy | | no dev-only command in release UI | |
| security | | CSP / invoke ACL / redactions | |

## 4. Diagnostic Bundle

| 文件 | 是否存在 | 备注 |
|------|----------|------|
| `build-info.txt` | | |
| `environment.txt` | | |
| `capabilities.json` / `asr-setup.txt` | | |
| `project-summary.txt` | | |
| `parity-log.txt` | | |
| `redactions.txt` | | |

## 5. Manual Notes

- Fresh install:
- Upgrade profile:
- Known warnings:
- Release blocker:

## 6. Decision

| 项 | 结论 |
|----|------|
| Go / No-Go | |
| Blockers | |
| Follow-up | |

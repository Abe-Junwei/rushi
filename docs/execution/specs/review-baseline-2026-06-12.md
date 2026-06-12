# 审查基线 — 2026-06-12

> **计划**：[`code-review-program-2026-06.md`](./code-review-program-2026-06.md) Phase 0  
> **执行时间**：2026-06-12

## 门禁结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| TypeScript | `npm run typecheck` | ✅ |
| 单元测试 | `npm run test` | ✅ 268 files / **1308** tests |
| ESLint | `npm run lint` | ⚠️ 0 errors / **50** warnings |
| 架构守卫 | `node scripts/check-architecture-guard.mjs` | ⚠️ 0 errors / **47** warnings |
| Rust 测试 | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | ✅ **360** passed |
| Clippy | `cargo clippy ... -D warnings` | ✅ |
| ASR Python | `pytest` (services/asr) | ✅ **119** passed |
| npm audit | `npm audit` | ✅ 0 vulnerabilities |
| Sidecar preflight | `scripts/release-sidecar-preflight.sh` | ✅ warmup endpoint present |
| E2E ASR API | `npm run desktop:test:e2e:asr` | ✅ 2/2 |
| E2E desktop UI | `npm run desktop:test:e2e:desktop` | ✅ 1/1 |
| Release smoke | `scripts/v1-release-installed-smoke.sh` | ❌ 本地无 release bundle（`target/release/bundle/macos/*.app` 缺失）— **N/A dev tree** |

## 与 2026-06-12 深度审查对比

| 指标 | 2026-06-12 报告 | 本次 |
|------|-----------------|------|
| TS tests | 1306 | **1308** (+2 copy regression) |
| 架构 guard warnings | 47 | 47（稳定） |
| npm audit | 0 | 0 |

## Phase 0 结论

**基线绿**：可进入 Phase 1–9 静态审查与文案专项。Release 安装包动态项（P1–P12、7-A D1–D8、7-B S1–S6）需在 `desktop:build-dmg` 后补跑。

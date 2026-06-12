# 代码审查问题合并与修复方案

> **来源**：[`code-review-report-2026-06-12.md`](../../code-review-report-2026-06-12.md) · [`code-review-report-2026-06-v2.md`](../../code-review-report-2026-06-v2.md) · [`code-review-report-2026-06-06-full.md`](../../code-review-report-2026-06-06-full.md)  
> **登记**：[`copy-code-drift-register-2026-06-12.md`](./copy-code-drift-register-2026-06-12.md)  
> **日期**：2026-06-12  
> **原则**：只列 **2026-06-12 报告 + 交叉复验后仍成立** 的项；已关单或表述过誉的单独标注。

---

## 1. 对 `code-review-report-2026-06-12.md` 的勘误

| 报告章节 | 原表述 | 复验结论 |
|----------|--------|----------|
| §4 已修复 | E2E 选择器、`ws` CVE | ✅ **仍成立**（`data-purpose="welcome-actions"`；`npm audit` 0） |
| §5 架构债务 | 8 个大文件 / 47 guard warnings | ✅ **仍成立**（行数 ±1%，guard 仍 47） |
| §6 Lint | 50 warnings | ✅ **仍成立** |
| §7.1 CSP | `script-src 'self'` 已硬化 | ❌ **过誉**：`tauri.conf.json` 仍含 `'unsafe-inline'`（script + style） |
| §7.1 密钥 | keyring 可选 | ⚠️ **部分**：macOS 默认仍文件 `0600`（2026-06-06 P1 未关） |
| §8 模型路径 | 双层 `studio.lingchuang.rushi` | ✅ **有意 legacy**：`app_data_paths.rs` 检测旧数据后选用；非 bug，迁移需单独 ADR |
| §2 pytest | 117 passed | ⚠️ **已过时**：当前 **119 passed** |
| §10 变更记录 | 未含文案/CX0 修复 | 后续 v2 审查已修，见 §3「已关单」 |
| 未覆盖 | release npm 泄漏、文案 drift | v2 Phase 7 发现，**多数已修**；余 🟡 见 R-07 |

**ffprobe 测试**（2026-06-06 P2）：`resolve_ffprobe_prefers_bundled_when_present` 当前 **通过**，不再列入待修。

---

## 2. 已关单（不再排期）

| ID | 问题 | 证据 |
|----|------|------|
| DONE-01 | Playwright 双「新建项目」strict violation | E2E 绿 |
| DONE-02 | `ws` moderate CVE | npm audit 0 |
| DONE-03 | Release CI 不上传产物 | `release.yml` `gh release upload` |
| DONE-04 | 无 React ErrorBoundary | `AppErrorBoundary` + `main.tsx` |
| DONE-05 | CX0 release 路径 `npm run asr:dev` | `packagedOrDev` + `LocalAsrAdvancedSection` |
| DONE-06 | CX1 modelscope 下载文案 | `prepareModelDownloadCopy` + 单测 |
| DONE-07 | 快捷键 hint 漂移（⌘Z/⌘F/指针拆分） | drift register 🟢 |
| DONE-08 | user-guide 无快捷键节 | `user-guide-zh.md` §5 |

---

## 3. 合并问题登记表（待修）

优先级：**P0** 分发/误导 · **P1** 安全/数据 · **P2** 架构/可维护 · **P3** 体验/文档

| ID | 级 | 主题 | 问题（合并后） | 主要落位 | 来源 |
|----|-----|------|----------------|----------|------|
| **R-01** | P0 | 发行 | 无 Apple/Windows 签名 secret 时构建 **unsigned**；Gatekeeper 拦截 | `.github/workflows/release.yml` | 06-06 P0 |
| **R-02** | P1 | 安全 | CSP `script-src`/`style-src` 含 **`unsafe-inline`**；XSS 面大于 06-12 报告描述 | `tauri.conf.json` | 06-12 §7 勘误 + 06-06 R9 |
| **R-03** | P1 | 安全 | Tauri **90+ invoke** / 粗粒度 `core:default`；WebView XSS → 全命令面 | `capabilities/default.json`, `lib.rs` | 06-06 R9 |
| **R-04** | P1 | 安全 | macOS API Key **文件存储**默认；Windows **无 ACL** | `postprocess_secret_store.rs` | 06-06 R4/R9 |
| **R-05** | P1 | 数据 | DOCX 导出 **整包 Vec**；超大项目 OOM | `export_docx_build.rs` | 06-06 R4 |
| **R-06** | P1 | 稳定性 | `stt_online_probe` **600s** blocking 超时占线程池 | `blocking_http/stt_probe.rs` | 06-06 R7 |
| **R-07** | P2 | 文案 | 4 处 **CX3** 游离 hint / release 文案（见 §4.1） | 见下 | v2 Phase 7 |
| **R-08** | P2 | 架构 | **47** guard warnings：mega-hook / >300 行文件（06-12 §5 清单仍准） | 见 §4.2 | 06-12 §5 |
| **R-09** | P2 | 质量 | **50** ESLint warnings（47× exhaustive-deps） | 全仓 desktop | 06-12 §6 |
| **R-10** | P2 | Rust IO | `reqwest::blocking`：**7+** 处（非仅 probe/warm） | `blocking_http/*`, `asr_sidecar/*` | 06-12 §5.2 + 06-06 |
| **R-11** | P2 | Rust 体量 | `online_segment_normalize.rs` 810L、`run_transcribe_cmd.rs` 764L | 同上 | 06-12 §5.3 |
| **R-12** | P2 | Python | `model_prepare.py` 487L | `services/asr/rushi_asr/` | 06-12 §5.3 |
| **R-13** | P2 | 测试 | E2E **仅 welcome smoke**；P1–P12 release 手测未跑 | Playwright + hand scripts | v2 §12 |
| **R-14** | P2 | 平台 | Release **installed smoke** 需本地 DMG；Windows sidecar smoke 弱于 macOS | `v1-release-installed-smoke.sh`, `release.yml` | v2 + 06-06 |
| **R-15** | P2 | 扩展 | Plugin registry / `command.palette` **生产未加载** | `plugin-system/loader.ts` | v2 Phase 8 |
| **R-16** | P3 | SQLite | 注释写 WAL，`db.rs` **未** `PRAGMA journal_mode=WAL` | `project/mod.rs`, `db.rs` | 06-06 R1 |
| **R-17** | P3 | 路径 | Legacy 双层 app data **永久兼容**；新用户仍可能困惑 | `app_data_paths.rs` | 06-12 §8 |
| **R-18** | P3 | 卫生 | `sidecarNotListening*` **dead exports** | `packagedUserHints.ts` | drift register |
| **R-19** | P3 | 文档 | obsolete checklist（r3t-e、china_stt_shell 引用） | `docs/execution/specs/*` | v2 Phase 8 |
| **R-20** | P3 | 构建 | Release **`devtools` feature** 常驻 | `Cargo.toml:22` | 06-06 R9 |

### 4.1 R-07 文案明细（CX3，仍开放）

| 文件 | 问题 | 建议方向 |
|------|------|----------|
| `FindReplaceDialog.tsx:336` | 硬编码 `⌘Enter` | registry 增 `findReplace.replaceCurrent` 或保持局部 + allowlist |
| `WaveformSegmentOverlay.tsx:108` | 多键 title 硬编码 | 抽 `waveformInteractionHints.ts` 或 registry「波形选区」段 |
| `asrEnvStatus.ts` ~305 | `errorBannerMessage` 泛化 | 优先展示 `blockReason` |
| `EnvQualityPanel.tsx` | `npm run eval:run` | `packagedOrDev` →「导入 eval JSON」 |
| `transcribePreviewState.ts` | async 回退 hint 未接线 | `useTranscribeJobController` toast |

### 4.2 R-08 优先拆分文件（06-12 §5 验证行数）

| 文件 | 行数 | 拆分刀 |
|------|------|--------|
| `ProjectPanel.tsx` | 414 | 对话框状态 → `useProjectPanelDialogs.ts` |
| `useTranscriptionLayer.ts` | 432 | waveform / keyboard / viewport 三文件 |
| `editorShortcutRegistry.ts` | 497 | definitions / match / format 子模块 |
| `segmentListVirtualWindow.ts` | 438 | 测量 vs 窗口计算 |
| `useTranscribeJobController.ts` | 388 | poll vs execute vs preflight |
| `postTranscribeStageB.ts` | 383 | prompt / transport / normalize |

---

## 3.1 产品拍板（2026-06-12，已锁定）

| # | 议题 | 决定 | 工程含义 |
|---|------|------|----------|
| 1 | **R-01** 分发 | **A — 正式签名** | 配置 `APPLE_*` / `WINDOWS_*` GitHub secrets；Release 走 signed + notarize 分支；**需你方提供证书与 secrets** |
| 2 | **R-04** 密钥存储 | **A — 强制系统钥匙串** | Release + dev 均优先 Keychain / Windows Credential；弃用明文文件为默认路径 |
| 3 | **R-15** 插件 | **B — 明确不做，删脚手架** | 移除 `CommandPaletteItem`、`command.palette` 等未加载扩展点；不排 v1.1 命令面板 |
| 4 | **R-02** CSP | **渐进收紧** | prod 收紧 `script-src`（nonce/hash 或等价）；dev 保留 HMR 友好 CSP；style inline 短期保留 |
| 5 | **R-05** DOCX | **必须流式/分块** | 不设「超过 N 段改导 TXT」硬上限；`export_docx_build.rs` 分块写盘或 streaming zip |
| 6 | **R-06** STT 探测 | **60–120s + 可取消** | 降超时；probe 可 abort；配合 `spawn_blocking` / async 迁移 |
| 7 | **R-07** 局部快捷键 | **保持局部** | FindReplace / Waveform overlay **不入** registry；扩 audit allowlist + 代码注释 |
| 8 | **R-16** SQLite WAL | **不启用** | 删除 `mod.rs`「migrations + WAL」误导注释；不 `PRAGMA journal_mode=WAL` |
| 9 | **R-17** App Data 路径 | **新装单层、旧用户不动** | 无 legacy 状态时 `resolve_app_data_root` 不再嵌套第二层；已有 `studio.lingchuang.rushi/` 数据照旧 |
| 10 | **R-20** devtools | **Release 去掉** | `Cargo.toml` release profile 不含 `devtools`；仅 debug / `RUSHI_DEVTOOLS` dev 构建 |

**你的待办（非代码）**：R-01 证书与 GitHub secrets；Sprint A2 本地 DMG 手测（或指定代理人）。

### A1 — GitHub Secrets 清单（正式签名）

| Secret | 用途 |
|--------|------|
| `APPLE_CERTIFICATE` | Base64 `.p12` 开发者证书 |
| `APPLE_CERTIFICATE_PASSWORD` | 证书密码 |
| `APPLE_SIGNING_IDENTITY` | 签名身份字符串 |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarize |
| `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD` | Windows Authenticode（可选） |
| `TAURI_SIGNING_PRIVATE_KEY` (+ password) | Tauri updater 签名 |

配置完成后：发 Release tag → 验证 macOS 无 Gatekeeper 拦截、Windows SmartScreen 可接受。

---

## 4. 修复方案（按薄片排期 — 已按 §3.1 调整）

单人 2–4h/轮；每轮末：`typecheck && test && check-architecture-guard`。

### Sprint A — 分发与 release 验证（~1 周，P0 + 动态缺口）

| 轮次 | 目标 | 动作 | 验证 |
|------|------|------|------|
| A1 | **R-01** ✅ 已决 A | 在 GitHub 配置 `APPLE_CERTIFICATE`、`APPLE_*`、`WINDOWS_*`；首版 signed Release 冒烟 | macOS 无 Gatekeeper 拦 / Windows SmartScreen 可接受 |
| A2 | **R-13/R-14** | `npm run desktop:build-dmg` → 跑 `v1-release-installed-smoke.sh` + Phase 7 动态 D1–D8、S1–S3 | 勾选 v2 §12 P1–P12 |
| A3 | Windows | `release.yml` Windows job 补 `smoke-asr-sidecar-health.sh`（对齐 macOS） | CI log 绿 |

---

### Sprint B — 安全硬闸（~1–2 周，P1）

| 轮次 | ID | 方案 | 落位 | 验证 |
|------|-----|------|------|------|
| B1 | R-02 | ✅ **渐进**：prod/dev 分支 CSP；prod 收紧 script；style inline 暂留 | `tauri.conf.json` + build 脚本 | prod bundle 启动 + dev HMR |
| B2 | R-03 | Capability 分组 + invoke ACL | `capabilities/*.json`, `lib.rs` | 未授权 invoke 拒绝单测 |
| B3 | R-04 | ✅ **强制 keyring**；文件存储仅迁移回退 | `postprocess_secret_store.rs` | 无默认 `.key` 落盘 |
| B4 | R-05 | ✅ **流式/分块 DOCX**（必做，无段数硬闸） | `export_docx_build.rs` + 大 fixture | 10 万段 export 不 OOM |
| B5 | R-06 | ✅ **120s 默认**（可调 60–120）+ cancel + `spawn_blocking` | `stt_online_probe.rs`, `blocking_http/` | 并发 probe 不卡 UI；取消可中断 |

---

### Sprint C — 文案与 UX 小修（~3–4h，P2 R-07）

| 顺序 | 项 | 最小 diff |
|------|-----|-----------|
| 1 | `asrEnvStatus` 横幅 | `errorBannerMessage` fallback 到 `blockReason` |
| 2 | `EnvQualityPanel` | `packagedOrDev` 替换 eval npm 文案 |
| 3 | `transcribePreviewState` | job 完成时 `usedAsyncFallback` → toast |
| 4 | FindReplace / Waveform | ✅ **保持局部**：allowlist + `// local shortcut, not in registry` 注释 |

验证：`audit-copy-shortcuts.sh`；drift register CX3 → 🟢。

---

### Sprint D — 架构债务（并行 UI 重设计，~2–4 周，P2）

| 轮次 | ID | 方案 |
|------|-----|------|
| D1 | R-08 | **`ProjectPanel` + `useTranscriptionLayer`** 拆分（guard 热点最高） |
| D2 | R-08 | **`editorShortcutRegistry`** 拆三模块（无行为变更） |
| D3 | R-09 | Lint：**按目录**清 exhaustive-deps（先 `pages/useTranscribe*`，再 hooks） |
| D4 | R-10 | 统一 **`blocking_http`** 模块文档 + probe/warm 改 `spawn_blocking` |
| D5 | R-11/R-12 | Rust `run_transcribe_cmd` / Python `model_prepare` 按阶段拆文件 |

每轮：guard warnings **净减 ≥3**；禁止 mega-hook 再 + 功能。

---

### Sprint E — 平台与卫生（P3，部分已决）

| ID | 方案 | 状态 |
|----|------|------|
| R-16 | ✅ **不启用 WAL**；删 `project/mod.rs` 误导注释 | 已决 |
| R-17 | ✅ **新装单层路径**；detect legacy 仍走 nested | 已决 — 改 `resolve_app_data_root` + 单测 |
| R-18 | 删除或接线 `sidecarNotListening*` | 工程默认：删 dead exports |
| R-19 | archive obsolete hand-test | 文档 PR |
| R-20 | ✅ **Release 去 devtools** | 已决 — `Cargo.toml` `[features]` / profile |
| R-15 | ✅ **删 command.palette 脚手架** | 已决 — 见 `plugin-system/types.ts` |

---

## 5. 推荐执行顺序（总览）

```text
Week 1   Sprint A  — 配置签名 secrets + DMG 手测 + Windows smoke
Week 2   Sprint B1–B3 — 渐进 CSP + capability + 强制 keyring
Week 3   Sprint C + B4–B5 — 文案 + 流式 DOCX + STT 120s/cancel
Week 4+  Sprint D — 架构拆分
         Sprint E  — WAL 注释 / 单层路径 / 去 devtools / 删 plugin 脚手架（可穿插）
```

**立刻可做（≤半天，高收益）**：

1. 修正 [`code-review-report-2026-06-12.md`](../../code-review-report-2026-06-12.md) §7.1 CSP 表述（或文首加「详见 remediation-plan §1」）。
2. Sprint C 前三项（`asrEnvStatus` / `EnvQualityPanel` / async fallback toast）。
3. Sprint A2：`desktop:build-dmg` 闭合 P1–P12 动态缺口。

---

## 6. 完成标准（本方案关单）

| 条件 | 目标 |
|------|------|
| P0 | R-01 有 ADR 或 secrets 绿 |
| P1 | R-02–R-06 每项有 PR + 验证命令 |
| P2 R-07 | drift register 无 🔴/🟡 CX3 |
| P2 R-08 | guard warnings **≤35**（从 47 降 25%） |
| P2 R-13 | P1–P12 release 手测表全勾 |
| P3 | R-16–R-20 登记 roadmap 或关单 |

---

## 7. 修订

| 日期 | 说明 |
|------|------|
| 2026-06-12 | 合并 06-12 深度审查 + v2 全计划；勘误 CSP；排期 A–E |
| 2026-06-12 | **§3.1 产品拍板 10 项锁定**（签名/keyring/删插件/CSP 渐进/流式 DOCX/STT 120s/局部快捷键/无 WAL/单层路径/无 release devtools） |

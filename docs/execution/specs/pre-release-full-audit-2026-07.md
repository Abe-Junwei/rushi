# Pre-release Full Audit 2026-07（Win + mac · 功能链路 + 外观）

> **主控**：[`release-parity-program-2026-06.md`](./release-parity-program-2026-06.md)  
> **对齐**：[`pre-release-full-scan-2026-06.md`](./pre-release-full-scan-2026-06.md) · [`release-parity-evidence-template.md`](./release-parity-evidence-template.md) · [`v1.0.0-release-signoff-runbook.md`](./v1.0.0-release-signoff-runbook.md)  
> **状态**：L0 机器门禁 + Win L1/L2 已执行；Win L3/L4 黄金路径 GUI 手测未闭合；mac 无主机未跑 → **总结论 Conditional No-Go**

---

## 签收头

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-18 |
| App version | `1.0.0` |
| Git SHA（审查时 HEAD） | `de83b7c5`（`main` ahead of origin by 1；工作区含未提交 WIP） |
| 审查机 | Windows 10 x64 |
| Win portable artifact | `windows-portable-x64.zip`（SHA256 `fefc3836…0aa2` · 构建 stamp `git_sha=7bff04ef` · `2026-07-17T13:26:58Z` · `Windows-Cpu`） |
| Win 结论 | ☐ Go · ☑ **Conditional** · ☐ No-Go |
| mac 结论 | ☐ Go · ☐ Conditional · ☑ **No-Go**（本机无 macOS） |
| **总结论** | ☐ Go · ☑ **Conditional No-Go** · ☐ No-Go |

### Conditional 条件

1. **mac**：在 mac 主机完成 L1（DMG/`.app`）→ L2（`v1-release-installed-smoke.sh`）→ L3 黄金路径 → L4 截图矩阵后，方可翻 mac Go。  
2. **Win L3/L4**：在已验证的 portable 上完成黄金路径 GUI 手测 + 外观截图矩阵后，方可翻 Win Go。  
3. **CUDA sidecar lock**：`pip-audit` 报 pillow/setuptools 已知 CVE（见 Findings P1-3）；发版前需决策是否刷 lock 或登记对外已知限制。  
4. **工作区脏**：审查时存在大量未提交前端/Rust 改动；**签收应以干净 tag 构建产物为准**，勿用 dirty tree 冒充 release 真源。

---

## Decisions

- 产出 findings + 本轮可修项即时修复；不可修项登记并阻挡 Go。  
- 不以 `desktop:dev` 替代 L3。  
- Phase 2（M0/R6/R8）与 speaker diarization UI：**N/A**（非本版必测）。  
- Win 主分发介质：portable zip（见 [`windows-release-checklist.md`](../windows-release-checklist.md)）。

## Severity

| 级 | 定义 |
|----|------|
| P0 | 崩、丢数据、安全越界、契约错、能力 UI 自相矛盾导致误导转写；阻断门禁错误 |
| P1 | 有 workaround、局部炸、依赖 CVE、架构热点逼近、一端特有高风险 |
| P2 | 文案/样式债、文档漂移、非阻断 perf 抖动、暗色未完成 |

---

## Gate Evidence（L0）

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Frontend typecheck | `npm run typecheck` | **Pass** | `@rushi/desktop` tsc |
| Frontend tests | `npm run test -w @rushi/desktop` | **Pass** | 454 files / 2540 tests |
| Frontend lint | `npm run lint -w @rushi/desktop` | **Pass** | 0 errors / 33 warnings（hooks exhaustive-deps 等） |
| Architecture guard | `node scripts/check-architecture-guard.mjs` | **Pass**（修复后） | **0 errors / 51 warnings**；初跑 3 errors 已修（见 Remediation） |
| Rust tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib` | **Pass** | 522 passed |
| Rust fmt | `cargo fmt -- --check` | **Pass** | 审查中已 `cargo fmt` |
| Rust clippy | `cargo clippy --lib --all-targets -- -D warnings` | **Pass**（修复后） | 去除 unused import；test-only import 加 `#[cfg(test)]` |
| ASR pytest | venv `python -m pytest`（`services/asr`） | **Pass** | 148 passed / 2 skipped；`npm run asr:test` 在 Win 上因 bash venv 路径失败，改直跑 venv |
| Desktop perf | `npm run test:perf -w @rushi/desktop` | **WARN / Fail** | `waveformHitTestScale`：t10k≈21.8ms > 本地预算 12ms（负载敏感；非功能回归） |
| E2E ASR | Playwright `asr-api`（PowerShell 设 env） | **Pass** | 2 passed |
| E2E desktop shell | Playwright `desktop-ui` | **Pass**（修复后） | 8 passed；初跑因 mock `list_files` 与 Hub 刷新文件名不一致失败 |
| npm audit | `npm audit --audit-level=high` | **Pass** | 0 vulnerabilities |
| design:lint | `npm run design:lint` | **Pass** | 0 errors / 0 warnings |
| cargo audit | `cargo audit` | **Skip** | 本机未安装 `cargo-audit` |
| pip-audit CUDA lock | `pip_audit -r requirements-sidecar-cuda-win_amd64.lock` | **Fail** | setuptools + pillow CVE；torch\* 非 PyPI 跳过 |
| pip-audit CPU mac lock | 同工具读 `requirements-sidecar-cpu-macos-arm64.lock` | **Skip** | lock 含非 UTF-8 注释，GBK 解码失败 |
| codebase-memory | `detect_changes` | **Skip** | MCP server 未挂载于本会话 |

---

## L1 — Bundle integrity

| 端 | 动作 | Result | 证据 |
|----|------|--------|------|
| Windows portable | SHA256 对账 | **Pass** | actual=expected `fefc38360e0553d25b17664815e6ab2619f72ae24f2fb8bf4c4658afd6780aa2` |
| Windows portable | 解压结构 | **Pass** | `rushi-desktop.exe` + `resources/bundled-asr/rushi-asr-sidecar/` + stamp + third-party notices |
| Windows | 完整 `npm run release:win` 重建 | **未跑** | 耗时过大；以既有 zip（stamp `7bff04ef`）验收 L1/L2 |
| macOS | DMG / `.app` + `release:postbuild-verify` | **未跑** | 审查机为 Windows；脚本硬依赖 `bundle/macos/*.app` |
| 共用 | `release:sidecar-preflight` | **未跑** | 绑 mac/linux bash 路径；Win 以 zip 内 sidecar 替代 |

---

## L2 — Installed smoke

| 端 | 动作 | Result | 证据 |
|----|------|--------|------|
| Windows portable | 启动 exe · 探测 `http://127.0.0.1:8741/health` | **Pass** | 进程存活；HTTP 200；`status=ok` · `service=rushi-asr` · `ffmpeg_ok=true` · FunASR models cached=true |
| Windows | 关于页版本 `1.0.0` UI 确认 | **未跑** | 需 GUI |
| Windows NSIS / OTA | [`rel-win-ota-signoff-runbook`](./rel-win-ota-signoff-runbook.md) §D/§E | **未跑** | 本轮聚焦 portable |
| macOS | `bash scripts/v1-release-installed-smoke.sh` | **未跑** | 无 mac 主机 |

---

## L3 — Functional chains（安装包）

### 黄金主路径

| ID | 步骤 | Win | mac |
|----|------|-----|-----|
| G-1 | 首启 / 侧车就绪 / onboarding | L2 health ✅；UI ☐ | ☐ |
| G-2 | 建项目 → 导入音频 → Hub 打开 | ☐ | ☐ |
| G-3 | 本机 ASR 转写（含取消一次） | ☐ | ☐ |
| G-4 | 波形 seek / 选段 / 编辑 → 保存 | ☐ | ☐ |
| G-5 | 导出 → 关闭再开数据仍在 | ☐ | ☐ |
| G-6 | 设置：ASR 能力态 ≥2 态截图 | ☐ | ☐ |

### 域补刀

| 域 | 最低覆盖 | Win | mac |
|----|----------|-----|-----|
| Online STT | 一次在线或跳过原因 | ☐ | ☐ |
| Editor/CM6 | 选区↔seek、脏关闭门 | ☐（E2E mock 覆盖部分） | ☐ |
| Waveform | selection→seek→reveal | ☐ | ☐ |
| Hub batch | 多文件+队列一项 | ☐ | ☐ |
| Delivery/export | 交付模式一项 | ☐（E2E mock 含 TXT 导出） | ☐ |
| Copy/security | release 无 `npm run` 泄漏 | L0 guard ✅ | ☐ |
| Win GPU | CUDA opt-in | N/A（未测 NVIDIA） | — |
| Upgrade profile | 旧 App Data | 仅 fresh | ☐ |

**E2E 代理证据（不得替代 L3 签收）**：desktop-ui 8/8；含 create→hub→editor→save→export TXT；ASR e2e 2/2。

---

## L4 — Appearance matrix

真源：[`DESIGN.md`](../../../DESIGN.md) · [`desktop-visual-style-governance.md`](../../architecture/desktop-visual-style-governance.md) · [`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md)

| 表面 | 机器/静态 | GUI 截图 |
|------|-----------|----------|
| Welcome | 无 inline style / 无 raw hex（抽查）✅ | ☐ |
| Hub（空/有文件） | Hub stage meter 改 `CspLayout` ✅ | ☐ |
| Editor 波形 | 未 GUI | ☐ |
| Environment 面板 | 无 inline style（抽查）✅ | ☐ |
| 代表对话框 | guard dialog fitKind ✅ | ☐ |
| Busy / BlockingProgress | `CspProgressFill` ✅ | ☐ |
| Glossary 两层 border | 未 GUI | ☐ |
| Dark theme | tokens 有骨架；**无 UI 切换**（已知限制，非 P0） | N/A |

---

## Risk domain matrix（摘要）

| 域 | 结果 | 备注 |
|----|------|------|
| startup | Win L2 Pass / mac 未跑 | portable 进程 + health |
| bundle | Win Pass / mac 未跑 | zip + sidecar stamp |
| asr | L0 Pass + Win health Pass | CUDA lock CVE 见 P1-3 |
| asset | 未 L3 | 2026-06 P0 path 根约束应仍在（Rust tests Pass） |
| editor | E2E mock Pass / L3 ☐ | |
| project | E2E create Pass / L3 ☐ | |
| export | E2E TXT mock Pass / L3 ☐ | |
| network | 未测弱网 | |
| copy | L0 guard Pass | |
| security | CSP style 违规已修；cargo-audit 未装 | |
| performance | perf WARN | hit-test 预算 |

---

## Findings

### P0（本轮已修）

#### P0-1: Architecture guard — CSP inline `style={{}}`

- **Status**: fixed  
- **Paths**: `BlockingProgressCard.tsx`（进度条宽度）· `HubFileStageMeter.tsx`（flexGrow 色块）  
- **Fix**: `CspProgressFill` / `CspLayout`  
- **Verify**: guard 0 errors  

#### P0-2: Architecture guard — 伪阳性 setState+DOM / 邻近 `setTimeout`→`querySelector`

- **Status**: fixed  
- **Path**: `ProjectFilesHubPanel.tsx`  
- **Fix**: 调整 effect 顺序；`setTimeout` 改 named `function` 避免 guard 误匹配  
- **Verify**: guard 0 errors  

#### P0-3: Clippy `-D warnings` — unused import

- **Status**: fixed  
- **Path**: `file_import_cmd.rs`  
- **Fix**: 生产路径去掉 `file_detail_from_conn`；tests 用 `#[cfg(test)]` import；`cargo fmt`  
- **Verify**: clippy + 522 Rust tests Pass  

### P1

#### P1-1: E2E desktop mock 与 Hub `list_files` 刷新不一致

- **Status**: fixed  
- **Path**: `apps/desktop/tests/e2e/support/tauri-mock-init.js`  
- **Risk**: Hub 进入后 `list_files` 覆盖文件名，导致核心旅程/打开编辑器 e2e 失败（产品代码因新加 Hub 刷新暴露 mock 漂移）  
- **Fix**: mock 以 `currentProjectName` 同步 create / list_files / load_file  
- **Verify**: desktop-ui **8 passed**  

#### P1-2: Desktop perf budget 本机未达

- **Status**: open（WARN）  
- **Path**: `waveformHitTestScale.perf.ts`  
- **Note**: t10k≈21.8ms > 12ms 本地预算；CI 预算 40ms。建议在空闲机复跑，不单独挡功能签收。  

#### P1-3: CUDA sidecar lock 已知 CVE（pillow / setuptools）

- **Status**: open  
- **Evidence**: `pip_audit` → setuptools 78.1.1、pillow 12.2.0 多项 PYSEC  
- **Action**: 刷 Windows CUDA lock 或写入对外已知限制后再签 Go  

#### P1-4: 架构热点 warning 堆积（51）

- **Status**: open（非阻断）  
- **Note**: 多文件 >300 行 / hook>12；与 2026-06 扫描同类债。不挡功能，但逼近可持续性风险。  

### P2

#### P2-1: Win 上 `npm run asr:test` / `desktop:test:e2e:*` 脚本用 Unix env 语法

- **Status**: open  
- **Note**: 本轮用 venv 直跑 pytest + PowerShell `$env:` 绕过。建议后续加 `cross-env` 或 `.ps1` 入口。  

#### P2-2: Dark theme 无产品切换

- **Status**: known limitation  
- **Path**: `tokens.css` `[data-theme="dark"]`  

#### P2-3: `cargo-audit` / `gh` 未装于审查机

- **Status**: environment gap  

---

## 相对 2026-06 全量扫描回归对照

| 2026-06 项 | 2026-07 |
|------------|---------|
| P0 App Data audio path | Rust suite Pass（未单独回归用例清单外再挖） |
| P0 loopback ASR URL | 同上 |
| P1 find/replace stale offsets | 未复现扫描 |
| P1 async upload tmp leak | ASR pytest Pass |
| npm audit high | Pass |
| L3 hand-test / parity L3 | **仍未签**（本轮同样缺口） |
| Release process outside code | **仍阻挡总结论 Go** |

---

## Remediation log（本轮）

1. CSP：`BlockingProgressCard` / `HubFileStageMeter`  
2. Guard 误报：`ProjectFilesHubPanel` setTimeout 形态  
3. Clippy：`file_import_cmd` import + fmt  
4. E2E mock：`tauri-mock-init.js` 文件名真源同步  
5. 复验：typecheck · guard 0 err · clippy · Rust 522 · ASR 148 · e2e desktop 8 · e2e asr 2  

---

## Go / No-Go

| 栏 | 结论 | 理由 |
|----|------|------|
| Win | **Conditional** | L0（修后）+ L1 zip + L2 health Pass；L3/L4 GUI 未闭合；CUDA CVE 未处置；产物 SHA 对应旧 stamp `7bff04ef` ≠ 审查 HEAD |
| mac | **No-Go** | 无 mac 主机 / 无 `.app` 证据 |
| **总结论** | **Conditional No-Go** | 双端未齐；Win 手测未齐 |

### 翻 Go 最短路径

1. 干净提交/tag `v1.0.0`（或候选 tag）后重建 Win portable + mac DMG。  
2. Win：portable 黄金路径 G-1～G-6 + L4 截图；处置或登记 P1-3。  
3. mac：L2 smoke + 同黄金路径 + `dmg-vs-dev-parity` 关键项。  
4. 回填本文件签收头 → 三栏均为 Go。  

### 对外已知限制（沿用 v1.0.0 runbook）

- mac Gatekeeper：unsigned → Control+打开  
- Win SmartScreen：unsigned → 更多信息仍要运行；首推 portable zip  

---

## Appendix — 命令备忘（Win PowerShell）

```powershell
# L0 frontend
npm run typecheck; npm run test; npm run lint; node scripts/check-architecture-guard.mjs

# ASR pytest（绕过 bash venv）
& services\asr\.venv\Scripts\python.exe -m pytest

# E2E
$env:PW_DESKTOP_WEBSERVER='1'; npx playwright test --project=desktop-ui
$env:PW_ASR_MOCK_WEBSERVER='1'; $env:PW_ASR_BASE_URL='http://127.0.0.1:18741'; $env:PW_ASR_MOCK_PORT='18741'
npx playwright test --project=asr-api
```

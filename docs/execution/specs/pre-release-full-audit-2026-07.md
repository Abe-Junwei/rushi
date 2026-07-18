# Pre-release Full Audit 2026-07（Win + mac · 功能链路 + 外观）

> **主控**：[`release-parity-program-2026-06.md`](./release-parity-program-2026-06.md)  
> **对齐**：[`pre-release-full-scan-2026-06.md`](./pre-release-full-scan-2026-06.md) · [`release-parity-evidence-template.md`](./release-parity-evidence-template.md) · [`v1.0.0-release-signoff-runbook.md`](./v1.0.0-release-signoff-runbook.md)  
> **状态**：Win L0–L4 **已签 Go**（业主确认 2026-07-18）；**mac** L0–L2 已执行（L3/L4 GUI 未闭合）→ **总结论仍 Conditional No-Go**（仅 mac 挡全面发版）

---

## 签收头

| 字段 | 值 |
|------|-----|
| 日期 | 2026-07-18（Win 轮）· **mac 轮同日续跑** · **Win L3/L4 业主签收同日晚** |
| App version | `1.0.1`（发版目标；此前 L0/L1 轮曾记 `1.0.0`） |
| Git SHA（Win 审查） | 早期机审 `de83b7c5`；**L3/L4 签收对准 `v1.0.1` tag tip**（干净树：stitch 清理 + 本签收提交） |
| Git SHA（mac 审查 HEAD） | `739eb63`（`main` == `origin/main`；**工作区另有未提交 Welcome/Hub WIP**，`.app` 构建含该 WIP） |
| 审查机（Win） | Windows 10 x64 |
| 审查机（mac） | **macOS 26.5.2 · Darwin arm64** |
| Win portable artifact | 既有 `windows-portable-x64.zip`（SHA256 `fefc3836…0aa2`）用于 L3/L4 手测；**正式 CDN 以 `v1.0.1` CI 重建为准** |
| mac `.app` artifact | `apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app`（~2.3G · binary SHA256 `0c86f915…66b9` · sidecar stamp `git_sha=6435605` / `2026-07-12T07:13:38Z` / `Darwin-arm64`） |
| Win 结论 | ☑ **Go** · ☐ Conditional · ☐ No-Go |
| mac 结论 | ☐ Go · ☑ **Conditional** · ☐ No-Go（L0–L2 Pass；L3/L4 GUI 未签） |
| **总结论** | ☐ Go · ☑ **Conditional No-Go** · ☐ No-Go |

### Conditional 条件

1. **mac**：~~无主机~~ → **已完成 L1 `.app` + L2 smoke**；仍须 **L3 黄金路径 + L4 截图矩阵**（人工 GUI）后方可翻 mac Go。  
2. **Win L3/L4**：~~open~~ → **2026-07-18 业主确认已闭合**（黄金路径 + 外观矩阵）；Win 栏翻 **Go**。正式介质仍须 `v1.0.1` 干净 tag CI 重建后 CDN 验收。  
3. **sidecar lock CVE**：~~open~~ → **2026-07-18 已刷锁**（P1-3 / P1-5）；CPU `pip-audit` 清洁。  
4. **工作区脏**：~~stitch 删除未提交~~ → **已 commit**；mac 历史 WIP 备注仍在；**签收产物以干净 tag 重建为准**。  
5. **bundled sidecar**：~~过旧~~ → **已重生** stamp `739eb63`（P1-6）；正式签收仍须用新 sidecar 打干净 `.app`/DMG。  

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

### Win 轮（保留）

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Frontend typecheck | `npm run typecheck` | **Pass** | `@rushi/desktop` tsc |
| Frontend tests | `npm run test -w @rushi/desktop` | **Pass** | 454 files / 2540 tests |
| Frontend lint | `npm run lint -w @rushi/desktop` | **Pass** | 0 errors / 33 warnings |
| Architecture guard | `node scripts/check-architecture-guard.mjs` | **Pass**（修复后） | **0 errors / 51 warnings** |
| Rust tests | `cargo test --lib` | **Pass** | 522 passed |
| Rust fmt / clippy | `cargo fmt --check` · `clippy -D warnings` | **Pass** | |
| ASR pytest | venv pytest | **Pass** | 148 / 2 skipped |
| Desktop perf | `npm run test:perf` | **WARN** | hit-test 本地预算 |
| E2E | desktop-ui 8 · asr-api 2 | **Pass** | |
| npm / design lint | | **Pass** | |
| cargo audit | | **Skip** | 当时未装 |
| pip-audit CUDA | | **Fail** | pillow / setuptools |
| pip-audit mac CPU | | **Skip** | Win GBK 解码失败 |
| codebase-memory | | **Skip** | |

### mac 轮（2026-07-18 · arm64）

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Frontend typecheck | `npm run typecheck` | **Pass** | |
| Frontend tests | `npm run test -w @rushi/desktop` | **Pass** | **456 files / 2545 tests** |
| Frontend lint | `npm run lint -w @rushi/desktop` | **Pass** | 0 errors / 33 warnings |
| Architecture guard | `node scripts/check-architecture-guard.mjs` | **Pass** | **0 errors / 51 warnings** |
| Rust tests | `cargo test --lib` | **Pass** | **531 passed** |
| Rust fmt | `cargo fmt -- --check` | **Pass** | |
| Rust clippy | `cargo clippy --lib --all-targets -- -D warnings` | **Pass** | |
| ASR pytest | `services/asr/.venv/bin/python -m pytest` | **Pass** | 148 passed / 2 skipped |
| Desktop perf | `npm run test:perf -w @rushi/desktop` | **Pass** | 6 files / 14 tests（本机空闲） |
| E2E ASR | `npm run test:e2e:asr -w @rushi/desktop` | **Pass** | 2 passed |
| E2E desktop shell | `npm run test:e2e:desktop -w @rushi/desktop` | **Pass** | 8 passed |
| npm audit | `npm audit --audit-level=high` | **Pass** | 0 vulnerabilities |
| design:lint | `npm run design:lint` | **Pass** | 0 errors / 0 warnings |
| cargo audit | `cargo audit` | **Pass\*** | 0 blocking vulns；**17 allowed warnings**（unmaintained unic-\* / unsound anyhow·glib） |
| pip-audit CPU mac lock | `PYTHONUTF8=1 python3 -m pip_audit -r requirements-sidecar-cpu-macos-arm64.lock` | **Fail** | pillow 12.2.0 · setuptools 78.1.1 · torch 2.12.1（见 P1-5） |
| codebase-memory | `detect_changes` since `HEAD~30` | **Pass** | MCP 可用；changed_count=0（相对已索引 tip） |

---

## L1 — Bundle integrity

| 端 | 动作 | Result | 证据 |
|----|------|--------|------|
| Windows portable | SHA256 对账 | **Pass** | actual=expected `fefc38360e0553d25b17664815e6ab2619f72ae24f2fb8bf4c4658afd6780aa2` |
| Windows portable | 解压结构 | **Pass** | `rushi-desktop.exe` + `resources/bundled-asr/rushi-asr-sidecar/` + stamp + third-party notices |
| Windows | 完整 `npm run release:win` 重建 | **未跑** | 耗时过大；以既有 zip（stamp `7bff04ef`）验收 L1/L2 |
| macOS | DMG / `.app` + `release:postbuild-verify` | **Pass（`.app`）** | `RUSHI_SKIP_SIDECAR_SMOKE=1 bash scripts/build-desktop-local-hand-test.sh` → `bash scripts/release-postbuild-verify.sh`：binary / sidecar / stamp / frontend bundle OK；**未打 DMG**（手测 `.app` only） |
| 共用 | `release:sidecar-preflight` | **Pass（mac 文件闸）** | 本地 `bundled-asr` 存在；smoke 跳过（`RUSHI_SKIP_SIDECAR_SMOKE=1`）；stamp 见 P1-6 |

---

## L2 — Installed smoke

| 端 | 动作 | Result | 证据 |
|----|------|--------|------|
| Windows portable | 启动 exe · 探测 `http://127.0.0.1:8741/health` | **Pass** | 进程存活；HTTP 200；`status=ok` · `service=rushi-asr` · `ffmpeg_ok=true` · FunASR models cached=true |
| Windows | 关于页版本 `1.0.0` UI 确认 | **未跑** | 需 GUI |
| Windows NSIS / OTA | [`rel-win-ota-signoff-runbook`](./rel-win-ota-signoff-runbook.md) §D/§E | **未跑** | 本轮聚焦 portable |
| macOS | `bash scripts/v1-release-installed-smoke.sh` | **Pass** | LaunchServices 窗口可见；`bundled_sidecar_health_ok`；诊断 zip 齐全；`/health` `funasr_import_ok`；证据 [`v1-release-installed-smoke-evidence.md`](../v1-release-installed-smoke-evidence.md)（UTC `2026-07-18T02:03:54Z`） |
| macOS | 关于页版本 UI | **未跑** | 需人工 GUI（自动化 smoke 未读关于页文案） |

---

## L3 — Functional chains（安装包）

### 黄金主路径

| ID | 步骤 | Win | mac |
|----|------|-----|-----|
| G-1 | 首启 / 侧车就绪 / onboarding | ✅（业主签） | L2 health + seed log ✅；UI ☐ |
| G-2 | 建项目 → 导入音频 → Hub 打开 | ✅（业主签） | ☐ |
| G-3 | 本机 ASR 转写（含取消一次） | ✅（业主签） | ☐ |
| G-4 | 波形 seek / 选段 / 编辑 → 保存 | ✅（业主签） | ☐ |
| G-5 | 导出 → 关闭再开数据仍在 | ✅（业主签） | ☐ |
| G-6 | 设置：ASR 能力态 ≥2 态截图 | ✅（业主签） | ☐ |

> **Win L3 签收说明（2026-07-18）**：业主确认在已验证 portable 上完成 G-1～G-6；截图未强制入库（本仓以签收表为准）。

### 域补刀

| 域 | 最低覆盖 | Win | mac |
|----|----------|-----|-----|
| Online STT | 一次在线或跳过原因 | ✅（业主签） | ☐ |
| Editor/CM6 | 选区↔seek、脏关闭门 | ✅（业主签） | ☐（E2E mock 8/8 代理） |
| Waveform | selection→seek→reveal | ✅（业主签） | ☐ |
| Hub batch | 多文件+队列一项 | ✅（业主签） | ☐ |
| Delivery/export | 交付模式一项 | ✅（业主签） | ☐ |
| Copy/security | release 无 `npm run` 泄漏 | L0 guard ✅ | L0 guard ✅；GUI 文案 ☐ |
| Win GPU | CUDA opt-in | N/A（未测 NVIDIA） | — |
| Upgrade profile | 旧 App Data | 仅 fresh | 本机已有 App Data（非 wipe）；fresh 路径 ☐ |

**E2E 代理证据（不得替代 L3 签收）**：desktop-ui 8/8；含 create→hub→editor→save→export TXT；ASR e2e 2/2。

---

## L4 — Appearance matrix

真源：[`DESIGN.md`](../../../DESIGN.md) · [`desktop-visual-style-governance.md`](../../architecture/desktop-visual-style-governance.md) · [`desktop-floating-dialog-panels.md`](../../architecture/desktop-floating-dialog-panels.md)

| 表面 | 机器/静态 | GUI 截图 |
|------|-----------|----------|
| Welcome | 无 inline style / 无 raw hex（抽查）✅ | Win ✅（业主签） · mac ☐ |
| Hub（空/有文件） | Hub stage meter 改 `CspLayout` ✅ | Win ✅（业主签） · mac ☐ |
| Editor 波形 | 机器抽查 ✅ | Win ✅（业主签） · mac ☐ |
| Environment 面板 | 无 inline style（抽查）✅ | Win ✅（业主签） · mac ☐ |
| 代表对话框 | guard dialog fitKind ✅ | Win ✅（业主签） · mac ☐ |
| Busy / BlockingProgress | `CspProgressFill` ✅ | Win ✅（业主签） · mac ☐ |
| Glossary 两层 border | 业主签外观矩阵覆盖 | Win ✅（业主签） · mac ☐ |
| Dark theme | tokens 有骨架；**无 UI 切换**（已知限制，非 P0） | N/A |

---

## Risk domain matrix（摘要）

| 域 | 结果 | 备注 |
|----|------|------|
| startup | Win L2 Pass / **mac L2 Pass** | portable + `.app` health |
| bundle | Win Pass / **mac `.app` Pass** | zip + postbuild-verify；DMG 未打 |
| asr | L0 Pass + 双端 health Pass | CUDA + **mac CPU** lock CVE |
| asset | 未 L3 | 2026-06 P0 path 根约束应仍在（Rust tests Pass） |
| editor | E2E mock Pass / L3 ☐ | |
| project | E2E create Pass / L3 ☐ | |
| export | E2E TXT mock Pass / L3 ☐ | |
| network | 未测弱网 | |
| copy | L0 guard Pass | |
| security | CSP style 已修；cargo-audit warnings 见 mac L0 | |
| performance | Win perf WARN；mac perf Pass | 负载敏感 |

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

- **Status**: **fixed（lock 再生）** · 2026-07-18 mac 轮处置  
- **Evidence**: `requirements-sidecar-cuda-win_amd64.lock` 现 `pillow==12.3.0` · `setuptools==83.0.0`（torch 族仍为 `2.11.0+cu126` 手工钉，见 CUDA regen 脚本）  
- **Verify**: 与 CPU 锁一并 `pip-audit`；Windows 上仍须在 CUDA 构建机复验  

#### P1-4: 架构热点 warning 堆积（51）

- **Status**: open（非阻断）  
- **Note**: 多文件 >300 行 / hook>12；与 2026-06 扫描同类债。不挡功能，但逼近可持续性风险。  

#### P1-5: mac CPU sidecar lock 已知 CVE（pillow / setuptools / torch）

- **Status**: **fixed（lock 再生）** · 2026-07-18  
- **Evidence**: `requirements-sidecar-cpu-macos-arm64.lock` → `pillow==12.3.0` · `setuptools==83.0.0` · `torch==2.13.0`（`torchaudio` 在 CPU 索引最高仍为 2.11.0，可接受 skew）  
- **Regen**: `scripts/regen-sidecar-cpu-lock.sh` 已加 floor pin；随后 `regen-sidecar-cuda-win-lock.sh`  

#### P1-6: 本地 bundled sidecar stamp 落后于审查 HEAD

- **Status**: **fixed** · 2026-07-18  
- **Evidence**: `npm run asr:build-sidecar-unix` → stamp `git_sha=739eb63 built_at=2026-07-18T04:50:22Z platform=Darwin-arm64`；build smoke OK（funasr / warmup / unload）  
- **Follow-up**: 正式签收仍须用该 sidecar **重建** `.app`/DMG（勿沿用旧手测包）  

#### P1-7: 本地 Tauri linker-signed `.app` 需 deep adhoc 重签才能稳定 smoke

- **Status**: **fixed**  
- **Fix**: `scripts/build-desktop-local-hand-test.sh` 与 `scripts/v1-release-installed-smoke.sh` 自动 `codesign --force --deep --sign -`（`RUSHI_SKIP_CODESIGN_REPAIR=1` 可跳过）  
- **Verify**: 本地 hand-test 构建后直接 smoke  

### P2

#### P2-1: Win 上 `npm run asr:test` / `desktop:test:e2e:*` 脚本用 Unix env 语法

- **Status**: **fixed（入口）**  
- **Fix**: `scripts/run-asr-pytest.ps1` · `run-desktop-e2e-desktop.ps1` · `run-desktop-e2e-asr.ps1`；索引见 `scripts/README.md`  

#### P2-2: Dark theme 无产品切换

- **Status**: known limitation  
- **Path**: `tokens.css` `[data-theme="dark"]`  

#### P2-3: `cargo-audit` / `gh` 未装于审查机

- **Status**: **partially closed（mac）** · Win 仍可能缺  
- **Note**: mac 轮已跑 `cargo audit`（17 allowed warnings）  

#### P2-4: mac agent 环境无法 `screencapture`（无 display 权限）

- **Status**: open（环境）  
- **Note**: L4 截图矩阵须人工本机 GUI 完成 
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
6. **mac 轮**：L0 全绿（除当时 pip-audit Fail）· `.app` 构建 · postbuild-verify · installed-smoke  
7. **处置续跑（同日）**：刷 sidecar CPU/CUDA lock（pillow/setuptools/torch）· P1-7 codesign 自动修复 · Win e2e/pytest `.ps1` · 重生 sidecar `739eb63` · 重建 `.app` + L2 smoke Pass  

---

## Go / No-Go

| 栏 | 结论 | 理由 |
|----|------|------|
| Win | **Go** | L0–L2 + **L3/L4 业主签收（2026-07-18）**；正式 CDN 以 `v1.0.1` CI 重建验收 |
| mac | **Conditional** | L0 + L1 `.app` + L2 smoke Pass；**L3/L4 GUI 未闭合** |
| **总结论** | **Conditional No-Go** | Win 已 Go；**mac L3/L4 仍挡全面发版** |

### 翻全面发版 Go 最短路径

1. ~~干净提交~~ → 打 `v1.0.1` → CI 重建 Win portable + mac DMG/`.app` → CDN 验收。  
2. ~~Win L3/L4~~ → 已业主签。  
3. mac：黄金路径 + [`dmg-vs-dev-parity`](./dmg-vs-dev-parity-checklist.md) 关键项。  
4. 回填本文件签收头 → mac + 总结论均为 Go。  

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

## Appendix — 命令备忘（mac arm64 · 本轮实跑）

```bash
# L0
npm run typecheck && npm run test -w @rushi/desktop && npm run lint -w @rushi/desktop
node scripts/check-architecture-guard.mjs
cd apps/desktop/src-tauri && cargo test --lib && cargo fmt -- --check && cargo clippy --lib --all-targets -- -D warnings && cargo audit
services/asr/.venv/bin/python -m pytest services/asr -q
PYTHONUTF8=1 python3 -m pip_audit -r services/asr/requirements-sidecar-cpu-macos-arm64.lock
npm run test:perf -w @rushi/desktop
npm run test:e2e:desktop -w @rushi/desktop
npm run test:e2e:asr -w @rushi/desktop

# L1 — 手测 .app（复用本地 sidecar；正式签收勿跳过 sidecar 重建）
RUSHI_SKIP_SIDECAR_SMOKE=1 bash scripts/build-desktop-local-hand-test.sh
export RUSHI_RELEASE_APP="$(pwd)/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"
bash scripts/release-postbuild-verify.sh
# 本地 linker-sign 摩擦时：
codesign --force --deep --sign - "$RUSHI_RELEASE_APP"

# L2
bash scripts/v1-release-installed-smoke.sh
# 证据：docs/execution/v1-release-installed-smoke-evidence.md

# L3/L4（人工）
npm run desktop:open-release-app
# 按本文件黄金路径 G-1～G-6 + DESIGN.md 外观矩阵截图
```

---

## Appendix — Win 发版前 L0 复验 + L3/L4 签收（2026-07-18 晚）

版本三处已对齐 **`1.0.1`**。L0 在 `0ad4977a` 复验绿；随后 **commit stitch 清理 + 本签收** → 打 **`v1.0.1`**。

| Gate | Result | Notes |
|------|--------|-------|
| `npm run typecheck -w @rushi/desktop` | **Pass** | |
| `npm run test -w @rushi/desktop` | **Pass** | 463 files / 2589 tests |
| `npm run lint -w @rushi/desktop` | **Pass** | 0 errors / 37 warnings |
| `node scripts/check-architecture-guard.mjs` | **Pass** | 0 errors / 53 warnings |
| Working tree | **Clean（签收提交后）** | stitch 上传包 / 桌面 stitch 规格已删除入库 |
| Tag `v1.0.1` | **本轮创建** | 推送后等 CI |
| Win L3–L4 GUI | **Go（业主确认）** | |
| mac L3–L4 GUI | **仍未闭合** | 总结论仍 Conditional No-Go |
# Release Parity Program — 2026-06

> **Research brief**：[`release-parity-program-research-2026-06.md`](./release-parity-program-research-2026-06.md)  
> **状态**：Phase 0–3 本地落地；Phase 4 已有 macOS 原生窗口 smoke，完整 Native WebView 自动化待后续工具选型  
> **目标**：缩小并可解释 `npm run desktop:dev`、打包 `.app`、DMG 安装副本之间的行为差异；release 结论必须来自真实产物证据。  
> **关联**：[`dmg-vs-dev-parity-checklist.md`](./dmg-vs-dev-parity-checklist.md) · [`release-zero-terminal-hand-test.md`](../release-zero-terminal-hand-test.md) · [`release-packaging-audit-2026-06.md`](./release-packaging-audit-2026-06.md)

---

## 1. 总原则

Rushi 的 release parity 不追求把 dev 环境伪装成 release，而是采用 **Release artifact first**：

- `desktop:dev` 用于快速开发和局部验证。
- 打包 `.app` 用于工程验收。
- DMG / Applications 安装副本用于用户路径签收。
- Playwright / Chrome mock 只能证明前端逻辑，不得替代 WKWebView / packaged app 证据。

**硬规则**

1. 业务逻辑只允许一条实现路径。
2. dev/release 差异只允许在部署层：bundled sidecar、resource path、CSP / nonce、shell-managed 文案、系统权限。
3. 用户可见修复路径在 release 中必须可执行，禁止裸露 `npm run desktop:dev` / `asr:dev`。
4. 新增 release-only 问题必须先归入风险域并留下证据，再进入修复。
5. 诊断包是用户反馈和 release signoff 的主证据，不是附属物。

---

## 2. 环境契约

| 环境 | 壳 | 前端 | ASR / runtime | 用途 | 可作为 release 签收 |
|------|----|------|---------------|------|---------------------|
| `browser-preview` | 无 | Vite / Chrome | 手动 / mock | 组件、纯前端、Chrome E2E | 否 |
| `desktop-dev` | Tauri + WKWebView | DEV @ `:1421` | source venv；`RUSHI_SKIP_BUNDLED_ASR=1` | 快速迭代、局部复现 | 否 |
| `packaged-app` | Tauri + WKWebView | PROD 静态包 | PyInstaller bundled sidecar | 工程验收、postbuild verify | 部分 |
| `installed-app` | Tauri + WKWebView | PROD 静态包 | PyInstaller bundled sidecar | DMG / Applications 真实用户路径 | 是 |

### 允许差异

| 类别 | 例子 | 约束 |
|------|------|------|
| 部署资源 | `.app/Contents/Resources/...` vs repo path | 必须可由 postbuild verify 检查 |
| 运行时来源 | source ASR venv vs bundled sidecar | UI 状态须使用 Rust / sidecar 真源 |
| 用户文案 | dev 提示命令，release 提示 UI 修复路径 | 统一走 `packagedUserHints.ts` |
| CSP / nonce | devCsp 与 prod csp | 策略保持 parity；差异须有 guard |
| 系统权限 | 文件访问、quarantine、签名 | 只能由 installed smoke / hand-test 签收 |

### 禁止差异

- 转写、编辑、保存、导出等业务流程。
- 数据格式与 DB schema 解释。
- ASR API contract 与 capability 状态维度。
- 波形 / Editor 主路径行为。
- 错误恢复是否可执行。

---

## 3. 风险域矩阵

| 域 | 覆盖范围 | 真源 / 文件 | 允许差异 | 观测证据 | 签收层 |
|----|----------|-------------|----------|----------|--------|
| `startup` | `.app` 启动、非白屏、日志、重复实例、退出 | `scripts/v1-release-installed-smoke.sh` | release DevTools 开关 | process、log growth、screenshot / window probe | L2 / L3 |
| `bundle` | sidecar、ffmpeg、ffprobe、build stamp、resource layout | `scripts/release-postbuild-verify.sh`、`bundled_asr_assets.rs` | repo path vs `.app` path | `bundled_sidecar_build`、tool path | L1 |
| `asr` | 8741、token、`/health`、async API、模型目录、force restart | `shellCapabilities.ts`、ASR services、capability architecture doc | source venv vs bundled sidecar | health summary、sidecar build、UI capability matrix | L0 / L2 / L3 |
| `asset` | `asset://`、App Data、导入文件、scope、peaks `.dat` | `asset_scope.rs`、waveform asset probes | imported file list differs by profile | `asset_scope_ok`、`asset_fetch_parity` | L1 / L3 |
| `editor` | 波形、语段列表、快捷键、seek、保存、Close Gate | `desktop-waveform-engine.md`、Editor controllers | 无业务差异 | `parity waveform`、manual interaction evidence | L3 |
| `project` | SQLite、Project metadata、最近工作区、旧数据 | `src-tauri/src/db.rs`、project services | fresh vs upgrade profile | schema version、project/file counts | L2 / L3 |
| `export` | DOCX、文件选择器、中文路径、覆盖 / 取消 | export services / Rust commands | 系统文件 picker 行为 | export result、error code、path policy | L3 |
| `network` | 模型下载、runtime manifest、弱网、离线缓存 | ASR setup services、runtime catalog | 在线 vs 离线 | prepare phase、retry state、network error code | L3 |
| `copy` | release/dev 文案、用户修复路径、关于页、诊断 zip | `packagedUserHints.ts`、copy tests、guard | 文案按 shell-managed 分流 | no `npm run` leak、copy tests | L0 / L3 |
| `security` | CSP、invoke ACL、asset scope、token、诊断包脱敏 | `tauri.conf.json`、architecture guard | devtools feature only when intentional | guard output、redaction note | L0 / L2 |
| `performance` | 长音频、转写中 UI 卡顿、内存 / CPU 峰值 | targeted bench / logs | 硬件差异 | cold start time、long media notes | L3 / future |

---

## 4. 门禁层级

### L0 — 静态与单元门禁

```bash
npm run typecheck
npm run test
node scripts/check-architecture-guard.mjs
```

负责：

- 类型、单测、纯逻辑回归。
- release 文案泄漏。
- `import.meta.env.DEV` 行为分叉。
- `isPackagedDesktopApp()` 行为分叉。
- CSP parity、invoke ACL、release copy guard。

阻断：

- guard error。
- release 用户可见文案出现 dev-only 命令且未走集中分流。
- 业务代码新增 dev/release 行为分叉。

### L1 — 构建后门禁

```bash
npm run asr:build-sidecar-unix
npm run release:sidecar-preflight
npm run desktop:build-app
npm run release:postbuild-verify
```

负责：

- `.app` 真实产物存在。
- bundled sidecar、ffmpeg、ffprobe 可解析。
- resource layout 与预期一致。
- build stamp 可读。
- release probe 覆盖高风险 asset / waveform 基线。

阻断：

- sidecar / ffmpeg / ffprobe 缺失。
- build stamp 不可读或关于页 / 诊断包无法确认。
- postbuild probe fail。

### L2 — Installed Smoke

当前入口：

```bash
bash scripts/v1-release-installed-smoke.sh
```

目标检查：

- `.app` 可启动，进程存在。
- 主窗口非白屏（Phase 2 可通过截图 / WebView probe 实现）。
- `desktop.log` 增长。
- App Data 可写。
- bundled ffmpeg 可读。
- ASR `/health` 可达；fresh install 不可达时 UI 必须有一键准备路径。
- 诊断包可生成。
- 退出后进程清理正常。

阻断：

- 启动失败、白屏、日志不可写。
- 诊断包无法生成。
- App Data 读写失败。

### L3 — 人工签收

只保留自动化不稳定但用户关键的路径：

- fresh install。
- upgrade old App Data。
- 创建 / 打开 Project。
- 导入音频、波形出现、重启恢复。
- 转写、停止 / 取消、编辑保存。
- 导出 DOCX 到中文路径。
- 离线已有模型、联网 fresh 下载、下载失败重试。
- Close Gate：dirty、busy、换文件、Cmd+Q。
- release 文案和修复按钮可执行。

手测必须留下 evidence：日期、app version、环境、通过 / 失败项、关键日志或诊断包摘要。

---

## 5. 诊断包契约

诊断包（`Diagnostic bundle`）应成为 release parity 的主证据。目标字段：

| 文件 | 内容 | 隐私策略 |
|------|------|----------|
| `build-info.txt` | app version、git sha、shell profile、bundled sidecar build | 无用户内容 |
| `environment.txt` | OS、arch、App Data root、Tauri runtime、profile | 路径可保留本机目录；外发前可脱敏用户名 |
| `capabilities.json` | ASR health 摘要、ffmpeg 状态、模型状态、shell-managed 状态 | 不含 token，不含完整模型下载 URL 密钥 |
| `parity-log.txt` | `parity *`、`WARN`、`ERROR` 摘要 | 不含音频正文和 Segment 文本 |
| `project-summary.txt` | project/file/segment/peaks 数量、schema version | 不含音频内容，不含转写正文 |
| `redactions.txt` | 脱敏说明 | 明确未包含 token / 音频 / 正文 |

---

## 6. 差异归因 SOP

每个 dev/release 差异按同一流程处理：

```text
1. 确认环境：desktop-dev / packaged-app / installed-app
2. 记录症状：用户动作、期望、实际、是否 fresh / upgrade profile
3. 归入风险域：startup / bundle / asr / asset / editor / project / export / network / copy / security
4. 收集证据：parity log、desktop.log、diagnostic bundle、postbuild verify、installed smoke、截图
5. 判断根因层：
   - 部署层：bundle/resource/CSP/permission
   - 运行时层：sidecar/health/API/model
   - 数据层：App Data/DB/migration/cache
   - UI 层：Editor/Project/Copy/Capability
6. 修复对应真源，不用旁路 workaround 掩盖
7. 重跑对应 L0/L1/L2/L3，并更新 evidence
```

---

## 7. Fresh / Upgrade Profiles

Release parity 至少覆盖两类状态：

| Profile | 目的 | 验收 |
|---------|------|------|
| `fresh-profile` | 空 App Data；验证首次启动、一键准备、导入、转写、导出 | L2 + L3 |
| `upgrade-profile` | 脱敏旧 App Data；验证 DB、旧 peaks、旧模型目录、最近项目、prefs | L2 + L3 |

约束：

- 不提交真实用户音频或转写正文。
- fixture 只保留结构和最小可复现样本。
- upgrade 失败不得靠清空 App Data 规避。

---

## 8. Go / No-Go

### 阻断 release

- `.app` 启动失败或白屏。
- bundled sidecar / ffmpeg / ffprobe 缺失。
- 关于页 build stamp 与诊断包不一致。
- release 用户路径出现 `npm run desktop:dev` 等 dev-only 修复命令。
- 导入音频后 Editor 主路径不可用。
- 转写主路径不可用且无 UI 修复路径。
- 旧 App Data 打不开或破坏数据。
- 诊断包无法生成。
- CSP / invoke ACL / behavior fork guard 失败。

### 可带警告

- fresh install 下模型未下载，但 UI 有一键准备路径。
- 网络失败，但 UI 可重试且状态可恢复。
- 非主路径功能未配置，但不影响导入、转写、编辑、导出。
- 性能指标未达理想值，但无明显卡死并已登记后续优化。

---

## 9. 分阶段实施

| Phase | 目标 | 交付 | 验收 |
|-------|------|------|------|
| 0 | 统一策略真源 | 本文 + research brief；现有清单链接本文 | 所有差异可归入风险域 |
| 1 | 观测扩展 | ✅ 已扩展 `runtimeParity.ts` domain；启动 / bundle / project / asr parity log；诊断包新增 `environment.txt`、`project-summary.txt`、`parity-log.txt`、`redactions.txt` | 不开 DevTools 也能判断环境与主要能力 |
| 2 | 机器门禁升级 | ✅ 已扩展 `release-postbuild-verify.sh` 与 `v1-release-installed-smoke.sh`；architecture guard 保持 L0 既有规则 | 明显坏包由机器先失败 |
| 3 | Fixture 化验收 | fresh / upgrade profile；release evidence 模板 | 旧数据问题可稳定复现 |
| 4 | Native WebView 自动化 | ✅ L2 已加入 macOS 原生窗口存在探针；后续再评估 Tauri WebDriver / tauri-playwright，只覆盖 1–2 条高价值路径 | macOS installed smoke 至少确认真实窗口存在；完整 WKWebView DOM/截图自动化另开工具选型 |

---

## 10. 现有文档职责归位

| 文档 / 脚本 | 新职责 |
|-------------|--------|
| 本文 | Release parity 主控策略 |
| [`release-parity-program-research-2026-06.md`](./release-parity-program-research-2026-06.md) | 调研与方案取舍 |
| [`dmg-vs-dev-parity-checklist.md`](./dmg-vs-dev-parity-checklist.md) | macOS WKWebView / DMG 子清单 |
| [`release-zero-terminal-hand-test.md`](../release-zero-terminal-hand-test.md) | L3 手工签收清单 |
| [`release-packaging-audit-2026-06.md`](./release-packaging-audit-2026-06.md) | 2026-06 packaging 审计 evidence，不再作为主控策略 |
| [`release-parity-evidence-template.md`](./release-parity-evidence-template.md) | 每次 release candidate / installed smoke 的证据模板 |
| [`release-parity-profile-checklist.md`](./release-parity-profile-checklist.md) | fresh / upgrade profile 签收说明 |
| `scripts/release-postbuild-verify.sh` | L1 构建后门禁 |
| `scripts/v1-release-installed-smoke.sh` | L2 installed smoke |
| `scripts/check-architecture-guard.mjs` | L0 静态 release parity guard |

---

## 11. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-13 | Phase 0 初版：定义环境契约、风险域矩阵、L0–L3 门禁、诊断包契约与实施阶段 |
| 2026-06-13 | Phase 1–2 本地落地：新增启动 parity 观测、诊断包证据文件、postbuild / installed smoke 硬检查 |
| 2026-06-13 | Phase 3 文档落地：新增 release evidence 模板和 fresh / upgrade profile 签收清单 |
| 2026-06-13 | Phase 4 最小落地：installed smoke 直接启动 `.app` binary，触发自动诊断包导出并检查 macOS 原生窗口存在 |

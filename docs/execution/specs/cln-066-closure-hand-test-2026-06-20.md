# CLN-066 闭环手测 — v0.1.7 + 待合入补丁（2026-06-20）

> **目标**：在 **release 安装包**上补齐 CLN-066，关闭 [`cleanup-candidate-register`](./cleanup-candidate-register.md) CLN-066。  
> **关联**：[`release-parity-l3-hand-test-checklist-2026-06-14.md`](../release-parity-l3-hand-test-checklist-2026-06-14.md) · [`release-parity-evidence-2026-06-14.md`](../release-parity-evidence-2026-06-14.md) · [`release-parity-l3-hand-test-runbook-2026-06-19.md`](../release-parity-l3-hand-test-runbook-2026-06-19.md)

---

## 签收头（手测开始前填写）

| 项 | 填写 |
|----|------|
| 日期 | |
| 测试人 | |
| **签收包** | ☐ **A** v0.1.7 DMG（GitHub Release） ☐ **B** 本地 build（含未发布补丁，见 §0.2） |
| App 路径 | 例：`/Volumes/如是我闻/rushi-desktop.app` 或 `/Applications/如是我闻.app` |
| App 版本 | 0.1.7 / 本地 0.1.7+patch |
| Git SHA（关于页 / sidecar stamp） | |
| macOS | |
| Profile | ☐ fresh（脚本隔离 HOME） ☐ upgrade（主 App Data） |
| 网络 | ☐ 可下载模型 |

---

## 今日执行单（按顺序勾选）

> 预计 **60–90 min**（含模型下载）。每项测完在「结果」列打 ✅ / ⚠️ / ❌。

| 序 | Phase | 做什么 | 预计 | 结果 |
|----|-------|--------|------|------|
| 0 | 准备 | 下载/挂载 DMG 或本地 build；`release-postbuild-verify` | 5 min | |
| 1 | **A** | OTA 0.1.6→0.1.7 或确认版本；chip 路由 A1–A4 抽测 | 10 min | |
| 2 | **B0** | `r3f-fresh-appdata-hand-test.sh --interactive --wipe-ui-prefs` 启动 Fresh | 2 min | |
| 3 | **H1** | Fresh Welcome；侧栏初始状态（K1/K2） | 3 min | |
| 4 | **H2+J+N** | 本机 ASR 一键准备/下载模型；观察 UI 卡顿 + 8741 文案 | 20–40 min | |
| 5 | **H3–H4** | 状态行绿；导入→波形→转写→导出 | 15 min | |
| 6 | **K3+K4** | 在线 STT 填 Key→探测；**侧栏与面板同色** | 5 min | |
| 7 | **C** | upgrade 抽测：B1/B8、关于、诊断 zip | 10 min | |
| 8 | **I** | ⌘F 查找替换 I1/I5 | 5 min | |
| 9 | **回填** | §8 证据模板 + checklist / register | 10 min | |

**Fresh 一键准备命令**（H2 主路径）：

```bash
export RUSHI_RELEASE_APP="/Applications/如是我闻.app"   # 改成你的 .app 路径
bash scripts/r3f-fresh-appdata-hand-test.sh --interactive --wipe-ui-prefs
```

**仅侧车门禁**（不能替代 H2）：

```bash
bash scripts/r3f-fresh-appdata-hand-test.sh --wipe-ui-prefs --skip-download
```

---

## 0. 版本与范围

### 0.1 已发布：v0.1.7（macOS OTA + DMG）

```bash
gh release download v0.1.7 --pattern '*.dmg' --dir /tmp/rushi-v0.1.7
open /tmp/rushi-v0.1.7/rushi-desktop_0.1.7_aarch64.dmg
```

| 资产 | 状态 |
|------|------|
| macOS DMG + OTA `latest.json` | ✅ 已发布 |
| Linux `.deb` | ✅ |
| Windows portable | ☐ 视 CI `tauri-windows`（v0.1.7 可能仍缺 zip） |

**包 A 已覆盖**：`dbd5207` 模型下载轻量 refresh、STT/LLM keychain 误绿、`--wipe-ui-prefs`；`c45dfab` Windows CI 绑定。

**包 A 未覆盖**（测到会 FAIL/WARN，需包 B）：

| 缺陷 | 现象 | 补丁位置（本地未 push） |
|------|------|-------------------------|
| 在线 STT 侧栏/面板不同步 | 面板绿「服务就绪」、侧栏 **红** | `EnvironmentPanel` bump `settingsEpoch` |
| 下载中误报 8741 占用 | 一键准备/下载失败，提示端口被占 | `diagnose.rs` + `asrOneClickPrepareDiagnose.ts` |

### 0.2 待签收：包 B（本地 build，含上述补丁）

```bash
cd /Users/junwei/开发/Rushi
npm run release:sidecar-preflight
npm run desktop:build-app
bash scripts/release-postbuild-verify.sh
export RUSHI_RELEASE_APP="apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"
```

> 缺 `TAURI_SIGNING_PRIVATE_KEY` 时 updater 步可能报错，**.app 通常仍可用**。

**CLN-066 正式关闭建议**：包 B 全绿后再标 DONE；包 A 可先填 WARN 并注明 K4/N blocker。

### 0.3 机器门禁（开发者预检，已绿可跳过）

```bash
npm run typecheck && npm run test && npm run lint
node scripts/check-architecture-guard.mjs
bash scripts/release-postbuild-verify.sh
```

---

## Phase A — Upgrade 抽测 + OTA

| # | 操作 | 期望 | ☐ | 备注 |
|---|------|------|---|------|
| A-OTA1 | 从 v0.1.6 启动 | 更新提示或关于页 0.1.7 | | |
| A-OTA2 | 完成 OTA / 覆盖安装 | 项目仍在 | | |
| A1 | 点 ASR chip | 设置 → **本机 ASR** | | |
| A2 | 点 LLM chip | 设置 → **LLM 配置** | | |
| A3 | 工具栏 ⌘, 设置 | 不莫名落 LLM | | |
| A4 | 先 LLM chip 再 ASR chip | 仍进本机 ASR | | |
| B1 | 导入 mp3/wav | 30s 内波形 | | upgrade |
| B8 | Cmd+Q 重开项目 | 波形/语段仍在 | | upgrade |
| C1 | 关于页 | 版本 + sidecar stamp | | |
| C3 | 导出诊断 zip | `build-info.txt` 含 bundled stamp | | |

---

## Phase B — Fresh（CLN-066 主缺口）

### H — 首装主路径

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| H1 | 空 App Data 首启 | Welcome 正常 | |
| H2 | 本机 ASR → **一键准备** | 进度走通；见 J/N | |
| H3 | 准备完成状态行 | 环境/FFmpeg/运行时/转写 可操作 | |
| H4 | 导入→波形→本机转写→导出 | 同 checklist B1–B7 | |

### J — 模型下载 UI（`dbd5207`）

| # | 操作 | 期望 | ☐ | 包 |
|---|------|------|---|-----|
| J1 | 下载中：设置 ↔ 编辑器 ↔ Welcome | 无 >3s 整窗冻结 | | A |
| J2 | 下载中：切到其他 App 再回来 | 无长时间白屏 | | A |
| J3 | 下载完成 | 本机 ASR chip 绿；可转写 | | A |

### N — 8741 误报（包 B 必测）

| # | 操作 | 期望 | ☐ | 包 |
|---|------|------|---|-----|
| N1 | Fresh 单实例；H2 一键准备 | **不出现**「8741 被占用」阻断（侧车 health 正常时） | | B |
| N2 | 若仍见占用提示 | 点「**使用当前 8741 服务**」后可继续下载 | | A/B |
| N3 | 测前确认无 dev 侧车：`lsof -i :8741` 仅一个 rushi-asr | | | 前置 |

**8741 清理（测前）**：

```bash
lsof -ti :8741    # 应仅 release 侧车；若有 dev 实例先 quit App 或 kill
pkill -f "npm run desktop:dev" 2>/dev/null || true
```

### K — 在线 STT / LLM 状态

须在 **`--wipe-ui-prefs` + Fresh HOME** 下测 K1–K2。

| # | 场景 | 期望 | ☐ | 包 |
|---|------|------|---|-----|
| K1 | 未配在线 STT Key | 侧栏 **非**绿；面板 **非**「已验证，可转写」 | | A |
| K2 | 未配 LLM Key（非 Ollama） | 侧栏 LLM **非**绿就绪 | | A |
| K3 | 填 Key → 保存/探测成功 | 面板绿「服务就绪」 | | A |
| **K4** | K3 成功后 **不离开设置** | 侧栏「在线 STT」**同为绿**（非红/黄） | | **B** |

> 钥匙串仍共享：`--wipe-ui-prefs` 不清 Keychain。K1/K2 若误绿，查钥匙串残留并记 WARN。

**K4 复现步骤（你报告的 bug）**：

1. Fresh + wipe-ui-prefs 启动。
2. 设置 → 在线 STT → 阿里云百炼 → 填 Key → **探测连接** 成功。
3. 看主 banner 绿 + 左侧导航「在线 STT」圆点 — **必须同色**。

---

## Phase C — FLOAT-FIT（I1 / I5）

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| I1 | ⌘F，搜 2 处匹配 | 壳层贴内容；底栏按钮完整 | |
| I2 | 全部替换预览（2 行） | 预览紧凑 | |
| I5 | 拖高 → 改匹配数 → 双击标题栏 | 壳高随内容重算 | |

v0.1.1 时 I1=WARN；v0.1.7+ 通过可改 PASS。

---

## Phase D — Windows 发行（可选）

| # | 检查 | ☐ |
|---|------|---|
| M1 | `gh release view v0.1.7` 含 `windows-portable-x64.zip` | |
| M2 | 对应 `.sha256` 存在 | |

---

## 4. 签收矩阵

| 区块 | 通过标准 | 包 A | 包 B | 结果 |
|------|----------|------|------|------|
| A Upgrade + OTA | 无回归 | ✅ | ✅ | |
| H Fresh | H1–H4 | ✅ | ✅ | |
| J 下载 UI | J1–J3 | ✅ | ✅ | |
| N 8741 | N1 | ⚠️ 已知 FAIL | ✅ 必绿 | |
| K 误绿 | K1–K3 | ✅ | ✅ | |
| K4 侧栏同步 | 探测后同色 | ⚠️ 已知 FAIL | ✅ 必绿 | |
| I FLOAT-FIT | I1/I5 | ✅ | ✅ | |
| M Windows | zip 存在 | CI | CI | |

**CLN-066 → DONE 条件**：

- 包 B：**H + J + N + K（含 K4）+ I1** 全 ✅，无 B/C 主路径 blocker
- 包 A only：最多 **WARN**，blocker 列 K4/N，跟进 v0.1.8 tag

**结论**：☐ **DONE / L3 Go** ☐ **WARN** ☐ **No-Go**

---

## 5. 失败记录模板

```text
ID: K4 / N1 / J2 / …
签收包: A v0.1.7 DMG / B local build
Profile: fresh / upgrade
App path:
操作:
实际:
期望:
截图路径:
desktop.log 关键词:
blocker: yes/no
```

日志：

```bash
tail -f ~/Library/Application\ Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log
```

常搜：`8741`、`port`、`prepareModel`、`connectionVerified`、`keychain`

---

## 6. 测完后回填

1. [`release-parity-l3-hand-test-checklist-2026-06-14.md`](../release-parity-l3-hand-test-checklist-2026-06-14.md) — 签收头 v0.1.7；H/I/K 勾选。
2. [`release-parity-evidence-2026-06-14.md`](../release-parity-evidence-2026-06-14.md) — 追加 **§9 v0.1.7 CLN-066**（下方模板）。
3. [`cleanup-candidate-register.md`](./cleanup-candidate-register.md) — CLN-066 → DONE 或 WARN。
4. [`r3f-fresh-appdata-hand-test-evidence.md`](./r3f-fresh-appdata-hand-test-evidence.md) — 脚本跑完自动更新。

### §9 证据摘要模板（复制到 evidence）

```markdown
## 9. v0.1.7 CLN-066 closure（YYYY-MM-DD）

| 项 | 结果 |
|----|------|
| 签收包 | A / B |
| App | rushi-desktop_0.1.7_aarch64.dmg / 本地 .app |
| SHA | |
| A OTA + 抽测 | ✅ / ⚠️ / ❌ |
| H1–H4 Fresh | |
| J 下载 UI | |
| N 8741 | |
| K1–K4 在线 STT | |
| I1/I5 | |
| Blocker | 无 / K4 / N1 / … |
| **结论** | Go / WARN / No-Go |
```

---

## 7. 变更 ↔ 测试映射

| 变更 | Commit / 状态 | 测试 ID |
|------|---------------|---------|
| 模型下载轻量 refresh + defer | `dbd5207` · v0.1.7 | J1–J3, H2 |
| STT/LLM keychain 误绿 | `dbd5207` · v0.1.7 | K1–K3 |
| Fresh `--wipe-ui-prefs` | `dbd5207` · v0.1.7 | K 前置 |
| Windows CI native bindings | `c45dfab` · v0.1.7 | M1–M2 |
| OTA draft verify | `dbd5207` · v0.1.7 | CI |
| **在线 STT 侧栏同步** | **本地未 push** | **K4** |
| **8741 下载误报 reconcile** | **本地未 push** | **N1** |

---

## 8. 命令备忘

```bash
# DMG
gh release download v0.1.7 --pattern '*.dmg' --dir /tmp/rushi-v0.1.7

# Fresh 全链路
bash scripts/r3f-fresh-appdata-hand-test.sh --interactive --wipe-ui-prefs

# CI / Release
gh run list --workflow=release.yml --limit 1
gh release view v0.1.7
```

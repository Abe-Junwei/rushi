# DMG / release 与 desktop:dev parity 验收清单

> **用途**：缩小 `npm run desktop:dev` 与安装包（`.app` / DMG）体验差；Playwright `desktop-ui` 在 Chrome 中运行，**不能**替代本清单。  
> **主控策略**：[`release-parity-program-2026-06.md`](./release-parity-program-2026-06.md)；本文仅作为 macOS WKWebView / DMG 子清单。  
> **关联**：[release-zero-terminal-hand-test.md](../release-zero-terminal-hand-test.md) · [release-packaging-audit-2026-06.md](./release-packaging-audit-2026-06.md)

## 三档环境（勿混淆）

| 环境 | 壳 | 前端 | ASR | `isPackagedDesktopApp()` |
|------|-----|------|-----|--------------------------|
| Vite 浏览器预览 | 无 | DEV | 手动 | false |
| `npm run desktop:dev` | Tauri + WKWebView | DEV @ `:1421` | 源码 venv（`RUSHI_SKIP_BUNDLED_ASR=1`） | false |
| `.app` / DMG | Tauri + WKWebView | PROD 静态包 | PyInstaller bundled | **true** |

macOS 上 dev 与 DMG **共用 WKWebView**；差异来自 asset 协议、bundled 侧车、PROD 构建与 CSP。

## Runtime parity 契约（dev = release 行为）

**原则**：业务逻辑只有一条实现；dev/release 差异只允许在 **部署层**（侧车二进制、用户文案、CSP nonce 注入方式）。

| 域 | 真源 | 可观测 |
|----|------|--------|
| 波形 render | peaks-first → 显式 decode 降级 | `desktop.log` 搜 `parity waveform render_path=` |
| 波形宽度 | `clampPxPerSecForWaveSurferRender`（含 32768 列 cap） | timeline 宽 ≤ 32768 |
| CSP style | `devCsp.style-src` = 生产 `csp.style-src` | architecture guard |
| 行为分叉 | 禁止 `import.meta.env.DEV`（除 `config/env.ts`） | architecture guard |
| ASR 侧车托管 | Rust `asr_app_manages_bundled_sidecar` | 关于页 `asr_shell_managed` |

**dev 手测**：打开 `desktop.log`，确认长音频为 `render_path=peaks`（非 silent decode）。若见 `reason=mount_decode_defer_timeout` 或 `peaks_load_failed`，与 release 同因，需修而非「dev 特有」。

## 发版前（维护者）

```bash
npm run asr:build-sidecar-unix
npm run release:sidecar-preflight
npm run desktop:build-app    # 或 desktop:build-dmg / release:mac
npm run release:postbuild-verify
bash scripts/v1-release-installed-smoke.sh
npm run desktop:open-release-app   # 快捷打开刚编的 .app
```

## 安装包内验收（WKWebView 专项）

在 **`.app` 或 DMG 安装副本** 上勾选（不可仅在 dev 测）：

### 环境与元信息

- [ ] **设置 → 关于**：版本、数据目录、**内置侧车构建**（`git_sha=…`）、侧车托管状态
- [ ] **复制版本信息** / 诊断 zip `build-info.txt` 含 `shell_profile` / `bundled_sidecar_build`
- [ ] 环境页文案 **无** `npm run` / `desktop:dev`

### 波形与媒体（asset://）

- [ ] 导入音频 → 30s 内波形出现（非「正在加载波形…」卡死）
- [ ] Seek 后 playhead **左右**均有波形
- [ ] Cmd+Q 重启 → 同一项目波形仍加载

### 编辑与交互

- [ ] 语段 ↑↓ 连按 10 次：列表跟手、无明显卡死
- [ ] 项目元数据 **年月 / 日期** 可输入
- [ ] 语段列表：备注与状态标签不重叠

### 转写与导出

- [ ] 转写完成；无「缺少 async 路由」且无修复路径的硬错误
- [ ] 导出 Word（或主路径）成功

## 失败 → 日志

| 症状 | 查看 |
|------|------|
| 波形卡住 | `desktop.log` → `asset_scope_ok`、`ui waveform` |
| 侧车旧 / 缺 API | 关于页 `bundled_sidecar_build` vs 当前 git；`/health` 与 smoke 脚本 |
| 语段卡顿 | 是否开启听打循环；长稿虚拟列表 |

日志路径：`~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log`

## 与自动化关系

| 守卫 / 测试 | 覆盖 |
|-------------|------|
| `check-architecture-guard.mjs` | release 文案 npm 泄漏、CSP、invoke ACL |
| `release:postbuild-verify` | 侧车 + 波形 probe |
| Playwright `desktop-ui` | Chrome mock，**不**覆盖 WKWebView |

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版：三档环境 + WKWebView 专项 + build-info 侧车 stamp |

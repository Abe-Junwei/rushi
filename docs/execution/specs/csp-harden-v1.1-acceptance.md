# Spec(acceptance): CSP-HARDEN Step 6a（C-1）

> **Research brief**：[`csp-harden-v1.1-research.md`](./csp-harden-v1.1-research.md)
> **Plan**：[`csp-harden-v1.1-plan.md`](./csp-harden-v1.1-plan.md)

## 6a 自动门禁（本片硬验收）

- [x] 生产 `tauri.conf.json` `csp.style-src` 不含 `'unsafe-inline'`
- [x] 生产 `tauri.conf.json` 已删除独立 `csp.style-src-elem`
- [x] `csp.style-src-attr` 仍为 `'unsafe-inline'`（React 行内样式）
- [x] `devCsp` 未改动
- [x] `npm run typecheck` 通过（2026-06-12）
- [x] `npm run test` 通过（2026-06-12 · 258 文件 / 1275 用例）
- [x] `node scripts/check-architecture-guard.mjs` 无 error（0 错误 / 46 既有警告）
- [x] 守卫负向自测：`style-src` 含 `'unsafe-inline'` 报 error；`style-src-elem` 一旦声明（即便仅 `'self'`）报 error（内存负向测试均 fires=true）

## 关键测试 / 命令

- 回归：`apps/desktop/src/utils/tauriStyleCspNonce.test.ts`（nonce 读取）
- 守卫：`scripts/check-architecture-guard.mjs` → `checkTauriProductionCsp()`
- 命令：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## 6b（C-2）— 全应用 CSP smoke + 签收

### 6b 自动门禁（本环境可跑）

- [x] `npm run build`（`tsc --noEmit && vite build`）通过（2026-06-12）
- [x] 生产产物 `dist/index.html` 保留 nonce probe `<style id="rushi-tauri-style-csp-nonce" nonce="__TAURI_STYLE_NONCE__">`（Vite 构建未剥离）
- [x] 生产产物 CSS 为外链：`dist/assets/index-*.css`（`'self'`）+ 字体 `<link href=fonts.googleapis.com>`（回退 `style-src` 已含该 host）；无带 CSS 的内联 `<style>`、无内联 `<script>`
- [x] 守卫新增 `checkTauriStyleNonceProbe()`：保护 index.html nonce probe 不被误删（负向逻辑自测：删 probe → 守卫报错）
- [x] `node scripts/check-architecture-guard.mjs` 无 error

### 运行时 `<style>` 注入覆盖审计（硬化 CSP 的真实风险面）

> 硬化后唯一风险 = 页面加载后由 JS 注入、未携 nonce 的 `<style>`（被 `style-src` 拦）。逐项确认覆盖：

| 注入源 | 是否运行时注入 `<style>` | nonce 覆盖 | 证据 |
|--------|--------------------------|------------|------|
| 应用自有代码 | 仅 WaveSurfer shadow `<style>` | ✅ `withWaveSurferCspNonce`（创建期 `cspNonce`）+ `applyWaveSurferShadowCspNonce`（创建后补） | `useProjectWaveformMount.ts` 两处；grep `src/` 无其他注入 |
| `wavesurfer.js` | shadow DOM `<style>` | ✅ 同上 | `waveSurferShadowCspNonce.ts` |
| `lucide-react` | 否（内联 SVG，无 `<style>`） | n/a | — |
| `react` / `react-dom` | 否（`style=` 走 `style-src-attr`，保留 `unsafe-inline`） | n/a | — |
| `waveform-data` | 否（纯数据） | n/a | — |
| Vite 产物 | 否（CSS 抽成外链 `<link>`，非 dev 的 JS 注入） | n/a | `dist/assets/*.css` |

结论：当前依赖集运行时 `<style>` 注入仅 WaveSurfer，已 nonce 覆盖。新增依赖若运行时注入裸 `<style>`，由下方 H-CSP-1/2 手测兜底。

### H-CSP-1 / 2 手测 runbook（需 macOS Release 包 + DevTools；本环境无 `.app`，留待用户在 mac 执行）

```bash
# 1. 构建 Release（含 bundled sidecar）
npm run release:mac           # 或 npm run desktop:build-app
# 2. 产物完整性 + 波形 filesystem probe
npm run release:postbuild-verify
# 3. 带 DevTools 打开，逐路径看 Console
RUSHI_DEVTOOLS=1 open "apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"
```

DevTools Console 关注：**无** `Refused to apply inline style because it violates ... Content Security Policy` / `Refused to load the stylesheet`（`style-src-attr` 来的 inline `style=` 属允许，不应报）。

| ID | 项 | 结果 |
|----|-----|------|
| H-CSP-1 | Release 包 Editor 波形加载；Console 无 style-src violation | ✅ 2026-06-12（mac 手测） |
| H-CSP-2 | 交付导出 Dialog、环境页三盏灯样式正常，无 violation | ✅ 2026-06-12（mac 手测） |

## 能力—UI 状态矩阵

> 本片为 Tauri 配置 + 守卫，无新增「环境/ASR/设置」类能力态 UI 控件；现有 nonce 链路对用户透明。仅记录关键运行时数据源以备回归：

| UI 控件 / 文案 | 状态维度 | 数据源（API/字段/hook） | 手测场景 |
|----------------|----------|-------------------------|----------|
| Editor 波形 shadow `<style>` | 是否携带运行时 nonce | `readTauriStyleCspNonce()` → `applyWaveSurferShadowCspNonce` / `withWaveSurferCspNonce` | 去 `unsafe-inline` 后 Release 波形仍渲染、Console 无 violation（H-CSP-1） |
| 全应用元素样式（字体外链 / 面板） | 回退到 `style-src`（已删 `style-src-elem`） | Tauri 自动注入 `style-src` nonce + `'self'` + `fonts.googleapis.com` | 字体加载正常、面板样式正常（H-CSP-2） |

矛盾手测场景（≥2）：

1. **nonce 缺失矛盾**：dev（保留 `unsafe-inline`）下波形正常 ≠ Release（纯 nonce）下波形是否正常 —— 须 Release 包验证（H-CSP-1）。
2. **指令回退矛盾**：删除 `style-src-elem` 后，字体外链 `<link href=fonts.googleapis.com>` 须由回退的 `style-src` 放行；若 `style-src` 漏掉 `fonts.googleapis.com` 则字体被拦 —— 配置须保留该 host（H-CSP-2）。

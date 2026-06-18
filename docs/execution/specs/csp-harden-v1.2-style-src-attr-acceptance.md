# Spec(acceptance): CSP-HARDEN v1.2 — `style-src-attr` 去 inline

> **Research brief**：[`csp-harden-v1.2-style-src-attr-research.md`](./csp-harden-v1.2-style-src-attr-research.md)
> **Plan**：[`csp-harden-v1.2-style-src-attr-plan.md`](./csp-harden-v1.2-style-src-attr-plan.md)

## 自动门禁（每片 + 收官）

- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过（含 `cspNonceStyleRegistry.test.ts`、波形/主题回归）
- [ ] `node scripts/check-architecture-guard.mjs` **0 error**
- [ ] 收官：生产 `tauri.conf.json` **无** `style-src-attr: 'unsafe-inline'`
- [ ] 收官：守卫负向自测 — 临时加回 attr unsafe-inline → error
- [ ] 收官：守卫负向自测 — 业务文件出现 `style={{` → error

## 配置验收（CSP-ATTR-7）

- [ ] 生产 `csp`：无 `style-src-attr` 或值为 `'none'`
- [ ] 生产 `csp.style-src` 仍无 `unsafe-inline`（v1.1 不回退）
- [ ] 生产 `csp` 仍无 `style-src-elem`
- [ ] `devCsp` 含 `style-src-attr: 'unsafe-inline'`（dev 可开发）
- [ ] `dist/index.html` nonce probe 仍在（v1.1 回归）

## H-CSP 手测（Release 包 · 须 macOS `.app` + DevTools）

> **勿用 `tauri dev` 代签** — attr 硬化仅生产 `csp` 生效。

```bash
npm run release:mac
RUSHI_DEVTOOLS=1 open "apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"
```

Console：**无** `Refused to apply inline style` / `violates ... style-src-attr` / 同类 CSP 报错。

| ID | 路径 | 检查点 | 结果 |
|----|------|--------|------|
| **H-CSP-3** | Editor + 波形 | 加载 peaks、zoom、minimap、playhead、语段 overlay；resize 窗口 | |
| **H-CSP-4** | 浮层 | 语段右键菜单、纠错 popover、Workbench 溢出菜单、拖拽面板 | |
| **H-CSP-5** | 环境页 | 外观 accent 切换、ASR 安装进度条、本地模型 card 进度 | |
| **H-CSP-6** | Welcome + 侧栏 | 页脚 grid、toast 通知、最近文件列表 scroll | |
| **H-CSP-7** | 语段列表 | 大文件虚拟列表 scroll、选中、Find 对话框、行高稳定 | |

### v1.1 回归（勿回退）

| ID | 项 | 结果 |
|----|-----|------|
| H-CSP-1 | Editor 波形 + Console | |
| H-CSP-2 | 交付导出 Dialog、环境三盏灯 | |

## 能力—UI 状态矩阵

> 本片无新增 ASR/LLM 能力；仅样式应用路径变更。

| UI | 状态维度 | 数据源 | 手测 |
|----|----------|--------|------|
| 外观 accent 预设 | 选中 preset 色板 | `data-accent-theme` + CSS | H-CSP-5 切换 3+ preset |
| 波形 layout | zoom/resize 后宽度 | `cspNonceStyleRegistry` scope `waveform-layout` | H-CSP-3 resize |
| ASR 下载进度 | 0–100% 条 | scaleX / registry | H-CSP-5 |

矛盾场景（≥2）：

1. **dev vs Release**：dev 有 attr 例外 → 仅 Release 能验 attr 硬化；须 Release 包签 H-CSP-3～7。
2. **nonce 缺失**：若 probe nonce 读失败，registry 静默 no-op → 波形/layout 崩；H-CSP-3 覆盖。

## 签收

- [ ] Research / intent / plan / acceptance 四件套链接闭环
- [ ] Phase 1–7 编码完成
- [ ] H-CSP-3～7 Release 手测
- [ ] 路线图 §10.5 v1.2 CSP 项更新 ✅

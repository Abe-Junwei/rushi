# Rushi 全方位代码审查报告 v2

> **日期**：2026-06-12  
> **计划**：[`code-review-program-2026-06.md`](./execution/specs/code-review-program-2026-06.md)  
> **前序**：[`code-review-report-2026-06-06-full.md`](./code-review-report-2026-06-06-full.md) · [`code-review-report-2026-06-12.md`](./code-review-report-2026-06-12.md)  
> **基线**：[`review-baseline-2026-06-12.md`](./execution/specs/review-baseline-2026-06-12.md)  
> **文案登记**：[`copy-code-drift-register-2026-06-12.md`](./execution/specs/copy-code-drift-register-2026-06-12.md)

---

## 1. 执行摘要

| 维度 | 结论 |
|------|------|
| **Phase 0 基线** | ✅ 全绿（lint/guard 仅 warning；release smoke N/A 无本地 bundle） |
| **Phase 1–6 静态** | ✅ 复用 2026-06-06 17 轮 + 本次 spot-check；无新增 P0 |
| **Phase 7 文案** | 静态 ✅；**CX0=0**（本轮修复 2 处 release npm 泄漏 + 1 处 CX1） |
| **Phase 8 僵尸路径** | ✅ 无用户可达命令面板 / china_stt_shell / 4b 下载 UI |
| **Phase 9 债务** | P0「不上传产物」**已关**；签名仍为 **可选 secret** 路径 |
| **动态 P1–P12** | ☐ 需 release 安装包手测（dev E2E 1/1 + ASR 2/2 已通过） |

**本轮代码修复（文案/能力）**

1. `asrOneClickPrepareModelFlow.ts` — `packagedOrDev` 去除 release 路径 `npm run asr:dev`
2. `LocalAsrAdvancedSection.tsx` — release 隐藏 FunASR stub 手动 pip 命令块
3. `prepareModelDownloadCopy.ts` — `modelscope_not_installed` release 分支 + 单测
4. Phase 7-A 既有：`DeleteSegmentConfirmDialog`、`EditorSegmentToolbarActions`、`segmentContextMenuModel` 指针拆分
5. `user-guide-zh.md` §5 快捷键摘要

---

## 2. Phase 0 — 基线

见 [`review-baseline-2026-06-12.md`](./execution/specs/review-baseline-2026-06-12.md)。

**新增工具**：`scripts/audit-copy-shortcuts.sh`（游离 ⌘/Ctrl+ 扫描；当前 3 处 🟡 已登记）。

---

## 3. Phase 1 — 项目与 SQLite

| 项 | 静态 | 动态 | 证据 |
|----|------|------|------|
| 迁移幂等 / busy 状态机 | ✅ | N/A | `db.rs` 35+ tests；2026-06-06 R1 |
| Mega-hook `useProjectController` | ⚠️ P1 债务 | N/A | 329L，guard warning |
| WAL 注释 vs 实现 | ⚠️ P3 | N/A | `db.rs` 仍无 `journal_mode=WAL` |
| Bundle 导入 zip-slip | ✅ | ☐ P1 手测 | Rust tests |
| REV-LOC | ✅ | ☐ | 脚本 `rev-loc-slice-*` 未本次重跑 |

**结论**：无回归；架构债务仍开放。

---

## 4. Phase 2 — 转写全链路

| 项 | 静态 | 动态 | 证据 |
|----|------|------|------|
| Sidecar 生命周期 / 互斥启动 | ✅ | ✅ | preflight smoke；ASR E2E transcribe |
| `run_transcribe_cmd.rs` 体量 | ⚠️ P2 | N/A | 764L hotspot |
| 增量 `segments_delta` | ✅ | N/A | Round 2 |
| ASR-WARM release idle | ✅ | ✅ H5 | signoff 2026-06-12；warmup 503 smoke |
| R3-STATE D1 门控 | ✅ | ☐ S3 | `computeLocalAsrTranscribeReady` 替代裸 `ready_for_transcribe` |

---

## 5. Phase 3 — 编辑器 / 波形 / 快捷键

| 项 | 静态 | 动态 | 证据 |
|----|------|------|------|
| Shortcut registry L2 | ✅ | ☐ 12 键位 | 单测 46+；dispatcher + escape stack |
| Draft / merge / flush | ✅ | ☐ P6 | git 变更区有 mergeDelete 测试 |
| 波形 hooks 3637L | ⚠️ P1 | N/A | guard；scroll-follow 重构进行中 |
| Playwright UI smoke | ✅ | ✅ | welcome shell 1/1 |

---

## 6. Phase 4 — F0 / 导出 / 质量

| 项 | 静态 | 动态 | 证据 |
|----|------|------|------|
| Stage B「智能改稿」| ✅ | ☐ P10 | 非 zombie R3t-E；gated by LLM |
| DOCX 内存构建 | ⚠️ P1 | ☐ P11 | `export_docx_build.rs` 全量 Vec |
| 质量 Tab eval | ✅ | ☐ | `EnvQualityPanel` npm hint 🟡 |
| F0 consent 文案 | ✅ | ☐ D5 | 与 spec 一致（静态） |

---

## 7. Phase 5 — 环境 / LRC

| 项 | 静态 | 动态 | 证据 |
|----|------|------|------|
| `packagedUserHints` L2 | ✅ | ☐ S1 | CX0 泄漏已修 |
| D1–D6 能力矩阵 | ✅ | ☐ S2–S3 | `asrEnvStatus` + architecture doc |
| LRC runtime manifest | ✅ | N/A | release.yml 签名 manifest 步骤 |
| R3h rollback 脚本 | ✅ | ☐ | 未本次重跑 |

---

## 8. Phase 6 — 安全 / 发行

| 项 | 静态 | 动态 | 证据 |
|----|------|------|------|
| Release 产物 upload | ✅ **已修复** | N/A | `gh release upload` 三平台 |
| 代码签名 | ⚠️ 可选 | N/A | `APPLE_*` / `WINDOWS_CERTIFICATE` 有则签，无则 unsigned |
| CSP unsafe-inline | ⚠️ P1 | N/A | 2026-06-06 Round 9 |
| npm audit | ✅ | ✅ | 0 vulns |
| Tauri capability ACL | ⚠️ P1 | N/A | 90+ invoke / default cap |
| `AppErrorBoundary` | ✅ **新增** | N/A | `main.tsx` 已包裹（2026-06-06 P1 已闭合） |
| Installed smoke | N/A | ❌ dev tree | 需 `desktop:build-dmg` |

---

## 9. Phase 7 — 文案—代码（专项）

### 9.1 子轮汇总

| 子轮 | 静态 | 主要发现 |
|------|------|----------|
| **7-A** | ✅ | 3 处 hint 修复；Esc/dialog 单测 |
| **7-B** | ✅ | D1–D6 对齐；CX0/CX1 已修 |
| **7-C** | ✅ | 在线 STT 无 Key 文案正确；LLM Gate-B |
| **7-D** | ✅ | 导出/质量/Hub 与 acceptance 静态一致（未跑 Word 打开） |
| **7-E** | ✅ | user-guide §5；obsolete r3t-e checklist 仍 🟡 文档 |

### 9.2 CX 统计

| 等级 | 开单 | 已关 | 待决 |
|------|------|------|------|
| CX0 | 2 | **2** | 0 |
| CX1 | 1 | **1** | 0 |
| CX2 | 1 | 1 | 0 |
| CX3 | 6 | 1 | **5** |
| CX4 | 3 | 0 | 3 |

### 9.3 文案回归测试（≥3 条 ✅）

1. `segmentContextMenuModel.test.ts` — 指针拆分无 hint  
2. `prepareModelDownloadCopy.test.ts` — modelscope packaged 分支  
3. `editorShortcutRegistry.test.ts` + dispatcher + escape stack（既有）

---

## 10. Phase 8 — 性能 / 平台 / 僵尸

| ID | 项 | 结果 |
|----|-----|------|
| Z-01 | 命令面板 UI | **无** — 仅 `plugin-system/types` 脚手架 |
| Z-02 | `china_stt_shell` | **已移除** — 文档漂移 CX3 |
| Z-03 | 独立 R3t-E 入口 | **无** — Stage B 继任 |
| Z-04 | LLM 4b 下载 UI | **无** |
| Z-05 | ⌘Space 播放 hint | **无漂移** — ⇧⌘Space 正确 |
| Z-06 | Plugin loader 生产未接线 | P2 债务 — test-only |

**未跑**：500+ 语段 soak、Windows smoke（登记豁免）。

---

## 11. Phase 9 — 2026-06 债务复验

| 原 ID | 原级 | 状态 | 静态证据 | 动态证据 | 备注 |
|-------|------|------|----------|----------|------|
| Rel-upload | P0 | **关单** | `release.yml` gh upload | N/A | 2026-06-06 后修复 |
| Rel-sign | P0 | **部分** | 可选 secret 分支 | N/A | 无 secret 仍 unsigned |
| Tauri ACL | P1 | 开放 | capabilities/default.json | N/A | |
| CSP inline | P1 | 开放 | tauri.conf.json | N/A | |
| R3-STATE D5 | P1 | **改善** | `computeLocalAsrTranscribeReady` | ☐ S3 hand-test | |
| Mega-hook 波形 | P1 | 开放 | guard 47 warnings | N/A | |
| E2E 金字塔 | P1 | **改善** | desktop-ui 1 test 新增 | ✅ | 仍非全 P1–P12 |
| ErrorBoundary | P1 | **关单** | AppErrorBoundary | N/A | |
| blocking HTTP 600s | P1 | 开放 | stt_online_probe | N/A | |
| Keyring macOS | P1 | 开放 | postprocess_secret_store | N/A | |
| DOCX OOM | P1 | 开放 | export_docx_build | N/A | |
| WAL | P3 | 开放 | db.rs | N/A | |
| Plugin ext | P2 | 开放 | loader test-only | N/A | |

---

## 12. 主路径剧本 P1–P12

| ID | 静态/自动化 | Release 手测 |
|----|-------------|--------------|
| P1 欢迎建项 | ✅ E2E smoke | ☐ |
| P2 本机转写 ×2 | ✅ ASR E2E | ☐ |
| P3 关窗 gate | ✅ 代码 | ☐ |
| P4 撤销 / edit_log | ✅ Rust tests | ☐ |
| P5 查找替换 Esc | ✅ escape stack | ☐ |
| P6 合并拆分删除 | ✅ shortcut tests | ☐ |
| P7 波形播放 | ✅ 无 ⌘Space hint | ☐ |
| P8 改 ASR 语言 | ✅ D1 逻辑 | ☐ |
| P9 热词转写 | ✅ bias 静态 | ☐ |
| P10 F0 Stage B | ✅ | ☐ |
| P11 DOCX 三形态 | ✅ spec 对齐 | ☐ Word 打开 |
| P12 诊断包 | ✅ | ☐ |

---

## 13. 完成标准对照

| # | 标准 | 状态 |
|---|------|------|
| 1 | P1–P12 release 全绿或豁免 | ☐ **待 release 手测**（dev 自动化部分绿） |
| 2 | C-01–C-15 静+动 | 静态 ✅；动态 🟡 |
| 3 | CX0=0；CX1 关单 | ✅ **本轮达成** |
| 4 | P0–P3 复验 | ✅ 本表 §11 |
| 5 | ≥3 文案回归 | ✅ |
| 6 | user-guide 与 C-01/C-03 | ✅ §5 已补 |

---

## 14. 建议后续（按优先级）

1. **`npm run desktop:build-dmg`** → 跑 P1–P12 + Phase 7 动态矩阵 + `v1-release-installed-smoke.sh`
2. **CX3 待决**：FindReplace ⌘Enter / WaveformOverlay 是否入 registry 或保持局部
3. **P0 签名**：配置 `APPLE_*` / Windows cert secrets 或登记「unsigned 分发」产品决策
4. **文档**：archive `r3t-e-hand-test-checklist.md` obsolete 步骤；更新 2026-06-06 报告中 china_stt_shell 引用
5. **架构**：波形 mega-hook 拆分、DOCX 流式导出（延续 Sprint D）

---

## 15. 修订

| 日期 | 说明 |
|------|------|
| 2026-06-12 | v2：执行 code-review-program Phase 0–9；修复 CX0/CX1；产出三件套 |

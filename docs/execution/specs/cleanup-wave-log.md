# 代码库清理 — 波次日志

> 每波 3 行：**改了啥** / **验证了啥** / **下一轮**

---

## Phase 0–1（2026-06-14）

- **改了啥**：仅扫描；产出 baseline + candidate register；未删代码  
- **验证了啥**：typecheck ✅ · 1372 tests ✅ · guard 0 错误 / 42 警告  
- **下一轮**：Wave A — CLN-001～004、008、011～012、020～022（死文件 + deprecated 无调用 export）

---

## Wave A（2026-06-14）

- **改了啥**：删除 11 死文件（CLN-001～012）；收口 deprecated export（CLN-020～022、026）；修正 `llmEnvStatus.test.ts`；归档 `r3t-e-hand-test-checklist.md`；更新 bundled-asr README 与 stitch 对照注记  
- **验证了啥**：typecheck ✅ · 1371 tests ✅ · guard 0 错误 / 42 警告  
- **下一轮**：Wave B/C — deprecated props + 文档漂移

---

## Wave B + C + D（2026-06-14）

- **改了啥**：删除/迁移 CLN-023～030、040～044、042～043；Python `sort_window_segments` 替代 `merge_window_segments`（CLN-071）；文档 CLN-060～063、065；**同批** ASR ffmpeg PATH 修复（侧车 `_internal` 注入 PATH）  
- **验证了啥**：（提交前闸门）typecheck · test · guard · pytest ASR  
- **下一轮**：Wave E knip export 二轮（人工台账）；CLN-070 Rust dead_code 逐项；CLN-045～047 迁移层 KEEP 至可证零

---

## Wave E1（2026-06-14）

- **改了啥**：knip 二轮台账 + `knip.json`；删除/收口 47 项死 export（POSTPROCESS 别名、术语 table 样式、LLM 废弃类型等）；UNEXPORT 内部样式/helpers  
- **验证了啥**：typecheck ✅ · 1371 tests ✅ · knip unused exports **296→249**（types 94→90）  
- **下一轮**：Wave E2 — utils / floatingPanel / services 批量 UNEXPORT

---

## Wave E2（2026-06-14）

- **改了啥**：E2 分析台账；批量 UNEXPORT 131 符号（73 文件）；DELETE 死函数/常量 20+ 项；收口 `floatingPanelSegmentListLayout` / ASR / segment 工具死 export  
- **验证了啥**：typecheck ✅ · 1371 tests ✅ · guard 0 错误 / 42 警告 · knip unused exports **249→114**  
- **下一轮**：Wave E3 — `tauri/*` KEEP 登记 + 测试 shared 收口

---

## Wave E3（2026-06-14）

- **改了啥**：`knip.json` 公共面 `ignoreIssues` + vitest entry；删除死 re-export barrel 与 30+ 死符号；测试改直引真源模块  
- **验证了啥**：typecheck ✅ · 1371 tests ✅ · guard 0 错误 / 42 警告 · knip unused exports **114→0**（types 7 KEEP）  
- **下一轮**：Wave E4 — 7 个 unused types 收口

---

## Wave E4（2026-06-14）

- **改了啥**：删除 7 个死 export type（`ColorToken`、`BusyPack`、`ProjectPanelShellApi` 等）；`PeakCache` 内部类型 UNEXPORT；`knip.json` 去掉冗余 entry  
- **验证了啥**：typecheck ✅ · 1371 tests ✅ · guard 0 错误 / 42 警告 · **knip 全绿（0 exports / 0 types）**  
- **下一轮**：CLN-070 Rust `dead_code`

---

## Wave F / CLN-070（2026-06-14）

- **改了啥**：清除 `src-tauri` 全部 12 处 `#[allow(dead_code)]` — 删 6 死符号、`cfg(test)` 收口 4 项、去掉 `MAX_PARAGRAPHS` 误标  
- **验证了啥**：`cargo test` 364 passed · typecheck ✅ · 1371 vitest ✅ · guard 0 错误  
- **下一轮**：CLN-072 blocking HTTP

---

## Wave G / CLN-072（2026-06-14）

- **改了啥**：`probe_asr_port_sync` / `post_model_warmup_sync` 迁至 `blocking_http`；新增 `loopback_get_send` + `loopback_post_ok`  
- **验证了啥**：`cargo test` 364 passed · guard **0** probe/warm blocking 警告  
- **下一轮**：release parity 手测（CLN-066）或 scripts README（CLN-073）

---

## Wave H / CLN-073–074（2026-06-14）

- **改了啥**：新增 [`scripts/README.md`](../../../scripts/README.md)（npm 接线表 + 发布/ASR/门禁/手测/spike 分组）；`.gitignore` 补 `/*.app` 覆盖根目录 staged symlink  
- **验证了啥**：根目录 DMG / `.app` 未进 git · README 链到现有 parity / smoke 文档  
- **下一轮**：CLN-066 release parity 手测（人工）；或登记 Wave A–H 程序收尾

---

## CLN-066 L2（2026-06-14）

- **改了啥**：跑通 `release:postbuild-verify` + `v1-release-installed-smoke`；补 [release-parity-evidence-2026-06-14.md](../release-parity-evidence-2026-06-14.md)；`release-sidecar-preflight` 硬检 `sidecar-build-stamp.txt`  
- **验证了啥**：parity startup/bundle/project/asr ✅ · diagnostic zip 7 项 ✅ · asset_scope_ok / peaks 探针 ✅  
- **下一轮**：L3 UI 手测（7-A D1–D8 · 7-B S1–S6 · dmg-vs-dev §安装包内验收）；发版前 `npm run asr:build-sidecar-unix` 重生 stamp

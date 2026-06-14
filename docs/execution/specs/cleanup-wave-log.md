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

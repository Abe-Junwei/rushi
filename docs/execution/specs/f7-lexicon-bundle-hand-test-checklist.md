# F7 词表包 — 手测清单

> **状态**：✅ 手测签收（2026-06-03）· §A 导出 · §B 导入（单机）· **自动化 A→B** ✅  
> **验收真源**：[`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md) § ASR-VOC-2（2b）· [`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P2 F7  
> **机器回归**：`cargo test f7_hand_test_ab_exchange` · `cargo test project_bundle_zip_excludes_lexicon_bundle`

## 环境

- [x] `npm run desktop:dev`；可打开欢迎页 **热词与记忆**
- [x] 机器闸门（2026-06-03 · `bash scripts/f7-lexicon-bundle-hand-test.sh`）：

```bash
npm run typecheck && npm run test -w @rushi/desktop && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml f7_hand_test_ab_exchange project_bundle_zip_excludes_lexicon_bundle
```

**自动化签收（2026-06-03）**：`f7_hand_test_ab_exchange_glossary_and_stable_rules` 覆盖 A 导出 stable 包 → B 空库导入 → hotwords 含术语、稳定规则进 F1/Pack；`project_bundle_zip_excludes_lexicon_bundle` 确认项目 zip 无词表包。

---

## §A — 导出（用户 A）

**准备**

1. 在 **热词与记忆** 增加术语：`觉观`（勾选纳入热词），别名可填 `觉观门`。
2. 纠错记忆：手动纳入或编辑一条稳定规则，例 `山通` → `禅宗`（hit≥2 或已采纳）；另加一条 **仅 hit=1** 的 `闪法` → `战法`（用于验证默认不导出）。

**操作**

1. 滚动到 **词表包（小团队交换）**。
2. 保持勾选 **仅导出稳定记忆**；来源标签填 `手测-A`。
3. 点 **导出词表包…**，保存为 `rushi-lexicon-handtest-a.json`。

**期望**

- [x] 状态行提示已导出路径（2026-06-03 手测签收）
- [x] 用文本编辑器打开 JSON：`kind` = `rushi_lexicon_bundle`，`version` = `1`，`exported_by.optional_label` 已写入
- [x] 含预期 `glossary_terms` / 稳定 `correction_rules`；**不含** 仅 hit=1 的规则（stable_only）
- [x] 顶层 **无** `segments`、`api_key` 等字段

---

## §B — 导入（用户 B · 无冲突）

> **无第二台机器时**：在本机删条后再导入（2026-06-03 已按此路径签收）。

**准备**

- 另一台机器、或本机 **删除** 待验证的术语/规则后再导入，确保导入前库中 **尚无** 包内那些 term/规则对。

**操作**

1. **热词与记忆** → **导入词表包…** → 选择 §A 的 JSON。
2. 无冲突时应 **直接成功**（不弹冲突对话框）。

**期望**

- [x] Toast/状态：术语 +1、规则 +1（或类似汇总）
- [x] 术语表与纠错记忆恢复包内条目；热词勾选正确
- [x] 转写词汇表摘要 / preview 反映导入术语
- [x] **应用纠错规则（全文）** 预览可见导入的稳定规则（语段有匹配时）

---

## §C — 导入冲突（同 before 异 after）

**准备**

- B 机已有：`闪法` → `闪击`（hit≥2）。
- 词表包内同 before：`闪法` → `战法`（hit 高于本地或平手见下）。

**操作**

1. 导出仅含该规则的小包（或改 JSON 中 `hit_count`）。
2. 导入 → 应弹出 **导入词表包** 对话框。
3. 选 **使用包内规则** → **应用导入**。

**期望**

- [ ] 预览列出冲突项；应用后纠错记忆为 `闪法` → `战法`（仅一条 after）
- [ ] 选 **保留本地** 时 after 仍为 `闪击`

---

## §D — 术语字段冲突（可选）

**准备**：B 已有 term=`测试专名`，别名 `甲`；包内同 term，别名 `乙`。

**期望**

- [ ] 预览 `glossary` 冲突；**合并别名** 后术语库 aliases 含 `甲` 与 `乙`

---

## §E — 与项目包隔离（D9）

**操作**：在编辑器导出 **项目包** zip（非词表包）。

**期望**

- [ ] zip 内仅有 `manifest.json` / `project.json` / `audio/*`，**无** `rushi_lexicon_bundle` 或 `lexicon` 命名字段（机器测：`project_bundle_zip_excludes_lexicon_bundle`）

---

## §F — 负例

| 场景 | 操作 | 期望 |
|------|------|------|
| 非法 JSON | 导入 `{}` | 解析失败，有可读错误 |
| 含语段字段 | 顶层加 `"segments":[]` | 拒绝导入 |
| 错形术语 | 包内 term=`闪法`（且在纠错记忆 before） | 导入跳过或 `skipped_wrong_form`（与 VOC-GUARD 一致） |

---

## 签收记录

| 日期 | §A 导出 | §B 无冲突导入 | §C 规则冲突 | §D 术语冲突 | §E 项目包 | 自动化 A→B |
|------|---------|---------------|-------------|-------------|-----------|------------|
| 2026-06-03 | ✅ | ✅ 单机导入 | — | — | ✅ 机器 | ✅ `f7_hand_test_ab_exchange` |

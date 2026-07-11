# 整仓多波次全覆盖审查报告（2026-07-11）

> **方案**：整仓多波次全覆盖审查 v2  
> **范围**：不限最近 working tree；桌面 UI + Tauri + ASR 侧车 + 发行/安全 + 词表/文案/媒体/数据/评测/僵尸域  
> **基线**：`typecheck` ✅ · architecture-guard **0 错 / 20 警告**  
> **状态**：审查完成；**P1 全修 + 可落地 P2 已修**（见「已落地修复」）

---

## 执行摘要

| 级别 | 审查时 | 现况 |
|------|--------|------|
| **P0** | 0 | 0 |
| **P1** | 3 | **已修** |
| **P2** | ~15 | **可落地项已修**；stt-read-key / nsis-sign **延期**；热点拆分 / plugin 删除 / supervisor 接线 **已做** |
| **Note** | 多条 | 部分已修（hotwords title、STT preferPersisted、NavBlock 停止文案） |

---

## 已落地修复

### P1

| ID | 改动 |
|----|------|
| P1-asset-scope | `tauri.conf.json` 仅 `$APPDATA/studio.lingchuang.rushi/**/*` |
| P1-audit-ci | CI `security-audit` 去掉 `continue-on-error` |
| P1-a11y-search | Welcome 搜索结果 `id` + `role=option` |

### P2 / Note

| ID | 改动 |
|----|------|
| P2-bundle-fields | zip 导入写 `kind/text_stage/finalize_via/annotation` + 单测 |
| P2-quit-copy | 转写阻断→未保存门禁透传 `app-quit`/`navigate` |
| P2-ollama-toast | Ollama 保存后探测完成 toast |
| P2-nav-copy | `ENV_NAV` 统一为「环境 → …」并替换硬编码路径 |
| P2-onboard-activity | Inbox onboarding 与 checklist 同源有效转写源 |
| P2-search-dialog | 搜索/活动面板 `role=region` |
| P2-lexicon-ternary | glossary 冲突默认 `merge_aliases` |
| P2-mine-partial | 采纳 X/N 反馈，仅 dismiss 成功项 |
| P2-repr-job | `transcribe_job` / `model_prepare` 用 `str(e)` |
| P2-ota-notes | update notes `slice(0, 500)` |
| P2-ffmpeg-timeout | ffmpeg remux 120s watchdog |
| P2-e2e-stale | CM6 selector；latency profile **un-skip**（`.cm-line` / ArrowDown） |
| P2-backfill-startup | SHA256 回填改开池后后台线程 |
| Note | hotwords `title`；STT save→probe `preferPersistedCredentials`；NavBlock 停止文案对齐 |
| Note M3 | `onlineTranscribeProviderShortLabel`：busy overlay 短标签；chip ok 仍用 catalog 长 label |
| Note R-15 | plugin-system **已删**（CLN-905 DONE DELETE） |
| Note I1b | 环境页 health poll / 向导 sidecar 步改读 `asr_supervisor_snapshot`（phase + portStatus）；不再仅依赖 `bundled_launch` 布尔 |

### 延期

| ID | 说明 |
|----|------|
| P2-stt-read-key | IPC 明文为有意设计；Rust 侧解析收紧延期 |
| P2-nsis-sign | 交 win-release-assets 验收薄片 |
| Windows IME W-1 | 发版前手测硬门禁 |
| 协作/CAT/Sherpa | 故意延期产品化 |
| Orphan IPC | `waveform_release_probe` / `quality_save_report_from_json` **已从 registration+permissions 移除**；`asr_supervisor_snapshot` **已接线**（env health poll + 向导） |

---

## 分波结论（审查时）

Wave0–12 均有书面结论；CM6 / capability-UI / 密钥主路径健康。详见对话中各波 findings；本文件为合并真源。

---

## 验证（本轮修复）

- `npm run typecheck` ✅  
- 定向 vitest（close-gate / LLM panel / mine / ProjectStatusFeedback / asrEnvStatus）✅  
- `cargo test project_bundle` ✅（首轮）；ffmpeg/pool 相关 Rust 测试由修复代理跑通  
- 全仓 `npm run test` / `test:perf` / CI main **✅**（2026-07-11 收口）

---

## 落地提交总览（2026-07-11 收口）

| Commit | 主题 |
|--------|------|
| `778f483` | CM6 硬化、STT/LLM 保存后 auto-probe、审查 P1/P2 修复 |
| `931de3d` | 拆分 playback/prepare 热点；orphan IPC；厂商短名；E2E |
| `98053d0` | 删除 plugin-system（CLN-905）；接线 `asr_supervisor_snapshot` |
| `8ebfefe` | CI：lint / doc-links / cargo-audit |
| `3964037` | CI：rustfmt + selection perf 对齐 P9b2 |
| `29c463f` | 去掉 Google Fonts CDN + CSP |
| `#35` / `#38` | Dependabot：actions/cache@6、zip 8.6.0 |

**仍开**：Dependabot npm group（#41 替换已关闭的 #39）；cargo minor（#40，合并中/已绿）。

**延期不变**：`stt_read_api_key` 收紧、NSIS 签名、Windows IME W-1、协作/CAT/Sherpa。

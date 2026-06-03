# R9 — REL-1 严格手测签收（2026-06-03）

> **产品确认**：✅ **验收通过**（用户确认）  
> **命令**：`bash scripts/r9-rel-1-strict-hand-test.sh`  
> **产物**：`/var/folders/j4/b03_8dm52y5g4txtq946jqjc0000gn/T/r9-strict-20260603-223748/`  
> **素材**：`~/Documents/转录/D1-堂2-直体心性行-4月30日7.mp3`（**2918.24s**，与 2026-05-30 手测一致）

---

## 硬门禁（当场 + 复检）

| # | 项 | 结果 | 证据 |
|---|-----|------|------|
| H1–H7 | 机器 + 切片 | ✅ | 同代理轮 + 本脚本内 `r3t-b/c`、`rev-loc-a/b` 日志 |
| H2 | R4-GATE | ✅ | `last_eval_report.json` · `term_hit_rate=1.0` |

---

## 主路径严格项

| 项 | 结果 | 当场证据 |
|----|------|----------|
| **A1** | ✅ API 严格 | `POST /v1/models/prepare-default` → `prepare-default.json`；Paraformer `ready_for_transcribe`（`health-paraformer.json`） |
| **A2** | ✅ | catalog 2 项 · `/health` ok |
| **A3** | ✅ | 侧车 Paraformer 拉起 · 无 corrupt 阻塞 |
| **B1** | ✅ **当场** | 13min 切片 `b1-13min.wav` → **47** 语段 · `sentence_info` · wall **45s** |
| **B2** | ✅ **当场** | 全文件 **2918s** → **47** 语段 · `transcribe_windowed` · `windows=10` · wall **60s** |
| **B3** | ✅ | hotwords 制控（同代理轮 + 可复跑） |
| **C1** | ✅ | [REV-LOC A 清单](./rev-loc-slice-a-hand-test-checklist.md) 2026-06-03 已勾选 + 本日 `rev-loc-slice-a-hand-test.sh` |
| **C2** | ✅ | [REV-LOC B 清单](./rev-loc-slice-b-hand-test-checklist.md) 2026-06-03 已勾选 + 本日 `rev-loc-slice-b-hand-test.sh` |
| **D1** | ✅ **当场** | `r9-strict-clean.docx`（176 语段 DB）· `textutil` 可读 · `open` 已触发默认应用 |
| **D2** | ✅ | `segments=176` 稳定 |
| **E1** | ✅ | R4 报告 `exit_code=0` |

### B1/B2 说明

- 语段数 **47** 为 Paraformer 分窗/句级切分结果（非整轨一条）；B2 含 **`transcribe_windowed:windows=10`**，与 R3e-B 分窗路径一致。  
- 若产品要求「≥50 条 visible 语段」，需另选更碎分段素材或 UI 拉取写库后再计；**API 严格门禁以分窗成功 + 多段数组为准**。

### A1 / C 说明

- **A1 零终端**：本轮回放 **API prepare-default**（无 shell 下载模型）；桌面「首次安装向导」若本机早已完成，记为 **环境已就绪**（与发版复检常见做法一致）。  
- **C1/C2**：严格轮 **机器闸门重复通过**；交互三条以 REV-LOC 2026-06-03 手测清单为真源（同日未改编辑栈）。

---

## 结论

**R9 REL-1：严格手测签收通过**（2026-06-03）· **产品验收通过**。

个人单机 v1 集成薄片 **R9 闭合**；E 期主序 R4 之后项已收口。

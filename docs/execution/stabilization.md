# P4 稳定化与评测（执行笔记）

对应计划书 **§8 P4**：评测集、指标、批量与恢复、安装包、诊断包。本文件为 Rushi 仓内 **执行真源**；与 Jieyu 计划冲突时以本仓实现为准。

## 1. 评测集

- 目录：[`fixtures/eval/`](../../fixtures/eval/README.md)
- 清单：`eval_manifest.v1.json`（`schema_version`、`items[]`）
- 占位音频：`bash scripts/eval-generate-placeholders.sh`（需 ffmpeg）

## 2. 指标（CER / 术语命中 / 低置信 / 长音频 ACC-EVAL-2）

Python 库：`services/asr/rushi_asr/eval_metrics.py`

- `cer_chars(reference, hypothesis)`：按 **Unicode 码位** 的编辑距离 / `len(reference)`。
- `term_hit_rate(terms, hypothesis)`：术语是否在识别结果中 **子串命中**（朴素版，后续可换对齐/分词）。
- `low_confidence_ratio(segments)`：JSON 语段列表中带 `low_confidence` 的比例。
- `rtfx(duration_sec, wall_sec)`：长音频 **RTFx**（音频秒 / 推理墙钟秒）。
- `resolve_segmentation_mode(body, warnings)`：从 `TranscriptionResult` 或 warnings 解析分段模式。

对比报告（引擎/规则前后差异）可由 CI 或本地脚本调用上述函数 + 固定 manifest 输出 JSON。

**ACC-EVAL-1**（= ASR-VOC-5）：热词 on/off、`term_hit_rate` — [`asr-voc-5-hand-test-checklist.md`](specs/asr-voc-5-hand-test-checklist.md)

**ACC-EVAL-2**：`segment_count`、`wall_sec`、`rtfx`、`segmentation_mode` — [`acc-eval-2-long-form-metrics-intent.md`](specs/acc-eval-2-long-form-metrics-intent.md)；`npm run eval:run:long-form`（本机 Paraformer + 制控 mp3）。

**CI**：`asr` job 在 `pytest` 后 **后台启动 stub ASR**（`python -m rushi_asr`），待 `GET /health` 就绪后执行 `python3 scripts/eval-run.py`（仓库根 manifest + 占位 wav）。

**批跑清单（需本机 ASR + curl）**：仓库根执行 `npm run eval:run`（或 `python3 scripts/eval-run.py`）。会读取 `fixtures/eval/eval_manifest.v1.json`，对每条 `audio_relpath` 调用 `POST /v1/transcribe`，在 stdout 打印 JSON（含 `engine`、`warnings`、拼接假设文本、`low_confidence_ratio`、ACC-EVAL-2 长音频字段、有参考稿时的 `cer_chars`）。若音频缺失或请求失败，对应 `item` 带 `error` 且进程退出码为 1。

## 3. 批量任务与失败恢复（约定）

检查点 JSON 建议字段：

```json
{
  "schema_version": "1",
  "completed": ["path/or/id1.wav"],
  "pending": ["path/or/id2.wav"],
  "last_error": null
}
```

批处理脚本在每条成功后追加 `completed`、从 `pending` 移除；崩溃后重跑读取检查点 **跳过** `completed`。桌面端批量 UI 未实现前，以 **文档约定 + 外部脚本** 满足「可恢复」方向。

示例：[`fixtures/eval/checkpoint.example.json`](../../fixtures/eval/checkpoint.example.json)。

## 4. 本地安装包

- 根目录：`npm run desktop:build`（Tauri CLI；具体 bundle 受 `tauri.conf.json` 与平台影响）。
- **内嵌用户说明**：`apps/desktop/src-tauri/resources/user-guide-zh.md` 与 `user-guide-zh.pdf` 通过 `bundle.resources` 打入安装包；构建前由 `scripts/build-user-guide-pdf.sh` 生成 PDF（优先 `pandoc` + `wkhtmltopdf`，否则 `xelatex` + 本机中文字体；均不可用时沿用仓库已提交的 PDF）。
- CI：`desktop` job 安装 **pandoc、wkhtmltopdf** 后执行 `tauri build --bundles deb`（见 `.github/workflows/ci.yml`）。

## 5. 诊断包

桌面壳命令 **`export_diagnostic_bundle`**：用户选择保存路径后，生成 **zip**，主要包括：

- `build-info.txt`：版本、平台、`app_data_root`、`db_path`
- `database-readme.txt`：是否内嵌 `rushi.sqlite3`；若库文件 **小于 5MiB** 则一并打入 zip，否则仅说明（跳过库体）
- `recent_edit_log.tsv`：SQLite 表 **`edit_log` 最近 500 条**（只读打开；导出失败时写 `recent_edit_log-readme.txt` 说明原因）
- `logs/<name>.log`：`app_data_root/logs` 下各 **`.log` 文件尾部**（UTF-8，单文件最多约 **256KiB**；首行可能被截断）
- `logs-readme.txt`、`diagnostic-contents.txt`：上述内容索引说明

运行期 **桌面壳** 会在 `app_data_root/logs/desktop.log` 追加少量行（如启动、转写失败摘要），诊断 zip 会一并打包其尾部（若存在）。

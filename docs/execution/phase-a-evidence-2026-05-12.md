# 阶段 A 执行证据（对照规划书近期行动 + P0–P3 验收链）

**日期**：2026-05-12  
**仓库**：Rushi（本仓）  
**Git**：执行时 `HEAD` = **`c83de551985769bc2c5ff84b2ce0f6b6c5e989b9`**（短哈希 `c83de55`）；复验请以本机 `git rev-parse HEAD` 为准。

## A.1 自动化验收（已在本机执行）

### P0：10 条中文 WAV + `p0-acceptance.sh`

- **样本**：`bash scripts/generate-p0-chinese-samples-macos.sh` 生成 `fixtures/p0-samples/01.wav` … `10.wav`（目录内 `.wav` 被 `.gitignore` 忽略，不进入版本库）。
- **ASR**：`http://127.0.0.1:8741`（本机已有进程；`transcription_mode` 为 stub 时亦满足默认验收）。
- **默认口径**（`P0_REQUIRE_NONEMPTY_TEXT` 未设置或 `0`）：

```text
bash scripts/p0-acceptance.sh
# 结果：10/10 passed；各条 engine=stub, require_text=False
```

- **严格口径**（要求每条语段非空正文，需 FunASR 真转写）：

```text
P0_REQUIRE_NONEMPTY_TEXT=1 bash scripts/p0-acceptance.sh
# 在 stub 下：第 1 条即失败（segment 0 empty text）— 符合 p0-acceptance 文档预期
```

### README 合成冒烟：`p0-sample-batch.sh`

```text
bash scripts/p0-sample-batch.sh 10
# 结果：p0-sample-batch: 10/10 passed
```

### Playwright（ASR 契约，无桌面 GUI）

```text
cd apps/desktop && npm run test:e2e
# 结果：2 passed（/health 元数据 + /v1/transcribe 契约）
```

### 热词字段抽样（stub）

对 `POST /v1/transcribe` 附带 `hotwords` 时，`warnings` 含 **`hotwords_ignored_stub`**（与 `deriveTranscribeHints` 一致）。

### 命令记录（可复制复验）

```bash
cd /path/to/Rushi
git rev-parse HEAD
bash scripts/generate-p0-chinese-samples-macos.sh   # 需 macOS 中文语音 + ffmpeg
bash scripts/p0-acceptance.sh
P0_REQUIRE_NONEMPTY_TEXT=1 bash scripts/p0-acceptance.sh || true
bash scripts/p0-sample-batch.sh 10
cd apps/desktop && npm run test:e2e
```

## A.2 `supportsHotwordBias` 真值表

见 [`../architecture/asr-hotword-bias-truth.md`](../architecture/asr-hotword-bias-truth.md)。

## A.3 P1 / P3 手测核对清单（须操作员在桌面壳完成）

以下步骤摘自根目录 [`README.md`](../../README.md) **P1 手测** 与 [`p3-acceptance.md`](./p3-acceptance.md)；**自动化无法替代** GUI 另存为与 Word 打开检视。

| # | 步骤 | 结果（打勾） | 备注 / 日期 |
|---|------|-------------|-------------|
| 1 | 启动 ASR（`python -m rushi_asr`），`GET /health` 正常 | ☐ | |
| 2 | `npm run desktop:dev`，打开「本地项目与校对」面板 | ☐ | |
| 3 | 创建项目、选真实 **30–60 分钟** 级中文课音频（[`acceptance.md`](./acceptance.md) 建议） | ☐ | |
| 4 | 拉取语段 → 编辑 / 拆分 / 合并 → **保存到 SQLite** | ☐ | |
| 5 | 关应用重开，确认语段与时间戳仍在（P1 验收 2） | ☐ | |
| 6 | 导出 **TXT、SRT**，与界面正文对照（P1 验收 4） | ☐ | |
| 7 | 导出 **DOCX**（逐字稿 / 讲稿），检查低置信样式与正文一致（P3） | ☐ | |
| 8 | **导出诊断包**，确认含 `recent_edit_log.tsv` 等（P1 放宽口径之「追溯」） | ☐ | |

**签字**：___________　**日期**：___________

---

阶段 A 中 **A.1 自动化部分** 可由 CI/本机脚本复验；**A.3** 完成后，即视为阶段 A 在「含长音频与三格式导出」意义上闭环。

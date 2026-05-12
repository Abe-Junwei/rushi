# P0 验收（Rushi 本仓）

对照 Jieyu 计划书 **§8 P0：技术原型**（[`如是我闻-本地版改进计划书-2026-05-11.md`](../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md)）。

## 交付对照

| 计划条目 | 本仓状态 |
|----------|----------|
| FunASR / SenseVoice 可启动 | 可选：`pip install -e "./services/asr[funasr]"` + `RUSHI_FUNASR_MODEL`；未配置时为 **stub** |
| 单文件上传 → 分段 JSON | `POST /v1/transcribe`，字段见 `apps/desktop/src/contracts/transcription.ts` |
| FFmpeg 抽轨与规范化 | 服务端统一转 **16 kHz mono WAV** |
| `TranscriptionProvider` / `TranscriptionResult` 契约 | TS + `rushi_asr/schemas.py` 对齐 |

## 验收脚本（10 条）

1. **ffmpeg** 在 PATH；ASR 在独立 venv 中安装并启动（见根目录 README）。
2. 准备 **10 条** `fixtures/p0-samples/*.wav`：  
   - macOS：`bash scripts/generate-p0-chinese-samples-macos.sh`  
   - 或自备 10 个 wav 放入该目录。
3. 另一终端：

```bash
bash scripts/p0-acceptance.sh
```

默认 **`P0_REQUIRE_NONEMPTY_TEXT=0`**：校验 **JSON 契约 + 时间段 + 可降级置信度**。stub 下允许两条降级路径：
- 返回语段但正文为空（并带 `low_confidence` / `detail`），或
- 返回空语段数组并在 `warnings` 中给出 `stub_no_placeholder_segment` 说明。

若已配置 FunASR 且要求 **每条必须有中文文本**：

```bash
export P0_REQUIRE_NONEMPTY_TEXT=1
bash scripts/p0-acceptance.sh
```

单条校验器（管道任意 JSON）：

```bash
python3 scripts/validate_p0_transcription_result.py < response.json
```

## 失败样本「明确原因」

- HTTP 200 且 `error` 字段：如 `ffmpeg_not_found`、`ffmpeg_error:...`。
- FunASR 异常：进入 `warnings` 并回退 stub，或单段 `detail=funasr_empty_text`。

## 与「第一阶段」关系

产品「第一阶段」= 计划书 **P0–P3** 全部完成；本文仅覆盖 **P0 技术原型** 在本仓的可重复验收。进入 **P1** 见计划书 §8 P1（项目、播放、时间轴、导出等）。

**阶段 A（自动化部分）**：一次完整跑通记录见 [`phase-a-evidence-2026-05-12.md`](./phase-a-evidence-2026-05-12.md)；热词真值表见 [`../architecture/asr-hotword-bias-truth.md`](../architecture/asr-hotword-bias-truth.md)。

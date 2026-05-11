# P0 中文样本（本地生成 / 自备）

计划书 P0 验收要求 **10 个中文样本** 可批量转写。本目录**不提交** `.wav`（见仓库根 `.gitignore`）。

## 方式 A：macOS 一键生成（`say` + ffmpeg）

在仓库根执行：

```bash
bash scripts/generate-p0-chinese-samples-macos.sh
```

会生成 `01.wav` … `10.wav`（约 1～2 秒/条）。需本机已装 **ffmpeg**，且「系统设置 → 辅助功能 / 语音」里可用的中文语音（脚本会尝试 `Ting-Ting`、`Sin-ji` 等）。

## 方式 B：自备 10 条 wav

将文件命名为 `01.wav` … `10.wav` 放入本目录（或任意 `*.wav` 共 10 个），再跑验收脚本。

## 验收

```bash
# 先启动 ASR（独立 venv）
source services/asr/.venv/bin/activate
python -m rushi_asr
```

另一终端：

```bash
bash scripts/p0-acceptance.sh
```

若已配置 FunASR 且要求每条必须有非空文本：

```bash
export P0_REQUIRE_NONEMPTY_TEXT=1
bash scripts/p0-acceptance.sh
```

详见 [`docs/execution/p0-acceptance.md`](../../docs/execution/p0-acceptance.md)。

# rushi-asr

本地 ASR HTTP 服务：默认只绑定 **127.0.0.1**；与桌面壳通过 **TranscriptionResult v1** 契约对齐（字段与 `apps/desktop/src/contracts/transcription.ts` 一致）。

## 运行

```bash
cd services/asr
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
python -m rushi_asr
```

`pip install -e` 必须带路径：末尾 **`.`** 表示当前目录；写成 `pip install -e` 会报错。开发跑测试：`pip install -e ".[dev]"`。

默认端口 **8741**。环境变量：

- `ASR_HOST`（默认 `127.0.0.1`）
- `ASR_PORT`（默认 `8741`）

## 依赖

- **ffmpeg / ffprobe**：须在 `PATH` 中，用于上传文件的解码与 **16 kHz mono WAV** 规范化。
- **可选 FunASR**：`pip install -e ".[funasr]"` 后设置 `RUSHI_FUNASR_MODEL`（例如 `iic/SenseVoiceSmall` 或 `paraformer-zh`）。未设置或未安装时走 **stub**（单段、空文本、带 `detail` 说明）。

可选调参：

- `RUSHI_FUNASR_DEVICE`（默认 `cpu`）
- `RUSHI_FUNASR_LANGUAGE`（默认 `zh`）
- `RUSHI_FUNASR_VAD_MODEL`（默认 `fsmn-vad`；设为空字符串可关闭 VAD 参数传递）

## 接口

- `GET /health` — `{ "status": "ok", "service": "rushi-asr" }`
- `POST /v1/transcribe` — `multipart/form-data`，字段名 **`file`**；响应为 **TranscriptionResult** JSON（`schema_version: "1"`）。

## 测试

```bash
pytest
```

（含需 **ffmpeg** 的集成用例；CI 已安装 ffmpeg。）

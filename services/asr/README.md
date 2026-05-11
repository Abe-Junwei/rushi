# rushi-asr

本地 ASR HTTP 服务骨架：默认只绑定 **127.0.0.1**，占位接口用于与桌面壳联调。

## 运行

```bash
cd services/asr
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
`pip install -e .`（注意末尾 **`.`** 表示当前目录；写成 `pip install -e` 会报错）。开发跑测试用 `pip install -e ".[dev]"`。
python -m rushi_asr
```

默认端口 **8741**。可用环境变量覆盖：

- `ASR_HOST`（默认 `127.0.0.1`）
- `ASR_PORT`（默认 `8741`）

## 接口

- `GET /health` — JSON：`{ "status": "ok", "service": "rushi-asr" }`
- `POST /v1/transcribe` — 占位转写，返回固定说明（后续接真实流水线）

## 测试

```bash
pytest
```

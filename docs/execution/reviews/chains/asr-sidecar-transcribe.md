# 链路模拟：侧车启动 → 健康检查 → 转写

| Step | 组件 | 动作 | 结论 |
|------|------|------|------|
| 1 | Tauri setup | `try_start_bundled` | OK；Exit 时 `stop_bundled` |
| 2 | 前端 | `refreshAsrHealth` → GET `/health` | OK；capabilities 驱动 UI |
| 3 | 用户 | 「从 ASR 拉取语段」 | `project_run_transcribe` → multipart POST | **参数/file_id 见 R2-001** |
| 4 | 侧车 | `/v1/transcribe` | `run_in_threadpool` + 分块限流 | OK（较旧报告） |
| 5 | Rust 保存失败 | recovery json | OK |
| 6 | 在线 STT | `OnlineTranscribeBridge` | URL 校验 + native 分发 | OK；契约测 15+8 |

## P0 验收

```bash
bash scripts/p0-acceptance.sh
npm run asr:test
```

与桌面转写命令正交；即使 P0 通过，**桌面 file_id 错误仍会导致拉取失败**。

# STT-CANCEL — 手测清单（Q-STT-CANCEL-1）

> **验收真源**：[`online-stt-cancel-v1.1-acceptance.md`](./online-stt-cancel-v1.1-acceptance.md)

## 机器闸门（编码签收前）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cd apps/desktop/src-tauri && cargo test transcribe_cancel poll_wait finish_cancelled record_transcribe_err file_asr_poll
```

---

## H-STT-1 — 在线停止 + 语段恢复

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | 打开含音频项目；语段内保留可辨认的转写前文本 | — | ✅ |
| 2 | **自动转录** → **在线** → 开始 | 进度卡片 + 「停止转写」 | ✅ |
| 3 | 转写进行中点 **停止转写** | Toast「已停止转写，语段已恢复。」 | ✅ |
| 4 | 检查语段列表 | 恢复为转写前内容 | ✅ |
| 5 | 检查 UI | 无红色「转写失败」横幅 | ✅ |

---

## H-STT-2 — TRN-DIAG `cancelled`

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | H-STT-1 完成后读 `transcribe_timeline_last.json` 或导出诊断包 | `outcome=cancelled` | ✅ |
| 2 | 同上 | `errorMessage=转写已取消` | ✅ |
| 3 | 同上 | `failedStage` / `errorCode` 为空 | ✅ |
| 4 | `desktop.log` | 含 `INFO transcribe_cancelled` | ✅ |

---

## H-STT-3 — 本机 async 停止回归

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| 1 | **自动转录** → **本机**；长音频开始转写 | 窗进度出现 | ✅ |
| 2 | **停止转写** | 语段恢复 + toast | ✅ |
| 3 | timeline（可选） | `source=local`；侧车 cancel 后 UI 正常 | ✅ |

> 本机路径不写 `INFO transcribe_cancelled`（仅在线 Rust 取消）；以 UI + 侧车 status 为准。

---

## 签收记录

| 日期 | 平台 | Provider | H-STT-1 | H-STT-2 | H-STT-3 | 操作员 |
|------|------|----------|---------|---------|---------|--------|
| 2026-06-12 | macOS dev | 百炼 file_asr（OSS 上传阶段取消） | ✅ | ✅ | ✅ | junwei |

### 证据摘要（2026-06-12）

- **Timeline**：`~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/transcribe_timeline_last.json`
  - `jobId`: `online-stt-1781263347825`
  - `fileId`: `b642fdc3-fd4b-4069-bad4-cf1f63aad5e8`
  - `outcome`: `cancelled`
- **Log（H-STT-3）**：`…/logs/desktop.log` → `1781263864283 INFO transcribe_async_start` · `job_id=6407010d-88df-4a9d-8882-f0fbaaf4af03` · timeline `windowCount=12`

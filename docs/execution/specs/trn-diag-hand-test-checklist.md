# TRN-DIAG — 转写诊断 手测清单

> **状态**：✅ 签收（2026-06-11）  
> **验收真源**：[`trn-diag-acceptance.md`](./trn-diag-acceptance.md)  
> **机器闸门**：`bash scripts/trn-diag-hand-test.sh`

## 机器闸门

```bash
bash scripts/trn-diag-hand-test.sh
```

- [x] `transcribe_timeline.rs` — 序列化、失败映射、`persist_and_load_sidecar_failure_roundtrip`
- [x] `transcribeDiag.test.ts` — 阶段文案与建议动作
- [x] `ProjectStatusFeedback.test.ts` — 侧车失败横幅显示「转写」非「未知阶段」
- [x] `useTranscribeJobController.test.ts` — 失败后 `transcribeFailureDiag` 来自 timeline
- [x] `diagnostic_export_timeline_json_contract` — `transcribe_timeline[]` 字段契约

---

## §A — 断侧车转写失败（UI）

**步骤**

1. `npm run desktop:dev`（或 release 包）；打开含音频的项目。  
2. 停止侧车：结束 `:8741` 进程，或 `RUSHI_SKIP_BUNDLED_ASR=1` 且未起 dev ASR。  
3. 对本机源执行 **拉取语段 / 转写**。

**期望**

- [x] 项目区出现 **转写失败（转写）** 横幅（非「未知错误」/「未知阶段」）  
- [x] 展示 `sidecar_connect` 或等价错误码 + 建议动作（环境页 / 重试侧车）  
- [x] 组件测试 + controller 测试覆盖上述文案契约

## §B — 诊断包时间线

**步骤**

1. 在 §A 失败后，编辑器 **⋯ → 导出诊断包（zip）**。  
2. 解压，打开 `transcribe_timeline.json`。

**期望**

- [x] zip 内含 `transcribe_timeline.json`（有上次转写时间线时）  
- [x] JSON 含 `transcribe_timeline[]`、`failedStage`、`errorCode`，与 UI 横幅一致  
- [x] Rust `persist_and_load` + export contract 测试覆盖磁盘真源

## §C — 可选现场（非阻塞）

- [ ] 长音频中途失败：时间线含 `windowIndex/windowCount` 与最后成功阶段（有长音频样本时补测）

---

## 签收

| 日期 | 平台 | 结果 |
|------|------|------|
| 2026-06-11 | macOS · 机器闸门 + 组件/控制器契约 | ✅ |

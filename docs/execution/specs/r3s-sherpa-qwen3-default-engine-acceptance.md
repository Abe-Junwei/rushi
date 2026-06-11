# Acceptance: R3s-A — Sherpa Qwen3 默认引擎

> **Research**：[r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md)  
> **Intent** · **Plan**：同目录 `*-intent.md` / `*-plan.md`  
> **ADR**：[ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md)

## 目标

Sherpa-ONNX Qwen3-0.6B + Silero VAD 成为 **本机转写默认引擎**；FunASR Paraformer 降为 **显式回退**；契约与 ACC-EVAL 可回归。

---

## 能力—UI 状态矩阵（编码前必填）

| 能力 | FunASR Paraformer（回退） | Sherpa Qwen VAD（目标默认） |
|------|---------------------------|-----------------------------|
| 引擎真源 | `/health` 8741 | 进程内 ORT，无 8741 |
| 默认 SKU | paraformer-long-vad-punc | qwen3-asr-vad-0.6b |
| 语段 | `sentence_info` | VAD 短语 `segments[]` |
| 标点 | ✅ ct-punc | ❌ → 文案/后续 LLM |
| hotwords | ✅ multipart | ⚠️ Phase 0 验证 |
| prepare | ModelScope PyTorch | LRC ONNX |
| ready 灯 | sidecar + cache | ONNX + vad 文件 |
| 长音频 async | ✅ | Phase 2 最小进度 |

对齐：[desktop-capability-ui-state-alignment.md](../../architecture/desktop-capability-ui-state-alignment.md)

---

## Go 闸门（Phase 3 默认切换前 **全部**）

| ID | 指标 | Paraformer 基线 | Sherpa 要求 |
|----|------|-----------------|-------------|
| **G1** | 金标 CER（D3 堂3-2 制控概讲） | 参照 docx 金标 | **≤ baseline + 5%**（或书面豁免） |
| **G2** | 语段数（同样本） | TBD 首跑 | **≥ 50** 且 median dur **0.5–15s** |
| **G3** | RTFx（制控 CPU） | ~7.4 | **≥ 5.0** |
| **G4** | term_hit（manifest） | 1.0 | **≥ 1.0**（同 expected_terms） |
| **G5** | `project_run_transcribe` E2E | ✅ | ✅ SQLite 段写入 |
| **G6** | LRC 零终端安装 ONNX | — | ✅ |
| **G7** | 无 8741 时本机转写 | — | ✅（默认路径） |
| **G8** | FunASR 回退 | — | pref 切回后 Paraformer 仍可用 |

**Defer**（不挡 Phase 1–2，挡 Phase 3）：标点、CoreML EP、Windows 默认。

---

## 阶段验收

### Phase 1（内嵌，非默认）

- [ ] `cargo test -p asr_sherpa`（或 module 等价）
- [ ] Feature flag 下制控转写 → 编辑器可见段
- [ ] 架构守卫：禁止页面层直连 spike bin

### Phase 2（双轨）

- [ ] catalog 含 `qwen3-asr-vad-0.6b`
- [ ] 环境页下载 ONNX 后 `ready_for_transcribe`
- [ ] ACC-EVAL-2 报告含 sherpa 列

### Phase 3（默认）

- [ ] 新装默认 SKU = Qwen ONNX
- [ ] bundled 不强制起 8741
- [ ] ADR-0007 accepted
- [ ] 手测清单 10 条全绿

---

## 手测清单（Phase 3 前可预跑）

1. 下载 ONNX + VAD → 环境页绿灯  
2. 导入 D3 堂3-2 制控概讲 → 转写 → ≥50 段  
3. 搜索「质控/制控」命中  
4. 切回 FunASR Paraformer → 8741 转写仍正常  
5. 离线（断网）转写成功  

---

## 引用 spike 产物

- `docs/execution/spike-output/qwen3-sherpa-retest-2026-06-11/quant-compare-qwen3-0.6b-vad-1250s.json`
- `docs/execution/spike-output/qwen3-sherpa-retest-2026-06-11/sherpa-vad-1250s-segments.md`

---

## 结论分支

| 结果 | 动作 |
|------|------|
| **Go** | Phase 3 切换默认；更新 roadmap R3s-A ✅ |
| **Defer** | 保留双轨；默认仍 Paraformer；文档化 blocker |
| **No-go** | 放弃 Sherpa 默认；仅保留 spike harness |

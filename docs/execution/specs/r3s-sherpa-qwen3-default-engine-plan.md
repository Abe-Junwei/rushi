# Plan: R3s-A — Sherpa Qwen3 默认引擎迁移

> **Research**：[r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md)  
> **Intent**：[r3s-sherpa-qwen3-default-engine-intent.md](./r3s-sherpa-qwen3-default-engine-intent.md)

## 阶段总览

```text
Phase 0  金标 + eval 闸门（与 Phase 1 并行）
Phase 1  Rust 同步转写 + feature flag（非默认）
Phase 2  LRC ONNX + 环境页 SKU + 双轨 A/B
Phase 3  默认切换 + 侧车降级 optional
Phase 4  FunASR EOL 评估（out of scope 直至 Phase 3 Go 6mo）
```

---

## Phase 0 — 质量闸门（~1w，可与 P1 重叠）

| 任务 | 落位 | 验证 |
|------|------|------|
| 金标 transcript（D3 堂3-2 制控概讲 docx + clear 等） | `fixtures/eval/gold/` | 人工签收 |
| `eval-run.py` / 脚本支持 Sherpa JSON | `scripts/eval-sherpa-run.py` | CER/WER vs gold |
| 复跑 Sherpa retest vs gold | spike-output | 报告入 acceptance |
| hotwords「制控」Sherpa 实测 | spike CLI `--hotwords` | term_hit vs gold |

**出口**：acceptance §Go 表格 **G1–G3** 有数据（见 acceptance 文档）。

---

## Phase 1 — 产品内嵌同步转写（~2w）

| 任务 | 落位 |
|------|------|
| 从 `spike/sherpa_qwen3` 提取 `asr_sherpa` 模块 | `apps/desktop/src-tauri/src/asr_sherpa/` |
| `SherpaTranscribeResult` → 侧车同形 JSON | 对齐 `segments[].start_sec/end_sec/text` |
| `local_asr_engine` 配置：`funasr-sidecar` \| `sherpa-onnx` | prefs + env override |
| `run_transcribe_cmd` 分支：sherpa 时 **不** curl 8741 | `run_transcribe_cmd.rs` |
| Feature flag：`RUSHI_DEFAULT_ASR_ENGINE=sherpa`（dev only） | 文档 |

**验证**：`cargo test` asr_sherpa；手测单文件转写写 SQLite；typecheck + architecture guard。

**不做**：async job、长音频窗、LRC 正式 manifest。

---

## Phase 2 — LRC + catalog + 双轨（~2–3w）

| 任务 | 落位 |
|------|------|
| LRC artifact：`sherpa-qwen3-asr-0.6B-int8` + `silero_vad` | `local_runtime/catalog` |
| 下载脚本入库（ModelScope 优先） | `scripts/r3g-b-download-sherpa-qwen3-onnx.sh` 产品化 |
| catalog 新条目 `qwen3-asr-vad-0.6b` | `localAsrModelCatalog.ts` + `model_catalog.py` |
| 环境页：默认推荐文案指向 Qwen ONNX | `EnvLocalAsrPanel` |
| 能力矩阵 D2/D3：`asr_engine` + active SKU | alignment doc 更新 |
| 长音频：VAD 分段 + 进度（最小 async） | 可复用 R3e-C 进度 UX，逻辑在 Rust |

**验证**：零终端安装 ONNX；制控全轨；ACC-EVAL-2 双列。

---

## Phase 3 — 默认切换（~1w，仅 Phase 2 Go 后）

| 任务 | 说明 |
|------|------|
| 默认 `local_asr_engine=sherpa-onnx` | 新安装 + 迁移 pref |
| bundled 不再强启 FunASR 侧车 | `try_start_bundled` 条件化 |
| Paraformer 标记「兼容 / 高精度标点」 | catalog copy |
| ADR-0007 status → accepted | 路线图 §R3s-A ✅ |

**回滚**：pref 切 `funasr-sidecar` + 重启侧车。

---

## Phase 4 — FunASR 退役（待定）

- 侧车 PyInstaller 改为 optional download
- 删除条件：Sherpa 默认 6mo 无 P0 回归 + 用户 opt-in 侧车 <5%
- **本 plan 不实施**，仅登记

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 无标点 | Phase 2 文案 + Phase 3 前 LLM 标点薄片 |
| ONNX 4.4GB | LRC 增量；与 PyTorch 权重互斥选项 |
| Windows ORT | Phase 2 末 Win smoke |
| 分段数 > Paraformer | 编辑器合并策略或 VAD 参数调优 |
| 金标未过 | **不进入 Phase 3** |

---

## 本轮（建议立即开始）

1. Phase 0：你提交金标 → 跑 Sherpa vs gold  
2. Phase 1 P0：`asr_sherpa` + `run_transcribe_cmd` flag（**不**改默认）

验证命令（现有）：

```bash
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 1250 --pipeline vad --skip-funasr
```

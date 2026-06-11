# Plan: R3s-A — Sherpa Qwen3 默认引擎迁移

> **Research**：[r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md)  
> **Intent**：[r3s-sherpa-qwen3-default-engine-intent.md](./r3s-sherpa-qwen3-default-engine-intent.md)  
> **Implementation（代码对照 + 审查修订）**：[r3s-sherpa-qwen3-default-engine-implementation-plan.md](./r3s-sherpa-qwen3-default-engine-implementation-plan.md)  
> **R3g-B 对照报告**：[r3g-b-qwen3-sherpa-funasr-compare-report.md](./r3g-b-qwen3-sherpa-funasr-compare-report.md)（ForcedAligner + VAD，2026-06-11）  
> **执行模式（2026-06-11 产品确认）**：**Defer** — 见下 §Defer 模式（**G1 前默认推荐**）

## Defer 模式（G1 前默认推荐）

**结论**：**暂不**将 Sherpa Qwen3 接入产品转写路径（Phase 1–3 编码冻结）；**保留** spike + 文档 + LRC 抽象作为远期切换投资。产品默认继续 **FunASR Paraformer**（ADR-0003），与路线图主序（R3f 发行、R3t-F 改稿）不抢墙钟。

### 为何 Defer

| 因素 | 说明 |
|------|------|
| 发行与主路径 | Paraformer 已具备标点、热词、async；R3f mac 已签收 |
| 证据缺口 | R3g-B 语段/速度 ✅；**G1 金标 CER 未过**；标点/热词未产品验收 |
| 双栈成本 | Phase 1–2 即引入 router、E1–E3 UI、ONNX 磁盘，收益在 gold 前不确定 |
| 战略仍有效 | ADR-0007 **proposed** = 方向已录，非「立即开工」 |

### Defer 期间：做 / 不做

| ✅ 做（薄预留） | ❌ 不做（直至升级条件满足） |
|----------------|---------------------------|
| `spike/sherpa_qwen3/` + `scripts/r3g-b-*` 维护与回归 | `asr_sherpa/` 进主 crate |
| research / plan / acceptance / ADR-0007 保持同步 | `run_transcribe_cmd` 引擎分支 |
| `fixtures/eval/` 金标 + `eval-sherpa-run.py`（Phase 0 仅 spike/eval） | catalog 公开 `qwen3-asr-vad-0.6b` |
| alignment doc **E1–E3 文档预留**（不实现 UI） | 环境页双轨、默认 pref 迁移 |
| LRC **`RuntimeModelArtifact` schema 设计**（P2a 可先写 types，不装 Qwen 包） | Phase 3 默认切换、ADR-0007 → accepted |

### 从 Defer 升级为 Active 的条件（须同时满足）

1. **G1**：Sherpa Qwen vs 金标 CER ≤ Paraformer 基线 + ε（acceptance 表）  
2. **标点策略**：书面接受「无 ASR 标点 + R3t-C/F0」**或** 回退/Sherpa 第二 SKU 方案就绪  
3. **G4**：热词（`expected_terms`）Sherpa 实测 ≥ 基线  

满足后：路线图 R3s-A 标 **编码中** → 按 §阶段总览 从 **Phase 1** 起（Phase 0 数据可并行已完成部分）。

### Defer 期间本轮建议

1. **Phase 0a–0c only**：金标、Sherpa vs gold eval、R3g-B 报告签收（**不**开 Phase 1）  
2. 主序继续：R3f / R3t-F / 发行闭环  
3. spike 回归按需：`r3g-b-qwen3-06b-funasr-sherpa-compare.sh`（见 §验证命令）

```text
现在（产品）          Defer 预留              Active 后（门控通过）
FunASR Paraformer  →  spike + eval + docs  →  Phase 1–3 本 plan
唯一默认 SKU          ADR-0007 proposed        ADR-0007 accepted @ Phase 3
```

## 证据更新（R3g-B，2026-06-11）

| 维度 | Sherpa Qwen3 VAD | FunASR Qwen3 + ForcedAligner |
|------|------------------|------------------------------|
| 语段（780s） | **172** 短语段，dur 可抽检 | **103** 段，大量 1 字 / dur≈0 |
| 速度 RTF | **~0.12**（~8× 实时） | ~0.95 |
| 交叉 CER（无金标） | ~0.22（与 FunASR 同档） | ~0.23 |
| Rushi `segments[]` | ✅ 可直接映射 | ❌ 不合格 |

**产品含义**（详见对照报告 §4）：

1. **迁移默认 SKU = Sherpa Qwen3**；FunASR Qwen+Aligner **闭卷**（不作 Phase 0 基线、不进 catalog）。
2. **文本精度**须等金标 **G1** 裁定；交叉 CER 仅说明「非碾压」，不能替代 gold。
3. **语段抽检主文件**：`docs/execution/spike-output/qwen3-0.6b-2026-06-11/segment-compare-vad-forced-aligner.md`（`compare.sh` + `r3g-b-qwen3-segment-compare-md.py` 自动生成）。
4. **远期双 SKU**（同一 Sherpa runtime）：**Phase 1–3** 只做 **Qwen3**；**Paraformer ONNX**（标点/热词）为 **Phase 2 后并行薄片**（R3h-3.5 P2），不挡 Qwen 默认切换。

```text
Sherpa runtime（目标态）
├── SKU: qwen3-asr-vad-0.6b     ← R3s-A Phase 1–3（本 plan）
└── SKU: paraformer-long-vad    ← R3h-3.5 P2（Sherpa 双轨第二期；FunASR 仍为过渡期回退）
```

## 阶段总览

```text
Phase 0  金标 + eval 闸门（与 Phase 1 并行）
Phase 1  Rust 同步转写 + feature flag（非默认）
Phase 2  3–4w  P2a model manifest → P2b catalog/UI → P2c async（design 先行）
Phase 3  默认切换 + 侧车降级 optional
Phase 4  FunASR EOL 评估（out of scope 直至 Phase 3 Go 6mo）
```

---

## Phase 0 — 质量闸门（~1w，可与 P1 重叠）

| 任务 | 落位 | 验证 |
|------|------|------|
| 金标 transcript（**Rushi 人工审定** → 导出 reference） | `fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt`；manifest `d3-tang32-zhikong-gaijiang` | 人工签收 |
| R3g-B 语段对照（Sherpa vs FunASR+Aligner） | `segment-compare-vad-forced-aligner.md` | 抽检清单 §5 通过 |
| `eval-run.py` / Sherpa JSON → gold CER | `scripts/eval-sherpa-run.py` | **G1** CER vs gold；**G3** RTFx |
| Sherpa retest 全轨（~1195s）vs gold | `fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3` | **G2** 语段数 + median dur |
| hotwords「制控」Sherpa 实测 | spike CLI `--hotwords` | **G4** term_hit |
| FunASR Qwen+ForcedAligner | R3g-B 报告 **仅存档** | **不**参与 G1–G4 基线 |

**出口**：acceptance §Go 表格 **G1–G4** 有 gold 数据；R3g-B 报告 §5 产品签收完成。

**金标工作流**（不另建 infra）：在 Rushi 编辑器对 D3 样本转写 → 人工改稿 → 导出 `reference.txt` 入 `fixtures/eval/gold/` → 跑 `eval-sherpa-run.py` 补 **绝对 CER**（替代交叉 CER）。

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
| **（登记，非本 phase 编码）** Sherpa Paraformer 第二 SKU | R3h-3.5 P2；标点/热词；见 ADR-0006 |

**验证**：零终端安装 ONNX；`d3-tang32` 全轨；ACC-EVAL-2 含 **sherpa-qwen** 列；语段对照可回归生成。

---

## Phase 3 — 默认切换（~1w，仅 Phase 2 Go 后）

| 任务 | 说明 |
|------|------|
| 默认 `local_asr_engine=sherpa-onnx` | 新安装 + 迁移 pref |
| bundled 不再强启 FunASR 侧车 | `try_start_bundled` 条件化 |
| FunASR Paraformer 标记「兼容 / 高精度标点」 | catalog copy（过渡期回退） |
| 登记 Sherpa Paraformer 为 **第二 SKU**（非默认） | 路线图 R3h-3.5 P2，不挡 Phase 3 |
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
| 分段数 > Paraformer | 编辑器合并策略或 VAD 参数调优（spike 172@780s 已预过 G2 形态） |
| FunASR Aligner 语段塌缩 | **不采用**；Sherpa Silero VAD 为唯一 Qwen 分段路径 |
| 金标未过 | **不进入 Phase 3** |
| 交叉 CER 误判为「Sherpa 更准」 | Phase 0 必须以 **gold CER** 裁定 G1 |

---

## 验证命令（spike / Phase 0）

验证命令：

```bash
# ONNX（一次性）
bash scripts/r3g-b-download-sherpa-qwen3-onnx.sh

# 语段对照 + quant（含 segment-compare MD）
export RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B
export SHERPA_QWEN3_MODEL_DIR=fixtures/sherpa-qwen3-asr-0.6B
export SHERPA_SILERO_VAD_MODEL=fixtures/sherpa-vad/silero_vad.onnx
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --pipeline vad --duration 30
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --pipeline vad --duration 780

# gold 就绪后：Sherpa vs 金标（Phase 0 出口）
# python3 scripts/eval-sherpa-run.py --manifest fixtures/eval/eval_manifest.v1.json --item d3-tang32-zhikong-gaijiang
```

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版 phased 迁移 |
| 2026-06-11 | 并入 R3g-B ForcedAligner 语段对照、金标 Rushi 工作流、Sherpa 双 SKU 远期登记 |
| 2026-06-11 | **Defer 模式**：G1 前冻结 Phase 1–3 产品编码；薄预留清单 + 升级条件 |

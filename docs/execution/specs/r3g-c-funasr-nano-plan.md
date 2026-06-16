# Spec(plan): R3g-C — Fun-ASR-Nano-2512 SKU Spike

> **状态**：🟡 立项 / spike 待执行  
> **调研**：[`r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md`](./r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md)  
> **Intent**：[`r3g-c-funasr-nano-intent.md`](./r3g-c-funasr-nano-intent.md)  
> **验收**：[`r3g-c-funasr-nano-acceptance.md`](./r3g-c-funasr-nano-acceptance.md)

---

## 范围锁定

本 spike 仅验证并接入 **FunAudioLLM/Fun-ASR-Nano-2512**；**MiMo-V2.5-ASR 不进入本计划**。

## Phase 0 — 源码侧车冒烟（0.5d）

目标：确认 Nano 能在现有侧车中加载，不依赖改 catalog。

1. 在当前 venv 中确认 funasr 版本；若 `< 1.4.0`（Nano 文档要求），升级并记录。
   ```bash
   cd services/asr
   python3 -c "import funasr; print(funasr.__version__)"
   # 若需升级：pip install --upgrade "funasr>=1.4.0"
   ```
2. 启动源码侧车并指定 Nano：
   ```bash
   RUSHI_FUNASR_MODEL=FunAudioLLM/Fun-ASR-Nano-2512 \
   RUSHI_FUNASR_LANGUAGE=zh \
   python3 -m rushi_asr
   ```
3. 调用 `GET /health`，确认：
   - `funasr_model_id` 正确显示 Nano hub id
   - `ready_for_transcribe` 为 true（或按现有逻辑在 prepare 后变为 true）
   - 无 500 / import error
4. 检查是否需要 `remote_code` 参数：
   - 若 `AutoModel(..., trust_remote_code=True)` 失败且文档要求 `remote_code="./model.py"`，记录复现日志。

**落位文件（本阶段只读/临时改 env）**

- `services/asr/rushi_asr/funasr_engine.py` — `_get_model()` 加载逻辑

## Phase 1 — Generate 与分段验证（1d）

目标：对照 Paraformer，验证 Nano 的转写质量与速度。

### 样本

| ID | 样本 | 用途 | 期望 |
|----|------|------|------|
| S1 | `fixtures/eval/samples/制控.mp3` 或等价 ~21min 中文音频 | 长音频多语段 | 语段数 ≥ 10，无 whole_track_fallback |
| S2 | ≤ 3min 短音频 | 无窗路径回归 | 单段或多段，结构正常 |
| S3 | 含热词「制控」的同样本 | 热词命中 | term_hit_rate ≥ Paraformer baseline |

### 记录项

- 语段数、首/末段 `start_sec` / `end_sec`
- `segmentation_mode`（`sentence_info` / `timestamp`）
- warnings 列表
- wall clock（秒）
- 峰值 RSS（MB）
- 是否含标点

### 临时参数探索

在源码侧车中，通过环境变量或本地脚本尝试：

```python
# 参考 Nano 示例
model.generate(
    input=wav_path,
    language="中文",
    sentence_timestamp=True,
    hotword="制控",
)
```

若 `language="中文"` 为 Nano 所需，将其固化到 `asr_model_profile.py` 的 `funasr_language_for_model()`。

## Phase 2 — Prepare / 打包 / PyInstaller `remote_code`（0.5–1d）

目标：确认 bundled 侧车可成功加载 Nano。

1. **缓存规则**：确认 `model_prepare_cache.py` 能识别 Nano 权重目录，且 `required_models_cached_guess()` 为 true 时侧车可启动。
2. **`remote_code` 打包**：
   - 若 Phase 0 需要 `remote_code="./model.py"`，则需在 PyInstaller 收集阶段把 `model.py` 打入 onedir。
   - 参考 funasr 社区做法，记录 `collect_data_files` 或 `hiddenimports` 改动。
3. **构建并验证**：
   ```bash
   npm run asr:build-sidecar-unix
   # 启动 bundled 侧车
   ./dist/rushi-asr-sidecar-.../rushi-asr-sidecar
   curl http://127.0.0.1:8741/health
   ```
4. 记录 onedir 体积增量，确认 ≤ 2GB。

**落位文件**

- `services/asr/rushi_asr/funasr_engine.py` — `_get_model()` 增加 Nano 路径
- `services/asr/pyinstaller/*.spec` 或等价打包脚本 — 收集 `remote_code`
- `services/asr/requirements-sidecar-*.lock` — funasr 版本升级

## Phase 3 — Catalog / UI 接入（0.5d，仅 Phase 1–2 通过后）

目标：将 Nano 作为可选 SKU 上架到用户模型面板。

1. **Python catalog**：
   - `services/asr/rushi_asr/model_catalog.py` 新增条目：
     - `catalog_id="funasr-nano-2512"`
     - `hub_model_id="FunAudioLLM/Fun-ASR-Nano-2512"`
     - `label="Fun-ASR-Nano（端到端）"`（文案以 acceptance 拍板为准）
     - `disk_hint="约 1.5–2 GB"`
     - `recommend_long_audio=True`
2. **Profile**：
   - `services/asr/rushi_asr/asr_model_profile.py` 新增 `sku_family="funasr_nano"`。
   - `funasr_language_for_model()` 对 Nano 映射 `zh → 中文`。
   - `build_generate_kwargs()` 中 Nano 分支设置 `sentence_timestamp=True`、长音频 `batch_size_s=60`。
3. **前端 catalog**：
   - `apps/desktop/src/services/asr/localAsrModelCatalog.ts` 同步新增条目。
   - `hubModelNeedsPuncPrepare()` 已包含 `fun-asr-nano`，确认保持 false。
4. **能力—UI 状态对齐**：
   - 确认「应用并重启侧车」后 `selectedModelMatchesSidecar` / `readyForTranscribe` 正确。

**落位文件**

- `services/asr/rushi_asr/model_catalog.py`
- `services/asr/rushi_asr/asr_model_profile.py`
- `services/asr/rushi_asr/funasr_pipeline.py` — 确认 `fun-asr-nano` 无需 punc 管道
- `apps/desktop/src/services/asr/localAsrModelCatalog.ts`

## Phase 4 — 回归与结论（0.5d）

1. 执行机器守卫：
   ```bash
   npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
   ```
2. Python 侧车回归：
   ```bash
   cd services/asr && python3 -m pytest tests/test_asr_model_profile.py tests/test_funasr_engine.py -q
   ```
3. 重新跑 S1/S2/S3 在 catalog 接入后的完整链路。
4. 填写 [`r3g-c-funasr-nano-acceptance.md`](./r3g-c-funasr-nano-acceptance.md) 硬闸门实测值，给出结论：
   - **Go**：上架 catalog，作为新增 SKU。
   - **Defer**：记录 blocker，不进 catalog，保留分支。
   - **No-go**：关闭 Nano 线，删除 catalog 接入代码。

## 回滚计划

| 场景 | 动作 |
|------|------|
| Phase 0–1 失败 | 不改 catalog；仅保留调研与 intent/plan/acceptance 文档 |
| Phase 2 打包失败 | 不上架 UI；文档记录为 Defer；回滚 `funasr_engine.py` 中打包相关改动 |
| Phase 4 回归失败 | `git revert` catalog 与 profile 接入提交；保留 spike 结果报告 |

## 开放问题

1. Nano 官方要求的最低 funasr 版本？是否影响现有 Paraformer 路径？
2. `remote_code` 在 ModelScope 缓存路径下的实际值是否需要动态计算？
3. Nano 对 `language` 参数的确切取值是 `"中文"` 还是 `"zh"` 或 `"Chinese"`？
4. 长音频是否需要显式 `vad_model`？还是 Nano 内部已含 VAD？

## 里程碑

| 日期 | 里程碑 | 产出 |
|------|--------|------|
| D+0.5 | Phase 0 完成 | 源码侧车 `/health` 通过 Nano |
| D+1.5 | Phase 1 完成 | 长/短音频对照表、速度/RSS |
| D+2.5 | Phase 2 完成 | bundled 侧车 `/health` 通过或明确 blocker |
| D+3 | Phase 3 完成 | catalog + profile + TS 接入 |
| D+3.5 | Phase 4 完成 | 机器守卫通过 + acceptance 签收 |

## 验证命令（贯穿全阶段）

```bash
# 机器守卫
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs

# Python 侧车核心回归
cd services/asr && python3 -m pytest tests/test_asr_model_profile.py tests/test_funasr_engine.py -q

# 打包
cd /Users/junwei/开发/Rushi && npm run asr:build-sidecar-unix
```

# Acceptance：FunASR 侧车依赖升级

> **状态**：执行完成；指标定性已校正（2026-08-11）
> **Research**：[`funasr-sidecar-dependency-upgrade-research-2026-08.md`](./funasr-sidecar-dependency-upgrade-research-2026-08.md)
> **Intent**：[`funasr-sidecar-dependency-upgrade-intent.md`](./funasr-sidecar-dependency-upgrade-intent.md)
> **Plan**：[`funasr-sidecar-dependency-upgrade-plan.md`](./funasr-sidecar-dependency-upgrade-plan.md)
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3h-ASR-VER**

## 1. 最终判定

| 对象 | 判定 | 结论 |
|------|------|------|
| FunASR `1.3.30` | **No-go** | D3 内容 CER 与基线同为 `0.1433`，但含标点 CER 从 `0.2115` 回归到 `0.3207`；消融确认为上游 VAD 文本拼接导致的标点/断句对齐回归 |
| FunASR `1.4.1` | **No-go** | 内容 CER 仍为 `0.1433`，但继承 `1.3.30` 的标点回归，对中文 Paraformer 无额外可测收益 |
| FunASR 正式 pin | **保持 `1.3.16`** | 两个候选均不写入正式锁 |
| `rushi-asr 0.1.1` 加固 | **Defer release** | 精确 pin、诊断、安全锁、macOS arm64 构建和质量回归完成；冻结包首次 warmup `205.5s` 不满足门禁，且无 Intel macOS / Windows 产物证据 |

本轮不发布新 FunASR，不发布新 Windows CPU/CUDA 侧车，不变更默认 Paraformer SKU。

## 2. 环境与版本证据

| 项 | Baseline | Candidate A | Candidate B | Final hardening lock |
|----|----------|-------------|-------------|----------------------|
| rushi-asr sidecar | 0.1.0 | 0.1.0 source | 0.1.0 source | 0.1.1 |
| FunASR | 1.3.16 | 1.3.30 | 1.4.1 | 1.3.16 |
| ModelScope | 1.38.1 | 1.38.1 | 1.38.1 | 1.38.1 |
| torch / vision / audio | 2.13.0 / 0.28.0 / 2.11.0 | 同基线 | 同基线 | 同基线 |
| cryptography | 49.0.0 | 49.0.0 | 49.0.0 | 50.0.0（修复 `PYSEC-2026-3552`） |
| Python | 3.12.4 | 3.12.4 | 3.12.4 | 3.12.4 |
| 平台 / device | macOS 26.5.2 arm64 / MPS | 同基线 | 同基线 | 同基线 |
| CPU lock SHA256 | `9509cffd...` | N/A | N/A | `c5604817...` |
| CUDA lock SHA256 | `02cdbdf5...` | N/A | N/A | `045073b2...` |

ModelScope 未随手升级；只对安全审计明确报错的 `cryptography` 做单 pin 修复。

## 3. A：依赖与契约

- [x] `pyproject.toml` 精确锁定 `funasr==1.3.16` / `modelscope==1.38.1`。
- [x] CPU/CUDA locks 的 FunASR、ModelScope 与安全 floor 由 policy test 对齐；CUDA torch family 保持 `cu126`。
- [x] `pip check` 通过；CPU lock `pip-audit` 结果为 `No known vulnerabilities found`。
- [x] `/health.version` 与 FastAPI/OpenAPI 共用 `sidecar_version()`。
- [x] 冻结包实测 `/health` 报告 `0.1.1 / 1.3.16 / 1.38.1 / 2.13.0`。
- [x] 新依赖版本字段只诊断，未进入 D4/D5/D8/ready 派生。
- [x] 根路由、prepare/warmup/transcribe/async/status/cancel/unload 契约与 local token 回归通过。
- [ ] Windows resolver/audit 未执行；因本轮不发布 Windows 产物，不用 macOS 证据代签。

## 4. B：Paraformer 质量

| 指标 | `1.3.16` 基线 | `1.3.30` | `1.4.1` | Final `1.3.16` | 结论 |
|------|---------------|----------|---------|----------------|------|
| 30s 结果 | 1 段，“哦，” | 1 段，“哦。” | 1 段，“哦。” | 1 段，“哦，” | 均非 stub |
| D3 CER（含标点） | `0.2095–0.2130` | `0.3207–0.3217` | `0.3207–0.3217` | `0.2110–0.2125` | 候选标点/断句回归 |
| D3 content CER（忽略标点） | `0.1433` | `0.1433` | `0.1433` | `0.1433` | 识别内容无回归 |
| D3 segment count | `184–186` | `184–185` | `184–185` | `184–185` | 通过 |
| segmentation mode | `sentence_info` | `sentence_info` | `sentence_info` | `sentence_info` | 通过 |
| term hit（hotwords on） | `0.75` | `0.75` | `0.75` | `0.75` | 通过 |
| hotwords warnings | `[]` | `[]` | `[]` | `[]` | 通过 |
| D3 wall median | `26.789s` | `25.322s` | `25.445s` | `25.468s` | 通过 |
| D3 RTFx median | `44.617` | `47.200` | `46.972` | `46.928` | 通过 |

时间轴在 30s、130s 与 D3 样本上均满足单调、duration bound 与 `sentence_info`。候选的 ASR 内容字符与基线完全一致；No-go 来自用户可见的标点/断句回归，详见 [`funasr-1.3.30-vad-punctuation-regression-repro.md`](./funasr-1.3.30-vad-punctuation-regression-repro.md)。

> 后续粒度改善不依赖候选版本：[`asr-sentence-segment-coalescing-acceptance.md`](./asr-sentence-segment-coalescing-acceptance.md) 在 `1.3.16` 上将 D3 从 186 段保守合并为 139 段，全文与 CER 不变。

## 5. C：生命周期与长音频

- [x] 使用既有 models root 与 bundled Paraformer/VAD/PUNC，未下载新权重。
- [x] 130s async 在所有版本均为 `window_count=2`，最终累计 7 段，首段 `17.86s`，末段 `128.885s`。
- [x] 基线 cancel 进入 `cancelled`；候选未改 async/cancel 代码。
- [x] final warmup 后 D8=true；unload 后 D8=false、D4/ready 保持，无需重启。
- [x] `freeze_support()` 修复 PyInstaller resource tracker 退出后重启入口；smoke 新增端口释放硬门禁。
- [x] 120s async 与 300s/1800s blocking 常量未改。
- [x] 冻结产物的 health 按已知变体轻量报告预期 device；真正 warmup 仍由 torch 实测 CUDA/MPS 并保留 CPU fallback，显式 env 仍最高优先级。

## 6. D：包体与运行资源

| 指标 | Baseline | Final | 阈值 | 结果 |
|------|----------|-------|------|------|
| macOS onedir | 968,316 KB | 969,404 KB（约 946.7 MiB） | 增量 `<= max(10%, 200MB)` 且 `<=2.5GB` | 通过；+1,088 KB（约 0.11%） |
| 启动到 `/health` | 旧产物未保留可重复冷基线 | final smoke 在 45s 桌面窗口内通过；监听后 health 约 0.05s | `<= baseline*1.20+2s` | 绝对发行窗口通过；相对阈值无可比基线 |
| 首次 warmup | 源码侧车重载 `6.918s` | 全新冻结包 `205.526s` | `<= baseline*1.20` | **失败，Defer release** |
| D3 峰值 RSS | 3,244,960 KB | 3,355,760 KB | `<= baseline*1.15` | 通过；+3.4%，无 OOM |

- [x] bundled ffmpeg/ffprobe、FunASR registry/data、分发元数据可用。
- [x] macOS arm64 clean PyInstaller build + post-build smoke 通过。
- [x] smoke 对 health 设 45s 上限，不再因无 curl timeout 无限等待。
- [x] 5GB 仅作磁盘总预算，未用于 RSS 豁免。
- [ ] 冻结包首次 torch/FunASR import 仍需专项优化；未通过前不发布 `0.1.1`。

## 7. E：平台矩阵

| 平台 | resolve/build/smoke | 30s/D3 | device/fallback | 状态 |
|------|---------------------|--------|-----------------|------|
| macOS arm64 | 通过 | 通过 | MPS 通过；显式 CPU 解析通过 | 代码可合并，发行 Defer（warmup） |
| macOS x86_64 | 未执行 | 未执行 | 单测覆盖冻结 CPU 变体 | 不发布 |
| Windows x64 CPU | 未执行 | 未执行 | 单测覆盖 CPU exe 变体 | 不发布 |
| Windows x64 CUDA cu126 | 未执行 | 未执行 | 单测覆盖 CUDA exe 变体 | 不发布 CUDA 组件 |
| Linux x64 engineering | 未执行 | N/A | 非产品门禁 | 无发行承诺 |

平台证据不互代；因此本轮不产生 Partial Go 安装包，也不更新 CUDA CDN/manifest。

## 8. F：能力—UI 状态

| 场景 | 结果 |
|------|------|
| D1≠D2 | 未改既有 SKU 字段与派生；依赖版本不参与 |
| D4=true、D8=false | final unload 实测 `ready_for_transcribe=true`、`selected_model_ready=false`、`model_loaded_in_memory=false` |
| warmup 完成 | `selected_model_ready=true`、`model_loaded_in_memory=true` |
| 新依赖字段缺失 | 桌面未新增消费代码；JSON additive 契约不改旧 parser |
| ready/chip/button | 无 UI 修改，不读 `funasr_version` / `modelscope_version` / `torch_version` |

## 9. 自动化证据

- [x] 最终 `npm run asr:test`：`158 passed, 2 skipped`。
- [x] dependency policy test + `pip check` + CPU lock `pip-audit`。
- [x] baseline / candidate `1.3.30` / candidate `1.4.1` / final-lock D3 CSV。
- [x] `1.3.16` / `1.3.30` / `1.4.1` 及两组 `1.3.30` 后处理消融 JSON；评测真源新增 `content_cer_chars`，避免把标点差异误报为识别内容回归。
- [x] baseline / candidates / final-lock 30s 与 130s async JSON/NDJSON。
- [x] macOS sidecar clean build + 版本诊断 + warmup/unload + exit-port smoke。
- [ ] Windows CPU/CUDA build/smoke；本轮不发布对应产物。
- [x] 全仓 typecheck 通过；Vitest `2633 passed`；lint `0 errors / 36` 条既有 warnings；architecture guard `0 errors / 58` 条既有 warnings。

证据目录：`docs/execution/spike-output/funasr-sidecar-upgrade-2026-08/`（gitignored）。

## 10. 回滚与发布边界

- [x] 引擎回滚已实施：正式 pin 保持 `funasr==1.3.16` / `modelscope==1.38.1`，候选从未进入 canonical lock。
- [x] 模型权重、模型缓存和 SQLite 未改动。
- [x] 若撤回加固，只需恢复 sidecar `0.1.0`代码/产物；FunASR/ModelScope 仍是同版。
- [x] 未产生混用新旧 FunASR 的 Windows CPU/CUDA 物料。
- [x] `0.1.1` 在 warmup 和对应平台门禁闭合前不进入安装包或 CUDA manifest。

## 11. 结果摘要

| 项 | 结论 |
|----|------|
| 最终引擎版本 | `funasr 1.3.16 + modelscope 1.38.1` |
| 引擎升级 | **No-go** |
| 加固版本 | `rushi-asr 0.1.1 + cryptography 50.0.0` |
| 加固发行 | **Defer** |
| 关键收益 | 防 regen 漂移、产物版本可诊断、安全审计清零、退出不留孤儿进程、health 在桌面启动窗口内可用 |
| 残余风险 | 首次 frozen warmup `205.5s`；Intel macOS / Windows CPU/CUDA 未验证 |
| 发布平台 | 无（代码可合并，产物不发布） |
| 回滚版本 | `rushi-asr 0.1.0 + funasr 1.3.16 + modelscope 1.38.1` |

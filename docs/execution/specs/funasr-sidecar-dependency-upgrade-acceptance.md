# Acceptance：FunASR 侧车依赖升级

> **状态**：待执行
> **Research**：[`funasr-sidecar-dependency-upgrade-research-2026-08.md`](./funasr-sidecar-dependency-upgrade-research-2026-08.md)
> **Intent**：[`funasr-sidecar-dependency-upgrade-intent.md`](./funasr-sidecar-dependency-upgrade-intent.md)
> **Plan**：[`funasr-sidecar-dependency-upgrade-plan.md`](./funasr-sidecar-dependency-upgrade-plan.md)
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 **R3h-ASR-VER**

## 1. 最终判定

| 判定 | 条件 |
|------|------|
| **Go** | 选定版本在完整 regenerated lock 下通过 A-F 全部硬门禁，并有目标发布平台的 PyInstaller 证据 |
| **Partial Go** | macOS 全绿但 Windows 证据未完成：只允许 macOS 平台安装包发布新侧车；Windows CPU/CUDA 整体保持同一旧版本，同一 Windows 物料禁止混用新旧 FunASR；CUDA CDN/manifest 必须与 Windows CPU 版本对齐；发布说明与诊断列明各平台实际版本 |
| **Defer** | 质量主路径通过，但包体、平台 wheel、构建机或审计证据未闭合；不得更新正式发布锁 |
| **No-go** | CER、语段、时间轴、热词、async、CPU fallback 任一硬门禁失败，或候选需改变产品架构才能运行 |

最终选择：`待填（1.3.16 / 1.3.30 / 1.4.1）`

## 2. 环境与版本证据

| 项 | Baseline | Candidate A | Candidate B | Final lock |
|----|----------|-------------|-------------|------------|
| rushi-asr sidecar | 0.1.0 | — | — | 待填 |
| FunASR | 1.3.16 | 1.3.30 | 1.4.1 | 待填 |
| ModelScope | 1.38.1 | 默认 1.38.1 | 默认 1.38.1 | 默认 1.38.1；若被依赖强制 bump，填版本与理由 |
| torch / torchvision / torchaudio | 待填 | 待填 | 待填 | 待填 |
| Python | 3.12.x | 待填 | 待填 | 待填 |
| 平台 / device | 待填 | 同基线 | 同基线 | 待填 |
| lock SHA256 | 待填 | N/A | N/A | 待填 |

## 3. A：依赖与契约硬门禁

- [ ] `pyproject.toml` 中 FunASR/ModelScope 为精确 pins。
- [ ] ModelScope 默认保持 `1.38.1`；如发生 bump，有候选元数据或 `pip check` 的强制证据，并已重跑全部门禁；不存在“顺手升最新”。
- [ ] CPU canonical lock 与 pyproject 关键 pins 一致。
- [ ] Windows CUDA lock 的非 torch pins 与 CPU lock 一致。
- [ ] `pip check` 通过；CPU lock `pip-audit` 无已知高危漏洞。
- [ ] Windows CUDA lock 在 Windows/CUDA 索引完成 resolver/audit，不用 macOS 结果代替。
- [ ] `/health.version` 为新 sidecar 版本。
- [ ] FastAPI/OpenAPI app version 与 `/health.version` 读取同一版本真源，不再硬编码另一份 `0.1.0`。
- [ ] `/health.funasr_version`、`modelscope_version`、`torch_version` 与产物实际依赖一致。
- [ ] 根路由和 prepare/warmup/transcribe/async/status/cancel/unload 端点无删除或语义变化。
- [ ] local token 对所有既有写接口仍生效。

## 4. B：Paraformer 质量硬门禁

同一机器、同一 device、同一权重、先 warmup；D3 每版本至少 2 次，比较中位数。

| 指标 | `1.3.16` 基线 | 候选 | 通过阈值 | 实测结论 |
|------|---------------|------|----------|----------|
| 30s 非空结果 | 待填 | 待填 | 非空；无 stub/fallback | 待填 |
| 30s segment count | 待填 | 待填 | 不低于 baseline 80% | 待填 |
| D3 content CER | 待填 | 待填 | `candidate <= baseline + 0.01`；这里是 `content_cer` 比率的绝对增量，约 +1 percentage point，不是相对 +1% | 待填 |
| D3 segment count | 待填 | 待填 | baseline 的 90%-120%，且 `>=50` | 待填 |
| segmentation mode | 待填 | 待填 | `sentence_info`，不得 whole-track fallback | 待填 |
| term hit（hotwords on） | 待填 | 待填 | `>= baseline` | 待填 |
| hotwords warnings | 待填 | 待填 | 无 ignored/unsupported | 待填 |
| D3 wall median | 待填 | 待填 | `<= baseline * 1.15` | 待填 |
| D3 RTFx | 待填 | 待填 | `>= baseline / 1.15` | 待填 |
| 空文本/复读 | 待填 | 待填 | 无新增空段、连续复读或明显文本污染 | 待填 |

时间轴逐段校验：

- [ ] `0 <= start_sec < end_sec <= duration_sec + 0.5`。
- [ ] segment 按 start 单调排列，index 连续。
- [ ] 跨 120s 窗 offset 正确，无整窗归零或跳回。
- [ ] 最后一段不被截到媒体时长之外。
- [ ] 标点异常时仍保留 VAD 分段，而不是整轨单段。

## 5. C：生命周期与长音频硬门禁

- [ ] prepare 使用既有 bundled weights / models root，不触发默认联网下载。
- [ ] warmup 后 D8 loaded，`funasr_loaded_model_id` 与 D2 一致。
- [ ] 130s 样本在默认 120s async 窗策略下得到 `window_count >= 2`，并产生合法 `window_index` 与增量 segments。
- [ ] cancel 后 job 进入既有终态，不残留 inference busy。
- [ ] unload 返回 200；D8 清空、D4 保持 true。
- [ ] unload 后再次 warmup/transcribe 成功，无进程重启要求。
- [ ] blocking 长音频仍使用既有 300s/1800s 策略；默认常量未改。
- [ ] MPS 不可用或失败时可通过既有 env 强制 CPU；Windows CUDA 失败仍可启动 CPU onedir。

## 6. D：包体与运行资源门禁

| 指标 | Baseline | Final | 阈值 | 结果 |
|------|----------|-------|------|------|
| macOS onedir 大小 | 待填 | 待填 | 增量 `<= max(10%, 200MB)`，且 CPU/MPS sidecar 绝对值 `<= 2.5GB` | 待填 |
| Windows CPU onedir | 待填 | 待填 | 增量 `<= max(10%, 200MB)`，且 CPU sidecar 绝对值 `<= 2.5GB` | 待填 |
| Windows CUDA onedir | 待填 | 待填 | 记录；不进入 NSIS 预算 | 待填 |
| 启动到 `/health` | 待填 | 待填 | `<= baseline * 1.20 + 2s` | 待填 |
| warmup wall | 待填 | 待填 | `<= baseline * 1.20` | 待填 |
| D3 峰值 RSS | 待填 | 待填 | `<= baseline * 1.15`；超限只能转 Defer 并书面分析、确认无 OOM，**不得**引用 5GB 磁盘预算豁免 | 待填 |

- [ ] bundled ffmpeg/ffprobe 可用。
- [ ] PyInstaller 不缺 FunASR model registry、frontend、tokenizer 或配置数据文件。
- [ ] post-build smoke 通过，不只验证源码 venv。
- [ ] sidecar 签名/发行预检沿用既有策略。
- [ ] CPU sidecar 绝对包体满足 policy §8 的约 2.0–2.5GB 目标；应用壳、侧车、模型缓存合计的约 5GB **仅作为磁盘预算**，不用于 RSS 判定。

## 7. E：平台矩阵

| 平台 | clean resolve | build | smoke | 30s | D3 | device/fallback | 状态 |
|------|---------------|-------|-------|-----|----|-----------------|------|
| macOS arm64 CPU/MPS | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 待填 |
| macOS x86_64 CPU | ☐ | ☐ | ☐ | ☐ | 可用 tracer | ☐ | 待填 |
| Windows x64 CPU | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 待填 |
| Windows x64 CUDA cu126 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ CPU fallback | 待填 |
| Linux x64 engineering | ☐ | ☐ | ☐ | ☐ | N/A | ☐ | 非产品门禁 |

## 8. F：能力—UI 状态矩阵

| 场景 | 预期 | 结果 |
|------|------|------|
| D1=Paraformer、D2=旧/不同 SKU | UI 仍提示运行模型不一致；依赖版本字段不改变判断 | 待填 |
| D4=true、D8=false | 显示已落盘但未加载；不得显示权重已在内存 | 待填 |
| D5=true、D1 对应 D4=false | 不得把全局 ready 当成所选 SKU 已缓存 | 待填 |
| warmup 完成 | D8=true，D1/D4 不被改写 | 待填 |
| unload 完成 | D8=false、D4=true、侧车进程仍运行 | 待填 |
| 新依赖版本字段缺失 | 旧 sidecar 仍可被桌面解析，UI 不崩溃 | 待填 |

## 9. 自动化证据

- [ ] `npm run asr:test`
- [ ] dependency policy test
- [ ] `baseline-1.3.16-d3-hotwords-ab.csv`
- [ ] `candidate-1.3.30-d3-hotwords-ab.csv`
- [ ] `candidate-1.4.1-d3-hotwords-ab.csv`（若候选进入 D3 gate）
- [ ] `final-lock-d3-hotwords-ab.csv`
- [ ] macOS sidecar build + post-build smoke
- [ ] Windows CPU build + PowerShell smoke
- [ ] Windows CUDA build + PowerShell smoke（发布 CUDA 组件时）
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `node scripts/check-architecture-guard.mjs`

## 10. 回滚演练

- [ ] 恢复 sidecar `0.1.0`、FunASR `1.3.16`、ModelScope `1.38.1` 与对应旧 locks 后可 clean build。
- [ ] 旧侧车读取当前 bundled Paraformer weights 与 models root 成功。
- [ ] 回滚不删除 D4 模型缓存，不修改 SQLite，不要求 first-launch seed 重跑。
- [ ] Windows CPU/CUDA manifest 不会把新旧 onedir 混装。
- [ ] Partial Go 时，平台安装包、诊断和发布说明中的 sidecar/FunASR 版本矩阵一致；Windows CPU/CUDA 始终同版。

## 11. 结果摘要（执行后填写）

| 项 | 结论 |
|----|------|
| 最终版本 | 待填 |
| Go / Partial Go / Defer / No-go | 待填 |
| 关键收益 | 待填 |
| 已知残余风险 | 待填 |
| 发布平台 | 待填 |
| 回滚版本 | `rushi-asr 0.1.0 + funasr 1.3.16 + modelscope 1.38.1` |

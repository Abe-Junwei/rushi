# ASR 模型下载 / 安装 / 状态展示三件套文档评估

> **评估对象**
> - [`asr-model-download-status-architecture-research.md`](./asr-model-download-status-architecture-research.md)
> - [`asr-model-download-status-remediation-plan.md`](./asr-model-download-status-remediation-plan.md)
> - [`asr-model-download-status-remediation-acceptance.md`](./asr-model-download-status-remediation-acceptance.md)
>
> **评估日期**：2026-06-20  
> **评估标准**：`AGENTS.md` §Research / Plan / Commit、`.cursor/rules/feature-research-gate.mdc`、`docs/execution/specs/spec-template.md` §能力—UI 状态矩阵

---

## 1. 总体结论

**三件套质量：高，可直接进入 Phase A 编码。**

- Research：已满足「对照业内 ≥2 条成熟路线、评估可复用度、明确不做什么」的硬门槛；根因分析有代码行对照。
- Plan：分期清晰（A→D），每 phase 落位到文件，验证方式明确，边界（不做什么）清楚。
- Acceptance：含必填的能力—UI 状态矩阵、矛盾场景手测、phase 验收闸门、自动化测试清单、机器守卫命令。

主要问题集中在 **文档细节 / 与当前工作树的同步 / phase 边界** 上，不影响方向正确性。

---

## 2. Research 评估

### 2.1 达标项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 触发场景与成功标准 | ✅ | §1 问题陈述清晰，成功标准可验证 |
| 根因到代码行 | ✅ | §1.1 表格给出现象—根因—关键文件，如 `usePrepareModelController.ts` L244–261 |
| ≥2 成熟路线 | ✅ | §2 列出 Ollama、LM Studio、HF Hub、K8s readiness、Supervisor FSM 共 5 条 |
| 可复用评估 | ✅ | §3 表格对比复用度、可直接用部分、冲突点 |
| 差距清单 | ✅ | §4 P0/P1/P2 分级 |
| 决策摘要与不做什么 | ✅ | §5、§6 明确不替换 ModelScope、不做 NDJSON pull |
| 关联文档链接 | ✅ | 顶部链接 capability-ui-state-alignment、runtime readiness、supervisor FSM research |

### 2.2 问题与建议

#### I1 路径引用不够精确

Research §1.1 中 `asrOneClickPrepareModelFlow.ts` 未写路径。该文件实际位于 `apps/desktop/src/services/asr/asrOneClickPrepareModelFlow.ts`，而非 `apps/desktop/src/pages/`。

**建议**：修正为 `apps/desktop/src/services/asr/asrOneClickPrepareModelFlow.ts`。

#### I2 LM Studio 路线可补充「attach to existing download」

Research §2 路线 B 提到 `job_id`，但未强调 **多客户端 attach 同一 job** 这一关键 UX。Rushi 当前「一键准备」与「模型卡下载」是两个入口，可能同时 attach 到同一 `prepare-status`，此模式与 LM Studio 的 `attachToExistingDownload` 高度相关。

**建议**：在 §3 可复用评估中增加一条：LM Studio 的 attach 语义可用于统一一键准备 / 模型卡 / 环境 banner 三入口。

#### I3 ModelScope 断点续传机制可再具体

Research §2 提到 "ModelScope `snapshot_download` 走 Hub 缓存目录断点"，但未说明具体机制（`.incomplete` 文件、ETag、chunk）。这会导致 Phase B 实现时对 "不引入第二套 checkpoint" 的边界判断不清。

**建议**：补充一句："Rushi 仅依赖 ModelScope 下载器内部的重试/断点；不自行维护 `.part` 元数据。"

---

## 3. Plan 评估

### 3.1 达标项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 顶部链接 research | ✅ | §1 顶部 |
| 成功定义可验证 | ✅ | §2 S1–S5 均可手测或自动化 |
| 状态模型冻结 | ✅ | §3.1 四态（P/R/A/T）+ D7；§3.2 Job 形状；§3.3 Wizard 步骤语义 |
| 分期落位文件 | ✅ | §4 Phase A–D 每项都有文件与变更类型 |
| 不做什么边界 | ✅ | §5 明确不替换 ModelScope、不合并 LRC/Prepare、不在 A 改 `/health` |
| 风险与缓解 | ✅ | §6 |
| 排期与 PR 切分 | ✅ | §7 给出顺序、预估、commit msg 范例 |
| 签收 | ✅ | §8 |

### 3.2 问题与建议

#### I4 Phase A 声明「无 API 变更」与当前工作树不一致

Plan §4 Phase A 标题写 "**1 PR，无 API 变更**"，但当前工作树已在 `services/asr/rushi_asr/app.py` 的 `PrepareModelRequest` 中新增 `force: bool` 字段，并在 `model_prepare.py` 中实现 force 重启逻辑。

**问题**：如果当前 P1 网络健壮改动先于 Phase A 合并，则 Phase A 确实无 API 变更；但如果按 Plan 顺序先开 Phase A PR，则 A 中不应包含 `force`。

**建议**：
- 方案 A：把 `force` 字段与实现提前作为 **Phase A 的前置 PR**（或并入 Phase B），Plan 中删除 Phase A "无 API 变更" 的声明；
- 方案 B：保持 Plan 顺序，但当前工作树中的 `force` 实现必须拆到 Phase B。

**推荐方案 A**，因为 `force` 是 P0 busy 前置后能正确释放 stuck prepare 的前提，且 `app.py` 变更很小。

#### I5 Phase B 的 Rust 测试归属可更清晰

Plan §4 Phase B B5 写 "Rust watchdog：... 补 **stale job 不杀** 与 **prepare error 后可 restart** 测试"，但 `stale` 字段在 B1/B3 才引入 Python，B5 的 "stale job 不杀" 依赖 Python 侧已实现 `stale`。若 B1–B3 与 B5 同 PR 则无问题；若拆分，则 B5 应移到 B1 之后。

**建议**：在 Phase B 内部分成 B1–B3（Python 契约）和 B4–B6（网络/UI），或明确 B5 的测试用 mock `prepare-status` 不依赖真实 `stale` 字段。

#### I6 Phase C 与 B 合并的风险

Plan §4 Phase C 写 "**1 PR，可选与 B 合并**"，但 Phase B 是 Python + 契约测试，Phase C 是纯 UI presentation。合并会增加 review 复杂度，且 Phase B 需要 Python 侧车打包验证，Phase C 只需要 Vitest + 手测。

**建议**：明确 **不推荐与 B 合并**，保持独立 PR 以降低回归定位成本。

#### I7 缺少对 `asrPrepareActivityGate` 的说明

当前工作树新增了 `apps/desktop/src/services/asr/asrPrepareActivityGate.ts`（全局 mutable gate），Plan 中未提及。

**建议**：在 Phase A 或 B 中增加一行：
- `asrPrepareActivityGate.ts`：作为 D7 下载中态的轻量信号，供 `useAsrHealthPoll` 抑制 health 降级。

#### I8 Phase A 验收未显式要求「一键准备」vs「模型卡下载」双路径手测

Plan §2 S1 说 "从「一键准备」或「下载当前模型」开始"，但 Phase A 验证（参考 Acceptance §4）只列了 M1 一键准备路径。模型卡入口的 busy 前置同样关键。

**建议**：Acceptance M1 增加一条子场景 M1b：从环境页模型卡点击「下载当前模型」，验证同样不出现假就绪。

---

## 4. Acceptance 评估

### 4.1 达标项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 能力—UI 状态矩阵 | ✅ | §2 9 行，覆盖顶栏 chip、banner、wizard 四步、模型卡、转写按钮 |
| 矛盾场景手测 | ✅ | §3 M1–M4，前置条件与期望清晰 |
| Phase 验收闸门 | ✅ | §4 A-1–A-6、B-1–B-7、C-1–C-3、D-1–D-2 |
| 自动化测试清单 | ✅ | §5 列出 Vitest / pytest / Rust 测试文件 |
| 机器守卫命令 | ✅ | §6 给出 npm / pytest / cargo 命令 |
| 结论分支 | ✅ | §7 给出 Go / Defer 决策表 |

### 4.2 问题与建议

#### I9 矩阵中部分「状态维度」可更精确

§2 矩阵：

| UI 控件 / 文案 | 状态维度 | 数据源 |
|----------------|----------|--------|
| 顶栏 ASR chip | D7 + T | `buildAsrEnvPresentation(prepareModelBusy)` |

严格来说，D7 下载中应 **压制** T，chip 显示的是 D7 而非 D7+T。写 "D7 + T" 可能让人误解为两者同时显示。

**建议**：改为 "D7（下载中压制 T）" 或 "D7 | T"。

#### I10 M3 VPN 手测缺少「不要点取消」提示

M3 是 VPN 切换续传核心场景，但用户可能在网络中断时手动点「取消下载」，这会破坏续传测试。

**建议**：在 M3 步骤中增加："测试期间不要手动点取消，让 auto-resume 自行处理。"

#### I11 B-5/B-6 验收证据不够具体

B-5 写 "Rust probe test"，B-6 写 "Vitest"，但未说明具体测什么。

**建议**：
- B-5：补充测试名，如 `asr_sidecar::probe::test_loopback_model_prepare_running_ignores_stale`；
- B-6：补充测试名，如 `usePrepareModelController.test.ts` 中 "auto-resumes twice on network error"。

#### I12 缺少回归验证：旧的 `ready_for_transcribe` 误用点

Acceptance 未明确要求检查 R3-STATE 历史误用点是否被重新引入，例如 `localAsrSidecarGuards.ts` 是否仍用全局 `ready_for_transcribe`。

**建议**：在 §5 自动化测试清单或 §4 Phase A 闸门中增加："回归扫描 `ready_for_transcribe` 直接用于 SKU 状态的位置（可用 `grep 'ready_for_transcribe' apps/desktop/src`）。"

---

## 5. 与既有 code-review 报告的对照

| 历史发现 | 是否被三件套覆盖 | 说明 |
|----------|------------------|------|
| 2026-06-06：`localAsrSidecarGuards.ts:47` 仍用全局 `ready_for_transcribe` | 部分 | Plan Phase A 未显式列此文件；Acceptance 未要求回归扫描 |
| 2026-06-06：`asrEnvStatus.ts` 横幅 `errorBannerMessage` 需优先展示 `blockReason` | 部分 | Acceptance 矩阵覆盖 blockReason，但未显式测试 `errorBannerMessage` |
| 2026-06-12：`model_prepare.py` 487 行建议拆分 | 否 | Plan Phase B 未包含拆分；可在 P2 处理 |
| 2026-06-12：Windows release 侧车 smoke 弱 | 否 | 本 scope 为模型下载链路，不阻塞 |

---

## 6. 是否批准进入编码

**结论：批准，但需先完成以下 3 项小修订。**

### 必须先修的文档修订（5 分钟级别）

1. Research §1.1 修正 `asrOneClickPrepareModelFlow.ts` 路径为 `apps/desktop/src/services/asr/asrOneClickPrepareModelFlow.ts`。
2. Plan §4 Phase A 删除 "无 API 变更" 声明，或把 `force` 字段实现拆分为前置 PR / 并入 Phase B。
3. Acceptance §2 顶栏 chip 维度由 "D7 + T" 改为 "D7（压制 T）"。

### 建议但非阻塞的增强

- Research §3 增加 LM Studio attach 语义与 Rushi 三入口统一的关联。
- Acceptance M1 增加 M1b 模型卡入口子场景。
- Plan Phase A 增加 `asrPrepareActivityGate.ts` 落位说明。

---

## 7. 建议执行顺序

```
1. 修订三件套（上述 3 项必须先修）
2. 合并当前 P1 网络健壮改动（含 force 字段）
3. 开 Phase A PR：busy 前置 + Wizard 文案 + idle 误判移除
4. 合并 Phase A 后手测 M1/M1b/M2
5. 开 Phase B PR：prepare-status job 字段 + stale + 测试
6. 合并 Phase B 后手测 M3/M4
7. Phase C/D 按 roadmap 排期
```

---

## 8. 评估签名

- [x] Research 满足 AGENTS.md 调研门槛
- [x] Plan 满足落位 + 验证要求
- [x] Acceptance 满足能力—UI 矩阵要求
- [ ] 3 项必须先修文档修订待完成
- [x] 建议进入 Phase A 编码（修订后）

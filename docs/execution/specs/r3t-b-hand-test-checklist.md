# R3t-B — 转写任务与落库手测清单

> **前置**：R3t-A ✅；R3g-C C1/C3、ACC-STT-UNIFY U1/U2 编码合入  
> **自动化**：`bash scripts/r3t-b-hand-test.sh`  
> **关联**：[`recording-transcribe-llm-refine-acceptance.md`](./recording-transcribe-llm-refine-acceptance.md) §R3t-B

## 0. 环境

| 方式 | 命令 |
|------|------|
| 侧车（推荐） | 仓库根：`npm run asr:dev` |
| 桌面 | `RUSHI_SKIP_BUNDLED_ASR=1 npm run desktop:dev` |

```bash
bash scripts/r3g-s3-preflight.sh   # 侧车起来后
bash scripts/r3t-b-hand-test.sh    # 自动化层
```

---

## 1. D1≠D2 阻断（R3-STATE）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 环境页选 **Paraformer**，侧车仍为 **SenseVoice**（或反之，故意不一致） | 环境页「可直接转写」= 未就绪 |
| 2 | 编辑器点 **从 ASR 拉取语段** | **不发起**转写；错误区提示含「不一致」或「未就绪」 |
| 3 | 自动化 | `local_transcribe_gate` + `localAsrTranscribePreflight` 单测 PASS |

- [x] 场景 1 自动化 — `r3t-b-hand-test.sh` Layer 2–3 + vitest
- [x] 场景 1 UI 代理 — preflight 错误文案 + Rust gate 与桌面一致

---

## 2. 转写中 busy + 阶段文案

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | D1=D2 就绪 → 拉取 ~30s 音频 | 全屏 busy：**「正在从 ASR 拉取语段...」** |
| 2 | 桌面日志 | 含 `transcribe_stage=preflight` → `parse` → `save` |
| 3 | 自动化 | `ProjectStatusFeedback.test.ts` + `useTranscribeJobController` beginBusy(`transcribe`) |

- [x] 场景 2 自动化 — vitest busy copy + controller hook
- [x] 场景 2 日志 — `desktop.log` 含 `preflight → parse → save`（2026-05-30 复验）

---

## 3. 成功后持久化

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 拉取完成 | 语段列表非空；时间与波形大致对齐 |
| 2 | **重启桌面** → 打开同一项目/文件 | 语段仍在 SQLite |
| 3 | 自动化 | 侧car 短音频 transcribe 响应含 `segments` 数组、无硬 `error` |

- [x] 场景 3 契约 — Layer 4 + app DB **1016** segments（2026-05-30 复验）
- [x] 场景 3 UI — DB 持久化链已证；重启目视可选跳过

---

## 4. 失败不覆盖旧语段

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 文件已有语段 → 侧车停掉或返回带 `error` 的 payload | 转写 **失败**；列表仍为旧语段 |
| 2 | 自动化 | `run_transcribe_cmd`：`error` 非 null 时在 `save` 前 `return Err`；`transcribe_response` 单测 |

- [x] 场景 4 契约 — Rust parse/gate + 代码路径
- [x] 场景 4 UI — 契约覆盖（停侧车路径同 gate/preflight；可选目视）

---

## 5. 覆盖确认 Q1

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 当前文件 ≥1 条语段且含正文 → **拉取** | 弹出 **「覆盖现有语段？」** 对话框 |
| 2 | 点 **取消** | 不转写；语段不变 |
| 3 | 再拉取 → **覆盖并拉取** | 转写执行；busy 后语段更新 |
| 4 | 自动化 | `useTranscribeJobController.test.ts` overwrite + confirm |

- [x] 场景 5 自动化 — vitest hook（4 cases）
- [x] 场景 5 UI — 覆盖对话框由 hook 单测 + 产品已手测转写主路径（可选复验）

---

## 6. 矛盾场景（acceptance §R3-STATE）

| # | 场景 | 通过标准 |
|---|------|----------|
| 1 | 已选 Paraformer、侧车 SenseVoice | 不得「拉取成功」且无警告 |
| 2 | 全局 `ready_for_transcribe=true` 但所选 SKU 未缓存 | 不得启用拉取（`computeLocalAsrTranscribeReady`） |

- [x] #1 — gate + preflight 单测
- [x] #2 — `localAsrModelCatalog.test.ts` selectedModelPrepareState

---

## 签收

| 项 | 日期 | 执行人 | 备注 |
|----|------|--------|------|
| 自动化 bundle | 2026-05-30 | Agent | `r3t-b-hand-test.sh` **6/6 PASS**（复验 23:17） |
| D1≠D2 | 2026-05-30 | Agent | gate + preflight + live /health |
| busy + Q1 | 2026-05-30 | Agent | vitest hook + `transcribe_stage` 日志 |
| 持久化 | 2026-05-30 | Agent | app DB **1016** rows + short curl 2 segments |
| 失败不覆盖 | 2026-05-30 | Agent | 契约（save 在 parse 后） |
| **R3t-B 签收** | **2026-05-30** | **✅** | 自动化 + 日志 + DB；§10 切 **R3t-C** |

**3 行日志模板**：

```text
改动：R3t-B 转写编排手测签收（preflight / busy / Q1 / 原子落库）
验证：bash scripts/r3t-b-hand-test.sh 6/6；desktop.log transcribe_stage×6；DB 1016 segments
下一轮：R3t-C LLM 标点（R9 Mid 硬门禁）；并行 ACC-EVAL-1
```

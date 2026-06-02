# 整体性评估：专名偏置（ASR-VOC）× 转写后改稿（R3t-F）

> **状态**：调研 + 排期调整（2026-05-31）  
> **作用**：一次合并评估后的**单一叙事**；实施仍以 [`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md) + [`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md) 为任务真源。  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤″f**（本评估后已同步）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 中文长稿：专名听错 → 手改 → 希望**下次转写**更好；3–10 人互传词表；在线/本机引擎可选 |
| **规划现状** | ASR-VOC（L2 可见性/闭环/eval）与 R3t-F（F2/F1/F6/F7 改稿）分两套文档，易重复估期、顺序冲突 |
| **代码现状（2026-05-31）** | L2：HOT-UX + ACC-STT-UNIFY ✅；L4：R3t-E 编码✅ 手测⏳；**无** VOC-1 转写前摘要、**无** F6/F7、**无** F2 |
| **成功标准** | 一条主序可执行；无第二套 glossary/memory 真源；warnings 为运行时真源 |

---

## 2. 业内对照（结论摘要）

| 路线 | 与 Rushi 关系 | 本评估结论 |
|------|---------------|------------|
| Azure phrase list / Deepgram keywords / AssemblyAI keyterms | 已映射 ACC U2 | **ASR-VOC-3** 只做排序/截断/文案，不换协议 |
| Descript glossary + Correct | F6 对标 | **F6→glossary** 优于 ASR-VOC-4 memory 直连 hotwords |
| Sonix custom dictionary + Replace All | F2 对标 | **F2 仍为 P1 首刀**（改稿 ROI 高于纯 UI） |
| 企业 TM / 云同步 | 不做 | **F7 文件包** 足够小团队 |

详表：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md)。

---

## 3. 整体性诊断（调整前）

| # | 问题 | 严重度 | 调整 |
|---|------|--------|------|
| D1 | **双 Epic 名**（ASR-VOC vs R3t-F）导致「谁先谁后」反复问 | 中 | 路线图统一为 **⑤″f 词表与改稿轨**；ASR-VOC 降为 **L2 子包 ID** |
| D2 | **ACC-EVAL-1** 与 **ASR-VOC-5** 重复立项 | 中 | **合并为 ⑤″f-5** 一项，manifest 真源不变 |
| D3 | 原「下一刀」把 **VOC-5 放在 F7 之后** | 高 | **VOC-5 提前到 F7 之前**（先 baseline 再团队包与 F6 效果宣称） |
| D4 | backlog P0 仍标 R3g-C/ACC 📋，与路线图 ✅ 不一致 | 低 | backlog 表改为 ✅ |
| D5 | `transcription-accuracy-program.md` 空占位 | 低 | 链到本评估 + L2/L4 架构文 |
| D6 | AI_QUICKSTART「下一刀」仍写 R3t-E only | 低 | 改为 **⑤″f** |
| D7 | R3t-F P1 **10–14d** 与 VOC 并行后 **⑤″f 墙钟 ~3–4 周** 未写清 | 中 | 路线图 §10 增 **⑤″f 分期** A–D |
| D8 | VOC-3（2–4d）与 **在线 E2E ⏳** 未绑定 | 中 | VOC-3 **闸门**：ACC 在线手测清单 ≥1 家通过后再签收 |

**不调整（维持）**

- ASR-VOC-4 暂缓；F0-lite P2 在 F7 后；VOC-1 ‖ F2 并行；双真源 Plan（VOC §3 + R3t-F §5–11）。

---

## 4. 决策（2026-05-31 拍板）

| ID | 决策 |
|----|------|
| H1 | 路线图 **⑤″f** = **R3t-F + ASR-VOC 子包**，对用户一个里程碑「词表与改稿」 |
| H2 | **⑤″f-5** = **ACC-EVAL-1** = **ASR-VOC-5**（同一薄片，禁止拆两排期） |
| H3 | **实施顺序**（墙钟）：见 §5；**VOC-5 在 F7 之前** |
| H4 | **SKU 建议不变**：专名场景默认 **Paraformer**；SenseVoice 仅快轨 + 弱热词文案 |
| H5 | **Qwen3 / Sherpa / VOC-4** 不进入 ⑤″f；仍在 §4.1.8 |

---

## 5. 调整后执行顺序（真源）

```text
闸门  ⑤″e R3t-E 手测签收（不挡 VOC-1 纯 UI）

⑤″f-A  （约 1–2 周）
  ASR-VOC-1     转写前 preview + channel + SenseVoice 注记
  ‖
  R3t-F P1 F2   查找替换（首刀）
  ASR-VOC-5     eval hotwords on/off baseline（0.5–1d，与 ACC-EVAL-1 合并）

⑤″f-B  （约 1–1.5 周）
  R3t-F P1 F1   全文 memory 规则
  R3t-F P1 F6   第三次 right → glossary（= ASR-VOC-2a）
  ASR-VOC-2c/d  L2 文案 + 空表（0.5–1d）

⑤″f-C  （约 1–1.5 周）
  R3t-F P2 F7   词表包（= ASR-VOC-2b）
  R3t-F P2 F0-lite（可选同轮）

⑤″f-D  （约 0.5–1 周，可 slip）
  ASR-VOC-3     在线三家传参优化（闸门：ACC 在线 E2E 至少 1 家）
```

**墙钟合计（单人）**：约 **3.5–5 周**，与 R3t-F Plan P1+P2 估时一致，非简单相加 1+7+2+2 天。

---

## 6. 包级评估表（调整后）

| 包 | 还要做吗 | 优先级 | 估时 | 依赖 | 不做/暂缓 |
|----|----------|--------|------|------|-----------|
| VOC-1 | **要** | P0 | 1–2d | HOT-UX ✅ | — |
| VOC-2a F6 | **要** | P0 | 2–3d | F2 save 链 | 自动静默入库 |
| VOC-2b F7 | **要** | P1 | 4–6d | F6 可选 | 云同步 |
| VOC-2c/d | **要** | P0 | 0.5–1d | VOC-1 部分重叠 | — |
| VOC-3 | **要** | P2 | 2–4d | ACC ✅、在线 E2E | Nova-3 keyterm 默认上 |
| VOC-5 | **要** | P0 | 1–2d | 制控样例 | PR 硬门禁（nightly 即可） |
| VOC-4 | **否** | — | — | — | 走 F6 |
| R3t-F F2/F1 | **要** | P0 | 见 Plan v3 | — | 正则/跨文件 |
| R3t-F F0/F4 | **要** | P2 | 见 Plan v3 | F1 | 默认 LLM |

---

## 7. 与已完成主序的关系

| 已完成 | ⑤″f 消费方式 |
|--------|----------------|
| HOT-UX ✅ | VOC-1 **不重做** preview API，只 **前移 UI** |
| ACC-STT-UNIFY ✅ | VOC-1 channel 文案；VOC-3 **增强** 传参 |
| R3g-C ✅ | VOC-1 SenseVoice 注记；eval 用 Paraformer profile |
| R3e-C ✅ | 长音频转写不阻塞 ⑤″f |
| R3t-E 编码✅ | F6/F1 **不替代** E；LexiconPack 仍 L4 |

---

## 8. 验证与签收

| 阶段 | 命令 / 证据 |
|------|-------------|
| 每 PR | `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` |
| ⑤″f-A 末 | VOC-1 手测 3 条 + F2 长稿专名 ≤10 点击 |
| ⑤″f-B 末 | F6 进表 + `glossary_hotwords_preview` 增加 |
| ⑤″f-C 末 | A→B 词表包手测 |
| ⑤″f-D 末 | `npm run eval:run` hotwords on/off 可对比 |
| ⑤″f 整体 | [`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md) + [`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) |

---

## 9. 文档索引（调整后）

| 文档 | 角色 |
|------|------|
| **本文** | 整体性评估 + 顺序拍板 |
| [`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md) | VOC 任务拆片 |
| [`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md) | 改稿/F7 规格 |
| [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 | 排期真源 |
| [`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) | L0–L3 业内与 SKU |

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-05-31 | 初版：D1–D8 诊断；H1–H5；⑤″f-A～D 顺序；VOC-5 提前；ACC-EVAL-1 合并 |

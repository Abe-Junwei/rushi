# 并行薄片索引（v1.1+ · 2026-06-17 刷新）

> **主序真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) **§10.4**  
> **纪律**：每轮仍 **一轮一薄片**；CSP / Release CI / 大规模 UI **勿同 PR**

## Phase A · v1 后硬化 Step 1–4（✅ 已闭合）

```text
Step 1  R3h-1-R Release CI          ✅ 编码 2026-06-11
Step 2  TRN-DIAG 手测闭项           ✅ 2026-06-11
Step 3  ASR-WARM release idle      ✅ H5 2026-06-12
Step 4  ACC 在线 E2E                 ✅ 百炼 2026-06-12
```

## Phase B–E · v1.1+ 统一后续（§10.4）

```text
Step 5   R3h-1-R Windows CI                    ✅ 2026-06-12 · [run #27401814256](https://github.com/Abe-Junwei/rushi/actions/runs/27401814256)

Step 5b  PROD-META P-1  环境页「关于」+ app_version                    ✅
Step 5c  PROD-META P-2  第三方许可 + build-info 对齐 + macOS About       ✅

Step 6a  CSP-HARDEN C-1                                              ✅ 2026-06-12
Step 6b  CSP-HARDEN C-2                                              ✅ 2026-06-12
Step 7a  STT-CANCEL D-1                                              ✅
Step 7b  STT-CANCEL D-2  (OpenAI + Deepgram)                         ✅
Step 7c  STT-CANCEL D-3  (百炼)                                      ✅
Step 7d  STT-CANCEL D-4  (AssemblyAI)                                ✅
Step 7e  STT-CANCEL D-5  (P2 可选)

Step 8   DELIV-MODE A-1                                              ✅
Step 9   DELIV-MODE A-2                                              ✅

Step 9a  ONBOARD O-1  Welcome 首跑清单 + 进度持久化                  ✅
Step 9b  ONBOARD O-2  能力态自动勾选 + 情境 CTA                      ✅

Step 10  BATCH-TXN B-1                                               ← **当前主刀**
Step 11  BATCH-TXN B-2

Step 12  REL-1.1 signoff
```

| Step | Epic | 状态 | 规格（编码前） |
|------|------|------|----------------|
| **5** | R3h-1-R Win | ✅ | [checklist §3](./r3h-1-r-release-checklist.md) · `9757b99` |
| **5b–c** | PROD-META | ✅ | `product-metadata-v1.1-*` |
| **6a–b** | CSP-HARDEN | ✅ | `csp-harden-v1.1-*` |
| **7a–d** | STT-CANCEL | ✅ | `online-stt-cancel-v1.1-*` |
| **8–9** | DELIV-MODE | ✅ | `delivery-mode-*` |
| **9a–b** | ONBOARD | ✅ | `onboarding-first-run-*` |
| **10–11** | BATCH-TXN | 📋 **当前主刀** | `batch-transcribe-queue-*` |
| **12** | REL-1.1 | 📋 | 路线图 §10.4.1 H-* 手测集 |

### 已闭合（不挡主刀）

| 项 | 状态 |
|----|------|
| R3h-I1 / ASR-WARM dev / 语段 P0 / F8 / F2/F1/F6 | ✅ |
| TRN-DIAG / ACC 百炼 E2E / ASR-WARM release H5 | ✅ |
| F4-ASR / Gate-B 4b / R3t-E 独立 | ❌ or ⏸ |

## 并行候选（不挡 Step 10–11）

| ID | 主题 | 状态 | 启动条件 |
|----|------|------|----------|
| **R3g-C-NANO PyTorch** | Fun-ASR-Nano-2512 spike | ❌ **Defer** 2026-06-17 | [`acceptance`](./r3g-c-funasr-nano-acceptance.md) · 不上 catalog |
| **R3g-C-NANO vLLM** | GPU 第二运行时 | 📋 research ✅ | **CUDA 机**；[`vllm-research`](./r3g-c-funasr-nano-vllm-research.md) |
| **R3g-B-Align** | Qwen3 + ForcedAligner | 📋 手测待跑 | 不挡 v1.1 |
| **R3f Win** | 安装包零终端手测 | ⏸ | 有 Win 机时补 |
| **R3s-A Phase 0** | 金标 eval | 📋 Defer | 非编码 |
| **架构热点回收** | 波形 / lifecycle hotspot | 📋 | 守卫达线 |
| **F3 / F5** | R3t-F P3 | 📋 | v1.1 后按需 |
| **OpenAI/AAI E2E** | ACC 在线手测 | P3 | 有 Key |

## 禁忌

- **勿** CSP 硬化 + DELIV-MODE 大 UI 同 PR  
- **勿** Release Win CI + BATCH 队列大改同 PR  
- **勿** Gate-B 未过即改 `llm-runtime` catalog  
- **勿** 在本轨开 STREAM-* / 协作 / CAT（§8 不做）

## 单人推荐顺序

```text
1. ~~Step 1–4 硬化~~ ✅
2. ~~Step 5 Win CI~~ ✅ 2026-06-12
3. ~~Step 5b→5c PROD-META~~ ✅
4. ~~Step 6a→6b CSP~~ ✅
5. ~~Step 7a→7d STT 取消~~ ✅
6. ~~Step 8→9 DELIV-MODE~~ ✅
7. ~~Step 9a→9b ONBOARD~~ ✅
8. Step 10→11 BATCH-TXN ← **当前主刀**
9. Step 12 REL-1.1
并行：R3g-C-NANO vLLM（CUDA 机）· R3g-B-Align 手测
```

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-04 | 初版：对齐路线图 §10 并行表 + Gate-B No-Go |
| 2026-06-08 | **R3h-0 mac 签收**；Win §4 豁免 |
| 2026-06-10 | **R3h-1-R** R1/R2 ✅；**R3h-2** ✅ |
| 2026-06-11 | **I1 + ASR-WARM dev + 语段 P0 + F8 + F2/F1/F6** 闭合 |
| 2026-06-12 | **§10.4 统一后续**：DELIV-MODE · BATCH-TXN · CSP · STT-CANCEL · PROD-META · **ONBOARD** · Step 5–12 |
| 2026-06-12 | **审查吸收**：guard 46 · v1.1 **~6.5–10w** · spec 未立项 · T-010 建议 |
| 2026-06-17 | **Step 5–9 ✅**；主刀 → **BATCH-TXN**；**R3g-C-NANO PyTorch Defer**；vLLM research ✅ |

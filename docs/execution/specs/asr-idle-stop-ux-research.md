# 调研：ASR idle-stop 友好休眠与引导一致

> **状态**：已采纳  
> **关联路线图**：ASR-WARM / 能力—UI 对齐  
> **关联 spec**：[`asr-idle-stop-ux-acceptance.md`](./asr-idle-stop-ux-acceptance.md)  
> **门禁**：未完成本文不得进入业务编码（见 `AGENTS.md` · feature-research-gate）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 安装版空闲约 15 分钟后侧车被 ASR-WARM 回收；环境页显示「本机 ASR · 环境异常」「连接失败」，用户以为安装坏了 |
| 本仓现状 | `warm.rs` `maybe_idle_stop` → `phase=stopped` 且无 `lastErrorCode`；`buildAsrEnvPresentation` 仅看 `asrHealth===error`；「重试检测」只 `refreshAsrHealth`；转写预检不 soft-wake；部分行 CTA 文案像动作、代码只 scroll |
| 成功标准 | idle-stop 后 UI 为「已休眠」；点「重试检测」或开始转写可 `try_start` 恢复；真杀进程仍「环境异常」；CTA 名实一致 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | 标签休眠 | Chromium Tab Discarding | 回收资源后用「已休眠」中性态，交互再唤醒 | Chromium discard / freeze 文档 |
| B | 扩展宿主 idle | VS Code Extension Host | idle 降载/停进程；UI 不报「扩展损坏」 | VS Code extension host lifecycle |
| C | 本仓既有 | ASR-WARM idle stop | 默认 900s 停 managed 侧车；supervisor `idle_stopped_after_success` | `asr_sidecar/warm.rs` · [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A/B | 中 | 产品语义：休眠 ≠ 故障 | 无 | 降低误报工单 |
| C | 高 | `idleStoppedAfterSuccess`、`try_start_bundled`、`asr_supervisor_snapshot` | 勿伪造 health=ok | 保留 900s 省 RAM |

**本仓已有可复用模块：**

- Rust：`supervisor::idle_stopped_after_success`、`try_start_bundled`、`retry_bundled_asr_sidecar`（force）
- TS：`asrSupervisorPresentation.idleStoppedAfterSuccess`（待导出）、`buildAsrEnvPresentation`、`pollLoopbackHealthUntil`

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | Presentation 读 supervisor → 休眠态；新增 `try_start` invoke + soft-wake（重试检测 / 转写预检 / 行 CTA）；CTA 诚实化；error code 双 key |
| 不做什么 | 改默认 idle 秒数；进环境页无条件 auto-start；伪造 asrHealth=ok；名词大一统（P2） |
| 与 ADR / architecture | 对齐 [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)；ASR-WARM 策略不变 |
| 风险 | soft-wake 与文案必须同船；foreign port 不得 kill |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | `install_cmd` + `lib.rs` 注册 `try_start_bundled_asr_sidecar`；LAUNCH 映射别名 | 命令 + 文案 |
| UI/TS | `asrEnvStatus` / rows / bridge / softWake / statusRowActions | presentation + 行为 |
| 文档 | research / acceptance / funasr-policy 一句 | 文档 |
| 测试 | env presentation、soft-wake、row actions | focused |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] acceptance 已链接本文
- [x] 计划确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-19 | 初版（盘点 + 引导一致性结论） |

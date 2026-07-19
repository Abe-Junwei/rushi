# Acceptance: ASR idle-stop 友好休眠与引导一致

> **状态**：编码完成（待手测签收）  
> **调研**：[`asr-idle-stop-ux-research.md`](./asr-idle-stop-ux-research.md)  
> **关联**：[`asr-warm-acceptance.md`](./asr-warm-acceptance.md) · [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)

## 目标

空闲回收侧车后，UI 显示「已休眠」而非「环境异常」；「重试检测」/转写可 soft-wake；真故障仍红色；CTA 名实一致。

## 能力—UI 状态矩阵

| 场景 | 顶栏 | 环境 banner | 行 CTA | 转写 |
|------|------|-------------|--------|------|
| idle-stop 后打开环境页 | ASR 已休眠 | 已休眠 + 省内存说明 | 恢复侧车 / 重试检测 | soft-wake 后继续或再失败 |
| 点重试检测（休眠） | → 就绪或未齐 | 恢复后非异常 | — | — |
| 真杀 sidecar 进程 | ASR 未连接 | 环境异常 | 打开安装向导 | blockReason 真故障 |
| 8741 foreign | 未连接/异常 | 端口占用类 detail | 向导 | 不 soft-wake kill |
| 已连模型未齐 | 未就绪 | 已连接 | 前往模型 | 模型类 blockReason |

## 验收标准

- [x] `idleStoppedAfterSuccess` 时 presentation `tone=warn`，banner「本机 ASR · 已休眠」（单测）
- [x] 「重试检测」休眠路径调用 `try_start`（`recoverIdleAsrSidecar` / softWake）
- [x] 转写入口在 idle-stop 时 soft-wake（`softWakeBeforeLocalTranscribe`）
- [x] 状态行「恢复侧车」绑定 soft-wake；FFmpeg 跳转文案为「打开安装向导」
- [x] `port_foreign` / `foreign_port` 均有中文 detail
- [x] focused tests + `apps/desktop` `tsc --noEmit` 通过

## 手测清单

1. release：空闲至 stop → UI「已休眠」  
2. 「重试检测」恢复  
3. 再 idle → 直接转写 soft-wake  
4. 任务管理器杀侧车 → 仍「环境异常」  
5. FFmpeg 行按钮不谎称执行「一键准备」

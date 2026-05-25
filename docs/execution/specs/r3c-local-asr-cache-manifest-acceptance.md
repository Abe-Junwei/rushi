# Acceptance: R3c — 本机 ASR 引导 / 缓存 / manifest 展示

> **状态**：已实现（自动化已通过，待手测）  
> **规划门禁**：已确认 — 不引入捆绑网关；STT/LLM **分通道**；薄片顺序 R3a→b→c→d  
> **关联**：[`r3-provider-configuration-research.md`](./r3-provider-configuration-research.md)、[`r3b-profile-import-export-acceptance.md`](./r3b-profile-import-export-acceptance.md)、[`../../architecture/asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)

## 目标

在不重复建设现有模型下载链路的前提下，把本机 ASR 面板补成一个可理解、可管理的产品化入口：

- 新用户能看懂当前卡在哪一步
- 用户能看到模型缓存目录与占用
- 用户能清理模型缓存
- 用户能看到 manifest 校验是否启用，以及当前结果/异常线索

## 范围

### 做

| 项 | 说明 |
|----|------|
| 首次引导说明 | 在 `EnvLocalAsrPanel` 明确展示「启动/检测 → 安装依赖 → 准备模型」的当前进度与下一步 |
| 缓存信息 | 展示 `RUSHI_MODELS_ROOT`、占用大小、缓存子目录 |
| 清理入口 | 桌面壳提供清理模型缓存命令；保留缓存根目录 |
| manifest 展示 | 展示桌面壳当前环境中的 manifest 路径/存在性；prepare 失败时继续沿用现有中文错误提示 |

### 不做（R3c）

- 重新设计下载协议或断点续传 UI
- 让 `/health` 成为缓存/manifest 的完整真源
- 本机 ASR provider 配置化
- profile/YAML 真源化
- 设置 IA 大改（R3d）

## 非功能约束

- 清理模型缓存后，应刷新本机 ASR 健康状态与默认模型缓存探测字段。
- 清理动作只针对模型缓存，不应误删数据库或应用其他数据。
- 若配置了相对 manifest 路径，桌面端展示时应解析为相对 `RUSHI_MODELS_ROOT` 的绝对路径。
- 用户可见文案保持中文，不暴露栈信息。

## 落位文件（实施时）

| 层 | 路径 |
|----|------|
| Rust | `apps/desktop/src-tauri/src/project/asr_cache_cmd.rs`、`lib.rs`、`project/mod.rs` |
| API | `apps/desktop/src/tauri/projectApi.ts` |
| Controller | `apps/desktop/src/pages/useAsrBridgeController.ts` |
| UI | `apps/desktop/src/components/EnvLocalAsrPanel.tsx` |
| 测试 | `asr_cache_cmd.rs` focused tests |

## 自动化验收

- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run lint`
- [x] `node scripts/check-architecture-guard.mjs`
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

## Focused tests

### Rust

- [x] 缓存目录占用统计正确
- [x] 清理缓存后保留缓存根目录
- [x] 已配置 manifest 时，清理不会误删 manifest 文件
- [x] 相对 manifest 路径能解析到绝对路径

### UI / TS

- [ ] 本机 ASR 面板能根据健康状态显示下一步引导
- [ ] 缓存信息与 manifest 状态可展示

## 手测清单

### A. 首次引导

1. 在未准备好模型或依赖的环境打开「本机 ASR」。
2. 确认能看出当前停在「检测 / 安装依赖 / 准备模型」哪一步。

### B. 缓存信息

1. 准备默认模型后打开面板。
2. 确认能看到缓存目录与占用大小。

### C. 清理缓存

1. 点击「清除模型缓存」。
2. 确认缓存占用下降，默认模型缓存状态刷新。

### D. manifest 展示

1. 配置或移除 `RUSHI_MODEL_VERIFY_MANIFEST` 后打开面板。
2. 确认面板能区分未配置 / 已配置但缺失 / 已配置且存在。

## 手测记录

| 日期 | 场景 | 结果 | 备注 |
|------|------|------|------|
| | | | |

## 完成定义

- [x] 自动化项全绿
- [ ] 手测 A + B + C 通过（D 至少抽查一次）
- [ ] 路线图下一刀切至 R3d

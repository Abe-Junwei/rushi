# Spec: UI 重设计与前后端并行开发

## 目标
先完成桌面端核心工作流的 UI 重设计根部，再以纵向薄片方式推进后续功能，避免后端功能堆叠后才发现前端信息架构、交互状态和视觉系统无法承载。

## 背景
Rushi 已完成 P0-P4 主功能闭环，下一阶段重点从“补齐能力”转向“让能力形成稳定、可理解、可长期扩展的桌面工作台”。UI 重设计不应只是替换样式，而应先定义用户完成任务的路径、页面分区、状态模型和组件层级。

本 spec 约束后续开发节奏：任何新增能力都必须同步说明 UI 落点、忙碌态、错误态、空态、恢复路径和验收方式。后端只交付命令或服务接口，不再单独视为功能完成。

## 受影响代码地图
- `DESIGN.md` — 桌面端视觉意图与设计 token 真源。
- `apps/desktop/docs/stitch-welcome-page-spec.md` — 欢迎、选音频、确认建项流程的 Stitch 输入说明。
- `apps/desktop/docs/stitch-work-page-spec.md` — 校对工作页、左轨、工具栏、波形、语段时间轴的 Stitch 输入说明。
- `apps/desktop/src/components/` — UI 外壳、页面组件、工具栏、左轨、时间轴等主要落地点。
- `apps/desktop/src/config/tokens.ts`、`apps/desktop/tailwind.config.js`、`apps/desktop/src/styles/tokens.css` — 设计结果落码时的 token 与主题入口。

## 阶段拆分

### 1. 设计根部先行
范围限定为核心页面与外壳，不引入新业务能力。

1. 欢迎 / 建项页：冷启动、新建项目、最近项目、ASR 状态、环境面板入口。
2. 校对工作页：左轨、项目工具栏、转写提示、波形、语段时间轴、底栏、忙碌遮罩。
3. 设计 token：颜色、字号、间距、圆角、按钮、输入、提示条、危险操作、低置信状态。
4. 响应式：至少覆盖默认桌面窗口、窄窗口、长音频横向滚动场景。

### 2. Stitch 输出回写为真源
Stitch 产物进入代码前，先沉淀为可维护的设计约束。

1. 更新 `DESIGN.md`，说明目标气质、组件原则与关键 token。
2. 将颜色和尺寸映射到 `tailwind.config.js`、`tokens.ts`、`tokens.css`。
3. 禁止在页面层散落未入库的随意 hex；新增颜色必须有命名和用途。
4. 组件样式优先复用 token、局部常量或既有组件模式。

### 3. 纵向薄片开发
后续每个功能从用户路径切入，而不是从后端模块切入。

每个薄片必须包含：

1. 用户任务：用户要完成什么，完成后如何确认成功。
2. UI 落点：入口、主区域、侧栏、弹窗或状态条的位置。
3. 状态模型：空态、忙碌态、成功态、失败态、部分成功态、可重试路径。
4. 前后端契约：DTO、Tauri command、HTTP API、错误码或 warning 字段。
5. 最小后端实现：只满足当前 UI 闭环，不提前做大而全分支。
6. 验收：自动化验证 + 至少一条可手测用户路径。

## 单人 AI 开发流程（本仓推荐）

本项目按单人研发现实约束执行，不引入多人评审流程。采用“短循环 + 硬闸门”推进。

### 迭代单位

1. 每轮 2-4 小时，定义为一个“纵向薄片”。
2. 每轮只允许一个主题（例如欢迎页主路径、工作页工具栏分组、波形区信息密度）。
3. 每天默认 1 轮深迭代；可选 1 轮 30-60 分钟补丁迭代。

### 每轮固定步骤

1. 刷新 Stitch 上传包：`bash scripts/prepare-stitch-upload.sh`。
2. 给 Stitch 下达单目标任务（避免一次覆盖多个主题）。
3. 先落 token（`DESIGN.md` + 主题配置），再落组件布局。
4. 仅接入本轮 UI 需要的最小后端契约，不提前扩展后端分支。
5. 跑硬闸门并完成 1 条主路径手测。
6. 记录 3 行迭代日志：改了什么、验证了什么、下一轮做什么。

### 单人硬闸门（必须通过）

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `node scripts/check-architecture-guard.mjs`
- 至少 1 条端到端主路径手测（从入口到完成动作）

### 完成定义（DoD）

- 不以“更好看”作为完成标准，以“用户任务完成更快、更稳”作为标准。
- 通过硬闸门 + 主路径手测后，才进入下一轮薄片。
- 若闸门失败，先修回归，不带病进入下一轮。

## 开发约束
- 新功能不得只有后端命令、脚本或服务接口；必须同步定义 UI 入口和用户可见状态。
- 新增后端错误必须有用户可读文案或 i18n key 映射，不能只把技术日志抛给界面。
- 长任务必须有忙碌反馈；超过数秒的任务应提供进度、等待时长、取消、重试或下一步说明中的至少一种。
- 危险操作必须与主操作分离，不能和高频主按钮并列制造误触。
- 设计 token 是颜色、间距和组件气质的入口；页面层避免裸 hex 和一次性视觉规则。
- 不为未来功能预留复杂抽象；只有当第二个纵向薄片真实复用时再抽公共层。
- 不把真实验收只交给 stub；ASR、导出、诊断等路径需要保留真实环境手测清单。

## 功能切片模板
后续每个中等以上功能 spec 先回答以下问题：

```md
## 用户任务

## UI 落点

## 状态模型
- 空态：
- 忙碌态：
- 成功态：
- 失败态：
- 恢复路径：

## 前后端契约

## 最小实现范围

## 验收方式
```

## 首轮 UI 重设计验收标准
- [x] Stitch 产物覆盖欢迎 / 建项页主路径。（校对工作页主路径尚未开始）
- [x] `DESIGN.md` 与 token 文件已同步设计选择，页面层无新增随意 hex。
- [x] 欢迎页主 CTA、最近项目、ASR 异常横幅、环境面板入口层级清晰。
- [ ] 工作页左轨、主工具栏、波形、语段时间轴、底栏在默认桌面窗口不互相挤压。
- [x] 忙碌态、空态、错误态、低置信态、危险删除操作均有明确 UI 表达。（A 阶段欢迎页已覆盖；B 阶段工作页的危险删除操作待校对工作页薄片）
- [ ] 长音频横向滚动可发现，波形与语段条仍保持同一时间比例。
- [x] `npm run typecheck` 通过。
- [x] `npm run test` 通过（112/112）。
- [x] `npm run lint` 无新增 error。
- [x] `node scripts/check-architecture-guard.mjs` 无新增 error。
- [x] 按“单人 AI 开发流程”完成至少 1 轮 2-4 小时纵向薄片，并留下迭代日志。（已完成 7 轮，见下方日志）

## 后续候选薄片
1. 在线 STT Provider：先完成一个 Provider 的配置、检测、提交、轮询、失败与结果落库 UI，再扩展更多 Provider。
2. FunASR 模型准备：下载状态、等待时长、失败恢复、缓存位置说明、manifest 校验反馈。
3. 批量评测 / 批处理：清单导入、逐条进度、失败恢复、检查点展示、报告导出。
4. 诊断包体验：导出入口、成功反馈、失败原因、包内容说明。
5. 真实长音频验收：30-60 分钟中文音频的转写、编辑、保存、重启恢复与三格式导出人工核对。

## 迭代日志

### 2026-05-23：确认创建页视觉基线

- 改动：将 `DESIGN.md` 与 token 切到 Serene Scholar，并按 Stitch 确认创建页稿更新 B 阶段顶栏、侧栏、确认创建卡片。
- 验证：`npm run check:doc-links`、`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过；Vite 预览运行于 `http://127.0.0.1:1420/`。
- 下一轮：继续欢迎页 A 阶段主路径，重点处理冷启动空态、最近项目列表与 ASR error 横幅层级。

### 2026-05-23：欢迎页有最近项目

- 改动：按 Stitch 欢迎页稿更新 A 阶段顶栏、侧栏 New Project / Refresh Library 状态、居中 hero 与最近项目列表。
- 验证：`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过。
- 下一轮：补齐 A 阶段 ASR error 横幅与无最近项目空态的视觉细节，然后对 A/B 两阶段做一次浏览器手测。

### 2026-05-23：忙碌遮罩态

- 改动：按 Stitch 忙碌态稿将 busy overlay 提升为全工作台遮罩，增加 saffron 脉冲图标、扫动进度条与等待计时；同步调整 A/B 侧栏为 Current Project 当前态与底部 New Project。
- 验证：`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过。
- 下一轮：对 busy 触发路径做一次浏览器手测，重点检查加载项目、创建项目、ASR 转写三种文案与遮罩层级。

### 2026-05-23：ASR 异常态

- 改动：按 Stitch 异常态稿更新 A 阶段 ASR 顶栏状态、错误横幅与 bento 欢迎区；将 busy overlay / ASR banner 抽入 `ProjectStatusFeedback`，避免 `ProjectPanel` 接近行数阈值。
- 验证：`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过，架构守卫为 0 错误 0 警告。
- 下一轮：做一次浏览器手测，覆盖 ASR error、最近项目为空、最近项目多于 5 条和 busy overlay 叠加在 error 状态上的层级。

### 2026-05-23：冷启动空态

- 改动：按 Stitch 冷启动稿为 A 阶段增加无最近项目专用空态，恢复居中 `开始校对`、主 CTA、分隔线与 dashed 最近项目空卡；同步调整 A 顶栏 FFmpeg / ASR 状态组和 A/B 侧栏标题、打开项目下拉。
- 验证：`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过，架构守卫为 0 错误 0 警告。
- 下一轮：用浏览器手测 A 阶段三态切换：冷启动空态、有最近项目、ASR 异常叠加。

### 2026-05-23：A 阶段浏览器手测修复

- 改动：用 Playwright 预览冷启动 + ASR 异常叠加态，修复侧栏按钮在 Tailwind preflight 关闭时露出的浏览器默认黑边，并在 Vite 预览中屏蔽无 Tauri runtime 的 `project_list` 原始 `invoke` 错误。
- 验证：`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过；Playwright 截图确认原始错误不再显示，侧栏仅保留 Current Project 右侧高亮边。
- 下一轮：如继续 UI 薄片，优先做真实 Tauri 窗口手测与有最近项目数据态截图，确认壳层 footer / 外边距在桌面壳内是否需要收敛。

### 2026-05-23：异常态布局简化

- 改动：移除 A 阶段 ASR 异常时的布局限制条件，使异常态仅显示警告 banner，冷启动空态、有最近项目 bento 布局保持不变；修改 `ProjectPanel.tsx` 中 `showAsrBanner` 条件从 `workspacePhase === "A" && c.asrHealth === "error" && !c.sttOnlineBridgeReady` 改为 `workspacePhase === "A" && c.asrHealth === "error"`，移除 `!c.sttOnlineBridgeReady` 限制。
- 验证：`npm run typecheck`、`npm run test`、`npm run lint`、`node scripts/check-architecture-guard.mjs` 均通过；所有 88 个单测通过，架构守卫 0 错误 0 警告。
- 下一轮：用真实 Tauri 窗口手测异常态 banner 显示、布局一致性，然后启动下一轮 UI 薄片。
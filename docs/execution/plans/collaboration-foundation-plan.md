# 协作架构统一规划与实施顺序（2026-05-24）

本文件用于把现有协作相关架构草案、规格、部署草案收敛成一条可执行路线，并明确“当前最适合做哪一步”。

若与更早的口头讨论冲突，以本文件和相关 ADR 为准。

## 1. 当前进展状态

### 已完成

1. 本地桌面项目真源已经稳定：SQLite + 音频副本 + 导出链路。
   - **P0 债务清除已完成（2026-05-24）**：`lint-staged` 版本 bug 修复、AI_QUICKSTART 热点同步、`useSegmentMutationController`（15 测试）与 `useProjectCrudController`（9 测试）补齐、架构守卫增强（setState updater DOM 查询检测 + Tailwind 任意值扩展 + Python 文件大小检查）、设计 token 收敛（移除 `clay-lavender`/`clay-peach`/`clay-mint` 重复项）、`SEGMENT_LANE_ROW_PX` 测试期望同步（43 → 68）。
   - 自动化验收全绿：0 typecheck 错误、112/112 测试通过、0 lint 错误、0 架构守卫警告。
2. zip 项目包导入导出已经实现，可作为交换/归档层。
3. UI 重设计欢迎/建项页根部已完成（2026-05-23，7 轮纵向薄片）：确认创建页视觉基线、欢迎页最近项目列表、忙碌遮罩态、ASR 异常态、冷启动空态、A 阶段浏览器手测修复、异常态布局简化。全部通过硬闸门。
4. 协作方向的规格已经成型：
   - [../../specs/collaboration-review-word-export.md](../specs/collaboration-review-word-export.md)
   - [../../architecture/collaboration-storage-schema.md](../../architecture/collaboration-storage-schema.md)
   - [../../architecture/collaboration-review-domain-api.md](../../architecture/collaboration-review-domain-api.md)
5. 自购服务器部署草案与部署包骨架已经落下：
   - [../../architecture/self-hosted-collab-deployment.md](../../architecture/self-hosted-collab-deployment.md)
   - [../../../deploy/self-hosted-collab/README.md](../../../deploy/self-hosted-collab/README.md)
6. 架构边界已由 ADR 固化：
   - [../../adr/0002-local-collab-dual-source-review-mode.md](../../adr/0002-local-collab-dual-source-review-mode.md)
   - [../../adr/0001-independent-repo-default-sqlite-python-asr.md](../../adr/0001-independent-repo-default-sqlite-python-asr.md)

### 未完成

1. 仓库里还没有协作服务骨架。
2. 还没有 PostgreSQL 迁移、协作项目 schema、revision event 写入链路。
3. 还没有认证、项目列表、协作项目加载/保存 API 的运行时实现。
4. 桌面端还没有 `ProjectSource` / `WorkflowMode` 的正式运行时模型。
5. 审阅线程、建议修改、Presence、活动流都仍停留在文档层。
6. 部署包还没有真实镜像、升级策略与健康检查。
7. UI 重设计校对工作页（B 阶段核心编辑界面：左轨、工具栏、波形、语段时间轴、底栏）尚未开始。

## 2. 统一调整后的口径

### 继续保留

1. 保留“本地独立工作”为正式一等能力，而不是协作的降级模式。
2. 保留 zip 项目包，但只把它当交换/归档层。
3. 保留“转录模式 / 审阅模式”分离，而不是把批注直接塞进普通编辑视图。

### 暂缓

1. 暂缓继续细化部署包，直到协作服务镜像和运行时存在。
2. 暂缓大面积协作 UI 设计，直到服务端最小真源、API 和 revision 链路存在。
3. 暂缓 Word 审阅稿的深度实现，直到线程/建议修改数据真正落库。
4. 暂缓 CRDT、浏览器端完整编辑器和复杂权限系统。

### 先后顺序调整

正确顺序应为：

1. 冻结边界
2. 建协作服务最小真源
3. 接桌面端只读协作入口
4. 接协作写路径
5. 再做审阅、Presence、导出投影
6. 最后补离线恢复和部署包完善

## 3. 分阶段实施路线

### Phase 0：决策收口

目标：避免继续在“本地 vs 协作”“转录 vs 审阅”“项目包是否真源”上反复摇摆。

交付：
1. ADR-0002
2. 本执行计划

状态：已完成。

### Phase 1：协作服务基础骨架

目标：把协作架构从文档推进到可运行的最小真源。

建议交付：
1. 新建 `services/collab/`
2. 选定服务运行时与依赖管理方式
3. 加入配置加载、`/health`、基础日志
4. 接入 PostgreSQL
5. 建立首批迁移：
   - `projects`
   - `project_collaborators`
   - `media_assets`
   - `transcript_segments`
   - `revision_events`
6. 提供最小 API：
   - `GET /health`
   - `GET /v1/projects`
   - `POST /v1/projects`
   - `GET /v1/projects/:projectId`
   - `GET /v1/projects/:projectId/segments`

完成标准：
1. 本地可通过 Docker Compose 连起 PostgreSQL + 协作服务。
2. 首批迁移可重复执行。
3. API 可完成协作项目创建与只读加载。

### Phase 2：桌面端协作只读入口

目标：在不破坏本地项目路径的前提下，让桌面端能识别并打开协作项目。

建议交付：
1. 桌面端引入 `ProjectSource` 运行时模型
2. 项目列表区分 `local` / `collaborative`
3. 协作项目只读打开与语段渲染
4. 基础登录/连接配置入口

完成标准：
1. 本地项目与协作项目并存可见
2. 打开协作项目不会污染现有本地 SQLite 真源路径

### Phase 3：协作正文写路径与版本事件

目标：打通协作项目的最小可编辑链路。

建议交付：
1. 单语段编辑 API
2. `version` 乐观并发
3. `revision_events` 记录
4. 冲突 `409` 返回体与桌面端提示

完成标准：
1. 两个客户端可编辑同一项目
2. 冲突可检测、可提示、可恢复

### Phase 4：审阅线程与建议修改

目标：让“审阅模式”从概念变为实际能力。

建议交付：
1. `annotation_threads`
2. `annotation_comments`
3. `suggestion_edits`
4. 桌面端 `review` 模式切换
5. 转录模式隐藏批注标记，审阅模式显示

### Phase 5：Presence、进度与活动流

目标：满足“看到其他人的编辑进度和内容”。

建议交付：
1. Presence WebSocket 通道
2. 当前编辑语段、模式、光标范围同步
3. 协作者进度统计
4. 项目活动流

### Phase 6：Word 审阅导出

目标：把审阅结构化数据投影到交付物。

建议交付：
1. 干净稿 Word
2. 带批注稿 Word
3. 建议修改摘要附录

### Phase 7：离线缓存、恢复与部署包正式化

目标：补齐协作项目的工程化收尾。

建议交付：
1. 协作项目本地缓存与离线草稿恢复
2. 断线重连与冲突恢复
3. 协作服务镜像与版本号
4. 部署包升级、回滚、监控、自动备份

## 4. 当前最适合做的一步

### 结论

当前最适合做的是：**Phase 1，协作服务基础骨架**。

**替代选项评估**：
- **继续 UI 重设计（校对工作页）**：欢迎/建项页根部已完成，校对工作页（用户核心工作流）尚未开始。如果优先做 UI，1–2 轮薄片可完成校对工作页主路径，让 P0 交付物在视觉和交互上完整。但此工作不阻塞后续协作，可随时穿插。
- **P1  Polish（Playwright E2E、波形性能基准）**：可提升质量信心，但不扩展产品能力边界，建议作为协作骨架落地后的穿插项。

**推荐 Phase 1 的理由**：
1. P0 本地模式债务已清除（2026-05-24），核心 controller 已覆盖测试，本地路径稳定。这意味着协作扩展不会破坏既有基础，可以放心地在本地真源之上叠加协作层。
2. 它是所有后续协作工作的关键路径；Phase 2–7 全部依赖服务端真源存在。
3. 现有部署包、API 草案、桌面端协作入口都依赖它存在；否则继续停留在文档层。
4. 若继续细化部署文档，也会因为没有真实镜像与服务脚本而反复返工。
5. 技术选型（Python/FastAPI vs Rust/Axum）可在本轮薄片内一并敲定，团队已有 Python ASR 侧经验，FastAPI 可最快验证假设。

### 不建议当前优先做的事

1. 不优先做复杂协作 UI（Phase 4+ 的审阅线程、Presence 等）。
2. 不优先继续扩展部署包细节（需要真实服务镜像）。
3. 不优先做 Word 审阅稿深加工（需要线程/建议修改数据落库）。
4. 不优先做 Presence WebSocket（Phase 5）。
5. 不优先大面积重构本地状态层（本地路径已稳定，P0 刚验证全绿）。

## 5. 下一刀的精确落点

把下一轮工作限制成一个纵向薄片：

### Slice 1：协作服务最小骨架

范围：
1. 技术选型确认（Python/FastAPI 为推荐方向，理由见 §4）
2. 新建 `services/collab/`
3. 最小配置与启动脚本
4. PostgreSQL 连接（Docker Compose）
5. 初始迁移（`projects`、`project_collaborators`、`media_assets`、`transcript_segments`、`revision_events`）
6. `GET /health`
7. 协作项目创建/列表/详情/语段读取 API

暂不包含：
1. 评论线程
2. 建议修改
3. WebSocket Presence
4. Word 导出
5. 离线恢复
6. 认证/授权（最小原型阶段允许无认证或硬编码 token）

验收：
1. `docker compose` 可在本地起服务和数据库
2. 健康检查通过
3. 能创建一个协作项目并读回语段空列表
4. 迁移可重复执行（`down` + `up`）
5. 新文档与部署包占位不再只是“空镜像”，而是有真实服务目录可接
6. 硬闸门：若新增 Python 代码，需通过 Python lint + 架构守卫文件大小检查

## 6. 风险与防漂移提醒

1. 若在 Phase 1 前引入协作 UI，后面极易因 API 与状态模型变化而重写。
2. 若在 revision 事件未落地前先做审阅导出，后面会缺审计真源。
3. 若把本地项目也强行迁到服务端，会直接破坏 Rushi 当前最稳的离线价值。
4. 若把 `WorkflowMode` 混成项目属性而不是运行时状态，会让 UI 与统计逻辑变僵。
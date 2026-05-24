---
adr: "0002"
title: 本地独立与联机协作双轨、项目来源与工作模式分离
status: accepted
date: 2026-05-24
---

# ADR-0002：本地独立与联机协作双轨、项目来源与工作模式分离

## 上下文

Rushi 当前已具备稳定的本地桌面工作流：
- 本地 SQLite 作为项目真源
- 音频副本保存在应用数据目录
- 语段编辑、导出、项目包导入导出已打通

同时，产品方向已经明确扩展到：
- 本地独立工作与联机协作并存
- 协作中可见他人的在线状态、编辑位置、进度与最近内容
- 显式区分转录模式与审阅模式
- 审阅模式才显示批注、建议修改与审阅活动
- 继续保留 Word 友好导出与 zip 项目包交换

当前仓库已经形成以下草案：
- [../architecture/collaboration-storage-schema.md](../architecture/collaboration-storage-schema.md)
- [../architecture/collaboration-review-domain-api.md](../architecture/collaboration-review-domain-api.md)
- [../architecture/self-hosted-collab-deployment.md](../architecture/self-hosted-collab-deployment.md)
- [../execution/specs/collaboration-review-word-export.md](../execution/specs/collaboration-review-word-export.md)

缺口在于：
- 这些方向尚未由 ADR 固化，后续实现时容易反复改口径。
- 仓库内还没有协作服务骨架，部署包仍是“无镜像占位”。
- 若现在直接做协作 UI 或部署细化，会先于真源与契约落地，顺序错误。

## 决策

1. **项目来源与工作模式分离建模**

   Rushi 采用两条独立维度：

   - `ProjectSource`
     - `local`
     - `collaborative`
   - `WorkflowMode`
     - `transcription`
     - `review`

   二者语义不同，不允许互相替代。

2. **本地项目继续以 SQLite 为正式真源**

   对 `local` 项目：
- 桌面端 SQLite 仍为正式真源。
- 无登录、无网络条件下必须可完整完成转录、编辑与导出。
- 现有项目 CRUD、音频副本、导出与项目包能力继续保留。

3. **协作项目以服务端为正式真源**

   对 `collaborative` 项目：
- 服务端承担正式真源职责。
- PostgreSQL 承载结构化业务数据与版本事件。
- 文件系统或对象存储承载音频、导出文件与附件。
- 本地 SQLite 在协作项目中只承担缓存、离线草稿与恢复层职责，不承担唯一审计真源职责。

4. **审阅能力只在审阅模式显式暴露**

- `transcription` 模式聚焦正文、时间轴、ASR 与基础状态。
- `review` 模式才显示批注标记、评论线程、建议修改、协作者进度与活动流。
- 本地项目与协作项目都可以进入 `review` 模式，但只有协作项目要求实时同步与多人可见。

5. **项目包继续作为交换/归档层，不承担实时协作真源职责**

- zip 项目包保留为单项目迁移、交换与归档格式。
- 不将项目包提升为实时协作协议或持久协作真源。

6. **首期协作部署目标为用户自购服务器上的单节点中心化部署**

- 首期默认部署形态为单节点协作服务 + PostgreSQL + 文件存储 + HTTPS 反向代理。
- 不以 P2P、共享 SQLite、共享目录或 zip 同步作为首期协作方案。
- 重型 ASR 推理不并入首期协作服务器主职责。

## 后果

### 正面

- 明确保住本地独立工作能力，不因协作化而退化为“必须联网”。
- 协作项目获得统一真源、历史追踪、Presence 与审阅能力的落脚点。
- UI 暴露面与存储真源分离，避免把“模式”与“来源”混成一个字段。
- Word 导出、项目包导出、审阅轨迹都有更稳定的数据基础。

### 负面

- 系统将进入双轨：本地真源与协作真源需要长期并存。
- 桌面端需要承担本地项目与协作项目的双入口和双生命周期。
- 需要新增协作服务、数据库迁移、认证与实时同步链路。

### 直接约束

- 在协作服务最小 API 与迁移落地前，不继续扩张部署包复杂度。
- 在协作真源未落地前，不优先实现大面积协作 UI。
- 在 revision / thread / suggestion 数据链路落地前，不把“带批注 Word 导出”作为前置实现目标。

## 后续

- 执行顺序以 [../execution/plans/collaboration-foundation-plan.md](../execution/plans/collaboration-foundation-plan.md) 为准。
- 若未来改为 SaaS 托管优先、全文 CRDT 优先，或放弃本地真源优先级，必须新增 ADR 取代本记录。
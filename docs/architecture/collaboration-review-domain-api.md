# 本地独立、协作、批注、审阅与 Word 导出的领域模型与 API 草案

## 目标
定义联机协作场景下的领域对象、用户动作、冲突处理与 API 契约，使 Rushi 能支持：
- 本地独立工作与联机协作并存
- 多人协作编辑语段
- 针对语段/文本范围/时间范围的批注与回复
- 建议修改与接受/拒绝
- 完整编辑历史与活动流
- 易于转换为 Word 的干净稿、批注稿与建议修改摘要

同时引入两个显式工作模式：
- `transcription`：转录模式
- `review`：审阅模式

产品口径：
- 转录模式只显示正文与时间轴编辑相关信息，不显示批注标记。
- 审阅模式才显示批注线程、建议修改、批注标记与审阅活动。

## 一、领域模型

### 0. ProjectSource / WorkflowMode

`ProjectSource`：
- `local`
- `collaborative`

`WorkflowMode`：
- `transcription`
- `review`

说明：
- `ProjectSource` 决定项目真源在哪里。
- `WorkflowMode` 决定当前 UI 与协作能力暴露什么。

### 1. Project
协作单元。包含媒体、语段、协作者、审阅对象与导出任务。

关键属性：
- `id`
- `title`
- `projectSource`
- `primaryAudioAssetId`
- `latestRevisionSeq`
- `status`
- `collaborators[]`

### 2. TranscriptSegment
项目正文的最小编辑单元。不是自由流文本，而是带时间轴的结构化语段。

关键属性：
- `id`
- `ordinal`
- `startMs`
- `endMs`
- `speakerLabel`
- `text`
- `confidence`
- `workflowMode`
- `reviewStatus`
- `version`

说明：
- 多人协作默认以语段为单位处理冲突。
- 首期不做全项目全文级 CRDT。

### 3. AnnotationThread
批注线程。可挂在语段、字符区间或时间区间上。

关键属性：
- `id`
- `targetKind`
- `targetSegmentId`
- `targetTextAnchor`
- `targetTimeAnchor`
- `threadKind`
- `status`

### 4. AnnotationComment
线程下的评论消息。

关键属性：
- `id`
- `threadId`
- `author`
- `body`
- `mentions[]`
- `createdAt`

### 5. SuggestionEdit
建议修改对象，用于表达“把这一段改成这样”的审阅动作。

关键属性：
- `id`
- `targetSegmentId`
- `baseVersion`
- `beforeText`
- `suggestedText`
- `status`
- `decidedBy`
- `decisionNote`

### 6. RevisionEvent
审计与历史回放对象。

关键属性：
- `seq`
- `eventType`
- `entityKind`
- `entityId`
- `actor`
- `payload`
- `createdAt`

### 7. Presence
协作态对象，不要求长期持久化，但需低延迟同步。

关键属性：
- `userId`
- `clientId`
- `workflowMode`
- `selectedSegmentId`
- `editingSegmentId`
- `cursorRange`
- `progressSummary`
- `lastEditPreview`
- `lastSeenAt`

### 8. CollaboratorProgress
用于表达“协作时看到其他人的编辑进度和内容”。

关键属性：
- `userId`
- `workflowMode`
- `activeSegmentId`
- `lastEditPreview`
- `transcribedSegments`
- `reviewedSegments`
- `openThreadCount`
- `resolvedThreadCount`
- `updatedAt`

## 二、核心用户动作

### 模式切换
- 进入转录模式
- 进入审阅模式
- 在本地项目与协作项目之间切换入口

### 编辑语段
- 修改语段文本
- 修改起止时间
- 拆分语段
- 合并语段
- 调整语段顺序
- 更改审阅状态

### 批注审阅
- 在语段上发起评论线程
- 在文本子范围上发起问题/建议
- 回复评论
- 解决/重新打开线程
- 创建建议修改
- 接受/拒绝建议修改

说明：
- 以上动作只在审阅模式显示为主路径。
- 在转录模式下，既有审阅数据默认隐藏，仅保留与正文编辑直接相关的状态。

### 协作者可见性
- 查看谁在线
- 查看谁正在编辑哪一段
- 查看谁当前处于转录模式还是审阅模式
- 查看每位成员的转录/审阅进度
- 查看其他成员最近修改的内容摘要

### 历史追踪
- 查看项目活动流
- 查看某语段变更历史
- 按人过滤修改
- 按时间范围过滤修改

### 导出
- 导出干净稿 Word
- 导出带批注 Word
- 导出建议修改摘要 Word
- 导出项目包（zip）

## 三、模式口径

### 转录模式
目标：高吞吐地完成正文与时间轴整理。

显示：
- 波形、时间轴、正文、说话人、状态
- ASR、低置信提示、基础编辑进度

隐藏：
- 批注 marker
- 建议修改入口
- 评论线程边栏

### 审阅模式
目标：完成校对、讨论、建议修改、接受/拒绝与交付前审查。

显示：
- 批注 marker
- 评论线程
- 建议修改
- 活动流
- 协作者状态与进度

说明：
- 审阅模式不取消正文编辑能力，但 UI 重心从“快编辑”转向“可追踪审阅”。

## 四、并发与冲突口径

### 首期原则
- 服务端顺序化写入。
- 语段级乐观并发控制。
- 评论/建议修改 append-only。
- Presence/软锁只做提示，不做强事务锁。
- 协作者进度与最近编辑内容通过 Presence + Revision 双通道同步。

### 冲突规则
1. 若客户端提交语段编辑时 `baseVersion != currentVersion`：
   - 返回 `409 conflict`
   - 附带服务端当前语段、客户端提交版本、最近修改者信息
2. 若建议修改的 `baseVersion` 过旧：
   - 允许创建，但标记为 `superseded_candidate`
3. 评论线程即使目标文本位移，也尽量依赖 anchor 重定位；失败则标记 `orphaned`

## 五、API 草案

### REST：项目与语段

#### GET /v1/projects
返回当前用户可访问的项目列表。

#### POST /v1/projects
创建协作项目。

请求体示例：
```json
{
  "title": "近现代史课程 01",
  "sourceLanguage": "zh-CN"
}
```

#### GET /v1/projects/:projectId
返回项目概览、协作者、主音频、最新 revision。

返回体建议额外包含：
- `projectSource`
- `defaultWorkflowMode`
- `collaboratorProgress[]`

#### GET /v1/projects/:projectId/segments
返回当前语段投影。

查询参数建议：
- `workflowMode=transcription|review`
- `includeAnnotations=true|false`

规则：
- `workflowMode=transcription` 时默认 `includeAnnotations=false`
- `workflowMode=review` 时默认 `includeAnnotations=true`

#### PATCH /v1/projects/:projectId/segments/:segmentId
更新单个语段。

请求体示例：
```json
{
  "baseVersion": 12,
  "workflowMode": "transcription",
  "text": "修订后的正文",
  "reviewStatus": "in_review"
}
```

#### POST /v1/projects/:projectId/workflow-mode
切换当前客户端的工作模式。

请求体示例：
```json
{
  "workflowMode": "review"
}
```

#### GET /v1/projects/:projectId/collaborators/progress
返回所有协作者的当前进度、活动语段、最近修改摘要与在线状态。

#### POST /v1/projects/:projectId/segments/:segmentId/split
按给定时间或字符位置拆分语段。

#### POST /v1/projects/:projectId/segments/:segmentId/merge-next
与下一语段合并。

### REST：批注与建议修改

#### GET /v1/projects/:projectId/threads
支持按 `status`、`threadKind`、`targetSegmentId` 过滤。

调用约束建议：
- 转录模式默认不请求该接口
- 审阅模式进入时再加载或懒加载

#### POST /v1/projects/:projectId/threads
创建评论/问题/建议线程。

请求体示例：
```json
{
  "threadKind": "comment",
  "targetKind": "segment",
  "targetSegmentId": "seg_123",
  "body": "这里术语建议统一为“社会结构”"
}
```

调用约束建议：
- 仅允许在审阅模式下创建

#### POST /v1/projects/:projectId/threads/:threadId/comments
在线程下回复。

#### POST /v1/projects/:projectId/threads/:threadId/resolve
解决线程。

#### POST /v1/projects/:projectId/suggestions
创建建议修改。

请求体示例：
```json
{
  "targetSegmentId": "seg_123",
  "baseVersion": 12,
  "beforeText": "旧文本",
  "suggestedText": "建议文本",
  "comment": "这句更顺" 
}
```

调用约束建议：
- 仅允许在审阅模式下创建

#### POST /v1/projects/:projectId/suggestions/:suggestionId/accept
接受建议修改。

#### POST /v1/projects/:projectId/suggestions/:suggestionId/reject
拒绝建议修改。

### REST：历史与导出

#### GET /v1/projects/:projectId/revisions
按 `cursor` 或 `sinceSeq` 拉取项目事件流。

#### GET /v1/projects/:projectId/activity
返回适合 UI 展示的活动流。

#### POST /v1/projects/:projectId/export-jobs
创建导出任务。

请求体示例：
```json
{
  "exportKind": "docx_reviewed",
  "options": {
    "includeResolvedThreads": false,
    "includeSuggestionAppendix": true
  }
}
```

#### GET /v1/projects/:projectId/export-jobs/:jobId
查询导出任务状态与结果下载地址。

### WebSocket：实时协作

#### channel: project/:projectId/presence
广播当前在线协作者、工作模式、选中状态、编辑位置与进度。

事件示例：
```json
{
  "type": "presence.updated",
  "userId": "user_1",
  "workflowMode": "transcription",
  "selectedSegmentId": "seg_123",
  "editingSegmentId": "seg_123",
  "progressSummary": {
    "transcribedSegments": 120,
    "reviewedSegments": 48
  },
  "lastEditPreview": "修订后的最近一句正文"
}
```

#### channel: project/:projectId/revisions
广播新的 revision event。

事件示例：
```json
{
  "type": "revision.created",
  "seq": 204,
  "eventType": "segment_text_changed",
  "entityKind": "segment",
  "entityId": "seg_123",
  "payload": {
    "baseVersion": 12,
    "newVersion": 13
  }
}
```

建议：
- Presence 用于“谁在做什么、做到哪了”。
- Revisions 用于“具体改了什么内容”。

## 六、Word 导出投影设计

### 1. 干净稿（docx_clean）
面向正式交付。
- 只导出当前接受后的语段正文
- 可附时间戳、说话人、章节标题
- 不包含评论线程与 rejected suggestion
- 默认适用于转录模式或审阅完成后的交付

### 2. 批注稿（docx_reviewed）
面向审阅流转。
- 正文为当前语段投影
- 评论线程映射为 Word comments 或正文旁注
- unresolved 线程优先展示
- 若库能力有限，可退化为“正文 + 批注附录”
- 仅在审阅模式或显式导出审阅稿时提供

### 3. 建议修改摘要（docx_suggestion_summary）
面向编辑决策与校对交接。
- 逐条列出建议修改
- 包含提出人、时间、原文、建议文、状态、决定人
- 适合作为 Word 表格附录

## 七、客户端状态建议
桌面端建议分成四类状态：
- `serverProjection`：最近服务端确认状态
- `localDrafts`：尚未提交或等待 ACK 的修改
- `presenceState`：在线协作者光标/占用信息
- `reviewFilters`：评论/建议修改/活动流筛选

建议补充：
- `projectSourceState`：当前项目是本地还是协作
- `workflowModeState`：当前处于转录模式还是审阅模式
- `collaboratorProgressState`：每位成员的进度和最近编辑摘要

## 八、与当前本地模式的衔接
当前本地模式的对象可做如下映射：
- `ProjectDetail` -> 服务端 `Project + TranscriptSegment[]` 的桌面投影
- 本地 `edit_log` -> 服务端 `revision_events` 的粗粒度前身
- 项目包 zip -> 服务端项目的迁移/归档投影

并补充两条产品口径：
- 本地项目仍可使用“转录模式/审阅模式”切换，但审阅数据默认仅本地可见。
- 协作项目才要求实时看到其他人的编辑内容、位置和进度。

## 九、决策建议
- 不把 Word 文档当真源。
- 不把 zip 项目包当协作真源。
- 服务端数据模型优先围绕“语段、批注、建议、事件、Presence/进度”设计。
- 若后续需要浏览器协作端或外部审稿人，沿用同一套 API，而不是为 DOCX 再设计第二套模型。

# Spec(acceptance): Welcome 搜索 — 文件 vs 内容

> **Research brief**：[`welcome-search-research.md`](./welcome-search-research.md)  
> **Plan**：[`welcome-search-plan.md`](./welcome-search-plan.md)

## 自动门禁（每片 + 收官）

- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过（含 `welcomeSearch*.test.ts`、`welcome_search` Rust tests）
- [ ] `node scripts/check-architecture-guard.mjs` **0 error**
- [ ] `cargo test welcome_search`（或 workspace 内等价）通过

## 模式区分验收（硬要求）

| ID | 检查点 | 结果 |
|----|--------|------|
| **WS-MODE-1** | 顶栏存在 **「文件 \| 内容」** 分段切换；当前模式可见（`aria-pressed` / 视觉 active） | |
| **WS-MODE-2** | 「文件」模式 placeholder ≠ 「内容」模式 placeholder | |
| **WS-MODE-3** | 「文件」模式结果 **仅** 文件/项目行；**不出现** 语段 snippet | |
| **WS-MODE-4** | 「内容」模式结果 **仅** 语段正文命中；**不出现** 纯文件名行（无 snippet） | |
| **WS-MODE-5** | 切换模式后，结果列表立即按新模式重查（或清空待输入） | |
| **WS-MODE-6** | 刷新应用后记住上次模式（localStorage） | |

## 找文件（WS-1 + WS-2）

| ID | 步骤 | 预期 |
|----|------|------|
| **H-WS-F1** | 建 2 个项目，各 1 文件；文件模式搜 **文件名子串** | 命中对应文件；显示项目名 |
| **H-WS-F2** | 搜 **项目名** | 该项目下文件列出 |
| **H-WS-F3** | 在 Hub 填 **讲述人**；搜讲述人名 | 命中；副标签示「讲述人匹配」类文案 |
| **H-WS-F4** | 点击结果行 | 进入该项目 Hub；对应文件在列表可见 |
| **H-WS-F5** | 点击「打开」（若有）或等价动作 | 进入 Editor 打开该文件 |
| **H-WS-F6** | 空 query / 仅空格 | 不发起搜索或结果为空，无报错 |

## 找内容（WS-3 + WS-4）

| ID | 步骤 | 预期 |
|----|------|------|
| **H-WS-C1** | 两项目各含不同正文；内容模式搜 **共有子串** | 两条以上命中；含 snippet |
| **H-WS-C2** | 点击某命中 | 打开正确文件；语段选中；列表 scroll 到该行 |
| **H-WS-C3** | 命中后 Editor | 语段内命中区间 **可见高亮**（一次性，不打开 Find 面板） |
| **H-WS-C4** | 修改语段文字并保存；再搜新词 | 新词可命中，旧词按预期消失 |
| **H-WS-C5** | 删除含命中语段的文件 | 该命中不再出现 |

## 回归（勿破坏）

| ID | 路径 | 结果 |
|----|------|------|
| **H-WS-R1** | Editor Find/Replace | 单文件查找替换仍正常 |
| **H-WS-R2** | Welcome 最近文件 | 列表仍按更新时间展示 |
| **H-WS-R3** | Close Gate | 脏文件时从 Welcome 搜索跳入仍走拦截 |

## 能力—UI 状态矩阵

| UI | 状态维度 | 数据源 | 手测 |
|----|----------|--------|------|
| 搜索框 | 可编辑 vs 只读 | `WelcomeTopBar` | WS-MODE-1 |
| 模式切换 | file / content | `localStorage` + React state | WS-MODE-1/6 |
| 文件结果 | loading / empty / hits | `welcome_search_files` | H-WS-F* |
| 内容结果 | loading / empty / hits | `welcome_search_content` | H-WS-C* |
| Editor 高亮 | pending handoff 消费 | `pendingWelcomeContentHighlight` | H-WS-C3 |

矛盾场景（≥2）：

1. **无文件项目**：仅项目名匹配 — v1 若无 file 行则不展示；手测确认不 crash。
2. **转写 busy + 内容跳转**：应被 Close Gate 或 busy 禁用拦截，不半开文件。

## 签收

- [x] Research / intent / plan / acceptance 四件套链接闭环
- [ ] Phase WS-1～WS-5 编码完成
- [ ] H-WS-F* / H-WS-C* / WS-MODE-* 手测
- [ ] 路线图 §10.4 Welcome 搜索更新 ✅

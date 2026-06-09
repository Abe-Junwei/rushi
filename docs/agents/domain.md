# Agent：领域文档消费规则

## 布局（单上下文）

```
/
├── CONTEXT.md          ← 领域词汇表（glossary only）
├── docs/
│   ├── architecture/   ← 数据流、模块边界、手测矩阵
│   ├── adr/            ← 架构决策
│   └── execution/specs/ ← 功能 spec 三件套 + research brief
```

无 `CONTEXT-MAP.md`；Rushi 为单上下文 monorepo。

## 读取顺序

1. **`CONTEXT.md`** — 解码术语；命名测试、变量、对话时与此一致
2. **`docs/architecture/`** — 实现边界与真源路径
3. **`docs/adr/`** — 勿 re-litigate 已有决策
4. **`docs/execution/specs/*-research.md`** — 编码前门禁（中等及以上复杂度）

## 写入规则

| 产物 | 何时写 | 写什么 |
|------|--------|--------|
| `CONTEXT.md` | `/grill-with-docs` 或架构 review 中术语落定 | 术语定义 + `_Avoid_`；**不写**实现细节 |
| `docs/adr/` | 难逆转 + 令人意外 + 有真实 trade-off | 决策与备选 |
| `*-research.md` | 新功能/薄片编码前 | 业内对照 + 不做什么 |
| `docs/architecture/` | 新模块/新数据流稳定后 | 链路与文件路径 |

## 与 Jieyu  sibling 仓库

架构对齐说明可能引用 `Jieyu/docs/`。**冲突时以 Rushi 代码与本仓 ADR 为准**（见 `AGENTS.md`）。

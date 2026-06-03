# 调研：中文文本编辑追踪的 diff 算法与意图推断

> **状态**：spike 中
> **关联路线图**：learnedit 纠错记忆功能
> **关联 spec**：待链接
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户在转写文本中选中一个词进行修改（如"学关"→"觉观"），系统需要准确学习这对纠错关系，而不吞入上下文 |
| 本仓现状 | `apps/desktop/src/services/learnEditDelta.ts` 中的 `expandLearnOpToReplay` 用"能否从 baseline 重建 live text"作为扩展条件，导致过度扩展。例：baseline "我们学关到了之后，" / live "我们觉观到了之后，"，tracked `{anchor:2, removed:"学", inserted:"觉观"}` 被错误扩展为 `{removed:"学关到了之后", inserted:"觉观到了之后"}` |
| 成功标准 | 对任何中/英文本替换，系统推断的 removed/inserted 范围**不多于**用户实际修改的范围；已 tracking 的 65 个测试不 regress |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **标准 Diff + 语义清理** | Google diff-match-patch、Git Myers diff、Monaco Editor | Myer's O(ND) 找最长公共子序列(LCS)，生成最小编辑脚本；`cleanupSemantic` 将相邻 delete+insert 合并为 semantic replace | [diff-match-patch](https://github.com/google/diff-match-patch) |
| B | **词边界感知 Diff** | HanLP + DiffUtils、ElasticSearch ik_smart | 先用中文分词器切分词序列，再在词粒度做 diff；替换=词粒度 delete+insert | [Java DiffUtils + HanLP 实践](https://blog.csdn.net/weixin_45444673/article/details/139835444) |
| C | **Composition-aware 意图追踪** | CKEditor 5、Google Docs (OT) | 监听 `compositionstart/update/end` + `beforeinput` 事件序列，在 composition 结束或 beforeinput 完成时**直接捕获**用户的替换意图，不做后验 diff | [CKEditor 5 IME rewrite](https://ckeditor.com/blog/ckeditor-5-v35.3.0-with-a-revamped-typing-and-ime-handling/) |
| D | **语义边界启发式** | diff-match-patch cleanupSemantic | 定义"不应被替换"的上下文（标点、虚词、助词），在 diff 合并时以这些边界为 hard stop | diff-match-patch `diff_cleanupSemantic` 源码 |

### 2.1 路线 A 详细分析

**diff-match-patch** 的 `diff_main(baseline, live)` 返回一个 diff 数组：
```
[EQUAL "我们"] [DELETE "学关"] [INSERT "觉观"] [EQUAL "到了之后，"]
```

`cleanupSemantic` 会将相邻的 DELETE+INSERT 合并为语义上的"替换"。合并条件基于编辑距离和共同前缀/后缀的长度。

**与当前方案的对比：**
- 当前方案：从 tracked op 出发，**向外扩展**检查"能否重建 live text" → 任何共享 suffix 都会导致过度扩展
- diff-match-patch：从两个完整字符串出发，**向内收敛**找 LCS → 天然得到最小区间

**关键洞察**：`expandLearnOpToReplay` 的根本缺陷是**逆向问题**——它用"后验可重建性"推断"用户意图范围"。而标准 diff 直接比较两个状态，不受 suffix 巧合匹配的影响。

### 2.2 路线 B 详细分析

中文没有空格分词，字粒度 diff 会产生大量碎片（如"学关"可能被拆为"学"+"关"的独立操作）。词粒度 diff 可以避免这个问题。

**jieba / HanLP / ik_smart** 的缺陷：
- 需要引入外部依赖（Python/Java 库）
- 分词有歧义，"学关"可能不是一个有效词
- 性能开销大，不适合实时编辑追踪

**轻量替代**：不用完整分词器，而是用**启发式词边界检测**：
- 硬边界：标点、数字、英文字母、空格
- 软边界：常见虚词/助词（的、了、是、在、和、到、之后、...）
- 实现简单，零依赖

### 2.3 路线 C 详细分析

CKEditor 5 的核心架构：
1. 所有用户输入通过 `beforeinput` 拦截
2. 转换为自定义 model operation（insert/delete/replace）
3. 不直接操作 DOM，而是通过 virtual DOM 渲染
4. IME composition 期间暂停渲染，composition end 时一次性应用 operation

**对 Rushi 的启示**：
- 我们的 `beforeinput` handler 已经捕获了用户的原始意图（anchor、removed、inserted）
- 问题出在后续的"扩展"步骤，而不是"捕获"步骤
- 如果能在 beforeinput 时就**确定完整的替换范围**，就不需要后验扩展

但 `beforeinput` 提供的 `getTargetRanges()` 在跨浏览器中并不总是可靠，且 IME composition 期间 range 会变化。

### 2.4 路线 D 详细分析

`cleanupSemantic` 的启发式规则：
- 如果 DELETE 和 INSERT 之间有 EQUAL 片段且长度超过某个阈值，不合并
- 如果合并后的替换包含明显的"边界字符"（如标点），在边界处截断

对中文的扩展：将"的、了、吗、呢、吧、之后、以前、因为、所以"等高频虚词/助词/连词作为 soft boundary。diff 合并时如果会跨过这些词，优先不跨。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A | **高** | `diff-match-patch` npm 包（~50KB，无依赖）的 `diff_main` + `cleanupSemantic` | 无冲突 | 性能 O(ND)，但编辑窗口通常 <200 chars，<1ms |
| B | 低 | 思路可借鉴，但完整分词器不引入 | 依赖太重；分词歧义 | 实时性能不达标 |
| C | 中 | IME 事件监听思路可借鉴；但 Rushi 不是富文本编辑器，不需要完整 OT model | 架构差异大 | 改造成本高 |
| D | 高 | cleanupSemantic 的源码逻辑可直接移植/改编；中文虚词列表可自建 | 无冲突 | 零额外依赖 |

**本仓已有可复用模块**：

- `apps/desktop/src/services/learnEditDelta.ts` — 现有状态机和坐标映射可保留，只需替换 `expandLearnOpToReplay`
- `apps/desktop/src/services/correctionInferPair.ts` — 已有的噪声过滤和 pair 归一化逻辑不变
- `apps/desktop/src/services/learnEditEdgeCases.test.ts` — 测试框架和用例可直接复用

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **路线 A 为主 + 路线 D 为辅**：用 `diff-match-patch` 的 `diff_main` 计算 baseline↔live 的字符级差异，以 tracked op 的 `anchor` 为锚点定位 diff 中的对应编辑区域，将相邻 DELETE+INSERT 合并为替换。辅以中文语义边界（标点、虚词）作为 hard stop，防止跨过语义边界。 |
| **不做什么** | ① 不引入外部中文分词库（路线 B 太重） ② 不重构为完整 OT/CRDT model（路线 C 过度设计） ③ 不删除现有 beforeinput 状态机（只需替换扩展逻辑） ④ 不改动 Rust 后端的 pair 存储格式（只改前端推断逻辑） |
| **与 ADR / architecture 关系** | 与 `docs/architecture/desktop-capability-ui-state-alignment.md` 对齐：能力-UI 状态矩阵中，learnedit 的"推断精度"列从此前的"启发式扩展"升级为"diff-anchored 语义推断" |
| **风险与 spike 项** | ① `diff-match-patch` 不是 grapheme-aware（多码点 emoji/罕见汉字可能错位）→ 需要 wrapper 将字符串转换为 grapheme 数组再 diff ② 多个不连续编辑时 anchor 定位歧义 → 限制 diff 窗口为 anchor ±100 graphemes ③ Rust 后端 `correction.rs` 需同步更新 → 引入 `similar` crate 或手写简化 diff |

### 4.1 新架构核心设计：Diff-Anchored Replacement Detection

```
输入: baseline, live, trackedOp {anchor, removed, inserted}
输出: inferredOp {anchor, removed, inserted}

1. 窗口截取：取 baseline[anchor-W..anchor+W] 和 live[anchor'-W..anchor'+W]
   其中 anchor' = baselineIndexToLiveIndex(anchor, finalizedOps)
   W = 100 graphemes（足够覆盖绝大多数替换场景）

2. 计算 diff：diff_main(windowBaseline, windowLive) → diff[]

3. 定位锚点：在 diff 中找到 trackedOp.anchor 对应的位置
   （考虑 finalizedOps 的坐标映射）

4. 合并替换：
   a. 找包含锚点的 DELETE + INSERT 对
   b. 检查合并后的范围是否跨过了语义边界（标点、虚词）
   c. 如果跨过，在边界处截断
   d. 返回 {anchor, removed: deleteText, inserted: insertText}

5. 回退：如果 diff 结果异常（无 DELETE/INSERT 在锚点附近），
   回退到原始的 trackedOp（不扩展）
```

**为什么能解决 "学关→觉观" 问题：**
- diff("我们学关到了之后，", "我们觉观到了之后，") = 
  `[EQUAL"我们", DELETE"学关", INSERT"觉观", EQUAL"到了之后，"]`
- 锚点在 DELETE 起始位置 → 合并 DELETE+INSERT → removed="学关", inserted="觉观"
- "到了之后" 是 EQUAL 片段，不会被吞入替换范围

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| TS Service | `apps/desktop/src/services/learnEditDelta.ts` | 重写 `expandLearnOpToReplay`；新增 `graphemeDiff` wrapper；新增语义边界检查 |
| TS Service | `apps/desktop/src/services/learnEditEdgeCases.test.ts` | 新增 diff-anchor 相关测试用例 |
| TS Util | `apps/desktop/src/services/diffMatchPatch.ts`（新文件） | 封装 `diff-match-patch` 的 grapheme-aware wrapper |
| package.json | `apps/desktop/package.json` | 新增依赖 `diff-match-patch` |
| Rust | `services/asr/src/correction.rs` | 同步更新：引入 `similar` crate 或手写简化 Myers diff，替换现有的扩展逻辑 |

---

## 6. 签收

- [x] 调研 brief 完成
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-03 | 初版：调研 diff-match-patch、CKEditor 5 IME、中文分词辅助 diff 三条路线，选定 Diff-Anchored + 语义边界方案 |

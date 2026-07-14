# 验收：语段筛选全链路修复

> **调研**：[`transcript-editor-core-remediation-research.md`](./transcript-editor-core-remediation-research.md)  
> **计划**：[`segment-filter-chain-remediation-plan.md`](./segment-filter-chain-remediation-plan.md)  
> **状态**：机器门禁 ✅；手测待签收

---

## A. 行为

| ID | 条件 | 期望 |
|----|------|------|
| F-1 | 筛选生效 | 仅匹配行可见；doc.lines === segment count |
| F-2 | merge/split/delete 后 | 无旧索引短暂错藏；同 TX 重算可见性 |
| F-3 | 文本编辑（筛选态） | 不整表重扫隐藏；decoration 按 runs 映射 |
| F-4 | hidden primary | banner + 波形视觉 chrome；不可拖/右键/lasso/段操作 |
| F-5 | 冻结 + 筛选 | 条纹保留；scoped play 可用；非 primary 多选有弱 callout |
| F-6 | reveal | 无双 reveal 回跳；后来的 reveal 取消旧任务；用户滚动不被覆盖 |
| F-7 | 清筛选 | 行/band/交互立即恢复 |

## B. 性能

| ID | 场景 | 期望 |
|----|------|------|
| P-1 | 10k waveform hit-test | 无超线性比较；本机 ≤10ms/次（记录基线） |
| P-2 | 10k 单选 decoration | O(k) 重建 |
| P-3 | 3k–10k 筛选态单字符 | 同步路径目标 <16ms（本机记录） |

## C. 门禁

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

## D. 手测

见 [`transcript-editor-core-handtest-checklist.md`](./transcript-editor-core-handtest-checklist.md) 本轮追加项；真实 ~3686 段文件 + 10k fixture。

## E. 结果记录

| 项 | 结果 |
|----|------|
| 定向 Vitest | ✅ filter / visibility / reveal / lasso / bounds（2026-07-14） |
| 10k hit 基线→修复 | ✅ `waveformHitTestScale.perf.ts` 过本机 ≤12ms / CI ≤40ms；O(n) 无 findIndex |
| 门禁 | ✅ `typecheck` + `test` + `lint --quiet` + architecture-guard（2026-07-14） |
| 手测 | ⏳ 见 handtest §筛选全链路；机器侧已绿，待用户对 ~3686 段文件签收 |

### 三行日志

- **改动**：共享筛选投影 + 结构同 TX 可见性；波形 O(n) hit；O(k) selection/frozen deco；单一可取消 reveal；波形 visibleIndexSet 契约。
- **验证**：定向单测 + 10k hit perf + 全量 Vitest + typecheck + lint + architecture-guard。
- **下一轮**：真实工程手测签收（筛选冻结→滚动→输入→多选→波形 lasso/拖边界→结构操作）。

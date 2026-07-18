# 吸收记录：第二阶段路线图外部技术评估（2026-07-18）

> **状态**：**已归档基线**（终审绿灯 2026-07-18；写入 Phase 2 §8.1–§8.2）  
> **来源**：产品侧对 [`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md) 的工程评估（三轮：架构吸收 + 编码前微调 + 可行性深度调研）  
> **落点索引**：见下文「已写入何处」

---

## 1. 评估共识（保持不变）

| 结论 | 处置 |
|------|------|
| Source/Working 双轨锁死母带风险 | 已是 Wave M 核心；加强 |
| Wave 级签收、勿 Phase2 大包 | 保持 |
| 拒全文 CRDT / Descript 删字即剪 | 保持非目标 |
| 语段级乐观锁 + Review | 保持 ADR-0002 / foundation |

---

## 2. 新采纳决策（相对原 Phase 2 文档的增量）

### 2.1 媒体时间轴：区间映射（Interval Mapping）

- **采纳**：语段持久化时间为 **Source 绝对时间**；Working↔Source 用轻量映射表，避免 Ripple 后批量改语段行。  
- **真源文档**：[`media-timeline-interval-mapping.md`](../../architecture/media-timeline-interval-mapping.md)  
- **修正原口径**：不再把「有语段则只能提示重转」当作唯一策略；**映射优先**，重转为可选。

### 2.2 `media_dirty` 标志

- Trim/Ripple/Split 成功后置 `media_dirty=true`；UI 提示时间轴以新 Working 为准。  
- 挂 EDIT-BASIC-1/2 acceptance。

### 2.3 实体 ID：协作前切 ULID（双库 TEXT）

- **现状风险**：本地 `segments.id` 仍为 `INTEGER PRIMARY KEY AUTOINCREMENT`（另有 `uid` 文本字段）。推协作时自增 ID 碰撞。  
- **采纳**：Phase 2 **M0 / ID-STABLE**——对外 ID 统一 **ULID 字符串**（优先于带连字符的 UUIDv4 字面量，便于定长 26）。  
- **存储**：**SQLite 与 PostgreSQL 均 `TEXT`/`VARCHAR(26)`**；**禁止** PG 原生 `UUID` 类型。  
- **必须先于** R8；建议不晚于 AV-PRE-1 收尾。

### 2.4 409 冲突：本地冲突草稿空间（含 React 19）

- 收到 409 **不得**静默覆盖输入框；弹窗二选一（强制覆盖 / 采纳服务器）；未决前草稿进内存或 SQLite 影子表。  
- **React 19**：若用 Form Actions / `useActionState`，409 时须把失败 payload 放入 `errorState` 或 Zustand，**阻止 Action rollback 清空输入**（Phase 2 §8.2 **C-409**）。  
- 挂 R8 + C7 acceptance。

### 2.5 Presence：TTL 心跳

- 客户端 3–5s ping；服务端 >10s 剔除并广播。  
- 挂 C5 acceptance（与 tech-stack research 一致，写死数值建议）。

### 2.6 长音频播放：Proxy，而非全量 Web AudioBuffer

- **澄清**：本仓波形主路径已是 **peaks 文件 + 原生播放**，**禁止**把 2h 全量读入 Web Audio `AudioBuffer`。  
- **采纳**：AV-PRE-5 Proxy（低码率）供 scrub/弱机听音；peaks 保持抽样二进制，按需加载。评估文中「Web Audio 实时听音」降级为可选，**不**替代现引擎。

### 2.7 LAN：Caddy `tls internal` + 根证书分发

- **采纳**为 COL-DEPLOY-B 主路径；可选对 RFC1918 降级接受自签（调试后门）。  
- **Rust 层**：降级开关必须配置 `reqwest` / Tauri http 客户端（§8.2 **LAN-RUST**），非仅前端 `fetch`。  
- 写入双部署 plan + `deploy/self-hosted-collab` 说明。

### 2.8 终审结论

- **绿灯通过，正式归档为 Phase 2 执行基线。**  
- 后续研发：纵向薄片 + 严格遵守 [`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md) §8.1–§8.2。

### 2.9 可行性深度调研吸收（2026-07-18 第三轮）

> 来源：Phase 2 系统架构与技术选型可行性深度调研（ULID / 波形 OOM / React 19 Form / LAN TLS / ASR 调度）。

| 主张 | 裁决 | 落点 |
|------|------|------|
| M0 ULID TEXT + 禁 PG UUID | **已对齐**；维持 M0→R8 硬门；不禁止 R6∥M | Phase 2 §5 / §8.2 ID-TEXT |
| Wave M∥C 全局串行 | **不采纳**；仅 R8 卡 M0 | Phase 2 §4 |
| M8 与 M1/M2 合并为退出硬片 | **部分采纳**：M2 后 / 3h+ 手测前**必须穿插**；仍不挡 Wave M 退出 | Phase 2 §5 M8 |
| audiowaveform JSON + MediaElement 新真源 | **不采纳另造真源**；沿用 peaks `.dat` + 原生播放；禁 2h AudioBuffer | Phase 2 §8.1 · AV-PRE-5 |
| React 19 Action×409 payload 回显 | **已对齐** | §8.2 C-409 |
| 受控 `<select>` reset 竞态 | **新采纳** → **C-SELECT**（稳定业务 key 重挂载；禁 `Date.now()` 每渲染） | §8.2 C-SELECT |
| Caddy Local-CA + Rust RFC1918 | **已对齐**；D4 冒烟加分、**不替代** D3 | §5 D3/D4 · LAN-RUST |
| Wave C 前 FunASR→Whisper.cpp | **拒作硬门**；Nice/进程树可杀 → **ASR-SCHED** 挂现有 supervisor/LRC | §8.2 ASR-SCHED |

---

## 3. 已写入何处

| 内容 | 路径 |
|------|------|
| 区间映射契约 | [`media-timeline-interval-mapping.md`](../../architecture/media-timeline-interval-mapping.md) |
| Phase 2 薄片 / §8.1–§8.2 | [`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md)（**已归档基线**） |
| 栈与坑补充 | [`phase-1-2-tech-stack-paths-research.md`](./phase-1-2-tech-stack-paths-research.md) |
| 媒体 plan | [`av-preprocess-edit-basic-plan.md`](./av-preprocess-edit-basic-plan.md) |
| LAN Local-CA | [`collab-dual-deploy-local-asr-plan.md`](./collab-dual-deploy-local-asr-plan.md) · [`deploy/self-hosted-collab/README.md`](../../../deploy/self-hosted-collab/README.md) |
| 架构索引 | [`docs/architecture/README.md`](../../architecture/README.md) |

---

## 4. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版吸收记录 |
| 2026-07-18 | 终审：§8.2 C-409 / ID-TEXT / LAN-RUST；基线归档 |
| 2026-07-18 | §2.9 可行性深度调研：采纳 C-SELECT / ASR-SCHED / M8 穿插；拒引擎换栈硬门与 JSON 波形另造 |

# 调研：协作双部署画像（云自建 + 局域网）· 本机 ASR 不上云

> **状态**：已采纳（规划门禁完成；编码未启动）  
> **关联路线图**：[`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md) · [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §6 · **COL-DEPLOY**  
> **关联 plan**：[`collab-dual-deploy-local-asr-plan.md`](./collab-dual-deploy-local-asr-plan.md)  
> **关联既有**：[`ADR-0002`](../../adr/0002-local-collab-dual-source-review-mode.md) · [`collaboration-foundation-plan.md`](../plans/collaboration-foundation-plan.md) · [`self-hosted-collab-deployment.md`](../../architecture/self-hosted-collab-deployment.md)  
> **门禁**：未完成本文不得进入业务编码；本文完成后可进入 plan 定稿与后续薄片拆分（见 `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 小团队要多人编辑/审阅同一转录项目；**ASR 必须本机跑、不上云**；同时需要两种可达性：**公有云/自购 VPS** 与 **局域网/内网** |
| 本仓现状 | 本地 SQLite + 本机 FunASR 侧车已稳；协作仅有 schema/API/部署**草案**（无 `services/collab`）；部署包 `deploy/self-hosted-collab/` 为占位镜像；ADR-0002 已定双轨真源与单节点中心化，但未显式拆「云 / LAN」两套运维画像 |
| 成功标准 | 同一套 Collab 服务 + 同一桌面契约，可用 **DeployProfile=`cloud_vps` \| `lan`** 分别验收；任一人本机转写后语段同步可见；**无云端 ASR 进程** |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | 自建中心化协作 + 客户端重计算 | Nextcloud / Immich / 自建 GitLab：服务端存真源，重活在客户端或独立 worker | 单节点或小集群 + 客户端连 API；媒体对象存储可选 | [Nextcloud](https://nextcloud.com/) · 本仓 [`self-hosted-collab-deployment.md`](../../architecture/self-hosted-collab-deployment.md) |
| B | 内网优先 / 零信任叠加 | Tailscale / Headscale / ZeroTier 把多站点收成「虚拟 LAN」，仍跑中心化服务 | 不改应用协议，只改网络可达性 | [Tailscale](https://tailscale.com/) · 本仓部署文已列「组网后内网访问」 |
| C | 云托管 SaaS 转写协作 | Descript / Otter：云 ASR + 云项目 | 音频与推理均上云 | 作对照；**与本需求冲突**（ASR 不上云） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 自建中心化 | **高** | ADR-0002 真源分层、PG schema、REST/WS API、Compose 骨架 | 无（正是既定方向） | 协作节点轻（无 ASR）；本机承担峰值内存 |
| B 虚拟/物理 LAN | **高** | 同一 Compose；仅绑定地址、TLS、发现方式不同 | 禁止把「共享盘/SQLite」当真源 | LAN 无公网流量费；需备份与固定主机 |
| C 云 ASR SaaS | **低** | UX 上的「项目在线」可参考 | **ASR 不上云**硬约束；v1 非目标「转写 farm」 | 不采纳为本轨 |

**本仓已有可复用模块**（扩展，不第二套真源）：

- 领域契约：[`collaboration-storage-schema.md`](../../architecture/collaboration-storage-schema.md)、[`collaboration-review-domain-api.md`](../../architecture/collaboration-review-domain-api.md)
- 部署骨架：[`deploy/self-hosted-collab/`](../../../deploy/self-hosted-collab/)
- 本机 ASR：FunASR 侧车 / LRC（R3h）；转写写语段后由桌面推送到 Collab（后续接线）
- 本地真源：SQLite 项目路径（`local`）保持不变
- 交换层：zip 项目包（非实时协议）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **一套 Collab 运行时 + 两套 DeployProfile**：`cloud_vps`（公网/HTTPS/可选 OSS）与 `lan`（内网 HTTP(S)/本机磁盘）；**ASR 仅桌面本机** |
| 不做什么 | 云端 ASR / 转写 farm；P2P；共享 SQLite/共享目录当真源；全文 CRDT；浏览器完整编辑器；把重型推理塞进协作小节点 |
| 与 ADR / architecture 关系 | **细化** ADR-0002「单节点中心化自建」，不取代；云与 LAN 都是该决策的部署画像，不是新真源模型 |
| 风险与 spike 项 | （1）本机 ASR 与「母带少落盘」张力 → 规定转写工作集可本地缓存；（2）LAN 服务发现与 IP 漂移 → 首期手动填 Base URL + 可选 mDNS spike；（3）OSS 与 filesystem 双后端 → 接口抽象，首期 filesystem 必达、OSS 为 `cloud_vps` 可选 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 架构文档 | `docs/architecture/collab-deployment-profiles.md`（新建） | 双画像真源说明 |
| 部署包 | `deploy/self-hosted-collab/` + 可选 `deploy/lan-collab/` 或同目录 profile 覆盖 | Compose / `.env` 画像 |
| 服务 | 待建 `services/collab/` | 与画像无关的核心；存储后端可插拔 |
| 桌面 | 连接配置、`ProjectSource=collaborative`、转写后上传语段/媒体 | 设置项区分画像预设 |
| Python ASR | **不改职责**；仍本机 | 禁止迁入 collab 镜像 |
| 测试 | Compose 烟测；桌面双入口；冲突 409 | R6+ 薄片内 |

---

## 6. 签收

- [x] 调研 brief 完成（2026-07-18）
- [x] plan 已链接本文
- [ ] 产品书面启动协作编码前再勾：路线图确认可进入 R6

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版：双部署画像 + 本机 ASR 硬约束 |

# 协作部署画像：cloud_vps 与 lan

> **地位**：部署/运维画像说明（非 API 契约）。领域真源仍见 [`collaboration-storage-schema.md`](./collaboration-storage-schema.md) 与 [`collaboration-review-domain-api.md`](./collaboration-review-domain-api.md)。  
> **决策**：[`ADR-0002`](../adr/0002-local-collab-dual-source-review-mode.md) 单节点中心化；本文件将其拆成两种运维画像。  
> **详细方案**：[`collab-dual-deploy-local-asr-plan.md`](../execution/specs/collab-dual-deploy-local-asr-plan.md) · 调研 [`collab-dual-deploy-local-asr-research.md`](../execution/specs/collab-dual-deploy-local-asr-research.md)  
> **阶段排期**：[`rushi-phase-2-roadmap.md`](../execution/plans/rushi-phase-2-roadmap.md) Wave C/D

## 硬约束（两画像共用）

1. **ASR 仅桌面本机**（FunASR/LRC 侧车）；协作节点不跑转写推理。
2. **中心化单节点**：Collab App + PostgreSQL + 文件存储；禁止 P2P / 共享 SQLite 当真源。
3. **一套服务二进制/镜像**；画像只影响网络、TLS、存储后端与桌面连接预设。

## 画像对照

| 项 | `cloud_vps` | `lan` |
|----|-------------|-------|
| 宿主 | 公有云轻量 / 自购 VPS | 局域网主机 / NAS Docker |
| 入口 | HTTPS 域名（Caddy） | 内网 IP 或内网域名；可选 Tailscale |
| 存储 | filesystem 和/或 OSS | filesystem（大硬盘） |
| 典型规格 | 2C4G 起，盘或 OSS 扩音频 | 2C4G + 大容量本地盘 |
| 桌面预设 | 「云服务器」 | 「局域网」 |
| 流量成本 | 注意公网下行；推 proxy/流式 | 通常可忽略 |
| 部署目录 | [`deploy/self-hosted-collab/`](../../deploy/self-hosted-collab/) | 同目录 + lan 覆盖（实施期） |

## 数据流（本机 ASR）

```
本机音频工作集 → 本机 ASR → 语段推送 Collab
                      ↘ 可选：source_audio / proxy_audio 上传文件存储
他机 ← 拉语段 / 流式或缓存听音 ← Collab
```

正式媒体真源在协作存储；本机可为转写与离线保留缓存，不充当多人审计真源。

## 与本地项目关系

| `ProjectSource` | 真源 | 是否需要 Collab |
|-----------------|------|-----------------|
| `local` | 桌面 SQLite | 否 |
| `collaborative` | 服务器 PG + 文件 | 是（云或 LAN 任一画像） |

## 相关文档

- 云侧重步骤：[`self-hosted-collab-deployment.md`](./self-hosted-collab-deployment.md)
- 执行顺序：[`collaboration-foundation-plan.md`](../execution/plans/collaboration-foundation-plan.md)

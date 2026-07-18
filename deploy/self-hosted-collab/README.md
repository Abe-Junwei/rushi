# Rushi 自购协作服务器部署包（单节点草案）

## 目标
本目录提供一套面向“用户自购云服务器 / VPS”的单节点协作部署草案。

它适用于：
- 小团队协作
- 学校/研究组
- 编辑部
- 工作室

**画像说明**：此包默认对齐 **`cloud_vps`**。局域网 **`lan`** 与「本机 ASR、协作节点不跑转写」见仓库文档  
[`docs/architecture/collab-deployment-profiles.md`](../../docs/architecture/collab-deployment-profiles.md) ·  
[`docs/execution/specs/collab-dual-deploy-local-asr-plan.md`](../../docs/execution/specs/collab-dual-deploy-local-asr-plan.md)。  
实施期将在本目录增加 `.env.lan` / Compose 覆盖，而非另起第二套业务服务。

当前状态：
- 这是部署骨架，不代表仓库里已经包含可运行的协作服务镜像。
- `RUSHI_COLLAB_IMAGE` 仍是占位值，待协作服务实现后替换成真实镜像，或改为本地构建。

## 目录
- `.env.example`：环境变量样例
- `docker-compose.example.yml`：单节点 Compose 草案
- `caddy/Caddyfile.example`：HTTPS 反向代理模板
- `scripts/backup.sh`：数据库、文件目录、配置备份脚本草案

## 组件
1. `rushi-collab`
2. `postgres`
3. `caddy`

职责边界：
- `rushi-collab` 负责 HTTP API、WebSocket、Presence、历史记录、导出任务编排
- `postgres` 负责协作真源数据
- `caddy` 负责 HTTPS 和反向代理

文件存储策略：
- 首期默认使用本地文件系统目录 `/var/lib/rushi/files`
- 不强制要求 MinIO 或 S3

## 快速开始
1. 复制环境变量模板

```bash
cd deploy/self-hosted-collab
cp .env.example .env
```

2. 编辑 `.env`

至少替换：
- `RUSHI_COLLAB_IMAGE`
- `RUSHI_COLLAB_DOMAIN`
- `POSTGRES_PASSWORD`
- `RUSHI_JWT_SECRET`
- `RUSHI_SESSION_SECRET`

3. 启动服务

```bash
docker compose --env-file .env -f docker-compose.example.yml up -d
```

4. 查看服务状态

```bash
docker compose --env-file .env -f docker-compose.example.yml ps
docker compose --env-file .env -f docker-compose.example.yml logs -f
```

## 推荐部署口径
- 首期只暴露 `443`
- PostgreSQL 不直接暴露公网
- 使用邀请码或管理员创建账号，不默认开放注册
- ASR 不建议首期部署在这台协作服务器上

## 备份
运行备份脚本：

```bash
cd deploy/self-hosted-collab
bash scripts/backup.sh
```

备份内容：
- PostgreSQL dump
- `/var/lib/rushi/files` 文件目录
- `.env`
- `caddy/Caddyfile.example`

默认输出目录：
- `deploy/self-hosted-collab/backups/<timestamp>/`

可通过 `.env` 中的 `RUSHI_BACKUP_DIR` 覆盖。

## 局域网 Local-CA（COL-DEPLOY-B）

公网画像用 Caddy ACME 即可。局域网**不要**指望 Let's Encrypt：

1. Caddyfile 对内网 IP / 内网名使用 **`tls internal`**（Caddy 内置 Local CA）。  
2. 将 Caddy data 卷持久化；启动后导出根证书，例如：

```bash
docker cp rushi-caddy:/data/caddy/pki/authorities/local/root.crt ./rushi_lan_ca.crt
```

3. 成员机器**一次性信任**该根证书：  
   - Windows：安装到「受信任的根证书颁发机构」  
   - macOS：钥匙串 → 始终信任  
4. 桌面端连接 **`https://<LAN_IP>`**（WSS 同源），避免明文 `ws://` 被 WebView 拦截。  
5. 可选降级：仅 LAN 预设允许自签/HTTP 调试开关（见 Phase 2 吸收记录）；**默认不推荐**。

示例 Caddy 片段：

```caddy
{$RUSHI_LAN_IP} {
  tls internal
  request_body { max_size 512MB }
  reverse_proxy rushi-collab:{$RUSHI_COLLAB_APP_PORT}
}
```

详情：[`collab-dual-deploy-local-asr-plan.md`](../../docs/execution/specs/collab-dual-deploy-local-asr-plan.md) §4 · [`phase-2-external-review-absorb-2026-07-18.md`](../../docs/execution/specs/phase-2-external-review-absorb-2026-07-18.md)。

## 下一步
当协作服务镜像就绪后，可继续补：
1. 升级说明
2. 回滚说明
3. 健康检查与监控
4. 自动备份定时任务
5. `Caddyfile.lan.example`（`tls internal`）与证书导出脚本
# Rushi 自购协作服务器部署包（单节点草案）

## 目标
本目录提供一套面向“用户自购云服务器 / VPS”的单节点协作部署草案。

它适用于：
- 小团队协作
- 学校/研究组
- 编辑部
- 工作室

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

## 下一步
当协作服务镜像就绪后，可继续补：
1. 升级说明
2. 回滚说明
3. 健康检查与监控
4. 自动备份定时任务
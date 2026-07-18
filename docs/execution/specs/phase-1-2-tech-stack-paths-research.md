# 调研：第一 / 第二阶段功能的技术路径、技术栈、业内坑与规避

> **状态**：规划门禁（调研完成；选型建议供 Phase 2 编码前冻结）  
> **关联阶段**：  
> - 第一阶段（个人单机 v1）：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)  
> - 第二阶段：[`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md)（Wave M / C / D）  
> **关联既有 ADR**：[`0001`](../../adr/0001-independent-repo-default-sqlite-python-asr.md) · [`0002`](../../adr/0002-local-collab-dual-source-review-mode.md)  
> **门禁**：Wave M / R6 编码前须采纳本文「选定栈」或另写 ADR 推翻

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 两阶段能力落地前，明确**走哪条技术路径、用什么栈**，以及业内已踩坑如何提前规避，避免实现期推倒重来。 |
| 范围 | **阶段一**：个人单机（已大体落地，本文做「继承确认 + 遗留雷区」）。**阶段二**：Wave M（预处理+基础剪辑）+ Wave C/D（协作+双部署）。 |
| 成功标准 | 每支柱给出：**推荐路径 ≥2 对照**、**选定栈**、**困难清单**、**规避动作**（可写进 acceptance）。 |

---

## 2. 阶段一：个人单机 v1（继承栈）

### 2.1 业内成熟路线对照

| # | 路径 | 代表 | 机制 | 与 Rushi |
|---|------|------|------|----------|
| A | 桌面壳 + 本地 DB + 外置 ASR 进程 | Rushi / 部分本地 Whisper 壳 | Tauri/Electron + SQLite + sidecar | **已选 A**（ADR-0001） |
| B | 纯云转写 SaaS | Otter / 听见 | 上传→云 ASR→网页编辑 | 与离线优先冲突；v1 非目标 |
| C | 浏览器 PWA + IndexedDB | 轻量 Web 工具 | 无原生 ffmpeg/侧车体积优势 | 长音频/侧车不适合作 v1 主路径 |

### 2.2 选定技术栈（冻结，除非新 ADR）

| 层 | 栈 | 说明 |
|----|-----|------|
| 桌面壳 | **Tauri 2 + React + TS** | 已落地 |
| 本地真源 | **SQLite**（`busy_timeout=5000`） | ADR-0001 |
| ASR | **独立 Python 侧车 + FunASR**（LRC 发版） | 不进 UI 进程 |
| 媒体探测/播放 | **Symphonia + 现有 native_audio**；失败路径 **ffmpeg remux** | 容器 normalize 已有 |
| 构建发版 | GitHub Actions + R2 OTA | 已有纪律 |

### 2.3 困难、业内坑、规避（阶段一仍有效）

| 困难 / 坑 | 业内表现 | 规避（Rushi） |
|-----------|----------|----------------|
| 侧车体积与冷启动 | PyInstaller 数 GB；首启慢 | LRC 分发；ASR-WARM；勿把 LLM 塞进 ASR 侧车 |
| 长音频整文件推理 OOM | FunASR 峰值内存 | 已有分窗/增量薄片纪律；勿回退「一次吞整轨」 |
| 坏 WAV / 容器瑕疵 | 严格 demuxer 拒收 | 保持 ingest normalize；勿只依赖播放器容错 |
| SQLite 锁与多写 | `database is locked` | 已有 busy_timeout；**勿**把协作真源塞回 SQLite |
| WebView 大文件 | 内存峰值、卡顿 | peaks 懒生成；大文件后台任务；禁主线程同步 ffmpeg |
| 「全局 health = 所选模型就绪」 | 能力—UI 错位 | 继续遵守 capability-ui 矩阵 |

**阶段一结论**：不新开栈；阶段二必须**复用**上述边界，禁止为新媒体/协作再拉一套并行运行时（第二 Python、第二 DB 引擎作桌面真源等）。

---

## 3. 阶段二 · Wave M：预处理 + 基础剪辑

### 3.1 业内技术路径（≥2）

| # | 路径 | 代表 / 实践 | 核心机制 | 复用度 |
|---|------|-------------|----------|--------|
| **M-A** | **ffmpeg CLI 任务队列（桌面进程外或 Tauri `Command`）** | Audacity 导出链、多数播客工具、本仓 ASR/`audio_container_normalize` | trim/concat/loudnorm/demux 全走 ffmpeg；UI 只发任务 | **高** — 已有 ffmpeg 依赖面 |
| **M-B** | **进程内解码库（Symphonia / miniaudio 自写剪辑）** | 部分原生播放器 | 自管 PCM 缓冲再写盘 | **低** — 重写成本高；长文件内存险 |
| **M-C** | **云 Enhance API** | Adobe Podcast Enhance | 上传→增强→下载 | **拒** — 与本机/隐私约束冲突 |
| **M-D** | **DAW 插件宿主（LV2/VST）** | Ardour 等 | 完整效果图 | **拒** — 超出基础必要剪辑 |

### 3.2 选定技术栈（Wave M）

| 项 | 选定 | 不选及原因 |
|----|------|------------|
| 转码/剪辑引擎 | **系统/捆绑 ffmpeg**（与现有 remux/ASR 一致） | 不用 M-B 自写 PCM 手术作主路径 |
| 任务编排 | **Rust 侧 job**（状态进 SQLite）+ 后台执行；进度事件到 UI | 勿在 React 里直接 spawn 无监管进程 |
| 剪辑策略 | **Edit Decision → 应用为新 `working` 文件**（非破坏母带） | 禁止原地覆盖 `source` |
| 多段拼接 | **优先 concat demuxer / 分段写出再拼**；避免巨型 `atrim×N` filter_complex | 见下节业内坑 |
| 波形 | **沿用现有 peaks 管线**；working 变更后**全量重生**（MVP） | 勿做未验证的「peaks 补丁更新」当首版 |
| 响度/降噪 | ffmpeg `loudnorm` / `afftdn` 等，**默认关** | 不用云 API |
| Split 产品形态 | **切成两个 File**（MVP） | 推迟多 clip 时间线状态机 |

### 3.3 困难与业内坑 → 规避

| # | 坑 | 证据 / 表现 | 规避动作（写进 AV-PRE/EDIT acceptance） |
|---|-----|-------------|----------------------------------------|
| 1 | **大量 atrim+concat filter 吃光内存** | [SO: hundreds of atrim](https://stackoverflow.com/questions/67558608/ffmpeg-performance-with-hundreds-of-cuts-atrim)；filter graph 膨胀 | Ripple/多删区：**concat demuxer + 文件输入（可 seek）**；禁止 pipe 喂整轨；单次 filter 段数设上限，超出则多趟 |
| 2 | **为剪 6 秒却解码数小时** | [filter trim 顺序读](https://stackoverflow.com/questions/62364352/probably-memory-leakage-on-ffmpeg-when-doing-a-multiple-trims-and-concat-filter) | 单段 Trim 用 `-ss/-to` **输入侧 seek**（准确度与 codec 权衡写入验收）；测试 3h 样例 |
| 3 | **stream copy 切点不准** | 音频帧边界 | MVP 接受「帧对齐」；需要采样级精确时再重编码 PCM working（显式选项） |
| 4 | **切完语段时钟错乱** | 口述史工具常见「删中间→字幕全漂」 | 有语段时默认 **提示重转写**；仅「纯 Trim 头尾」可做时间平移；中间删区不做冒险自动映射（须 spike） |
| 5 | **peaks 与音频不同步** | 半更新 peaks | working 替换后 **删旧 peaks 再 ensure**；播放路径只认 working |
| 6 | **UI 线程卡死** | 同步跑 ffmpeg | 一律 async job + 可取消；大文件进度条；失败可重试 |
| 7 | **磁盘双倍占用** | source+working+临时 | 任务临时目录清理；重置 working 时删旧文件；文档提示磁盘 |
| 8 | **降噪伤害识别率** | Enhance-before-ASR 不一定升 CER | 默认关；小样本 Gate（AV-PRE-4） |
| 9 | **Windows 路径/杀软锁文件** | ffmpeg 无法覆盖正在播放的文件 | 写入 `*.tmp` 再原子替换；剪辑前停播或解锁句柄 |
| 10 | **捆绑 ffmpeg 体积与许可** | 发行包膨胀 | 复用侧车/系统探测策略与现有 remux 一致；许可证 NOTICE 保持 |

### 3.4 评估增补（2026-07-18）：时间戳与内存

| # | 坑 | 规避（已采纳） |
|---|-----|----------------|
| 11 | Ripple 后语段时间断裂 | **Interval mapping**：语段存 Source 时间；见 [`media-timeline-interval-mapping.md`](../../architecture/media-timeline-interval-mapping.md)；**勿**批量 UPDATE 所有语段起止 |
| 12 | 2h 读入 Web Audio `AudioBuffer` OOM | **禁止**；沿用 peaks `.dat` + 原生播放（**勿**另造 audiowaveform JSON 真源）；弱机上 **AV-PRE-5 Proxy**（M2 后 / 3h+ 手测前穿插） |
| 13 | 自增 ID 推协作碰撞 | **ID-STABLE**：ULID 字符串；双库 **TEXT**；禁 PG `UUID` 类型（§8.2 ID-TEXT） |
| 14 | React 19 Action×409 冲掉输入 | 失败 payload 进 `errorState`/Zustand；禁依赖 Action rollback（§8.2 C-409） |
| 15 | LAN 降级只改前端 fetch | Rust `reqwest`/`danger_accept_invalid_certs`（§8.2 LAN-RUST）；B′ 不替代 Local-CA |
| 16 | React 19 受控 `<select>` + Form reset 竞态 | 稳定业务 key 重挂载（§8.2 **C-SELECT**）；禁 `Date.now()` 每渲染 |
| 17 | ASR 满载抢音频 / 侧车僵尸 | 进程树可杀 + Nice/`BELOW_NORMAL`（§8.2 **ASR-SCHED**）；**勿**把 Whisper.cpp 换栈当 Wave C 硬门 |

### 3.5 Wave M 路径决策摘要

| 问题 | 结论 |
|------|------|
| 选定路径 | **M-A：ffmpeg 任务队列 + source/working + 现有 peaks + interval 时间语段 + mapping** |
| 不做什么 | 云 Enhance；进程内自研 DAW；filter_complex 海量 atrim；默默改母带；MVP 多轨时间线；全量 Web AudioBuffer |
| Spike | 3h Trim/Ripple 内存；mapping 纯函数单测矩阵 |

---

## 4. 阶段二 · Wave C/D：协作服务 + 双部署

### 4.1 业内技术路径（≥2）

| # | 路径 | 代表 | 机制 | 复用度 |
|---|------|------|------|--------|
| **C-A** | **中心化 REST + 语段乐观锁 + WS Presence** | 本仓 ADR-0002 草案；多款「文档段落」协作后端 | PG 真源；`UPDATE … WHERE version=`；Presence 可易失 | **高** — 与口述语段模型匹配 |
| **C-B** | **全文 CRDT（Yjs）+ Redis 中继** | Quill/Yjs 协作编辑器 | 字符级合并 | **低（首期）** — 已 ADR 暂缓；过度工程 |
| **C-C** | **P2P / 共享盘 / 共享 SQLite** | 早期「文件夹同步」幻想 | 无统一冲突权威 | **拒** — ADR-0002 |
| **C-D** | **Firebase / 托管 BaaS** | 商业 SaaS | 托管实时库 | **拒作默认** — 自建优先；可远期另议 |

### 4.2 选定技术栈（Wave C/D）

| 项 | 选定（首期） | 说明 |
|----|--------------|------|
| Collab API | **Python FastAPI**（与 foundation 推荐一致） | 与 ASR 同语言生态；团队熟悉；`services/collab/` |
| DB | **PostgreSQL 16** | 协作真源；Alembic/Flyway 类迁移（Python 侧 Alembic 即可） |
| 实时 | **WebSocket（同进程）** Presence + 轻量事件 | 单节点 **可不引入 Redis** |
| 并发 | **语段级乐观锁**（version / If-Match）→ **409** | 单语句 CAS；禁止先读后写无版本 |
| 历史 | **append-only `revision_events`** | 审计；非 CRDT |
| 文件 | **filesystem volume**；云可选 **S3/OSS SDK** | 抽象 `StorageBackend` |
| 部署 | **Docker Compose**：collab + postgres +（云）Caddy | `cloud_vps` / `lan` 仅 env 分叉 |
| 桌面客户端 | **现有 Tauri**；HTTP+WS 客户端 | `ProjectSource=collaborative` |
| Auth | **JWT + 邀请制账号**（首期） | 不做企业 SSO |
| ASR | **不在服务端** | 桌面侧车 |

**单节点首期刻意省略**：Redis、Kafka、多 worker 无粘性、CRDT。人到 30+ 或要水平扩展时再加 Redis Pub/Sub（业内标准升级路径）。

### 4.3 困难与业内坑 → 规避

| # | 坑 | 业内表现 | 规避动作 |
|---|-----|----------|----------|
| 1 | **多 worker 时 WS 只在本进程内存** | 消息到不了其他实例 | 首期 **单 Uvicorn worker** 或明确「单副本」；文档禁止盲目 `--workers 4`；扩展时再上 Redis |
| 2 | **Presence 僵尸在线** | 断线未清 | 心跳 + TTL；离开/超时广播；Presence **非强一致真源** |
| 3 | **乐观锁做成先 SELECT 再 UPDATE** | 丢更新 | `UPDATE … WHERE version=$expected RETURNING`；0 行 → 409 + 当前投影 |
| 4 | **用 CRDT「以后再说」却先铺 Yjs** | 半年无收益 | 坚持语段 CAS；全文 CRDT 另 ADR |
| 5 | **协作 UI 先于 API** | 重写两轮 | 遵守 foundation：R6 真源 → R7 只读 → R8 写入 |
| 6 | **SQLite 当协作真源** | 多写损坏/锁死 | 协作只 PG；本地仅缓存 |
| 7 | **健康检查冒充「模型就绪」** | 能力—UI 错位 | Collab `/health` 只表服务/DB；ASR 状态仍桌面 |
| 8 | **卷备份当 PG 备份** | 拷运行中 data 目录不一致 | **pg_dump**；定期恢复演练；见 [Docker PG backup 实践](https://dev.to/piteradyson/postgresql-docker-backup-strategies-how-to-backup-postgresql-running-in-docker-containers-1bla) |
| 9 | **Caddy/证书卷当临时** | 续期失败、反复签 | 持久化 `caddy_data`；域名与 80/443 就绪 |
| 10 | **LAN HTTP 误暴露公网** | 未授权访问 | 默认绑内网；云画像强制 HTTPS；关闭开放注册 |
| 11 | **大音频经 API 进 JSON** | 内存炸 | 媒体 multipart/直传存储；元数据走 JSON |
| 12 | **断线重放海量事件** | 客户端卡死 | 落后超阈 → **全量快照重拉**；revision 分页 |
| 13 | **导出任务堵死 API** | 同步 DOCX | embedded worker 队列；超时与磁盘限额 |
| 14 | **密钥进镜像/compose 提交** | 泄露 | `.env` gitignore；文档强随机 JWT |
| 15 | **桌面双真源写穿** | 协作保存写回 local CRUD | R7 验收：协作打开不走 `project_load` 唯一写路径 |
| 16 | **409 静默覆盖输入** | 桌面脑裂丢稿 | **冲突草稿空间** + 显式选择覆盖/采纳服务器（R8/C7） |
| 17 | **Presence 僵尸** | 闪断残留 | 心跳 3–5s，TTL≈10s 剔除并广播（C5） |
| 18 | **LAN 套公网 ACME** | 无证书 / WebView 拒 WS | **`tls internal` + 分发 root.crt**；可选 RFC1918 降级（COL-DEPLOY-B） |

### 4.4 Wave C/D 路径决策摘要

| 问题 | 结论 |
|------|------|
| 选定路径 | **C-A：FastAPI + PG + 语段乐观锁 + 单节点 WS；Compose 双画像** |
| 不做什么 | 首期 CRDT/Yjs/Redis/Kafka；P2P；云 ASR；多副本无 Pub/Sub |
| 升级触发 | 多机部署或 Presence 丢消息 → 再引入 Redis Pub/Sub（不改 PG 真源） |

---

## 5. 跨阶段 / 跨支柱坑

| 坑 | 规避 |
|----|------|
| 为协作再写一套媒体路径 | Wave M 的 `source`/`working` 命名与协作 `media_assets` 对齐 |
| ASR「顺便」上云省事 | 硬约束；Collab 镜像 CI 禁止打入模型 |
| 阶段二并行开 UI 大改与 R6 | 一轮一薄片；Wave M 与 R6 不要同一周抢同一编排文件 |
| 文档栈与代码栈漂移 | Phase 2 路线图 + 本文「选定栈」表；变更走 ADR |

---

## 6. 可复用评估（本仓）

| 能力 | 复用 | 扩展点 |
|------|------|--------|
| ffmpeg remux / ASR normalize | 高 | 剪辑/预处理 job 共用探测与路径工具 |
| peaks 管线 | 高 | working 变更触发重生 |
| 导入/Hub 编排 | 高 | 挂预处理确认与任务态 |
| 语段 mutation / REV-LOC | 中 | 媒体编辑撤销另建（文件快照或 EDL 重放） |
| deploy/self-hosted-collab | 中 | 换真实镜像；加 lan env |
| FunASR 侧车 | 高 | **不迁入** Collab |

---

## 7. 决策总表（供签收）

| 领域 | 选定技术路径 | 核心栈 | 首要规避 |
|------|--------------|--------|----------|
| 阶段一（继承） | 桌面 + SQLite + Python ASR | Tauri / React / SQLite / FunASR 侧车 | 不双真源；不健康检查冒充模型 |
| Wave M | ffmpeg 任务 + source/working | Rust job + ffmpeg + 现有 peaks | 禁巨型 atrim 图；有语段默认重转 |
| Wave C | 中心化语段 CAS | FastAPI + PG16 + WS（单副本） | 禁无无版本读写；禁多 worker 无 Redis |
| Wave D | Compose 双画像 | Caddy（云）/ 内网直连（LAN）+ pg_dump | 禁卷冷拷当备份；LAN 不裸奔公网 |

---

## 8. 落位预告

| 产出 | 路径 |
|------|------|
| 本文 | `docs/execution/specs/phase-1-2-tech-stack-paths-research.md` |
| 阶段排期 | [`rushi-phase-2-roadmap.md`](../plans/rushi-phase-2-roadmap.md)（应链接本文） |
| Wave M plan | [`av-preprocess-edit-basic-plan.md`](./av-preprocess-edit-basic-plan.md) |
| 协作 plan | [`collab-dual-deploy-local-asr-plan.md`](./collab-dual-deploy-local-asr-plan.md) · foundation |
| 若推翻 FastAPI/ffmpeg | **新 ADR** |

薄片 acceptance 建议增加勾选项：「未使用 filter_complex 海量 atrim」「Collab 单副本或已配 Redis」「备份为 pg_dump」。

---

## 9. 签收

- [x] 调研完成（阶段一继承 + Wave M/C/D 路径与坑）
- [ ] 产品确认「选定栈」表（§7）可冻结
- [x] Phase 2 路线图已链接本文
- [ ] R6 / AV-PRE-1 acceptance 引用本文规避条

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版：两阶段技术路径 / 栈 / 业内坑 / 规避 |
| 2026-07-18 | 吸收外部评估：mapping、Web Audio 禁令、409 草稿、Presence TTL、LAN Local-CA、ID-STABLE |
| 2026-07-18 | §3.4 增补 #16–17：C-SELECT / ASR-SCHED；Proxy 穿插与 peaks 真源澄清 |

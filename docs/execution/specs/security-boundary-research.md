# 本机 ASR 与 STT 凭证边界调研

状态：已采纳；用户于 2026-10-25 指示“执行”。审查基线 6cec9b4；原报告 1072365 不在本地。

## 已读清单与现状
AI_QUICKSTART.md、CONTEXT.md、ASR sidecar policy、desktop-capability-ui-state-alignment、ADR-0001 与 ADR 索引、stt-online-providers.md；Python app/token/模型加载、Rust loopback/source/bundled 启动、STT bridge/probe/secret store、前端凭证恢复/探测/转写、生产 CSP、release.yml。

## 成熟路线与复用评估
| 路线 | 机制及来源 | 复用度 | 本仓约束、进度与内存 |
|---|---|---|---|
| A 原生进程边界 | Tauri command ACL 和 Rust 内解析凭证引用；https://v2.tauri.app/security/capabilities/ | 高：已有 ACL、secret store、native adapter | 复用现有探测/转写，不增加服务；UI 仅持引用，原进度不变 |
| B HTTP 服务边界 | FastAPI 请求鉴权；https://fastapi.tiangolo.com/tutorial/security/first-steps/ | 高：已有 token 守卫与 bundled 随机 token | 将可选鉴权改为 fail closed，开发启动同步 token；无新增内存负担 |
| C 模型代码信任 | 自定义模型显式信任及固定 revision；https://huggingface.co/docs/transformers/custom_models | 中：已有 Nano 同步脚本 | 默认关闭远程代码；Nano 仅允许固定提交和 SHA256 校验的代码；无需重做模型栈 |

## 决策
组合 A+B，保留现有请求和 Provider 架构。loopback IPC 按 method/path 白名单并禁止重定向和系统代理。缺 token 拒绝写请求；开发桌面启动生成 token，独立 asr:dev 要求显式共享 token。默认模型禁止 remote code；Nano 用固定提交文件清单及摘要验证。不新增 OAuth、token 文件协议或第二套凭证存储，不把无 Apple 签名与无更新签名混同。发行项只验证现有产物和发布策略，不申请证书、不上传、不发布。

## 落位
Rust asr_sidecar/loopback.rs、source.rs、online_stt_bridge.rs、stt_online_probe.rs、命令 ACL；Python app.py、funasr_engine_load.py、Nano 同步及摘要清单；开发脚本、STT 前端 contract、tauri.conf.json；相应定向回归。plan/intent/acceptance 均引用本文。

补充：核对本机安装包内 FunASR `download/download_model_from_hub.py`，`trust_remote_code=True` 还会触发模型目录 requirements.txt 安装。因此全部 AutoModel 调用保持 False；Nano 仅显式导入固定摘要验证后的 Python，不启用 FunASR 的自动 pip/远程代码钩子。上游固定提交 `c0a20e2bb698bbad11d143bdccd6c0760e9d6e5b`，12 个 Python 文件 SHA256；这是来源完整性记录，不代替 Nano 真实模型验收。

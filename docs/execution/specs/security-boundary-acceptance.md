# 安全边界修复验收

调研：[security-boundary-research.md](./security-boundary-research.md)
计划：[security-boundary-plan.md](./security-boundary-plan.md)

## 能力—UI 状态矩阵

| 场景 | 真源 | UI/行为 |
|---|---|---|
| D1/D2/D4/D5 模型状态 | 原 catalog/health | 保持原维度；鉴权失败不得冒充模型缺失 |
| 无 token / 错 token | Python token 守卫 | 写请求 503 / 401，不能静默通过 |
| 已保存 STT 凭证 | Rust secret store 存在性和原生解析 | 输入框不读回秘密；重启后仍可探测/转写 |
| 无凭证/失效引用 | Rust secret store | 不可探测/转写，提示重新保存 |
| Nano 代码被篡改 | 固定文件 SHA256 清单 | 拒绝执行，不退回未验证的 model.py |

## 验证记录（2026-10-25）

首次核查的代码基线为 `6cec9b4`；当时外部报告引用的 `1072365` 本地不存在，未读取外部 REPORT.md。推送前已 fetch 并变基至 `10723657`；最新验证见文末补充。已完成 1–5 的代码加固；第 6 项完成下列本机/公开元数据核实，没有改变允许 unsigned 发行的现行政策。

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run test` | 468 文件，2652 测试通过；包含 OpenAI/讯飞已保存凭证引用的探测与 payload 回归 |
| `npm run build` | 通过；现有 chunk 大小提示 |
| `npm run lint` | 0 errors，36 warnings |
| `node scripts/check-architecture-guard.mjs` | 0 errors，62 warnings；增加生产 ASR CSP 和禁止 STT 读回命令回归守卫 |
| `services/asr/.venv/bin/python -m pytest services/asr/tests` | 191 passed；包括默认禁用 remote code、Nano 摘要与拒绝篡改、token 503/401/放行 |
| `NO_PROXY=127.0.0.1,localhost,::1 no_proxy=127.0.0.1,localhost,::1 cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 575 passed；含真实本地 HTTP 探测中 Rust 解析凭证后携带认证头的回归 |
| `cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings` | 未通过：8 处位于本轮未改动文件的既有 lint；sync.rs too_many_arguments、speaker_cmd.rs 6 处 needless_borrow、utils.rs type_complexity |
| `node scripts/check-internal-doc-links.mjs` | 未通过：8 处既有跨仓 Jieyu 文档缺失；没有本轮新文档的断链 |
| `bash -n` 开发启动/Unix 打包脚本 | 通过；独立 asr:dev 无 token 明确失败退出，不自动开放写权限 |
| `git diff --check` | 通过 |

真实 Uvicorn 进程冒烟（临时 loopback 端口，不触碰当前 8741 进程）：无 token 时 health=200、unload=503；有 token 时缺请求头=401，正确 token 的 auth/check 与 unload=200。前端已保存凭证不再读回；用户本会话新输入的秘密仍可保存到原存储。自定义代理的出站配置权限仍存在，不宣称对已完全控制主窗口的攻击者实现秘密隔离。

首次全量 Rust 在当前代理环境下有 5 项 local_runtime 验证测试收到 HTTP 503；仅为该测试命令设置 loopback NO_PROXY 后 575 项全通过，未改机器代理设置。严格 Clippy 和全局文档链接检查的既有失败保留，不称全部检查全绿。

## 发行签名证据

- `/Applications/如是我闻.app`，Info.plist 版本 `1.0.0`：`codesign -dv --verbose=2` 为 `Signature=adhoc`、`TeamIdentifier=not set`。
- `xcrun stapler validate`：没有 stapled ticket；`spctl --assess --type execute --verbose=2`：rejected。不能称这份本机产物已通过 Developer ID 签名/公证。
- GitHub `repos/Abe-Junwei/rushi/releases/latest` 当前返回 `v0.1.9`，列有 `app.tar.gz.sig` 和 `latest.json`；只核对元数据，未下载约 1.5GB 制品，也未验证该 .sig。它不是本机 1.0.0 产物的签名证据。
- `https://updates.rushi.app/latest.json` 本次请求 HTTP 403，未能核实 CDN manifest/制品；Windows Authenticode、公开制品的 Apple 签名/公证与 updater 签名验证仍待实际制品检查。

本机主程序 SHA256：`3b3bae93a84a1327254436093b3147dda22f8bbeebb8e379806b8393e70ad65a`（只标识上述本机二进制）。

## 剩余验收边界

没有发布新版本、推送分支或更改签名 secrets。尚未完成真实桌面安装主路径、真实厂商凭证/配额转写、默认 Paraformer 与 Nano 真模型加载验收；本机开发 venv 只安装基础和测试依赖。Nano 固定代码摘要不代替上游代码审查。发行构建已加入 rushi_asr 数据文件收集以携带摘要清单，尚未重新制作 PyInstaller 安装介质。

## 本轮三行日志

改动：token fail closed、开发会话 token、IPC 白名单/禁重定向与代理、固定 Nano 代码摘要、禁自动远程代码/pip、STT 原生引用解析、生产 CSP 收口。
验证：前端 2652 / Python 191 / Rust 575、typecheck/build/lint/架构守卫、真实 Uvicorn HTTP 冒烟通过；Clippy 与跨仓文档链接既有失败如上。
下一轮：真实安装介质与厂商转写验收；有可访问的发行制品后核验 OS 与 updater 签名。

## 推送前同步补充（2026-10-25）

首次 push 因远端更新被拒绝；已 fetch origin/main，将安全修复无冲突变基至 `10723657`，保留上游依赖和波形更新，未使用强制推送。上述验证表保留首次实施时的结果。

同步后 `npm ci`、typecheck、前端构建通过；前端回归为 468 文件 / 2654 测试通过。

`npm audit` 检出远端现有锁中的开发传递依赖 `zod@4.4.3`：GHSA-mrhx-c7xc-m3w5（high，约束集合验证导致内存耗尽）。`npm explain zod` 显示来源为 eslint-plugin-react-hooks / zod-validation-error 的 dev peer；本轮没有修改远端依赖锁，不据此断言桌面运行时可利用。公告：https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 。

推送前最终验证：typecheck/build 通过；468 文件 / 2654 前端测试、575 Rust 测试通过；lint 0 errors / 36 warnings；架构守卫 0 errors / 62 warnings。`cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings` 通过，上游更新已修复首次实施时的 8 处 Clippy 问题。Python 代码未受上游更新影响，沿用本轮 191 项通过记录。既有跨仓 Jieyu 文档链接缺失及发行/真实安装验收边界不变。

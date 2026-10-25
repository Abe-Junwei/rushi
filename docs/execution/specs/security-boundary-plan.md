# 安全边界修复计划

调研：[security-boundary-research.md](./security-boundary-research.md)

1. Python token fail closed，桌面开发自动 token 与 Rust 源码重启同步；代理方法/路径/查询白名单，禁止重定向和代理。
2. 默认 trust_remote_code=False；Nano 固定 commit + 文件 SHA256，加载前验证。
3. STT 探测和转写传 apiKeyId/apiSecretId，Rust 内恢复；删除读回命令及 ACL，前端恢复改存在性检查。
4. 去除生产 CSP loopback 地址，开发 CSP 保留浏览器开发用途。
5. 验证发行配置与可用产物；写明无法确认的签名边界。

验证：typecheck → 定向 TS/Python/Rust 回归 → 全量 npm test、lint、architecture guard、Python test、cargo test/clippy；失败先修复本轮引入的问题。未经 UI/发行实测不称为真实安装验收。所有改动留在当前仓库，保留原有未跟踪文件，不推送/发布。

# Spec(intent)：换机矩阵 + 网盘占位 / 受控 symlink（薄片 3）

> **调研门禁**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md) §4.2  
> **验收**：[`user-library-location-slice3-acceptance.md`](./user-library-location-slice3-acceptance.md)  
> **前序**：薄片 1 · 2

## 目标

1. **受控 symlink**：解析后目标落在媒体基准 / app_data / relocate-allow 内则允许；逃逸根外仍拒绝。  
2. **Files On-Demand**：检测「未完整在本地」的占位文件，返回可执行文案（始终保留在此设备 / 等待下载），避免含糊 IO 错误。  
3. **换机手测矩阵**：项目包传 DB + 网盘同步媒体 + 各机设同一逻辑媒体基准，文档化步骤。  
4. **架构补记**：在 lifecycle 文档标明媒体基准 + 相对路径为长期契约（本片不新开 ADR，除非后续协作轨冲突）。

## 边界（不做）

- 不自动 hydrate / 不替用户点「始终保留」。  
- 不把 DB 放网盘；不做自研 sync。  
- 不放宽任意路径播放（ADR-0008 scoped 仍在）。

## 能力—UI

| 场景 | 维度 | 真源 |
|------|------|------|
| 打开/播放失败（占位） | L1 媒体可读性 | `resolve_audio_path` 错误串 |
| 符号链接逃逸 | L1 安全 | canonicalize 后 strip_prefix |

## 验证

见 acceptance（单元 + 手测矩阵）。

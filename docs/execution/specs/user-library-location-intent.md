# Spec(intent)：用户库位置与跨设备同步（媒体基准目录 · 薄片 1）

> **调研门禁**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md)（**已采纳** 2026-07-17）。
> **验收**：[`user-library-location-acceptance.md`](./user-library-location-acceptance.md)

## 目标

落地 Zotero 式二分的第一刀：**媒体基准目录（Media base directory）** 可配置；新导入音频写入该基准下并以**相对路径**落库；读路径 dual-read（相对 + 旧绝对）。偏好页只露路径与选择/恢复（业内 Files & Folders 式）；DB 本机纪律与网盘警告落在 research/文档，不进 prefs 堆叠（打开数据目录已有 ASR 工具入口）。

## 切片划分

| 切片 | 范围 | 交付 |
|------|------|------|
| **1（本片）** | `media_base_dir` pref + dual-read resolve + 新导入相对写入 + 偏好设置 UI | 自动门禁绿；手测：改基准 → 导入 → 播放/转写 |
| **2** | 搬迁向导 + peaks 随媒体 | [`user-library-location-slice2-*`](./user-library-location-slice2-intent.md) |
| **3** | 换机手测矩阵 + On-Demand 文案 + 受控 symlink；lifecycle 契约（不开新 ADR） | [`user-library-location-slice3-*`](./user-library-location-slice3-intent.md) |

## 边界（不做 · 本片）

- 不把 `rushi.sqlite3` / models / secrets 放进网盘或可同步目录。
- 不 bulk 迁移存量 `audio_path`（仍 dual-read 兼容绝对路径）。
- 不把 peaks 挪到媒体基准（派生缓存仍在 app_data `projects/`）。
- 不实现自研 sync / P2P / 共享目录协作（ADR-0002）。
- 不改 ASR Provider / VAD 栈。

## 能力—UI 状态矩阵（必填）

| UI 控件 | 状态维度 | 真源 | 禁止误绑 |
|---------|----------|------|----------|
| 「内容库位置」路径 + 选择 / 恢复默认 | **L1 媒体基准** | `prefs/media_base_dir.txt`（空 = 默认 `DbState.root`） | 禁止用 DB 路径冒充媒体基准；prefs 不堆 L2/L3 长文 |
| （非本区）打开数据目录 | **L2 本地库根** | `DbState.root` / `open_app_data_folder`（ASR 工具等既有入口） | 禁止暗示可同步或可选网盘 |
| research / 用户指南 | **L3 产品纪律** | research §4/§5 | 禁止「一键同步到网盘」类 CTA |

## 验证方式

- 自动：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`；`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml media_base`（或等价过滤）。
- 手测：见 acceptance。

# Acceptance：媒体基准搬迁向导 + peaks 随媒体（薄片 2）

> **状态**：已落地（自动化门禁待勾；手测 ☐）  


> **调研**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md) §4.1  
> **Intent**：[`user-library-location-slice2-intent.md`](./user-library-location-slice2-intent.md)

## 做

| 项 | 说明 |
|----|------|
| 弹窗 | 有受管媒体：仅「搬迁」「取消」；空库：直接改 pref |
| 搬迁 | 音频 + peaks；UUID 叶子名不变；成功后相对化 `audio_path`；**然后**写 pref |
| 失败 | pref 不切；已搬文件可经 relocate-allow 根 resolve |
| 忙时 | `commit_media_base_dir_change`：转写 in-flight 或 native 播放中硬拒绝 |
| 恢复默认 | 同套规则 |
| peaks 新写入 | `{media_base}/projects/{id}/peaks/` |
| 网盘文案 | 弹窗一行：始终保留本地；含波形缓存 |

## 不做

仅改路径；强制残缺切换；On-Demand 深挖；DB 上云。

## 自动化

- [x] `npm run typecheck`
- [ ] `npm run test`（全量；改动主要为 Rust/偏好 UI）
- [x] `node scripts/check-architecture-guard.mjs`（0 错误）
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml media_base`（8 passed，含 relocate）
- [x] relocate focused tests（empty + move audio/peaks）

## 手测

1. 空库改路径：无弹窗，路径更新。  
2. 有项目：选择新目录 → 弹窗 → 搬迁 → 音频与 peaks 在新目录且可播放。  
3. 恢复默认：同样搬迁回 app_data 媒体根。  
4. 播放中点选择：拒绝开搬。  
5. CJK 路径显示无 `\\?\`。  

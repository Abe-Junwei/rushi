# PyInstaller 侧车：`--collect-submodules` / `--collect-data` 说明

## 现状

`scripts/build-asr-sidecar-*.sh` 使用：

- **`--collect-submodules modelscope`**（及 `funasr`、`hydra`、`omegaconf`、`torchaudio`），以换取 **首次打包即可 import 成功**，避免在 FunASR 动态 import 路径上反复试错。
- **`--collect-data funasr`**（R3h-0）：打包 `funasr/version.txt` 等包内数据文件；缺少此项时侧车 `/health` 会 500、`funasr_import_ok: false`。

Post-build 门禁：`scripts/smoke-asr-sidecar-health.sh`（检查 `_internal/funasr/version.txt` 并断言 `/health` 中 `funasr_import_ok`）。

代价：**构建时间长**、**onedir 体积大**（与产品 §8 预算需定期对照）。

## 后续瘦身方向（未默认启用）

1. 用 **显式 `--hidden-import`** 列表替代全量 `modelscope` collect（需按实际 FunASR 版本做一轮 import 冒烟矩阵）。
2. 将 **全量侧车构建** 挪到 **nightly** 或 **release 前人工 job**（见 `.github/workflows/asr-sidecar-build-nightly.yml`），主 CI 保持轻量 `pytest` + 桌面构建。

## 真源

以 [`asr-sidecar-funasr-policy.md`](./asr-sidecar-funasr-policy.md) 与仓库脚本为准；本文仅记录取舍与后续工作方向。

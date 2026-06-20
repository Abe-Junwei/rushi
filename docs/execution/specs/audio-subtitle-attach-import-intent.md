# Intent：音频 + 字幕 Attach import（Replace）

> **Research**：[audio-subtitle-attach-import-research.md](./audio-subtitle-attach-import-research.md)  
> **Plan**：[audio-subtitle-attach-import-plan.md](./audio-subtitle-attach-import-plan.md)  
> **Acceptance**：[audio-subtitle-attach-import-acceptance.md](./audio-subtitle-attach-import-acceptance.md)  
> **状态**：✅ 已签收（2026-06-20 · 手测 + 自动闸门）

## 意图

用户在 **Editor** 编辑某条含音频的 File 时，导入外部 `.srt`/`.txt` 应 **挂到当前 File 并整份替换语段**，波形与字幕同屏——而不是新建一条无音频的 `text` File。

在 **Project Hub** 导入时，按 **Sidecar stem** 自动挂到唯一匹配的 `paired`/`audio_only`；无法唯一匹配时让用户选目标，或新建纯 `text` File。

## 用户价值

- 对齐 Subtitle Edit / Descript 的「给这条媒体挂字幕」心智
- 修复现 P0：先音频后 SRT 导致两条分裂 File、`fallbackWaveFile` 绕路
- 对齐 [`file-container-refactor.md`](./file-container-refactor.md)「改 SRT 再导入 → 文本已更新」

## 范围

| 薄片 | 交付 |
|------|------|
| **ASI-1** | Rust `import_transcript_to_file` + Replace + `file_type` 升格 |
| **ASI-2** | Editor Attach + Close Gate + 转写 busy + re-import bypass dedupe |
| **ASI-3** | Hub Sidecar stem + 选目标对话框 + `loadProjectAfterImport` 修正 |
| **ASI-4** | 测试 + 手测 + lifecycle 文档 |

## 不做

- 合并导入（时间轴 merge）
- VTT 解析 v1
- `file_pairs` 或第二套 segment 真源
- 跨项目 attach
- 转写中静默停转写再导入（T3）
- Hub 禁止导入（D）

## 验证

`npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`；`cargo test` / `cargo clippy` 定向 import；手测见 acceptance。

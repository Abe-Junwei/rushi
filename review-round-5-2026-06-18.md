# Round 5 — 代码健康度扫描（2026-06-18）

## 目标

在 Wave E 完成后做一次全栈健康度扫描，处理新增的复杂度热点与死代码噪声。

## 扫描项

| 项 | 命令 / 方法 | 结果 |
|----|-------------|------|
| knip unused exports/types | `npx knip --no-gitignore` | ✅ 0 / 0 |
| TypeScript 生产文件行数 | `find apps/desktop/src -name "*.ts" -o -name "*.tsx" \| xargs wc -l \| sort -n` | ✅ 最大生产 hook 298 行，未超 300 阈值 |
| Rust 文件行数 | `find apps/desktop/src-tauri/src -name "*.rs" \| xargs wc -l \| sort -n` | ⚠️ `dashscope_file_asr.rs` 557 行，超 500 阈值 |
| lint | `npm run lint` | ✅ 0 warnings |
| architecture guard | `node scripts/check-architecture-guard.mjs` | ✅ 0 warnings |

## 处理

### Rust 模块拆分：`dashscope_file_asr.rs` 557 → 251 + 319

**原因**：`.rs > 500 行 → 考虑拆模块`（AGENTS.md）。

**拆分方式**：
- 新建 `dashscope_file_asr_parse.rs`：
  - `parse_funasr_file_transcription`
  - 解析辅助函数：`json_f64`、`assemble_text_from_words`、`push_speech_segment`、`segments_for_sentence`
  - 5 个解析相关单元测试
- 保留 `dashscope_file_asr.rs`：
  - `transcribe_dashscope_file_asr`（提交 + 轮询主流程）
  - URL 常量、`strip_bearer`、`POLL_INTERVAL`
  - 1 个取消轮询单元测试
- 更新 `stt_native/mod.rs` 导出 `dashscope_file_asr_parse`

**风险规避**：
- 新文件中的 `segments_for_sentence` 严格复刻原逻辑（先 `assemble_text_from_words`，再 `funasr_file_words_to_timed` + `timed_words_to_json`），避免第一轮错误按标点切分导致测试失败。

## 验证

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
# ✅ typecheck
# ✅ test: 1558 passed / 319 files
# ✅ lint: 0 warnings / 0 errors
# ✅ architecture guard: 0 warnings

cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
# ✅ 399 passed

cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
# ✅ clean
```

## 结论

- 本轮扫描发现 1 个 Rust 复杂度热点，已拆分。
- knip、lint、architecture guard 均保持全绿。
- 清理登记表中已无代码侧阻塞项；唯一剩余 `CLN-066` 为 L3 UI 手测项。

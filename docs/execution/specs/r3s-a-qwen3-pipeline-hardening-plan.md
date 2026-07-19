# Plan: R3s-A — Qwen3 中文长课管线硬化

> **Research**：[r3s-a-qwen3-pipeline-hardening-research.md](./r3s-a-qwen3-pipeline-hardening-research.md)  
> **Intent**：[r3s-a-qwen3-pipeline-hardening-intent.md](./r3s-a-qwen3-pipeline-hardening-intent.md) · **Acceptance**：[r3s-a-qwen3-pipeline-hardening-acceptance.md](./r3s-a-qwen3-pipeline-hardening-acceptance.md)

## 实施步骤

1. 将 Qwen 生成参数与 Silero VAD 参数收为有校验的配置对象，CLI 暴露覆盖项。
2. 默认 `max_new_tokens=512`、VAD 20s/0.3，并在相邻段中点范围内添加 0.3s 上下文。
3. 接入可选 `OfflinePunctuation`，逐段输出 `raw_text` 与 `text`，记录标点耗时。
4. 官方 GitHub release 作为 Qwen 与 punctuation 下载真源，写 provenance + SHA256。
5. 新增 Sherpa 金标评测脚本，输出内容 CER、带标点 CER、term hit、RTFx、覆盖率和触顶率。
6. 跑 Rust/Python 定向测试，再跑 typecheck、test、architecture guard。

## 验证

```text
cargo test --manifest-path apps/desktop/src-tauri/spike/sherpa_qwen3/Cargo.toml
npm run asr:test
npm run typecheck
npm run test
node scripts/check-architecture-guard.mjs
```

模型齐备时额外运行 `npm run eval:run:sherpa`；模型缺失时明确记录，不自动下载大模型。

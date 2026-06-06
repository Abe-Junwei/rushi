# 核心功能链路：业内通行方案对比分析

> **状态**：基于代码库全量扫描 + 领域知识分析（2026-06-06）  
> **背景**：为全量代码审查提供"对齐基准"，每条链路标记 ✅ 对齐 / ⚠️ 有差异（需判断刻意/缺陷） / ❌ 明显缺陷

---

## 1. 本地 ASR 架构链路

### 1.1 业内通行方案矩阵

| 维度 | Whisper.cpp (C++) | Sherpa-ONNX (C++) | FunASR (Python) | 部署模式 |
|------|-------------------|-------------------|-----------------|----------|
| 中文准确率 | 中（依赖微调） | 中高 | **高** | — |
| 模型体积 | 小（~100MB） | 小（ONNX） | 大（~1-2GB PyTorch） | — |
| 推理速度 | 极快（GGML） | 快 | 中等 | — |
| 依赖 footprint | 极小（单二进制） | 小（ONNX Runtime） | 大（Python+torch+funasr） | — |
| 部署方式 | 静态链接 / WASM | 动态库 / FFI | PyInstaller / Docker | — |
| 与桌面集成 | FFI / wasm-bindgen | FFI (neon/ndarray) | HTTP sidecar / stdin | — |
| 流式支持 | ✅ | ✅ | ⚠️ 有限 | — |

**行业趋势**：
- 2024-2025 年，**Whisper.cpp** 成为本地 ASR 的默认选择（Ollama、MacWhisper、Buzz 等）
- **Sherpa-ONNX** 快速崛起，Next-gen Kaldi 团队主推，中文流式场景优势
- **FunASR** 在中文专业场景（电话客服、法庭转写）占主导，但几乎 exclusively server-side
- 桌面端集成：**C++ 库通过 FFI 绑定**是主流（避免 sidecar 进程管理复杂度）

### 1.2 Rushi 当前方案

```
Frontend (React) → Tauri invoke → Rust HTTP proxy → 127.0.0.1:8741 → Python FastAPI + FunASR
                                    ↑
                              PyInstaller onedir sidecar
```

### 1.3 对比结论

| 方面 | 状态 | 分析 |
|------|------|------|
| **选择 FunASR** | ✅ 刻意设计 | 中文 ASR 准确率是核心卖点，Whisper 系列中文效果确实不如 FunASR。Remediaton plan v1.2 中明确排除了 Whisper 迁移（§5）。 |
| **PyInstaller onedir** | ⚠️ 权衡设计 | FunASR 无法静态编译，PyInstaller 是标准方案。但体积 ~1GB 远超行业平均（Whisper.cpp ~100MB）。已有 LRC 下载方案在缓解（R3h-1）。未来 Sherpa 迁移（R3h-3.5）是正确方向。 |
| **HTTP loopback sidecar** | ✅ 刻意设计 | 比 stdin/stdout 更健壮，支持 multipart 大文件上传，易于独立调试。端口冲突处理（kill + retry）已覆盖。 |
| **Tauri HTTP proxy** | ✅ 刻意设计 | 避免 WebView CORS 限制，是 Tauri 社区的推荐模式。 |
| **Linux stub** | ❌ **缺陷** | 发行版支持不完整。行业通行做法是至少提供 x86_64 完整包。 |
| **Windows CI 无 sidecar** | ❌ **缺陷** | release.yml 未调用 `build-asr-sidecar-windows.ps1`，发版后 Windows 用户无本地 ASR。 |
| **macOS CI 无 sidecar** | ❌ **缺陷** | release.yml 的 tauri-macos job 没有 setup-python + build sidecar 步骤。 |
| **模型首次下载体验** | ⚠️ 已知债务 | 行业最佳实践是：首次启动时后台静默预下载默认模型（如 Whisper.cpp 的模型缓存策略）。当前需用户手动点击"准备模型"，体验断层。 |

---

## 2. 前端状态管理链路

### 2.1 业内通行方案矩阵

| 方案 | 代表项目 | 适用场景 | 2025 趋势 |
|------|----------|----------|-----------|
| **Zustand** | 多数 React 项目 | 中小型应用，轻量 | ⬆️ 增长中 |
| **Jotai/Recoil** | 复杂衍生状态 | 大量派生计算 | ➡️ 稳定 |
| **TanStack Query** | 服务端状态 | API 数据缓存 | ⬆️ 主流 |
| **Signals** (Preact/Solid) | 高性能场景 | 细粒度更新 | ⬆️ React Compiler 方向 |
| **纯 React + Context** | 官方推荐 | 小型应用 | ⬆️ React 19 编译器推动 |
| **Redux Toolkit** | 传统企业级 | 严格的数据流 | ⬇️ 逐步被替代 |

**大型编辑器类应用（对标 Rushi）**：
- **VS Code** (Electron): 自研状态管理 + Immutable.js
- **Obsidian** (Electron): 纯 React + 自定义事件系统
- **Descript** (Electron): Redux + Web Workers
- **通用趋势**：编辑器类应用普遍使用 **事件驱动 + 不可变状态** 来处理高频更新（光标、选择、滚动），避免 React re-render 开销。

### 2.2 Rushi 当前方案

```
App.tsx
  └── ProjectPanel (workspacePhase: A/C)
        └── useProjectController (mega-hook, ~232 lines, 15 sub-controllers)
              ├── useProjectListState
              ├── useProjectEditorState
              ├── useSegmentMutationController
              ├── useProjectSaveController
              └── ... (12 more)
```

- 无全局状态库
- 纯 `useState` + `useReducer`
- **Ref-based synchronization**（`ref.current = value` 避免 stale closures）
- Props drilling：`controller` + `tx` 深传

### 2.3 对比结论

| 方面 | 状态 | 分析 |
|------|------|------|
| **无全局状态库** | ✅ 刻意设计 | React 19 + Compiler 的方向是减少外部状态库依赖。对于 360 文件级别的应用，纯 React 是可维护的。 |
| **Controller hook 模式** | ✅ 刻意设计 | 类似 MVC 的变体，将业务逻辑从组件中抽离。`useProjectController` 是 facade 模式。 |
| **mega-hook（~232 行）** | ⚠️ **技术债务** | 行业最佳实践是：任何 hook > 300 行应拆分（AGENTS.md 已规定）。当前虽未超 300，但聚合 15 个子 controller 的 API 对象会导致：① 任何子状态变化触发整个 controller 依赖者重渲染；② 测试需 mock 整个 200+ 字段对象。对标 Obsidian/VS Code，应使用 **selector/subscription 模式**。 |
| **Ref-based sync** | ⚠️ 权衡设计 | WaveSurfer 是命令式 API，ref 是必要的。但过度使用（~25 个 waveform hooks 中大量 ref）会导致：① React DevTools 不可见；② cleanup 遗漏风险；③ 时序 bug 难以调试。行业通行做法是：命令式库用 **thin adapter layer**（如 `useWaveformInstance` 统一管理 mount/destroy），而非分散在 10+ 个 hook 中。 |
| **Props drilling** | ⚠️ 已知债务 | 3-4 层 drilling 在小型应用中可接受，但 `ProjectPanel → EditorView → EditorSegmentWorkbench → SegmentRow` 链路过长。没有 Context 来避免中间层的重复渲染。 |
| **缺少状态选择器** | ⚠️ **设计不一致** | 行业通行（Zustand/Redux 都提供）的 selector 模式可以避免不必要的重渲染。当前任何 `useProjectController` 消费者都会收到全部 200+ 字段的更新通知。 |

---

## 3. 音频波形渲染链路

### 3.1 业内通行方案矩阵

| 方案 | 代表项目 | 长音频支持 | 性能 | 复杂度 |
|------|----------|------------|------|--------|
| **WaveSurfer.js** | 通用 Web | 需手动优化 | 中等 | 低 |
| **Peaks.js (BBC)** | 广播级应用 | 原生 | 高 | 中 |
| **自研 Canvas** | Descript, Adobe | 原生 | 极高 | 高 |
| **自研 WebGL** | 专业 DAW | 原生 | 极高 | 极高 |
| **WebCodecs + OffscreenCanvas** | 新一代方案 | 原生 | 高 | 中 |

**大型音频编辑器架构模式**：
1. **虚拟滚动**：只渲染视口内的波形数据（类似 react-window）
2. **LOD 层级**：不同缩放级别加载不同精度的峰值数据
3. **Worker 线程**：峰值计算在 Web Worker / Service Worker 中完成
4. **双缓冲 Canvas**：减少重绘闪烁

### 3.2 Rushi 当前方案

```
audio file → ffmpeg normalize → waveform peak generation (Rust/ffmpeg) → .dat file
                                                                  ↓
                                         PeakCache (LRU 16) ← 多 LOD 重采样
                                                                  ↓
                                         WaveSurfer.js.load(audio) + setPeaks()
                                                                  ↓
                                         自定义 Canvas segment overlays
```

### 3.3 对比结论

| 方面 | 状态 | 分析 |
|------|------|------|
| **WaveSurfer.js 选型** | ✅ 刻意设计 | 行业标准，社区活跃，插件丰富。对 1-2 小时音频足够。 |
| **预计算峰值 + .dat** | ✅ 刻意设计 | 与 Peaks.js、Descript 策略一致。避免全量加载 PCM 到内存。 |
| **PeakCache LRU(16)** | ⚠️ **可能不足** | 行业通行 LRU 大小通常为 32-64（参考 Peaks.js 默认）。当前 16 在频繁切换缩放时可能频繁驱逐。需性能测试验证。 |
| **Rust 端峰值计算** | ✅ 刻意设计 | ffmpeg/audiowaveform 在原生层计算，比 Web 端 Web Audio API 更快。 |
| **WaveSurfer 实例生命周期** | ⚠️ **风险区域** | 分散在 ~10 个 hook 中（mount/destroy/playback/zoom/scroll）。行业最佳实践是**单一 owner**（如 `useWaveformEngine` 统一管理）。当前模式容易在快速切换文件时产生实例泄漏（前一个未 destroy 完全，后一个已 mount）。 |
| **Scroll sync** | ⚠️ 经典难题 | React state ←→ DOM scroll 双向同步是行业公认难题。当前使用 ref + callback 模式，但代码审查应重点检查 race condition（快速滚动时 WaveSurfer 与 ruler 不同步）。 |
| **缺少 Web Worker** | ⚠️ 潜在优化 | 大文件峰值重采样可在 Worker 中进行，避免阻塞主线程。当前在主线程通过 WaveSurfer 处理。 |
| **`getDuration()` 调用** | ❌ **违反架构守卫** | AGENTS.md 明确禁止直接 `ws.getDuration()`，应使用 `resolveLayoutDurationSec`。需检查是否仍有违规。 |

---

## 4. 桌面端打包分发链路

### 4.1 业内通行方案矩阵

| 维度 | Tauri | Electron | Flutter | 行业趋势 |
|------|-------|----------|---------|----------|
| 包体积 | 小（~5MB+） | 大（~150MB+） | 中（~20MB+） | Tauri 增长中 |
| 启动速度 | 快 | 慢 | 快 | 原生优先 |
| 内存占用 | 低 | 高 | 中 | 低内存优先 |
| 生态成熟度 | 中 | 极高 | 高 | Electron 仍主导 |
| macOS 签名/公证 | 必须 | 必须 | 必须 | 无签名=不可用 |
| CI/CD | tauri-action | electron-builder | flutter build | 自动化 |

**macOS 桌面应用发布 checklist（行业通行）**：
1. Apple Developer ID 证书签名
2. Notary Service 公证（notarytool）
3. Entitlements（沙盒、网络、文件访问）
4. Info.plist 元数据完整
5. DMG / PKG 分发
6. Sparkle / Tauri updater 自动更新

### 4.2 Rushi 当前方案

```
Vite build → tauri build → bundle resources (sidecar + user-guide)
    ↓
NO code signing / NO notarization / NO entitlements
    ↓
GitHub Actions release.yml (build only, NO artifact upload)
```

### 4.3 对比结论

| 方面 | 状态 | 分析 |
|------|------|------|
| **Tauri v2 选型** | ✅ 刻意设计 | 比 Electron 体积小、启动快，适合 ASR 工具。Rust 后端性能更好。 |
| **PyInstaller sidecar** | ⚠️ 权衡设计 | 标准做法，但 1GB+ 体积是用户体验痛点。LRC 增量下载是缓解方案。 |
| **无代码签名** | ❌ **严重缺陷** | 行业绝对标准（macOS Gatekeeper、Windows SmartScreen）。当前未签名应用会被系统拦截。这是 R3h-I 明确要收的"签名/回滚型 release system"。 |
| **无公证** | ❌ **严重缺陷** | macOS 10.15+ 必须。用户需右键→"打开"才能启动。 |
| **无 entitlements** | ❌ **缺陷** | Tauri 默认 entitlements 不够。缺少麦克风访问（如果未来需要）、网络出站等声明。 |
| **CI 无产物上传** | ❌ **严重缺陷** | 行业通行（tauri-apps/tauri-action）自动 attach 到 GitHub Release。当前 build 后无处可下载。 |
| **版本号三处硬编码** | ⚠️ **流程缺陷** | 行业通行是单一真源（如 cargo-release、semantic-release）。当前 package.json/tauri.conf.json/Cargo.toml 各自为政。 |
| **生产 sourcemap** | ⚠️ **配置缺陷** | vite.config.ts `sourcemap: true` 会打包 .js.map 进生产包。行业通行是 `sourcemap: false` 或 external sourcemap（Sentry 等）。 |
| **Tauri v2 bundle targets** | ⚠️ 建议改进 | `targets: "all"` 在 v2.11 中语义为"当前平台默认值"。行业通行是显式数组，避免歧义。 |

---

## 5. LLM 集成/插件架构链路

### 5.1 业内通行方案矩阵

| 方案 | 成熟度 | 适用场景 | 2025 状态 |
|------|--------|----------|-----------|
| **直接 API 调用** | 极高 | 确定任务、单一 provider | 基础方案 |
| **MCP (Model Context Protocol)** | 高 | 多工具集成、agent 场景 | ⬆️ 行业标准（97M 月下载） |
| **LangChain/LangGraph** | 高 | 复杂编排、RAG | ➡️ 企业级 |
| **OpenAI Agents SDK** | 中 | 快速构建 agent | ⬆️ 增长 |
| **自研 plugin system** | 中 | 轻量、内聚 | ➡️ 定制场景 |

**MCP  adoption 数据（2025-2026）**：
- 月 SDK 下载量：97M（2026-02）
- 主要 provider 支持：Anthropic（原生）、OpenAI（Response API）、Google（GenAI）
- 主要桌面应用集成：Claude Desktop、Cursor、Windsurf、Zed

### 5.2 Rushi 当前方案

```
Frontend → Tauri invoke → Rust HTTP client → DeepSeek/Kimi API
                                    ↓
                              Ollama local (optional)
                                    ↓
                              Keyring (API key storage)

Plugin system:
  src/plugin-system/ (registry, loader, types)
  src/plugins/ (export-markdown, tts-demo — 仅 2 个)
```

### 5.3 对比结论

| 方面 | 状态 | 分析 |
|------|------|------|
| **直接 API 调用** | ✅ 刻意设计 | 任务确定（Stage B 润色、自动标点），不需要复杂编排。延迟低、可控性强。 |
| **多 provider 支持** | ✅ 刻意设计 | DeepSeek/Kimi/Ollama 覆盖云+本地，合理。 |
| **Keyring 存储** | ✅ 对齐最佳实践 | 行业通行（VS Code、Cursor 都用 keyring/system keychain）。 |
| **缺少 MCP** | ⚠️ **架构不一致** | MCP 已成为 LLM 工具集成的事实标准。当前如果用户想接入自有 LLM 能力（如企业知识库、代码生成），没有标准接口。但 Rushi 的 LLM 任务是固定的（转写后处理），暂不急需 MCP。建议 backlog 中记录：未来扩展 LLM 能力时评估 MCP。 |
| **Plugin system 未充分利用** | ⚠️ **设计债务** | 已投入架构成本（registry + loader + types），但仅有 2 个内置插件。如果短期内无第三方插件计划，当前架构是过度设计。如果计划开放插件生态，应提供文档和 SDK。 |
| **Cancel token 模式** | ✅ 对齐最佳实践 | 使用显式 cancel token 终止 LLM 请求，比 abort controller 更可控。 |
| **DOCX track-changes** | ✅ 差异化设计 | 行业少有开源方案能生成 Word track-changes（`w:ins`/`w:del`）。这是 Rushi 的差异化竞争力，应保留。 |
| **Prompt 管理** | ⚠️ 检查点 | 行业通行做法是：prompt 模板化 + 版本管理（如 LangChain PromptTemplate）。当前 prompt 硬编码在 Rust 文件中（`postprocess_config.rs`），修改需重新编译。建议：prompt 外置为资源文件，支持热更新。 |

---

## 6. 数据持久化/数据库链路

### 6.1 业内通行方案

| 方案 | 代表 | 适用场景 |
|------|------|----------|
| **SQLite + rusqlite** | 多数 Rust 桌面应用 | 小型本地数据库 |
| **DuckDB** | 分析型应用 | 列式、大数据量 |
| **sled/rocksdb** | KV 存储 | 高写入、简单查询 |
| **ORM (Sea-ORM/Diesel)** | 复杂关系模型 | 类型安全、迁移管理 |
| **JSON 文件** | 简单配置 | Obsidian 等 |

**SQLite 桌面应用最佳实践**：
- `PRAGMA busy_timeout = 5000` ✅ Rushi 已做
- WAL mode（`PRAGMA journal_mode = WAL`）提高并发
- 连接池（r2d2/sqlx）
- 迁移工具（refinery/diesel_migration）

### 6.2 Rushi 当前方案

- `rusqlite` 直连，无 ORM
- 单文件 `db.rs`（556 行）包含 schema + migrations
- 短连接模式（每次命令新建 connection）
- 内联 `#[cfg(test)]` 测试

### 6.3 对比结论

| 方面 | 状态 | 分析 |
|------|------|------|
| **SQLite 选型** | ✅ 刻意设计 | 桌面应用标准选择。Obsidian、VS Code（SQLite for search）都使用。 |
| **rusqlite 无 ORM** | ✅ 刻意设计 | ORM（Sea-ORM）对小型应用过重。手写 SQL 更可控。 |
| **短连接模式** | ⚠️ 性能风险 | 行业通行是连接池（r2d2-rusqlite）。当前每个 Tauri command 都 `open_db()`，频繁 open/close 有开销。但对于桌面应用（单用户、低并发），影响有限。 |
| **WAL mode** | ❓ 需检查 | `db.rs` 中未显式设置 `journal_mode = WAL`。如果没有 WAL，写入时会锁定整个数据库，可能影响转写大任务时的 UI 响应。 |
| **迁移内联** | ⚠️ 可维护性 | 行业通行是独立迁移文件（refinery/diesel）。当前 556 行的 `db.rs` 包含所有历史迁移，长期会膨胀。但 AGENTS.md 允许单文件 ≤500 行时考虑拆分，db.rs 已接近阈值。 |
| **事务一致性** | ⚠️ 检查点 | 多步骤写入（如 bundle import）需显式 transaction。审查时应检查 `BEGIN`/`COMMIT`/`ROLLBACK` 的完整性。 |

---

## 7. 总结：对齐 vs 不一致矩阵

| 链路 | 已对齐（✅） | 不一致（⚠️/❌） | 刻意设计 vs 缺陷 |
|------|-------------|-----------------|------------------|
| **ASR 选型** | FunASR 中文效果、HTTP sidecar、Tauri proxy | Linux stub、CI 缺 Win/mac sidecar、首次模型下载体验 | FunASR = 刻意；CI 缺口 = **缺陷** |
| **状态管理** | 无全局库、controller 模式 | mega-hook、ref 过度使用、缺 selector、props drilling | controller = 刻意；mega-hook = **技术债务** |
| **波形渲染** | WaveSurfer.js、预计算峰值、Rust 端生成 | WaveSurfer 实例生命周期分散、LRU(16) 可能不足、缺 Worker | 预计算 = 刻意；实例管理 = **风险** |
| **打包分发** | Tauri v2、PyInstaller | 无签名/公证、无 entitlements、CI 无产物上传、sourcemap | Tauri = 刻意；签名缺失 = **严重缺陷** |
| **LLM 集成** | 直接调用、keyring、cancel token、DOCX track-changes | 缺 MCP、plugin system 未充分利用、prompt 硬编码 | 直接调用 = 刻意；prompt 硬编码 = **可维护性缺陷** |
| **数据库** | SQLite、rusqlite、busy_timeout | 可能缺 WAL、短连接无连接池、迁移内联 | SQLite = 刻意；WAL/连接池 = **潜在性能缺陷** |

---

## 8. 建议行动

### P0（阻塞发版）
1. macOS 代码签名 + 公证
2. CI release 产物上传
3. Windows/macOS CI sidecar 构建

### P1（架构改进）
4. `useProjectController` 拆分为 selector/subscription 模式
5. WaveSurfer 实例生命周期集中管理（单一 owner hook）
6. 数据库启用 WAL mode + 评估连接池
7. Prompt 外置为资源文件

### P2（体验优化）
8. PeakCache LRU 上限调优（性能测试）
9. 首次启动后台静默模型预下载
10. 评估 MCP 集成（backlog）

### P3（长期技术债）
11. db.rs 迁移拆分为独立文件
12. Plugin system 文档化或简化
13. 版本号单一真源自动化

# Rushi 代码审查综合报告

> 审查日期：2026-05-12  
> 审查范围：前端 TS/React (~5,000 行)、Rust Tauri (~1,400 行)、Python ASR (~1,300 行)  
> 审查策略：四轮递进（契约层 → 状态并发层 → 边界防御层 → 工程精进层）

---

## 执行摘要

| 优先级 | 数量 | 典型风险 |
|--------|------|----------|
| 🔴 高 | 28 | 数据丢失、内存耗尽、类型契约裂口、竞态条件、路径遍历 |
| 🟡 中 | 32 | 线程阻塞、资源泄漏、测试缺失、边界校验不足 |
| 🟢 低 | 18 | 代码重复、魔法数、日志轮转、可移植性 |

**最紧急的 5 项**（建议立即修复）：
1. Python `app.py` 同步阻塞事件循环 + 上传文件全量读内存（OOM + 拒绝服务）
2. Rust `p1_project_run_transcribe` 非原子两段式操作（ASR 结果可能永久丢失）
3. Rust `p1_project_delete` 符号链接绕过 + 文件删除失败导致数据不一致
4. 前端 `flushP1SegmentTextDraftsFromDom` 在 React updater 内嵌 DOM 查询（并发不安全）
5. Python `model_manifest_verify.py` 大文件 SHA256 全量读内存（OOM）

---

## 🔴 高优先级问题

### 一、前端 ↔ Rust 契约裂口

#### 1. `TranscriptionSegment.detail` 不接受 `null`，与 Rust `Option<String>` 冲突
- **文件**: `apps/desktop/src/contracts/transcription.ts:22`
- **问题**: `detail?: string` 仅接受 `string | undefined`，但 Rust `SegmentDto.detail: Option<String>` 序列化 `None` 为 JSON `null`。前端赋值时产生类型冲突。
- **修复**: 改为 `detail?: string | null`。

#### 2. `TranscriptionSegment.confidence` 必填性与 Rust `Option<f64>` 不一致
- **文件**: `apps/desktop/src/contracts/transcription.ts:18`
- **问题**: `confidence: number | null` 是必填字段，但 Rust 端带有 `#[serde(default)]`，允许完全缺失。
- **修复**: 统一为 `confidence?: number | null`。

#### 3. `isTranscriptionResult` 类型守卫形同虚设
- **文件**: `apps/desktop/src/contracts/transcription.ts:57-68`
- **问题**: 不验证 `segments` 数组元素字段（`start_sec`、`end_sec`、`text`），也不验证 `error` 字段形状。
- **修复**: 增加递归字段校验。

---

### 二、前端 React 状态与并发

#### 4. `flushP1SegmentTextDraftsFromDom` 在 `setSegments` updater 内部执行 DOM 查询
- **文件**: `apps/desktop/src/pages/useProjectP1Controller.ts:96-112`
- **问题**: updater 应当是纯函数，DOM 查询属于副作用。React 并发模式下可能被中断/重执行，读取到错误草稿值。
- **修复**: DOM 读取移到 `flushSync` / `setSegments` 之前，先收集变更再批量写入。

#### 5. `updateSegmentText` 在 `setSegments` updater 中调用副作用 `pushUndoForTextEdit`
- **文件**: `apps/desktop/src/pages/useProjectP1Controller.ts:460-473`
- **问题**: updater 可能被并发模式多次调用，导致 undoStack 被重复 push。
- **修复**: 副作用移到 updater 外部，基于 `segmentsRef.current` 判断后再 push。

#### 6. `saveSegments` 成功后清空 undo，若 reload 失败则 undo 永久丢失
- **文件**: `apps/desktop/src/pages/useProjectP1Controller.ts:420-440`
- **问题**: `undoStack.current = []` 在 `p1ProjectSaveSegments` 成功后立即执行，随后 `p1ProjectLoad` 若失败，用户无法撤销本地修改。
- **修复**: 清空逻辑移到 `applyDetail(d)` 成功之后。

#### 7. `useProjectWaveform.ts` 双重 RAF 竞态
- **文件**: `apps/desktop/src/hooks/useProjectWaveform.ts:405-413`
- **问题**: 嵌套 `requestAnimationFrame` 在 effect cleanup 后仍可能执行，错误重置 `syncingRegionsRef`。
- **修复**: 存储 RAF id 并在 cleanup 中 `cancelAnimationFrame`。

---

### 三、Rust 后端数据一致性

#### 8. `p1_project_run_transcribe` 两段式操作非原子，ASR 结果可能丢失
- **文件**: `apps/desktop/src-tauri/src/p1.rs:366-500`
- **问题**: ASR 请求成功后解析 segments 存入内存，随后 `project_save_segments_inner` 若失败（磁盘满、SQLITE_BUSY），内存结果丢失，用户必须重新转写。
- **修复**: 先写原始 ASR 响应到临时备份文件，保存成功后再删除；或保存失败时将 segments 随 Err payload 返回供前端重试。

#### 9. `p1_project_delete` 先删数据库后删文件，符号链接可绕过防护
- **文件**: `apps/desktop/src-tauri/src/p1.rs:514-539`
- **问题**: 
  - `starts_with` 不解析符号链接，攻击者可构造 symlink 绕过路径检查；
  - `remove_dir_all` 结果用 `let _ =` 忽略，文件删除失败但数据库记录已不可恢复。
- **修复**: 使用 `canonicalize` 后比较；软删除策略（`deleted_at_ms`）+ 后台垃圾回收。

#### 10. `p1_project_create` 先复制文件后写数据库，失败产生孤儿目录
- **文件**: `apps/desktop/src-tauri/src/p1.rs:301-326`
- **问题**: `fs::copy` 成功后数据库 `INSERT` 才可能失败，已复制的音频文件成为孤儿。
- **修复**: 数据库失败时主动 `remove_dir_all(&dest_dir)`。

#### 11. `open_db` 未设置 `busy_timeout`，并发写入立即失败
- **文件**: `apps/desktop/src-tauri/src/p1.rs:72-77`
- **问题**: SQLite 默认 `busy_timeout = 0`，并发写入返回 `SQLITE_BUSY`。
- **修复**: 添加 `PRAGMA busy_timeout = 5000;`，评估启用 WAL 模式。

#### 12. `append_desktop_log_line` 多线程并发追加导致日志行交错
- **文件**: `apps/desktop/src-tauri/src/p1.rs:28-43`
- **问题**: 多线程同时 `writeln!`，多次 `write` 系统调用之间会与其他线程交错。
- **修复**: 用 `Mutex` 保护日志句柄，或先 `format!` 整行再单次 `write_all`。

---

### 四、Rust 阻塞与资源

#### 13. `post_transcribe_multipart` 使用 `reqwest::blocking` 阻塞 Tauri 线程池
- **文件**: `apps/desktop/src-tauri/src/p1.rs:180-191`
- **问题**: timeout 最长 600 秒，大文件上传/下载会耗尽 Tauri 命令线程池，导致 UI 假死。
- **修复**: 改为异步 `reqwest` + `tokio::time::timeout`，或 offload 到独立线程。

#### 14. `is_allowed_stt_transcribe_url` 手工解析 URL 存在 SSRF 风险
- **文件**: `apps/desktop/src-tauri/src/p1.rs:143-162`
- **问题**: 未使用正规 URL 解析器；`http://127.0.0.1:80@evil.com/` 被误判为本地地址，实际连接到 `evil.com`。
- **修复**: 使用 `url::Url::parse` 正规解析后比较 `host`。

#### 15. `p4_diagnostic.rs` 日志打包跟随符号链接，可泄露外部敏感文件
- **文件**: `apps/desktop/src-tauri/src/p4_diagnostic.rs:96-126`
- **问题**: `p.is_file()` 跟随符号链接，攻击者可在 logs 目录下放置指向 `/etc/passwd` 的 symlink 并被打包。
- **修复**: 用 `symlink_metadata` 显式跳过符号链接。

---

### 五、Python ASR 服务

#### 16. `app.py` `async def` 端点直接执行同步 CPU/IO 链路，阻塞事件循环
- **文件**: `services/asr/rushi_asr/app.py:113-128`
- **问题**: `transcribe_upload` 内部包含 `subprocess.run` 等待 FFmpeg 和 PyTorch 推理，整个 ASGI 服务器在此期间无法响应任何请求。
- **修复**: 使用 `starlette.concurrency.run_in_threadpool` 包裹同步调用。

#### 17. `funasr_engine.py` 模型单例初始化无锁保护
- **文件**: `services/asr/rushi_asr/funasr_engine.py:22-42`
- **问题**: 并发请求同时进入 `_get_model` 时可能创建多个 `AutoModel` 实例，重复消耗内存和时间。
- **修复**: 引入 `threading.Lock` + 双重检查锁定。

#### 18. `app.py` 上传文件无大小限制，全量读入内存
- **文件**: `services/asr/rushi_asr/app.py:126-127`
- **问题**: `await file.read()` 将完整上传文件加载到内存；无大小限制，攻击者可上传超大文件导致 OOM。
- **修复**: 分块流式写入磁盘；添加 `max_file_size` 限制。

#### 19. `model_manifest_verify.py` 大文件哈希全量读内存
- **文件**: `services/asr/rushi_asr/model_manifest_verify.py:37-38`
- **问题**: `fp.read_bytes()` 一次性将整个模型文件（数 GB）读入内存计算 SHA256。
- **修复**: 分块流式读取。

#### 20. `model_manifest_verify.py` `startswith` 路径遍历可绕过
- **文件**: `services/asr/rushi_asr/model_manifest_verify.py:32-34`
- **问题**: `rel=../model_backup/malicious` 解析后仍可能以 `model_dir` 开头，检查被绕过。
- **修复**: 使用 `Path.relative_to` 严格校验子路径关系。

---

### 六、前端边界空值

#### 21. `P1SegmentTimelineCard.tsx` `s.text.replace` 未做空值保护
- **文件**: `apps/desktop/src/components/P1SegmentTimelineCard.tsx:49`
- **修复**: `const safeText = (s.text ?? "").replace(...)`。

#### 22. `exportFormatters.ts` `s.text.replace` 未做空值保护
- **文件**: `apps/desktop/src/services/exportFormatters.ts:39`
- **修复**: 同上。

---

### 七、工程化

#### 23. `useProjectP1Controller.ts` 核心 hook 完全无测试
- **文件**: 缺失
- **问题**: 951 行核心状态管理 hook（undo/redo、segment CRUD、导出、ASR 健康）无任何单元测试。
- **修复**: 补充 vitest 测试，覆盖状态流转和边界条件。

#### 24. `flushP1SegmentTextDraftsFromDom` 每次 O(n) DOM query
- **文件**: `apps/desktop/src/pages/useProjectP1Controller.ts:104-120`
- **问题**: 1000+ 语段时每次操作产生 1000+ 次 `querySelector`。
- **修复**: 用 `Map<number, string>` 维护 textarea draft，blur 时同步。

#### 25. Vite 生产构建无 source map
- **文件**: `apps/desktop/vite.config.ts`
- **问题**: `build.sourcemap` 默认 `false`，生产环境崩溃无法映射回原始代码。
- **修复**: 添加 `build: { sourcemap: true }`。

#### 26. `zip` crate 0.6 存在已知安全漏洞
- **文件**: `apps/desktop/src-tauri/Cargo.toml`
- **问题**: `zip = "0.6"` 含已知 path traversal 漏洞，应升级至 2.x。
- **修复**: 升级并验证兼容性。

#### 27. `append_desktop_log_line` 日志文件无限增长
- **文件**: `apps/desktop/src-tauri/src/p1.rs:30-45`
- **问题**: 无轮转、无上限，长期运行可能耗尽磁盘。
- **修复**: 写入前检查大小，超过阈值（如 10MB）执行轮转。

#### 28. `probeOnlineStt` 完全无 try-catch，按钮永久卡死
- **文件**: `apps/desktop/src/components/P1EnvironmentPanel.tsx:97-111`
- **问题**: 异步函数无异常处理，`setOlProbeBusy(false)` 在抛错后永不执行。
- **修复**: 添加 `try/finally`。

---

## 🟡 中优先级问题（精选）

### 前端

| # | 文件 | 问题 | 修复方向 |
|---|------|------|----------|
| 29 | `useProjectP1Controller.ts:601-661` | `mergeWithPrevAt` / `mergeWithNextAt` 大量重复 | 提取 `mergeSegments` 公共函数 |
| 30 | `useProjectP1Controller.ts:530-599` | `splitAtSelection` / `splitAtPlayhead` 几乎完全重复 | 提取 `doSplitAt` |
| 31 | `useProjectP1Controller.ts:435,557,594...` | `reindexSegments` 模式在 10+ 处重复 | 提取 `reindexSegments` 工具函数 |
| 32 | `useProjectP1Controller.ts:207-299` | `prepareDefaultFunasrModel` 无 `AbortController` | 添加 signal + 卸载保护 |
| 33 | `useProjectP1Controller.ts:697-739` | `insertSegmentAfter` 的 `gap` 未校验 `Number.isFinite` | 增加 NaN 防御 |
| 34 | `useProjectP1Controller.ts:26-29` | `safeExportBasename` 未覆盖控制字符、Windows 保留名 | 增强过滤规则 |
| 35 | `P1SegmentContextMenu.tsx:37` | 右键菜单位置无视口边界校正 | 根据 `window.innerWidth/Height` 钳制 |
| 36 | `useProjectP1Controller.ts:82-83` | `busy` / `busyReason` 双状态非原子 | 合并为单一 state |
| 37 | `useP1TranscriptionLayer.ts:414-417` | `scrollIntoView` 用 `useEffect` 时序不可靠 | 改用 `useLayoutEffect` |
| 38 | `P1EnvironmentPanel.tsx:76,86,105` | 超时阈值多处硬编码 | 提取具名常量 |

### Rust

| # | 文件 | 问题 | 修复方向 |
|---|------|------|----------|
| 39 | `p1.rs:46-70` | `glossary_hotwords_joined` 12KB 截断可能产生残缺热词 | 截断到最近空格处 |
| 40 | `p1.rs:95-107` | `detail` 空字符串 vs `None` 语义往返丢失 | 统一为 `TEXT` 可 NULL 或统一用 `String` |
| 41 | `p1.rs:584-589` | `p2_glossary_add` 通过字符串匹配判断唯一性冲突 | 匹配 `SQLITE_CONSTRAINT_UNIQUE` 错误码 |
| 42 | `p1.rs:983-991` | `p1_export_text_file` 直接覆盖目标文件无确认 | 检查 `path.exists()` 并提示 |
| 43 | `asr_sidecar.rs:225,245` | 健康探测 TOCTOU，端口被抢占时误判 | 验证响应 JSON 含 ASR 标识字段 |
| 44 | `asr_sidecar.rs:298-309` | 子进程异常退出后未收割，可能成僵尸 | 后台线程轮询 `try_wait()` |
| 45 | `export_docx.rs:59-66` | `sanitize_title` 未转义 XML 特殊字符 | 转义 `& < > "` |
| 46 | `export_docx.rs:19-33` | lecture 模式大项目全内存构建 | 限制 segment 数量或分块写入 |
| 47 | `p4_diagnostic.rs:35` | zip 打包失败残留不完整文件 | 先写 `.tmp` 再 `rename` |
| 48 | `p1.rs:172` | 每次转写新建 `reqwest::blocking::Client` | 模块级缓存 Client |

### Python ASR

| # | 文件 | 问题 | 修复方向 |
|---|------|------|----------|
| 49 | `app.py:123` | `tempfile.mkdtemp` 在 `async def` 中为同步调用 | `asyncio.to_thread(...)` |
| 50 | `funasr_engine.py:96-97` | `language` 参数未做有效性校验 | 维护允许列表 |
| 51 | `funasr_engine.py:58-60` | 毫秒/秒启发式阈值 `2000` 武断 | 降低阈值并增加保护 |
| 52 | `funasr_engine.py:117-119` | 嵌套 fallback 未处理二次异常 | 统一外层捕获 |
| 53 | `engine.py:38-50` | FFmpeg 失败后部分残留文件未清理 | `except` 分支中 `unlink` |
| 54 | `engine.py:52-54` | 损坏/空音频未提前拒绝 | `duration <= 0` 时提前返回错误 |
| 55 | `schemas.py:17-23` | 缺少 `start_sec < end_sec` 验证 | 添加 Pydantic `@field_validator` |
| 56 | `schemas.py:21` | `confidence` 缺少 `0~1` 范围约束 | `Field(ge=0, le=1)` |
| 57 | `model_prepare.py:106` | `snapshot_download` 无网络超时 | 设置 `timeout` 参数 |
| 58 | `runtime_caps.py:15-21` | 每次 `/health` 都重新尝试动态导入 | 模块级缓存导入结果 |
| 59 | `funasr_engine.py:104-117` | `model.generate()` 线程安全性未知 | 添加推理线程锁 |

---

## 🟢 低优先级问题（列表）

**前端**
- `main.tsx` `document.getElementById("root") as HTMLElement` 掩盖 null
- `App.tsx` `invoke("app_version")` 无 mounted guard
- `P1ResizeBottomHit.tsx` 硬编码 `height: 12`
- `safeExportBasename` 未处理连续下划线与空名
- `formatSrtTime` 对非有限值的处理未在测试中覆盖
- `formatMediaTime` 极大值精度丢失
- `P1WaveformTimeRuler` 极端媒体时长可能生成过多 ticks
- `deleteSegmentAt` 的 `setSelectedIdx` 最终缺少钳制
- `p1BoundsSignature.ts` `roundSec3` 未防御 `NaN`
- `cloneSegments` 浅拷贝注释缺失
- `undoStack` 硬编码 40 层且 `shift()` 为 O(n)
- `document.querySelector([data-p1-seg-row="..."])` 多处硬编码
- `tsconfig.json` 缺少 `sourceMap`

**Rust**
- `db.rs` 迁移连接上的 `PRAGMA foreign_keys = ON` 随连接关闭即失效（无害）
- `p4_diagnostic.rs` `u64 as usize` 32 位截断风险
- `p1_pick_audio_path` 返回路径可被前端篡改回传
- `reveal_path_in_file_manager` 命令参数注入风险（`-` 开头路径）
- `now_ms()` `unwrap_or(0)` 回退语义危险
- `p1_retry_bundled_asr_sidecar` 返回 `()` 不统一
- `GlossaryTermDto.id` `number` ↔ `i64` 精度风险
- `P3DocxExportMode` Rust 端使用裸 `String`
- `BundledAsrLaunchReport.detail` TS 类型包含不可能的 `null`
- `table_columns` `format!("PRAGMA table_info({table})")` 字符串拼接风险（当前调用安全）

**Python**
- `ffmpeg_audio.py` `capture_output=True` 可能将大量 stderr 读入内存
- `engine.py` `duration_sec` 未从 segments 计算（语义需确认）
- `app.py` `UploadFile` 未显式关闭

---

## 修复优先级建议

### P0 — 本周内修复（数据安全 + 稳定性）
1. Python `app.py` 添加 `run_in_threadpool` + 上传文件大小限制 + 流式写入
2. Rust `p1_project_run_transcribe` 添加 ASR 结果临时备份或失败返回 segments
3. Rust `p1_project_delete` 改为软删除 + `canonicalize` 路径校验
4. 前端 `flushP1SegmentTextDraftsFromDom` 将 DOM 读取移到 updater 外
5. Python `model_manifest_verify.py` 分块哈希 + `relative_to` 路径校验
6. Rust `open_db` 添加 `PRAGMA busy_timeout`

### P1 — 两周内修复（健壮性 + 用户体验）
7. 前端 `prepareDefaultFunasrModel` 添加 `AbortController`
8. Rust `post_transcribe_multipart` 改为异步或独立线程
9. Rust `is_allowed_stt_transcribe_url` 使用 `url::Url` 正规解析
10. Rust `p4_diagnostic.rs` 跳过符号链接
11. 前端 `isTranscriptionResult` 完善类型守卫
12. Rust `append_desktop_log_line` 添加日志轮转或上限
13. Python `funasr_engine.py` 添加模型初始化锁

### P2 — 一个月内修复（工程化 + 可维护性）
14. 提取 `reindexSegments`、`mergeSegments`、`doSplitAt` 等公共函数
15. 补充 `useProjectP1Controller` 核心 hook 的 vitest 测试
16. 前端 `updateSegmentText` 副作用外移
17. `zip` crate 升级至 2.x
18. Vite 生产构建开启 source map
19. 合并 `busy` / `busyReason` 为单一 state
20. Python `schemas.py` 添加字段校验器

---

*报告结束*

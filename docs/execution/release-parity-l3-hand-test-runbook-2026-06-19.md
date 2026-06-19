# Release Parity L3 手测 Runbook — 2026-06-19

> 用途：给测试人按顺序执行安装包 UI 手测。正式勾选仍回填到 [`release-parity-l3-hand-test-checklist-2026-06-14.md`](./release-parity-l3-hand-test-checklist-2026-06-14.md)，结果汇总到 [`release-parity-evidence-2026-06-14.md`](./release-parity-evidence-2026-06-14.md)。  
> 原则：必须测 **release `.app` / DMG 安装副本**，不能用 `npm run desktop:dev` 或浏览器 Playwright 代替。

## 0. 测试范围

本轮目标是补齐 L3 人工证据：

- ASR chip / LLM chip 路由是否落到正确设置页。
- release 安装包主路径：导入音频、波形、转写、取消、导出、重开项目。
- WKWebView / bundled sidecar 专项：关于页、诊断包、复制版本信息、无 dev 文案。
- copy-code-drift 动态项 7-A–7-D：快捷键、ASR 能力、STT/LLM gate、导出/质量。
- fresh profile：空 App Data 首启与一键准备。

不测项：

- 不测试 Qwen3 ASR / `qwen-asr` / forced aligner。本轮已放弃当前发布支持，release 侧车只按当前 FunASR/Paraformer 主路径验收。
- 不用 Windows/CUDA lock 审计替代本 macOS L3 UI 手测。

## 1. 准备

1. 确认机器门禁已绿：

```bash
npm run typecheck
npm run test
npm run lint
node scripts/check-architecture-guard.mjs
bash scripts/release-postbuild-verify.sh
```

2. 准备测试包：

```bash
# 已有 release .app 时可直接打开
npm run desktop:open-release-app

# 若需要重编包，先走 release 构建路径
npm run asr:build-sidecar-unix
npm run release:sidecar-preflight
npm run desktop:build-app
bash scripts/release-postbuild-verify.sh
```

3. 开始测试前记录：

- 日期 / 测试人
- App 路径
- App 版本
- Git SHA（关于页或 sidecar stamp）
- macOS 版本
- Profile：`fresh` 或 `upgrade`
- 是否有网络（fresh 一键准备需要下载模型，已有模型缓存可注明）

## 2. 推荐执行顺序

先跑 upgrade profile，确认现有用户数据不会坏；再跑 fresh profile，确认新用户路径可走通。

### 2.1 Upgrade Profile

使用当前主 App Data，打开 release `.app`。

1. 打开设置 → 关于，记录版本、数据目录、`bundled_sidecar_build`。
2. 点击“复制版本信息”，确认复制内容含 shell/profile/sidecar stamp。
3. 导出诊断 zip，确认 `build-info.txt` 含 `bundled_sidecar_build`。
4. 打开或新建项目，导入一段 mp3/wav。
5. 等待 30s 内波形出现；seek 到中间，确认播放头左右都有波形。
6. 开始本机 ASR 转写，确认语段出现。
7. 转写中执行停止/取消，确认编辑器恢复可操作。
8. 导出 Word/DOCX，打开文件确认可读。
9. Cmd+Q 完全退出，再重开同项目，确认项目、音频、波形仍加载。
10. 导入第二个音频或打开第二项目，确认波形无需重启 App。

### 2.2 Fresh Profile

首选交互脚本启动隔离 HOME，避免污染主 App Data：

```bash
bash scripts/r3f-fresh-appdata-hand-test.sh --interactive
```

脚本启动 release `.app` 后，在 UI 内执行：

1. 空 App Data 首启，Welcome 正常。
2. 进入设置 → 本机 ASR。
3. 点击“一键准备本机 ASR”。
4. 等待完成；脚本会轮询 `/health`，看到 `ready_for_transcribe` 后通过。
5. 确认状态行：环境 / FFmpeg / 运行时 / 转写为绿色或可操作中文。
6. 继续走 upgrade 的导入、波形、转写、导出主路径。

不要用 `--skip-download` 作为 L3 fresh 签收，它只能证明侧车启动，不能证明 UI 一键准备。

## 3. 重点勾选项

按原表逐项回填：

- A1–A4：ASR chip 必须进“本机 ASR”，LLM chip 必须进“LLM 配置”，普通设置不应被上一次 chip 路由污染。
- B1–B11：导入、波形、转写、取消、导出、重开、后处理文案。
- C1–C7：关于页、复制版本信息、诊断 zip、无 `npm run` / `desktop:dev` 文案、列表和元数据交互。
- D1–D8：快捷键显示与实际行为一致。
- E1–E6：ASR 未准备 / 准备完成 / stale sidecar / 热词超限等能力状态文案。
- F1–F5：在线 STT / LLM gate 文案可操作，无 dev 指令泄漏。
- G1–G3：DOCX、质量评测、Hub 管理确认框。
- H1–H4：fresh 专项。

可 N/A：

- 在线 STT 有 Key 才测 F2；没有 Key 时标 N/A，并记录“本轮无在线 STT Key”。
- Stage B / LLM 未配置时，B10/B11/F4/F5 可标 N/A，但必须确认 gate 文案可操作。
- ffmpeg 异常模拟 S4 若无法安全模拟，可标 N/A，并依赖 packaged ffmpeg 的 postbuild verify 证据。

## 4. 失败记录格式

发现 WARN / FAIL 时，不要只写“失败”，按这个格式记录：

```text
ID: B1 / C3 / E2 ...
Profile: fresh / upgrade
App path:
App version:
Git SHA:
操作:
实际结果:
期望结果:
截图/诊断 zip:
desktop.log 关键词:
是否 blocker: yes/no
备注:
```

常用日志：

```text
~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log
```

常搜关键词：

- 波形 / asset：`asset_scope_ok`, `ui waveform`, `peaks`
- 侧车：`bundled_sidecar`, `sidecar`, `ready_for_transcribe`
- 选择/性能：`selection-profile`
- 文案泄漏：`npm run`, `desktop:dev`, `tauri dev`

## 5. 签收回填

完成手测后更新：

1. 在 [`release-parity-l3-hand-test-checklist-2026-06-14.md`](./release-parity-l3-hand-test-checklist-2026-06-14.md) 填签收头、勾选结果、WARN、Blocker、结论。
2. 在 [`release-parity-evidence-2026-06-14.md`](./release-parity-evidence-2026-06-14.md) 追加本次 L3 结果摘要。
3. 若 7-A–7-D 全部通过，更新 [`copy-code-drift-register-2026-06-12.md`](./specs/copy-code-drift-register-2026-06-12.md) 的动态列。
4. 若无 blocker，可把结论改为 **L3 Go**；若有 blocker，保持 **No-Go** 并列出阻塞项。

## 6. 最小通过标准

L3 Go 必须满足：

- upgrade profile 主路径 B1–B9 全通过。
- fresh profile H1–H4 全通过，或有明确理由说明本轮不是 fresh 发版目标。
- 关于页、复制版本信息、诊断 zip 三项全通过。
- UI 中无 `npm run` / `desktop:dev` / `tauri dev` 面向用户文案泄漏。
- ASR selected model 状态不能出现“未准备但显示可转写”的误报。
- 有任何会阻断导入、转写、导出、重开项目的缺陷时，结论必须是 No-Go。

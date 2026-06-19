# Release parity L3 手测勾选表

> **用途**：在 **release `.app` / DMG** 上逐项勾选（勿用 `npm run desktop:dev`）。执行顺序见 [L3 手测 Runbook 2026-06-19](./release-parity-l3-hand-test-runbook-2026-06-19.md)。  
> **关联**：[release-parity-evidence-2026-06-14.md](./release-parity-evidence-2026-06-14.md) · [copy-code-drift-register](./specs/copy-code-drift-register-2026-06-12.md) 7-A–7-D · [release-zero-terminal-hand-test.md](./release-zero-terminal-hand-test.md)

## 签收头

| 项 | 填写 |
|----|------|
| 日期 | |
| 测试人 | |
| App 路径 | `如是我闻.app` / DMG 安装副本 |
| App 版本 | |
| Git SHA（关于页 / stamp） | |
| macOS 版本 | |
| Profile | ☐ fresh（空 App Data） ☐ upgrade（有旧项目） |
| 打开方式 | `npm run desktop:open-release-app` / Applications |

**L2 已绿（勿重测）**：`release:postbuild-verify` · `v1-release-installed-smoke` — 见 [evidence](./release-parity-evidence-2026-06-14.md)

---

## A. 本轮修复（ASR chip 路由）

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| A1 | 顶栏点 **ASR chip**（黄/红/未就绪） | 设置 → **本机 ASR** | |
| A2 | 关掉设置，点 **LLM chip** | 设置 → **LLM 配置** | |
| A3 | 关掉设置，点工具栏 **设置**（⌘,） | 打开设置，**不**莫名落在 LLM | |
| A4 | 先点过 LLM chip 后，再点 ASR chip | 仍进 **本机 ASR**（非 LLM） | |

---

## B. 主路径（release-zero §2–6）

### B1 导入与波形

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| B1 | 新建或打开项目 → 导入 mp3/wav | 30s 内波形出现，非「正在加载波形…」卡死 | |
| B2 | 若失败 banner | 文案可操作（重试侧车 / 重新安装），**无** `npm` / `desktop:dev` | |
| B3 | Seek 播放头到中间 | playhead **左右**均有波形 | |

### B2 转写

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| B4 | 对导入音频开转写 | 语段出现 | |
| B5 | 无「缺少 async 路由」类硬错误 | 或有明确 UI 修复路径 | |
| B6 | 停止 / 取消转写 | 编辑器状态恢复 | |

### B3 导出与持久化

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| B7 | 导出 Word（或主路径 DOCX） | 成功 | |
| B8 | Cmd+Q 完全退出 → 重开同一项目 | 项目、文件、波形仍加载 | |
| B9 | 第二项目再导入音频 | 波形无需重启 App | |

### B4 后处理（若已配置 Stage B / LLM）

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| B10 | 转写后 Stage B 对话框 | 能打开；文案无 dev 命令 | |
| B11 | LLM 相关 gate | 无 `npm run desktop:dev` | |

---

## C. WKWebView / 安装包专项（§7 + dmg-vs-dev）

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| C1 | 设置 → **关于** | 版本、数据目录、`bundled_sidecar_build`（`git_sha=…`） | |
| C2 | 关于 → **复制版本信息** | 含侧车 stamp / shell 信息 | |
| C3 | 导出诊断 zip | `build-info.txt` 含 `bundled_sidecar_build` | |
| C4 | 环境页全文扫一眼 | **无** `npm run` / `desktop:dev` | |
| C5 | 语段列表 ↑↓ 连按 10 次 | 跟手，无明显卡死 | |
| C6 | 项目元数据 **年月 / 日期** | 键盘可输入 | |
| C7 | 语段列表 UI | 备注与状态标签不重叠 | |

---

## D. 7-A 快捷键动态（copy-code-drift D1–D8）

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| D1 | 编辑器工具栏 hover「设置」 | title 含 **⌘,** | |
| D2 | Welcome 侧栏「设置」 | 同 D1 | |
| D3 | 环境 → **快捷键** 表 | 与 D1 键位一致 | |
| D4 | 语段右键「合并下一条」 | hint **⌘J** | |
| D5 | 底栏快捷键轮换 | 与 registry footer 一致 | |
| D6 | Esc（有浮动面板 / 确认框时） | 关闭或取消；关文件 gate 留在编辑器 | |
| D7 | 波形区 Esc（无对话框） | 清除多选，非关面板 | |
| D8 | 语段正文 ↑↓ | 与设置表「语段正文」行为一致 | |

---

## E. 7-B ASR 能力动态（S1–S6）

> **S1/S3** 建议在 **fresh** 或删 App Data 后测；**upgrade** 可标 N/A 并注明原因。

| # | 场景 | UI 应显示 | 不应显示 | ☐ |
|---|------|-----------|----------|---|
| S1 | 冷启动 release，模型未准备 | chip 黄/红；blockReason 可操作 | `npm run …` | |
| S2 | D1=Paraformer，D2=SenseVoice（不一致） | 「应用并重启侧车」类提示 | 「100% 已就绪」误报 | |
| S3 | 一键准备完成 | chip 绿；与所选模型可转写一致 | 全局 ready 误报 | |
| S4 | ffmpeg 异常（若可模拟） | packaged ffmpeg 修复文案 | 误导「单独装 ffmpeg」 | |
| S5 | 8741 被 dev 侧车占用 + 开 release app | stale/adopt 说明 | 「bundled 正常」误导 | |
| S6 | 热词超 12k（若有项目） | 截断/toast 有说明 | 静默截断 | |

---

## F. 7-C STT / LLM 动态（D1–D5）

| # | 场景 | 期望 | ☐ |
|---|------|------|---|
| F1 | 无在线 STT Key 点转写 | preflight 文案 + 可跳设置 | |
| F2 | 有 Key 时在线转写（若可测） | 与 adapter 行为一致 | |
| F3 | 转写进行中尝试离开编辑器 | gate 文案合理 | |
| F4 | Ollama 未启动（本机 LLM） | LLM chip + 后处理提示可操作 | |
| F5 | Stage B Consent（若启用） | 「发送云端 LLM」与字段一致 | |

---

## G. 7-D 导出 / 质量（动态抽检）

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| G1 | DOCX 导出（与 B7 重叠） | 文件可打开，版式正常 | |
| G2 | 设置 → **质量评测** Tab | 指标说明与 eval 输出不矛盾 | |
| G3 | Hub 重命名 / 删除（可选） | 确认框文案合理 | |

---

## I. 浮动对话框壳层贴合（FLOAT-FIT）

> Spec：[floating-dialog-fit-unification-acceptance.md](./specs/floating-dialog-fit-unification-acceptance.md) · Editor 内 **Auto-fit**；导出/批量等 **Fill**

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| I1 | Editor → **查找替换** → 搜 2 处匹配 | 壳层贴内容；列表无内嵌大空白；底栏完整 | |
| I2 | 查找替换 → **全部替换…** 预览（2 行） | 预览壳层紧凑；「返回 / 确认」不被裁切 | |
| I3 | 规则纠错 preview 或 **智能改稿 preview**（若有数据） | 语段列表可见；底栏完整 | |
| I4 | 定稿 → **交付导出 Word** → 勾选多项 | 正文区内滚；底栏「导出」始终可见 | |
| I5 | 查找替换：手动拖高 → 改变匹配数 → **双击标题栏** | 壳高随内容重算（Restore auto height） | |

---

## H. Fresh profile 加测（对外分发前）

仅 **fresh** 或新 macOS 用户需勾；upgrade 可跳过本节。

| # | 操作 | 期望 | ☐ |
|---|------|------|---|
| H1 | 空 App Data 首次启动 | Welcome 正常 | |
| H2 | 环境 → **一键准备本机 ASR** | 完成，无终端/npm 指引 | |
| H3 | 状态行：环境 / FFmpeg / 运行时 / 转写 | 绿或可操作中文 | |
| H4 | 走完 B1–B7 全流程 | 同 upgrade 主路径 | |

---

## 签收结论

| 区块 | 通过项 / 总项 | 结果 ☐ PASS ☐ WARN ☐ FAIL |
|------|----------------|---------------------------|
| A ASR chip | /4 | |
| B 主路径 | /11 | |
| C WKWebView | /7 | |
| D 7-A | /8 | |
| E 7-B | /6 | |
| F 7-C | /5 | |
| G 7-D | /3 | |
| I FLOAT-FIT | /5 | |
| H Fresh（可选） | /4 | |

**已知问题 / WARN**（可贴截图路径或 `desktop.log` 关键词）：

```
（填写）
```

**Blocker**（有则 No-Go）：

```
（填写）
```

**结论**：☐ **L3 Go**（可对内发版） ☐ **No-Go**（列 blocker）

---

## 测完后更新仓库（维护者）

1. 本文件勾选结果抄入 [release-parity-evidence-2026-06-14.md](./release-parity-evidence-2026-06-14.md) §5–6，或复制为新 dated evidence。  
2. [copy-code-drift-register](./specs/copy-code-drift-register-2026-06-12.md) 表 7-A–7-D **动态列**改 ✅。  
3. [cleanup-candidate-register](./specs/cleanup-candidate-register.md) CLN-066 标 **DONE**（若全绿）。  
4. [release-zero-terminal-hand-test.md](./release-zero-terminal-hand-test.md) §2–7 勾选 + Signoff 表更新日期。

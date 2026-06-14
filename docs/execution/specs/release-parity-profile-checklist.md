# Release parity profile checklist

> **主控策略**：[`release-parity-program-2026-06.md`](./release-parity-program-2026-06.md) Phase 3  
> **用途**：定义 fresh / upgrade 两类安装包签收 profile。不得提交真实用户音频、转写正文、密钥或 token。

## 1. Profile Types

| Profile | 目的 | 输入状态 | 必测路径 |
|---------|------|----------|----------|
| `fresh-profile` | 验证首次安装体验 | 空 App Data 或首次启动后仅系统生成文件 | 启动、环境页、一键准备、导入、波形、转写、导出、诊断包 |
| `upgrade-profile` | 验证旧数据兼容 | 脱敏旧 App Data：DB、prefs、模型目录、peaks/cache | 启动、最近项目、旧项目打开、旧 peaks、模型状态、保存、导出、诊断包 |

## 2. Fresh Profile

- [ ] 关闭所有 dev / release 实例。
- [ ] 记录当前 App Data 路径。
- [ ] 使用空 App Data 或隔离用户目录启动 `.app`。
- [ ] 打开 Welcome。
- [ ] 打开「环境与 ASR」。
- [ ] 若模型未准备，UI 给出一键准备路径，且无 `npm run desktop:dev`。
- [ ] 创建 / 打开 Project。
- [ ] 导入音频，30s 内 Editor 主路径可用。
- [ ] 启动转写；可停止 / 取消；状态恢复。
- [ ] 编辑 Segment 并保存。
- [ ] 导出 DOCX。
- [ ] 导出 Diagnostic bundle。
- [ ] Cmd+Q 退出，重开后 Project / File / 波形恢复。

## 3. Upgrade Profile

- [ ] 旧 App Data 已脱敏。
- [ ] 旧 DB 可打开，且包含至少 1 个 Project、1 个 File。
- [ ] 旧模型目录存在或明确为空缓存场景。
- [ ] 旧 peaks/cache 存在或明确为空缓存场景。
- [ ] 启动 `.app` 后没有 DB migration error。
- [ ] Welcome / 最近项目能显示旧 Project。
- [ ] 打开旧 File，Segment 可见。
- [ ] 波形可见；若旧 peaks 过期，应可重建并有日志证据。
- [ ] 环境页模型状态无 D1/D2/D4/D5 矛盾。
- [ ] 保存 Segment 后重开仍保留。
- [ ] 导出 DOCX。
- [ ] 导出 Diagnostic bundle，确认不含音频 / 正文 / token。

## 4. Evidence

每次 profile 签收复制 [`release-parity-evidence-template.md`](./release-parity-evidence-template.md)，并至少附：

- `build-info.txt` 摘要。
- `environment.txt` 摘要。
- `project-summary.txt` 摘要。
- `parity-log.txt` 关键行。
- L2 installed smoke 终端输出。

## 5. 禁止事项

- 禁止为通过 upgrade profile 清空 App Data。
- 禁止把真实音频、转写正文、API key、local token 提交到仓库。
- 禁止把 Chrome mock 结果作为 WKWebView / installed app 签收证据。

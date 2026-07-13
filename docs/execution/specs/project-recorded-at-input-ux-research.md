# 调研：项目信息 · 场次时间输入 UX

> **状态**：已采纳  
> **关联**：[`project-hub-metadata-research.md`](./project-hub-metadata-research.md)（`recorded_at` 仍为自由文本真源）  
> **关联 UI**：`ProjectRecordedAtField` / `projectRecordedAt.ts`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | Hub「项目信息」填写采集时间；当前字段下方有多句格式说明，偏繁琐 |
| 本仓现状 | `RECORDED_AT_PLACEHOLDER` 罗列多种写法 + `RECORDED_AT_FORMAT_HINT` 长说明；`normalizeRecordedAtForSave` 仅 trim |
| 成功标准 | 仅 placeholder 示例；失焦/保存时常见日期写法自动规范为 `YYYY` / `YYYY-MM` / `YYYY-MM-DD`；无法解析的近似描述原样保留 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | **占位示例 + 失焦规范化** | Excel / Google Sheets 日期格 | 空格只暗示格式；输入后自动变成规范显示；非法/文本则保持 | Sheets 日期录入 UX |
| B | **解析公式 / 文本→日期** | Airtable `DATETIME_PARSE` | 文本字段宽松录入，再解析为规范日期；格式串辅助 | [Airtable DATETIME_PARSE](https://support.airtable.com/docs/using-datetime-parse-formula) |
| C | **口述史近似日期** | OHMS / Dublin Core Date | 允许「约 1990」「1990s」等非 ISO；不强制 date picker | 既有 hub metadata research 路线 A |

**对照结论**：Rushi 选 **A（主）+ C（兜底）**：UI 不堆说明，用单一 placeholder；能解析则规范成 ISO 片段，不能解析则保留自由描述（口述史约束不变）。不引入原生 `<input type="date">`（无法表达近似）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 依赖 |
|------|--------|----------|------|------|
| A | 高 | blur + save normalize | 无 | 纯函数即可 |
| B | 中 | 解析思路 | 不引入 Airtable/公式运行时 | — |
| C | 高 | 自由描述保留 | 禁止强制校验挡保存 | — |

**本仓已有**：`projectRecordedAt.ts`、`normalizeRecordedAtForSave`（扩展即可）；不新增 npm 依赖。

---

## 4. 决策

- **做**：去掉字段下方 hint；placeholder 改为单一示例 `2024-03-15`；`normalizeRecordedAtInput` 在 blur/save 规范化常见中英分隔与中文年月日
- **不做**：date picker；强制校验报错；自然语言「下周三」类解析（chrono）
- **对齐**：[`project-hub-metadata-research.md`](./project-hub-metadata-research.md) `recorded_at` 自由文本或 ISO 片段

---

## 5. 落位预告

| 层 | 文件 |
|----|------|
| 纯函数 | `apps/desktop/src/utils/projectRecordedAt.ts` |
| UI | `ProjectRecordedAtField.tsx`（blur 规范化；去 hint） |
| 测试 | `projectRecordedAt.test.ts` / `ProjectRecordedAtField.test.tsx` |

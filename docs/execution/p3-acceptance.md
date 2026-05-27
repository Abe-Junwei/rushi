# P3 验收（Rushi 本仓）

对照 Jieyu 计划书 **§8 P3：导出交付**（[`如是我闻-本地版改进计划书-2026-05-11.md`](../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md)）。

## 本仓交付点

1. **TXT 导出**：UTF-8、LF。  
2. **SRT 导出**：`HH:MM:SS,mmm`，含毫秒进位边界修复（避免 `,1000`）。  
3. **DOCX 导出（逐字稿 / 讲稿）**：
   - 逐字稿：每段时间行 + 正文；低置信段黄底高亮。  
   - 讲稿：连续正文输出。  
4. **导出不反写项目正文**：导出是只读序列化流程，不修改 SQLite 原稿。

> **与 EXP-WORD 的关系**：本文签收 **P3 最小 DOCX**（时间行 + 低置信高亮 + 讲稿连写）。**R3t 全管线完成后的「交付级 Word 格式化」** 另立 Epic **EXP-WORD**（[`word-formatted-export-backlog.md`](./specs/word-formatted-export-backlog.md)），排期见 [`rushi-execution-roadmap.md`](./plans/rushi-execution-roadmap.md) §4.1.1 ⑤‴；**不等** 协作 [`collaboration-review-word-export.md`](./specs/collaboration-review-word-export.md) C6。

## 验收建议

1. 在同一项目依次导出 TXT / SRT / DOCX（逐字稿/讲稿）。  
2. 比对 UI 当前正文与导出内容一致。  
3. 验证低置信语段在 DOCX 逐字稿中样式高亮存在。  
4. 修改语段后重复导出，确认旧导出不会反向影响项目正文。

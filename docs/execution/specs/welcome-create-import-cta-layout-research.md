# 调研：欢迎页「新建 / 导入内容包」入口落位（Hero vs 侧栏 vs 其他）

> **状态**：已采纳（推荐保留 Hero 横排；侧栏不迁入双 CTA）
> **关联**：当前实现 `WelcomeView.tsx` hero 横排「新建项目 · 或 · 导入内容包」；侧栏 `WelcomeSidebar` 为品牌 + 导航 + 项目树 + 底栏设置
> **门禁**：布局决策 brief；无新业务编码要求时可直接按结论微调 UI

---

## 0. 一句话结论

**保留现有欢迎主舞台横排（新建 · 或 · 导入内容包）。**  
侧栏适合「常驻新建」（Notion 式），不适合同时扛「导入内容包」这种低频迁移动作；Premiere / VS Code / Figma 的冷启动都把 **New + Open/Import** 放在 Home/Welcome 主区，与项目列表并置。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 冷启动：从零新建转写项目，或从 zip 内容包恢复/换机；日常：已有项目时从侧栏继续打开。 |
| 本仓现状 | Hero：`新建项目` Primary +「或」+ `导入内容包` Secondary；侧栏：品牌、项目与文件导航、项目树、底栏设置。媒体首文件仍在新建模态。 |
| 成功标准 | 冷启动二选一清晰；不削弱「最近文件」；不与侧栏导航/设置抢语义；符合 Notion Zen（一主一次）。 |

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表产品 | 布局机制 | 链接 / 证据 |
|---|------|----------|----------|-------------|
| A（**推荐对齐**） | **Home 主区：New + Open/Import 并列；侧栏=库导航** | Adobe Premiere Home、VS Code Welcome、Figma 文件浏览器、DaVinci Resolve Project Manager | 启动页中央/上部放「新建」与「打开/导入」；最近项目列表同屏；侧栏或左栏是库/目录，不是冷启动主 CTA 堆叠处 | [Premiere New Project](https://helpx.adobe.com/premiere/desktop/organize-media/create-projects/create-new-project.html)；VS Code Get Started；Figma file browser「+ Create」 |
| B | **侧栏常驻 New；Import 进菜单或次入口** | Notion（侧栏 📝 New page）、Obsidian（命令面板 / vault 选择器）、Linear（侧栏 + New） | 产品以「树/库」为真源时，创建是高频导航级动作，固定在侧栏顶；导入/打开 vault 另走对话框或菜单，**不与 New 并排成「或」** | [Notion sidebar](https://www.notion.com/help/navigate-with-the-sidebar) |
| C | **创建后导入：Home 只 New；Import 在项目内** | Premiere「Skip import」后 Project 面板 Import；多数 NLE | New 打开空项目；媒体导入是项目内动作。适合「导入=加素材」，不适合「导入=整包恢复工作区」 | Premiere Import desktop flow |
| D（反例） | **底栏塞创建/导入/设置** | 少见；移动端 Tab 另论 | 桌面侧栏底栏通常放 Settings / Account；创建流放底栏会与偏好混语义、挤布局 | — |

**空态共识**（Eleken / Northbase 等汇总）：主区空态应有 **一个主行动 + 可选次行动**；结构型列表空态可用内联「+」；**不要用插画墙替代清晰 CTA**。Rushi 的「最近文件」空态 + Hero CTA 符合「主区引导」一派。

---

## 3. 方案对照（对 Rushi）

| 方案 | 做法 | 优点 | 缺点 | 复用度 |
|------|------|------|------|--------|
| **① Hero 横排（现状）** | 主舞台：`新建 · 或 · 导入`；侧栏只管库 | 与 Premiere/VS Code 冷启动一致；「或」表达二选一；导入低频但不藏；主次色阶清晰 | 有项目后 Hero CTA 仍占位（可接受：换机/再导入仍可能需要） | **高**（已实现） |
| **② 侧栏双按钮** | 品牌下竖叠新建+导入；Hero 只留欢迎+最近 | 打开任意侧栏页都能建/导；像 Notion 常驻 New | 导入与导航抢顶栏注意力；侧栏窄，「或」难做；Hub/编辑器复用侧栏时噪音大；与 Stitch「主舞台冷启动」分叉 | 中（要改 Sidebar + 收回 Hero） |
| **③ 混合** | Hero 只「新建」；侧栏或菜单藏「导入内容包」 | Hero 更干净 | 削弱换机路径；「或」语义消失；需多一步发现 | 中 |
| **④ 侧栏仅 +新建；导入留 Hero 或菜单** | Notion New + Premiere Import 折中 | 日常新建更顺手 | 两处入口，E2E/文案成本高；现阶段收益有限 | 中（可作远期） |

**与 Rushi 约束对齐**：

- Notion Zen：**一颗 saffron 主 CTA** → Hero 横排满足；侧栏双 Prominent 易过重。  
- 侧栏已是 **项目树导航真源**（对齐路线 B 的「库」），不宜再塞第二套冷启动故事。  
- 「导入内容包」= **工作区交换/恢复**（非整段音频导入）→ 更接近 Premiere「Open project / Open from…」，应出现在 Home，而非项目内 Footer「继续导入音频」。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **① 保持 Hero 横排「新建项目 · 或 · 导入内容包」** |
| 侧栏是否迁入 | **否**（当前不迁）；侧栏继续品牌 / 导航 / 项目树 / 设置 |
| 若未来增强 | 可选④：侧栏增加紧凑「+ 新建」（32px primary 或 ghost+），**不**把导入内容包放进侧栏；导入仍留 Home 或「文件」菜单级 |
| 不做什么 | 不把双 CTA 塞底栏；不在侧栏用「或」横排挤导航；不把内容包导入并进 Hub「继续导入」媒体区 |
| 与 Stitch | 维持 `23-stitch-welcome-hub-unified-spec` 现行：Header 横排双 CTA；Footer 仍省略媒体导入 |

---

## 5. 落位预告（仅当改方案时）

| 层 | 变更 |
|----|------|
| UI | 现状已够；若选④再改 `WelcomeSidebar` + 收回/弱化 Hero 次按钮 |
| 文档 | 本 brief；Stitch 23 已描述横排 |

---

## 6. 签收

- [x] 调研 brief 完成  
- [x] 推荐结论：保留 Hero 横排  
- [ ] 若用户改选侧栏方案再开 intent

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初版：Premiere/VS Code/Figma/Notion/NLE 对照；选定 Hero 横排 |

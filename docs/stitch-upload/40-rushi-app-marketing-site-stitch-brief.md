# 设计需求稿：rushi.app 产品官网（Stitch）

> **用途**：上传 Google Stitch / 对照出稿；**不是**桌面端 UI 改版。  
> **视觉真源**：仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen：Notion 中性底 + saffron 暖色强调）。  
> **线框参考**：[`apps/desktop/stitch-marketing-site-layout.html`](../../../apps/desktop/stitch-marketing-site-layout.html)  
> **Stitch 上传包**：仓库根执行 `bash scripts/prepare-stitch-upload.sh` 后见 `docs/stitch-upload/`。

## 0. 产品一句话

**如是我闻（Rushi）** — 本地中文课录音转写与校对桌面应用。欢迎页 → 项目 Hub → 编辑器（波形 + 语段列表）；本机 FunASR / 可选在线 STT；导出 TXT / SRT / DOCX。

- 官网域名：`https://rushi.app`（本需求稿目标）  
- 发版 CDN：`https://updates.rushi.app`（安装包 / OTA / CUDA 侧车；**勿做成营销首页**）  
- 版权主体：沂南灵创技术服务中心  
- **无 Linux 桌面包**（勿画 Linux 下载按钮）

## 1. 设计目标

| ID | 目标 |
|----|------|
| G1 | 首屏一眼读出「本地课录音转写与校对」，品牌「如是我闻」是 hero 级信号 |
| G2 | 与桌面应用气质一致（Notion Zen），不像通用紫渐变 SaaS |
| G3 | 清晰双端下载（macOS / Windows），链到 CDN，不暗示应用内商店 |
| G4 | 强调本机隐私：音频与转写默认本地处理 |
| G5 | 与同名 Web「佛经阅读」类产品可区分（本产品 = **桌面转写工具**） |

## 2. 画板清单（Stitch 必出）

按优先级：

| # | 画板名 | 视口 | 说明 |
|---|--------|------|------|
| 1 | `www-home-desktop` | 1440×900 | **首页首屏 + 首屏以下一折**（见 §4） |
| 2 | `www-home-mobile` | 390×844 | 首页响应式；下载 CTA 不挤死 |
| 3 | `www-download` | 1440×900 | 下载页：双端产物说明 + 可选 GPU 说明 |
| 4 | `www-privacy` | 1440×900 | 隐私短页（可极简） |
| 5 | （可选）`www-about` | 1440×900 | 关于 / 版权一行即可 |

**第一轮最低交付**：画板 1 + 2。其余可第二轮。

## 3. 视觉系统（必须遵守）

从 `DESIGN.md` 映射，Stitch 变量建议命名：

| 语义 | Hex | 用途 |
|------|-----|------|
| 页面底 | `#ffffff` | 主背景 |
| 弱底 / 分区 | `#f7f7f5` | 次级条、页脚带 |
| 正文 | `#37352f` | 标题与正文 |
| 次文 | `#6b6b6b` | 说明、meta |
| 分割线 | `#e3e2e0` | hairline |
| **主 CTA** | `#C58A43`（saffron） | 主下载按钮；**白字** |
| saffron hover | `#85530f` | 主按钮 hover |
| 危险（少用） | `#963530` | 官网几乎不用 |

**字体**

- UI / 营销正文：**Inter**  
- 品牌词「如是我闻」：允许 **Noto Serif SC**（与桌面欢迎页侧栏一致）  
- 禁止用 Inter/Roboto 以外的「AI 默认展示字体」堆砌；勿用紫系主题

**造型**

- 按钮圆角 **4px**；卡片 **6px**  
- **无大阴影 / 无 glow / 无圆角胶囊 pill 堆**  
- 层级：背景差 + 1px border，不要多层卡片套娃

**官网专用约束（营销首屏）**

- 第一视口 = **一个构图**，不是 dashboard  
- 品牌「如是我闻」必须是 hero 级（去掉导航后仍能认出是本产品）  
- 首屏预算：**品牌 + 一句 headline + 一句支撑 + CTA 组 + 一张主视觉**；勿塞统计条、日程、地址、多 promo chip  
- 主视觉：优先 **产品真实界面**（Editor：波形 + 语段列表），全宽或接近全宽；禁止抽象紫渐变当主视觉  
- 勿在 hero 图上叠浮动徽章 / sticker

## 4. 首页信息架构

### 4.1 顶栏（sticky 可选）

左：锁扣 /「如是我闻」  
右：文字链「功能」「下载」「隐私」+ 次要「获取应用」（滚到下载或进下载页）

### 4.2 首屏（第一视口）

| 元素 | 文案（可微调，勿改产品定位） |
|------|------------------------------|
| 品牌 | **如是我闻** |
| Headline | 本地中文课录音，转写与校对 |
| 支撑句 | 波形对齐语段，本机完成转写；导出 TXT / SRT / DOCX |
| CTA 主 | 下载 macOS |
| CTA 次 | 下载 Windows |
| 主视觉 | Editor 截图（波形上 + 语段列表右/下） |

备注行（小字，可选）：最新版本见 `updates.rushi.app` · 无 Linux 桌面包

### 4.3 第二折：三个卖点（一节一事）

每块：短标题 + 一行说明，**不要卡片瀑布**；可用简单三分栏或纵向 stack。

1. **本机转写** — FunASR 等本机模型；可选 NVIDIA GPU 加速组件（应用内下载）  
2. **波形校对** — 语段与时间轴绑定；拆分 / 合并 / 冻结  
3. **交付导出** — TXT / SRT / DOCX；场次元信息可进文档  

### 4.4 第三折：隐私一句

「录音与转写默认在你的电脑上完成，不为云转写上传音频。」  
无账号墙插画堆砌。

### 4.5 页脚

版权 © 沂南灵创技术服务中心（以 LICENSE 为准）· 隐私 · 下载 · `rushi.app`

## 5. 下载页要点

| 平台 | 主推形态 | 说明文案方向 |
|------|----------|--------------|
| macOS | `.dmg` | Apple Silicon / Intel 以 CDN 实际产物为准 |
| Windows | **便携版 zip**（主推） | 解压即用；另可提安装包若 CDN 有 |
| GPU | 不单独当「第二安装包」主 CTA | 短说明：有 NVIDIA 显卡时，在应用「环境」中下载 GPU 加速组件 |

禁止：App Store / Microsoft Store 徽章（当前无）。

## 6. 文案禁区 / 避免叫法

| 避免 | 改用 |
|------|------|
| 首页 / dashboard | Welcome / 产品官网首页 |
| 云端一键转写（若暗示上传音频） | 本机转写；在线 STT 为可选 Provider |
| 引擎 / AI 魔法 | Provider / 本机模型 / 校对 |
| 与 rushiwowen.co 类佛经站混淆 | 始终写清「桌面转写与校对」 |

领域词与桌面一致时见 [`CONTEXT.md`](../../../CONTEXT.md)。

## 7. 资源与参考

- 品牌锁扣：`apps/desktop/src/assets/brand/lockup-readme.png`  
- 桌面视觉：`DESIGN.md`  
- 产品能力边界：`README.md`、`docs/architecture/asr-sidecar-funasr-policy.md`（Windows CUDA CDN 可选）  
- 线框：`apps/desktop/stitch-marketing-site-layout.html`（浏览器打开对照结构，非最终视觉）

## 8. Stitch 出稿验收（勾选）

- [ ] 首屏去掉导航后仍能识别「如是我闻」品牌  
- [ ] 主 CTA 为 saffron，无紫色主题  
- [ ] 仅 macOS + Windows 下载，无 Linux  
- [ ] 主视觉为产品界面，非抽象插画主导  
- [ ] 移动画板 CTA 可点区域足够大  
- [ ] 下载说明未承诺「安装包内含 CUDA」  
- [ ] 与 `DESIGN.md` 色板无未说明的新主色  

## 9. 明确不在本轮设计

- 博客、文档站、账号登录、价格表、多语言切换（可预留「中文」单语）  
- 改桌面端 Welcome / Editor  
- 把 `updates.rushi.app` 根改成官网  

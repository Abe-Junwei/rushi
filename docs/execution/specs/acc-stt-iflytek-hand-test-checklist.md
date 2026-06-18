# ACC-STT-IFLYTEK 手测清单 — 讯飞极速录音转写

> **前置**：讯飞开放平台 AppID + APIKey + APISecret；测试音频建议 **≥5 min**；含 **mp4/m4a**（测 ffmpeg 归一）与 **≥30 MB**（测分块上传）各一例。  
> **验收**：[`acc-stt-iflytek-acceptance.md`](./acc-stt-iflytek-acceptance.md) · **调研**：[`r3-china-iflytek-lfasr-research.md`](./r3-china-iflytek-lfasr-research.md)

## 0. 机器闸门（无 Key 可做）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml xunfei_speed_asr
```

## 1. 环境页（在线 STT）

1. **环境 → 在线 STT**：启用；厂商选 **讯飞极速录音转写**（`iflytek-speed-asr`）。
2. 填入 **AppID**、**APIKey**、**APISecret** → **保存在线配置**。
3. **连接探测**：
   - [ ] 仅填 AppID + APIKey、缺 Secret → `unconfigured` 或等价提示
   - [ ] 三件套齐全 → `available`（credentials-only，无 GET 延迟亦可）
4. **UI 核对**：
   - [ ] AppID 字段标签正确；APIKey / APISecret 为密码框
   - [ ] 描述含 **极速** / **异步 Job** / **方言**
   - [ ] **accent 下拉** 8 项；默认普通话
   - [ ] 角标 **术语偏置** 可见
   - [ ] 只读预置端点含 `ost-api.xfyun.cn` 或等价 OST 任务域名

## 2. 术语库（可选）

1. 术语页新增 1–2 个专名，勾选 **纳入下次转写（热词）**。
2. 主舞台 **自动转录** 浮动框：
   - [ ] 含「在线讯飞：术语同步为请求热词。」（或 acceptance 定稿文案）
3. 日志（Implement 后）：
   - [ ] `pro_create` 请求体含 `business.dhw` 非空（有术语时）

## 3. 转写 E2E

1. 打开有音频的项目 → 转写来源 **在线 STT**。
2. 执行 **自动转录**（5 min+ 中文 wav/mp3）。
3. 结果：
   - [ ] `transcribe_timeline_last.json` → `outcome: success`，`source: online`
   - [ ] engine **`iflytek:speed-transcription:file`**
   - [ ] 语段数 **≥2**（Tier A 句级时间戳）
   - [ ] 无 `online_vocabulary_unsupported`（有术语时）

## 4. 负例

| 场景 | 预期 |
|------|------|
| mp4/m4a | ffmpeg 归一后转写成功（或 ffmpeg 不可用时报错） |
| 音频 ≥30 MB | 分块上传成功 |
| 错误 APISecret | 401 或厂商错误映射为可读文案 |
| 配额用尽 / 超时 | **仅报错**；不自动改走本机 ASR |
| 未开通 accent（如维语） | 可读错误；不回落本机 |
| 切回百炼 | 第三 Secret 字段隐藏；探测走 GET models |

## 5. 与本机 ASR 维度隔离

- [ ] 讯飞探测 `available` 时，本机 Paraformer 仍可显示「未下载」— 互不冒充
- [ ] 在线转写失败 **不** silent 回落本机（除非用户显式选本机路径）

## 签收

| 日期 | §1 环境 | §3 E2E | §4 负例 | 备注 |
|------|---------|--------|---------|------|
| | | | | |

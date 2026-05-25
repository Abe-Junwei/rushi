# 链路模拟：加载 → 转写 → 保存

| Step | 输入状态 | 动作 | 预期 | 审查结论 |
|------|----------|------|------|----------|
| 1 | 无项目 | `createProject`（音频） | DB：project_id + file_id；FS：音频副本 | OK |
| 2 | — | `applyDetail` + `refreshProjects` | 欢迎列表更新 | OK |
| 3 | 列表有项 | `loadProject(id)` | `projectLoad` → `openFile(最新文件)` | OK；失败回滚 current |
| 4 | current + currentFileId | 编辑语段（DOM draft） | `segments` 内存更新 | OK |
| 5 | 有未 flush 草稿 | `saveSegments` | flush DOM → `file_save_segments(file_id)` → reload | OK |
| 6 | 有音频 | `runTranscribe` | ASR → 写 DB → UI 新语段 | **FAIL R2-001/R2-002** |
| 7 | busy | 双击转写 | 第二次 no-op | OK（busy guard） |
| 8 | 有修改 | `closeProject` | 确认或保存 | **FAIL R2-003** |
| 9 | — | `deleteProject` | confirm → FS+DB | OK；注意 R1-002 边界 |

## 混沌事件

| 事件 | 预期 | 结论 |
|------|------|------|
| 转写中 `loadProject` 另一项目 | busy 阻塞或取消 | busy 阻塞转写入口 |
| 转写成功但磁盘满 | 恢复 json + 错误文案 | OK（recovery 文件） |
| `openFile` 失败于 step 3 | current 清空 | OK |

## 代码锚点

- 前端：`useProjectLifecycleController.ts`
- Rust：`run_transcribe_cmd.rs`、`project_cmd.rs`（`file_save_segments_inner`）

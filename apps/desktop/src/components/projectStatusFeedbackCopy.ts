import type { TranscribeProgress } from "../pages/transcribePreviewState";
import type { BusyReason } from "../pages/useProjectController";

export function busyOverlayCopy(
  reason: BusyReason | null,
  transcribeProgress: TranscribeProgress | null,
): { title: string; hint: string } {
  switch (reason) {
    case "transcribe":
      if (transcribeProgress && transcribeProgress.windowCount > 1) {
        return {
          title: "转写预览中…",
          hint: `第 ${transcribeProgress.windowIndex}/${transcribeProgress.windowCount} 段 · 已出 ${transcribeProgress.segmentsTotal} 条语段`,
        };
      }
      if (transcribeProgress && transcribeProgress.segmentsTotal > 0) {
        return {
          title: "转写预览中…",
          hint: `已出 ${transcribeProgress.segmentsTotal} 条语段`,
        };
      }
      return {
        title: "正在自动转录...",
        hint: "转写预览中；长音频将在侧车内分段处理，语段将逐步出现",
      };
    case "save":
      return { title: "正在保存到 SQLite...", hint: "请勿关闭应用" };
    case "create":
      return { title: "正在创建项目...", hint: "正在复制音频并写入数据库" };
    case "load":
      return { title: "正在加载项目...", hint: "完整识别可能需数分钟" };
    case "import":
      return { title: "正在导入文件...", hint: "请稍候" };
    case "delete":
      return { title: "正在删除项目...", hint: "请稍候" };
    case "install_funasr":
      return { title: "正在执行安装脚本...", hint: "终端输出可在「环境 → 本机 ASR」中查看" };
    case "export":
      return { title: "正在导出 Word…", hint: "大模型润色与写入文档可能需要数十秒" };
    case "stage_b":
      return { title: "智能改稿处理中…", hint: "正在请求 LLM 生成标点与改字候选，请勿切换文件或转写" };
    default:
      return { title: "处理中...", hint: "请稍候" };
  }
}

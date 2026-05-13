/**
 * Demo export-format plugin — exports segments as a simple Markdown file.
 */

import type { ExportFormat, ExportParams, PluginContext } from "../../plugin-system";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function activate(context: PluginContext): void {
  const fmt: ExportFormat = {
    type: "export.format",
    id: "export.markdown",
    name: "Markdown 文本",
    description: "导出为带时间戳的 Markdown 列表",
    ext: "md",
    mimeType: "text/markdown; charset=utf-8",
    export(params: ExportParams): Promise<string> {
      const lines: string[] = [`# ${params.projectName}`, ""];
      for (const seg of params.segments) {
        lines.push(
          `- **[${formatTime(seg.startSec)} → ${formatTime(seg.endSec)}]** ${seg.text}`,
        );
      }
      lines.push("");
      return Promise.resolve(lines.join("\n"));
    },
  };

  context.register(fmt);
}

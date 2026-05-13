/**
 * Built-in plugin manifests shipped with Rushi.
 *
 * These are loaded automatically on app startup.
 */

import type { PluginManifest } from "../plugin-system";

export const BUILTIN_PLUGINS: PluginManifest[] = [
  {
    id: "rushi.plugin.tts-demo",
    name: "浏览器语音合成 (Demo)",
    version: "0.1.0",
    description: "使用系统 speechSynthesis 朗读文本",
    entry: new URL("./tts-demo/index.ts", import.meta.url).href,
  },
  {
    id: "rushi.plugin.export-markdown",
    name: "Markdown 导出",
    version: "0.1.0",
    description: "导出为带时间戳的 Markdown 列表",
    entry: new URL("./export-markdown/index.ts", import.meta.url).href,
  },
];

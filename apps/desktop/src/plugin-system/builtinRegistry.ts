import type { PluginManifest } from "./types";

/** v1 shipped plugins (entry `builtin:*` is not dynamically imported). */
export const BUILTIN_PLUGIN_MANIFESTS: readonly PluginManifest[] = [
  {
    id: "rushi.export-markdown",
    name: "Markdown 导出",
    version: "0.1.0",
    description: "内置演示：导出 Markdown",
    permissions: ["register:export.format"],
    entry: "builtin:rushi.export-markdown",
  },
  {
    id: "rushi.tts-demo",
    name: "浏览器 TTS 演示",
    version: "0.1.0",
    description: "内置演示：Web Speech API",
    permissions: ["register:tts.provider"],
    entry: "builtin:rushi.tts-demo",
  },
] as const;

const BUILTIN_IDS = new Set(BUILTIN_PLUGIN_MANIFESTS.map((m) => m.id));

export function isBuiltinPluginId(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

export function isBuiltinPluginManifest(manifest: PluginManifest): boolean {
  return BUILTIN_PLUGIN_MANIFESTS.some(
    (b) => b.id === manifest.id && b.entry === manifest.entry,
  );
}

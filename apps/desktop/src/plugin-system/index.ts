/**
 * Public API of the Rushi plugin system.
 *
 * Host code imports from here to load plugins, query extensions, etc.
 *
 * v1 unused infra (R-15 / Q-PLUGIN-1): `loadBuiltinPlugins()` is only exercised
 * by unit tests today. Production export (`useExportController`) does not query
 * `registryQuery("export.format")`; built-ins `export-markdown` / `tts-demo`
 * remain scaffold until a product thin-slice wires them. Do not delete without
 * an explicit cleanup decision — see cleanup-candidate-register CLN-905 and
 * repo-multi-angle-review-2026-07-11 §延期.
 */

export type {
  ExtensionContribution,
  ExtensionContributionUnion,
  ExtensionHandle,
  ExtensionPointId,
  ExportFormat,
  ExportParams,
  MenuItem,
  PluginContext,
  PluginManifest,
  PluginModule,
  TtsProvider,
  TtsResult,
  TtsSynthesizeParams,
  TtsVoice,
} from "./types";

export {
  registryQuery,
  registryFind,
  registryClear,
} from "./registry";

export {
  BUILTIN_PLUGIN_MANIFESTS,
  isBuiltinPluginId,
  isBuiltinPluginManifest,
} from "./builtinRegistry";

export {
  activatePluginModule,
  loadBuiltinPlugins,
  loadPlugin,
  unloadPlugin,
  unloadAllPlugins,
  loadedPluginIds,
} from "./loader";

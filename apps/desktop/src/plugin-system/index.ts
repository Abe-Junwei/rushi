/**
 * Public API of the Rushi plugin system.
 *
 * Host code imports from here to load plugins, query extensions, etc.
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
  loadPlugins,
  unloadPlugin,
  unloadAllPlugins,
  loadedPluginIds,
} from "./loader";

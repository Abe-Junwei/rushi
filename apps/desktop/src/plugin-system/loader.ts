/**
 * Plugin loader (built-in only in production; dynamic entry allowed in Vitest).
 */

import type { PluginContext, PluginManifest, PluginModule } from "./types";
import { BUILTIN_PLUGIN_MANIFESTS, isBuiltinPluginManifest } from "./builtinRegistry";
import { createPluginContext, disposePluginContext } from "./context";
import { registryUnregister } from "./registry";
import { validatePluginEntry } from "./validatePluginEntry";

function formatUnknownError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return "unknown error";
  }
}

function isTestPluginLoadingAllowed(): boolean {
  return import.meta.env.MODE === "test";
}

interface LoadedPlugin {
  manifest: PluginManifest;
  module: PluginModule;
  context: PluginContext;
  handles: string[];
}

const loaded = new Map<string, LoadedPlugin>();

/** Activate a resolved module (used by built-ins and tests). */
export async function activatePluginModule(
  manifest: PluginManifest,
  pluginModule: PluginModule,
): Promise<void> {
  if (loaded.has(manifest.id)) {
    console.warn(`[plugin] ${manifest.id} already loaded; skipping.`);
    return;
  }
  if (typeof pluginModule.activate !== "function") {
    throw new Error(`Plugin ${manifest.id} does not export an activate() function.`);
  }

  const ctx = createPluginContext(manifest);
  const handles: string[] = [];
  const origRegister = ctx.register.bind(ctx);
  ctx.register = (c) => {
    const h = origRegister(c);
    handles.push(h);
    return h;
  };

  try {
    await pluginModule.activate(ctx);
  } catch (e) {
    for (const h of [...handles].reverse()) {
      registryUnregister(h);
    }
    disposePluginContext(ctx);
    throw e instanceof Error ? e : new Error(formatUnknownError(e));
  }
  loaded.set(manifest.id, { manifest, module: pluginModule, context: ctx, handles });
  console.warn(`[plugin] loaded ${manifest.id}`);
}

/**
 * Test-only dynamic loader. Production must use `loadBuiltinPlugins()`.
 */
export async function loadPlugin(manifest: PluginManifest): Promise<void> {
  if (!isTestPluginLoadingAllowed()) {
    throw new Error(
      `Plugin ${manifest.id}: external loading is disabled; use loadBuiltinPlugins()`,
    );
  }
  if (manifest.entry.startsWith("builtin:")) {
    throw new Error(`Plugin ${manifest.id}: use loadBuiltinPlugins() for built-in plugins`);
  }
  validatePluginEntry(manifest.entry, manifest.id);

  const mod = (await import(/* @vite-ignore */ manifest.entry)) as {
    default?: PluginModule;
    activate?: PluginModule["activate"];
  };
  const pluginModule: PluginModule = mod.default ?? (mod as unknown as PluginModule);
  await activatePluginModule(manifest, pluginModule);
}

/** Unload a plugin by id. */
export async function unloadPlugin(id: string): Promise<void> {
  const entry = loaded.get(id);
  if (!entry) {
    console.warn(`[plugin] ${id} not loaded; cannot unload.`);
    return;
  }

  for (const h of entry.handles) {
    registryUnregister(h);
  }

  let deactivateError: unknown = null;
  if (typeof entry.module.deactivate === "function") {
    try {
      await entry.module.deactivate();
    } catch (e) {
      deactivateError = e;
    }
  }

  disposePluginContext(entry.context);
  loaded.delete(id);
  console.warn(`[plugin] unloaded ${id}`);
  if (deactivateError) {
    throw deactivateError instanceof Error
      ? deactivateError
      : new Error(formatUnknownError(deactivateError));
  }
}

/** @deprecated Use `loadBuiltinPlugins()` — non-built-in manifests are rejected. */
export async function loadPlugins(manifests: PluginManifest[]): Promise<void> {
  await Promise.all(
    manifests.map((m) => {
      if (!isTestPluginLoadingAllowed() && !isBuiltinPluginManifest(m)) {
        console.error(`[plugin] rejected non-built-in ${m.id}`);
        return Promise.resolve();
      }
      return loadPlugin(m).catch((e) => {
        console.error(`[plugin] failed to load ${m.id}:`, e);
      });
    }),
  );
}

export function loadedPluginIds(): string[] {
  return Array.from(loaded.keys());
}

export async function unloadAllPlugins(): Promise<void> {
  await Promise.all(Array.from(loaded.keys()).map((id) => unloadPlugin(id)));
}

/** Load shipped plugins via static import (production entry point). */
export async function loadBuiltinPlugins(): Promise<void> {
  const [exportMarkdown, ttsDemo] = await Promise.all([
    import("../plugins/export-markdown/index.ts"),
    import("../plugins/tts-demo/index.ts"),
  ]);
  const pairs: [PluginManifest, { activate?: PluginModule["activate"] }][] = [
    [BUILTIN_PLUGIN_MANIFESTS[0], exportMarkdown],
    [BUILTIN_PLUGIN_MANIFESTS[1], ttsDemo],
  ];
  for (const [manifest, mod] of pairs) {
    const pluginModule: PluginModule =
      typeof mod.activate === "function" ? { activate: mod.activate } : (mod as PluginModule);
    await activatePluginModule(manifest, pluginModule);
  }
}

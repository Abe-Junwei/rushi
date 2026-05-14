/**
 * Plugin loader.
 *
 * Loads plugin ES modules (built-in via static import or external via dynamic import),
 * invokes their `activate(context)` entry point, and tracks lifecycle.
 */

import type { PluginContext, PluginManifest, PluginModule } from "./types";
import { createPluginContext, disposePluginContext } from "./context";
import { registryUnregister } from "./registry";

function formatUnknownError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return "unknown error";
  }
}

interface LoadedPlugin {
  manifest: PluginManifest;
  module: PluginModule;
  context: PluginContext;
  handles: string[];
}

const loaded = new Map<string, LoadedPlugin>();

/** Load a plugin from its manifest. */
export async function loadPlugin(manifest: PluginManifest): Promise<void> {
  if (loaded.has(manifest.id)) {
    console.warn(`[plugin] ${manifest.id} already loaded; skipping.`);
    return;
  }

  const mod = (await import(/* @vite-ignore */ manifest.entry)) as {
    default?: PluginModule;
    activate?: PluginModule["activate"];
  };

  const pluginModule: PluginModule = mod.default ?? (mod as unknown as PluginModule);
  if (typeof pluginModule.activate !== "function") {
    throw new Error(`Plugin ${manifest.id} does not export an activate() function.`);
  }

  const ctx = createPluginContext(manifest);
  const handles: string[] = [];

  // Patch ctx.register so we can track handles for this plugin.
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

/** Unload a plugin by id. */
export async function unloadPlugin(id: string): Promise<void> {
  const entry = loaded.get(id);
  if (!entry) {
    console.warn(`[plugin] ${id} not loaded; cannot unload.`);
    return;
  }

  // Unregister every handle.
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
    throw deactivateError instanceof Error ? deactivateError : new Error(formatUnknownError(deactivateError));
  }
}

/** Load multiple plugins in parallel. */
export async function loadPlugins(manifests: PluginManifest[]): Promise<void> {
  await Promise.all(manifests.map((m) => loadPlugin(m).catch((e) => {
    console.error(`[plugin] failed to load ${m.id}:`, e);
  })));
}

/** Return ids of currently loaded plugins. */
export function loadedPluginIds(): string[] {
  return Array.from(loaded.keys());
}

/** Hard reset: unload everything. */
export async function unloadAllPlugins(): Promise<void> {
  await Promise.all(Array.from(loaded.keys()).map((id) => unloadPlugin(id)));
}

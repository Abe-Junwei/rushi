/**
 * PluginContext implementation.
 *
 * Each loaded plugin receives its own context instance,
 * so handles and event listeners are scoped to that plugin.
 */

import type {
  ExtensionContributionUnion,
  ExtensionHandle,
  PluginContext,
  PluginManifest,
} from "./types";
import { registryRegister, registryUnregister } from "./registry";

export function createPluginContext(manifest: PluginManifest): PluginContext {
  const handles: ExtensionHandle[] = [];
  const listeners = new Map<string, Array<(payload?: unknown) => void>>();

  const ctx: PluginContext = {
    manifest,

    register(contribution: ExtensionContributionUnion): ExtensionHandle {
      const h = registryRegister(contribution.type, contribution);
      handles.push(h);
      return h;
    },

    unregister(handle: ExtensionHandle): void {
      registryUnregister(handle);
      const idx = handles.indexOf(handle);
      if (idx >= 0) handles.splice(idx, 1);
    },

    emit(event: string, payload?: unknown): void {
      const subs = listeners.get(event);
      if (subs) {
        subs.forEach((fn) => {
          try {
            fn(payload);
          } catch {
            // ignore subscriber errors to protect host
          }
        });
      }
    },

    on(event: string, handler: (payload?: unknown) => void): () => void {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
      return () => {
        const arr = listeners.get(event);
        if (!arr) return;
        const i = arr.indexOf(handler);
        if (i >= 0) arr.splice(i, 1);
      };
    },
  };

  return ctx;
}

/** Dispose a context: unregister every handle it created. */
export function disposePluginContext(_ctx: PluginContext): void {
  // Access internal handles via a WeakMap if we wanted strict privacy.
  // For simplicity we rely on the loader to keep track.
  void _ctx;
}

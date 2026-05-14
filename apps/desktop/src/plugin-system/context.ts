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

const pluginEventBus = new Map<string, Set<(payload?: unknown) => void>>();
const pluginContextSubscriptions = new WeakMap<PluginContext, Array<() => void>>();

function emitPluginEvent(event: string, payload?: unknown): void {
  const subs = pluginEventBus.get(event);
  if (!subs || subs.size === 0) return;
  for (const fn of Array.from(subs)) {
    try {
      fn(payload);
    } catch {
      // ignore subscriber errors to protect host
    }
  }
}

function subscribePluginEvent(event: string, handler: (payload?: unknown) => void): () => void {
  const subs = pluginEventBus.get(event) ?? new Set<(payload?: unknown) => void>();
  subs.add(handler);
  pluginEventBus.set(event, subs);
  return () => {
    const cur = pluginEventBus.get(event);
    if (!cur) return;
    cur.delete(handler);
    if (cur.size === 0) pluginEventBus.delete(event);
  };
}

export function createPluginContext(manifest: PluginManifest): PluginContext {
  const handles: ExtensionHandle[] = [];
  const unsubscribers: Array<() => void> = [];

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
      emitPluginEvent(event, payload);
    },

    on(event: string, handler: (payload?: unknown) => void): () => void {
      const off = subscribePluginEvent(event, handler);
      unsubscribers.push(off);
      return () => {
        off();
        const i = unsubscribers.indexOf(off);
        if (i >= 0) unsubscribers.splice(i, 1);
      };
    },
  };

  pluginContextSubscriptions.set(ctx, unsubscribers);

  return ctx;
}

/** Dispose a context: unregister every handle it created. */
export function disposePluginContext(ctx: PluginContext): void {
  const subs = pluginContextSubscriptions.get(ctx);
  if (!subs) return;
  for (const off of subs.splice(0)) off();
  pluginContextSubscriptions.delete(ctx);
}

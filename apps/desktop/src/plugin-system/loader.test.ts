import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activatePluginModule, loadPlugin, loadedPluginIds, unloadAllPlugins, unloadPlugin } from "./loader";
import { registryClear, registryQuery } from "./registry";
import type { PluginManifest, PluginModule } from "./types";

type TestGlobal = typeof globalThis & {
  __pluginEvents?: unknown[];
};

function dataModule(code: string): string {
  return `data:text/javascript,${encodeURIComponent(code)}`;
}

function makeManifest(id: string, code: string): PluginManifest {
  return {
    id,
    name: id,
    version: "0.1.0",
    entry: dataModule(code),
  };
}

async function loadTestPluginFromCode(manifest: PluginManifest): Promise<void> {
  const mod = (await import(/* @vite-ignore */ manifest.entry)) as {
    default?: PluginModule;
    activate?: PluginModule["activate"];
  };
  const pluginModule: PluginModule =
    mod.default && typeof mod.default.activate === "function"
      ? mod.default
      : { activate: mod.activate! };
  await activatePluginModule(manifest, pluginModule);
}

describe("plugin loader", () => {
  beforeEach(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await unloadAllPlugins();
    registryClear();
    delete (globalThis as TestGlobal).__pluginEvents;
  });

  afterEach(async () => {
    await unloadAllPlugins();
    registryClear();
    delete (globalThis as TestGlobal).__pluginEvents;
    vi.restoreAllMocks();
  });

  it("rolls back registered contributions when activate fails", async () => {
    const manifest = makeManifest(
      "test.plugin.fail-after-register",
      [
        "export default {",
        "  activate(ctx) {",
        "    ctx.register({ type: 'menu.item', id: 'leaky-menu', name: 'Leaky', location: 'toolbar', action() {} });",
        "    throw new Error('boom');",
        "  }",
        "};",
      ].join("\n"),
    );

    await expect(loadTestPluginFromCode(manifest)).rejects.toThrow("boom");

    const menuItems = registryQuery("menu.item");
    expect(menuItems.find((x) => x.id === "leaky-menu")).toBeUndefined();
    expect(loadedPluginIds()).not.toContain(manifest.id);
  });

  it("rejects remote plugin entry URLs via loadPlugin", async () => {
    const manifest: PluginManifest = {
      id: "test.plugin.remote",
      name: "remote",
      version: "0.1.0",
      entry: "https://evil.example/plugin.js",
    };
    await expect(loadPlugin(manifest)).rejects.toThrow(/remote entry URLs are not permitted/);
    expect(loadedPluginIds()).not.toContain(manifest.id);
  });

  it("supports cross-plugin events and unsubscribes on unload", async () => {
    const listener = makeManifest(
      "test.plugin.listener",
      [
        "export default {",
        "  activate(ctx) {",
        "    globalThis.__pluginEvents = [];",
        "    ctx.on('evt', (payload) => { globalThis.__pluginEvents.push(payload); });",
        "  }",
        "};",
      ].join("\n"),
    );
    const emitterA = makeManifest(
      "test.plugin.emitter.a",
      [
        "export default {",
        "  activate(ctx) {",
        "    ctx.emit('evt', { from: 'a' });",
        "  }",
        "};",
      ].join("\n"),
    );
    const emitterB = makeManifest(
      "test.plugin.emitter.b",
      [
        "export default {",
        "  activate(ctx) {",
        "    ctx.emit('evt', { from: 'b' });",
        "  }",
        "};",
      ].join("\n"),
    );

    await loadTestPluginFromCode(listener);
    await loadTestPluginFromCode(emitterA);

    const g = globalThis as TestGlobal;
    expect(g.__pluginEvents).toEqual([{ from: "a" }]);

    await unloadPlugin(listener.id);
    await loadTestPluginFromCode(emitterB);

    expect(g.__pluginEvents).toEqual([{ from: "a" }]);
  });
});

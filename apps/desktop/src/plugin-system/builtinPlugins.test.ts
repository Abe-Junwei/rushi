import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registryClear, registryQuery } from "./registry";
import { loadBuiltinPlugins, loadedPluginIds, unloadAllPlugins } from "./loader";

describe("loadBuiltinPlugins", () => {
  beforeEach(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await unloadAllPlugins();
    registryClear();
  });

  afterEach(async () => {
    await unloadAllPlugins();
    registryClear();
    vi.restoreAllMocks();
  });

  it("loads only shipped built-in plugins", async () => {
    await loadBuiltinPlugins();
    expect(loadedPluginIds().sort()).toEqual(["rushi.export-markdown", "rushi.tts-demo"]);
    expect(registryQuery("export.format").length).toBeGreaterThan(0);
    expect(registryQuery("tts.provider").length).toBeGreaterThan(0);
  });
});

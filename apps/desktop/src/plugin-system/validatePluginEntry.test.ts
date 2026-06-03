import { describe, expect, it } from "vitest";
import { validatePluginEntry } from "./validatePluginEntry";

describe("validatePluginEntry", () => {
  it("allows data:text/javascript for tests", () => {
    expect(() =>
      validatePluginEntry("data:text/javascript,export%20default%20{}", "t"),
    ).not.toThrow();
  });

  it("rejects https entry", () => {
    expect(() => validatePluginEntry("https://evil/plugin.js", "t")).toThrow(
      /remote entry URLs are not permitted/,
    );
  });

  it("rejects path traversal", () => {
    expect(() => validatePluginEntry("./../secret.js", "t")).toThrow(/must not contain \.\./);
  });
});

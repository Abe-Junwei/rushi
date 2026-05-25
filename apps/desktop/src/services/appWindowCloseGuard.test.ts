import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const capabilitiesPath = join(here, "../../src-tauri/capabilities/default.json");

describe("app window close capabilities", () => {
  it("grants destroy so onCloseRequested can finish closing", () => {
    const caps = JSON.parse(readFileSync(capabilitiesPath, "utf8")) as {
      permissions: string[];
    };
    expect(caps.permissions).toContain("core:window:allow-close");
    expect(caps.permissions).toContain("core:window:allow-destroy");
  });
});

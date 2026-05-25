import { describe, expect, it } from "vitest";
import capabilitiesJson from "../../src-tauri/capabilities/default.json";

type AppCapabilities = {
  permissions: string[];
};

function isAppCapabilities(value: unknown): value is AppCapabilities {
  if (!value || typeof value !== "object") return false;
  const permissions = (value as { permissions?: unknown }).permissions;
  return Array.isArray(permissions) && permissions.every((item): item is string => typeof item === "string");
}

describe("app window close capabilities", () => {
  it("grants destroy so onCloseRequested can finish closing", () => {
    const caps: unknown = capabilitiesJson;
    if (!isAppCapabilities(caps)) {
      throw new Error("Invalid Tauri capabilities JSON.");
    }
    expect(caps.permissions).toContain("core:window:allow-close");
    expect(caps.permissions).toContain("core:window:allow-destroy");
  });
});

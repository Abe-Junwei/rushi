import { describe, expect, it } from "vitest";
import { modelsRootMismatch, normalizePathForCompare } from "./asrRuntimePathsAlign";

describe("asrRuntimePathsAlign", () => {
  it("normalizes trailing slashes", () => {
    expect(normalizePathForCompare("/a/models/")).toBe("/a/models");
  });

  it("detects mismatch when sidecar root missing", () => {
    expect(modelsRootMismatch("/app/models", null)).toBe(true);
  });

  it("accepts matching roots", () => {
    expect(modelsRootMismatch("/app/models", "/app/models/")).toBe(false);
  });
});

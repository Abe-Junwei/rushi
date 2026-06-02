import { describe, expect, it } from "vitest";
import { applySpanCorrection } from "./applySpanCorrection";

describe("applySpanCorrection", () => {
  it("replaces span range", () => {
    expect(
      applySpanCorrection("脸喉发炎", { charStart: 0, charEnd: 2, surface: "脸喉" }, "敛喉"),
    ).toBe("敛喉发炎");
  });
});

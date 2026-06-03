import { describe, expect, it } from "vitest";
import {
  applyExportPolishHygiene,
  collapseOralFillerRuns,
  collapseOralStutter,
} from "./exportPolishHygiene";

describe("exportPolishHygiene", () => {
  it("collapses han stutter", () => {
    expect(collapseOralStutter("问我喔喔喔喔喔所以")).toBe("问我喔所以");
    expect(collapseOralStutter("熬鹅鹅鹅就过去了")).toBe("熬鹅就过去了");
  });

  it("collapses filler runs", () => {
    expect(collapseOralFillerRuns("四众禅堂，啊啊啊。")).toBe("四众禅堂，啊。");
  });

  it("applyExportPolishHygiene on lines", () => {
    const out = applyExportPolishHygiene(["坚持熬鹅鹅鹅", "呜呜叫"]);
    expect(out[0]).toBe("坚持熬鹅");
    expect(out[1]).toBe("呜叫");
  });
});

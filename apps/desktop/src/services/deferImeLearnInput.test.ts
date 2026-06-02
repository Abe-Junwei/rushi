import { describe, expect, it } from "vitest";
import { shouldDeferDomInputForIme } from "./deferImeLearnInput";

describe("shouldDeferDomInputForIme", () => {
  it("defers CJK selection replaced by latin (IME pinyin lead-in)", () => {
    const baseline = "只有这种视死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const snap = { value: baseline, start, end };
    const afterLatin = baseline.slice(0, start) + "s" + baseline.slice(end);
    expect(shouldDeferDomInputForIme(snap, afterLatin)).toBe(true);
  });

  it("does not defer plain delete", () => {
    const baseline = "只有这种视死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const snap = { value: baseline, start, end };
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    expect(shouldDeferDomInputForIme(snap, afterDel)).toBe(false);
  });
});

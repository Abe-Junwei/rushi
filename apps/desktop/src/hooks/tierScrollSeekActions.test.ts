import { describe, expect, it, vi } from "vitest";
import { centerTierAtClientX } from "./tierScrollSeekActions";
import type { TierScrollSeekActionArgs } from "./tierScrollSeekActions";

describe("tierScrollSeekActions", () => {
  it("centerTierAtClientX scrolls tier without seeking", () => {
    const seek = vi.fn();
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { configurable: true, value: 800 });
    const setTierScrollImmediate = vi.fn();
    const args: TierScrollSeekActionArgs = {
      tierScrollRef: { current: tier },
      timelineWidthPx: 6000,
      mediaDurationSec: 600,
      wfApiRef: {
        current: {
          isReady: true,
          seek,
          clientXToTimeSec: () => 120,
        },
      } as unknown as TierScrollSeekActionArgs["wfApiRef"],
    };

    centerTierAtClientX(args, 400, setTierScrollImmediate);

    expect(seek).not.toHaveBeenCalled();
    expect(setTierScrollImmediate).toHaveBeenCalledTimes(1);
    expect(setTierScrollImmediate.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
  });
});

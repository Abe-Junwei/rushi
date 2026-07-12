import { describe, expect, it, vi } from "vitest";
import {
  endMediaPlay,
  isMediaPlayInFlight,
  runGatedMediaPlay,
  tryBeginMediaPlay,
} from "./mediaPlayGate";

describe("mediaPlayGate", () => {
  it("rejects a second begin while the first play is held", async () => {
    const host = {};
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = runGatedMediaPlay(host, () => pending);
    expect(isMediaPlayInFlight(host)).toBe(true);
    expect(await runGatedMediaPlay(host, () => undefined)).toBe("busy");
    expect(tryBeginMediaPlay(host)).toBe(false);

    release();
    await expect(first).resolves.toBe("ok");
    expect(isMediaPlayInFlight(host)).toBe(false);
  });

  it("releases the gate when play throws", async () => {
    const host = {};
    await expect(
      runGatedMediaPlay(host, () => {
        throw new Error("play failed");
      }),
    ).rejects.toThrow("play failed");
    expect(isMediaPlayInFlight(host)).toBe(false);
    expect(await runGatedMediaPlay(host, () => undefined)).toBe("ok");
  });

  it("tryBegin / end are paired", () => {
    const host = {};
    expect(tryBeginMediaPlay(host)).toBe(true);
    expect(tryBeginMediaPlay(host)).toBe(false);
    endMediaPlay(host);
    expect(tryBeginMediaPlay(host)).toBe(true);
    endMediaPlay(host);
  });

  it("gates are per host object", async () => {
    const a = {};
    const b = {};
    const playA = vi.fn(() => undefined);
    const playB = vi.fn(() => undefined);
    expect(await runGatedMediaPlay(a, playA)).toBe("ok");
    expect(await runGatedMediaPlay(b, playB)).toBe("ok");
    expect(playA).toHaveBeenCalledOnce();
    expect(playB).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFileViewState,
  fileViewStateStorageKey,
  parseFileViewState,
  readFileViewState,
  resolveResumePlayheadSec,
  resolveRestoreSeekSec,
  writeFileViewState,
} from "./fileViewState";

describe("fileViewState", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
  });

  it("read/write round-trip", () => {
    writeFileViewState("f1", {
      playheadSec: 12.5,
      selectedSegmentUid: "uid-a",
      tierScrollLeftPx: 320,
      layoutPxPerSec: 80,
    });
    expect(readFileViewState("f1")).toMatchObject({
      playheadSec: 12.5,
      selectedSegmentUid: "uid-a",
      tierScrollLeftPx: 320,
      layoutPxPerSec: 80,
    });
    expect(storage.get(fileViewStateStorageKey("f1"))).toBeTruthy();
  });

  it("rejects corrupt payloads", () => {
    expect(parseFileViewState(null)).toBeNull();
    expect(parseFileViewState({ playheadSec: -1 })).toBeNull();
    expect(
      parseFileViewState({
        playheadSec: 1,
        selectedSegmentUid: "",
        tierScrollLeftPx: 0,
        layoutPxPerSec: 56,
        updatedAtMs: 1,
      }),
    ).toBeNull();
  });

  it("clearFileViewState removes key", () => {
    writeFileViewState("f1", {
      playheadSec: 1,
      selectedSegmentUid: null,
      tierScrollLeftPx: 0,
      layoutPxPerSec: 56,
    });
    clearFileViewState("f1");
    expect(readFileViewState("f1")).toBeNull();
  });

  it("resolveResumePlayheadSec applies preroll and near-end restart", () => {
    expect(resolveResumePlayheadSec(10, 100)).toBe(9);
    expect(resolveResumePlayheadSec(0.4, 100)).toBe(0);
    expect(resolveResumePlayheadSec(99, 100)).toBe(0);
    expect(resolveResumePlayheadSec(50, 0)).toBe(49);
  });

  it("resolveRestoreSeekSec prefers segment start over exact playhead", () => {
    expect(
      resolveRestoreSeekSec({ playheadSec: 13, segmentStartSec: 12, durationSec: 100 }),
    ).toBe(12);
    expect(
      resolveRestoreSeekSec({ playheadSec: 10, segmentStartSec: null, durationSec: 100 }),
    ).toBe(9);
    expect(
      resolveRestoreSeekSec({ playheadSec: 10, segmentStartSec: 99, durationSec: 100 }),
    ).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  FLOATING_PANEL_LAYOUT_REV,
  mergePhaseIntoPersistedState,
  resolvePhasePersistedSize,
} from "./floatingPanelPersist";

describe("floatingPanelPersist", () => {
  it("mergePhaseIntoPersistedState stores userSized and phase entry", () => {
    const state = mergePhaseIntoPersistedState({
      prev: null,
      position: { x: 10, y: 20 },
      size: { width: 400, height: 300 },
      userSized: true,
      phaseKey: "preview",
      layoutRev: FLOATING_PANEL_LAYOUT_REV,
    });

    expect(state.userSized).toBe(true);
    expect(state.layoutRev).toBe(FLOATING_PANEL_LAYOUT_REV);
    expect(state.phases?.preview).toEqual({
      size: { width: 400, height: 300 },
      userSized: true,
    });
  });

  it("resolvePhasePersistedSize prefers phase entry when layoutRev matches", () => {
    const saved = {
      position: { x: 0, y: 0 },
      size: { width: 520, height: 200 },
      userSized: false,
      layoutRev: FLOATING_PANEL_LAYOUT_REV,
      phases: {
        empty: { size: { width: 520, height: 360 }, userSized: true },
        preview: { size: { width: 560, height: 480 }, userSized: false },
      },
    };

    expect(resolvePhasePersistedSize(saved, "empty", FLOATING_PANEL_LAYOUT_REV)).toEqual({
      size: { width: 520, height: 360 },
      userSized: true,
    });
    expect(resolvePhasePersistedSize(saved, undefined, FLOATING_PANEL_LAYOUT_REV)).toEqual({
      size: { width: 520, height: 200 },
      userSized: false,
    });
  });

  it("resolvePhasePersistedSize ignores global size when phase entry missing", () => {
    const saved = {
      position: { x: 0, y: 0 },
      size: { width: 520, height: 640 },
      userSized: false,
      layoutRev: FLOATING_PANEL_LAYOUT_REV,
      phases: {
        preview: { size: { width: 560, height: 480 }, userSized: false },
      },
    };
    expect(resolvePhasePersistedSize(saved, "loading", FLOATING_PANEL_LAYOUT_REV)).toBeNull();
  });

  it("resolvePhasePersistedSize ignores stale layoutRev", () => {
    const saved = {
      position: { x: 0, y: 0 },
      size: { width: 520, height: 200 },
      userSized: true,
      layoutRev: 1,
    };
    expect(resolvePhasePersistedSize(saved, "empty", FLOATING_PANEL_LAYOUT_REV)).toBeNull();
  });

  it("resolvePhasePersistedSize ignores legacy entries without layoutRev", () => {
    const saved = {
      position: { x: 0, y: 0 },
      size: { width: 520, height: 640 },
      userSized: true,
      phases: {
        empty: { size: { width: 520, height: 640 }, userSized: true },
      },
    };
    expect(resolvePhasePersistedSize(saved, "empty", FLOATING_PANEL_LAYOUT_REV)).toBeNull();
  });
});

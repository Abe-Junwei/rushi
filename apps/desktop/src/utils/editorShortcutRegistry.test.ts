import { describe, expect, it } from "vitest";
import {
  countShortcutBindingKeys,
  EDITOR_SHORTCUT_DEFINITIONS,
  EDITOR_SHORTCUT_MAX_KEYS,
  formatEditorShortcutPanelSections,
  matchEditorShortcut,
} from "./editorShortcutRegistry";

function keyEvent(
  opts: Partial<{
    key: string;
    code: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }> = {},
): KeyboardEvent {
  return {
    key: "j",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    code: "",
    ...opts,
  } as KeyboardEvent;
}

describe("editorShortcutRegistry", () => {
  it("every binding uses at most three keys", () => {
    for (const def of EDITOR_SHORTCUT_DEFINITIONS) {
      for (const binding of def.bindings) {
        expect(countShortcutBindingKeys(binding)).toBeLessThanOrEqual(EDITOR_SHORTCUT_MAX_KEYS);
      }
    }
  });

  it("matches merge next on Cmd+J", () => {
    expect(matchEditorShortcut(keyEvent({ key: "j", metaKey: true }))).toBe("segment.mergeNext");
  });

  it("matches merge prev on Cmd+K", () => {
    expect(matchEditorShortcut(keyEvent({ key: "k", metaKey: true }))).toBe("segment.mergePrev");
  });

  it("matches split on Cmd+D", () => {
    expect(matchEditorShortcut(keyEvent({ key: "d", metaKey: true }))).toBe("segment.splitPlayhead");
  });

  it("matches bare Space for playback outside transcript edit, Shift+Space everywhere", () => {
    expect(matchEditorShortcut(keyEvent({ key: " " }))).toBe("playback.toggle");
    expect(matchEditorShortcut(keyEvent({ key: " ", shiftKey: true }))).toBe("playback.toggle");
    expect(
      matchEditorShortcut(keyEvent({ key: " ", shiftKey: true }), { inTextarea: true }),
    ).toBe("playback.toggle");
  });

  it("ignores bare Space inside transcript edit (Space inputs text)", () => {
    expect(matchEditorShortcut(keyEvent({ key: " " }), { inTextarea: true })).toBeNull();
  });

  it("ignores Shift+Cmd+Space for playback (legacy chord removed)", () => {
    expect(
      matchEditorShortcut(keyEvent({ key: " ", metaKey: true, shiftKey: true }), { inTextarea: true }),
    ).toBeNull();
  });

  it("ignores plain Cmd+M (macOS minimize)", () => {
    expect(matchEditorShortcut(keyEvent({ key: "m", metaKey: true }))).toBeNull();
  });

  it("distinguishes undo from redo by shift modifier", () => {
    expect(matchEditorShortcut(keyEvent({ key: "z", metaKey: true }))).toBe("edit.undo");
    expect(matchEditorShortcut(keyEvent({ key: "z", metaKey: true, shiftKey: true }))).toBe(
      "edit.redo",
    );
  });

  it("matches copy/cut/paste only inside transcript text edit", () => {
    expect(matchEditorShortcut(keyEvent({ key: "c", metaKey: true }))).toBeNull();
    expect(matchEditorShortcut(keyEvent({ key: "x", metaKey: true }))).toBeNull();
    expect(matchEditorShortcut(keyEvent({ key: "v", metaKey: true }))).toBeNull();
    expect(matchEditorShortcut(keyEvent({ key: "c", metaKey: true }), { inTextarea: true })).toBe(
      "edit.copy",
    );
    expect(matchEditorShortcut(keyEvent({ key: "x", metaKey: true }), { inTextarea: true })).toBe(
      "edit.cut",
    );
    expect(matchEditorShortcut(keyEvent({ key: "v", metaKey: true }), { inTextarea: true })).toBe(
      "edit.paste",
    );
  });

  it("matches workflow save on Cmd+S", () => {
    expect(matchEditorShortcut(keyEvent({ key: "s", metaKey: true }))).toBe("workflow.save");
  });

  it("matches focus text on Cmd+E", () => {
    expect(matchEditorShortcut(keyEvent({ key: "e", metaKey: true }))).toBe("segment.focusText");
  });

  it("matches delete segment on Cmd+Backspace", () => {
    expect(matchEditorShortcut(keyEvent({ key: "Backspace", metaKey: true }))).toBe("segment.delete");
  });

  it("matches find on Cmd+F", () => {
    expect(matchEditorShortcut(keyEvent({ key: "f", metaKey: true }))).toBe("workflow.find");
  });

  it("matches close file on Shift+Cmd+E", () => {
    expect(matchEditorShortcut(keyEvent({ key: "e", metaKey: true, shiftKey: true }))).toBe(
      "workflow.closeFile",
    );
  });

  it("matches open settings on Cmd+,", () => {
    expect(matchEditorShortcut(keyEvent({ key: ",", metaKey: true }))).toBe("workflow.openSettings");
  });

  it("matches open activity inbox on Shift+Cmd+N", () => {
    expect(matchEditorShortcut(keyEvent({ key: "n", metaKey: true, shiftKey: true }))).toBe(
      "workflow.openActivityInbox",
    );
  });

  it("matches segment annotation on Cmd+N", () => {
    expect(matchEditorShortcut(keyEvent({ key: "n", metaKey: true }))).toBe("workflow.segmentAnnotation");
    expect(
      matchEditorShortcut(keyEvent({ key: "f", metaKey: true, shiftKey: true })),
    ).toBe("segment.freezeToggle");
  });

  it("matches segment loop on Cmd+L and correction memory on Shift+Cmd+L", () => {
    expect(matchEditorShortcut(keyEvent({ key: "l", metaKey: true }))).toBe(
      "playback.toggleSegmentLoop",
    );
    expect(matchEditorShortcut(keyEvent({ key: "l", metaKey: true, shiftKey: true }))).toBe(
      "workflow.addCorrectionMemory",
    );
  });

  it("matches advanceSegment on Tab in transcript textarea only", () => {
    expect(matchEditorShortcut(keyEvent({ key: "Tab" }), { inTextarea: true })).toBe(
      "workflow.advanceSegment",
    );
    expect(matchEditorShortcut(keyEvent({ key: "Tab" }), { inTextarea: false })).toBeNull();
  });

  it("matches firstProofAdvance on Enter in transcript textarea only", () => {
    expect(matchEditorShortcut(keyEvent({ key: "Enter" }), { inTextarea: true })).toBe(
      "workflow.firstProofAdvance",
    );
    expect(matchEditorShortcut(keyEvent({ key: "Enter" }), { inTextarea: false })).toBeNull();
  });

  it("matches confirmAdvance on Mod+Enter in transcript textarea only", () => {
    expect(matchEditorShortcut(keyEvent({ key: "Enter", metaKey: true }), { inTextarea: true })).toBe(
      "workflow.confirmAdvance",
    );
    expect(matchEditorShortcut(keyEvent({ key: "Enter", ctrlKey: true }), { inTextarea: true })).toBe(
      "workflow.confirmAdvance",
    );
    expect(matchEditorShortcut(keyEvent({ key: "Enter", metaKey: true }), { inTextarea: false })).toBeNull();
  });

  it("does not match confirmAdvance on Tab", () => {
    expect(matchEditorShortcut(keyEvent({ key: "Tab" }), { inTextarea: true })).not.toBe(
      "workflow.confirmAdvance",
    );
  });

  it("matches waveform escape only in waveform scope definitions", () => {
    expect(matchEditorShortcut(keyEvent({ key: "Escape" }))).toBe("waveform.clearSelection");
  });
});

describe("formatEditorShortcutPanelSections", () => {
  it("includes grouped panel rows with full actions", () => {
    const sections = formatEditorShortcutPanelSections();
    const transcript = sections.find((s) => s.id === "transcript");
    expect(transcript?.rows.some((r) => r.keys === "↑ / ↓")).toBe(true);
    expect(
      transcript?.rows.find((r) => r.keys === "↑ / ↓")?.action,
    ).toMatch(/不 seek/);
    expect(transcript?.rows.some((r) => r.id === "segment.mergeNext")).toBe(true);

    const playback = sections.find((s) => s.id === "playback");
    expect(playback?.rows[0]?.keys).toBe("Space / Shift + Space");
    expect(playback?.rows[0]?.action).toMatch(/会话粘性|全局/);

    const waveform = sections.find((s) => s.id === "waveform");
    expect(waveform?.rows.some((r) => r.id === "waveform.clearSelection")).toBe(true);
    expect(waveform?.rows.length).toBeGreaterThan(0);

    const other = sections.find((s) => s.id === "other");
    expect(other?.rows.some((r) => r.id === "dialog-escape" && r.keys === "Esc")).toBe(true);

    const workflow = sections.find((s) => s.id === "workflow");
    expect(workflow?.rows.some((r) => r.keys === "⌘/Ctrl + F")).toBe(true);
    expect(workflow?.rows.find((r) => r.keys === "Tab")?.action).toMatch(/不定稿/);
    expect(workflow?.rows.find((r) => r.keys === "Enter")?.action).toMatch(/一校/);
    expect(workflow?.rows.find((r) => r.keys === "⌘/Ctrl + Enter")?.action).toMatch(/定稿/);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { TRANSCRIPT_EDITOR_CORE_ATTR } from "../components/editor/core/transcriptEditorDom";
import { isEditorFocusGateOpen, isWaveformShellFocused } from "./editorFocusGate";

describe("editorFocusGate", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens when CM6 transcript core is focused", () => {
    document.body.innerHTML = `
      <div class="cm-editor" ${TRANSCRIPT_EDITOR_CORE_ATTR}="1" tabindex="0"></div>
    `;
    const core = document.querySelector(".cm-editor") as HTMLElement;
    core.focus();
    expect(isEditorFocusGateOpen({ segmentsLength: 5, waveformShell: null })).toBe(true);
  });

  it("opens when focus is inside waveform shell", () => {
    document.body.innerHTML = `<div id="shell"><button type="button">wave</button></div>`;
    const shell = document.getElementById("shell")!;
    shell.querySelector("button")!.focus();
    expect(isWaveformShellFocused(shell)).toBe(true);
    expect(isEditorFocusGateOpen({ segmentsLength: 1, waveformShell: shell })).toBe(true);
  });

  it("closed when focus is outside shell and CM6", () => {
    document.body.innerHTML = `
      <div id="shell"></div>
      <button id="hub" type="button">hub</button>
    `;
    document.getElementById("hub")!.focus();
    expect(
      isEditorFocusGateOpen({
        segmentsLength: 3,
        waveformShell: document.getElementById("shell"),
      }),
    ).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { isEditorFocusGateOpen, isWaveformShellFocused } from "./editorFocusGate";

describe("editorFocusGate", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens when segment textarea is focused", () => {
    document.body.innerHTML = `
      <div data-seg-row="2">
        <textarea aria-label="语段正文" class="seg-text"></textarea>
      </div>
    `;
    const textarea = document.querySelector("textarea")!;
    textarea.focus();
    expect(isEditorFocusGateOpen({ segmentsLength: 5, waveformShell: null })).toBe(true);
  });

  it("opens when focus is inside waveform shell", () => {
    document.body.innerHTML = `<div id="shell"><button type="button">wave</button></div>`;
    const shell = document.getElementById("shell")!;
    shell.querySelector("button")!.focus();
    expect(isWaveformShellFocused(shell)).toBe(true);
    expect(isEditorFocusGateOpen({ segmentsLength: 1, waveformShell: shell })).toBe(true);
  });

  it("closed when focus is outside shell and no textarea", () => {
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

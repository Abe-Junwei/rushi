import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { buildTranscriptEditorState, transcriptEditorCoreExtensions } from "./index";
import { transcriptPointerScrollGuard } from "./transcriptPointerScrollGuard";
import type { SegmentDto } from "../../../tauri/projectTypes";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text: `语段${i}`,
    kind: "speech" as const,
  }));
}

describe("transcriptPointerScrollGuard", () => {
  it("suppresses scrollIntoView on same-line pointer selection", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false, withMetaGutter: false }),
        transcriptPointerScrollGuard,
      ],
    });
    const view = new EditorView({ state, parent });
    Object.defineProperty(view.scrollDOM, "scrollTop", {
      configurable: true,
      writable: true,
      value: 120,
    });
    const line = view.state.doc.line(2);
    view.dispatch({
      selection: { anchor: line.from + 2, head: line.from + 2 },
      scrollIntoView: true,
      userEvent: "select.pointer",
    });
    expect(view.scrollDOM.scrollTop).toBe(120);
    view.destroy();
    parent.remove();
  });
});

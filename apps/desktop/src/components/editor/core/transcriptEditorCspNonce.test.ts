// @vitest-environment jsdom

import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { afterEach, describe, expect, it } from "vitest";
import {
  TAURI_STYLE_CSP_NONCE_PROBE_ID,
  TAURI_STYLE_NONCE_TOKEN,
} from "../../../utils/tauriStyleCspNonce";
import { transcriptEditorCspNonceExtension } from "./transcriptEditorCoreExtensions";

describe("transcriptEditorCspNonceExtension", () => {
  afterEach(() => {
    document.getElementById(TAURI_STYLE_CSP_NONCE_PROBE_ID)?.remove();
  });

  it("is empty when no Tauri style nonce is present", () => {
    expect(transcriptEditorCspNonceExtension(() => undefined)).toEqual([]);
  });

  it("wires EditorView.cspNonce so StyleModule can mount under production CSP", () => {
    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.nonce = "test-nonce-abc";
    document.head.appendChild(probe);

    const extensions = transcriptEditorCspNonceExtension();
    expect(extensions).toHaveLength(1);

    const state = EditorState.create({ extensions });
    expect(state.facet(EditorView.cspNonce)).toBe("test-nonce-abc");
  });

  it("ignores the unresolved Tauri placeholder token", () => {
    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.setAttribute("nonce", TAURI_STYLE_NONCE_TOKEN);
    document.head.appendChild(probe);
    expect(transcriptEditorCspNonceExtension()).toEqual([]);
  });
});

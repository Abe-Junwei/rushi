import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureTranscriptTextareaSelection,
  readTranscriptTextareaSelection,
  syncTranscriptTextareaSelection,
} from "./transcriptSelection";

describe("transcriptSelection", () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "语段正文");
    textarea.value = "禅宗讲记";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
  });

  afterEach(() => {
    textarea.remove();
  });

  it("reads live selection from transcript textarea", () => {
    expect(readTranscriptTextareaSelection()).toBe("禅宗");
  });

  it("uses cache after focus leaves the textarea", () => {
    syncTranscriptTextareaSelection(textarea);
    textarea.setSelectionRange(0, 0);
    textarea.blur();
    expect(readTranscriptTextareaSelection()).toBe("禅宗");
  });

  it("captureTranscriptTextareaSelection stores selection for toolbar click", () => {
    syncTranscriptTextareaSelection(textarea);
    textarea.setSelectionRange(0, 0);
    expect(captureTranscriptTextareaSelection()).toBe("禅宗");
    textarea.blur();
    expect(readTranscriptTextareaSelection()).toBe("禅宗");
  });
});

import { describe, expect, it } from "vitest";
import {
  WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL,
  WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES,
} from "./waveformPlaybackScrollFollowUi";

describe("waveformPlaybackScrollFollowUi", () => {
  it("uses 翻页/居中 labels instead of misleading 跟随", () => {
    const labels = WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES.map((m) => m.label);
    expect(labels).toEqual(["翻页", "居中"]);
    expect(labels).not.toContain("跟随");
    expect(WAVEFORM_PLAYBACK_SCROLL_FOLLOW_GROUP_LABEL).toContain("播放头");
  });

  it("keeps internal mode ids stable for prefs persistence", () => {
    expect(WAVEFORM_PLAYBACK_SCROLL_FOLLOW_UI_MODES.map((m) => m.id)).toEqual([
      "edge",
      "center",
    ]);
  });
});

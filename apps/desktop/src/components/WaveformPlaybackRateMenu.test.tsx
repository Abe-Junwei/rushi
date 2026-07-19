// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaveformPlaybackRateMenu } from "./WaveformPlaybackRateMenu";

describe("WaveformPlaybackRateMenu", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("offers 0.75x as a slower playback preset", () => {
    render(<WaveformPlaybackRateMenu disabled={false} playbackRate={1} onPlaybackRateChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "1x" }));

    const slowerList = screen.getByRole("listbox", { name: "播放速度（更慢）" });
    expect(within(slowerList).getByRole("option", { name: "0.75×" })).toBeTruthy();
  });

  it("shows immediate pending feedback after picking a rate", () => {
    vi.useFakeTimers();
    const onPlaybackRateChange = vi.fn();
    render(
      <WaveformPlaybackRateMenu
        disabled={false}
        playbackRate={1}
        onPlaybackRateChange={onPlaybackRateChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: "1x" });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("listbox", { name: "播放速度（更慢）" })).getByRole("option", { name: "0.75×" }));

    expect(onPlaybackRateChange).toHaveBeenCalledWith(0.75);
    expect(trigger.className).toContain("waveform-playback-rate-trigger-rate-pending");
    expect(trigger.getAttribute("aria-busy")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(trigger.className).not.toContain("waveform-playback-rate-trigger-rate-pending");
    expect(trigger.hasAttribute("aria-busy")).toBe(false);
  });
});

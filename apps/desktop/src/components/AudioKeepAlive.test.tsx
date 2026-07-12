import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioKeepAlive } from "./AudioKeepAlive";

describe("AudioKeepAlive", () => {
  let playSpy: ReturnType<typeof vi.fn>;
  let pauseSpy: ReturnType<typeof vi.fn>;
  let createUrlSpy: ReturnType<typeof vi.fn>;
  let revokeUrlSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    playSpy = vi.fn(() => Promise.resolve());
    pauseSpy = vi.fn();
    HTMLMediaElement.prototype.play = playSpy as unknown as HTMLMediaElement["play"];
    HTMLMediaElement.prototype.pause = pauseSpy as unknown as HTMLMediaElement["pause"];
    createUrlSpy = vi.fn(() => "blob:silent-wav");
    revokeUrlSpy = vi.fn();
    URL.createObjectURL = createUrlSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeUrlSpy as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mounts a hidden looping audio anchor and starts playback", () => {
    const { container } = render(<AudioKeepAlive />);
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio?.loop).toBe(true);
    expect(audio?.getAttribute("aria-hidden")).toBe("true");
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalled();
  });

  it("resumes when the element is paused by the host", () => {
    const { container } = render(<AudioKeepAlive />);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    playSpy.mockClear();
    audio.dispatchEvent(new Event("pause"));
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("retries playback on the first user gesture (autoplay fallback)", () => {
    render(<AudioKeepAlive />);
    playSpy.mockClear();
    window.dispatchEvent(new Event("pointerdown"));
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("stops and revokes the object URL on unmount", () => {
    const { unmount } = render(<AudioKeepAlive />);
    unmount();
    expect(pauseSpy).toHaveBeenCalled();
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:silent-wav");
  });

  it("does not resume after unmount even if a pause fires", () => {
    const { container, unmount } = render(<AudioKeepAlive />);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    unmount();
    playSpy.mockClear();
    audio.dispatchEvent(new Event("pause"));
    expect(playSpy).not.toHaveBeenCalled();
  });
});

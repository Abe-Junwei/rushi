// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvPreferencesPanel } from "./EnvPreferencesPanel";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

describe("EnvPreferencesPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("renders appearance and transcript preference sections", () => {
    render(<EnvPreferencesPanel />);
    expect(screen.getByRole("heading", { name: "外观" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "转写与波形" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "界面主题" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "主题色" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Tab 定稿后 loop 播下一段" })).toBeTruthy();
  });

  it("persists tab advance loop preference", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.click(screen.getByRole("switch", { name: "Tab 定稿后 loop 播下一段" }));
    expect(localStorage.getItem("rushi.p1.tabAdvanceLoopsSegment")).toBe("0");
  });

  it("persists accent theme from custom select", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.click(screen.getByRole("combobox", { name: "主题色" }));
    const listbox = screen.getByRole("listbox", { name: "主题色" });
    fireEvent.click(within(listbox).getByRole("option", { name: "蓝色" }));
    expect(localStorage.getItem("rushi.office-accent-theme.v1")).toBe("blue");
  });

  it("persists playback rate from custom select", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.click(screen.getByRole("combobox", { name: "默认播放速度" }));
    const listbox = screen.getByRole("listbox", { name: "默认播放速度" });
    fireEvent.click(within(listbox).getByRole("option", { name: "1.5x" }));
    expect(localStorage.getItem("rushi.p1.waveformGlobalPlaybackRate")).toBe("1.5");
  });

  it("commits waveform height after blur without clamping each keystroke", () => {
    render(<EnvPreferencesPanel />);
    const input = screen.getByDisplayValue("220") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "18" } });
    expect(input.value).toBe("18");
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBeNull();
    fireEvent.blur(input);
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBe("56");
    fireEvent.change(input, { target: { value: "180" } });
    fireEvent.blur(input);
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBe("180");
  });
});

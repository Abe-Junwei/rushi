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
    expect(screen.getByRole("combobox", { name: "界面缩放" })).toBeTruthy();
    expect(screen.getByLabelText("主题色")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重置主题色" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "跳段后 loop 播新语段" })).toBeTruthy();
  });

  it("persists ui display scale from custom select", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.click(screen.getByRole("combobox", { name: "界面缩放" }));
    const listbox = screen.getByRole("listbox", { name: "界面缩放" });
    fireEvent.click(within(listbox).getByRole("option", { name: "125%" }));
    expect(localStorage.getItem("rushi.ui-scale.v1")).toBe("1.25");
    expect(document.documentElement.dataset.uiScale).toBe("1.25");
  });

  it("persists tab advance loop preference", () => {
    render(<EnvPreferencesPanel />);
    // Default off → first click turns on.
    fireEvent.click(screen.getByRole("switch", { name: "跳段后 loop 播新语段" }));
    expect(localStorage.getItem("rushi.p1.tabAdvanceLoopsSegment")).toBe("1");
    fireEvent.click(screen.getByRole("switch", { name: "跳段后 loop 播新语段" }));
    expect(localStorage.getItem("rushi.p1.tabAdvanceLoopsSegment")).toBe("0");
  });

  it("persists accent color from color input", () => {
    render(<EnvPreferencesPanel />);
    const input = screen.getByLabelText("主题色");
    fireEvent.change(input, { target: { value: "#0078d4" } });
    expect(localStorage.getItem("rushi.office-accent-color.v2")).toBe("#0078d4");
  });

  it("resets accent color to brand", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.change(screen.getByLabelText("主题色"), { target: { value: "#107c10" } });
    fireEvent.click(screen.getByRole("button", { name: "重置主题色" }));
    expect(localStorage.getItem("rushi.office-accent-color.v2")).toBe("#c58a43");
  });

  it("persists playback rate from custom select", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.click(screen.getByRole("combobox", { name: "默认播放速度" }));
    const listbox = screen.getByRole("listbox", { name: "默认播放速度" });
    expect(within(listbox).getByRole("option", { name: "0.75x" })).toBeTruthy();
    fireEvent.click(within(listbox).getByRole("option", { name: "1.5x" }));
    expect(localStorage.getItem("rushi.p1.waveformGlobalPlaybackRate")).toBe("1.5");
  });

  it("commits waveform height after blur without clamping each keystroke", () => {
    render(<EnvPreferencesPanel />);
    const input = screen.getByDisplayValue("220");
    fireEvent.change(input, { target: { value: "18" } });
    expect(screen.getByDisplayValue("18")).toBeTruthy();
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBeNull();
    fireEvent.blur(input);
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBe("56");
    fireEvent.change(screen.getByDisplayValue("56"), { target: { value: "180" } });
    fireEvent.blur(screen.getByDisplayValue("180"));
    expect(localStorage.getItem("rushi.p1.waveformHeightPx")).toBe("180");
  });
});

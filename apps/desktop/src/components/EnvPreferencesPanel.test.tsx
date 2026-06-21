// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("heading", { name: "界面主题" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "转写与波形" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Tab 定稿后 loop 播下一段" })).toBeTruthy();
  });

  it("persists tab advance loop preference", () => {
    render(<EnvPreferencesPanel />);
    fireEvent.click(screen.getByRole("switch", { name: "Tab 定稿后 loop 播下一段" }));
    expect(localStorage.getItem("rushi.p1.tabAdvanceLoopsSegment")).toBe("0");
  });
});

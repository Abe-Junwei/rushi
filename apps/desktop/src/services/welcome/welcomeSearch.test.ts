import { beforeEach, describe, expect, it } from "vitest";
import {
  formatWelcomeFileMatchLabel,
  readWelcomeSearchScope,
  WELCOME_SEARCH_SCOPE_STORAGE_KEY,
  writeWelcomeSearchScope,
} from "./welcomeSearch";

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
    clear: () => {
      data.clear();
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("welcomeSearch", () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
  });

  it("formats matched field labels", () => {
    expect(formatWelcomeFileMatchLabel("narrator")).toBe("讲述人匹配");
    expect(formatWelcomeFileMatchLabel("unknown")).toBe("匹配");
  });

  it("persists search scope with all default", () => {
    expect(readWelcomeSearchScope()).toBe("all");
    writeWelcomeSearchScope("content");
    expect(window.localStorage.getItem(WELCOME_SEARCH_SCOPE_STORAGE_KEY)).toBe("content");
    expect(readWelcomeSearchScope()).toBe("content");
    writeWelcomeSearchScope("file");
    expect(readWelcomeSearchScope()).toBe("file");
  });
});

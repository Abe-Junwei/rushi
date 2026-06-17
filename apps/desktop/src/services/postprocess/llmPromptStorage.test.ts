import { beforeEach, describe, expect, it } from "vitest";
import {
  buildProfilePromptSection,
  mergePromptDraftWithDefaults,
  persistLlmPromptOverrides,
  profilePromptSectionToOverrides,
  readLlmPromptOverridesFromStorage,
  resolveEffectiveLlmPromptOverrides,
} from "./llmPromptStorage";

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
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

const defaults = {
  stageBSystem: "stage b system",
  stageBInstructions: "stage b instructions",
  autoPunctuateSystem: "auto system",
  autoPunctuateInstructions: "auto instructions",
  exportPolishSystem: "export system",
  exportPolishInstructions: "export template {body}",
};

describe("llmPromptStorage", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("persists and reads all prompt overrides", () => {
    persistLlmPromptOverrides({
      stageBSystem: "sb",
      autoPunctuateInstructions: "ap",
      exportPolishSystem: "ep",
    });
    expect(readLlmPromptOverridesFromStorage()).toEqual({
      stageBSystem: "sb",
      autoPunctuateInstructions: "ap",
      exportPolishSystem: "ep",
    });
  });

  it("treats default-equivalent draft as no override", () => {
    expect(resolveEffectiveLlmPromptOverrides(defaults, defaults)).toBeUndefined();
  });

  it("builds profile prompt section from overrides", () => {
    const section = buildProfilePromptSection({
      autoPunctuateSystem: "custom auto",
    });
    expect(section).toEqual({ auto_punctuate_system: "custom auto" });
    expect(profilePromptSectionToOverrides(section!)).toEqual({
      autoPunctuateSystem: "custom auto",
    });
  });

  it("rejects export polish templates missing required placeholders", () => {
    expect(() => persistLlmPromptOverrides({ exportPolishInstructions: "只润色 {body}" })).toThrow(
      "缺少占位符",
    );
  });

  it("merges stored overrides with defaults for display", () => {
    persistLlmPromptOverrides({
      exportPolishInstructions: "only export {line_count} {batch_note} {rule_hints} {body}",
    });
    expect(mergePromptDraftWithDefaults(readLlmPromptOverridesFromStorage(), defaults)).toMatchObject({
      exportPolishInstructions: "only export {line_count} {batch_note} {rule_hints} {body}",
      autoPunctuateSystem: "auto system",
    });
  });
});

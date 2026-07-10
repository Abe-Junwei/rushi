import { describe, expect, it, afterEach } from "vitest";
import {
  clearCspLayoutRules,
  CSP_LAYOUT_OWNER_IMPERATIVE,
  CSP_LAYOUT_OWNER_REACT,
  ensureCspLayoutId,
  formatCspLayoutDeclarations,
  readCspLayoutRulesForElement,
  setCspLayoutRules,
  setDirectLayoutStyle,
} from "./cspElementLayout";
import { clearAllCspScopeRulesForTests, readCspScopeRules } from "./cspNonceStyleRegistry";

describe("cspElementLayout", () => {
  afterEach(() => {
    clearAllCspScopeRulesForTests();
  });

  it("formats pixel and string declarations", () => {
    expect(formatCspLayoutDeclarations({ left: 10, top: "20%", zIndex: 5 })).toBe(
      "left: 10px; top: 20%; z-index: 5",
    );
  });

  it("writes per-element rules via registry", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setCspLayoutRules(el, { left: 12, top: 24 });
    const id = ensureCspLayoutId(el);
    const css = readCspScopeRules(`layout-${id}`);
    expect(css).toContain(`left: 12px`);
    expect(css).toContain(`top: 24px`);
    clearCspLayoutRules(el);
    expect(readCspScopeRules(`layout-${id}`)).toBeUndefined();
    el.remove();
  });

  it("merges react and imperative owners on the same element", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setCspLayoutRules(el, { height: 120 }, CSP_LAYOUT_OWNER_REACT);
    setCspLayoutRules(el, { width: 800 }, CSP_LAYOUT_OWNER_IMPERATIVE);
    const css = readCspLayoutRulesForElement(el);
    expect(css).toContain("height: 120px");
    expect(css).toContain("width: 800px");
    clearCspLayoutRules(el, CSP_LAYOUT_OWNER_REACT);
    expect(readCspLayoutRulesForElement(el)).toContain("width: 800px");
    expect(readCspLayoutRulesForElement(el)).not.toContain("height:");
    clearCspLayoutRules(el);
    el.remove();
  });

  it("setDirectLayoutStyle writes inline el.style (kebab + units) without touching registry", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setDirectLayoutStyle(el, { left: 12, width: 640, transform: "translate3d(4px, 0, 0)" });
    expect(el.style.getPropertyValue("left")).toBe("12px");
    expect(el.style.getPropertyValue("width")).toBe("640px");
    expect(el.style.getPropertyValue("transform")).toBe("translate3d(4px, 0, 0)");
    // Custom properties keep raw value; registry scope must stay empty.
    setDirectLayoutStyle(el, { "--x": "7px" });
    expect(el.style.getPropertyValue("--x")).toBe("7px");
    const id = ensureCspLayoutId(el);
    expect(readCspScopeRules(`layout-${id}`)).toBeUndefined();
    el.remove();
  });

  it("setDirectLayoutStyle removes a property when value is null/empty", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setDirectLayoutStyle(el, { transform: "translate3d(4px, 0, 0)" });
    expect(el.style.getPropertyValue("transform")).toBe("translate3d(4px, 0, 0)");
    setDirectLayoutStyle(el, { transform: undefined });
    expect(el.style.getPropertyValue("transform")).toBe("");
    el.remove();
  });

  it("merges successive imperative updates on the same element", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setCspLayoutRules(el, { width: 640 });
    setCspLayoutRules(el, { transform: "translate3d(12px, 0, 0)" });
    const css = readCspLayoutRulesForElement(el);
    expect(css).toContain("width: 640px");
    expect(css).toContain("transform: translate3d(12px, 0, 0)");
    clearCspLayoutRules(el);
    el.remove();
  });
});

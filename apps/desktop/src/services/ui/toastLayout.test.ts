import { afterEach, describe, expect, it } from "vitest";
import { readCspScopeRules } from "../../utils/cspNonceStyleRegistry";
import {
  clearToastBottomInset,
  EDITOR_STATUS_FOOTER_PX,
  syncToastBottomInset,
  TOAST_INSET_ABOVE_FOOTER,
} from "./toastLayout";

describe("toastLayout", () => {
  afterEach(() => {
    clearToastBottomInset();
  });

  it("uses tighter inset when editor status footer is visible", () => {
    syncToastBottomInset(true);
    const v = readCspScopeRules("toast-bottom-inset") ?? "";
    expect(v).toContain(`${EDITOR_STATUS_FOOTER_PX}px`);
    expect(v).toContain(TOAST_INSET_ABOVE_FOOTER);
  });

  it("uses default inset without editor status footer", () => {
    syncToastBottomInset(false);
    const v = readCspScopeRules("toast-bottom-inset") ?? "";
    expect(v).toContain("1.25rem");
    expect(v).not.toContain(`${EDITOR_STATUS_FOOTER_PX}px`);
  });

  it("clears inset on clearToastBottomInset", () => {
    syncToastBottomInset(true);
    clearToastBottomInset();
    expect(readCspScopeRules("toast-bottom-inset")).toBeUndefined();
  });
});

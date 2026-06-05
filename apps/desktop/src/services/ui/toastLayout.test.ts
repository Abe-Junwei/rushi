import { afterEach, describe, expect, it } from "vitest";
import {
  clearToastBottomInset,
  EDITOR_STATUS_FOOTER_PX,
  syncToastBottomInset,
  toastBottomInsetCssVar,
} from "./toastLayout";

describe("toastLayout", () => {
  afterEach(() => {
    clearToastBottomInset();
  });

  it("uses tighter inset when editor status footer is visible", () => {
    syncToastBottomInset(true);
    const v = document.documentElement.style.getPropertyValue("--rushi-toast-bottom");
    expect(v).toContain(`${EDITOR_STATUS_FOOTER_PX}px`);
    expect(v).toContain("0.75rem");
  });

  it("uses default inset without editor status footer", () => {
    syncToastBottomInset(false);
    const v = document.documentElement.style.getPropertyValue("--rushi-toast-bottom");
    expect(v).toContain("1.25rem");
    expect(v).not.toContain(`${EDITOR_STATUS_FOOTER_PX}px`);
  });

  it("exposes css var helper with fallback", () => {
    expect(toastBottomInsetCssVar()).toContain("--rushi-toast-bottom");
    expect(toastBottomInsetCssVar()).toContain("1.25rem");
  });
});

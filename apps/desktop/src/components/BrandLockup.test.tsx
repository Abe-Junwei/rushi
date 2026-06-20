import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "./BrandLockup";

describe("BrandLockup", () => {
  it("renders wordmark and tagline for sidebar", () => {
    render(<BrandLockup size="sidebar" />);
    expect(screen.getByRole("heading", { level: 1, name: "如是我闻" })).toBeTruthy();
    expect(screen.getByText("音频转录与校对平台")).toBeTruthy();
    expect(document.querySelector(".h-8.w-8 img")?.getAttribute("width")).toBe("26");
  });

  it("uses about sizing with 48px mark container", () => {
    const { container } = render(<BrandLockup size="about" />);
    const root = container.firstElementChild;
    expect(root?.querySelector(".h-12.w-12")).toBeTruthy();
    expect(root?.querySelector("p.font-serif")?.textContent).toBe("如是我闻");
  });
});

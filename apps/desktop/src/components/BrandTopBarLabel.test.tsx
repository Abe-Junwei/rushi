import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandTopBarLabel } from "./BrandTopBarLabel";

describe("BrandTopBarLabel", () => {
  it("renders compact mark and caps label", () => {
    render(<BrandTopBarLabel />);
    expect(screen.getByText("如是我闻 · 本地校对")).toBeTruthy();
    expect(document.querySelector(".h-4.w-4 img")?.getAttribute("width")).toBe("13");
  });
});

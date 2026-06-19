import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("renders the calligraphy mark image", () => {
    const { container } = render(<BrandMark size={32} variant="onPrimary" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("width")).toBe("32");
    expect(img?.getAttribute("height")).toBe("32");
    expect(img?.getAttribute("src")).toMatch(/mark-ru-on-primary\.png/);
  });

  it("uses the standard asset for the standard variant", () => {
    const { container } = render(<BrandMark size={18} variant="standard" />);
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/mark-ru-standard\.png/);
  });
});

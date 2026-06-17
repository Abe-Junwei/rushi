import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("renders three column strokes", () => {
    const { container } = render(<BrandMark size={32} variant="onPrimary" />);
    expect(container.querySelectorAll("line")).toHaveLength(4);
  });
});

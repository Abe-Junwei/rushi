import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResizeBottomHit } from "./ResizeBottomHit";

afterEach(() => {
  cleanup();
});

describe("ResizeBottomHit", () => {
  it("forwards pointer down without visible triangle chrome", () => {
    const onPointerDown = vi.fn();
    render(
      <ResizeBottomHit busy={false} ariaLabel="调节高度" onPointerDown={onPointerDown} />,
    );
    const hit = screen.getByLabelText("调节高度");
    expect(hit.className).toContain("cursor-row-resize");
    expect(hit.children.length).toBe(0);
    fireEvent.pointerDown(hit, { button: 0, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("does not forward pointer down when busy", () => {
    const onPointerDown = vi.fn();
    render(<ResizeBottomHit busy ariaLabel="调节高度" onPointerDown={onPointerDown} />);
    fireEvent.pointerDown(screen.getByLabelText("调节高度"), { button: 0 });
    expect(onPointerDown).not.toHaveBeenCalled();
  });
});

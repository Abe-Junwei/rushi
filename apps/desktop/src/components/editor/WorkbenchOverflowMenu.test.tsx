/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorkbenchOverflowMenu } from "./WorkbenchOverflowMenu";

describe("WorkbenchOverflowMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens portal menu on trigger click", () => {
    render(
      <WorkbenchOverflowMenu label="编辑" ariaLabel="编辑菜单">
        {(close) => (
          <button type="button" onClick={close}>
            自动转录
          </button>
        )}
      </WorkbenchOverflowMenu>,
    );

    const trigger = screen.getByLabelText("编辑菜单");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.querySelector(".workbench-compact-menu-panel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "自动转录" })).toBeTruthy();
  });
});

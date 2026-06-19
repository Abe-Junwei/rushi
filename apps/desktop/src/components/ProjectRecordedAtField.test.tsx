import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ProjectRecordedAtField } from "./ProjectRecordedAtField";
import { RECORDED_AT_FORMAT_HINT, RECORDED_AT_PLACEHOLDER } from "../utils/projectRecordedAt";

function ControlledField({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <ProjectRecordedAtField value={value} disabled={false} onChange={setValue} />
  );
}

describe("ProjectRecordedAtField", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a single free-text input with format hint", () => {
    render(<ControlledField initial="2024-06" />);

    expect(screen.getByPlaceholderText(RECORDED_AT_PLACEHOLDER)).toBeTruthy();
    expect(screen.getByDisplayValue("2024-06")).toBeTruthy();
    expect(screen.getByText(RECORDED_AT_FORMAT_HINT)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("accepts ISO-like and descriptive text without mode switching", () => {
    render(<ControlledField />);

    const input = screen.getByPlaceholderText(RECORDED_AT_PLACEHOLDER);
    fireEvent.change(input, { target: { value: "2024-06-15" } });
    expect(screen.getByDisplayValue("2024-06-15")).toBeTruthy();

    fireEvent.change(input, { target: { value: "约 1990 年代" } });
    expect(screen.getByDisplayValue("约 1990 年代")).toBeTruthy();
  });
});

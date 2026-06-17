import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { ProjectRecordedAtField } from "./ProjectRecordedAtField";

type FormValueElement = HTMLInputElement | HTMLSelectElement;

function valueControlByLabel(label: string): FormValueElement {
  const el = screen.getByLabelText(label);
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) {
    throw new Error(`${label} should resolve to a value control`);
  }
  return el;
}

function valueControlByLabelWithin(container: HTMLElement, label: string): FormValueElement {
  const el = within(container).getByLabelText(label);
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) {
    throw new Error(`${label} should resolve to a value control`);
  }
  return el;
}

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

  it("keeps text mode while typing partial ISO-like text", () => {
    render(<ControlledField />);

    fireEvent.click(screen.getByRole("radio", { name: "描述" }));
    const textInput = screen.getByPlaceholderText("约 1990 年代、2024 年上旬");
    fireEvent.change(textInput, { target: { value: "2024-06" } });

    expect(screen.getByDisplayValue("2024-06")).toBeTruthy();
    expect(screen.queryByLabelText("年")).toBeNull();
  });

  it("shows split year/month fields when mode is month", () => {
    const { container } = render(<ControlledField initial="2024-06-15" />);

    fireEvent.click(within(container).getByRole("radio", { name: "年月" }));
    expect(valueControlByLabelWithin(container, "年").value).toBe("2024");
    expect(valueControlByLabelWithin(container, "月").value).toBe("06");
  });

  it("allows typing year digits before choosing month", () => {
    render(<ControlledField />);

    fireEvent.click(screen.getByRole("radio", { name: "年月" }));
    fireEvent.change(screen.getByLabelText("年"), { target: { value: "2024" } });
    expect(valueControlByLabel("年").value).toBe("2024");

    fireEvent.change(screen.getByLabelText("月"), { target: { value: "06" } });
    expect(valueControlByLabel("月").value).toBe("06");
    expect(valueControlByLabel("年").value).toBe("2024");
  });
});

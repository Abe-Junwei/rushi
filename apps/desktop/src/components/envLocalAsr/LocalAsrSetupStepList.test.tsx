import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ASR_SETUP_INITIAL_STEPS } from "../../services/asr/asrSetupContract";
import { LocalAsrSetupStepList } from "./LocalAsrSetupStepList";

describe("LocalAsrSetupStepList", () => {
  it("renders a compact vertical stepper with all step labels", () => {
    render(<LocalAsrSetupStepList steps={ASR_SETUP_INITIAL_STEPS} />);

    expect(screen.getByRole("list", { name: "准备步骤" })).toBeTruthy();
    for (const step of ASR_SETUP_INITIAL_STEPS) {
      expect(screen.getByText(step.label)).toBeTruthy();
    }
  });

  it("shows step detail when provided", () => {
    render(
      <LocalAsrSetupStepList
        steps={[{ id: "health", label: "检测 ASR 能力", status: "running", detail: "等待 /health…" }]}
      />,
    );

    expect(screen.getByText("等待 /health…")).toBeTruthy();
  });
});

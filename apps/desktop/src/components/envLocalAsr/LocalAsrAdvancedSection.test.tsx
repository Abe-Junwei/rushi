import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocalAsrAdvancedSection } from "./LocalAsrAdvancedSection";

vi.mock("../../pages/useProjectController", () => ({
  funasrManualSetupCommands: () => 'pip install -e ".[funasr]"',
}));

describe("LocalAsrAdvancedSection", () => {
  it("keeps pip actions inside the collapsed advanced section", () => {
    render(
      <LocalAsrAdvancedSection
        asrHealth="ok"
        asrCaps={null}
        funasrInstallMessage=""
        busy={false}
        installFunasrDepsInteractive={vi.fn(async () => {})}
        copyFunasrManualCommands={vi.fn(async () => {})}
      />,
    );

    const summary = screen.getByText("高级诊断");
    const details = summary.closest("details");
    expect(details?.open).toBe(false);

    fireEvent.click(summary);

    expect(details?.open).toBe(true);
    expect(screen.getByRole("button", { name: "安装 FunASR 依赖（pip）" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制手动命令" })).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PanelAsyncProgress } from "./PanelAsyncProgress";

describe("PanelAsyncProgress", () => {
  it("renders spinner message", () => {
    render(<PanelAsyncProgress mode="spinner" message="正在加载…" />);
    expect(screen.getByText("正在加载…")).toBeTruthy();
  });

  it("renders determinate progress labels", () => {
    render(
      <PanelAsyncProgress
        mode="determinate"
        title="处理中"
        stepDetail="批次 2 / 10"
        providerLabel="Ollama（本机）"
        done={2}
        total={10}
        percent={20}
      />,
    );
    expect(screen.getByText("处理中")).toBeTruthy();
    expect(screen.getByText("Ollama（本机） · 批次 2 / 10")).toBeTruthy();
    expect(screen.queryByText(/当前步骤/)).toBeNull();
    expect(screen.queryByText(/20%/)).toBeNull();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
});

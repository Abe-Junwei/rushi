import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useLlmEnvStatus", () => ({
  useLlmEnvStatus: () => ({
    presentation: {
      sourceLabel: "DeepSeek · deepseek-chat",
      tone: "ready",
      chipLabel: "云端 LLM 已就绪",
      ok: true,
      blockReason: null,
    },
  }),
}));

vi.mock("../services/exportDocxPolish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/exportDocxPolish")>();
  return {
    ...actual,
    resolveExportPolishBlockReason: () => null,
  };
});

vi.mock("../services/exportPolishDelivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/exportPolishDelivery")>();
  return {
    ...actual,
    assessExportPolishReadiness: () => ({ canExport: true, blockReason: null }),
  };
});

import { DeliveryExportDialog } from "./DeliveryExportDialog";

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
});

afterEach(() => cleanup());

const segments = [
  {
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text: "原始语段",
    low_confidence: false,
  },
];

describe("DeliveryExportDialog", () => {
  it("shows the three product modes in fidelity-first order without an in-app review step", () => {
    render(
      <DeliveryExportDialog
        open
        busy={false}
        segments={segments}
        projectName="测试项目"
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    const labels = screen.getAllByRole("radio").map((radio) => radio.parentElement?.textContent);
    expect(labels).toEqual([
      expect.stringContaining("逐字稿"),
      expect.stringContaining("LLM 保真整理"),
      expect.stringContaining("讲稿优化"),
    ]);
    expect(screen.queryByText(/预览|逐语段勾选/)).toBeNull();
    expect(screen.queryByText(/大模型润色（可选）/)).toBeNull();
  });

  it("exports lecture optimization directly with LLM processing enabled", () => {
    const onExport = vi.fn();
    render(
      <DeliveryExportDialog
        open
        busy={false}
        segments={segments}
        projectName="测试项目"
        onClose={vi.fn()}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getAllByRole("radio")[2]);
    expect(screen.getByText("讲稿优化修订")).toBeTruthy();
    expect(screen.getByText(/拒绝全部可恢复完整原稿/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "导出 DOCX…" }));

    expect(onExport).toHaveBeenCalledWith("lecture", false, false, true, false);
  });
});

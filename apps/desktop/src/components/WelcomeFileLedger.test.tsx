import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import { WelcomeFileLedger } from "./WelcomeFileLedger";

const sample: RecentWorkspaceFile = {
  projectId: "p1",
  fileId: "f1",
  name: "开示录音",
  fileType: "paired",
  updatedAtMs: 1,
  summary: {
    id: "f1",
    name: "开示录音",
    file_type: "paired",
    updated_at_ms: 1,
    duration_sec: 125,
    segment_count: 0,
    draft_count: 0,
    first_proof_count: 0,
    finalized_count: 0,
  },
};

describe("WelcomeFileLedger", () => {
  it("shows ledger tabs and left-right row without list bullets", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <WelcomeFileLedger files={[sample]} loading={false} onOpenFile={onOpen} />,
    );
    expect(screen.getByRole("tab", { name: "最近文件" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "所有文件" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("tab", { name: "星标" })).toHaveProperty("disabled", true);
    expect(screen.getByText("开示录音")).toBeTruthy();
    expect(screen.getByText("未转录")).toBeTruthy();
    expect(container.querySelector("ul")?.className).toMatch(/list-none/);
    const tablist = screen.getByRole("tablist");
    expect(tablist.className).toMatch(/gap-8/);
  });
});

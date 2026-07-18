import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FileSummary } from "../tauri/projectTypes";
import { HubFileStageMeter } from "./HubFileStageMeter";

const emptyFile: FileSummary = {
  id: "f1",
  name: "采访",
  file_type: "paired",
  updated_at_ms: 1,
  duration_sec: 60,
  segment_count: 0,
  draft_count: 0,
  first_proof_count: 0,
  finalized_count: 0,
};

const stagedFile: FileSummary = {
  ...emptyFile,
  segment_count: 10,
  draft_count: 5,
  first_proof_count: 2,
  finalized_count: 3,
};

describe("HubFileStageMeter", () => {
  it("default empty: track then 未转录", () => {
    const { container } = render(<HubFileStageMeter file={emptyFile} />);
    expect(screen.getByText("未转录")).toBeTruthy();
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/未转录/);
  });

  it("ledger empty: 未转录 above pale track", () => {
    const { container } = render(<HubFileStageMeter file={emptyFile} variant="ledger" />);
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    const children = Array.from(status!.children);
    expect(children[0]?.textContent).toBe("未转录");
    expect(children[1]?.className).toMatch(/h-0\.5/);
  });

  it("ledger staged: legend above thin track", () => {
    const { container } = render(<HubFileStageMeter file={stagedFile} variant="ledger" />);
    const img = container.querySelector('[role="img"]');
    expect(img).not.toBeNull();
    const children = Array.from(img!.children);
    expect(children[0]?.textContent).toBe("生稿 5 · 一校 2 · 定稿 3");
    expect(children[1]?.className).toMatch(/h-0\.5/);
  });
});

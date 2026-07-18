import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import { WelcomeFileLedger } from "./WelcomeFileLedger";
import type { WelcomeSearchController } from "./WelcomeSearchField";

afterEach(() => {
  cleanup();
});

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

function mockSearch(): WelcomeSearchController {
  return {
    scope: "all",
    setScope: vi.fn(),
    cycleScope: vi.fn(),
    query: "",
    setQuery: vi.fn(),
    debouncedQuery: "",
    queryEmpty: true,
    open: false,
    setOpen: vi.fn(),
    loading: false,
    error: null,
    fileResults: [],
    contentResults: [],
    recentQueries: [],
    navItems: [],
    activeIndex: -1,
    setActiveIndex: vi.fn(),
    showPanel: false,
    searchRootRef: { current: null },
    closeSearch: vi.fn(),
    handleInputKeyDown: vi.fn(),
    navigateToFileHub: vi.fn(),
    openFileFromSearch: vi.fn(),
    navigateToContentHit: vi.fn(),
    activateNavItem: vi.fn(),
  } as WelcomeSearchController;
}

describe("WelcomeFileLedger", () => {
  it("shows two tabs, search on the right, without count or starred", () => {
    const onOpen = vi.fn();
    const onTabChange = vi.fn();
    const { container } = render(
      <WelcomeFileLedger
        activeTab="recent"
        onTabChange={onTabChange}
        files={[sample]}
        loading={false}
        onOpenFile={onOpen}
        search={mockSearch()}
        allFilesContent={<div>库内容</div>}
      />,
    );
    expect(screen.getByRole("tab", { name: "最近" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "所有" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByRole("tab", { name: "星标" })).toBeNull();
    expect(screen.getByRole("searchbox", { name: "搜索文件与转写内容" })).toBeTruthy();
    expect(screen.queryByText(/个文件/)).toBeNull();
    expect(screen.queryByText(/个项目/)).toBeNull();
    expect(screen.getByText("开示录音")).toBeTruthy();
    expect(screen.getByText("未转录")).toBeTruthy();
    expect(container.querySelector("ul")?.className).toMatch(/list-none/);
    expect(container.querySelector("[data-purpose='welcome-ledger-viewport']")).toBeTruthy();
    const tablist = screen.getByRole("tablist");
    expect(tablist.className).toMatch(/gap-6/);
  });

  it("switches to all files and shows project library content", () => {
    const onTabChange = vi.fn();
    render(
      <WelcomeFileLedger
        activeTab="all"
        onTabChange={onTabChange}
        files={[sample]}
        loading={false}
        onOpenFile={vi.fn()}
        search={mockSearch()}
        allFilesContent={<div>项目库面板</div>}
      />,
    );
    expect(screen.getByRole("tab", { name: "所有" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("项目库面板")).toBeTruthy();
    expect(screen.queryByText("开示录音")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "最近" }));
    expect(onTabChange).toHaveBeenCalledWith("recent");
  });
});

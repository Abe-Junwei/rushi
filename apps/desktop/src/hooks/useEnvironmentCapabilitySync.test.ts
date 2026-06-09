import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("../services/environmentCapabilityCoordinator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/environmentCapabilityCoordinator")>();
  return {
    ...actual,
    runEnvironmentCapabilityRefresh: vi.fn(actual.runEnvironmentCapabilityRefresh),
  };
});

import { runEnvironmentCapabilityRefresh } from "../services/environmentCapabilityCoordinator";
import { useEnvironmentCapabilitySync } from "./useEnvironmentCapabilitySync";

describe("useEnvironmentCapabilitySync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(runEnvironmentCapabilityRefresh).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs app-init once and debounces project-open refresh", async () => {
    const refreshAsrHealth = vi.fn(async () => undefined);

    const { rerender } = renderHook(
      (projectId: string | null) =>
        useEnvironmentCapabilitySync({
          projectId,
          refreshAsrHealth,
        }),
      { initialProps: null as string | null },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(runEnvironmentCapabilityRefresh).toHaveBeenCalledWith(
      "app-init",
      expect.any(Object),
      { touchUi: true },
    );

    await act(async () => {
      rerender("proj-a");
    });
    expect(runEnvironmentCapabilityRefresh).not.toHaveBeenCalledWith(
      "project-open",
      expect.any(Object),
      expect.anything(),
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(runEnvironmentCapabilityRefresh).toHaveBeenCalledWith("project-open", expect.any(Object));
  });

  it("skips repeat project-open refresh for the same project id", async () => {
    const refreshAsrHealth = vi.fn(async () => undefined);

    const { rerender } = renderHook(
      (projectId: string | null) =>
        useEnvironmentCapabilitySync({
          projectId,
          refreshAsrHealth,
        }),
      { initialProps: "proj-a" as string | null },
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    vi.mocked(runEnvironmentCapabilityRefresh).mockClear();

    await act(async () => {
      rerender("proj-a");
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(runEnvironmentCapabilityRefresh).not.toHaveBeenCalledWith(
      "project-open",
      expect.any(Object),
    );
  });

  it("runs project-open again after closing and reopening the same project", async () => {
    const refreshAsrHealth = vi.fn(async () => undefined);

    const { rerender } = renderHook(
      (projectId: string | null) =>
        useEnvironmentCapabilitySync({
          projectId,
          refreshAsrHealth,
        }),
      { initialProps: "proj-a" as string | null },
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    vi.mocked(runEnvironmentCapabilityRefresh).mockClear();

    await act(async () => {
      rerender(null);
      await Promise.resolve();
    });

    await act(async () => {
      rerender("proj-a");
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(runEnvironmentCapabilityRefresh).toHaveBeenCalledWith("project-open", expect.any(Object));
  });
});

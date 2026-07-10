// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  WaveformSelectionChromeViewProvider,
  useWaveformSelectionChromeViewContext,
} from "./WaveformSelectionChromeViewContext";
import { commitSelectionChrome, resetSelectionChromeStoreForTests } from "../services/selection/selectionChromeStore";

function ReadView() {
  const { view, filterExcludesPrimary, listVisibleIndexSet } = useWaveformSelectionChromeViewContext();
  return (
    <div>
      <div data-testid="primary">{view.selectedIdx}</div>
      <div data-testid="excludes">{String(filterExcludesPrimary)}</div>
      <div data-testid="visible">{listVisibleIndexSet ? [...listVisibleIndexSet].join(",") : "all"}</div>
    </div>
  );
}

describe("WaveformSelectionChromeViewProvider", () => {
  afterEach(() => {
    cleanup();
    resetSelectionChromeStoreForTests();
  });

  it("shares one resolved view with consumers", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 2,
      selectedSet: new Set([2]),
    });
    render(
      <WaveformSelectionChromeViewProvider
        input={{
          fileId: "f1",
          selectedIdx: 0,
          segmentCount: 5,
        }}
        filterActive={false}
        filteredIndices={[0, 1, 2, 3, 4]}
      >
        <ReadView />
      </WaveformSelectionChromeViewProvider>,
    );
    expect(screen.getByTestId("primary").textContent).toBe("2");
    expect(screen.getByTestId("visible").textContent).toBe("all");
  });

  it("keeps primary chrome when filter excludes it and exposes listVisibleIndexSet", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 4,
      selectedSet: new Set([4]),
    });
    render(
      <WaveformSelectionChromeViewProvider
        input={{
          fileId: "f1",
          selectedIdx: 4,
          segmentCount: 5,
        }}
        filterActive={true}
        filteredIndices={[0, 1]}
      >
        <ReadView />
      </WaveformSelectionChromeViewProvider>,
    );
    expect(screen.getByTestId("primary").textContent).toBe("4");
    expect(screen.getByTestId("excludes").textContent).toBe("true");
    expect(screen.getByTestId("visible").textContent).toBe("0,1");
  });
});

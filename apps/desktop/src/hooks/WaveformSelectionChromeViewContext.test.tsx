// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WaveformSelectionChromeViewProvider,
  useWaveformSelectionChromeViewContext,
} from "./WaveformSelectionChromeViewContext";
import { commitSelectionChrome, resetSelectionChromeStoreForTests } from "../services/selection/selectionChromeStore";

function ReadView() {
  const { view } = useWaveformSelectionChromeViewContext();
  return <div data-testid="primary">{view.selectedIdx}</div>;
}

describe("WaveformSelectionChromeViewProvider", () => {
  it("shares one resolved view with consumers", () => {
    resetSelectionChromeStoreForTests();
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
  });
});

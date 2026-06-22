// @vitest-environment jsdom

/**
 * Root-cause probe: why waveformKeyboard listChrome ~100ms vs listKeyboard ~1ms on same machine.
 * Run: npm run test:perf -w @rushi/desktop -- waveformKeyboardLatencyRootCause
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { clearAllCspScopeRulesForTests } from "../utils/cspNonceStyleRegistry";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { applySelectionChromeImperative } from "../services/selection/applySelectionChromeImperative";
import { resetSelectionChromeStoreForTests } from "../services/selection/selectionChromeStore";
import { publishSelectionChrome } from "../services/selection/publishSelectionChrome";
import { computeSelectionProfileSyncPathMs } from "../services/ui/selectionLatencyProfile";

function bench(fn: () => void, iterations: number): { avgMs: number; maxMs: number } {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return {
    avgMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    maxMs: Math.max(...samples),
  };
}

function seedOverlay(root: HTMLElement, count: number): void {
  root.replaceChildren();
  for (let idx = 0; idx < count; idx += 1) {
    const el = document.createElement("div");
    el.setAttribute("data-segment-idx", String(idx));
    el.className = "waveform-segment-region";
    root.appendChild(el);
  }
}

function seedListRows(root: HTMLElement, count: number): void {
  root.replaceChildren();
  for (let idx = 0; idx < count; idx += 1) {
    const el = document.createElement("div");
    el.setAttribute("data-seg-row", String(idx));
    el.className = "seg-row-shell";
    root.appendChild(el);
  }
}

describe("waveformKeyboard latency root cause probe", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    clearAllCspScopeRulesForTests();
    resetSelectionChromeStoreForTests();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearAllCspScopeRulesForTests();
  });

  it("reports overlay CSP layout vs list classList cost (60 segments, step prev→next)", () => {
    const segmentCount = 60;
    const segments = Array.from({ length: segmentCount }, (_, idx) => ({
      uid: `s${idx}`,
      idx,
      start_sec: idx * 2,
      end_sec: idx * 2 + 1.5,
      text: `seg ${idx}`,
    }));

    const overlayRoot = document.createElement("div");
    overlayRoot.className = "waveform-timeline-overlay-layer";
    const listRoot = document.createElement("div");
    document.body.append(overlayRoot, listRoot);
    seedOverlay(overlayRoot, segmentCount);
    seedListRows(listRoot, segmentCount);

    const overlayOnly = bench(() => {
      for (let idx = 1; idx < segmentCount; idx += 1) {
        applySelectionChromeImperative({
          overlayRoot,
          listRoot: null,
          segments,
          prevSnapshot: {
            primaryIdx: idx - 1,
            selectedSet: new Set([idx - 1]),
            version: idx,
            fileId: "f1",
          },
          nextSnapshot: {
            primaryIdx: idx,
            selectedSet: new Set([idx]),
            version: idx + 1,
            fileId: "f1",
          },
        });
      }
    }, 5);

    const listOnly = bench(() => {
      for (let idx = 1; idx < segmentCount; idx += 1) {
        applySelectionChromeImperative({
          overlayRoot: null,
          listRoot,
          segments,
          prevSnapshot: {
            primaryIdx: idx - 1,
            selectedSet: new Set([idx - 1]),
            version: idx,
            fileId: "f1",
          },
          nextSnapshot: {
            primaryIdx: idx,
            selectedSet: new Set([idx]),
            version: idx + 1,
            fileId: "f1",
          },
        });
      }
    }, 5);

    const perStepOverlay = overlayOnly.avgMs / (segmentCount - 1);
    const perStepList = listOnly.avgMs / (segmentCount - 1);

    // eslint-disable-next-line no-console -- perf probe output
    console.info(
      `[root-cause-probe] per-step overlay-only=${perStepOverlay.toFixed(2)}ms list-only=${perStepList.toFixed(2)}ms`,
    );

    expect(perStepOverlay).toBeGreaterThan(perStepList * 3);
  });

  it("isolates setCspLayoutRules vs classList.toggle on two elements", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);

    const csp = bench(() => {
      setCspLayoutRules(a, { background: "color-mix(in srgb, var(--zen-saffron-500) 40%, transparent)" });
      setCspLayoutRules(b, { background: "color-mix(in srgb, var(--zen-neutral-200) 60%, transparent)" });
    }, 200);

    const classToggle = bench(() => {
      a.classList.toggle("waveform-segment-region-selected", true);
      b.classList.toggle("waveform-segment-region-selected", false);
    }, 200);

    // eslint-disable-next-line no-console -- perf probe output
    console.info(
      `[root-cause-probe] setCspLayoutRules pair avg=${csp.avgMs.toFixed(3)}ms classList pair avg=${classToggle.avgMs.toFixed(3)}ms`,
    );

    expect(csp.avgMs).toBeGreaterThan(classToggle.avgMs * 5);
  });

  it("counts head style tags after overlay chrome steps (CSP scope churn)", () => {
    const overlayRoot = document.createElement("div");
    document.body.appendChild(overlayRoot);
    seedOverlay(overlayRoot, 60);
    const segments = Array.from({ length: 60 }, (_, idx) => ({
      uid: `s${idx}`,
      idx,
      start_sec: idx,
      end_sec: idx + 1,
      text: "",
    }));

    for (let idx = 1; idx < 20; idx += 1) {
      publishSelectionChrome({
        fileId: "f1",
        segments,
        primaryIdx: idx,
        selectedSet: new Set([idx]),
        listRoot: null,
        overlayRoot,
        skipBandPaint: true,
        skipListRows: true,
      });
    }

    const styleTags = document.head.querySelectorAll('style[id^="rushi-csp-scope-layout-"]').length;
    // eslint-disable-next-line no-console -- perf probe output
    console.info(`[root-cause-probe] style tags in head after 19 overlay steps: ${styleTags}`);
    expect(styleTags).toBeGreaterThan(10);
  });

  it("profile syncPathTotal avoids nested listChrome inside flushSelectedIdx", () => {
    const syncPathTotal = computeSelectionProfileSyncPathMs({
      flushSelectedIdx: 119,
      firstPaint: 100,
      listChrome: 100,
      seek: 1,
      focus: 2,
    });
    expect(syncPathTotal).toBe(122);
    expect(syncPathTotal).toBeLessThan(150);
  });
});

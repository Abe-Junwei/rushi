import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PROJECT_LIBRARY_FILE_DRAG_THRESHOLD_PX,
  PROJECT_LIBRARY_PROJECT_ID_ATTR,
  useProjectLibraryFileDrag,
} from "./useProjectLibraryFileDrag";

function dispatchPointer(type: "pointermove" | "pointerup", x: number, y: number) {
  window.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }),
  );
}

function stubElementFromPoint(el: Element | null) {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => el,
  });
}

describe("useProjectLibraryFileDrag", () => {
  it("moves file when pointer crosses threshold and releases on another project", () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useProjectLibraryFileDrag({ busy: false, onMove }),
    );

    const target = document.createElement("div");
    target.setAttribute(PROJECT_LIBRARY_PROJECT_ID_ATTR, "dest-p");
    document.body.appendChild(target);
    stubElementFromPoint(target);

    const start = {
      button: 0,
      clientX: 10,
      clientY: 10,
    } as unknown as React.PointerEvent;

    act(() => {
      result.current.beginFilePointerDrag(start, {
        fileId: "f1",
        projectId: "src-p",
        fileName: "a.wav",
      });
    });

    act(() => {
      dispatchPointer("pointermove", 10 + PROJECT_LIBRARY_FILE_DRAG_THRESHOLD_PX + 1, 10);
    });
    expect(result.current.dragging?.fileId).toBe("f1");
    expect(result.current.dropTargetId).toBe("dest-p");

    act(() => {
      dispatchPointer("pointerup", 40, 20);
    });

    expect(onMove).toHaveBeenCalledWith({
      fileId: "f1",
      sourceProjectId: "src-p",
      destProjectId: "dest-p",
    });
    expect(result.current.dragging).toBeNull();
    expect(result.current.consumeOpenClickSuppression()).toBe(true);

    target.remove();
  });

  it("does not move when released without crossing threshold", () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useProjectLibraryFileDrag({ busy: false, onMove }),
    );

    const start = {
      button: 0,
      clientX: 10,
      clientY: 10,
    } as unknown as React.PointerEvent;

    act(() => {
      result.current.beginFilePointerDrag(start, {
        fileId: "f1",
        projectId: "src-p",
        fileName: "a.wav",
      });
    });

    act(() => {
      dispatchPointer("pointermove", 12, 10);
      dispatchPointer("pointerup", 12, 10);
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(result.current.consumeOpenClickSuppression()).toBe(false);
  });

  it("does not move onto the source project", () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useProjectLibraryFileDrag({ busy: false, onMove }),
    );

    const target = document.createElement("div");
    target.setAttribute(PROJECT_LIBRARY_PROJECT_ID_ATTR, "src-p");
    document.body.appendChild(target);
    stubElementFromPoint(target);

    const start = {
      button: 0,
      clientX: 0,
      clientY: 0,
    } as unknown as React.PointerEvent;

    act(() => {
      result.current.beginFilePointerDrag(start, {
        fileId: "f1",
        projectId: "src-p",
        fileName: "a.wav",
      });
      dispatchPointer("pointermove", PROJECT_LIBRARY_FILE_DRAG_THRESHOLD_PX + 2, 0);
      dispatchPointer("pointerup", 20, 0);
    });

    expect(onMove).not.toHaveBeenCalled();
    target.remove();
  });
});

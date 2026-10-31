import { useEffect, useRef, useState } from "react";
import { CONTROL_BTN_ICON_GHOST } from "../config/controlStyles";
import {
  WELCOME_LEDGER_SORT_OPTIONS,
  type WelcomeLedgerSortMode,
} from "../utils/welcomeLedgerSort";
import { workbenchDropdownItemActiveClass } from "./editor/editorSegmentToolbarStyles";

type Props = {
  value: WelcomeLedgerSortMode;
  onChange: (mode: WelcomeLedgerSortMode) => void;
  disabled?: boolean;
};

/** 三横线（上长下短）排序入口。 */
function SortLinesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.5 4h11M2.5 8h7.5M2.5 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WelcomeLedgerSortMenu({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={CONTROL_BTN_ICON_GHOST}
        disabled={disabled}
        aria-label="排序"
        aria-haspopup="menu"
        aria-expanded={open}
        title="排序"
        data-purpose="welcome-ledger-sort"
        onClick={() => setOpen((v) => !v)}
      >
        <SortLinesIcon />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="排序方式"
          className="dropdown-surface absolute right-0 top-full z-[40] mt-1 min-w-[8.5rem] py-1"
        >
          {WELCOME_LEDGER_SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === opt.value}
              className={workbenchDropdownItemActiveClass(value === opt.value)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

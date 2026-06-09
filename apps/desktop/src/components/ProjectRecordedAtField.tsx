import { useEffect, useState } from "react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import {
  detectRecordedAtMode,
  recordedAtValueForMode,
  type RecordedAtInputMode,
} from "../utils/projectRecordedAt";

const MODE_TOGGLE_TRACK =
  "inline-flex shrink-0 gap-0 rounded-md bg-secondary-container p-0.5";

const modeToggleBtnClass = (selected: boolean) =>
  [
    "rounded-[5px] border-0 px-2.5 py-0.5 text-center font-sans text-xs font-medium leading-none whitespace-nowrap shadow-none ring-0 transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "bg-notion-bg text-zen-saffron-mid shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      : "bg-transparent text-notion-text-variant hover:text-notion-text",
  ].join(" ");

const INPUT_CLASS = `w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 ${PANEL_CONTROL_TYPOGRAPHY.compactInput} shadow-none outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`;

const MODE_HINT: Record<RecordedAtInputMode, string> = {
  month: "精确到年月，适合多数口述史场次（与 OHMS / 档案系统常见做法一致）。",
  date: "精确到日；若只知月份，请改选「年月」。",
  text: "描述性时间，如「约 1990 年代」「2024 年上旬」。",
};

type ProjectRecordedAtFieldProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** 场次时间：年月 / 日期 / 自由描述三态（存储仍为单字段 recorded_at）。 */
export function ProjectRecordedAtField({ value, disabled, onChange }: ProjectRecordedAtFieldProps) {
  const [mode, setMode] = useState<RecordedAtInputMode>(() => detectRecordedAtMode(value));

  useEffect(() => {
    setMode(detectRecordedAtMode(value));
  }, [value]);

  const setModeAndValue = (nextMode: RecordedAtInputMode) => {
    setMode(nextMode);
    onChange(recordedAtValueForMode(value, nextMode));
  };

  return (
    <div className="block">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>时间</span>
        <div className={MODE_TOGGLE_TRACK} role="radiogroup" aria-label="时间输入方式">
          {(
            [
              ["month", "年月"],
              ["date", "日期"],
              ["text", "描述"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              className={modeToggleBtnClass(mode === id)}
              aria-checked={mode === id}
              disabled={disabled}
              onClick={() => setModeAndValue(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "month" ? (
        <input
          type="month"
          className={INPUT_CLASS}
          value={/^\d{4}-\d{2}$/.test(value.trim()) ? value.trim() : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {mode === "date" ? (
        <input
          type="date"
          className={INPUT_CLASS}
          value={/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {mode === "text" ? (
        <input
          type="text"
          className={INPUT_CLASS}
          placeholder="约 1990 年代、2024 年上旬"
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}

      <p className={`mt-1.5 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>{MODE_HINT[mode]}</p>
    </div>
  );
}

import { useState } from "react";
import {
  CONTROL_SELECT,
  CONTROL_TEXT_INPUT,
  envSegmentedToggleBtnClass,
  envSegmentedToggleTrackClass,
} from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import {
  detectRecordedAtMode,
  formatRecordedAtDate,
  formatRecordedAtMonth,
  parseRecordedAtDateParts,
  parseRecordedAtMonthParts,
  recordedAtValueForMode,
  type RecordedAtInputMode,
} from "../utils/projectRecordedAt";

const fieldInput = `${CONTROL_TEXT_INPUT} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;
const fieldSelect = `${CONTROL_SELECT} min-w-0 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const mm = String(i + 1).padStart(2, "0");
  return { value: mm, label: `${i + 1} 月` };
});

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const dd = String(i + 1).padStart(2, "0");
  return { value: dd, label: `${i + 1} 日` };
});

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

/**
 * 场次时间：年月 / 日期 / 自由描述三态。
 * 年月与日期使用 text+select 分字段（Tauri WKWebView 对 type=month/date 键盘输入不可靠）。
 */
export function ProjectRecordedAtField({ value, disabled, onChange }: ProjectRecordedAtFieldProps) {
  const [mode, setMode] = useState<RecordedAtInputMode>(() => detectRecordedAtMode(value));

  const setModeAndValue = (nextMode: RecordedAtInputMode) => {
    setMode(nextMode);
    onChange(recordedAtValueForMode(value, nextMode));
  };

  const monthParts = parseRecordedAtMonthParts(value);
  const dateParts = parseRecordedAtDateParts(value);

  return (
    <div className="block">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>时间</span>
        <div className={envSegmentedToggleTrackClass(true)} role="radiogroup" aria-label="时间输入方式">
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
              className={envSegmentedToggleBtnClass(mode === id, true)}
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
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            className={`${fieldInput} w-[5.5rem] shrink-0 tabular-nums`}
            placeholder="2024"
            aria-label="年"
            value={monthParts.year}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) =>
              onChange(formatRecordedAtMonth(e.target.value, monthParts.month))
            }
          />
          <select
            className={`${fieldSelect} flex-1`}
            aria-label="月"
            value={monthParts.month}
            disabled={disabled}
            onChange={(e) =>
              onChange(formatRecordedAtMonth(monthParts.year, e.target.value))
            }
          >
            <option value="">选择月份</option>
            {MONTH_OPTIONS.map(({ value: mm, label }) => (
              <option key={mm} value={mm}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {mode === "date" ? (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            className={`${fieldInput} w-[5.5rem] shrink-0 tabular-nums`}
            placeholder="2024"
            aria-label="年"
            value={dateParts.year}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) =>
              onChange(
                formatRecordedAtDate(e.target.value, dateParts.month, dateParts.day),
              )
            }
          />
          <select
            className={`${fieldSelect} flex-1`}
            aria-label="月"
            value={dateParts.month}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                formatRecordedAtDate(dateParts.year, e.target.value, dateParts.day),
              )
            }
          >
            <option value="">月</option>
            {MONTH_OPTIONS.map(({ value: mm, label }) => (
              <option key={mm} value={mm}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={`${fieldSelect} flex-1`}
            aria-label="日"
            value={dateParts.day}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                formatRecordedAtDate(dateParts.year, dateParts.month, e.target.value),
              )
            }
          >
            <option value="">日</option>
            {DAY_OPTIONS.map(({ value: dd, label }) => (
              <option key={dd} value={dd}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {mode === "text" ? (
        <input
          type="text"
          className={`${fieldInput} w-full`}
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

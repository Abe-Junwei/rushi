import { CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { normalizeRecordedAtInput, RECORDED_AT_PLACEHOLDER } from "../utils/projectRecordedAt";

const fieldInput = `${CONTROL_TEXT_INPUT} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;

type ProjectRecordedAtFieldProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** 场次时间：单一自由文本；placeholder 示例 + blur 自动规范化。 */
export function ProjectRecordedAtField({ value, disabled, onChange }: ProjectRecordedAtFieldProps) {
  return (
    <label className="block">
      <span className={`mb-1.5 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>时间</span>
      <input
        type="text"
        className={`${fieldInput} w-full`}
        placeholder={RECORDED_AT_PLACEHOLDER}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const next = normalizeRecordedAtInput(value);
          if (next !== value) onChange(next);
        }}
      />
    </label>
  );
}

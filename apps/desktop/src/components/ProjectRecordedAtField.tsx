import { CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { RECORDED_AT_FORMAT_HINT, RECORDED_AT_PLACEHOLDER } from "../utils/projectRecordedAt";

const fieldInput = `${CONTROL_TEXT_INPUT} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`;

type ProjectRecordedAtFieldProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** 场次时间：单一自由文本，placeholder 提供建议格式。 */
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
      />
      <p className={`mt-1.5 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
        {RECORDED_AT_FORMAT_HINT}
      </p>
    </label>
  );
}

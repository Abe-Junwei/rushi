import { CONTROL_SELECT_INLINE } from "../../config/controlStyles";
import type { GlossaryListSortMode } from "../../services/glossaryListSort";

type Props = {
  value: GlossaryListSortMode;
  disabled?: boolean;
  onChange: (mode: GlossaryListSortMode) => void;
};

export function GlossarySortSelect({ value, disabled, onChange }: Props) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="排序"
      className={CONTROL_SELECT_INLINE}
      onChange={(e) => onChange(e.target.value as GlossaryListSortMode)}
    >
      <option value="updated">更新时间</option>
      <option value="pinyin-asc">拼音 A→Z</option>
      <option value="pinyin-desc">拼音 Z→A</option>
    </select>
  );
}

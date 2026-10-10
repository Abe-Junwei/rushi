import {
  IconRotate as RotateCcw,
} from "@tabler/icons-react";
import {
  formatSegmentListFilterTriggerLabel,
  SEGMENT_TEXT_STAGES,
  segmentListFilterAnnotationLabel,
  segmentListFilterFrozenLabel,
  type SegmentAnnotationFilter,
  type SegmentFrozenFilter,
  type SegmentListFilterState,
  type SegmentSpeakerFilter,
} from "../../services/segmentListFilter";
import {
  resolveSegmentStageLabels,
  type SegmentTextStage,
} from "../../services/segmentTextStage";
import { resolveSpeakerLabel } from "../../services/speakerLabels";
import type { FileSpeakerDto } from "../../tauri/projectTypes";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { WorkbenchOverflowMenu } from "./WorkbenchOverflowMenu";
import { SegmentStageIcon } from "../segmentRow/segmentStageIcon";

type Props = {
  filter: SegmentListFilterState;
  filteredCount: number;
  totalCount: number;
  busy?: boolean;
  isActive: boolean;
  speakers?: readonly FileSpeakerDto[];
  onToggleStage: (stage: SegmentTextStage) => void;
  onAnnotationChange: (value: SegmentAnnotationFilter) => void;
  onFrozenChange: (value: SegmentFrozenFilter) => void;
  onSpeakerChange?: (value: SegmentSpeakerFilter) => void;
  onReset: () => void;
};

const ANNOTATION_OPTIONS: SegmentAnnotationFilter[] = ["all", "with", "without"];
const FROZEN_OPTIONS: SegmentFrozenFilter[] = ["all", "frozen", "unfrozen"];

function stageOptionClass(selected: boolean): string {
  return ["segment-filter-menu-option", selected ? "segment-filter-menu-option--on" : ""]
    .filter(Boolean)
    .join(" ");
}

function FilterRadioSection<T extends string>(props: {
  headId: string;
  title: string;
  hint: string;
  name: string;
  options: readonly T[];
  value: T;
  busy: boolean;
  labelFor: (value: T) => string;
  onChange: (value: T) => void;
  listClassName?: string;
}) {
  return (
    <section className="segment-filter-menu-section" aria-labelledby={props.headId}>
      <header id={props.headId} className="segment-filter-menu-section-head">
        <span>{props.title}</span>
        <span className="segment-filter-menu-section-hint">{props.hint}</span>
      </header>
      <ul className={["segment-filter-menu-list", props.listClassName].filter(Boolean).join(" ")}>
        {props.options.map((option) => {
          const selected = props.value === option;
          return (
            <li key={option}>
              <label className={stageOptionClass(selected)}>
                <input
                  type="radio"
                  name={props.name}
                  className="segment-filter-menu-control"
                  checked={selected}
                  disabled={props.busy}
                  onChange={() => props.onChange(option)}
                />
                <span className="segment-filter-menu-option-label">{props.labelFor(option)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function EditorSegmentListFilterMenu({
  filter,
  filteredCount,
  totalCount,
  busy = false,
  isActive,
  speakers = [],
  onToggleStage,
  onAnnotationChange,
  onFrozenChange,
  onSpeakerChange,
  onReset,
}: Props) {
  if (totalCount === 0) return null;

  const triggerLabel = formatSegmentListFilterTriggerLabel(filter, {
    filteredCount,
    totalCount,
    speakerName: resolveSpeakerLabel(
      filter.speaker === "all" || filter.speaker === "unassigned" ? null : filter.speaker,
      speakers,
    ),
  });

  const enabledStageCount = SEGMENT_TEXT_STAGES.filter((stage) => filter.stages[stage]).length;
  const speakerOptions: SegmentSpeakerFilter[] = [
    "all",
    ...speakers.map((speaker) => speaker.speaker_id),
    "unassigned",
  ];
  const showSpeakerFilter = speakers.length > 0 && onSpeakerChange != null;

  return (
    <WorkbenchOverflowMenu
      label={triggerLabel}
      ariaLabel="语段列表筛选"
      engaged={isActive}
      align="end"
      panelMinWidth={showSpeakerFilter ? 188 : 172}
      className="workbench-segment-filter-menu"
    >
      {(close) => (
        <div className="segment-filter-menu" role="group" aria-label="语段筛选选项">
          {showSpeakerFilter ? (
            <>
              <FilterRadioSection
                headId="segment-filter-speaker-head"
                title="说话人"
                hint="单选"
                name="segment-list-speaker-filter"
                options={speakerOptions}
                value={filter.speaker}
                busy={busy}
                labelFor={(value) => {
                  if (value === "all") return "全部";
                  if (value === "unassigned") return "未标注";
                  return resolveSpeakerLabel(value, speakers) ?? "说话人";
                }}
                onChange={(value) => onSpeakerChange?.(value)}
                listClassName={speakerOptions.length > 8 ? "segment-filter-menu-list--scroll" : undefined}
              />
              <div className="segment-filter-menu-divider" role="separator" />
            </>
          ) : null}

          <section className="segment-filter-menu-section" aria-labelledby="segment-filter-stage-head">
            <header id="segment-filter-stage-head" className="segment-filter-menu-section-head">
              <span>阶段</span>
              <span className="segment-filter-menu-section-hint">
                {enabledStageCount}/{SEGMENT_TEXT_STAGES.length}
              </span>
            </header>
            <ul className="segment-filter-menu-list">
              {SEGMENT_TEXT_STAGES.map((stage) => {
                const enabled = filter.stages[stage];
                const labels = resolveSegmentStageLabels(stage, null);
                return (
                  <li key={stage}>
                    <label className={stageOptionClass(enabled)} title={labels.tooltip}>
                      <input
                        type="checkbox"
                        className="segment-filter-menu-control"
                        checked={enabled}
                        disabled={busy}
                        onChange={() => onToggleStage(stage)}
                      />
                      <span className="segment-filter-menu-option-icon" aria-hidden>
                        <SegmentStageIcon stage={stage} />
                      </span>
                      <span className="segment-filter-menu-option-label">{labels.category}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="segment-filter-menu-divider" role="separator" />

          <FilterRadioSection
            headId="segment-filter-frozen-head"
            title="冻结"
            hint="单选"
            name="segment-list-frozen-filter"
            options={FROZEN_OPTIONS}
            value={filter.frozen}
            busy={busy}
            labelFor={segmentListFilterFrozenLabel}
            onChange={onFrozenChange}
          />

          <div className="segment-filter-menu-divider" role="separator" />

          <FilterRadioSection
            headId="segment-filter-note-head"
            title="备注"
            hint="单选"
            name="segment-list-annotation-filter"
            options={ANNOTATION_OPTIONS}
            value={filter.annotation}
            busy={busy}
            labelFor={segmentListFilterAnnotationLabel}
            onChange={onAnnotationChange}
          />

          {isActive ? (
            <footer className="segment-filter-menu-footer">
              <button
                type="button"
                className="segment-filter-menu-reset bg-transparent"
                disabled={busy}
                onClick={() => {
                  onReset();
                  close();
                }}
              >
                <RotateCcw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                重置筛选
              </button>
            </footer>
          ) : null}
        </div>
      )}
    </WorkbenchOverflowMenu>
  );
}

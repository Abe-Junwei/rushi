import { RotateCcw } from "lucide-react";
import {
  formatSegmentListFilterTriggerLabel,
  SEGMENT_TEXT_STAGES,
  segmentListFilterAnnotationLabel,
  type SegmentAnnotationFilter,
  type SegmentListFilterState,
} from "../../services/segmentListFilter";
import {
  resolveSegmentStageLabels,
  type SegmentTextStage,
} from "../../services/segmentTextStage";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { WorkbenchOverflowMenu } from "./WorkbenchOverflowMenu";
import { SegmentStageIcon } from "../segmentRow/segmentStageIcon";

type Props = {
  filter: SegmentListFilterState;
  filteredCount: number;
  totalCount: number;
  busy?: boolean;
  isActive: boolean;
  onToggleStage: (stage: SegmentTextStage) => void;
  onAnnotationChange: (value: SegmentAnnotationFilter) => void;
  onReset: () => void;
};

const ANNOTATION_OPTIONS: SegmentAnnotationFilter[] = ["all", "with", "without"];

function stageOptionClass(selected: boolean): string {
  return ["segment-filter-menu-option", selected ? "segment-filter-menu-option--on" : ""]
    .filter(Boolean)
    .join(" ");
}

export function EditorSegmentListFilterMenu({
  filter,
  filteredCount,
  totalCount,
  busy = false,
  isActive,
  onToggleStage,
  onAnnotationChange,
  onReset,
}: Props) {
  if (totalCount === 0) return null;

  const triggerLabel = formatSegmentListFilterTriggerLabel(filter, {
    filteredCount,
    totalCount,
  });

  const enabledStageCount = SEGMENT_TEXT_STAGES.filter((stage) => filter.stages[stage]).length;

  return (
    <WorkbenchOverflowMenu
      label={triggerLabel}
      ariaLabel="语段列表筛选"
      engaged={isActive}
      align="end"
      panelMinWidth={172}
      className="workbench-segment-filter-menu"
    >
      {(close) => (
        <div className="segment-filter-menu" role="group" aria-label="语段筛选选项">
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

          <section className="segment-filter-menu-section" aria-labelledby="segment-filter-note-head">
            <header id="segment-filter-note-head" className="segment-filter-menu-section-head">
              <span>备注</span>
              <span className="segment-filter-menu-section-hint">单选</span>
            </header>
            <ul className="segment-filter-menu-list">
              {ANNOTATION_OPTIONS.map((value) => {
                const selected = filter.annotation === value;
                return (
                  <li key={value}>
                    <label className={stageOptionClass(selected)}>
                      <input
                        type="radio"
                        name="segment-list-annotation-filter"
                        className="segment-filter-menu-control"
                        checked={selected}
                        disabled={busy}
                        onChange={() => onAnnotationChange(value)}
                      />
                      <span className="segment-filter-menu-option-label">
                        {segmentListFilterAnnotationLabel(value)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

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

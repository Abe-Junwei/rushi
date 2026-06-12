import { RefreshCw } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, ENV_COMPACT_BTN } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { useGlossaryMineController } from "../../pages/useGlossaryMineController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_CARD, GLOSSARY_CHECKBOX, GLOSSARY_ERROR_TEXT } from "./glossaryPanelStyles";

type MineApi = ReturnType<typeof useGlossaryMineController>;

type Props = {
  mine: MineApi;
  disabled: boolean;
};

export function GlossaryMineSection({ mine, disabled }: Props) {
  if (!mine.rows.length && !mine.loadError) {
    return null;
  }

  return (
    <section
      className={`${GLOSSARY_CARD} flex flex-col gap-3 px-4 py-4`}
      aria-labelledby="glossary-mine-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="glossary-mine-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
            推荐加入术语表
          </h2>
          <p className={`m-0 mt-1 ${PANEL_TYPOGRAPHY.meta}`}>
            来自稳定纠错记忆（命中 ≥3 或已采纳为规则），正词尚未在术语表中。采纳后正形会进入下次转写热词（错形不会写入别名）。
          </p>
        </div>
        <button
          type="button"
          className={ENV_COMPACT_BTN}
          disabled={disabled}
          onClick={() => void mine.refresh()}
          aria-label="刷新推荐列表"
        >
          <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          刷新
        </button>
      </div>

      {mine.loadError ? <p className={GLOSSARY_ERROR_TEXT}>{mine.loadError}</p> : null}

      {mine.rows.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-notion-text-muted">
              <input
                type="checkbox"
                checked={mine.allChecked}
                disabled={disabled}
                onChange={mine.toggleAll}
                className={GLOSSARY_CHECKBOX}
              />
              全选（{mine.visibleCheckedCount}/{mine.rows.length}）
            </label>
            <button
              type="button"
              className={CONTROL_BTN_PRIMARY}
              disabled={disabled || mine.visibleCheckedCount === 0}
              onClick={mine.adoptChecked}
            >
              采纳选中进术语表
            </button>
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={disabled || mine.visibleCheckedCount === 0}
              onClick={mine.dismissChecked}
            >
              忽略选中
            </button>
          </div>

          <ul className="m-0 list-none divide-y divide-notion-divider/60 p-0">
            {mine.rows.map((row) => (
              <li
                key={row.afterText}
                className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={mine.checked.has(row.afterText)}
                    disabled={disabled}
                    onChange={() => mine.toggleChecked(row.afterText)}
                    className={`mt-0.5 shrink-0 ${GLOSSARY_CHECKBOX}`}
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-notion-text">「{row.afterText}」</span>
                    <span className={`mt-0.5 block ${PANEL_TYPOGRAPHY.meta}`}>
                      命中 {row.hitCount} 次
                      {row.sampleBefore && row.sampleBefore !== row.afterText
                        ? ` · 例：${row.sampleBefore} → ${row.afterText}`
                        : ""}
                    </span>
                  </span>
                </label>
                <div className="flex shrink-0 justify-end gap-2">
                  <button
                    type="button"
                    className={ENV_COMPACT_BTN}
                    disabled={disabled}
                    onClick={() => mine.dismissOne(row)}
                  >
                    忽略
                  </button>
                  <button
                    type="button"
                    className={CONTROL_BTN_PRIMARY}
                    disabled={disabled}
                    onClick={() => mine.adoptOne(row)}
                  >
                    加入术语表
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

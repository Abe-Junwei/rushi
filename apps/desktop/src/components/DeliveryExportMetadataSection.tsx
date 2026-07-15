import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { DocxProjectMetadata } from "../services/exportDeliveryAppendix";
import { listDocxProjectMetadataPreviewLines } from "../services/exportDeliveryAppendix";

type Props = {
  exportBusy: boolean;
  includeProjectMetadata: boolean;
  projectMetadata?: DocxProjectMetadata;
  onIncludeProjectMetadataChange: (checked: boolean) => void;
};

export function DeliveryExportMetadataSection({
  exportBusy,
  includeProjectMetadata,
  projectMetadata,
  onIncludeProjectMetadataChange,
}: Props) {
  const metadataPreviewLines = listDocxProjectMetadataPreviewLines(projectMetadata);

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
        Word 抬头
      </legend>
      <p className="text-xs leading-snug text-notion-text-muted">
        标题下方默认不写导出行。勾选后可追加 Hub「项目信息」中的场次字段。
      </p>
      <label className={`flex cursor-pointer items-start gap-2 ${PANEL_TYPOGRAPHY.dialogText}`}>
        <input
          type="checkbox"
          className="mt-0.5"
          checked={includeProjectMetadata}
          disabled={exportBusy}
          onChange={(e) => onIncludeProjectMetadataChange(e.target.checked)}
        />
        <span>
          附带项目场次信息
          <span className="block text-xs text-notion-text-muted">
            写入讲述人、时间、地点、主题、转录人；未填写的项自动省略。
          </span>
        </span>
      </label>
      {includeProjectMetadata ? (
        <div
          className="flex flex-col gap-2 rounded-md bg-notion-callout-bg px-3 py-2"
          aria-live="polite"
          aria-label="Word 抬头预览"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
            将写入 Word 标题下方
          </p>
          {metadataPreviewLines.length > 0 ? (
            <ul className="list-none space-y-1 p-0 text-xs text-notion-text">
              {metadataPreviewLines.map((row) => (
                <li key={row.label} className="leading-snug">
                  <span className="text-notion-text-muted">{row.label}：</span>
                  {row.value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zen-cinnabar">
              当前项目尚未填写场次信息；勾选后标题下方仍为空。请先在 Hub「项目信息」中填写。
            </p>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}

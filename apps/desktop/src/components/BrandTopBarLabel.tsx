import { BrandMark } from "./BrandMark";

const TOP_BAR_LABEL = "如是我闻";

/** 欢迎 / Hub / 术语页顶栏品牌行（16px mark + caps 字标） */
export function BrandTopBarLabel() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-zen-primary-action-bg text-zen-primary-action-fg">
        <BrandMark size={13} variant="onPrimary" />
      </div>
      <span className="truncate text-label font-medium uppercase tracking-wider text-notion-text-muted">
        {TOP_BAR_LABEL}
      </span>
    </div>
  );
}

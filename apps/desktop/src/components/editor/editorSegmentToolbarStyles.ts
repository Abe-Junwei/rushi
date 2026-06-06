import { CONTROL_BTN_PRIMARY } from "../../config/controlStyles";

/** 底栏 30px 行内的撤销/重做/历史图标按钮 */
export const footerHistoryIconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";

/** 统一工作条：图标 + 说明文案按钮（32px，对齐 CONTROL h-8） */
export const workbenchLabelBtn =
  "workbench-label-btn inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border-0 px-2.5 text-[12px] font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function workbenchLabelBtnClass(dialogOpen: boolean): string {
  return dialogOpen ? [workbenchLabelBtn, "workbench-action-btn-engaged"].join(" ") : workbenchLabelBtn;
}

/** 空稿等场景：自动转录 Primary（h-9 + 12px 文案，与 ghost 同高） */
export function workbenchTranscribePrimaryClass(): string {
  return [
    CONTROL_BTN_PRIMARY,
    "h-8 min-h-0 gap-1.5 px-2.5 text-[12px] font-medium leading-none",
  ].join(" ");
}

/** 工作条紧凑菜单 `<details>` 触发器（与 label 按钮同高） */
export const workbenchCompactMenuSummary =
  "workbench-compact-menu-summary workbench-label-btn inline-flex h-8 shrink-0 list-none cursor-pointer items-center justify-center gap-1 rounded-md border-0 px-2.5 text-[12px] font-medium leading-none transition-colors marker:content-none [&::-webkit-details-marker]:hidden disabled:cursor-not-allowed disabled:opacity-40";

export function workbenchCompactMenuSummaryClass(engaged: boolean): string {
  return engaged ? [workbenchCompactMenuSummary, "workbench-action-btn-engaged"].join(" ") : workbenchCompactMenuSummary;
}

/** 工作条 overflow 菜单项 */
export const workbenchDropdownItem =
  "dropdown-item flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";

export function workbenchDropdownItemActiveClass(active: boolean): string {
  return active ? [workbenchDropdownItem, "workbench-dropdown-item-active"].join(" ") : workbenchDropdownItem;
}

import { CONTROL_BTN_ICON_GHOST, CONTROL_BTN_PRIMARY, CONTROL_BTN_TOOLBAR_GHOST } from "../../config/controlStyles";

/** 底栏 30px 行内的撤销/重做/历史图标按钮 */
export const footerHistoryIconBtn = CONTROL_BTN_ICON_GHOST;

/** 统一工作条：图标 + 说明文案按钮（32px，对齐 CONTROL h-8） */
const workbenchLabelBtn = `${CONTROL_BTN_TOOLBAR_GHOST} workbench-label-btn`;

export function workbenchLabelBtnClass(dialogOpen: boolean): string {
  return dialogOpen ? [workbenchLabelBtn, "workbench-action-btn-engaged"].join(" ") : workbenchLabelBtn;
}

/** 空稿等场景：自动转录 Primary（与 ghost 同高，工作条内略窄 padding） */
export function workbenchTranscribePrimaryClass(): string {
  return [CONTROL_BTN_PRIMARY, "gap-1.5 px-2.5 font-medium leading-none"].join(" ");
}

/** 工作条紧凑菜单 `<details>` 触发器（与 label 按钮同高） */
const workbenchCompactMenuSummary = `${CONTROL_BTN_TOOLBAR_GHOST} workbench-compact-menu-summary workbench-label-btn list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden`;

export function workbenchCompactMenuSummaryClass(engaged: boolean): string {
  return engaged ? [workbenchCompactMenuSummary, "workbench-action-btn-engaged"].join(" ") : workbenchCompactMenuSummary;
}

/** 工作条 overflow 菜单项 */
export const workbenchDropdownItem =
  "dropdown-item flex w-full items-center gap-2 px-3 py-2 text-left text-body text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";

export function workbenchDropdownItemActiveClass(active: boolean): string {
  return active ? [workbenchDropdownItem, "workbench-dropdown-item-active"].join(" ") : workbenchDropdownItem;
}

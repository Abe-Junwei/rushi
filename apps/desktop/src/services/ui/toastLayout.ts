import { removeCspScopeRules, upsertCspScopeRules } from "../../utils/cspNonceStyleRegistry";

/** 与 EditorView 状态栏同高：`h-[30px]` */
export const EDITOR_STATUS_FOOTER_PX = 30;

const ROOT_VAR_BOTTOM = "--rushi-toast-bottom";
const TOAST_INSET_SCOPE = "toast-bottom-inset";

/** 编辑器底栏可见时，toast 抬高以免遮挡状态条 */
export const TOAST_INSET_ABOVE_FOOTER = "1rem";

const DEFAULT_BOTTOM = `calc(env(safe-area-inset-bottom, 0px) + 1.25rem)`;

const WITH_STATUS_FOOTER = `calc(env(safe-area-inset-bottom, 0px) + ${EDITOR_STATUS_FOOTER_PX}px + ${TOAST_INSET_ABOVE_FOOTER})`;

function writeToastBottomVar(value: string): void {
  upsertCspScopeRules(TOAST_INSET_SCOPE, `:root { ${ROOT_VAR_BOTTOM}: ${value}; }`);
}

/** 按是否展示编辑器底栏状态条，同步全局 toast 底边距（portal 在 body，经 nonce style 写 :root）。 */
export function syncToastBottomInset(hasEditorStatusFooter: boolean): void {
  writeToastBottomVar(hasEditorStatusFooter ? WITH_STATUS_FOOTER : DEFAULT_BOTTOM);
}

export function clearToastBottomInset(): void {
  removeCspScopeRules(TOAST_INSET_SCOPE);
}

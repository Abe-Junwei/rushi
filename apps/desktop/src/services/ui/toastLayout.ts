/** 与 EditorView 状态栏同高：`h-[30px]` */
export const EDITOR_STATUS_FOOTER_PX = 30;

const ROOT_VAR = "--rushi-toast-bottom";

const DEFAULT_BOTTOM = `calc(env(safe-area-inset-bottom, 0px) + 1.25rem)`;

const WITH_STATUS_FOOTER = `calc(env(safe-area-inset-bottom, 0px) + ${EDITOR_STATUS_FOOTER_PX}px + 0.75rem)`;

/** 按是否展示编辑器底栏状态条，同步全局 toast 底边距（portal 在 body，须写 :root）。 */
export function syncToastBottomInset(hasEditorStatusFooter: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    ROOT_VAR,
    hasEditorStatusFooter ? WITH_STATUS_FOOTER : DEFAULT_BOTTOM,
  );
}

export function clearToastBottomInset(): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty(ROOT_VAR);
}

export function toastBottomInsetCssVar(): string {
  return `var(${ROOT_VAR}, ${DEFAULT_BOTTOM})`;
}

/**
 * Launch-time app update check.
 *
 * v0.1.8: OTA is disabled (DMG-only release). This hook always returns a closed
 * dialog so callers can be left in place without pulling in the updater plugin.
 */
export function useAppUpdateCheckOnLaunch() {
  return {
    dialogOpen: false,
    dialogBusy: false,
    dialogVersion: "",
    dialogNotes: undefined as string | undefined,
    onDialogCancel: () => {},
    onDialogConfirm: () => {},
  };
}

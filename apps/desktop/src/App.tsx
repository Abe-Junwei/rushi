import { ProjectPanel } from "./components/ProjectPanel";
import { ToastHost } from "./components/ToastHost";
import { AppUpdateConfirmDialog } from "./components/AppUpdateConfirmDialog";
import { useAppUpdateCheckOnLaunch } from "./hooks/useAppUpdateCheckOnLaunch";
import "./App.css";

export default function App() {
  const launchUpdate = useAppUpdateCheckOnLaunch();

  return (
    <>
      <main className="shell">
        <div className="shell-body">
          <ProjectPanel />
        </div>
      </main>
      <ToastHost />
      <AppUpdateConfirmDialog
        open={launchUpdate.dialogOpen}
        busy={launchUpdate.dialogBusy}
        version={launchUpdate.dialogVersion}
        notes={launchUpdate.dialogNotes}
        onCancel={launchUpdate.onDialogCancel}
        onConfirm={() => void launchUpdate.onDialogConfirm()}
      />
    </>
  );
}

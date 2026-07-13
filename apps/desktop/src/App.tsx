import { ProjectPanel } from "./components/ProjectPanel";
import { ToastHost } from "./components/ToastHost";
import { BundledAsrModelsSeedOverlay } from "./components/BundledAsrModelsSeedOverlay";
import { AppUpdateConfirmDialog } from "./components/AppUpdateConfirmDialog";
import { useBundledAsrModelsSeed } from "./hooks/useBundledAsrModelsSeed";
import { useAppUpdateCheckOnLaunch } from "./hooks/useAppUpdateCheckOnLaunch";
import "./App.css";

export default function App() {
  const bundledSeed = useBundledAsrModelsSeed();
  const launchUpdate = useAppUpdateCheckOnLaunch();

  return (
    <>
      {!bundledSeed.blocking ? (
        <main className="shell">
          <div className="shell-body">
            <ProjectPanel />
          </div>
        </main>
      ) : null}
      <BundledAsrModelsSeedOverlay
        gate={bundledSeed.gate}
        onRetry={() => void bundledSeed.retrySeed()}
      />
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

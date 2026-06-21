import { ProjectPanel } from "./components/ProjectPanel";
import { ToastHost } from "./components/ToastHost";
import { BundledAsrModelsSeedOverlay } from "./components/BundledAsrModelsSeedOverlay";
import { useBundledAsrModelsSeed } from "./hooks/useBundledAsrModelsSeed";
import "./App.css";

export default function App() {
  const bundledSeed = useBundledAsrModelsSeed();

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
    </>
  );
}

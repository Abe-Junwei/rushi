import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { isTauriRuntime } from "./config/env";
import { ensureAppWindowCloseGuardRegistered } from "./services/appWindowCloseGuard";
import { logRuntimeParityBootstrap } from "./services/runtimeParityBootstrap";
import { bootstrapShellCapabilities } from "./services/shellCapabilities";
import { installWaveformZoomProfileDevTools } from "./services/waveform/waveformZoomProfile";
import { installSelectionLatencyProfileDevTools } from "./services/ui/selectionLatencyProfile";
import { initOfficeShellTheme } from "./services/ui/officeShellTheme";
import "./zen-tailwind.css";

initOfficeShellTheme();

ensureAppWindowCloseGuardRegistered();
installWaveformZoomProfileDevTools();
installSelectionLatencyProfileDevTools();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Missing root element with id "root"');
}

async function mountApp(root: HTMLElement): Promise<void> {
  if (isTauriRuntime()) {
    await bootstrapShellCapabilities();
    await logRuntimeParityBootstrap();
  }
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void mountApp(rootEl);

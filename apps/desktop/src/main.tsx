import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { isTauriRuntime } from "./config/env";
import { ensureAppWindowCloseGuardRegistered } from "./services/appWindowCloseGuard";
import { logRuntimeParityBootstrap } from "./services/runtimeParityBootstrap";
import { bootstrapShellCapabilities } from "./services/shellCapabilities";
import { installWaveformZoomProfileDevTools } from "./services/waveform/waveformZoomProfile";
import { installWaveformScrollProfileDevTools } from "./services/waveform/waveformScrollProfile";
import { installSelectionLatencyProfileDevTools } from "./services/ui/selectionLatencyProfile";
import { initOfficeShellTheme } from "./services/ui/officeShellTheme";
import { bootstrapCspStyleNonce } from "./utils/cspNonceStyleRegistry";
import { logReleaseFrontendProbe } from "./utils/releaseFrontendProbe";
import "./zen-tailwind.css";

initOfficeShellTheme();

ensureAppWindowCloseGuardRegistered();
installWaveformZoomProfileDevTools();
installWaveformScrollProfileDevTools();
installSelectionLatencyProfileDevTools();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Missing root element with id "root"');
}

async function mountApp(root: HTMLElement): Promise<void> {
  if (isTauriRuntime()) {
    await bootstrapCspStyleNonce();
    logReleaseFrontendProbe();
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

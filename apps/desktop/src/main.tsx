import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ensureAppWindowCloseGuardRegistered } from "./services/appWindowCloseGuard";
import "./zen-tailwind.css";

ensureAppWindowCloseGuardRegistered();

const root = document.getElementById("root");
if (!root) {
  throw new Error('Missing root element with id "root"');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

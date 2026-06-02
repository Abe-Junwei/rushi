import { ProjectPanel } from "./components/ProjectPanel";
import { ToastHost } from "./components/ToastHost";
import "./App.css";

export default function App() {
  return (
    <>
      <main className="shell">
        <div className="shell-body">
          <ProjectPanel />
        </div>
      </main>
      <ToastHost />
    </>
  );
}

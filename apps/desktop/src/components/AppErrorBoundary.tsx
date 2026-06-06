import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zen-paper px-6 py-10">
          <div className="max-w-md rounded-xl bg-notion-bg px-6 py-5 shadow-sm">
            <h1 className="text-base font-semibold text-zen-ink">界面遇到问题</h1>
            <p className="mt-2 text-sm leading-relaxed text-notion-text-muted">
              应用遇到意外错误。你可以重试；若问题持续，请重启应用。
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-zen-saffron px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              onClick={this.handleRetry}
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

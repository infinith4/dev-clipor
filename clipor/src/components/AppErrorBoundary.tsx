import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  errorMessage: string | null;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      errorMessage: error.message || i18n.t("error_boundary.render_failed"),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App render failed", error, errorInfo);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <main className="startup-fallback">
          <section className="startup-card">
            <small className="eyebrow">Clipor</small>
            <h1>{i18n.t("error_boundary.ui_init_failed")}</h1>
            <p>{this.state.errorMessage}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;

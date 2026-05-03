import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  source: "react" | "window" | "promise" | null;
  extraDetails: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    source: null,
    extraDetails: null
  };

  private onWindowError = (event: ErrorEvent) => {
    const raw = event.error;
    const errorObj = raw instanceof Error ? raw : new Error(event.message || "Unknown window error");
    const extra = `File: ${event.filename || "N/A"}\nLine: ${event.lineno || "N/A"}\nColumn: ${event.colno || "N/A"}`;
    this.setState({
      hasError: true,
      error: errorObj,
      errorInfo: null,
      source: "window",
      extraDetails: extra
    });
  };

  private onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const errorObj = reason instanceof Error
      ? reason
      : new Error(typeof reason === "string" ? reason : JSON.stringify(reason, null, 2));

    this.setState({
      hasError: true,
      error: errorObj,
      errorInfo: null,
      source: "promise",
      extraDetails: "Unhandled Promise Rejection"
    });
  };

  public componentDidMount() {
    window.addEventListener("error", this.onWindowError);
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener("error", this.onWindowError);
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, source: "react", extraDetails: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
      source: "react",
      extraDetails: null
    });
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", backgroundColor: "#ffebee", color: "#c62828", minHeight: "100vh", fontFamily: "sans-serif" }} dir="ltr">
          <h1 style={{ marginBottom: "20px" }}>Application Crashed</h1>
          <p style={{ fontWeight: 700, marginBottom: "8px" }}>
            Source: {this.state.source || "unknown"}
          </p>
          <h2 style={{ color: "#d32f2f" }}>{this.state.error && this.state.error.toString()}</h2>
          {this.state.extraDetails && (
            <pre style={{ whiteSpace: "pre-wrap", background: "#f8bbd0", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
              {this.state.extraDetails}
            </pre>
          )}
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8bbd0", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8bbd0", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
            {this.state.error && this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

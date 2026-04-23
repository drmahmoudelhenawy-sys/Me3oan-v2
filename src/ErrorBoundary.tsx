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
    // We log window errors but DON'T crash the app UI for them
    // Many window errors come from browser extensions or injections (like Telegram's webview)
    // and are not fatal to the React application itself.
    console.warn("Global Window Error Caught:", event.message, event.filename);
    
    // Only crash if it's a very specific fatal error we want to catch, 
    // otherwise just let React handle its own lifecycle.
    if (event.message === "Script error." && !event.filename) {
        // This is almost always a CORS noise error from an injected script.
        return;
    }
    
    // If you REALLY want to see window errors in the UI, you could use a toast here
    // but setting hasError: true is too aggressive.
  };

  private onUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.warn("Unhandled Promise Rejection:", event.reason);
    // Don't crash the app for promise rejections.
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
      const isScriptError = this.state.error?.message === "Script error.";
      
      return (
        <div style={{ padding: "40px", backgroundColor: "#ffebee", color: "#c62828", minHeight: "100vh", fontFamily: "sans-serif" }} dir="rtl">
          <h1 style={{ marginBottom: "20px" }}>عذراً، حدث خطأ في النظام</h1>
          
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #ffcdd2", marginBottom: "20px" }}>
            <p style={{ fontWeight: 700, marginBottom: "12px" }}>تعليمات هامة:</p>
            <ul style={{ paddingRight: "20px", fontSize: "14px", lineHeight: "1.6" }}>
              <li>إذا كنت تفتح الرابط من داخل تطبيق (مثل تيليجرام)، يرجى الضغط على الثلاث نقاط بالأعلى واختيار <b>"فتح في المتصفح الخارجي" (Open in Browser)</b>.</li>
              <li>يرجى التأكد من تحديث نظام الهاتف ومتصفح كروم أو سفاري لآخر إصدار.</li>
            </ul>
          </div>

          <p style={{ fontWeight: 700, marginBottom: "8px" }} dir="ltr">
            Source: {this.state.source || "unknown"}
          </p>
          <h2 style={{ color: "#d32f2f" }} dir="ltr">{this.state.error && this.state.error.toString()}</h2>
          
          {isScriptError && (
            <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
              هذا الخطأ غالباً ما يحدث بسبب قيود المتصفح الداخلي للتطبيقات. الحل الأمثل هو الفتح في متصفح خارجي.
            </p>
          )}

          {this.state.extraDetails && (
            <pre style={{ whiteSpace: "pre-wrap", background: "#f8bbd0", padding: "15px", borderRadius: "8px", marginTop: "20px" }} dir="ltr">
              {this.state.extraDetails}
            </pre>
          )}
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8bbd0", padding: "15px", borderRadius: "8px", marginTop: "20px" }} dir="ltr">
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8bbd0", padding: "15px", borderRadius: "8px", marginTop: "20px" }} dir="ltr">
            {this.state.error && this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

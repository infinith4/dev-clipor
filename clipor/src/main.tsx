import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./styles/popup.css";

// Catch unhandled errors and show them on screen (helps debug white-screen issues)
window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<pre style="padding:12px;color:red;font-size:11px;">JS Error: ${event.message}\n${event.filename}:${event.lineno}</pre>`;
  }
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

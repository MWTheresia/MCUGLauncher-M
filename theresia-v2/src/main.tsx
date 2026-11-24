import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { applyTheme, loadTheme } from "./theme/palettes";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/system.css";
import "./shell/Shell.css";

// 首帧之前先把主题写到 <html>，避免深色模式启动时闪一下白底
applyTheme(loadTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

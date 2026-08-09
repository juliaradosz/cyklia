import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./api/auth.jsx";
import "./styles.css";

if (typeof document !== "undefined") {
  const prevent = (e) => e.preventDefault();
  document.addEventListener("gesturestart", prevent);
  document.addEventListener("gesturechange", prevent);
  document.addEventListener("gestureend", prevent);
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches && e.touches.length > 1) prevent(e);
    },
    { passive: false }
  );
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) prevent(e);
    },
    { passive: false }
  );
  document.addEventListener(
    "dblclick",
    (e) => {
      if (e.target && e.target.closest && e.target.closest("input,textarea,select")) return;
      prevent(e);
    },
    true
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
        prevent(e);
      }
    },
    true
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

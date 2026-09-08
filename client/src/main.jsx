import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import "./styles.css";

// Polyfill mediaDevices, getSupportedConstraints & getUserMedia for browser speech SDK compatibility
if (typeof window !== "undefined") {
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  if (!navigator.mediaDevices.getSupportedConstraints) {
    navigator.mediaDevices.getSupportedConstraints = () => ({});
  }
  if (!navigator.mediaDevices.getUserMedia) {
    const legacyGetUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;
    if (legacyGetUserMedia) {
      navigator.mediaDevices.getUserMedia = (constraints) =>
        new Promise((resolve, reject) =>
          legacyGetUserMedia.call(navigator, constraints, resolve, reject)
        );
    }
  }
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

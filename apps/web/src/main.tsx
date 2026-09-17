import React from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
  (window as unknown as { global: typeof globalThis }).global = window;
}

import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./index.css";

const StationPreview = lazy(() => import("./station/StationPreview"));
const Recovery = lazy(() => import("./station/Recovery"));
const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element missing");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      {window.location.pathname === "/recover" ? <Suspense fallback={<p>Opening recovery…</p>}><Recovery/></Suspense> : window.location.pathname === "/station" ? (
        <Suspense fallback={<p style={{ padding: 32 }}>Opening the studio…</p>}>
          <StationPreview />
        </Suspense>
      ) : <App />}
    </BrowserRouter>
  </StrictMode>,
);

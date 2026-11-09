import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import "./index.css";
async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK !== "0") {
    const { worker } = await import("./mocks/browser");
    await worker.start();
    const { advance } = await import("./mocks/handlers");
    advance();
    window.setInterval(advance, 1000);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
start().catch(() => {
  document.getElementById("root")!.textContent =
    "Could not start the demo. Reload and try again.";
});

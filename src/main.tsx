// ©2026 thinkany llc. All rights reserved.

  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./app/parallax-fallback"; // scroll-driven parallax for browsers without the CSS (Firefox)

  createRoot(document.getElementById("root")!).render(<App />);
  
import { createRoot } from "react-dom/client";

import App from "./App";
import { initTracking } from "./lib/tracking";

import "./index.css";

initTracking();

createRoot(document.getElementById("root")!).render(<App />);

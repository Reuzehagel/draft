import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../index.css";
import "./pill.css";
import PillApp from "./PillApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PillApp />
  </StrictMode>
);

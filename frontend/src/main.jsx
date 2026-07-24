import {
  StrictMode,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import App from "./App.jsx";
import AuthGate from "./components/AuthGate.jsx";
import GuidedTour from "./components/GuidedTour.jsx";

import "./index.css";


createRoot(
  document.getElementById("root"),
).render(
  <StrictMode>
    <AuthGate>
      <GuidedTour>
        <App />
      </GuidedTour>
    </AuthGate>
  </StrictMode>,
);
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";

// Respeita o tema que o portal atual guardou (localStorage ce_tema), para a casca nova nascer
// no mesmo claro/escuro. Se não houver, segue o prefers-color-scheme.
try {
  const t = localStorage.getItem("ce_tema");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch (_) { /* storage indisponível: usa o padrão do sistema */ }

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

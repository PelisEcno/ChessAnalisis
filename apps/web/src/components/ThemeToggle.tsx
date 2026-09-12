"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "peon-libre:theme";
type Theme = "dark" | "light";

function applyTheme(theme: Theme): void {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/**
 * Oscuro es el default de la app (no depende de prefers-color-scheme); este
 * botón alterna a un tema claro explícito, persistido en localStorage.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light") setTheme("light");
    } catch {
      // localStorage no disponible: se queda en oscuro.
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // no pasa nada si no se puede persistir.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      }
      className="rounded border border-[var(--panel-border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {theme === "dark" ? "☀️ claro" : "🌙 oscuro"}
    </button>
  );
}

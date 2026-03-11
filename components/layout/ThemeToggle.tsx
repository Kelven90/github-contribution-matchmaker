"use client";

import { useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "gcm-theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const current = document.documentElement.getAttribute("data-theme");
    return current === "dark" || current === "light" ? current : "light";
  });

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group relative inline-flex h-8 w-16 items-center rounded-full border border-slate-300 bg-white/90 px-1 shadow-sm transition hover:bg-slate-100"
      aria-label="Toggle light and dark theme"
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      role="switch"
      aria-checked={theme === "dark"}
    >
      <span className="pointer-events-none absolute left-2 text-xs text-amber-500" aria-hidden="true">
        ☀
      </span>
      <span className="pointer-events-none absolute right-2 text-xs text-indigo-500" aria-hidden="true">
        ☾
      </span>
      <span
        className={`pointer-events-none inline-flex h-8 w-8 transform items-center justify-center rounded-full border text-[11px] font-semibold transition duration-200 ${
          theme === "dark"
            ? "translate-x-8 border-slate-700 bg-slate-800 text-slate-100"
            : "translate-x-0 border-amber-300 bg-amber-100 text-amber-700"
        }`}
        aria-hidden="true"
      >
        {theme === "dark" ? "☾" : "☀"}
      </span>
      <span className="sr-only">{theme === "light" ? "Switch to dark mode" : "Switch to light mode"}</span>
    </button>
  );
}

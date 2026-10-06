import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

const initialTheme = () =>
  localStorage.getItem("pitchflow-theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");

export default function ThemeToggle({ inverted = false }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const toggle = (event) => {
    const next = theme === "light" ? "dark" : "light";
    const x = event.clientX,
      y = event.clientY;
    document.documentElement.style.setProperty("--theme-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-y", `${y}px`);
    const apply = () => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      localStorage.setItem("pitchflow-theme", next);
      setTheme(next);
    };
    if (
      document.startViewTransition &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      document.startViewTransition(apply);
    else apply();
  };
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      className={`group relative grid size-9 place-items-center overflow-hidden rounded-full transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:rotate-12 active:scale-95 ${inverted ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-[var(--ink)]/5 text-[var(--text)] ring-1 ring-black/5"}`}
    >
      <Sun
        size={16}
        weight="light"
        className={`absolute transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] ${theme === "light" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"}`}
      />
      <Moon
        size={16}
        weight="light"
        className={`absolute transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}
      />
    </button>
  );
}

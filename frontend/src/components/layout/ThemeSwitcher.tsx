import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark";
type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "clario:theme";

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return systemTheme();
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference;
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<ThemePreference>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(resolveTheme(theme));
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={`${collapsed ? "mx-auto" : ""} theme-toggle grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 outline outline-1 outline-slate-200 transition hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
    </button>
  );
}

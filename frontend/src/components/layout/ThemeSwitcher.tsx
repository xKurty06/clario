import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "clario:theme";

const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<ThemePreference>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme()));

  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(resolveTheme(theme));
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (theme !== "system") return;
      applyTheme("system");
      setResolvedTheme(resolveTheme("system"));
    };
    updateSystemTheme();
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [theme]);

  if (collapsed) {
    const Icon = resolvedTheme === "dark" ? Moon : Sun;
    return (
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={`Theme: ${theme === "system" ? `System (${resolvedTheme})` : theme}. Click to toggle light/dark.`}
        aria-label={`Theme: ${theme === "system" ? `System ${resolvedTheme}` : theme}. Click to toggle light or dark.`}
        className="mx-auto grid size-10 place-items-center rounded-xl bg-white text-slate-600 transition hover:bg-slate-100 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-slate-50 p-1.5">
      <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Theme</p>
      <div className="grid grid-cols-3 gap-1">
        {themeOptions.map(({ value, label, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                selected ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-950"
              }`}
              aria-pressed={selected}
              title={`Use ${label.toLowerCase()} theme`}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

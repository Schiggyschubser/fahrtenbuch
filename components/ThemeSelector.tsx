"use client";

import { faCheck, faMoon, faRoad, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, isThemeId, THEMES, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

function applyTheme(themeId: ThemeId) {
  const theme = THEMES.find((entry) => entry.id === themeId) ?? THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.style.colorScheme = theme.mode;
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  window.dispatchEvent(new CustomEvent("fahrtenbuch-theme-change", { detail: theme.id }));
}

function subscribeToThemeChange(onStoreChange: () => void) {
  window.addEventListener("fahrtenbuch-theme-change", onStoreChange);
  return () => window.removeEventListener("fahrtenbuch-theme-change", onStoreChange);
}

function getThemeSnapshot(): ThemeId {
  const activeTheme = document.documentElement.dataset.theme;
  return isThemeId(activeTheme) ? activeTheme : DEFAULT_THEME;
}

function getServerThemeSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

export function ThemeSelector() {
  const selectedTheme = useSyncExternalStore(subscribeToThemeChange, getThemeSnapshot, getServerThemeSnapshot);

  function selectTheme(themeId: ThemeId) {
    applyTheme(themeId);
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
      <header className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-5 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <FontAwesomeIcon icon={faRoad} className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold tracking-[-.02em]">Darstellung</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Wähle ein modernes Fahrtenbuch-Design für Karten, Listen, Dashboard und Login.</p>
        </div>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 2xl:grid-cols-5">
        {THEMES.map((theme) => {
          const selected = selectedTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={selected}
              className={`focus-ring group relative overflow-hidden rounded-2xl border p-4 text-left transition-[border-color,box-shadow,transform] active:scale-[.99] ${selected ? "border-[var(--primary)] shadow-[0_0_0_3px_var(--primary-ring)]" : "border-[var(--line)] hover:border-[var(--line-strong)] hover:shadow-[var(--card-shadow)]"}`}
              onClick={() => selectTheme(theme.id)}
            >
              <div className="mb-4 overflow-hidden rounded-xl border border-black/10" style={{ backgroundColor: theme.colors[0] }}>
                <div className="flex h-9 items-center gap-2 border-b border-black/10 px-3" style={{ backgroundColor: theme.colors[1] }}>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.colors[2] }} />
                  <span className="h-1.5 w-16 rounded-full opacity-45" style={{ backgroundColor: theme.colors[3] }} />
                </div>
                <div className="grid h-24 grid-cols-[.72fr_1.28fr] gap-2 p-3">
                  <div className="rounded-lg border border-black/10 p-2" style={{ backgroundColor: theme.colors[1] }}>
                    <div className="mb-2 h-2 w-8 rounded-full" style={{ backgroundColor: theme.colors[2] }} />
                    <div className="space-y-1.5 opacity-35">
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: theme.colors[3] }} />
                      <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: theme.colors[3] }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-9 rounded-lg border border-black/10" style={{ backgroundColor: theme.colors[1] }} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 rounded-lg" style={{ backgroundColor: theme.colors[2] }} />
                      <div className="h-8 rounded-lg border border-black/10" style={{ backgroundColor: theme.colors[1] }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={theme.mode === "dark" ? faMoon : faSun} className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <span className="font-extrabold">{theme.name}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{theme.description}</p>
                </div>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${selected ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-contrast)]" : "border-[var(--line-strong)] text-transparent"}`}>
                  <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <footer className="border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-3 text-xs leading-5 text-[var(--muted)] sm:px-6">
        Deine Auswahl bleibt im Browser gespeichert. Druckansichten bleiben hell und druckerfreundlich.
      </footer>
    </section>
  );
}

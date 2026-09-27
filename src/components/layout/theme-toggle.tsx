"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const themeChangeEvent = "nail-agenda:theme-change";
let preference: Theme | null | undefined;

function readPreference(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(themeChangeEvent));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => applyTheme(preference ?? (media.matches ? "dark" : "light"));
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    sync();
  };

  // Sem escolha manual, acompanha o sistema operacional em tempo real.
  // A preferência em memória também funciona se o navegador bloquear o armazenamento.
  preference ??= readPreference();
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", sync);
  sync();

  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", sync);
  };
}

function getSnapshot() {
  return document.documentElement.dataset.theme === "dark";
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggleTheme() {
    preference = getSnapshot() ? "light" : "dark";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Mantém a alternância disponível mesmo sem acesso ao localStorage.
    }
    applyTheme(preference);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Tema escuro"
      aria-pressed={isDark}
      title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  );
}

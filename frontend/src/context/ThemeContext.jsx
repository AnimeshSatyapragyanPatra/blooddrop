import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "blooddrop_theme";

/** "light" | "dark" | "system" — system follows the OS setting live. */
function resolve(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch {
      return "system";
    }
  });

  const [resolved, setResolved] = useState(() => resolve(preference));

  useEffect(() => {
    const next = resolve(preference);
    setResolved(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    // Tells the browser to render form controls and scrollbars to match.
    document.documentElement.style.colorScheme = next;
    try {
      if (preference === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* private mode — the choice just will not persist */
    }
  }, [preference]);

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (preference !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((p) => (p === "light" ? "dark" : p === "dark" ? "system" : "light"));
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

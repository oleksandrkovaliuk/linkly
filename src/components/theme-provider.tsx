import * as React from "react";

export type Theme = "light" | "dark" | "system";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initial = {
  theme: "system",
  setTheme: () => {},
} as const;

const STORAGE_KEY = "inspo_theme";

const ThemeProviderContext = React.createContext<ThemeProviderState>(initial);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(
    (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system"
  );

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
    },
  };

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext);

  if (!context) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}

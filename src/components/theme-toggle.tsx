import { Monitor, MoonStar, Sun } from "lucide-react";

import { useTheme, type Theme } from "./theme-provider";
import { Button } from "./ui/button";

const CYCLE: Theme[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function cycle() {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  }

  const Icon = theme === "dark" ? MoonStar : theme === "system" ? Monitor : Sun;

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={cycle}
      aria-label={`Theme: ${theme}`}
    >
      <Icon className="size-4" />
    </Button>
  );
}

import React from "react";
import { Braces, Moon, Sun } from "lucide-react";
import { Button } from "../components/ui/button";
import { JsonWorkbench } from "./JsonWorkbench";

export function App({
  mode,
  initialRawText,
  initialValue,
}: {
  mode: "paste" | "inpage";
  subtitle?: string;
  initialRawText?: string;
  initialValue?: unknown;
}) {
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("bj-theme") as "light" | "dark" | "system" | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "dark";
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("bj-theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,hsl(var(--canvas)),hsl(var(--background))_40%,hsl(var(--background)))]" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/96 backdrop-blur supports-[backdrop-filter]:bg-background/88">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center border border-border bg-card text-primary">
              <Braces className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold leading-tight tracking-tight sm:text-base">Better JSON Tools</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <main className="w-full px-4 pb-4 pt-4">
        <JsonWorkbench mode={mode} initialRawText={initialRawText} initialValue={initialValue} />
      </main>
    </div>
  );
}

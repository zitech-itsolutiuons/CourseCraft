"use client";

import { useTheme } from "next-themes";

export default function ThemeControl() {
  const { theme, setTheme } = useTheme();

  return (
    <select
      aria-label="Color theme"
      value={theme ?? "system"}
      onChange={(event) => setTheme(event.target.value)}
      className="h-9 border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}
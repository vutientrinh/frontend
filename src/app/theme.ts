export type Theme = "light" | "dark" | "system";
export function getTheme(): Theme {
  const saved = localStorage.getItem("payment-theme");
  return saved === "light" || saved === "dark" ? saved : "system";
}
export function applyTheme(theme: Theme) {
  localStorage.setItem("payment-theme", theme);
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" ||
      (theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches),
  );
  window.dispatchEvent(new Event("payment-theme-change"));
}

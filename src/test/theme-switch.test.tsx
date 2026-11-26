import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "../components/layout/ThemeSwitch";
import { initializeTheme } from "../app/theme";

afterEach(() => {
  localStorage.removeItem("payment-theme");
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("ThemeSwitch", () => {
  it("offers Light, Dark, and System and persists each selection", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);

    expect(screen.getByLabelText("Theme: system. Change theme")).toBeVisible();
    for (const theme of ["Light", "Dark", "System"] as const) {
      await user.click(screen.getByLabelText(/Theme: .* Change theme/));
      await user.click(screen.getByRole("button", { name: theme }));
      expect(localStorage.getItem("payment-theme")).toBe(theme.toLowerCase());
      expect(document.documentElement.classList.contains("dark")).toBe(
        theme === "Dark",
      );
      expect(
        screen.getByLabelText(`Theme: ${theme.toLowerCase()}. Change theme`),
      ).toBeVisible();
    }
  });

  it("updates the applied theme when the system preference changes", async () => {
    let preferenceListener: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      matches: true,
      addEventListener: vi.fn((_type: string, listener: EventListener) => {
        preferenceListener = listener as (event: MediaQueryListEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.spyOn(window, "matchMedia").mockReturnValue(media);
    initializeTheme();

    const user = userEvent.setup();
    render(<ThemeSwitch />);
    await user.click(screen.getByLabelText(/Theme: .* Change theme/));
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement).toHaveClass("dark");

    Object.defineProperty(media, "matches", {
      configurable: true,
      value: false,
    });
    preferenceListener?.(new Event("change") as MediaQueryListEvent);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("payment-theme")).toBe("system");
  });
});

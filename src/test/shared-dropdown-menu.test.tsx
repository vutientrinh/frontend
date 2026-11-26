import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "../components/DropdownMenu";
import { ConfirmDialog } from "../components/shared";

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function setup(items: DropdownMenuItem[], onRowClick = vi.fn()) {
  render(
    <MemoryRouter>
      <div onClick={onRowClick}>
        <DropdownMenu label="More actions for Lamp" items={items} />
      </div>
      <button type="button">After</button>
      <Location />
    </MemoryRouter>,
  );
  return {
    user: userEvent.setup(),
    onRowClick,
    trigger: screen.getByRole("button", { name: "More actions for Lamp" }),
  };
}

const actions = (onSelect = vi.fn()): DropdownMenuItem[] => [
  { label: "Duplicate", onSelect },
  { label: "Archive", disabled: true, onSelect },
  { label: "Hide", destructive: true, onSelect },
];

const item = (name: string) => screen.getByRole("menuitem", { name });

describe("DropdownMenu", () => {
  it("has a 44 px trigger and items, and exposes menu semantics", async () => {
    const { user, trigger } = setup(actions());
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.className).toContain("size-11");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("menu", { name: "More actions for Lamp" }),
    ).toBeInTheDocument();
    expect(item("Duplicate").className).toContain("min-h-11");
  });

  it("opens from the keyboard, wraps with arrows and skips disabled items", async () => {
    const { user, trigger } = setup(actions());
    trigger.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(item("Duplicate")).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(item("Hide")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Duplicate")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item("Hide")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Duplicate")).toHaveFocus();
    await user.keyboard("{End}");
    expect(item("Hide")).toHaveFocus();
  });

  it("opens on the last item with ArrowUp", async () => {
    const { user, trigger } = setup(actions());
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(item("Hide")).toHaveFocus());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { user, trigger } = setup(actions());
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on Tab and moves to the next control", async () => {
    const { user, trigger } = setup(actions());
    await user.click(trigger);
    await user.tab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus(),
    );
  });

  it.each(["{Enter}", " "])("selects with %j and closes", async (key) => {
    const onSelect = vi.fn();
    const { user, trigger } = setup(actions(onSelect));
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(item("Duplicate")).toHaveFocus());
    await user.keyboard(key);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("ignores disabled items", async () => {
    const onSelect = vi.fn();
    const { user, trigger } = setup(actions(onSelect));
    await user.click(trigger);
    await user.click(item("Archive"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("never triggers a surrounding clickable row", async () => {
    const { user, trigger, onRowClick } = setup(actions());
    await user.click(trigger);
    await user.click(item("Duplicate"));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("navigates with link items, including with Space", async () => {
    const { user, trigger } = setup([
      { label: "View on storefront", to: "/p/lamp" },
    ]);
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(item("View on storefront")).toHaveFocus());
    await user.keyboard(" ");
    expect(screen.getByTestId("location")).toHaveTextContent("/p/lamp");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("hands focus to a dialog and gets it back when the dialog closes", async () => {
    function Harness() {
      const [confirm, setConfirm] = useState(false);
      return (
        <MemoryRouter>
          <DropdownMenu
            label="More"
            items={[{ label: "Hide", onSelect: () => setConfirm(true) }]}
          />
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Hide product"
            description="Shoppers will not see it."
            onConfirm={() => {}}
          />
        </MemoryRouter>
      );
    }
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(item("Hide"));
    const dialog = screen.getByRole("dialog", { name: "Hide product" });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "More" })).toHaveFocus(),
    );
  });

  it("renders nothing without items", () => {
    render(<DropdownMenu label="More" items={[]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

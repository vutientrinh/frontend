import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TransactionList from "../features/transactions/TransactionList";
import { resetDB } from "../mocks/db";
import { handlers } from "../mocks/handlers";
import { server } from "./setup";
function Location() {
  return (
    <output data-testid="location">
      {useLocation().pathname}
      {useLocation().search}
    </output>
  );
}
function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}
function mount(path: string, kind: "orders" | "payments", wide = true) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: wide,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Back />
        <Routes>
          <Route path={`/${kind}`} element={<TransactionList kind={kind} />} />
          <Route path={`/admin/${kind}/:id`} element={<p>Full detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  resetDB();
  server.use(...handlers);
});
afterEach(() => vi.restoreAllMocks());
describe("transaction split view", () => {
  it.each(["orders", "payments"] as const)(
    "selects, moves and closes filtered %s",
    async (kind) => {
      const user = userEvent.setup();
      mount(
        `/${kind}?status=${kind === "orders" ? "PAID" : "COMPLETED"}`,
        kind,
      );
      const table = await screen.findByRole("table", {}, { timeout: 5000 });
      const rows = within(table).getAllByRole("row");
      await user.click(rows[1]);
      const panel = screen.getByRole("complementary", {
        name: kind === "orders" ? "Selected order" : "Selected payment",
      });
      const first = screen.getByTestId("location").textContent;
      fireEvent.keyDown(window, { key: "j" });
      expect(screen.getByTestId("location").textContent).not.toBe(first);
      expect(panel).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "k" });
      expect(screen.getByTestId("location").textContent).toBe(first);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(
        screen.queryByRole("complementary", {
          name: kind === "orders" ? "Selected order" : "Selected payment",
        }),
      ).not.toBeInTheDocument();
      fireEvent.keyDown(window, { key: "j" });
      fireEvent.keyDown(window, { key: "Enter" });
      expect(screen.getByText("Full detail")).toBeInTheDocument();
    },
  );
  it("opens full details on small screens", async () => {
    const user = userEvent.setup();
    mount("/orders", "orders", false);
    const table = await screen.findByRole("table", {}, { timeout: 5000 });
    await user.click(within(table).getAllByRole("row")[1]);
    expect(screen.getByText("Full detail")).toBeInTheDocument();
  });
  it("ignores modified shortcuts and open or already-handled dialogs", async () => {
    const user = userEvent.setup();
    mount("/orders", "orders");
    const table = await screen.findByRole("table", {}, { timeout: 5000 });
    await user.click(within(table).getAllByRole("row")[1]);
    const first = screen.getByTestId("location").textContent;
    for (const modifier of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
    ])
      fireEvent.keyDown(window, { key: "k", ...modifier });
    expect(screen.getByTestId("location").textContent).toBe(first);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("location").textContent).toBe(first);
    dialog.remove();
    const handled = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    handled.preventDefault();
    fireEvent(window, handled);
    expect(screen.getByTestId("location").textContent).toBe(first);
  });
  it("replaces history during keyboard movement", async () => {
    const user = userEvent.setup();
    mount("/orders?status=PAID", "orders");
    const table = await screen.findByRole("table", {}, { timeout: 5000 });
    await user.click(within(table).getAllByRole("row")[1]);
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "j" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/orders?status=PAID",
    );
    expect(
      screen.queryByRole("complementary", { name: "Selected order" }),
    ).not.toBeInTheDocument();
  });
});

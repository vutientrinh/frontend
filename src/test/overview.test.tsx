import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import Dashboard from "../features/dashboard/Dashboard";
import EventMonitor from "../features/events/EventMonitor";
import { resetDB } from "../mocks/db";
import { handlers } from "../mocks/handlers";
import { server } from "./setup";
function mount(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  resetDB();
  server.use(...handlers);
});
describe("overview screens", () => {
  it("loads dashboard metrics and volume chart", async () => {
    mount(<Dashboard />);
    expect(
      await screen.findByRole(
        "heading",
        { name: "Payment volume" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Daily payment volume" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recent payments" }),
    ).toBeInTheDocument();
  });
  it("opens an outbox event detail", async () => {
    const user = userEvent.setup();
    mount(<EventMonitor />);
    const table = await screen.findByRole("table", {}, { timeout: 5000 });
    const rows = within(table).getAllByRole("row");
    await user.click(rows[1]);
    const dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByText("Attempts", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Last error")).toBeInTheDocument();
  });
});

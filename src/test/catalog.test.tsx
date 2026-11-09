import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import CatalogPage from "../features/catalog/CatalogPage";
import CustomerDetail from "../features/customers/CustomerDetail";
import DemoSettings from "../app/DemoSettings";
import { handlers } from "../mocks/handlers";
import { getDB, resetDB } from "../mocks/db";
import { server } from "./setup";
import { http, HttpResponse } from "msw";
function mount(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/customers" element={<CatalogPage kind="customers" />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/products" element={<CatalogPage kind="products" />} />
          <Route path="/settings" element={<DemoSettings />} />
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
describe("M2 screens", () => {
  it("creates a customer through the form", async () => {
    const user = userEvent.setup();
    mount("/customers");
    await screen.findByText("Customer directory");
    await user.click(screen.getByRole("button", { name: "New customer" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("First name"), "Ada");
    await user.type(within(dialog).getByLabelText("Last name"), "Example");
    await user.type(
      within(dialog).getByLabelText("Email address"),
      "ada@example.com",
    );
    await user.type(
      within(dialog).getByLabelText("Phone number"),
      "0901234567",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create customer" }),
    );
    expect(
      await screen.findByText("Ada Example", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(getDB().customers.some((c) => c.email === "ada@example.com")).toBe(
      true,
    );
  });
  it("keeps entered values when an email conflicts", async () => {
    const user = userEvent.setup();
    mount("/customers");
    await screen.findByText("Customer directory");
    await user.click(screen.getByRole("button", { name: "New customer" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("First name"), "Ada");
    await user.type(within(dialog).getByLabelText("Last name"), "Example");
    await user.type(
      within(dialog).getByLabelText("Email address"),
      getDB().customers[0].email,
    );
    await user.type(within(dialog).getByLabelText("Phone number"), "123");
    await user.click(
      within(dialog).getByRole("button", { name: "Create customer" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Email already exists",
    );
    expect(within(dialog).getByLabelText("First name")).toHaveValue("Ada");
  });
  it("creates a product with an exact price", async () => {
    const user = userEvent.setup();
    mount("/products");
    await screen.findByText("Product catalog");
    await user.click(screen.getByRole("button", { name: "New product" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Product name"),
      "Sample item",
    );
    await user.type(
      within(dialog).getByLabelText("Description"),
      "Sample description",
    );
    await user.type(
      within(dialog).getByLabelText("Unit price (VND)"),
      "123.4567",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create product" }),
    );
    expect(
      await screen.findByText("Sample item", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      getDB().products.find((p) => p.productName === "Sample item")?.unitPrice,
    ).toBe("123.4567");
  });
  it("edits and deactivates a product", async () => {
    const user = userEvent.setup();
    const product = getDB().products[0];
    mount("/products");
    const row = (await screen.findByText(product.productName)).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edit product" }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("Product name");
    await user.clear(name);
    await user.type(name, "Updated item");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    const updated = await screen.findByText(
      "Updated item",
      {},
      { timeout: 3000 },
    );
    await user.click(
      within(updated.closest("tr")!).getByRole("button", {
        name: "Deactivate product",
      }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirm",
      }),
    );
    await screen.findByText("Product catalog");
    await expect
      .poll(() => getDB().products.find((p) => p.id === product.id)?.active, {
        timeout: 3000,
      })
      .toBe(false);
  });
  it("shows customer profile and associated activity", async () => {
    const c = getDB().customers[0];
    mount(`/customers/${c.id}`);
    expect(
      await screen.findByRole("heading", {
        name: `${c.firstName} ${c.lastName}`,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Orders" }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
  it("saves profile and locale preferences", async () => {
    const user = userEvent.setup();
    localStorage.setItem("payment-demo-user", "old@example.com");
    mount("/settings");
    const email = screen.getByLabelText("Email address");
    await user.clear(email);
    await user.type(email, "new@example.com");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(localStorage.getItem("payment-demo-user")).toBe("new@example.com");
    await user.selectOptions(screen.getByLabelText("Locale"), "vi-VN");
    expect(localStorage.getItem("payment-locale")).toBe("vi-VN");
  });
  it("shows an error and retry on list failure", async () => {
    server.use(
      http.get("*/api/customers", () =>
        HttpResponse.json({ detail: "Unavailable" }, { status: 500 }),
      ),
    );
    mount("/customers");
    expect(
      await screen.findByRole("alert", {}, { timeout: 3000 }),
    ).toHaveTextContent("Unable to load data");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

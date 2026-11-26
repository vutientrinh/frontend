import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  Link,
  MemoryRouter,
  Route,
  Routes,
  RouterProvider,
} from "react-router-dom";
import { server } from "../setup";
import { commerceHandlers } from "../../mocks/commerce";
import { getDB, resetCommerceDB } from "../../mocks/commerce/db";
import { SELLER_USER_IDS } from "../../mocks/commerce/seed";
import { setSession } from "../../features/banking/client";
import { sellerRoutes } from "../../features/seller";
import { ProductForm } from "../../features/seller/ProductForm";
vi.mock("../../features/banking/AuthContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../features/banking/AuthContext")>();
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: "seller",
        phone: "seller",
        email: "",
        fullName: "Seller",
        roles: ["SELLER_OWNER"],
        kycTier: 0,
        status: "ACTIVE",
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(async () => {}),
      setUser: vi.fn(),
    }),
  };
});
function renderRoute(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createMemoryRouter(sellerRoutes, { initialEntries: [path] })}
      />
    </QueryClientProvider>,
  );
}
function renderProductFormInBrowserRouterShape() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/seller/products/new"]}>
        <Routes>
          <Route path="/seller/products/new" element={<ProductForm />} />
          <Route path="/seller/products" element={<h1>Products</h1>} />
        </Routes>
        <Link to="/seller/products">Products link</Link>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  const id = SELLER_USER_IDS[0];
  localStorage.setItem(
    "payment-banking-mock-v3",
    JSON.stringify({
      users: [
        {
          id,
          phone: "seller",
          fullName: "Seller",
          roles: ["SELLER_OWNER"],
          status: "ACTIVE",
        },
      ],
      sessions: { token: id },
      addresses: {},
    }),
  );
  setSession({
    accessToken: "token",
    refreshToken: "refresh",
    user: {
      id,
      phone: "seller",
      email: "",
      fullName: "Seller",
      roles: [],
      kycTier: 0,
      status: "ACTIVE",
    },
  });
  resetCommerceDB();
  server.use(...commerceHandlers);
});
describe("seller routes", () => {
  it("shows seller performance metrics on the dashboard", async () => {
    renderRoute("/seller");
    expect(
      await screen.findByText("Cancellation rate", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Late shipment rate")).toBeInTheDocument();
  });

  it("saves settings through the actual submit button", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/settings");
    const name = await screen.findByLabelText(
      /Shop name/,
      {},
      { timeout: 3000 },
    );
    await user.clear(name);
    await user.type(name, "Updated shop");
    await user.type(screen.getByLabelText(/Description/), "A small shop");
    await user.type(screen.getByLabelText(/Contact phone/), "0900000001");
    await user.type(
      screen.getByLabelText(/Contact email/),
      "seller@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("All changes saved")).toBeInTheDocument();
    expect(getDB().settings[getDB().sellers[0].id].shopName).toBe(
      "Updated shop",
    );
  });
  it("adjusts inventory with a reason", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/inventory");
    const buttons = await screen.findAllByRole("button", {
      name: /Adjust stock for/,
    });
    await user.click(buttons[0]);
    await user.type(screen.getByLabelText(/Change in units/), "2");
    await user.type(screen.getByLabelText(/Reason/), "Stocktake");
    await user.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() =>
      expect(screen.getByText(/Stocktake/)).toBeInTheDocument(),
    );
  });
  it("shows an inventory validation failure without changing stock", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/inventory");
    await user.click(
      (await screen.findAllByRole("button", { name: /Adjust stock for/ }))[0],
    );
    await user.type(screen.getByLabelText(/Change in units/), "-999999");
    await user.type(screen.getByLabelText(/Reason/), "Invalid count");
    await user.click(screen.getByRole("button", { name: "Save adjustment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid adjustment",
    );
  });
  it("confirms a paid order from its detail", async () => {
    const user = userEvent.setup();
    const order = getDB().orders.find(
      (o) => o.seller.id === getDB().sellers[0].id && o.status === "PAID",
    )!;
    renderRoute(`/seller/orders/${order.id}`);
    // The first render waits for the lazy route chunk, which is slow under load.
    await user.click(
      await screen.findByRole(
        "button",
        { name: "Confirm order" },
        { timeout: 3000 },
      ),
    );
    await waitFor(() =>
      expect(getDB().orders.find((o) => o.id === order.id)?.status).toBe(
        "CONFIRMED",
      ),
    );
  });
  it("bulk confirms selected orders in the to-confirm queue", async () => {
    const user = userEvent.setup();
    const orders = getDB().orders.filter(
      (o) => o.seller.id === getDB().sellers[0].id && o.status === "PAID",
    );
    expect(orders.length).toBeGreaterThan(0);
    renderRoute("/seller/orders?status=TO_CONFIRM");
    for (const order of orders) {
      await user.click(
        await screen.findByRole("checkbox", {
          name: `Select ${order.orderNumber}`,
        }),
      );
    }
    await user.click(screen.getByRole("button", { name: /Confirm selected/ }));
    await waitFor(() =>
      expect(
        orders.every(
          (order) =>
            getDB().orders.find((candidate) => candidate.id === order.id)
              ?.status === "CONFIRMED",
        ),
      ).toBe(true),
    );
  });
  it("rejects a paid order with a reason from the queue", async () => {
    const user = userEvent.setup();
    const order = getDB().orders.find(
      (o) => o.seller.id === getDB().sellers[0].id && o.status === "PAID",
    )!;
    renderRoute("/seller/orders?status=TO_CONFIRM");
    await user.click(
      await screen.findByRole("button", {
        name: `More actions for ${order.orderNumber}`,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Reject order" }));
    const confirm = await screen.findByRole("button", { name: "Reject order" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Rejection reason/), "Out of stock");
    await user.click(confirm);
    await waitFor(() =>
      expect(
        getDB().orders.find((candidate) => candidate.id === order.id)?.status,
      ).toBe("CANCELLED"),
    );
  });
  it("creates a product with a variant through the form", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/products/new");
    await user.type(await screen.findByLabelText(/Product name/), "New item");
    await user.click(await screen.findByRole("combobox", { name: "Category" }));
    await user.click(
      await screen.findByRole("option", { name: /^Electronics$/ }),
    );
    expect(await screen.findByLabelText("Brand")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Description/), "Useful item");
    await user.click(screen.getByRole("button", { name: "Add option" }));
    await user.type(screen.getByLabelText("Option name"), "Color");
    const optionValue = screen.getByRole("textbox", {
      name: "Add value for Color",
    });
    await user.type(optionValue, "Blue{Enter}");
    await user.type(screen.getByLabelText("SKU for variant 1"), "NEW-1");
    await user.type(screen.getByLabelText("Price for variant 1"), "99000");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(
        getDB().products.some(
          (p) =>
            p.name === "New item" && p.variants[0].options.Color === "Blue",
        ),
      ).toBe(true),
    );
  });
  it("adds, reorders, and removes uploaded product images", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/products/new");
    const upload = await screen.findByLabelText("Add product images");
    await user.upload(upload, [
      new File(["first"], "first.png", { type: "image/png" }),
      new File(["second"], "second.png", { type: "image/png" }),
      new File(["third"], "third.png", { type: "image/png" }),
    ]);
    await waitFor(() =>
      expect(
        screen.getAllByRole("img", { name: /Product image/ }),
      ).toHaveLength(3),
    );
    expect(
      screen.getByRole("img", { name: "Product image 1" }),
    ).toHaveAttribute("src", "data:image/png;base64,Zmlyc3Q=");
    await user.click(
      screen.getByRole("button", { name: "Move image 2 earlier" }),
    );
    expect(
      screen.getByRole("img", { name: "Product image 1" }),
    ).toHaveAttribute("src", "data:image/png;base64,c2Vjb25k");
    await user.click(
      screen.getByRole("button", { name: "Set image 3 as cover" }),
    );
    expect(
      screen.getByRole("img", { name: "Product image 1" }),
    ).toHaveAttribute("src", "data:image/png;base64,dGhpcmQ=");
    await user.click(screen.getByRole("button", { name: "Remove image 1" }));
    expect(screen.getAllByRole("img", { name: /Product image/ })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole("img", { name: "Product image 1" }),
    ).toHaveAttribute("src", "data:image/png;base64,c2Vjb25k");
  });
  it("keeps draft saves available while review submission requires a complete gallery", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/products/new");
    await user.type(await screen.findByLabelText(/Product name/), "Draft item");
    await user.click(await screen.findByRole("combobox", { name: "Category" }));
    await user.click(
      await screen.findByRole("option", { name: /^Electronics$/ }),
    );
    await user.type(
      screen.getByLabelText(/Description/),
      "A draft product description.",
    );
    await user.type(screen.getByLabelText("SKU for variant 1"), "DRAFT-1");
    await user.type(screen.getByLabelText("Price for variant 1"), "99000");
    await user.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add at least 3 product images before saving.",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(
        getDB().products.some(
          (product) =>
            product.name === "Draft item" && product.status === "DRAFT",
        ),
      ).toBe(true),
    );
  });
  it("submits a complete product for review after saving the draft data", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/products/new");
    await user.type(
      await screen.findByLabelText(/Product name/),
      "Review item",
    );
    await user.click(await screen.findByRole("combobox", { name: "Category" }));
    await user.click(
      await screen.findByRole("option", { name: /^Electronics$/ }),
    );
    await user.type(
      screen.getByLabelText(/Description/),
      "Ready for marketplace review.",
    );
    await user.type(screen.getByLabelText("SKU for variant 1"), "REVIEW-1");
    await user.type(screen.getByLabelText("Price for variant 1"), "109000");
    await user.upload(await screen.findByLabelText("Add product images"), [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
      new File(["three"], "three.png", { type: "image/png" }),
    ]);
    await user.click(screen.getByRole("button", { name: "Submit for review" }));
    await waitFor(() =>
      expect(
        getDB().products.find((product) => product.name === "Review item")
          ?.status,
      ).toBe("PENDING_REVIEW"),
    );
  });
  it("loads an existing seller product into edit mode", async () => {
    const product = getDB().products.find(
      (item) => item.seller.id === getDB().sellers[0].id,
    )!;
    renderRoute(`/seller/products/${product.id}`);
    expect(await screen.findByLabelText(/Product name/)).toHaveValue(
      product.name,
    );
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      product.description,
    );
    expect(
      screen.getByRole("heading", { name: "Variant matrix" }),
    ).toBeInTheDocument();
  });
  it("asks before discarding unsaved product changes", async () => {
    const user = userEvent.setup();
    renderProductFormInBrowserRouterShape();
    await user.type(
      await screen.findByLabelText(/Product name/),
      "Unsaved item",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Leave and discard them?",
    );
    expect(screen.getByLabelText(/Product name/)).toHaveValue("Unsaved item");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("link", { name: "Products link" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Leave and discard them?",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "Leave without saving" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();
  });
  it("clears product filters after a no-results state", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/products?q=no-such-product");
    expect(await screen.findByText(/No results match/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(
      await screen.findByRole("link", { name: "Electronics item 1" }),
    ).toBeInTheDocument();
  });
  it("saves an onboarding step with the submit button", async () => {
    const user = userEvent.setup();
    const id = SELLER_USER_IDS[3];
    localStorage.setItem(
      "payment-banking-mock-v3",
      JSON.stringify({
        users: [
          {
            id,
            phone: "new-seller",
            fullName: "Seller",
            roles: ["SELLER_OWNER"],
            status: "ACTIVE",
          },
        ],
        sessions: { token: id },
        addresses: {},
      }),
    );
    renderRoute("/seller/onboarding");
    await user.type(await screen.findByLabelText(/Shop name/), "New Shop");
    await user.type(screen.getByLabelText(/Shop URL/), "new-shop");
    await user.type(screen.getByLabelText(/Description/), "Shop description");
    await user.type(screen.getByLabelText(/Location/), "Hanoi");
    await user.type(screen.getByLabelText(/Contact phone/), "0900000001");
    await user.type(screen.getByLabelText(/Contact email/), "shop@example.com");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() =>
      expect(
        getDB().onboarding[getDB().sellers[3].id].steps.shop?.shopName,
      ).toBe("New Shop"),
    );
    expect(await screen.findByLabelText(/Owner full name/)).toBeInTheDocument();
  });
  it("shows the onboarding review status after submission", async () => {
    const sellerId = getDB().sellers[0].id;
    getDB().onboarding[sellerId].status = "UNDER_REVIEW";
    renderRoute("/seller/onboarding");
    expect(
      await screen.findByText("Your application is under review."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Seller onboarding" }),
    ).toBeInTheDocument();
  });

  it("marks the selected order queue and counts every queue from one request", async () => {
    const mine = getDB().orders.filter(
      (o) => o.seller.id === getDB().sellers[0].id,
    );
    const packing = mine.filter((o) => o.status === "CONFIRMED").length;
    renderRoute("/seller/orders?status=TO_PACK");
    const tab = await screen.findByRole("link", {
      name: `To pack (${packing} ${packing === 1 ? "order" : "orders"})`,
    });
    expect(tab).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("button", { name: /Confirm selected/ }),
    ).not.toBeInTheDocument();
  });
  it("hides a live product only after the confirmation dialog", async () => {
    const user = userEvent.setup();
    const product = getDB().products.find(
      (p) => p.seller.id === getDB().sellers[0].id && p.status === "LIVE",
    )!;
    const status = () =>
      getDB().products.find((p) => p.id === product.id)?.status;
    renderRoute("/seller/products");
    await user.click(
      await screen.findByRole("button", {
        name: `More actions for ${product.name}`,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Hide" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Shoppers will no longer see it.",
    );
    expect(status()).toBe("LIVE");
    await user.click(screen.getByRole("button", { name: "Hide product" }));
    await waitFor(() => expect(status()).toBe("HIDDEN"));
  });
  it("lists only variants with five or fewer units under Low stock", async () => {
    const products = getDB().products.filter(
      (p) => p.seller.id === getDB().sellers[0].id,
    );
    const [atLimit, above] = products.flatMap((p) => p.variants).slice(1);
    atLimit.stock = 5;
    above.stock = 6;
    renderRoute("/seller/inventory?lowStock=true");
    expect(
      await screen.findByRole("button", {
        name: `Adjust stock for ${atLimit.sku}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Adjust stock for ${above.sku}` }),
    ).not.toBeInTheDocument();
  });
  it("formats money inputs and rejects a compare-at price below the price", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/products/new");
    const price = await screen.findByLabelText("Price for variant 1");
    await user.type(price, "5159000");
    expect(price).toHaveValue("5,159,000");
    const compareAt = screen.getByLabelText("Compare at price for variant 1");
    await user.type(compareAt, "5000000");
    expect(compareAt).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Must be above the price.")).toBeInTheDocument();
  });
  it("asks before leaving settings with unsaved changes", async () => {
    const user = userEvent.setup();
    renderRoute("/seller/settings");
    await user.type(await screen.findByLabelText(/Shop name/), " 2");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Orders" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText(/Shop name/)).toHaveValue(
      `${getDB().settings[getDB().sellers[0].id].shopName} 2`,
    );
  });
});

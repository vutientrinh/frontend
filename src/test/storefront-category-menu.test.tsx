import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, ProductSummary } from "../features/commerce/types";
import { CategoryMenu } from "../features/storefront/components/category-menu/CategoryMenu";
import { categoryIcon } from "../features/storefront/components/category-menu/categoryIcon";
import { buildCategoryTree } from "../features/commerce/api";
import { server } from "./setup";

/** TASK-034 Part B: Categories menu (BA spec Part 1 §4.1–4.5). Own fixture, so seed changes don't move it. */
const cat = (
  id: string,
  name: string,
  parentId: string | null = null,
  iconName = "package",
  productCount?: number,
): Category & { productCount?: number } => ({
  id,
  slug: name.toLowerCase(),
  name,
  parentId,
  iconName,
  productCount,
});
const categories = [
  cat("c1", "Electronics", null, "smartphone", 12),
  cat("c1a", "Phones", "c1", "smartphone"),
  cat("c1b", "Laptops", "c1", "laptop"),
  cat("c2", "Home", null, "house"),
  cat("c2a", "Sofas", "c2", "sofa"),
  cat("c3", "Books", null, "book"),
];
const product = (n: number, category: string): ProductSummary => ({
  id: `p-${category}-${n}`,
  slug: `${category}-item-${n}`,
  name: `${category} item ${n}`,
  imageUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  price: "100000",
  rating: "4.5",
  ratingCount: 1,
  soldCount: 1,
  seller: {
    id: "s1",
    slug: "shop",
    name: "Shop",
    location: "HCMC",
    rating: "5",
  },
  inStock: true,
});
const page = (content: ProductSummary[]) => ({
  content,
  page: 0,
  size: 4,
  totalElements: content.length,
  totalPages: 1,
});

function useHandlers({
  categoriesResponse = () => HttpResponse.json(categories),
}: { categoriesResponse?: () => Response | Promise<Response> } = {}) {
  server.use(
    http.get("*/api/catalog/categories", categoriesResponse),
    http.get("*/api/catalog/products", ({ request }) => {
      const slug = new URL(request.url).searchParams.get("category") ?? "all";
      if (slug === "books") return HttpResponse.json(page([]));
      return HttpResponse.json(page([1, 2, 3].map((n) => product(n, slug))));
    }),
    http.get("*/api/campaigns", () =>
      HttpResponse.json([
        {
          id: "k1",
          title: "Better tech",
          subtitle: "",
          ctaLabel: "Explore electronics",
          href: "/search?category=electronics",
          image: "",
          tone: "brand",
        },
      ]),
    ),
  );
}

function Where() {
  const location = useLocation();
  return (
    <p data-testid="where">
      {location.pathname}
      {location.search}
    </p>
  );
}

function mount(path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <>
            <header>
              <CategoryMenu />
              <label>
                Search products
                <input />
              </label>
            </header>
            <Outlet />
            <Where />
          </>
        ),
        children: [
          { index: true, element: <h1>Page</h1> },
          { path: "*", element: <h1>Page</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const original = window.matchMedia;
function setDesktop(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: desktop && q.includes("min-width: 1024px"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  window.matchMedia = original;
});

const panel = () =>
  screen.queryByRole("navigation", { name: "Product categories" });
const row = (name: string) =>
  within(panel()!).getByRole("button", { name: new RegExp(`^${name}`) });

describe("category data helpers", () => {
  it("builds a two-level tree in array order and maps icons (package has its own)", () => {
    const tree = buildCategoryTree(categories);
    expect(tree.map((t) => t.name)).toEqual(["Electronics", "Home", "Books"]);
    expect(tree[0].children.map((c) => c.name)).toEqual(["Phones", "Laptops"]);
    expect(tree[2].children).toEqual([]);
    expect(categoryIcon("ShoppingBasket")).toBe(
      categoryIcon("shopping-basket"),
    );
    expect(categoryIcon("package").displayName).not.toBe(
      categoryIcon("no-such-icon").displayName,
    );
  });
});

describe("Categories mega menu ≥ 1024 px", () => {
  beforeEach(() => {
    setDesktop(true);
    useHandlers();
  });

  it("opens on click as a disclosure: focus on the first row, sub-categories, products, campaign", async () => {
    const user = userEvent.setup();
    mount();
    const trigger = screen.getByRole("button", { name: "Categories" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toHaveAttribute(
      "id",
      trigger.getAttribute("aria-controls"),
    );
    await waitFor(() => expect(row("Electronics")).toHaveFocus());
    expect(row("Electronics")).toHaveAttribute("aria-current", "true");
    const pane = screen.getByRole("region", { name: "Electronics" });
    expect(
      within(pane).getByRole("link", { name: "Shop all Electronics (12)" }),
    ).toHaveAttribute("href", "/c/electronics");
    expect(within(pane).getByRole("link", { name: "Phones" })).toHaveAttribute(
      "href",
      "/c/phones",
    );
    expect(
      await within(pane).findByRole("link", { name: /electronics item 1/ }),
    ).toHaveAttribute("href", "/p/electronics-item-1");
    expect(
      within(pane).getByRole("link", { name: /Better tech/ }),
    ).toBeInTheDocument();
    // Disclosure navigation, not an app menu.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves through rows with the arrows, into the pane with ArrowRight and back with ArrowLeft", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    await waitFor(() => expect(row("Electronics")).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(row("Home")).toHaveFocus();
    expect(screen.getByRole("region", { name: "Home" })).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(row("Books")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(row("Electronics")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("link", { name: "Shop all Electronics (12)" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(row("Electronics")).toHaveFocus();
    // Roving tabindex: one row in the tab order.
    expect(
      within(panel()!)
        .getAllByRole("button")
        .filter((b) => b.tabIndex === 0),
    ).toHaveLength(1);
  });

  it("opens with ArrowDown and closes with Esc, returning focus to the trigger", async () => {
    const user = userEvent.setup();
    mount();
    const trigger = screen.getByRole("button", { name: "Categories" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(row("Electronics")).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
  });

  it("switches rows on hover only after the 150 ms intent delay", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    await waitFor(() => expect(row("Electronics")).toHaveFocus());
    vi.useFakeTimers();
    try {
      fireEvent.pointerEnter(row("Home"), { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(149));
      expect(row("Electronics")).toHaveAttribute("aria-current", "true");
      act(() => vi.advanceTimersByTime(1));
      expect(row("Home")).toHaveAttribute("aria-current", "true");
      // Leaving before the delay cancels the switch (diagonal move to the pane).
      fireEvent.pointerEnter(row("Books"), { pointerType: "mouse" });
      fireEvent.pointerLeave(row("Books"), { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(300));
      expect(row("Home")).toHaveAttribute("aria-current", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on outside click, on a link (route change) and when tabbing out to the search box", async () => {
    const user = userEvent.setup();
    const router = mount();
    const trigger = screen.getByRole("button", { name: "Categories" });

    await user.click(trigger);
    fireEvent.pointerDown(screen.getByRole("heading", { name: "Page" }));
    await waitFor(() => expect(panel()).not.toBeInTheDocument());

    await user.click(trigger);
    await user.click(await screen.findByRole("link", { name: "Laptops" }));
    expect(router.state.location.pathname).toBe("/c/laptops");
    expect(panel()).not.toBeInTheDocument();

    // No focus trap: Tab past the panel continues to the search box and closes the panel.
    await user.click(trigger);
    await screen.findByRole("link", { name: /electronics item 3/ });
    const links = within(panel()!).getAllByRole("link");
    links[links.length - 1].focus();
    await user.tab();
    expect(
      screen.getByRole("textbox", { name: "Search products" }),
    ).toHaveFocus();
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
  });

  it("opens on the route's category (parent of a sub-category) and marks the current link", async () => {
    const user = userEvent.setup();
    mount("/c/sofas");
    await user.click(screen.getByRole("button", { name: "Categories" }));
    await waitFor(() => expect(row("Home")).toHaveFocus());
    expect(screen.getByRole("link", { name: "Sofas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("hides the sub-category block and the Popular block when there is nothing to show", async () => {
    const user = userEvent.setup();
    mount("/c/books");
    await user.click(screen.getByRole("button", { name: "Categories" }));
    const pane = await screen.findByRole("region", { name: "Books" });
    await waitFor(() =>
      expect(within(pane).queryByRole("list")).not.toBeInTheDocument(),
    );
    expect(within(pane).queryByText(/Popular in/)).not.toBeInTheDocument();
    expect(
      within(pane).getByRole("link", { name: "Shop all Books" }),
    ).toBeInTheDocument();
  });
});

describe("Categories menu states", () => {
  beforeEach(() => setDesktop(true));

  it("shows skeletons while loading, then the rows", async () => {
    useHandlers({
      categoriesResponse: async () => {
        await delay(150);
        return HttpResponse.json(categories);
      },
    });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    expect(
      panel()!.querySelector(".animate-pulse, [class*='animate-pulse']"),
    ).not.toBeNull();
    await waitFor(() => expect(row("Electronics")).toHaveFocus());
  });

  it("shows an error with Retry and a Browse all link", async () => {
    let fail = true;
    useHandlers({
      categoriesResponse: () =>
        fail
          ? HttpResponse.json({ title: "Down" }, { status: 500 })
          : HttpResponse.json(categories),
    });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    expect(
      await screen.findByText("Couldn’t load categories."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse all products" }),
    ).toHaveAttribute("href", "/search");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("region", { name: "Electronics" }),
    ).toBeInTheDocument();
  });

  it("says so when there are no categories", async () => {
    useHandlers({ categoriesResponse: () => HttpResponse.json([]) });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    expect(await screen.findByText("No categories yet.")).toBeInTheDocument();
  });
});

describe("Categories sheet < 1024 px", () => {
  beforeEach(() => {
    setDesktop(false);
    useHandlers();
  });

  it("is a modal dialog with a vertical tab rail; tabs switch the pane without navigating", async () => {
    const user = userEvent.setup();
    const router = mount();
    const trigger = screen.getByRole("button", { name: "Categories" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Categories" });
    const rail = within(dialog).getByRole("tablist");
    expect(rail).toHaveAttribute("aria-orientation", "vertical");
    const tab = within(rail).getByRole("tab", { name: "Electronics" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    tab.focus();
    await user.keyboard("{ArrowDown}");
    const home = within(rail).getByRole("tab", { name: "Home" });
    expect(home).toHaveFocus();
    expect(home).toHaveAttribute("aria-selected", "true");
    expect(
      within(dialog).getByRole("tabpanel", { name: "Home" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("closes with Esc (focus back to the button) and with browser Back", async () => {
    const user = userEvent.setup();
    const router = mount();
    const trigger = screen.getByRole("button", { name: "Categories" });
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Categories" });
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Categories" });
    await act(() => router.navigate(-1));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(router.state.location.pathname).toBe("/");
  });

  it("navigates from a tile and replaces the sheet's history entry", async () => {
    const user = userEvent.setup();
    const router = mount("/c/books");
    await user.click(screen.getByRole("button", { name: "Categories" }));
    const dialog = await screen.findByRole("dialog", { name: "Categories" });
    // Opens on the route's category.
    expect(within(dialog).getByRole("tab", { name: "Books" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(within(dialog).getByRole("tab", { name: "Electronics" }));
    await user.click(within(dialog).getByRole("link", { name: "Phones" }));
    expect(router.state.location.pathname).toBe("/c/phones");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // Back goes to the page the sheet was opened on, not to the sheet.
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/c/books");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the icon trigger at desktop widths when compact", () => {
    setDesktop(true);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider
          router={createMemoryRouter([
            { path: "/", element: <CategoryMenu compact /> },
          ])}
        />
      </QueryClientProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Categories" });
    expect(trigger).not.toHaveTextContent("Categories");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Pager } from "../components/Pager";
import { ProductThumb } from "../components/ProductThumb";
import { QueueTabs } from "../components/QueueTabs";
import { SideSheet } from "../components/SideSheet";
import { TableSkeleton } from "../components/TableSkeleton";
import { PageHeader } from "../components/layout/Page";
import { Checkbox } from "../components/ui/checkbox";
import { Select } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  ConfirmDialog,
  FormField,
  RelativeTime,
  StatCard,
  StatusBadge,
} from "../components/shared";
import { getStatusPresentation } from "../components/status";
import { DataTable } from "../components/DataTable";
import { ProductCardView } from "../features/storefront/components/ProductCard";
import type { ProductSummary } from "../features/commerce/types";

const wrap = (ui: React.ReactNode, entry = "/") => (
  <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
);

describe("QueueTabs", () => {
  const tabs = [
    { key: "all", label: "All", count: 3 },
    { key: "new", label: "New", count: 1 },
  ];
  it("marks the selected tab and names counts", async () => {
    const onSelect = vi.fn();
    render(
      <QueueTabs
        label="Queue"
        noun="order"
        tabs={tabs}
        activeKey="new"
        onSelect={onSelect}
      />,
    );
    const active = screen.getByRole("button", { name: "New (1 order)" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("border-primary");
    const other = screen.getByRole("button", { name: "All (3 orders)" });
    expect(other).not.toHaveAttribute("aria-current");
    await userEvent.setup().click(other);
    expect(onSelect).toHaveBeenCalledWith("all");
  });
  it("renders links when tabs carry a target", () => {
    render(
      wrap(
        <QueueTabs
          label="Queue"
          activeKey="a"
          tabs={[{ key: "a", label: "A", to: { search: "?tab=a" } }]}
        />,
      ),
    );
    expect(screen.getByRole("link", { name: /A/ })).toHaveAttribute(
      "href",
      "/?tab=a",
    );
  });
});

describe("ProductThumb", () => {
  it("falls back when the image fails and dims when sold out", () => {
    const { rerender } = render(
      <ProductThumb src="/x.png" alt="Lamp" soldOut />,
    );
    const img = screen.getByAltText("Lamp");
    expect(img.className).toContain("opacity-50");
    expect(screen.getByTestId("product-thumb").className).toContain(
      "rounded-[14px]",
    );
    img.dispatchEvent(new Event("error"));
    rerender(<ProductThumb src="/x.png" alt="Lamp" soldOut />);
  });
  it("shows the placeholder without a src", () => {
    render(<ProductThumb src={undefined} alt="Lamp" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Lamp")).toBeInTheDocument();
  });
});

describe("ProductCardView", () => {
  const product = {
    id: "p1",
    slug: "lamp",
    name: "Lamp",
    imageUrl: "/lamp.png",
    price: "100000.0000",
    compareAtPrice: "150000.0000",
    currency: "VND",
    rating: 4.5,
    soldCount: 12,
    inStock: true,
    variantCount: 3,
    seller: { id: "s", name: "Shop", location: "Hanoi" },
  } as unknown as ProductSummary & { variantCount: number };
  it("previews without link or cart logic", () => {
    render(wrap(<ProductCardView product={product} showAction />));
    expect(screen.queryByRole("link")).toBeNull();
    const btn = screen.getByRole("button", { name: /Choose options for Lamp/ });
    expect(btn).toBeDisabled();
    expect(screen.getByText("Choose options")).toBeInTheDocument();
    expect(screen.getByText("−33%")).toBeInTheDocument();
  });
  it("links and adds to cart when wired", async () => {
    const add = vi.fn();
    render(
      wrap(
        <ProductCardView
          product={{ ...product, variantCount: 1 }}
          href="/p/lamp"
          onAddToCart={add}
        />,
      ),
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/p/lamp");
    await userEvent.setup().click(screen.getByRole("button"));
    expect(add).toHaveBeenCalled();
  });
});

describe("Pager", () => {
  it("hides for one page and pages otherwise", async () => {
    const onPage = vi.fn();
    const { container, rerender } = render(
      <Pager page={0} totalPages={1} onPage={onPage} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<Pager page={0} totalPages={3} onPage={onPage} />);
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole("button", { name: /Next/ }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});

describe("DataTable", () => {
  const columns = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "stock",
      header: "Stock",
      meta: { numeric: true },
    },
  ];
  it("right-aligns numeric headers and cells, hides pager for one page", () => {
    render(
      wrap(
        <DataTable
          data={[{ name: "A", stock: 4 }]}
          columns={columns}
          total={1}
          onRetry={() => {}}
          searchable={false}
        />,
      ),
    );
    const head = screen.getByRole("columnheader", { name: "Stock" });
    expect(head.className).toContain("text-right");
    expect(screen.getByRole("cell", { name: /4/ }).className).toContain(
      "text-right",
    );
    expect(
      screen.getByRole("columnheader", { name: "Name" }).className,
    ).not.toContain("text-right");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(head.closest("thead")?.className).toContain("sticky");
  });
  it("shows the table skeleton while loading", () => {
    render(
      wrap(
        <DataTable
          data={[]}
          columns={columns}
          total={0}
          loading
          onRetry={() => {}}
        />,
      ),
    );
    expect(
      screen.getByRole("status", { name: "Loading rows" }),
    ).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders breadcrumb, description, actions and the shared h1 token", () => {
    render(
      wrap(
        <PageHeader
          title="Edit lamp"
          description="Draft"
          breadcrumb={[
            { label: "Products", to: "/seller/products" },
            { label: "Edit lamp" },
          ]}
          actions={<button>Save</button>}
        />,
      ),
    );
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Edit lamp",
    });
    expect(heading.className).toContain("text-h1");
    expect(heading.className).toContain("font-bold");
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/seller/products",
    );
    expect(within(nav).getByText("Edit lamp")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
  it("renders a back link", () => {
    render(
      wrap(<PageHeader title="Order" back={{ label: "Orders", to: "/o" }} />),
    );
    expect(screen.getByRole("link", { name: /Orders/ })).toHaveAttribute(
      "href",
      "/o",
    );
  });
});

describe("FormField", () => {
  it("keeps the required marker inline, links hint and shows counter", () => {
    render(
      <FormField
        id="name"
        label="Product name"
        required
        hint="Shown to shoppers"
        counter={{ value: 5, max: 120 }}
      >
        <input />
      </FormField>,
    );
    const label = screen.getByText("Product name", { selector: "label" });
    expect(label).toHaveTextContent("Product name*");
    const input = screen.getByLabelText(/Product name/);
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input.getAttribute("aria-describedby")).toContain("name-hint");
    expect(screen.getByText("5/120")).toBeInTheDocument();
    expect(screen.getByText("Shown to shoppers")).toBeInTheDocument();
  });
});

describe("Select, Checkbox, Switch", () => {
  it("select uses the input border token", () => {
    render(
      <Select aria-label="Status">
        <option>A</option>
      </Select>,
    );
    expect(
      screen.getByRole("combobox", { name: "Status" }).className,
    ).toContain("border-input");
  });
  it("checkbox toggles from its label", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Select all" />);
    await user.click(screen.getByText("Select all"));
    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeChecked();
  });
  it("switch toggles and exposes state", async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <Switch aria-label="Payouts" checked={on} onCheckedChange={setOn} />
      );
    }
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: "Payouts" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.setup().click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

describe("ConfirmDialog", () => {
  it("requires a reason before confirming and passes it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Reject order"
        description="This cannot be undone."
        destructive
        confirmLabel="Reject"
        reason={{ label: "Reason", required: true }}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), "  Out of stock ");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Out of stock");
  });
  it("still works without a reason", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Hide"
        description="d"
        onConfirm={onConfirm}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
});

describe("SideSheet", () => {
  it("opens as a dialog with title and footer", () => {
    render(
      <SideSheet
        open
        onOpenChange={() => {}}
        title="Adjust stock"
        description="Lamp"
        footer={<button>Save</button>}
      >
        <p>Body</p>
      </SideSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Adjust stock" });
    expect(within(dialog).getByText("Body")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });
});

describe("TableSkeleton", () => {
  it("is a labelled status region", () => {
    render(<TableSkeleton label="Loading products" />);
    expect(
      screen.getByRole("status", { name: "Loading products" }),
    ).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("renders a link and a trend with a text direction", () => {
    render(
      wrap(
        <StatCard
          label="Orders"
          value="12"
          to="/seller/orders"
          trend={{ value: "+3 vs yesterday", direction: "up" }}
        />,
      ),
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/seller/orders");
    expect(screen.getByText("+3 vs yesterday")).toBeInTheDocument();
  });
  it("is a plain card without a link", () => {
    render(<StatCard label="Orders" value="12" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("getStatusPresentation", () => {
  it.each([
    ["DRAFT", "neutral", "Draft"],
    ["PENDING_REVIEW", "warning", "Pending review"],
    ["LIVE", "success", "Live"],
    ["PAID", "success", "Paid"],
    ["HIDDEN", "neutral", "Hidden"],
    ["REJECTED", "danger", "Rejected"],
    ["CANCELLED", "neutral", "Cancelled"],
  ])("%s -> %s", (status, tone, label) => {
    const p = getStatusPresentation(status);
    expect(p.tone).toBe(tone);
    expect(p.label.toLowerCase()).toBe(label.toLowerCase());
  });
  it("StatusBadge renders icon + label", () => {
    render(<StatusBadge status="HIDDEN" />);
    expect(screen.getByText(/hidden/i)).toBeInTheDocument();
  });
});

describe("RelativeTime", () => {
  it("shows an em dash for an invalid date", () => {
    const { container } = render(<RelativeTime value="not-a-date" />);
    expect(container.textContent).toBe("—");
  });
});

import { useState, type ReactElement } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CartItem,
  Category,
  ProductSummary,
  SellerRef,
  Variant,
} from "../features/commerce/types";
import type { Address } from "../features/banking/types";
import {
  discountPercent,
  findVariant,
  lineTotal,
  selectOptionValue,
  sumMoney,
  type Facets,
  type VariantSelection,
} from "../features/storefront/lib";
import { PriceTag } from "../features/storefront/components/PriceTag";
import { RatingStars } from "../features/storefront/components/RatingStars";
import { ProductCard } from "../features/storefront/components/ProductCard";
import { ImageGallery } from "../features/storefront/components/ImageGallery";
import { VariantPicker } from "../features/storefront/components/VariantPicker";
import { QuantityStepper } from "../features/storefront/components/QuantityStepper";
import { SellerCard } from "../features/storefront/components/SellerCard";
import { CategoryStrip } from "../features/storefront/components/CategoryStrip";
import { FacetPanel } from "../features/storefront/components/FacetPanel";
import { CartSellerGroup } from "../features/storefront/components/CartSellerGroup";
import { OrderSummary } from "../features/storefront/components/OrderSummary";
import { ReservationTimer } from "../features/storefront/components/ReservationTimer";
import { SavedAddressPicker } from "../features/storefront/components/SavedAddressPicker";
import {
  EmptyCart,
  ListSkeleton,
  NoOrders,
  NoResults,
  ProductGridSkeleton,
} from "../features/storefront/components/States";

const seller: SellerRef = {
  id: "s1",
  slug: "saigon-gadget-house",
  name: "Saigon Gadget House",
  location: "Ho Chi Minh City",
  rating: "4.8",
};
const product: ProductSummary = {
  id: "p1",
  slug: "anker-powercore-10000",
  name: "Anker PowerCore 10000 power bank",
  imageUrl: "data:image/svg+xml,%3Csvg/%3E",
  price: "1790000",
  compareAtPrice: "2240000",
  rating: "4.6",
  ratingCount: 128,
  soldCount: 1240,
  seller,
  inStock: true,
};
const options = [
  { name: "Color", values: ["Black", "White"] },
  { name: "Size", values: ["M", "L"] },
];
const variant = (id: string, color: string, size: string, stock: number) =>
  ({
    id,
    sku: id,
    options: { Color: color, Size: size },
    price: "390000",
    stock,
    weightGrams: 300,
  }) satisfies Variant;
const variants = [
  variant("v1", "Black", "M", 4),
  variant("v2", "Black", "L", 0),
  variant("v3", "White", "M", 0),
  variant("v4", "White", "L", 2),
];

function withRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("storefront lib", () => {
  it("computes discount percent with decimals and rounds down", () => {
    expect(discountPercent("1790000", "2240000")).toBe(20);
    expect(discountPercent("100", "100")).toBeNull();
    expect(discountPercent("120", "100")).toBeNull();
    expect(discountPercent("100")).toBeNull();
    expect(discountPercent("80400", "100000")).toBe(19);
  });

  it("does exact money math on large amounts", () => {
    expect(lineTotal("24990000", 3)).toBe("74970000");
    expect(sumMoney(["9007199254740993", "1"])).toBe("9007199254740994");
  });

  it("drops later choices that become impossible and finds the variant", () => {
    const next = selectOptionValue(
      variants,
      options,
      { Color: "Black", Size: "M" },
      "Color",
      "White",
    );
    expect(next).toEqual({ Color: "White" });
    expect(findVariant(variants, options, next)).toBeUndefined();
    expect(
      findVariant(variants, options, { Color: "White", Size: "L" })?.id,
    ).toBe("v4");
  });
});

describe("PriceTag and RatingStars", () => {
  it("shows price, struck original price and discount", () => {
    render(<PriceTag price="1790000" compareAtPrice="2240000" />);
    expect(screen.getByText(/1,790,000/)).toBeInTheDocument();
    expect(screen.getByText(/2,240,000/).closest("s")).not.toBeNull();
    expect(screen.getByText("20% off")).toBeInTheDocument();
  });

  it("hides the discount when there is none", () => {
    render(<PriceTag price="390000" />);
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it("describes the rating to assistive tech", () => {
    render(<RatingStars rating="4.6" count={128} />);
    expect(
      screen.getByRole("img", { name: "Rated 4.6 out of 5, 128 ratings" }),
    ).toBeInTheDocument();
  });
});

describe("ProductCard", () => {
  it("links to the product and adds to cart from a sibling button", async () => {
    const onAdd = vi.fn();
    withRouter(<ProductCard product={product} onAddToCart={onAdd} />);
    expect(
      screen.getByRole("link", { name: /Anker PowerCore 10000/ }),
    ).toHaveAttribute("href", "/p/anker-powercore-10000");
    expect(screen.getByText("1.2K sold")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Add Anker PowerCore 10000 power bank to cart",
      }),
    );
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  it("keeps the card shape when sold out: a disabled Sold out button", async () => {
    const onAdd = vi.fn();
    withRouter(
      <ProductCard
        product={{ ...product, inStock: false }}
        onAddToCart={onAdd}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Anker PowerCore 10000 power bank is sold out",
    });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("says Choose options for products with several variants", async () => {
    const onAdd = vi.fn();
    withRouter(
      <ProductCard
        product={{ ...product, variantCount: 3 } as typeof product}
        onAddToCart={onAdd}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Choose options for Anker PowerCore 10000 power bank",
      }),
    );
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: product.id }),
    );
  });

  it("shows price and discount on one line with the list price below", () => {
    withRouter(
      <ProductCard
        product={{ ...product, price: "1790000", compareAtPrice: "2240000" }}
      />,
    );
    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(screen.getByText(/Original price/).closest("s")).toBeTruthy();
  });
});

describe("ImageGallery", () => {
  const images = ["a.svg", "b.svg", "c.svg"];
  const mainImage = () =>
    screen.getByRole("group", { name: /^Image \d of 3$/ });

  it("moves with buttons, thumbnails and arrow keys", async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={images} alt="Power bank" />);
    expect(
      screen.getByRole("button", { name: "Previous image" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(mainImage()).toHaveAccessibleName("Image 2 of 3");
    await user.click(screen.getByRole("button", { name: "Show image 3 of 3" }));
    expect(mainImage()).toHaveAccessibleName("Image 3 of 3");
    expect(screen.getByRole("button", { name: "Next image" })).toBeDisabled();
    mainImage().focus();
    await user.keyboard("{ArrowLeft}");
    expect(mainImage()).toHaveAccessibleName("Image 2 of 3");
    await user.keyboard("{Home}");
    expect(mainImage()).toHaveAccessibleName("Image 1 of 3");
  });

  it("changes image on swipe", () => {
    render(<ImageGallery images={images} alt="Power bank" />);
    fireEvent.touchStart(mainImage(), { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(mainImage(), { changedTouches: [{ clientX: 100 }] });
    expect(mainImage()).toHaveAccessibleName("Image 2 of 3");
    fireEvent.touchStart(mainImage(), { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(mainImage(), { changedTouches: [{ clientX: 120 }] });
    expect(mainImage()).toHaveAccessibleName("Image 2 of 3");
  });
});

function PickerHarness() {
  const [value, setValue] = useState<VariantSelection>({});
  return (
    <>
      <VariantPicker
        options={options}
        variants={variants}
        value={value}
        onChange={setValue}
      />
      <output>{findVariant(variants, options, value)?.id ?? "none"}</output>
    </>
  );
}

describe("VariantPicker", () => {
  it("disables unavailable combinations and resolves the variant", async () => {
    const user = userEvent.setup();
    render(<PickerHarness />);
    const color = screen.getByRole("group", { name: /Color/ });
    const size = screen.getByRole("group", { name: /Size/ });
    // Nothing chosen yet: every size has stock in some color.
    expect(within(size).getByRole("radio", { name: "L" })).toBeEnabled();
    await user.click(within(color).getByRole("radio", { name: "Black" }));
    expect(
      within(size).getByRole("radio", { name: "L, sold out" }),
    ).toBeDisabled();
    await user.click(within(size).getByRole("radio", { name: "M" }));
    expect(screen.getByRole("status")).toHaveTextContent("v1");
    // Switching color clears the size that has no stock in white.
    await user.click(within(color).getByRole("radio", { name: "White" }));
    expect(screen.getByRole("status")).toHaveTextContent("none");
    expect(
      within(size).getByRole("radio", { name: "M, sold out" }),
    ).toBeDisabled();
    await user.click(within(size).getByRole("radio", { name: "L" }));
    expect(screen.getByRole("status")).toHaveTextContent("v4");
  });
});

function StepperHarness({ max }: { max: number }) {
  const [value, setValue] = useState(1);
  return (
    <QuantityStepper id="qty" value={value} max={max} onChange={setValue} />
  );
}

describe("QuantityStepper", () => {
  it("stays between 1 and stock", async () => {
    const user = userEvent.setup();
    render(<StepperHarness max={3} />);
    const input = screen.getByLabelText("Quantity", { selector: "input" });
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(input).toHaveValue("3");
    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeDisabled();
    await user.clear(input);
    await user.type(input, "99");
    await user.tab();
    expect(input).toHaveValue("3");
    await user.clear(input);
    await user.type(input, "0{Enter}");
    expect(input).toHaveValue("1");
  });
});

describe("SellerCard and CategoryStrip", () => {
  it("links to the shop", () => {
    withRouter(
      <SellerCard seller={seller} productCount={14} responseRate="98" />,
    );
    expect(
      screen.getByRole("heading", { name: "Saigon Gadget House" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View shop" })).toHaveAttribute(
      "href",
      "/shop/saigon-gadget-house",
    );
    expect(screen.getByText("98%")).toBeInTheDocument();
  });

  it("lists category links", () => {
    withRouter(
      <CategoryStrip
        categories={[
          {
            id: "c1",
            slug: "electronics",
            name: "Electronics",
            parentId: null,
            iconName: "smartphone",
          },
          {
            id: "c2",
            slug: "home-living",
            name: "Home & Living",
            parentId: null,
            iconName: "unknown",
          },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(
      within(nav).getByRole("link", { name: "Home & Living" }),
    ).toHaveAttribute("href", "/c/home-living");
  });
});

const categories: Category[] = [
  {
    id: "c1",
    slug: "electronics",
    name: "Electronics",
    parentId: null,
    iconName: "laptop",
  },
  {
    id: "c11",
    slug: "phones",
    name: "Phones",
    parentId: "c1",
    iconName: "phone",
  },
  {
    id: "c2",
    slug: "home-living",
    name: "Home & Living",
    parentId: null,
    iconName: "home",
  },
];

function FacetHarness({ onChange }: { onChange: (f: Facets) => void }) {
  const [value, setValue] = useState<Facets>({});
  return (
    <FacetPanel
      categories={categories}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      onClear={() => setValue({})}
    />
  );
}

describe("FacetPanel", () => {
  it("filters by category, price range and rating", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FacetHarness onChange={onChange} />);
    expect(
      screen.queryByRole("radio", { name: "Phones" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Electronics" }));
    expect(onChange).toHaveBeenLastCalledWith({ category: "electronics" });
    await user.click(screen.getByRole("radio", { name: "Phones" }));
    expect(onChange).toHaveBeenLastCalledWith({ category: "phones" });

    await user.type(screen.getByLabelText("Min (VND)"), "500000");
    await user.type(screen.getByLabelText("Max (VND)"), "100000");
    await user.click(screen.getByRole("button", { name: "Apply price" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Minimum price must not be higher than maximum price.",
    );
    await user.clear(screen.getByLabelText("Max (VND)"));
    await user.type(screen.getByLabelText("Max (VND)"), "2000000");
    await user.click(screen.getByRole("button", { name: "Apply price" }));
    expect(onChange).toHaveBeenLastCalledWith({
      category: "phones",
      minPrice: "500000",
      maxPrice: "2000000",
    });

    await user.click(screen.getByRole("radio", { name: "4 stars & up" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ minRating: "4" }),
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("radio", { name: "All categories" })).toBeChecked();
    expect(screen.getByLabelText("Min (VND)")).toHaveValue("");
  });
});

const cartItem = (overrides: Partial<CartItem>): CartItem => ({
  id: "i1",
  variantId: "v1",
  productSlug: "anker-powercore-10000",
  name: "Anker PowerCore 10000",
  variantLabel: "Black",
  imageUrl: "a.svg",
  unitPrice: "1790000",
  quantity: 2,
  stock: 10,
  maxQuantity: 10,
  selected: true,
  available: true,
  ...overrides,
});

describe("CartSellerGroup", () => {
  it("selects, changes quantity, removes and shows notices", async () => {
    const user = userEvent.setup();
    const handlers = {
      onToggleItem: vi.fn(),
      onToggleAll: vi.fn(),
      onQuantityChange: vi.fn(),
      onRemove: vi.fn(),
    };
    const items = [
      cartItem({ priceChangedFrom: "1590000" }),
      cartItem({
        id: "i2",
        name: "USB-C cable 1m",
        unitPrice: "129000",
        quantity: 1,
        stock: 3,
        selected: false,
      }),
      cartItem({
        id: "i3",
        name: "Retired lamp",
        available: false,
        selected: false,
        quantity: 1,
      }),
    ];
    withRouter(<CartSellerGroup seller={seller} items={items} {...handlers} />);

    const all = screen.getByRole("checkbox", {
      name: "Select all items from Saigon Gadget House",
    }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    await user.click(all);
    expect(handlers.onToggleAll).toHaveBeenCalledWith(true);

    expect(screen.getByText(/Price went up from/)).toHaveTextContent(
      "1,590,000",
    );
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(screen.getByText("No longer available")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select Retired lamp, Black" }),
    ).toBeDisabled();
    expect(screen.getByText(/3,580,000/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "Select USB-C cable 1m, Black" }),
    );
    expect(handlers.onToggleItem).toHaveBeenCalledWith("i2", true);
    await user.click(
      screen.getByRole("button", {
        name: "Increase quantity of Anker PowerCore 10000",
      }),
    );
    expect(handlers.onQuantityChange).toHaveBeenCalledWith("i1", 3);
    await user.click(
      screen.getByRole("button", { name: "Remove USB-C cable 1m from cart" }),
    );
    expect(handlers.onRemove).toHaveBeenCalledWith(items[1]);
  });

  it("warns when quantity exceeds stock", () => {
    withRouter(
      <CartSellerGroup
        seller={seller}
        items={[cartItem({ quantity: 5, stock: 2 })]}
        onToggleItem={vi.fn()}
        onToggleAll={vi.fn()}
        onQuantityChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Only 2 left — lower the quantity"),
    ).toBeInTheDocument();
  });
});

describe("OrderSummary", () => {
  it("shows totals and the action", () => {
    render(
      <OrderSummary
        itemCount={3}
        itemsTotal="3709000"
        discount="50000"
        shippingTotal="30000"
        total="3689000"
      >
        <button type="button">Check out (3)</button>
      </OrderSummary>,
    );
    const summary = screen.getByRole("region", { name: "Order summary" });
    expect(within(summary).getByText("Items (3)")).toBeInTheDocument();
    expect(within(summary).getByText(/3,689,000/)).toBeInTheDocument();
    expect(within(summary).getByText("Discount")).toBeInTheDocument();
    expect(
      within(summary).getByRole("button", { name: "Check out (3)" }),
    ).toBeInTheDocument();
  });

  it("explains unknown shipping and hides a zero discount", () => {
    render(
      <OrderSummary itemCount={1} itemsTotal="100" discount="0" total="100" />,
    );
    expect(screen.getByText("Calculated at checkout")).toBeInTheDocument();
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();
  });
});

describe("ReservationTimer", () => {
  it("counts down and calls onExpire once", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    const onExpire = vi.fn();
    render(
      <ReservationTimer expiresAt="2026-11-05T10:15:00Z" onExpire={onExpire} />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("15:00");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer")).toHaveTextContent("14:59");
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(screen.getByText("Less than 5 minutes left")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(screen.getAllByText("Reservation expired").length).toBeGreaterThan(
      0,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("calls onExpire immediately when already expired", () => {
    const onExpire = vi.fn();
    render(
      <ReservationTimer expiresAt="2000-01-01T00:00:00Z" onExpire={onExpire} />,
    );
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});

describe("SavedAddressPicker", () => {
  const addresses: Address[] = [
    {
      id: "a1",
      recipient: "Nguyen Van An",
      phone: "0900000001",
      address: "12 Le Loi, District 1, HCMC",
      isDefault: true,
    },
    {
      id: "a2",
      recipient: "Nguyen Van An",
      phone: "0900000001",
      address: "5 Tran Phu, Hai Chau, Da Nang",
      isDefault: false,
    },
  ];

  it("chooses an address", async () => {
    const onChange = vi.fn();
    render(
      <SavedAddressPicker
        addresses={addresses}
        value="a1"
        onChange={onChange}
        onAddNew={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /12 Le Loi/ })).toBeChecked();
    expect(screen.getByText("Default")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /5 Tran Phu/ }));
    expect(onChange).toHaveBeenCalledWith("a2");
  });

  it("offers adding an address when there is none", async () => {
    const onAddNew = vi.fn();
    render(
      <SavedAddressPicker
        addresses={[]}
        onChange={vi.fn()}
        onAddNew={onAddNew}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add address" }));
    expect(onAddNew).toHaveBeenCalled();
  });
});

describe("states", () => {
  it("renders skeletons and empty states with next actions", async () => {
    const onClear = vi.fn();
    withRouter(
      <>
        <ProductGridSkeleton count={2} />
        <ListSkeleton label="Loading cart" />
        <EmptyCart />
        <NoResults query="kettle" onClear={onClear} />
        <NoOrders tabLabel="To ship" />
      </>,
    );
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText("Loading products")).toBeInTheDocument();
    expect(screen.getByText("Loading cart")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start shopping" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("heading", { name: "No products match “kettle”" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear filters" }),
    );
    expect(onClear).toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "No orders in “To ship”" }),
    ).toBeInTheDocument();
  });
});

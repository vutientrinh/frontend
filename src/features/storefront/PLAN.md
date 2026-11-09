# Storefront plan (TASK-016, fe-dev-3)

## Direction

Calm marketplace. Neutral surfaces, product images carry the color, price is the loudest text,
blue only for actions and focus. It matches the shopper wallet screens (border-y bands, `bg-card`
rows, 44px touch targets). Mobile first (375px, 2-column grid, shopper bottom nav keeps
`pb-24`), fluid up to 2560px (grid adds columns; no centered narrow column).

## Who and what (one primary action per screen)

| Screen                           | Shopper goal                       | Primary action                                      |
| -------------------------------- | ---------------------------------- | --------------------------------------------------- |
| W-10 Home `/`                    | find something                     | search (or open a product)                          |
| W-11 Search `/search`            | narrow down, compare               | open product (add to cart from card is secondary)   |
| W-12 Category `/c/:slug`         | browse one category                | same as W-11 (search pre-filtered + sub-categories) |
| W-13 Product `/p/:slug`          | decide and pick a variant          | Add to cart (Buy now is secondary)                  |
| W-14 Shop `/shop/:seller`        | trust the seller, browse its items | open product                                        |
| W-15 Cart `/cart`                | choose what to buy now             | Check out (N)                                       |
| W-16 Checkout `/checkout`        | confirm address, shipping, method  | Place order (idempotent)                            |
| W-17 Pay `/pay/:intentId`        | finish payment                     | Confirm OTP / pay by QR                             |
| W-18 Success                     | know it worked                     | View order                                          |
| W-19 My orders `/me/orders?tab=` | see what is happening              | per-card action (Pay now / Confirm received)        |
| W-20 Order detail                | track, cancel, confirm             | context action                                      |

First second: product image + price + rating (cards); total + reservation timer (checkout/pay);
status (orders). Secondary: seller, sold count, specs, description.

## Layouts

```text
375px product detail             ≥1280px product detail
┌──────────────────────┐         ┌─────────────────────┬────────────────────┐
│ gallery (swipe)      │         │ gallery + thumbs    │ title, rating      │
│ title  rating  sold  │         │                     │ PriceTag           │
│ PriceTag             │         │                     │ VariantPicker      │
│ VariantPicker        │         │                     │ Qty  [Add to cart] │
│ Qty stepper          │         ├─────────────────────┴────────────────────┤
│ SellerCard           │         │ SellerCard · description · specs         │
│ description / specs  │         └──────────────────────────────────────────┘
│[Add to cart][Buy now]│ ← sticky above bottom nav
└──────────────────────┘

375px cart                      ≥1280px cart / checkout
┌──────────────────────┐         ┌──────────────────────────────┬───────────┐
│ ☐ Seller A           │         │ CartSellerGroup (per seller) │ Order     │
│   ☐ item  qty  price │         │ CartSellerGroup              │ Summary   │
│ ☐ Seller B …         │         │                              │ (sticky)  │
│ OrderSummary + CTA   │ sticky  └──────────────────────────────┴───────────┘
└──────────────────────┘
Search: facets in a sheet on mobile (button "Filters (2)"), left column ≥1024px; grid
`repeat(auto-fill, minmax(176px, 1fr))`.
```

## Components (step 1, presentational, props only, in `components/`)

PriceTag, RatingStars, ProductCard, ImageGallery (buttons + arrow keys + swipe), VariantPicker
(cascading availability: an option value is disabled when no in-stock variant matches it and
the earlier selected options; picking a value clears incompatible later choices — no dead
ends), QuantityStepper (1…stock, typed values clamped on blur), SellerCard, CategoryStrip,
FacetPanel (category, price range form, rating), CartSellerGroup (select all/indeterminate,
price-changed and stock notices), OrderSummary, ReservationTimer (mm:ss, announces only at
5 min / 1 min / expired), SavedAddressPicker, states (ProductGridSkeleton, ListSkeleton,
EmptyCart, NoResults, NoOrders). Pure helpers in `lib.ts` (big.js money math, variant logic).
Reused: `Money`, `EmptyState`, `ErrorState`, `StatusBadge`, `Button`, `Input` from
`src/components/**`.

## States per screen (step 2)

Loading = skeleton of the same shape; empty = EmptyCart / NoOrders with next action;
no-results = NoResults with "Clear filters"; error = shared ErrorState with retry; sparse = grid
keeps card width (auto-fill, not stretch); dense = paged search (page in URL), cart groups are
natural sections; 409/422 = inline message on the item (quantity > stock) or a banner (price
changed, reservation expired); payment FAILED/EXPIRED = retry with other method.
URL state: `q, category, minPrice, maxPrice, minRating, sort, page` on search; `tab` on orders.

## Self-critique

Removed: promo banner carousel autoplay (motion without information; banners are static and
scroll horizontally), star rating breakdown bars on cards. Discount uses text, not a red fill.

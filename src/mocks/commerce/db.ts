import Big from "big.js";
import type {
  Category,
  CartItem,
  InventoryMovement,
  Onboarding,
  PaymentIntent,
  ProductDetail,
  SellerOrderDetail,
  SellerRef,
  SellerSettings,
} from "../../features/commerce/types";
import { productArtwork } from "./product-art";

export interface DB {
  sellers: SellerRef[];
  categories: Category[];
  products: ProductDetail[];
  cart: (CartItem & { ownerId: string })[];
  orders: (SellerOrderDetail & { ownerId: string })[];
  intents: PaymentIntent[];
  onboarding: Record<string, Onboarding>;
  settings: Record<string, SellerSettings>;
  movements: Record<string, InventoryMovement[]>;
  keys: Record<string, { body: string; result: unknown }>;
}
const uid = () => crypto.randomUUID();
const categorySeller = [0, 1, 2, 1, 2, 1, 2, 1] as const;
const reviewNames = ["Linh N.", "Minh A.", "Alex N.", "Mai T."];
function specsFor(category: string) {
  const specs: Record<string, [string, string][]> = {
    electronics: [
      ["Warranty", "12 months"],
      ["Connectivity", "USB-C"],
      ["Origin", "Vietnam"],
    ],
    home: [
      ["Material", "Powder-coated steel"],
      ["Care", "Wipe clean"],
      ["Origin", "Vietnam"],
    ],
    fashion: [
      ["Material", "Cotton blend"],
      ["Fit", "Regular"],
      ["Care", "Machine wash cold"],
    ],
    beauty: [
      ["Skin type", "All skin types"],
      ["Volume", "100 ml"],
      ["Origin", "Vietnam"],
    ],
    sports: [
      ["Material", "Recycled polyester"],
      ["Use", "Outdoor"],
      ["Care", "Hand wash"],
    ],
    books: [
      ["Language", "English"],
      ["Format", "Paperback"],
      ["Publisher", "Saigon Press"],
    ],
    toys: [
      ["Age range", "3 years and up"],
      ["Material", "ABS plastic"],
      ["Safety", "Small parts"],
    ],
    food: [
      ["Origin", "Vietnam"],
      ["Storage", "Keep in a cool, dry place"],
      ["Net weight", "500 g"],
    ],
  };
  return (specs[category] ?? specs.electronics).map(([label, value]) => ({
    label,
    value,
  }));
}
function ratingBreakdown(total: number, index: number) {
  const one = Math.floor(total * 0.01);
  const two = Math.floor(total * 0.02);
  const three = Math.floor(total * 0.04);
  const four = Math.floor(total * (0.18 + (index % 3) * 0.02));
  return {
    1: one,
    2: two,
    3: three,
    4: four,
    5: total - one - two - three - four,
  };
}
function seededReviews(productIndex: number) {
  const createdAt = Date.now();
  return [5, 5, 4].map((rating, index) => ({
    id: `review-${productIndex + 1}-${index + 1}`,
    displayName: reviewNames[(productIndex + index) % reviewNames.length],
    rating,
    title: ["Works as expected", "Good value", "Happy with this purchase"][
      index
    ],
    body: [
      "The quality matches the description and it arrived in good condition.",
      "Useful for everyday use. The details were accurate.",
      "A solid purchase and delivery was straightforward.",
    ][index],
    createdAt: new Date(
      createdAt - (productIndex * 4 + index + 1) * 86400000,
    ).toISOString(),
    verifiedPurchase: true,
  }));
}
const lifecycle: Record<
  SellerOrderDetail["status"],
  SellerOrderDetail["status"][]
> = {
  PENDING_PAYMENT: ["PENDING_PAYMENT"],
  PAID: ["PENDING_PAYMENT", "PAID"],
  CONFIRMED: ["PENDING_PAYMENT", "PAID", "CONFIRMED"],
  PACKED: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PACKED"],
  SHIPPED: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PACKED", "SHIPPED"],
  DELIVERED: [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
  ],
  COMPLETED: [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
  ],
  CANCELLED: ["PENDING_PAYMENT", "PAID", "CANCELLED"],
  RETURN_REQUESTED: [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "RETURN_REQUESTED",
  ],
  RETURNED: [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "RETURN_REQUESTED",
    "RETURNED",
  ],
  REFUNDED: [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "RETURN_REQUESTED",
    "RETURNED",
    "REFUNDED",
  ],
  DELIVERY_FAILED: [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERY_FAILED",
  ],
};
function timelineFor(
  status: SellerOrderDetail["status"],
  index: number,
  seededAt: number,
) {
  const path = lifecycle[status];
  const terminalAge =
    status === "PENDING_PAYMENT"
      ? ((index % 3) + 1) * 83000
      : status === "SHIPPED"
        ? 5000
        : ((index % 8) + 1) * 23 * 60000;
  const interval = (5 + (index % 5) * 7) * 60000;
  const terminalAt = seededAt - terminalAge;
  return path.map((entry, step) => ({
    status: entry,
    at: new Date(
      terminalAt - (path.length - step - 1) * interval,
    ).toISOString(),
  }));
}
export function seed(): DB {
  const sellers: SellerRef[] = [
    ["Saigon Gadget House", "saigon-gadget-house", "Ho Chi Minh City"],
    ["Hanoi Home & Living", "hanoi-home-living", "Hanoi"],
    ["Da Nang Outdoor", "da-nang-outdoor", "Da Nang"],
    ["New seller", "new-seller", "Ho Chi Minh City"],
  ].map(([name, slug, location]) => ({
    id: uid(),
    name,
    slug,
    location,
    rating: "4.8",
  }));
  const categoryAttributes: Record<string, string[]> = {
    Electronics: ["Brand", "Model", "Warranty"],
    Home: ["Material", "Color", "Dimensions"],
    Fashion: ["Material", "Color", "Fit"],
    Beauty: ["Brand", "Skin type", "Volume"],
    Sports: ["Brand", "Material", "Recommended use"],
    Books: ["Author", "Publisher", "Language"],
    Toys: ["Age range", "Material", "Safety standard"],
    Food: ["Brand", "Ingredients", "Expiry date"],
  };
  const categories: Category[] = [
    "Electronics",
    "Home",
    "Fashion",
    "Beauty",
    "Sports",
    "Books",
    "Toys",
    "Food",
  ].flatMap((name) => {
    const id = uid();
    const slug = name.toLowerCase();
    const attributes = categoryAttributes[name];
    return [
      { id, slug, name, parentId: null, iconName: "Package", attributes },
      {
        id: uid(),
        slug: `${slug}-essentials`,
        name: `${name} essentials`,
        parentId: id,
        iconName: "Package",
        attributes,
      },
    ];
  });
  const products: ProductDetail[] = Array.from({ length: 40 }, (_, i) => {
    const categoryIndex = i % 8;
    const category = categories[categoryIndex * 2];
    const seller = sellers[categorySeller[categoryIndex]];
    const name = `${category.name} item ${i + 1}`;
    const price = String(39000 + i * 640000);
    const images = productArtwork(category.slug, i);
    const ratingCount = 20 + i * 3;
    const variants = Array.from({ length: (i % 6) + 1 }, (_, v) => ({
      id: uid(),
      sku: `SKU-${i + 1}-${v + 1}`,
      options: { Style: `Option ${v + 1}` },
      price,
      stock: i % 11 === 0 ? 0 : 10 + v,
      weightGrams: 500,
    }));
    return {
      id: uid(),
      slug: `product-${i + 1}`,
      name,
      imageUrl: images[0],
      price,
      ...(i % 3 === 0 ? { compareAtPrice: String(59000 + i * 640000) } : {}),
      rating: "4.7",
      ratingCount,
      soldCount: i * 7,
      variantCount: variants.length,
      seller,
      inStock: variants.some((v) => v.stock > 0),
      description: `A useful ${category.name.toLowerCase()} product.`,
      images,
      attributes: [],
      options: [
        { name: "Style", values: variants.map((v) => v.options.Style) },
      ],
      variants,
      category: { slug: category.slug, name: category.name },
      status: "LIVE",
      specs: specsFor(category.slug),
      reviews: seededReviews(i),
      ratingBreakdown: ratingBreakdown(ratingCount, i),
      shippingEstimate: {
        destination: seller.location,
        minDays: 2 + (categorySeller[categoryIndex] % 2),
        maxDays: 4 + (categorySeller[categoryIndex] % 2),
        fee: "25000",
      },
    };
  });
  const statuses: SellerOrderDetail["status"][] = [
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
    "RETURN_REQUESTED",
    "RETURNED",
    "REFUNDED",
    "DELIVERY_FAILED",
  ];
  const sellerProducts = sellers
    .slice(0, 3)
    .map((seller) =>
      products.filter(
        (product) =>
          product.seller.id === seller.id &&
          product.variants.some((variant) => variant.stock > 0),
      ),
    );
  const intents: PaymentIntent[] = [];
  const orders: (SellerOrderDetail & { ownerId: string })[] = [0, 1, 2].flatMap(
    (shopper) =>
      statuses.map((status, index) => {
        const i = shopper * statuses.length + index;
        const sellerIndex = (index + shopper + 1) % 3;
        const sellerCatalog = sellerProducts[sellerIndex];
        const product = sellerCatalog[Math.floor(i / 3) % sellerCatalog.length];
        const variant = product.variants[0];
        const timeline = timelineFor(status, i, Date.now());
        const createdAt = timeline[0].at;
        const intentId = uid();
        const parentOrderId = uid();
        const parentNumber = `ORD-261105-${String(i + 1).padStart(4, "0")}`;
        if (status === "PENDING_PAYMENT") variant.stock -= 1;
        const paymentStatus =
          status === "PENDING_PAYMENT"
            ? "CREATED"
            : status === "CANCELLED"
              ? "CANCELLED"
              : "SUCCEEDED";
        intents.push({
          id: intentId,
          parentOrderId,
          orderNumber: parentNumber,
          method: "VIETQR",
          status: paymentStatus,
          amount: variant.price,
          expiresAt: new Date(Date.parse(createdAt) + 900000).toISOString(),
        });
        return {
          ownerId: `phone:090000000${shopper + 1}`,
          id: uid(),
          orderNumber: `${parentNumber}-A`,
          parentOrderId,
          paymentIntentId: intentId,
          seller: product.seller,
          status,
          itemsPreview: [
            {
              name: product.name,
              imageUrl: product.imageUrl,
              variantLabel: "Option 1",
              quantity: 1,
            },
          ],
          itemCount: 1,
          total: variant.price,
          createdAt,
          actions:
            status === "PENDING_PAYMENT"
              ? ["PAY", "CANCEL"]
              : status === "SHIPPED"
                ? ["TRACK"]
                : [],
          items: [
            {
              variantId: variant.id,
              name: product.name,
              imageUrl: product.imageUrl,
              variantLabel: "Option 1",
              quantity: 1,
              unitPrice: variant.price,
              lineTotal: variant.price,
            },
          ],
          shippingAddress: {
            recipient: `Demo shopper ${shopper + 1}`,
            phone: `090000000${shopper + 1}`,
            address: "Ho Chi Minh City",
          },
          shippingFee: "0",
          discount: "0",
          payment: { intentId, method: "VIETQR", status: paymentStatus },
          timeline,
          ...([
            "SHIPPED",
            "DELIVERED",
            "COMPLETED",
            "RETURN_REQUESTED",
            "RETURNED",
            "REFUNDED",
            "DELIVERY_FAILED",
          ].includes(status)
            ? {
                shipment: {
                  carrier: "Mock carrier",
                  trackingNo: `TRACK-${i + 1}`,
                  events: (() => {
                    const shippedAt = timeline.find(
                      (entry) => entry.status === "SHIPPED",
                    )!.at;
                    const deliveredAt = timeline.find(
                      (entry) => entry.status === "DELIVERED",
                    )?.at;
                    const failedAt = timeline.find(
                      (entry) => entry.status === "DELIVERY_FAILED",
                    )?.at;
                    const terminalAt = deliveredAt ?? failedAt;
                    const inTransitAt = terminalAt
                      ? new Date(
                          (Date.parse(shippedAt) + Date.parse(terminalAt)) / 2,
                        ).toISOString()
                      : new Date(
                          Date.parse(shippedAt) +
                            Math.min(
                              10 * 60000,
                              (Date.now() - Date.parse(shippedAt)) / 2,
                            ),
                        ).toISOString();
                    return [
                      {
                        status: "PICKED_UP",
                        at: shippedAt,
                        location: product.seller.location,
                      },
                      {
                        status: "IN_TRANSIT",
                        at: inTransitAt,
                        location: "Regional sorting center",
                      },
                      ...(deliveredAt
                        ? [
                            {
                              status: "DELIVERED",
                              at: deliveredAt,
                              location: "Recipient city",
                            },
                          ]
                        : []),
                      ...(failedAt
                        ? [
                            {
                              status: "DELIVERY_FAILED",
                              at: failedAt,
                              location: "Recipient city",
                            },
                          ]
                        : []),
                    ];
                  })(),
                },
              }
            : {}),
          buyer: {
            maskedName: "Demo shopper",
            maskedPhone: `090****00${shopper + 1}`,
          },
          money: {
            gross: variant.price,
            commission: new Big(variant.price).times("0.05").toFixed(0),
            vatOnCommission: new Big(
              new Big(variant.price).times("0.05").toFixed(0),
            )
              .times("0.1")
              .toFixed(0),
            net: new Big(variant.price)
              .minus(new Big(variant.price).times("0.05").toFixed(0))
              .minus(
                new Big(new Big(variant.price).times("0.05").toFixed(0))
                  .times("0.1")
                  .toFixed(0),
              )
              .toFixed(0),
            escrowStatus: "PENDING",
          },
        };
      }),
  );
  return {
    sellers,
    categories,
    products,
    cart: [],
    orders,
    intents,
    onboarding: Object.fromEntries(
      sellers.map((seller, i) => [
        seller.id,
        {
          status: i === 3 ? "DRAFT" : "APPROVED",
          currentStep: "shop",
          steps: {},
        },
      ]),
    ),
    settings: Object.fromEntries(
      sellers.map((seller) => [
        seller.id,
        {
          shopName: seller.name,
          description: "",
          location: seller.location,
          contactPhone: "",
          contactEmail: "",
          notifications: { newOrder: true, lowStock: true, payout: true },
        },
      ]),
    ),
    movements: {},
    keys: {},
  };
}
const key = "payment-commerce-db-v4";
const legacyKey = "payment-commerce-db-v3";
let memory: DB | undefined;
export function getDB(): DB {
  if (memory) return memory;
  try {
    localStorage.removeItem(legacyKey);
    const value = localStorage.getItem(key);
    if (value) return (memory = JSON.parse(value) as DB);
    memory = seed();
    localStorage.setItem(key, JSON.stringify(memory));
    return memory;
  } catch {
    /* in-memory fallback */
  }
  return (memory = seed());
}
export function saveDB(): void {
  try {
    localStorage.setItem(key, JSON.stringify(getDB()));
  } catch {
    /* in-memory fallback */
  }
}
export function resetCommerceDB(): void {
  localStorage.removeItem(legacyKey);
  memory = seed();
  saveDB();
}
export function reloadCommerceDB(): void {
  memory = undefined;
}

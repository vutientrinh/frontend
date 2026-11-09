import { faker } from "@faker-js/faker";
import type {
  Customer,
  Order,
  OutboxEvent,
  Payment,
  PaymentHistory,
  Product,
} from "../api/types";
export interface DemoDB {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  events: OutboxEvent[];
  history: Record<string, PaymentHistory[]>;
}
const catalog: [string, string, string][] = [
  ["Aster 14 Laptop", "14-inch laptop with 16 GB memory", "21990000"],
  [
    "Aster 16 Pro Laptop",
    "16-inch performance laptop for creative work",
    "32990000",
  ],
  ["Nova 10 Tablet", "10-inch tablet with all-day battery", "7990000"],
  ["Nova Tablet Keyboard", "Slim keyboard case for Nova tablets", "1590000"],
  [
    "Orbit Wireless Mouse",
    "Ergonomic wireless mouse with silent clicks",
    "490000",
  ],
  [
    "Orbit Compact Keyboard",
    "Compact Bluetooth keyboard for daily work",
    "990000",
  ],
  [
    "Pulse Noise-Cancelling Headphones",
    "Over-ear headphones with active noise cancellation",
    "3490000",
  ],
  [
    "Pulse Wireless Earbuds",
    "True wireless earbuds with charging case",
    "1790000",
  ],
  [
    "Echo USB Microphone",
    "Desktop microphone for calls and recordings",
    "1290000",
  ],
  ["View 27 Monitor", "27-inch QHD monitor with adjustable stand", "6490000"],
  ["View 24 Monitor", "24-inch Full HD monitor with slim bezel", "3290000"],
  [
    "Dock 8-in-1 USB-C Hub",
    "Multiport hub with HDMI and USB connections",
    "1190000",
  ],
  [
    "Dock Dual Display Station",
    "USB-C dock supporting two external displays",
    "2890000",
  ],
  ["Charge 65W Adapter", "Compact USB-C fast charger", "690000"],
  [
    "Charge 30W Adapter",
    "Portable USB-C charger for phones and tablets",
    "349000",
  ],
  [
    "Charge 20000 Power Bank",
    "High-capacity power bank with USB-C output",
    "990000",
  ],
  ["Link USB-C Cable 2m", "Braided USB-C charging and data cable", "390000"],
  ["Link HDMI Cable 2m", "High-speed HDMI cable for displays", "349000"],
  ["Safe 1TB Portable SSD", "Compact portable solid-state storage", "2490000"],
  ["Safe 2TB Portable SSD", "High-speed portable drive for backups", "4290000"],
  ["Frame 1080p Webcam", "Full HD webcam with privacy cover", "890000"],
  ["Desk Laptop Stand", "Adjustable aluminium laptop stand", "790000"],
  [
    "Desk Monitor Light",
    "Screen light bar with adjustable brightness",
    "1190000",
  ],
  [
    "Travel Laptop Sleeve 14",
    "Protective sleeve for 14-inch laptops",
    "490000",
  ],
  [
    "Travel Tech Organizer",
    "Compact pouch for cables and accessories",
    "449000",
  ],
];
export function seed(): DemoDB {
  faker.seed(12005);
  const first = [
      "Linh",
      "Minh",
      "An",
      "Lan",
      "Huy",
      "Mai",
      "Trang",
      "Duc",
      "Ha",
      "Khanh",
      "Emma",
      "James",
      "Sofia",
      "Daniel",
      "Olivia",
      "Lucas",
      "Ava",
      "Noah",
      "Mia",
      "Ethan",
    ],
    last = [
      "Nguyen",
      "Tran",
      "Le",
      "Pham",
      "Hoang",
      "Vo",
      "Phan",
      "Do",
      "Bui",
      "Dang",
      "Martin",
      "Taylor",
      "Kim",
      "Patel",
      "Chen",
      "Wong",
      "Smith",
      "Brown",
      "Garcia",
      "Lee",
    ];
  const customers = Array.from({ length: 40 }, (_, i) => {
    const a = first[i % 20],
      b = last[(i * 7) % 20];
    return {
      id: faker.string.uuid(),
      firstName: a,
      lastName: b,
      email: `${a.toLowerCase()}.${b.toLowerCase()}${i >= 20 ? ".work" : ""}@${i % 3 === 0 ? "example.vn" : i % 3 === 1 ? "example.com" : "example.org"}`,
      phoneNumber: `+84 9${faker.number.int({ min: 0, max: 9 })} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`,
    };
  });
  const products = catalog.map(
    ([productName, productDescription, unitPrice]) => ({
      id: faker.string.uuid(),
      productName,
      productDescription,
      unitPrice,
      active: true,
    }),
  );
  const orders: Order[] = Array.from({ length: 90 }, (_, i) => {
    const c = customers[i % customers.length],
      p = products[(i * 7) % products.length],
      age = Math.floor((i / 90) ** 1.7 * 60 * 86400000) + 3600000;
    const status =
      i % 5 === 0
        ? "PENDING"
        : i > 1 && i % 19 === 1
          ? "PAYMENT_FAILED"
          : i % 23 === 2
            ? "REFUNDED"
            : "PAID";
    return {
      id: faker.string.uuid(),
      orderCode: `ORD-${String(1201 + i).padStart(4, "0")}`,
      status,
      orderAmount: p.unitPrice,
      customerId: c.id,
      customerName: `${c.firstName} ${c.lastName}`,
      items: [{ productId: p.id, quantity: 1, price: p.unitPrice }],
      createdAt: new Date(Date.now() - age).toISOString(),
    };
  });
  const payments: Payment[] = orders
    .filter((o) => o.status !== "PENDING")
    .map((o, i) => ({
      id: faker.string.uuid(),
      orderId: o.id,
      status:
        o.status === "PAYMENT_FAILED"
          ? "FAILED"
          : o.status === "REFUNDED"
            ? "REFUNDED"
            : "COMPLETED",
      method: ["CARD", "BANK_TRANSFER", "EWALLET", "CARD", "BANK_TRANSFER"][
        i % 5
      ],
      amount: o.orderAmount,
      currency: "VND",
      createdAt: o.createdAt,
      updatedAt: o.createdAt,
    }));
  const history: Record<string, PaymentHistory[]> = Object.fromEntries(
    payments.map((p) => [
      p.id,
      [
        { status: "PENDING", changedAt: p.createdAt, source: "SYSTEM" },
        { status: "PROCESSING", changedAt: p.createdAt, source: "SYSTEM" },
        { status: p.status, changedAt: p.updatedAt, source: "SYSTEM" },
      ],
    ]),
  );
  const events: OutboxEvent[] = Array.from({ length: 150 }, (_, i) => {
    const p = payments[i % payments.length],
      failed = i % 20 === 0;
    return {
      id: faker.string.uuid(),
      eventType: i % 3 ? "payment.status-changed.v1" : "payment.requested.v1",
      aggregateType: "PAYMENT",
      aggregateId: p.id,
      status: failed ? "FAILED" : "PUBLISHED",
      attempts: failed ? 3 : 1,
      nextRetryAt: null,
      lastError: failed ? "Delivery failed" : null,
      createdAt: p.createdAt,
      publishedAt: failed ? null : p.updatedAt,
    };
  });
  return { customers, products, orders, payments, events, history };
}

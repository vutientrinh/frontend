import type { Campaign } from "../../features/commerce/types";

const artwork = (scene: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><path d="${scene}" fill="currentColor" fill-opacity=".88" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"/></svg>`)}`;

export const campaigns = [
  {
    id: "campaign-everyday-tech",
    title: "Make room for better tech",
    subtitle: "Everyday devices, chosen for the way you live.",
    ctaLabel: "Explore electronics",
    href: "/search?category=electronics",
    image: artwork(
      "M360 90h100a18 18 0 0 1 18 18v144a18 18 0 0 1-18 18H360a18 18 0 0 1-18-18V108a18 18 0 0 1 18-18zm20 24h60v118h-60zm18 134h24",
    ),
    tone: "brand",
  },
  {
    id: "campaign-home-refresh",
    title: "A little more calm at home",
    subtitle: "Thoughtful pieces for the spaces you return to.",
    ctaLabel: "Shop home & living",
    href: "/search?category=home",
    image: artwork(
      "M330 164 420 88l90 76v112h-70v-76h-40v76h-70zm130-88 52 44V90h-52",
    ),
    tone: "deal",
  },
  {
    id: "campaign-outside-more",
    title: "Take the long way outside",
    subtitle: "Gear up for fresh air, open roads, and new views.",
    ctaLabel: "Find outdoor gear",
    href: "/search?category=sports",
    image: artwork(
      "M320 82c-72 0-130 58-130 130 0 95 130 148 130 148s130-53 130-148c0-72-58-130-130-130zm0 67a63 63 0 1 1 0 126 63 63 0 0 1 0-126z",
    ),
    tone: "neutral",
  },
] as const satisfies readonly Campaign[];

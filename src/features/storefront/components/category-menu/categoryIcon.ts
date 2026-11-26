import {
  Baby,
  Book,
  BookOpen,
  Camera,
  Car,
  Dumbbell,
  Gamepad2,
  Gem,
  Headphones,
  House,
  Lamp,
  Laptop,
  Package,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tag,
  Tent,
  ToyBrick,
  UtensilsCrossed,
  Watch,
  type LucideIcon,
} from "lucide-react";

/*
 * `Category.iconName` is a Lucide key (contract: docs/product/api/categories.md). A small explicit map keeps the
 * bundle small (importing every Lucide icon would not). Keys are matched without case, dashes or underscores, so
 * `shopping-basket`, `ShoppingBasket` and `shopping_basket` are the same. Unknown keys fall back to `Tag`.
 * Shared by the home `CategoryStrip` and the Categories menu (TASK-034).
 */
const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  book: Book,
  books: Book,
  bookopen: BookOpen,
  camera: Camera,
  car: Car,
  dumbbell: Dumbbell,
  sports: Dumbbell,
  gamepad: Gamepad2,
  gamepad2: Gamepad2,
  gem: Gem,
  jewelry: Gem,
  headphones: Headphones,
  audio: Headphones,
  home: House,
  house: House,
  lamp: Lamp,
  laptop: Laptop,
  computer: Laptop,
  package: Package,
  shirt: Shirt,
  fashion: Shirt,
  grocery: ShoppingBasket,
  shoppingbasket: ShoppingBasket,
  smartphone: Smartphone,
  phone: Smartphone,
  sofa: Sofa,
  sparkles: Sparkles,
  beauty: Sparkles,
  tent: Tent,
  outdoor: Tent,
  toybrick: ToyBrick,
  toys: ToyBrick,
  utensils: UtensilsCrossed,
  utensilscrossed: UtensilsCrossed,
  food: UtensilsCrossed,
  watch: Watch,
};

export function categoryIcon(iconName?: string | null): LucideIcon {
  const key = (iconName ?? "").toLowerCase().replace(/[-_\s]/g, "");
  return ICONS[key] ?? Tag;
}

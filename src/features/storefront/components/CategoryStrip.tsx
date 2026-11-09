import {
  Baby,
  Book,
  Car,
  Dumbbell,
  Gamepad2,
  Gem,
  House,
  Laptop,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  Tent,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Category } from "../../commerce/types";
import { scrollStripClass } from "../lib";

// Small explicit map keeps the bundle small (importing all lucide icons would not).
const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  book: Book,
  books: Book,
  car: Car,
  dumbbell: Dumbbell,
  sports: Dumbbell,
  gamepad: Gamepad2,
  gamepad2: Gamepad2,
  gem: Gem,
  jewelry: Gem,
  home: House,
  house: House,
  laptop: Laptop,
  computer: Laptop,
  shirt: Shirt,
  fashion: Shirt,
  grocery: ShoppingBasket,
  "shopping-basket": ShoppingBasket,
  smartphone: Smartphone,
  phone: Smartphone,
  sparkles: Sparkles,
  beauty: Sparkles,
  tent: Tent,
  outdoor: Tent,
};

function categoryIcon(iconName: string): LucideIcon {
  return ICONS[iconName.toLowerCase()] ?? Tag;
}

/** Horizontally scrolling list of top-level categories (or the given level). */
export function CategoryStrip({
  categories,
  label = "Categories",
}: {
  categories: Category[];
  label?: string;
}) {
  if (!categories.length) return null;
  return (
    <nav aria-label={label}>
      <ul
        className={`relative -mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 sm:-mx-1 sm:px-1 ${scrollStripClass}`}
      >
        {categories.map((category) => {
          const Icon = categoryIcon(category.iconName);
          return (
            <li key={category.id} className="shrink-0 snap-start">
              <NavLink
                to={`/c/${category.slug}`}
                className={({ isActive }) =>
                  `flex min-h-11 w-24 flex-col items-center gap-2 rounded-md px-2 py-3 text-center text-xs hover:bg-muted ${isActive ? "bg-muted font-semibold" : ""}`
                }
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="line-clamp-2">{category.name}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

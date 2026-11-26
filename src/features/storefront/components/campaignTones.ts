/**
 * Campaign tone → surface classes (TASK-029 A3). Shared by the home hero and the Categories menu campaign tile.
 * The deal colour appears only on the `deal` tone (DESIGN.md §2).
 */
export type Tone = "brand" | "deal" | "neutral";
/** `art` fills one-colour SVG artwork (see `CampaignArt`), so it follows the tone in both themes. */
export const campaignTones: Record<
  Tone,
  { surface: string; cta: string; subtitle: string; art: string }
> = {
  brand: {
    surface: "bg-[image:var(--brand-gradient)] text-primary-foreground",
    cta: "bg-primary-foreground text-primary hover:opacity-90",
    subtitle: "text-primary-foreground",
    art: "bg-primary-foreground",
  },
  // The only place the hero uses the deal colour (DESIGN.md §2: deal is for deal UI only).
  deal: {
    surface: "bg-deal text-primary-foreground",
    cta: "bg-primary-foreground text-deal hover:opacity-90",
    subtitle: "text-primary-foreground",
    art: "bg-primary-foreground",
  },
  neutral: {
    surface: "border border-border bg-card text-foreground",
    cta: "bg-primary text-primary-foreground hover:opacity-90",
    subtitle: "text-muted-foreground",
    art: "bg-primary",
  },
};

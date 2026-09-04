import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge resolves conflicts using its own table of Tailwind's scales,
 * so it does not know about radii we invented. Without this, `rounded-card`
 * would sit next to a `rounded-lg` from a caller instead of replacing it, and
 * the corners would depend on stylesheet order. Colours need no such help:
 * `bg-*` and `text-*` accept any value, so the token names merge already.
 *
 * Keep this list in step with `borderRadius` in tailwind.config.ts.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["chip", "field", "card", "panel", "hero"] }]
    }
  }
});

/**
 * Joins class names and lets later ones win.
 *
 * This used to be a plain `join(" ")`, which meant a `className` passed by a
 * caller was *appended* to a component's own classes rather than replacing
 * them — so `<Button className="bg-brand">` on a button that already sets
 * `bg-white` produced both, and whichever CSS rule came later in the sheet won.
 * With variants that is a coin flip. `twMerge` resolves conflicts by Tailwind's
 * own grouping, so the caller's class wins the way everyone expects.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}

/**
 * A stable hue per category.
 *
 * DESIGN.md used to say the category chip stays neutral, on the grounds that a
 * colour per category does not scale once people invent their own. Santiago
 * asked for colour so categories can be grouped at a glance, and he is right
 * about the everyday case: a list of eight neutral chips is a list you have to
 * read. This is the version that does scale — a hue derived from the name, with
 * fixed saturation and lightness handled in CSS, so an invented category gets a
 * colour without anyone maintaining a table.
 *
 * The canonical ones are pinned so they never drift between deployments or read
 * differently from one person's account to another.
 */

/**
 * Hues deliberately outside 0–45°. Reds and ambers mean *state* here — overdue
 * and priority — and a category chip in that band would read as a late task.
 */
const HUES = [200, 220, 245, 265, 285, 305, 325, 175, 160, 95];

const PINNED: Record<string, number> = {
  work: 220,
  trabajo: 220,
  estudios: 265,
  clases: 265,
  salud: 160,
  personal: 305,
  "side projects": 285,
  finanzas: 175,
  networking: 200,
  otros: 95,
  recruiting: 245,
  s3: 325
};

function fold(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Same name, same hue, on every device and every deploy. */
export function categoryHue(category: string): number {
  const key = fold(category);
  if (!key) return HUES[0];
  if (PINNED[key] !== undefined) return PINNED[key];

  // Plain sum of code points: stable across runtimes, which a hash relying on
  // bitwise overflow order would not be worth risking for ten buckets.
  let total = 0;
  for (let i = 0; i < key.length; i++) total += key.charCodeAt(i) * (i + 1);
  return HUES[total % HUES.length];
}

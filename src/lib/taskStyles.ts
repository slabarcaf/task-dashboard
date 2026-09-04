import { normalizeStatus } from "@/lib/taskFilters";

/**
 * The whole visual vocabulary of a task card lives here: the category chip, the
 * status chip and the tint that says how late something is. Lifted out of
 * `page.tsx` unchanged so the redesign has one file to rewrite instead of a
 * search across a 1,700-line component.
 *
 * ⚠️ These are still the pre-redesign classes — fixed Tailwind palette colours,
 * no dark mode. The token versions land with the card redesign; see DESIGN.md.
 */

export function tipoBadgeClass(tipo: string): string {
  const key = normalizeTipoKey(tipo);
  if (key === "finances" || key === "finanzas") return "bg-emerald-100 text-emerald-800";
  if (key === "others" || key === "otros") return "bg-slate-200 text-slate-800";
  if (key === "university" || key === "clases") return "bg-violet-100 text-violet-800";
  if (key === "job" || key === "recruiting") return "bg-indigo-100 text-indigo-800";
  if (key === "personal") return "bg-pink-100 text-pink-800";
  if (key === "household") return "bg-orange-100 text-orange-800";
  return "bg-cyan-100 text-cyan-800";
}

export function statusBadgeClass(status: string): string {
  const normalized = normalizeStatus(status);
  if (normalized === "To-do") return "bg-red-100 text-red-800";
  if (normalized === "On-going") return "bg-blue-100 text-blue-800";
  if (normalized === "On hold") return "bg-amber-100 text-amber-900";
  if (normalized === "Done") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-200 text-slate-800";
}

export function cardDueTintClass(dueDate: string, today: string, statusFinalOutcome: string): string {
  if (!dueDate) return "bg-white";
  const due = new Date(`${dueDate}T00:00:00`);
  const base = new Date(`${today}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(base.getTime())) return "bg-white";

  const msPerDay = 24 * 60 * 60 * 1000;
  const deltaDays = Math.floor((due.getTime() - base.getTime()) / msPerDay);
  const normalizedStatus = normalizeStatus(statusFinalOutcome);

  if (deltaDays === 0) return "bg-white";
  if (deltaDays < 0) {
    if (normalizedStatus === "On-going") {
      if (deltaDays <= -14) return "bg-blue-100";
      if (deltaDays <= -7) return "bg-blue-50";
      return "bg-sky-50";
    }
    if (deltaDays <= -14) return "bg-red-100";
    if (deltaDays <= -7) return "bg-red-50";
    return "bg-rose-50";
  }

  if (deltaDays >= 14) return "bg-emerald-100";
  if (deltaDays >= 7) return "bg-emerald-50";
  return "bg-green-50";
}

/** Accent-insensitive key, so "Clases" and "clases" are the same category. */
export function normalizeTipoKey(tipo: string): string {
  return String(tipo || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

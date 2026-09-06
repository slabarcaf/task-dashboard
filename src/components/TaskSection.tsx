import { cn } from "@/lib/cn";

/** A titled run of cards: uppercase label, count, and a rule out to the edge. */
export function TaskSection({
  title,
  count,
  tone,
  children
}: {
  title: string;
  count: number;
  tone?: "late" | "today";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center gap-2.5">
        <h3
          className={cn(
            "font-display text-[12.5px] font-bold uppercase tracking-[0.11em]",
            tone === "late" ? "text-late" : tone === "today" ? "text-brand" : "text-ink-3"
          )}
        >
          {title}
        </h3>
        <span
          className={cn(
            "num rounded-chip border px-2 py-px text-[11.5px] font-bold",
            tone === "late"
              ? "border-late/30 bg-late-soft text-late"
              : tone === "today"
                ? "border-brand/30 bg-brand-soft text-brand"
                : "border-line bg-sunken text-ink-3"
          )}
        >
          {count}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="rounded-panel border border-dashed border-line px-5 py-12 text-center">
      <div className="mb-2 text-3xl" aria-hidden>
        {icon}
      </div>
      <b className="block font-display text-base text-ink">{title}</b>
      {hint && <p className="mx-auto mt-1 max-w-[36ch] text-sm text-ink-2">{hint}</p>}
    </div>
  );
}

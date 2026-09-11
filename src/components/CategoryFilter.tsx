"use client";

import { AppLanguage, categoryLabel } from "@/lib/categories";
import { categoryHue } from "@/lib/categoryColor";
import { cn } from "@/lib/cn";

type CategoryFilterProps = {
  categories: string[];
  /** null = todas */
  selected: string | null;
  counts: Record<string, number>;
  total: number;
  language: AppLanguage;
  onSelect: (category: string | null) => void;
};

/**
 * Filtra por categoría sin importar la vista.
 *
 * Vive fuera de Hoy y del Tablero a propósito: la pregunta "muéstrame solo
 * Finanzas" es independiente de si estás mirando el día o la semana, y tener un
 * filtro por vista obligaría a repetirlo al cambiar de pestaña.
 *
 * Solo aparecen las categorías que tienen algo que mostrar. Un filtro que ofrece
 * una casilla vacía hace perder el tiempo de quien lo aprieta.
 */
export function CategoryFilter({
  categories,
  selected,
  counts,
  total,
  language,
  onSelect
}: CategoryFilterProps) {
  const withTasks = categories.filter((category) => (counts[category] || 0) > 0);
  // Con una sola categoría no hay nada que filtrar.
  if (withTasks.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Filtrar por categoría"
      // Se desliza de lado en el teléfono en vez de envolverse en tres filas.
      className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0"
    >
      <FilterChip
        active={selected === null}
        onClick={() => onSelect(null)}
        count={total}
        label="Todas"
      />
      {withTasks.map((category) => (
        <FilterChip
          key={category}
          active={selected === category}
          onClick={() => onSelect(selected === category ? null : category)}
          count={counts[category] || 0}
          label={categoryLabel(category, language)}
          hue={categoryHue(category)}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  hue
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  hue?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={hue === undefined ? undefined : ({ "--cat-h": hue } as React.CSSProperties)}
      className={cn(
        "flex flex-none items-center gap-1.5 rounded-chip border px-3 py-1 text-[12.5px] font-semibold transition-colors",
        active
          ? hue === undefined
            ? "border-brand/40 bg-brand-soft text-brand"
            : "cat-chip ring-1 ring-inset ring-current"
          : "border-line bg-surface text-ink-3 hover:border-line-2 hover:text-ink-2"
      )}
    >
      {label}
      <span className="num opacity-60">{count}</span>
    </button>
  );
}

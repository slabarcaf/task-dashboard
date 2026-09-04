"use client";

import { useEffect } from "react";
import { RecurrencePreset, recurrenceFromPreset } from "@/lib/taskFilters";
import { Task } from "@/lib/types";

type Recurrence = Pick<Task, "recurrenceInterval" | "recurrenceUnit">;

/**
 * Keeps a form's stored recurrence in step with the preset the user picked.
 *
 * `apply` must be stable (a `useCallback`), or this re-runs on every render.
 */
export function useRecurrence(
  preset: RecurrencePreset,
  customInterval: number,
  customUnit: "day" | "week" | "month",
  apply: (recurrence: Recurrence) => void
): void {
  useEffect(() => {
    apply(recurrenceFromPreset(preset, customInterval, customUnit));
  }, [preset, customInterval, customUnit, apply]);
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { listTasks, updateTask } from "@/lib/api";
import { normalizeTaskPatch } from "@/lib/taskFilters";
import { Task, TaskPatch } from "@/lib/types";

/**
 * Owns the task list and every mutation that touches it.
 *
 * `applyPatchOptimistic` is the axle: it paints the change, calls the API, and
 * puts the snapshot back if the call fails. Every edit in the app goes through
 * it, so it is also the one place a retry, a queue or a cache would ever need
 * to be added — and the seam where TanStack Query would slot in later, without
 * a single call site changing. See DESIGN.md.
 *
 * Lifted out of `page.tsx` verbatim. Behaviour is unchanged on purpose: the
 * optimistic layer is proven by daily use and this refactor is not the moment
 * to also redesign it.
 */

/** After this many quiet mutations, re-read the server instead of trusting local state. */
const SYNC_REFRESH_THRESHOLD = 4;

type UseTasksOptions = {
  /** Skip loading (and clear the list) while nobody is signed in. */
  isSignedIn: boolean;
  /** Called when the API answers 401, so the shell can drop the session. */
  onUnauthorized: () => void;
  pushToast: (message: string, tone?: "success" | "error") => void;
  setError: (message: string | null) => void;
};

export function useTasks({ isSignedIn, onUnauthorized, pushToast, setError }: UseTasksOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRows, setPendingRows] = useState<Record<number, boolean>>({});
  const [pendingSyncChanges, setPendingSyncChanges] = useState(0);

  const setRowPending = useCallback((rowId: number, pending: boolean) => {
    setPendingRows((current) => ({ ...current, [rowId]: pending }));
  }, []);

  const loadTasks = useCallback(async () => {
    if (!isSignedIn) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const rows = await listTasks();
      setTasks(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load tasks.";
      if (message === "Unauthorized") {
        onUnauthorized();
        setTasks([]);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, onUnauthorized, setError]);

  const registerSuccessfulMutation = useCallback(async () => {
    let shouldRefresh = false;
    setPendingSyncChanges((current) => {
      const next = current + 1;
      if (next >= SYNC_REFRESH_THRESHOLD) {
        shouldRefresh = true;
        return 0;
      }
      return next;
    });

    if (shouldRefresh) {
      await loadTasks();
    }
  }, [loadTasks]);

  // Leaving the tab is the last chance to reconcile before the user comes back
  // on another device and wonders why the two disagree.
  useEffect(() => {
    const syncOnLeave = () => {
      if (pendingSyncChanges > 0) {
        void loadTasks();
        setPendingSyncChanges(0);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        syncOnLeave();
      }
    };

    window.addEventListener("pagehide", syncOnLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", syncOnLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadTasks, pendingSyncChanges]);

  const applyPatchOptimistic = useCallback(
    async (rowId: number, patch: TaskPatch, successMessage: string): Promise<boolean> => {
      const normalized = normalizeTaskPatch(patch);
      if (Object.keys(normalized).length === 0) return true;

      let snapshot: Task[] = [];
      setTasks((current) => {
        snapshot = current;
        return current.map((task) => (task.rowId === rowId ? { ...task, ...normalized } : task));
      });

      setRowPending(rowId, true);
      try {
        await updateTask(rowId, normalized);
        await registerSuccessfulMutation();
        pushToast(successMessage);
        return true;
      } catch (updateError) {
        setTasks(snapshot);
        const message = updateError instanceof Error ? updateError.message : "Update failed.";
        if (message === "Unauthorized") {
          onUnauthorized();
          setTasks([]);
        }
        setError(message);
        pushToast("Update failed", "error");
        return false;
      } finally {
        setRowPending(rowId, false);
      }
    },
    [onUnauthorized, pushToast, registerSuccessfulMutation, setError, setRowPending]
  );

  return {
    tasks,
    setTasks,
    isLoading,
    setIsLoading,
    pendingRows,
    setRowPending,
    loadTasks,
    registerSuccessfulMutation,
    applyPatchOptimistic
  };
}

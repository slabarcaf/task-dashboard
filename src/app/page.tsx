"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Toast } from "@/components/ui/Toast";
import {
  addTask,
  deleteTask,
  getCurrentUser,
  getUserPreferences,
  listTasks,
  logoutUser,
  saveUserPreferences,
  signInWithGoogle,
  updateTask
} from "@/lib/api";
import {
  addDaysToIsoDate,
  compareIsoDates,
  endOfWeekIsoDate,
  todayIsoDate
} from "@/lib/date";
import { AppLanguage, CANONICAL_CATEGORIES, categoryLabel } from "@/lib/categories";
import {
  AddTaskPayload,
  AuthUser,
  STATUS_FINAL_OUTCOME_OPTIONS,
  Task,
  TaskPatch
} from "@/lib/types";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

type TabValue = "add" | "dashboard";
type StatusFilter = "all" | "open" | "done" | "on_hold";
type DueWindow = "today_overdue" | "today" | "this_week" | "overdue" | "all";
type SortOption = "overdue_due" | "due_asc" | "due_desc" | "title_az" | "title_za";
type ViewMode = "list" | "canvas";
type CanvasColumnId = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "no_due";
type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "custom";

type ToastState = {
  visible: boolean;
  message: string;
  tone: "success" | "error";
};

const SYNC_REFRESH_THRESHOLD = 4;

const CANVAS_COLUMNS: Array<{ id: CanvasColumnId; label: string; accent: string }> = [
  { id: "overdue", label: "Overdue", accent: "border-red-300" },
  { id: "today", label: "Today", accent: "border-orange-300" },
  { id: "tomorrow", label: "Tomorrow", accent: "border-amber-300" },
  { id: "this_week", label: "This Week", accent: "border-blue-300" },
  { id: "later", label: "Later", accent: "border-slate-300" },
  { id: "no_due", label: "No Due Date", accent: "border-slate-300" }
];

// Until the settings panel exists (and the language preference moves out of the
// bot's SQLite), the interface follows the browser. Category identifiers stay
// Spanish in the database either way; only the label changes.
const UI_LANGUAGE: AppLanguage =
  typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";

function defaultFormValues(tipo = "Otros"): AddTaskPayload {
  return {
    toDo: "",
    statusFinalOutcome: "To-do",
    tipo,
    nextStep: "",
    dueDateNextStep: todayIsoDate(),
    statusNextStep: "",
    recurrenceInterval: null,
    recurrenceUnit: null
  };
}

function normalizeTipoOptions(options: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of options) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function normalizeDateInput(value: string): string {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ddmmyyyy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

function normalizeTaskPatch(patch: TaskPatch): TaskPatch {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as TaskPatch;
}

function normalizeStatus(status: string): string {
  if (status === "On-hold") return "On hold";
  return status;
}

function normalizeTipoKey(tipo: string): string {
  return String(tipo || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tipoBadgeClass(tipo: string): string {
  const key = normalizeTipoKey(tipo);
  if (key === "finances" || key === "finanzas") return "bg-emerald-100 text-emerald-800";
  if (key === "others" || key === "otros") return "bg-slate-200 text-slate-800";
  if (key === "university" || key === "clases") return "bg-violet-100 text-violet-800";
  if (key === "job" || key === "recruiting") return "bg-indigo-100 text-indigo-800";
  if (key === "personal") return "bg-pink-100 text-pink-800";
  if (key === "household") return "bg-orange-100 text-orange-800";
  return "bg-cyan-100 text-cyan-800";
}

function statusBadgeClass(status: string): string {
  const normalized = normalizeStatus(status);
  if (normalized === "To-do") return "bg-red-100 text-red-800";
  if (normalized === "On-going") return "bg-blue-100 text-blue-800";
  if (normalized === "On hold") return "bg-amber-100 text-amber-900";
  if (normalized === "Done") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-200 text-slate-800";
}

function cardDueTintClass(dueDate: string, today: string, statusFinalOutcome: string): string {
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

function taskSearchText(task: Task): string {
  return [
    task.toDo,
    task.nextStep,
    task.statusNextStep,
    task.tipo,
    normalizeStatus(task.statusFinalOutcome),
    task.dueDateNextStep
  ]
    .join(" ")
    .toLowerCase();
}

function getSuggestionScore(query: string, text: string): number {
  if (!query) return 0;
  if (text.includes(query)) return 1000;

  const queryTokens = query.split(/\s+/).filter(Boolean);
  const textTokens = new Set(text.split(/\s+/).filter(Boolean));

  let score = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      score += 5;
    } else if (text.includes(token)) {
      score += 2;
    }
  }

  if (text.startsWith(query)) score += 3;
  return score;
}

function taskFromPayload(rowId: number, payload: AddTaskPayload): Task {
  return {
    rowId,
    ...payload,
    isPriority: payload.isPriority === true
  };
}

function recurrencePresetFromTask(task: Pick<Task, "recurrenceInterval" | "recurrenceUnit">): RecurrencePreset {
  if (!task.recurrenceInterval || !task.recurrenceUnit) return "none";
  if (task.recurrenceInterval === 1 && task.recurrenceUnit === "day") return "daily";
  if (task.recurrenceInterval === 1 && task.recurrenceUnit === "week") return "weekly";
  if (task.recurrenceInterval === 1 && task.recurrenceUnit === "month") return "monthly";
  return "custom";
}

function getCanvasColumnId(task: Task, today: string, tomorrow: string, weekEnd: string): CanvasColumnId {
  const due = task.dueDateNextStep;
  if (!due) return "no_due";
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === tomorrow) return "tomorrow";
  if (due <= weekEnd) return "this_week";
  return "later";
}

export default function HomePage() {
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const addTaskTitleRef = useRef<HTMLInputElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isPreferencesLoading, setIsPreferencesLoading] = useState(false);
  const [, setUserPreferences] = useState<unknown>(null);
  const [userTipoOptions, setUserTipoOptions] = useState<string[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingSelection, setOnboardingSelection] = useState<string[]>([]);
  const [onboardingCustom, setOnboardingCustom] = useState("");
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);

  const [tab, setTab] = useState<TabValue>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<AddTaskPayload>(() => defaultFormValues());
  const [addRecurrencePreset, setAddRecurrencePreset] = useState<RecurrencePreset>("none");
  const [addRecurrenceInterval, setAddRecurrenceInterval] = useState(2);
  const [addRecurrenceUnit, setAddRecurrenceUnit] = useState<"day" | "week" | "month">("week");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [dueWindow, setDueWindow] = useState<DueWindow>("today_overdue");
  const [sortOption, setSortOption] = useState<SortOption>("due_asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");

  const [pendingRows, setPendingRows] = useState<Record<number, boolean>>({});
  const [pendingSyncChanges, setPendingSyncChanges] = useState(0);

  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AddTaskPayload | null>(null);
  const [editRecurrencePreset, setEditRecurrencePreset] = useState<RecurrencePreset>("none");
  const [editRecurrenceInterval, setEditRecurrenceInterval] = useState(2);
  const [editRecurrenceUnit, setEditRecurrenceUnit] = useState<"day" | "week" | "month">("week");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    tone: "success"
  });

  const pushToast = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ visible: true, message, tone });
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);

  const refreshCurrentUser = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  const loadUserPreferences = useCallback(async () => {
    if (!currentUser) {
      setUserPreferences(null);
      setUserTipoOptions([]);
      setNeedsOnboarding(false);
      return;
    }

    setIsPreferencesLoading(true);
    try {
      const preferences = await getUserPreferences();
      const tipoOptions = normalizeTipoOptions(preferences.tipoOptions);
      const resolvedOptions =
        tipoOptions.length > 0 ? tipoOptions : normalizeTipoOptions([...CANONICAL_CATEGORIES]);

      setUserPreferences(preferences);
      setUserTipoOptions(resolvedOptions);
      setNeedsOnboarding(!preferences.onboardingCompleted);
      setOnboardingSelection(preferences.onboardingCompleted ? resolvedOptions : []);
      setForm((current) => ({
        ...current,
        tipo: resolvedOptions.includes(current.tipo) ? current.tipo : resolvedOptions[0] || "Otros"
      }));
    } catch (preferencesError) {
      setError(
        preferencesError instanceof Error ? preferencesError.message : "Failed to load user preferences."
      );
    } finally {
      setIsPreferencesLoading(false);
    }
  }, [currentUser]);

  const onGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      const credential = String(response.credential || "");
      if (!credential) {
        setError("Google sign-in failed: missing credential.");
        return;
      }

      setIsSigningIn(true);
      setError(null);
      try {
        const user = await signInWithGoogle(credential);
        setCurrentUser(user);
        pushToast("Signed in", "success");
      } catch (signInError) {
        setError(signInError instanceof Error ? signInError.message : "Google sign-in failed.");
      } finally {
        setIsSigningIn(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAuthLoading || currentUser) return;
    if (!googleClientId) return;
    if (!googleButtonRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: onGoogleCredential
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 280
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => {
      setError("Failed to load Google sign-in script.");
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [currentUser, googleClientId, isAuthLoading, onGoogleCredential]);

  useEffect(() => {
    if (!isAuthLoading && currentUser) {
      void loadUserPreferences();
    }
    if (!isAuthLoading && !currentUser) {
      setUserPreferences(null);
      setUserTipoOptions([]);
      setNeedsOnboarding(false);
    }
  }, [currentUser, isAuthLoading, loadUserPreferences]);

  const loadTasks = useCallback(async () => {
    if (!currentUser) {
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
        setCurrentUser(null);
        setTasks([]);
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isAuthLoading && currentUser) {
      void loadTasks();
    }
    if (!isAuthLoading && !currentUser) {
      setTasks([]);
      setIsLoading(false);
    }
  }, [currentUser, isAuthLoading, loadTasks]);

  const today = todayIsoDate();
  const tomorrow = addDaysToIsoDate(today, 1);
  const weekEnd = endOfWeekIsoDate(today);

  const availableTipoOptions = useMemo(() => {
    const fromTasks = tasks.map((task) => task.tipo).filter(Boolean);
    const fromPreferences = userTipoOptions;
    return normalizeTipoOptions([...fromPreferences, ...fromTasks]);
  }, [tasks, userTipoOptions]);

  const applyAddRecurrence = useCallback(
    (
      preset: RecurrencePreset,
      customInterval = addRecurrenceInterval,
      customUnit = addRecurrenceUnit
    ) => {
      if (preset === "none") {
        setForm((current) => ({ ...current, recurrenceInterval: null, recurrenceUnit: null }));
        return;
      }
      if (preset === "daily") {
        setForm((current) => ({ ...current, recurrenceInterval: 1, recurrenceUnit: "day" }));
        return;
      }
      if (preset === "weekly") {
        setForm((current) => ({ ...current, recurrenceInterval: 1, recurrenceUnit: "week" }));
        return;
      }
      if (preset === "monthly") {
        setForm((current) => ({ ...current, recurrenceInterval: 1, recurrenceUnit: "month" }));
        return;
      }
      setForm((current) => ({
        ...current,
        recurrenceInterval: Math.max(1, Number(customInterval || 1)),
        recurrenceUnit: customUnit
      }));
    },
    [addRecurrenceInterval, addRecurrenceUnit]
  );

  const applyEditRecurrence = useCallback(
    (
      preset: RecurrencePreset,
      customInterval = editRecurrenceInterval,
      customUnit = editRecurrenceUnit
    ) => {
      if (preset === "none") {
        setEditForm((current) =>
          current ? { ...current, recurrenceInterval: null, recurrenceUnit: null } : current
        );
        return;
      }
      if (preset === "daily") {
        setEditForm((current) =>
          current ? { ...current, recurrenceInterval: 1, recurrenceUnit: "day" } : current
        );
        return;
      }
      if (preset === "weekly") {
        setEditForm((current) =>
          current ? { ...current, recurrenceInterval: 1, recurrenceUnit: "week" } : current
        );
        return;
      }
      if (preset === "monthly") {
        setEditForm((current) =>
          current ? { ...current, recurrenceInterval: 1, recurrenceUnit: "month" } : current
        );
        return;
      }
      setEditForm((current) =>
        current
          ? {
              ...current,
              recurrenceInterval: Math.max(1, Number(customInterval || 1)),
              recurrenceUnit: customUnit
            }
          : current
      );
    },
    [editRecurrenceInterval, editRecurrenceUnit]
  );

  useEffect(() => {
    if (addRecurrencePreset === "custom") {
      applyAddRecurrence("custom");
    } else {
      applyAddRecurrence(addRecurrencePreset);
    }
  }, [addRecurrencePreset, addRecurrenceInterval, addRecurrenceUnit, applyAddRecurrence]);

  useEffect(() => {
    if (editRecurrencePreset === "custom") {
      applyEditRecurrence("custom");
    } else {
      applyEditRecurrence(editRecurrencePreset);
    }
  }, [editRecurrencePreset, editRecurrenceInterval, editRecurrenceUnit, applyEditRecurrence]);

  const baseFilteredTasks = useMemo(() => {
    const matches = (task: Task): boolean => {
      const normalizedStatus = normalizeStatus(task.statusFinalOutcome);
      if (statusFilter === "done" && normalizedStatus !== "Done") return false;
      if (statusFilter === "open" && (normalizedStatus === "Done" || normalizedStatus === "On hold")) {
        return false;
      }
      if (statusFilter === "on_hold" && normalizedStatus !== "On hold") return false;

      if (tipoFilter !== "all" && task.tipo !== tipoFilter) return false;

      const due = task.dueDateNextStep;
      if (dueWindow === "all") return true;
      if (!due) return false;

      if (dueWindow === "today") return due === today;
      if (dueWindow === "overdue") return due < today;
      if (dueWindow === "this_week") return due >= today && due <= weekEnd;
      return due <= today;
    };

    const filtered = [...tasks].filter(matches);
    const byDefaultOverdueThenDue = (a: Task, b: Task) => {
      const aOverdue = Boolean(a.dueDateNextStep && a.dueDateNextStep < today);
      const bOverdue = Boolean(b.dueDateNextStep && b.dueDateNextStep < today);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return compareIsoDates(a.dueDateNextStep, b.dueDateNextStep);
    };

    filtered.sort((a, b) => {
      if (sortOption === "due_asc") return compareIsoDates(a.dueDateNextStep, b.dueDateNextStep);
      if (sortOption === "due_desc") return compareIsoDates(b.dueDateNextStep, a.dueDateNextStep);
      if (sortOption === "title_az") return a.toDo.localeCompare(b.toDo);
      if (sortOption === "title_za") return b.toDo.localeCompare(a.toDo);
      return byDefaultOverdueThenDue(a, b);
    });

    return filtered;
  }, [dueWindow, sortOption, statusFilter, tasks, tipoFilter, today, weekEnd]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    if (!normalizedSearchQuery) return baseFilteredTasks;
    return baseFilteredTasks.filter((task) => taskSearchText(task).includes(normalizedSearchQuery));
  }, [baseFilteredTasks, normalizedSearchQuery]);

  const suggestionTasks = useMemo(() => {
    if (!normalizedSearchQuery || filteredTasks.length > 0) return [];

    return baseFilteredTasks
      .map((task) => ({
        task,
        score: getSuggestionScore(normalizedSearchQuery, taskSearchText(task))
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || compareIsoDates(a.task.dueDateNextStep, b.task.dueDateNextStep))
      .slice(0, 5)
      .map((entry) => entry.task);
  }, [baseFilteredTasks, filteredTasks.length, normalizedSearchQuery]);

  const canvasBuckets = useMemo(() => {
    const buckets: Record<CanvasColumnId, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      this_week: [],
      later: [],
      no_due: []
    };

    for (const task of filteredTasks) {
      const bucketId = getCanvasColumnId(task, today, tomorrow, weekEnd);
      buckets[bucketId].push(task);
    }

    for (const key of Object.keys(buckets) as CanvasColumnId[]) {
      buckets[key].sort((a, b) => {
        const byDue = compareIsoDates(a.dueDateNextStep, b.dueDateNextStep);
        if (byDue !== 0) return byDue;
        return a.toDo.localeCompare(b.toDo);
      });
    }

    return buckets;
  }, [filteredTasks, today, tomorrow, weekEnd]);

  const setRowPending = (rowId: number, pending: boolean) => {
    setPendingRows((current) => ({ ...current, [rowId]: pending }));
  };

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
        return current.map((task) =>
          task.rowId === rowId
            ? {
                ...task,
                ...normalized
              }
            : task
        );
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
          setCurrentUser(null);
          setTasks([]);
        }
        setError(message);
        pushToast("Update failed", "error");
        return false;
      } finally {
        setRowPending(rowId, false);
      }
    },
    [pushToast, registerSuccessfulMutation]
  );

  const onAddSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedDueDate = normalizeDateInput(form.dueDateNextStep);
    const payload: AddTaskPayload = {
      toDo: form.toDo.trim(),
      statusFinalOutcome: "To-do",
      tipo: form.tipo || userTipoOptions[0] || "Otros",
      nextStep: "",
      dueDateNextStep: normalizedDueDate,
      // This field is formula-driven in Sheets and should not be manually set on add.
      statusNextStep: "",
      recurrenceInterval: form.recurrenceUnit ? form.recurrenceInterval : null,
      recurrenceUnit: form.recurrenceUnit
    };

    if (!payload.toDo || !payload.dueDateNextStep || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dueDateNextStep)) {
      setError("To do and due date are required. Use YYYY-MM-DD date format.");
      return;
    }

    const tempRowId = -Date.now();
    setTasks((current) => [taskFromPayload(tempRowId, payload), ...current]);

    setIsSubmitting(true);
    try {
      const response = await addTask(payload);
      setTasks((current) =>
        current.map((task) =>
          task.rowId === tempRowId
            ? {
                ...task,
                rowId: response.rowId
              }
            : task
        )
      );
      setForm(defaultFormValues(userTipoOptions[0] || "Otros"));
      setAddRecurrencePreset("none");
      setAddRecurrenceInterval(2);
      setAddRecurrenceUnit("week");
      requestAnimationFrame(() => addTaskTitleRef.current?.focus());
      await registerSuccessfulMutation();
      pushToast("Added", "success");
    } catch (addError) {
      setTasks((current) => current.filter((task) => task.rowId !== tempRowId));
      const message = addError instanceof Error ? addError.message : "Failed to add task.";
      if (message === "Unauthorized") {
        setCurrentUser(null);
        setTasks([]);
      }
      setError(message);
      pushToast("Add failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkDone = async (task: Task) => {
    if (task.statusFinalOutcome === "Done") return;
    await applyPatchOptimistic(task.rowId, { statusFinalOutcome: "Done" }, "Marked as done");
  };

  const handleTogglePriority = async (task: Task) => {
    await applyPatchOptimistic(
      task.rowId,
      { isPriority: !task.isPriority },
      task.isPriority ? "Priority removed" : "Marked as priority"
    );
  };

  // Deleting is the one action here that cannot be undone, so it confirms by
  // name first — the same rule the Telegram assistant follows.
  const handleDelete = async (task: Task) => {
    if (!window.confirm(`Delete "${task.toDo}"? This cannot be undone.`)) return;
    const snapshot = tasks;
    setTasks((current) => current.filter((t) => t.rowId !== task.rowId));
    try {
      await deleteTask(task.rowId);
      pushToast("Task deleted");
    } catch (err) {
      setTasks(snapshot);
      pushToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore logout transport errors and clear local state anyway.
    }
    setCurrentUser(null);
    setTasks([]);
    setError(null);
    setUserTipoOptions([]);
    setUserPreferences(null);
    setNeedsOnboarding(false);
    setTab("dashboard");
  };

  const toggleOnboardingTipo = (tipo: string) => {
    setOnboardingSelection((current) => {
      const exists = current.some((item) => item.toLowerCase() === tipo.toLowerCase());
      if (exists) {
        return current.filter((item) => item.toLowerCase() !== tipo.toLowerCase());
      }
      return [...current, tipo];
    });
  };

  const addCustomOnboardingTipo = () => {
    const custom = onboardingCustom.trim();
    if (!custom) return;
    setOnboardingCustom("");
    setOnboardingSelection((current) => normalizeTipoOptions([...current, custom]));
  };

  const completeOnboarding = async () => {
    const finalOptions = normalizeTipoOptions([...onboardingSelection, onboardingCustom.trim()]);
    if (finalOptions.length === 0) {
      setError("Select at least one task type to continue.");
      return;
    }

    setIsSavingOnboarding(true);
    setError(null);
    try {
      const preferences = await saveUserPreferences(finalOptions);
      setUserPreferences(preferences);
      setUserTipoOptions(preferences.tipoOptions);
      setNeedsOnboarding(false);
      setOnboardingCustom("");
      setForm((current) => ({
        ...current,
        tipo: preferences.tipoOptions.includes(current.tipo)
          ? current.tipo
          : preferences.tipoOptions[0] || "Otros"
      }));
      pushToast("Preferences saved", "success");
    } catch (onboardingError) {
      setError(onboardingError instanceof Error ? onboardingError.message : "Failed to save preferences.");
    } finally {
      setIsSavingOnboarding(false);
    }
  };

  const handleMoveTomorrow = async (task: Task) => {
    const nextDate = addDaysToIsoDate(today, 1);
    await applyPatchOptimistic(task.rowId, { dueDateNextStep: nextDate }, "Moved to tomorrow");
  };

  const openEditModal = (task: Task) => {
    const preset = recurrencePresetFromTask(task);
    setEditRowId(task.rowId);
    setEditForm({
      toDo: task.toDo,
      statusFinalOutcome: task.statusFinalOutcome || "To-do",
      tipo: task.tipo || availableTipoOptions[0] || "Otros",
      nextStep: task.nextStep || "",
      dueDateNextStep: task.dueDateNextStep || today,
      statusNextStep: task.statusNextStep || "",
      recurrenceInterval: task.recurrenceInterval,
      recurrenceUnit: task.recurrenceUnit
    });
    setEditRecurrencePreset(preset);
    if (task.recurrenceInterval) setEditRecurrenceInterval(task.recurrenceInterval);
    if (task.recurrenceUnit) setEditRecurrenceUnit(task.recurrenceUnit);
  };

  const closeEditModal = () => {
    setEditRowId(null);
    setEditForm(null);
    setEditRecurrencePreset("none");
    setEditRecurrenceInterval(2);
    setEditRecurrenceUnit("week");
  };

  const saveEdit = async () => {
    if (editRowId === null || !editForm) return;

    setIsSavingEdit(true);
    const ok = await applyPatchOptimistic(
      editRowId,
      {
        toDo: editForm.toDo.trim(),
        statusFinalOutcome: editForm.statusFinalOutcome,
        tipo: editForm.tipo,
        nextStep: editForm.nextStep.trim(),
        dueDateNextStep: editForm.dueDateNextStep,
        recurrenceInterval: editForm.recurrenceUnit ? editForm.recurrenceInterval : null,
        recurrenceUnit: editForm.recurrenceUnit
      },
      "Task updated"
    );

    setIsSavingEdit(false);
    if (ok) closeEditModal();
  };

  if (isAuthLoading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Task Dashboard</h1>
            <p className="text-sm text-slate-600">Checking your session...</p>
          </header>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Task Dashboard</h1>
            <p className="text-sm text-slate-600">
              Sign in with Google to access your own tasks and keep them private.
            </p>
          </header>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use your Google account. You will stay signed in for 15 days.
            </p>
            {!googleClientId && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local`.
              </p>
            )}
            <div className="mt-4">
              <div ref={googleButtonRef} />
            </div>
            {isSigningIn && <p className="mt-3 text-sm text-slate-600">Signing in...</p>}
          </section>
        </div>
      </main>
    );
  }

  if (isPreferencesLoading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Task Dashboard</h1>
            <p className="text-sm text-slate-600">Loading your preferences...</p>
          </header>
        </div>
      </main>
    );
  }

  if (needsOnboarding) {
    const suggested = [...CANONICAL_CATEGORIES];
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Task Dashboard</h1>
              <p className="text-sm text-slate-600">
                Pick your task types so your workspace matches your workflow.
              </p>
            </div>
            <Button variant="ghost" onClick={() => void handleLogout()}>
              Log out
            </Button>
          </header>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Onboarding</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select the task types you want. You can customize this later.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {suggested.map((tipo) => {
                const selected = onboardingSelection.some(
                  (option) => option.toLowerCase() === tipo.toLowerCase()
                );
                return (
                  <button
                    key={tipo}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected
                        ? "border-brand-500 bg-brand-100 text-brand-800"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                    onClick={() => toggleOnboardingTipo(tipo)}
                  >
                    {tipo}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={onboardingCustom}
                onChange={(event) => setOnboardingCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomOnboardingTipo();
                  }
                }}
                placeholder="Add custom type (e.g., Health)"
              />
              <Button type="button" variant="secondary" onClick={addCustomOnboardingTipo}>
                Add
              </Button>
            </div>

            {onboardingSelection.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {onboardingSelection.map((tipo) => (
                  <Badge key={tipo}>{tipo}</Badge>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={() => void completeOnboarding()} disabled={isSavingOnboarding}>
                {isSavingOnboarding ? "Saving..." : "Continue"}
              </Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Task Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm text-slate-600">
              <p className="font-medium text-slate-900">{currentUser.name || currentUser.email}</p>
              <p>{currentUser.email}</p>
            </div>
            <Button variant="ghost" onClick={() => void handleLogout()}>
              Log out
            </Button>
          </div>
        </header>

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "add", label: "Add" },
            { value: "dashboard", label: "Dashboard" }
          ]}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {tab === "add" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Task</h2>
            <p className="mb-4 text-sm text-slate-600">Quick add: title, type, and due date.</p>
            <form className="grid grid-cols-1 gap-4 md:grid-cols-3" onSubmit={onAddSubmit}>
              <label className="space-y-1 md:col-span-3">
                <span className="text-sm font-medium text-slate-700">To do *</span>
                <Input
                  ref={addTaskTitleRef}
                  autoFocus
                  required
                  value={form.toDo}
                  onChange={(event) => setForm((current) => ({ ...current, toDo: event.target.value }))}
                  placeholder="Describe the task (e.g., Follow up with Company X)"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Tipo</span>
                <Select
                  value={form.tipo}
                  onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value }))}
                >
                  {availableTipoOptions.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Due date for next step *</span>
                <Input
                  type="date"
                  required
                  value={form.dueDateNextStep}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dueDateNextStep: event.target.value }))
                  }
                />
              </label>

              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Repeats</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["none", "Does not repeat"],
                    ["daily", "Daily"],
                    ["weekly", "Weekly"],
                    ["monthly", "Monthly"],
                    ["custom", "Custom"]
                  ] as Array<[RecurrencePreset, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        addRecurrencePreset === value
                          ? "border-brand-500 bg-brand-100 text-brand-800"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                      onClick={() => setAddRecurrencePreset(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {addRecurrencePreset === "custom" && (
                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    <Input
                      type="number"
                      min={1}
                      value={addRecurrenceInterval}
                      onChange={(event) =>
                        setAddRecurrenceInterval(Math.max(1, Number(event.target.value || 1)))
                      }
                    />
                    <Select
                      value={addRecurrenceUnit}
                      onChange={(event) =>
                        setAddRecurrenceUnit(event.target.value as "day" | "week" | "month")
                      }
                    >
                      <option value="day">day(s)</option>
                      <option value="week">week(s)</option>
                      <option value="month">month(s)</option>
                    </Select>
                  </div>
                )}
              </div>

              <div className="md:col-span-3 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add task"}
                </Button>
              </div>
            </form>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-white to-brand-50 p-4 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">View mode</span>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      viewMode === "list"
                        ? "bg-brand-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setViewMode("list")}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      viewMode === "canvas"
                        ? "bg-brand-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setViewMode("canvas")}
                  >
                    Canvas
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    statusFilter === "open"
                      ? "border-brand-500 bg-brand-100 text-brand-800"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setStatusFilter("open")}
                >
                  Open
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    statusFilter === "on_hold"
                      ? "border-brand-500 bg-brand-100 text-brand-800"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setStatusFilter("on_hold")}
                >
                  On-hold
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    statusFilter === "done"
                      ? "border-brand-500 bg-brand-100 text-brand-800"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setStatusFilter("done")}
                >
                  Done
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    statusFilter === "all"
                      ? "border-brand-500 bg-brand-100 text-brand-800"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="on_hold">On-hold</option>
                    <option value="done">Done</option>
                  </Select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Tipo</span>
                  <Select value={tipoFilter} onChange={(event) => setTipoFilter(event.target.value)}>
                    <option value="all">All</option>
                    {availableTipoOptions.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Due window</span>
                  <Select
                    value={dueWindow}
                    onChange={(event) => setDueWindow(event.target.value as DueWindow)}
                  >
                    <option value="today_overdue">Today + Overdue</option>
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="overdue">Overdue</option>
                    <option value="all">All</option>
                  </Select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Sort</span>
                  <Select
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as SortOption)}
                  >
                    <option value="due_asc">Due date (oldest to newest)</option>
                    <option value="overdue_due">Overdue first + due soonest</option>
                    <option value="due_desc">Due date (latest first)</option>
                    <option value="title_az">Title A-Z</option>
                    <option value="title_za">Title Z-A</option>
                  </Select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Search</span>
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="letters, words, or phrase"
                  />
                </label>

                <div className="flex items-end">
                  <Button variant="secondary" className="w-full" onClick={() => void loadTasks()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{filteredTasks.length}</span> tasks
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                <p>No tasks match your filters.</p>
                {normalizedSearchQuery && suggestionTasks.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-sm text-slate-700">You may referred to:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestionTasks.map((task) => (
                        <button
                          key={task.rowId}
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => setSearchQuery(task.toDo)}
                        >
                          {task.toDo}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : viewMode === "list" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredTasks.map((task) => {
                  const isOverdue = Boolean(task.dueDateNextStep && task.dueDateNextStep < today);
                  const rowPending = Boolean(pendingRows[task.rowId]);

                  return (
                    <article
                      key={task.rowId}
                      className={`rounded-2xl border border-slate-200 p-4 shadow-sm ${cardDueTintClass(
                        task.dueDateNextStep,
                        today,
                        task.statusFinalOutcome
                      )}`}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {task.isPriority && (
                            <span className="mr-1" title="Priority" aria-label="Priority">🔴</span>
                          )}
                          {task.toDo}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tipoBadgeClass(
                              task.tipo || "Otros"
                            )}`}
                          >
                            {categoryLabel(task.tipo || "Otros", UI_LANGUAGE)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              task.statusFinalOutcome || "To-do"
                            )}`}
                          >
                            {task.statusFinalOutcome || "To-do"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-slate-700">
                        <p>
                          Due:{" "}
                          <span
                            className={isOverdue ? "font-semibold text-red-700" : "font-medium text-slate-900"}
                          >
                            {task.dueDateNextStep || "-"}
                          </span>
                        </p>
                        {task.nextStep && <p>Next step: {task.nextStep}</p>}
                        <p>Status for next step: {task.statusNextStep || "-"}</p>
                        {task.recurrenceUnit && task.recurrenceInterval && (
                          <p>
                            Repeats: every {task.recurrenceInterval} {task.recurrenceUnit}
                            {task.recurrenceInterval > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          disabled={rowPending || task.statusFinalOutcome === "Done"}
                          onClick={() => void handleMarkDone(task)}
                        >
                          Mark Done
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={rowPending}
                          onClick={() => void handleMoveTomorrow(task)}
                        >
                          Move to tomorrow
                        </Button>
                        <Button variant="ghost" disabled={rowPending} onClick={() => openEditModal(task)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={rowPending}
                          onClick={() => void handleTogglePriority(task)}
                          aria-pressed={task.isPriority}
                        >
                          {task.isPriority ? "🔴 Priority" : "Set priority"}
                        </Button>
                        <Button variant="ghost" disabled={rowPending} onClick={() => void handleDelete(task)}>
                          Delete
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max gap-4">
                  {CANVAS_COLUMNS.map((column) => {
                    const tasksInColumn = canvasBuckets[column.id];
                    return (
                      <section
                        key={column.id}
                        className={`w-72 shrink-0 rounded-2xl border bg-white p-3 shadow-sm ${column.accent}`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900">{column.label}</h3>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {tasksInColumn.length}
                          </span>
                        </div>

                        {tasksInColumn.length === 0 ? (
                          <p className="text-xs text-slate-500">No tasks</p>
                        ) : (
                          <div className="space-y-3">
                            {tasksInColumn.map((task) => {
                              const isOverdue = Boolean(task.dueDateNextStep && task.dueDateNextStep < today);
                              const rowPending = Boolean(pendingRows[task.rowId]);
                              return (
                                <article
                                  key={task.rowId}
                                  className={`rounded-xl border border-slate-200 p-3 ${cardDueTintClass(
                                    task.dueDateNextStep,
                                    today,
                                    task.statusFinalOutcome
                                  )}`}
                                >
                                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-slate-900">
                                      {task.isPriority && (
                                        <span className="mr-1" title="Priority" aria-label="Priority">🔴</span>
                                      )}
                                      {task.toDo}
                                    </h4>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tipoBadgeClass(
                                        task.tipo || "Otros"
                                      )}`}
                                    >
                                      {categoryLabel(task.tipo || "Otros", UI_LANGUAGE)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-700">
                                    Due:{" "}
                                    <span
                                      className={isOverdue ? "font-semibold text-red-700" : "font-medium text-slate-900"}
                                    >
                                      {task.dueDateNextStep || "-"}
                                    </span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-700">
                                    Status:{" "}
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${statusBadgeClass(
                                        task.statusFinalOutcome || "To-do"
                                      )}`}
                                    >
                                      {task.statusFinalOutcome || "To-do"}
                                    </span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-700">
                                    Next step status: {task.statusNextStep || "-"}
                                  </p>
                                  {task.recurrenceUnit && task.recurrenceInterval && (
                                    <p className="mt-1 text-xs text-slate-700">
                                      Repeats: every {task.recurrenceInterval} {task.recurrenceUnit}
                                      {task.recurrenceInterval > 1 ? "s" : ""}
                                    </p>
                                  )}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                      variant="primary"
                                      className="px-2 py-1 text-xs"
                                      disabled={rowPending || task.statusFinalOutcome === "Done"}
                                      onClick={() => void handleMarkDone(task)}
                                    >
                                      Done
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      className="px-2 py-1 text-xs"
                                      disabled={rowPending}
                                      onClick={() => void handleMoveTomorrow(task)}
                                    >
                                      Tomorrow
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="px-2 py-1 text-xs"
                                      disabled={rowPending}
                                      onClick={() => openEditModal(task)}
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <Modal open={Boolean(editForm && editRowId !== null)} title="Edit Task" onClose={closeEditModal}>
        {editForm && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">To do *</span>
              <Input
                value={editForm.toDo}
                onChange={(event) => setEditForm((current) => (current ? { ...current, toDo: event.target.value } : current))}
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Status Final outcome</span>
              <Select
                value={editForm.statusFinalOutcome}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, statusFinalOutcome: event.target.value } : current
                  )
                }
              >
                {STATUS_FINAL_OUTCOME_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tipo</span>
              <Select
                value={editForm.tipo}
                onChange={(event) =>
                  setEditForm((current) => (current ? { ...current, tipo: event.target.value } : current))
                }
              >
                {availableTipoOptions.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Next step</span>
              <Input
                value={editForm.nextStep}
                onChange={(event) =>
                  setEditForm((current) => (current ? { ...current, nextStep: event.target.value } : current))
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Due date for next step *</span>
              <Input
                type="date"
                value={editForm.dueDateNextStep}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, dueDateNextStep: event.target.value } : current
                  )
                }
              />
            </label>

            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Repeats</span>
              <div className="flex flex-wrap gap-2">
                {([
                  ["none", "Does not repeat"],
                  ["daily", "Daily"],
                  ["weekly", "Weekly"],
                  ["monthly", "Monthly"],
                  ["custom", "Custom"]
                ] as Array<[RecurrencePreset, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      editRecurrencePreset === value
                        ? "border-brand-500 bg-brand-100 text-brand-800"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                    onClick={() => setEditRecurrencePreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {editRecurrencePreset === "custom" && (
                <div className="grid grid-cols-2 gap-2 max-w-sm">
                  <Input
                    type="number"
                    min={1}
                    value={editRecurrenceInterval}
                    onChange={(event) =>
                      setEditRecurrenceInterval(Math.max(1, Number(event.target.value || 1)))
                    }
                  />
                  <Select
                    value={editRecurrenceUnit}
                    onChange={(event) =>
                      setEditRecurrenceUnit(event.target.value as "day" | "week" | "month")
                    }
                  >
                    <option value="day">day(s)</option>
                    <option value="week">week(s)</option>
                    <option value="month">month(s)</option>
                  </Select>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button onClick={() => void saveEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Toast visible={toast.visible} message={toast.message} tone={toast.tone} />
    </main>
  );
}

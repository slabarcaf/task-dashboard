"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, AppView } from "@/components/AppShell";
import { BoardView } from "@/components/BoardView";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DebtsView } from "@/components/DebtsView";
import { CommandPalette, PaletteCommand } from "@/components/CommandPalette";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { OnboardingAnswers, OnboardingScreen } from "@/components/OnboardingScreen";
import { QuickCapture } from "@/components/QuickCapture";
import { SignInScreen } from "@/components/SignInScreen";
import { TelegramNudge } from "@/components/TelegramNudge";
import { TodayView } from "@/components/TodayView";
import { Toast } from "@/components/ui/Toast";
import { useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import {
  Debt,
  addDebt,
  addTask,
  deleteTask,
  listDebts,
  removeDebt,
  setDebtStatus,
  getCurrentUser,
  getUserPreferences,
  logoutUser,
  signInWithGoogle,
  updatePreferences
} from "@/lib/api";
import { AppLanguage } from "@/lib/categories";
import { addDaysToIsoDate, endOfWeekIsoDate, todayIsoDate } from "@/lib/date";
import { normalizeStatus, normalizeTipoOptions, taskFromPayload } from "@/lib/taskFilters";
import { AddTaskPayload, AuthUser, Task, TaskPatch } from "@/lib/types";

/**
 * The interface is in Spanish, full stop.
 *
 * This used to follow `navigator.language`, which produced something worse than
 * either language: every chrome string here is hardcoded Spanish, so an English
 * browser got "VENCIDAS / Esta semana" sitting above chips reading "Priority"
 * and "Other". Half a translation is not a translation.
 *
 * `categoryLabel` still takes a language and still translates, so the moment the
 * chrome strings are extracted this becomes a real preference instead of a
 * constant. Category identifiers are Spanish in the database either way — only
 * the label ever changes.
 */
const UI_LANGUAGE: AppLanguage = "es";

export default function HomePage() {
  const router = useRouter();
  const captureRef = useRef<HTMLInputElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isPreferencesLoading, setIsPreferencesLoading] = useState(false);
  const [userTipoOptions, setUserTipoOptions] = useState<string[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);

  const [error, setError] = useState<string | null>(null);
  // El tablero es la vista por defecto: da la forma de la semana de un vistazo,
  // que es lo que se quiere al abrir. "Hoy" es la lista para trabajar dentro.
  const [view, setView] = useState<AppView>("board");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtsLoaded, setDebtsLoaded] = useState(false);
  const [debtPending, setDebtPending] = useState<Record<number, boolean>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { toast, pushToast, pushUndoToast } = useToast();
  const dropSession = useCallback(() => setCurrentUser(null), []);

  const {
    tasks,
    setTasks,
    isLoading,
    pendingRows,
    loadTasks,
    applyPatchOptimistic
  } = useTasks({
    isSignedIn: Boolean(currentUser),
    onUnauthorized: dropSession,
    pushToast,
    setError
  });

  const today = todayIsoDate();
  const tomorrow = addDaysToIsoDate(today, 1);
  const weekEnd = endOfWeekIsoDate(today);

  /* ── session ─────────────────────────────────────────────────────────── */

  const refreshCurrentUser = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      setCurrentUser(await getCurrentUser());
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  const onGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      const credential = String(response.credential || "");
      if (!credential) {
        setError("Google no devolvió una credencial.");
        return;
      }
      setIsSigningIn(true);
      setError(null);
      try {
        setCurrentUser(await signInWithGoogle(credential));
      } catch (signInError) {
        setError(signInError instanceof Error ? signInError.message : "No se pudo entrar.");
      } finally {
        setIsSigningIn(false);
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setCurrentUser(null);
      setTasks([]);
      setUserTipoOptions([]);
      setNeedsOnboarding(false);
    }
  }, [setTasks]);

  /* ── preferences ─────────────────────────────────────────────────────── */

  const loadUserPreferences = useCallback(async () => {
    if (!currentUser) return;
    setIsPreferencesLoading(true);
    try {
      const preferences = await getUserPreferences();
      const options = normalizeTipoOptions(preferences.tipoOptions);
      setUserTipoOptions(options);
      setNeedsOnboarding(!preferences.onboardingCompleted);
    } catch (preferencesError) {
      setError(
        preferencesError instanceof Error
          ? preferencesError.message
          : "No se pudieron cargar tus preferencias."
      );
    } finally {
      setIsPreferencesLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isAuthLoading && currentUser) void loadUserPreferences();
  }, [currentUser, isAuthLoading, loadUserPreferences]);

  // En el teléfono la lista gana: seis columnas que se deslizan de lado no son
  // la forma de abrir la app con una mano. Se corrige después de montar y no en
  // el estado inicial, porque el servidor no sabe el ancho de la pantalla y el
  // HTML tiene que coincidir. Solo la primera vez: después manda quien elija.
  useEffect(() => {
    if (window.innerWidth < 640) setView("today");
  }, []);

  // `loadTasks` clears the list itself when nobody is signed in.
  useEffect(() => {
    if (isAuthLoading) return;
    void loadTasks();
  }, [isAuthLoading, loadTasks]);

  /**
   * Guarda todo el onboarding en una sola pasada.
   *
   * La tarea de ejemplo va primero a propósito: `updatePreferences` es lo que
   * marca el onboarding como terminado, y si esa pantalla se cerrara antes de
   * crear la tarea, alguien podría quedarse sin la tarea que acaba de escribir y
   * sin forma de volver a esa pantalla.
   */
  const completeOnboarding = useCallback(
    async (answers: OnboardingAnswers) => {
      if (answers.categories.length === 0) {
        setError("Elige al menos una categoría.");
        return;
      }
      setIsSavingOnboarding(true);
      setError(null);
      try {
        if (answers.firstTask) {
          const payload: AddTaskPayload = {
            toDo: answers.firstTask.title,
            statusFinalOutcome: "To-do",
            tipo: answers.firstTask.tipo,
            nextStep: "",
            dueDateNextStep: answers.firstTask.dueDate,
            statusNextStep: "",
            recurrenceInterval: null,
            recurrenceUnit: null
          };
          const created = await addTask(payload);
          setTasks((current) => [taskFromPayload(created.rowId, payload), ...current]);
        }

        const preferences = await updatePreferences({
          tipoOptions: answers.categories,
          timezone: answers.timezone,
          briefMorning: answers.briefMorning,
          briefEvening: answers.briefEvening
        });
        setUserTipoOptions(preferences.tipoOptions);
        setNeedsOnboarding(false);
        pushToast("Listo");
      } catch (onboardingError) {
        setError(
          onboardingError instanceof Error ? onboardingError.message : "No se pudo guardar."
        );
      } finally {
        setIsSavingOnboarding(false);
      }
    },
    [pushToast, setTasks]
  );

  /* ── task actions ────────────────────────────────────────────────────── */

  const categories = useMemo(() => {
    const fromTasks = tasks.map((task) => task.tipo).filter(Boolean);
    return normalizeTipoOptions([...userTipoOptions, ...fromTasks, "Otros"]);
  }, [tasks, userTipoOptions]);

  const openTasks = useMemo(
    () => tasks.filter((task) => normalizeStatus(task.statusFinalOutcome) !== "Done"),
    [tasks]
  );

  // Se cuenta sobre lo abierto, no sobre todo: un "Finanzas 49" donde 48 están
  // hechas promete una lista que no existe.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of openTasks) {
      const key = task.tipo || "Otros";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [openTasks]);

  const visibleTasks = useMemo(
    () => (categoryFilter ? tasks.filter((task) => task.tipo === categoryFilter) : tasks),
    [categoryFilter, tasks]
  );

  /* ── deudas ──────────────────────────────────────────────────────────── */

  // Se cargan al abrir la pestaña y no al entrar: la mayoría de las sesiones
  // nunca las mira, y una consulta que nadie pidió es latencia regalada.
  const loadDebts = useCallback(async () => {
    try {
      setDebts(await listDebts());
      setDebtsLoaded(true);
    } catch (debtsError) {
      setError(debtsError instanceof Error ? debtsError.message : "No se pudieron cargar las deudas.");
      setDebtsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (view === "debts" && !debtsLoaded && currentUser) void loadDebts();
  }, [currentUser, debtsLoaded, loadDebts, view]);

  const handleAddDebt = useCallback(
    async (input: Parameters<typeof addDebt>[0]) => {
      try {
        const debt = await addDebt(input);
        setDebts((current) => [debt, ...current]);
        pushToast("Anotada");
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "No se pudo anotar.");
        pushToast("No se pudo anotar", "error");
      }
    },
    [pushToast]
  );

  const markDebt = useCallback(
    async (debt: Debt, status: "Por pagar" | "Pagado") => {
      setDebtPending((current) => ({ ...current, [debt.id]: true }));
      try {
        const updated = await setDebtStatus(debt.id, status);
        setDebts((current) => current.map((row) => (row.id === debt.id ? updated : row)));
      } catch (updateError) {
        pushToast(updateError instanceof Error ? updateError.message : "No se pudo actualizar", "error");
      } finally {
        setDebtPending((current) => ({ ...current, [debt.id]: false }));
      }
    },
    [pushToast]
  );

  const handleToggleDebt = useCallback(
    (debt: Debt) => {
      const next = debt.status === "Pagado" ? "Por pagar" : "Pagado";
      void markDebt(debt, next);
      if (next === "Pagado") {
        pushUndoToast("Marcada como pagada", "Deshacer", () => void markDebt(debt, "Por pagar"));
      }
    },
    [markDebt, pushUndoToast]
  );

  const handleDeleteDebt = useCallback(
    async (debt: Debt) => {
      const snapshot = debts;
      setDebts((current) => current.filter((row) => row.id !== debt.id));
      try {
        await removeDebt(debt.id);
        // Como en las tareas: se borra y se ofrece la vuelta. Al deshacer vuelve
        // con id nuevo, que a nadie le consta salvo a un enlace guardado.
        pushUndoToast("Eliminada", "Deshacer", () => {
          void (async () => {
            try {
              const restored = await addDebt({
                name: debt.name,
                amount: debt.amount,
                currency: debt.currency,
                direction: debt.direction,
                reason: debt.reason
              });
              setDebts((current) => [restored, ...current]);
              if (debt.status === "Pagado") void markDebt(restored, "Pagado");
            } catch {
              pushToast("No se pudo recuperar", "error");
            }
          })();
        });
      } catch (deleteError) {
        setDebts(snapshot);
        pushToast(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar", "error");
      }
    },
    [debts, markDebt, pushToast, pushUndoToast]
  );

  const handleQuickAdd = useCallback(
    async (input: { title: string; dueDate: string; tipo: string }) => {
      const payload: AddTaskPayload = {
        toDo: input.title,
        statusFinalOutcome: "To-do",
        tipo: input.tipo,
        nextStep: "",
        dueDateNextStep: input.dueDate,
        statusNextStep: "",
        recurrenceInterval: null,
        recurrenceUnit: null
      };
      try {
        const created = await addTask(payload);
        setTasks((current) => [taskFromPayload(created.rowId, payload), ...current]);
        pushToast("Agregada");
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "No se pudo agregar.");
        pushToast("No se pudo agregar", "error");
      }
    },
    [pushToast, setTasks]
  );

  // Done is a status flip, so undo is the same call in reverse — no need to warn
  // anybody first, which is the whole point of undo over confirm.
  const handleToggleDone = useCallback(
    async (task: Task) => {
      const wasDone = normalizeStatus(task.statusFinalOutcome) === "Done";
      const next = wasDone ? "To-do" : "Done";
      const ok = await applyPatchOptimistic(
        task.rowId,
        { statusFinalOutcome: next },
        wasDone ? "Reabierta" : "Hecha"
      );
      if (ok && !wasDone) {
        pushUndoToast("Hecha", "Deshacer", () => {
          void applyPatchOptimistic(
            task.rowId,
            { statusFinalOutcome: task.statusFinalOutcome || "To-do" },
            "Reabierta"
          );
        });
      }
    },
    [applyPatchOptimistic, pushUndoToast]
  );

  const handleMoveTomorrow = useCallback(
    async (task: Task) => {
      const previous = task.dueDateNextStep;
      const ok = await applyPatchOptimistic(
        task.rowId,
        { dueDateNextStep: tomorrow },
        "Movida a mañana"
      );
      if (ok) {
        pushUndoToast("Movida a mañana", "Deshacer", () => {
          void applyPatchOptimistic(
            task.rowId,
            { dueDateNextStep: previous },
            "Fecha restaurada"
          );
        });
      }
    },
    [applyPatchOptimistic, pushUndoToast, tomorrow]
  );

  const handleTogglePriority = useCallback(
    async (task: Task) => {
      await applyPatchOptimistic(
        task.rowId,
        { isPriority: !task.isPriority },
        task.isPriority ? "Sin prioridad" : "Con prioridad"
      );
    },
    [applyPatchOptimistic]
  );

  /**
   * Deletes immediately and offers the way back, replacing a window.confirm().
   *
   * ⚠️ Undo re-creates the task, so it comes back with a **new row id**. Nothing
   * a person can see depends on that id, but anything that stored one — a link,
   * an open Telegram thread — will be pointing at a row that no longer exists.
   * The alternative, deferring the delete until the toast expires, trades that
   * for a worse failure: close the tab within seven seconds and the "deleted"
   * task quietly survives.
   */
  const handleDelete = useCallback(
    async (task: Task) => {
      const snapshot = tasks;
      setTasks((current) => current.filter((row) => row.rowId !== task.rowId));
      try {
        await deleteTask(task.rowId);
        pushUndoToast("Eliminada", "Deshacer", () => {
          void (async () => {
            // Everything but the id: the recreated row gets a fresh one.
            const payload: AddTaskPayload = {
              toDo: task.toDo,
              statusFinalOutcome: task.statusFinalOutcome,
              tipo: task.tipo,
              nextStep: task.nextStep,
              dueDateNextStep: task.dueDateNextStep,
              statusNextStep: task.statusNextStep,
              recurrenceInterval: task.recurrenceInterval,
              recurrenceUnit: task.recurrenceUnit,
              isPriority: task.isPriority
            };
            try {
              const restored = await addTask(payload);
              setTasks((current) => [taskFromPayload(restored.rowId, payload), ...current]);
              pushToast("Recuperada");
            } catch {
              pushToast("No se pudo recuperar", "error");
            }
          })();
        });
      } catch (deleteError) {
        setTasks(snapshot);
        pushToast(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar", "error");
      }
    },
    [pushToast, pushUndoToast, setTasks, tasks]
  );

  const editingTask = useMemo(
    () => tasks.find((task) => task.rowId === editingRowId) || null,
    [editingRowId, tasks]
  );

  const handleSaveEdit = useCallback(
    async (rowId: number, patch: TaskPatch) => {
      setIsSavingEdit(true);
      const ok = await applyPatchOptimistic(rowId, patch, "Guardada");
      setIsSavingEdit(false);
      if (ok) setEditingRowId(null);
    },
    [applyPatchOptimistic]
  );

  const taskActions = useMemo(
    () => ({
      onToggleDone: (task: Task) => void handleToggleDone(task),
      onEdit: (task: Task) => setEditingRowId(task.rowId),
      onMoveTomorrow: (task: Task) => void handleMoveTomorrow(task),
      onTogglePriority: (task: Task) => void handleTogglePriority(task),
      onDelete: (task: Task) => void handleDelete(task)
    }),
    [handleDelete, handleMoveTomorrow, handleToggleDone, handleTogglePriority]
  );

  /* ── keyboard ────────────────────────────────────────────────────────── */

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "new",
        label: "Nueva tarea",
        hint: "n",
        run: () => captureRef.current?.focus()
      },
      { id: "today", label: "Ver Hoy", run: () => setView("today") },
      { id: "settings", label: "Ajustes", run: () => router.push("/ajustes") },
      { id: "telegram", label: "Conectar Telegram", run: () => router.push("/ajustes") },
      { id: "board", label: "Ver Tablero", run: () => setView("board") },
      { id: "debts", label: "Ver Deudas", run: () => setView("debts") },
      {
        id: "theme",
        label: theme === "dark" ? "Modo claro" : "Modo oscuro",
        run: toggleTheme
      },
      { id: "reload", label: "Recargar tareas", run: () => void loadTasks() }
    ],
    [loadTasks, router, theme, toggleTheme]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // Single-letter shortcuts must never fire while someone is writing a task
      // that happens to contain the letter n.
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "n") {
        event.preventDefault();
        captureRef.current?.focus();
      }
      if (event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ── render ──────────────────────────────────────────────────────────── */

  if (isAuthLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg">
        <p className="text-sm text-ink-3">Revisando tu sesión…</p>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <SignInScreen
        clientId={googleClientId}
        isSigningIn={isSigningIn}
        error={error}
        onCredential={onGoogleCredential}
        onScriptError={setError}
      />
    );
  }

  if (isPreferencesLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg">
        <p className="text-sm text-ink-3">Cargando tus preferencias…</p>
      </main>
    );
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen
        language={UI_LANGUAGE}
        initialSelection={userTipoOptions}
        isSaving={isSavingOnboarding}
        error={error}
        onComplete={(answers) => void completeOnboarding(answers)}
      />
    );
  }

  return (
    <AppShell
      user={currentUser}
      view={view}
      onViewChange={setView}
      onLogout={() => void handleLogout()}
      onOpenPalette={() => setPaletteOpen(true)}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {error && (
        <p className="mb-4 rounded-card border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
          {error}
        </p>
      )}

      {view !== "debts" && (
        <div className="mb-6">
          <QuickCapture
          ref={captureRef}
          today={today}
          language={UI_LANGUAGE}
          categories={categories}
          defaultCategory={categories[0] || "Otros"}
          disabled={isLoading}
            onAdd={handleQuickAdd}
          />
        </div>
      )}

      {view !== "debts" && !isLoading && (
        <CategoryFilter
          categories={categories}
          selected={categoryFilter}
          counts={categoryCounts}
          total={openTasks.length}
          language={UI_LANGUAGE}
          onSelect={setCategoryFilter}
        />
      )}

      {view === "debts" ? (
        <DebtsView
          debts={debts}
          isLoading={!debtsLoaded}
          pendingIds={debtPending}
          onAdd={handleAddDebt}
          onToggleStatus={handleToggleDebt}
          onDelete={(debt) => void handleDeleteDebt(debt)}
        />
      ) : isLoading ? (
        <p className="py-12 text-center text-sm text-ink-3">Cargando tus tareas…</p>
      ) : view === "today" ? (
        <TodayView
          tasks={visibleTasks}
          today={today}
          weekEnd={weekEnd}
          language={UI_LANGUAGE}
          pendingRows={pendingRows}
          {...taskActions}
        />
      ) : (
        <BoardView
          tasks={visibleTasks.filter(
            (task) => normalizeStatus(task.statusFinalOutcome) !== "Done"
          )}
          today={today}
          tomorrow={tomorrow}
          weekEnd={weekEnd}
          language={UI_LANGUAGE}
          pendingRows={pendingRows}
          {...taskActions}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          key={editingTask.rowId}
          task={editingTask}
          categories={categories}
          language={UI_LANGUAGE}
          isSaving={isSavingEdit}
          onClose={() => setEditingRowId(null)}
          onSave={(rowId, patch) => void handleSaveEdit(rowId, patch)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tasks={tasks}
        today={today}
        language={UI_LANGUAGE}
        commands={commands}
        onPickTask={(task) => setEditingRowId(task.rowId)}
      />

      <TelegramNudge connected={Boolean(currentUser.telegramLinked)} />

      <Toast
        visible={toast.visible}
        message={toast.message}
        tone={toast.tone}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
      />
    </AppShell>
  );
}

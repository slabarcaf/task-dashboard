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
import { useLanguage, useSetLanguage, useT } from "@/lib/i18n/provider";
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
import { addDaysToIsoDate, endOfWeekIsoDate, todayIsoDate } from "@/lib/date";
import { normalizeStatus, normalizeTipoOptions, taskFromPayload } from "@/lib/taskFilters";
import { AddTaskPayload, AuthUser, Task, TaskPatch } from "@/lib/types";

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

  const t = useT();
  const language = useLanguage();
  const setLanguage = useSetLanguage();
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
        setError(t.errors.noCredential);
        return;
      }
      setIsSigningIn(true);
      setError(null);
      try {
        setCurrentUser(await signInWithGoogle(credential));
      } catch (signInError) {
        setError(signInError instanceof Error ? signInError.message : t.errors.signIn);
      } finally {
        setIsSigningIn(false);
      }
    },
    [t]
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

      // La cuenta manda sobre el dispositivo: es la misma preferencia que lee el
      // bot, y un clic anterior a la sesión no debe reescribirla. El desacuerdo
      // dura un render y después la cookie queda corregida.
      //
      // ⚠️ Salvo si el onboarding no está hecho. Una fila sin onboarding tiene
      // el idioma por omisión de la columna, que no es una preferencia
      // declarada: sin esta excepción, alguien que elige English en la puerta
      // hace todo el onboarding en español. Ahí manda el dispositivo, y
      // `completeOnboarding` lo guarda en la cuenta.
      if (preferences.onboardingCompleted) setLanguage(preferences.language);
    } catch (preferencesError) {
      setError(
        preferencesError instanceof Error
          ? preferencesError.message
          : t.errors.preferences
      );
    } finally {
      setIsPreferencesLoading(false);
    }
  }, [currentUser, setLanguage, t]);

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
        setError(t.errors.pickCategory);
        return;
      }
      setIsSavingOnboarding(true);
      setError(null);
      try {
        if (answers.firstTask) {
          // Lo que hizo con la tarjeta de ejemplo va en la tarea real: si prendió
          // la llama o la movió a mañana, eso es lo que quiso, no un ensayo.
          const payload: AddTaskPayload = {
            toDo: answers.firstTask.title,
            statusFinalOutcome: answers.firstTask.done ? "Done" : "To-do",
            tipo: answers.firstTask.tipo,
            nextStep: "",
            dueDateNextStep: answers.firstTask.dueDate,
            statusNextStep: "",
            recurrenceInterval: null,
            recurrenceUnit: null,
            isPriority: answers.firstTask.isPriority
          };
          const created = await addTask(payload);
          setTasks((current) => [taskFromPayload(created.rowId, payload), ...current]);
        }

        // La deuda va antes de las preferencias por la misma razón que la tarea:
        // `updatePreferences` es lo que marca el onboarding como terminado, así
        // que cualquier cosa que la persona escribió tiene que estar guardada ya.
        if (answers.firstDebt) {
          const debt = await addDebt(answers.firstDebt);
          setDebts((current) => [debt, ...current]);
        }

        const preferences = await updatePreferences({
          tipoOptions: answers.categories,
          // El idioma con el que la persona acaba de hacer el onboarding pasa a
          // ser el de la cuenta. Sin esto, quien eligió English en la puerta se
          // daba vuelta a español en la primera carga: la fila seguía con el
          // valor por omisión de la columna.
          language,
          timezone: answers.timezone,
          briefMorning: answers.briefMorning,
          briefEvening: answers.briefEvening
        });
        setUserTipoOptions(preferences.tipoOptions);
        setNeedsOnboarding(false);
        // A la lista y no al tablero, solo esta vez. Con una sola tarea el
        // tablero son cuatro columnas vacías y la tarea que la persona acaba de
        // escribir queda fuera de pantalla a la derecha — un final flojo para un
        // onboarding cuyo punto era justamente que esa tarea es real.
        setView("today");
        pushToast(t.toast.ready);
      } catch (onboardingError) {
        setError(
          onboardingError instanceof Error ? onboardingError.message : t.errors.save
        );
      } finally {
        setIsSavingOnboarding(false);
      }
    },
    [language, pushToast, setTasks, t]
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

  /**
   * "Otros" antes que la primera de la lista.
   *
   * El selector proponía `categories[0]`, que por orden alfabético caía en
   * "Ayudantias" — una categoría real y concreta, propuesta con seguridad, para
   * una tarea de la que no sabemos nada. Eso archiva cosas donde nadie las
   * busca. "Otros" significa justamente "todavía sin clasificar", que es la
   * verdad mientras nadie diga otra cosa.
   */
  const defaultCategory = useMemo(
    () => categories.find((option) => option.toLowerCase() === "otros") || categories[0] || "Otros",
    [categories]
  );

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
      setError(debtsError instanceof Error ? debtsError.message : t.errors.debtsLoad);
      setDebtsLoaded(true);
    }
  }, [t]);

  useEffect(() => {
    if (view === "debts" && !debtsLoaded && currentUser) void loadDebts();
  }, [currentUser, debtsLoaded, loadDebts, view]);

  const handleAddDebt = useCallback(
    async (input: Parameters<typeof addDebt>[0]) => {
      try {
        const debt = await addDebt(input);
        setDebts((current) => [debt, ...current]);
        pushToast(t.toast.debtAdded);
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : t.errors.debtAdd);
        pushToast(t.errors.debtAddShort, "error");
      }
    },
    [pushToast, t]
  );

  const markDebt = useCallback(
    async (debt: Debt, status: "Por pagar" | "Pagado") => {
      setDebtPending((current) => ({ ...current, [debt.id]: true }));
      try {
        const updated = await setDebtStatus(debt.id, status);
        setDebts((current) => current.map((row) => (row.id === debt.id ? updated : row)));
      } catch (updateError) {
        pushToast(updateError instanceof Error ? updateError.message : t.errors.update, "error");
      } finally {
        setDebtPending((current) => ({ ...current, [debt.id]: false }));
      }
    },
    [pushToast, t]
  );

  const handleToggleDebt = useCallback(
    (debt: Debt) => {
      const next = debt.status === "Pagado" ? "Por pagar" : "Pagado";
      void markDebt(debt, next);
      if (next === "Pagado") {
        pushUndoToast(t.toast.debtPaid, t.toast.undo, () => void markDebt(debt, "Por pagar"));
      }
    },
    [markDebt, pushUndoToast, t]
  );

  const handleDeleteDebt = useCallback(
    async (debt: Debt) => {
      const snapshot = debts;
      setDebts((current) => current.filter((row) => row.id !== debt.id));
      try {
        await removeDebt(debt.id);
        // Como en las tareas: se borra y se ofrece la vuelta. Al deshacer vuelve
        // con id nuevo, que a nadie le consta salvo a un enlace guardado.
        pushUndoToast(t.toast.debtDeleted, t.toast.undo, () => {
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
              pushToast(t.errors.restore, "error");
            }
          })();
        });
      } catch (deleteError) {
        setDebts(snapshot);
        pushToast(deleteError instanceof Error ? deleteError.message : t.errors.delete, "error");
      }
    },
    [debts, markDebt, pushToast, pushUndoToast, t]
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
        pushToast(t.toast.taskAdded);
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : t.errors.taskAdd);
        pushToast(t.errors.taskAddShort, "error");
      }
    },
    [pushToast, setTasks, t]
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
        wasDone ? t.toast.taskReopened : t.toast.taskDone
      );
      if (ok && !wasDone) {
        pushUndoToast(t.toast.taskDone, t.toast.undo, () => {
          void applyPatchOptimistic(
            task.rowId,
            { statusFinalOutcome: task.statusFinalOutcome || "To-do" },
            t.toast.taskReopened
          );
        });
      }
    },
    [applyPatchOptimistic, pushUndoToast, t]
  );

  const handleMoveTomorrow = useCallback(
    async (task: Task) => {
      const previous = task.dueDateNextStep;
      const ok = await applyPatchOptimistic(
        task.rowId,
        { dueDateNextStep: tomorrow },
        t.toast.movedToTomorrow
      );
      if (ok) {
        pushUndoToast(t.toast.movedToTomorrow, t.toast.undo, () => {
          void applyPatchOptimistic(
            task.rowId,
            { dueDateNextStep: previous },
            t.toast.dateRestored
          );
        });
      }
    },
    [applyPatchOptimistic, pushUndoToast, t, tomorrow]
  );

  const handleTogglePriority = useCallback(
    async (task: Task) => {
      await applyPatchOptimistic(
        task.rowId,
        { isPriority: !task.isPriority },
        task.isPriority ? t.toast.priorityOff : t.toast.priorityOn
      );
    },
    [applyPatchOptimistic, t]
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
        pushUndoToast(t.toast.taskDeleted, t.toast.undo, () => {
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
              pushToast(t.toast.taskRestored);
            } catch {
              pushToast(t.errors.restore, "error");
            }
          })();
        });
      } catch (deleteError) {
        setTasks(snapshot);
        pushToast(deleteError instanceof Error ? deleteError.message : t.errors.delete, "error");
      }
    },
    [pushToast, pushUndoToast, setTasks, t, tasks]
  );

  const editingTask = useMemo(
    () => tasks.find((task) => task.rowId === editingRowId) || null,
    [editingRowId, tasks]
  );

  const handleSaveEdit = useCallback(
    async (rowId: number, patch: TaskPatch) => {
      setIsSavingEdit(true);
      const ok = await applyPatchOptimistic(rowId, patch, t.toast.taskSaved);
      setIsSavingEdit(false);
      if (ok) setEditingRowId(null);
    },
    [applyPatchOptimistic, t]
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
        label: t.commands.newTask,
        hint: "n",
        run: () => captureRef.current?.focus()
      },
      { id: "today", label: t.commands.viewToday, run: () => setView("today") },
      { id: "settings", label: t.commands.settings, run: () => router.push("/ajustes") },
      { id: "telegram", label: t.commands.connectTelegram, run: () => router.push("/ajustes") },
      { id: "board", label: t.commands.viewBoard, run: () => setView("board") },
      { id: "debts", label: t.commands.viewDebts, run: () => setView("debts") },
      {
        id: "theme",
        label: theme === "dark" ? t.nav.lightMode : t.nav.darkMode,
        run: toggleTheme
      },
      { id: "reload", label: t.commands.reloadTasks, run: () => void loadTasks() }
    ],
    [loadTasks, router, t, theme, toggleTheme]
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
        <p className="text-sm text-ink-3">{t.loading.session}</p>
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
        <p className="text-sm text-ink-3">{t.loading.preferences}</p>
      </main>
    );
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen
        initialSelection={userTipoOptions}
        isSaving={isSavingOnboarding}
        error={error}
        theme={theme}
        onToggleTheme={toggleTheme}
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
          categories={categories}
          defaultCategory={defaultCategory}
            disabled={isLoading}
            onVoiceError={(message) => pushToast(message, "error")}
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
        <p className="py-12 text-center text-sm text-ink-3">{t.loading.tasks}</p>
      ) : view === "today" ? (
        <TodayView
          tasks={visibleTasks}
          today={today}
          weekEnd={weekEnd}
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
          pendingRows={pendingRows}
          {...taskActions}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          key={editingTask.rowId}
          task={editingTask}
          categories={categories}
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

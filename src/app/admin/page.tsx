"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SignInScreen";
import {
  AdminUserRow,
  deleteAdminUser,
  getCurrentUser,
  listAdminUsers,
  runAdminUserAction
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { AuthUser } from "@/lib/types";

/**
 * Who exists, how far in they got, and what they have in there.
 *
 * The screen is a read-out first: everything an admin needs in order to answer
 * "did the invite work?" without opening a database client. The three actions
 * are the ones that were only reachable as Telegram commands before.
 */
export default function AdminPage() {
  const [viewer, setViewer] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "signed_out">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ id: number; typed: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setViewer(me);
      if (!me) {
        setState("signed_out");
        return;
      }
      const { users: rows } = await listAdminUsers();
      setUsers(rows);
      setState("ready");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "No se pudo cargar.";
      // 403 comes back as "Forbidden" from the API's error envelope.
      if (/forbidden/i.test(message)) {
        setState("denied");
        return;
      }
      setError(message);
      setState("ready");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, action: "reset_onboarding" | "unlink_telegram") => {
    setBusyId(id);
    setError(null);
    try {
      await runAdminUserAction(id, action);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "La acción falló.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: AdminUserRow, typed: string) => {
    setBusyId(row.id);
    setError(null);
    try {
      const taskCount = await deleteAdminUser(row.id, typed);
      setConfirming(null);
      await load();
      setError(`Cuenta ${row.email} eliminada junto con ${taskCount} tareas.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar.");
    } finally {
      setBusyId(null);
    }
  };

  if (state === "loading") {
    return <Shell><p className="text-sm text-ink-2">Cargando…</p></Shell>;
  }

  if (state === "signed_out") {
    return (
      <Shell>
        <p className="text-sm text-ink-2">
          Necesitas iniciar sesión. <Link className="font-semibold text-brand underline" href="/">Ir al acceso</Link>
        </p>
      </Shell>
    );
  }

  if (state === "denied") {
    return (
      <Shell>
        <h1 className="font-display text-xl font-semibold text-ink">Esta pantalla no es para ti</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Tu cuenta ({viewer?.email}) no está en la lista de administradores. Nadie más que un
          administrador puede ver los datos de otras cuentas.
        </p>
        <Link className="mt-4 inline-block text-sm font-semibold text-brand underline" href="/">
          Volver a mis tareas
        </Link>
      </Shell>
    );
  }

  const totals = users.reduce(
    (acc, row) => ({
      tasks: acc.tasks + row.taskCount,
      pending: acc.pending + row.pendingCount,
      onboarded: acc.onboarded + (row.onboardingCompleted ? 1 : 0),
      telegram: acc.telegram + (row.telegramLinked ? 1 : 0)
    }),
    { tasks: 0, pending: 0, onboarded: 0, telegram: 0 }
  );

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Usuarios</h1>
          <p className="mt-1 text-sm text-ink-2">
            Quién existe, hasta dónde llegó y qué tiene dentro.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-field border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:border-line-2 hover:text-ink"
        >
          ← Mis tareas
        </Link>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cuentas" value={users.length} />
        <Stat label="Con onboarding" value={`${totals.onboarded}/${users.length}`} />
        <Stat label="Con Telegram" value={`${totals.telegram}/${users.length}`} />
        <Stat label="Tareas pendientes" value={totals.pending} hint={`${totals.tasks} en total`} />
      </div>

      {error && (
        <p className="mb-5 rounded-card border border-line bg-raised px-4 py-3 text-sm text-ink-2">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {users.map((row) => {
          const isViewer = row.id === viewer?.id;
          const busy = busyId === row.id;
          const isConfirming = confirming?.id === row.id;

          return (
            <article
              key={row.id}
              className={cn(
                "rounded-panel border border-line bg-surface p-4 shadow-card transition-opacity",
                busy && "pointer-events-none opacity-60"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-base font-semibold text-ink">
                    {row.name || row.email}
                    {isViewer && (
                      <span className="ml-2 rounded-chip border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                        tú
                      </span>
                    )}
                  </h2>
                  <p className="truncate text-[13px] text-ink-3">{row.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Flag on={row.onboardingCompleted} onLabel="Onboarding hecho" offLabel="Sin onboarding" />
                  <Flag
                    on={row.telegramLinked}
                    onLabel={`Telegram ···${row.telegramChatIdTail}`}
                    offLabel="Sin Telegram"
                  />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
                <Field label="Tareas" value={row.taskCount} />
                <Field label="Pendientes" value={row.pendingCount} />
                <Field label="Vencidas" value={row.overdueCount} tone={row.overdueCount > 0 ? "late" : undefined} />
                <Field label="Prioridad" value={row.priorityCount} />
                <Field label="Categorías" value={row.categoryCount} />
                <Field label="Creada" value={shortDate(row.createdAt)} />
                <Field label="Último acceso" value={shortDate(row.lastSignInAt) || "nunca"} />
                <Field label="Última tarea" value={shortDate(row.lastTaskActivityAt) || "—"} />
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <RowAction onClick={() => void act(row.id, "reset_onboarding")} disabled={!row.onboardingCompleted}>
                  Repetir onboarding
                </RowAction>
                <RowAction onClick={() => void act(row.id, "unlink_telegram")} disabled={!row.telegramLinked}>
                  Desconectar Telegram
                </RowAction>
                {!isViewer && !row.isAdminAccount && (
                  <RowAction
                    tone="late"
                    onClick={() => setConfirming(isConfirming ? null : { id: row.id, typed: "" })}
                  >
                    {isConfirming ? "Cancelar" : "Eliminar cuenta"}
                  </RowAction>
                )}
              </div>

              {isConfirming && (
                <div className="mt-3 rounded-card border border-late/30 bg-late-soft p-3">
                  <p className="text-[13px] text-ink">
                    Esto borra la cuenta y sus <b>{row.taskCount} tareas</b>. No hay forma de
                    deshacerlo. Escribe <b className="font-mono">{row.email}</b> para confirmar.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <input
                      autoFocus
                      value={confirming.typed}
                      onChange={(event) =>
                        setConfirming({ id: row.id, typed: event.target.value })
                      }
                      placeholder={row.email}
                      className="min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-late"
                    />
                    <button
                      type="button"
                      disabled={confirming.typed.trim().toLowerCase() !== row.email.toLowerCase()}
                      onClick={() => void remove(row, confirming.typed)}
                      className="rounded-field bg-late px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Eliminar definitivamente
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg px-5 py-9 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex items-center gap-3 border-b border-line pb-5">
          <Wordmark />
          <span className="rounded-chip border border-line bg-sunken px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            admin
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <div className="num font-display text-xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-[12px] uppercase tracking-wide text-ink-3">{label}</div>
      {hint && <div className="num mt-0.5 text-[12px] text-ink-3">{hint}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone?: "late";
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className={cn("num font-semibold", tone === "late" ? "text-late" : "text-ink")}>{value}</dd>
    </div>
  );
}

function Flag({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={cn(
        "rounded-chip border px-2.5 py-0.5 text-[11.5px] font-semibold",
        on ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-sunken text-ink-3"
      )}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

function RowAction({
  children,
  onClick,
  disabled,
  tone
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "late";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-field border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "late"
          ? "border-late/30 text-late hover:bg-late-soft"
          : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/** "5-Sep" style, matching the cards. Empty string when there is no date. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const base = `${date.getDate()}-${months[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear()
    ? base
    : `${base}-${String(date.getFullYear()).slice(2)}`;
}

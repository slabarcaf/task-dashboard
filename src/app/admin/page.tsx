"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SignInScreen";
import {
  AdminUserRow,
  Integrations,
  createAdminUser,
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
/**
 * El mensaje que se manda a mano cuando el correo no salió.
 *
 * La versión anterior decía "O directo al chat" — que no significa nada para
 * alguien que no conoce el producto, y es exactamente la persona que recibe
 * esto. Un enlace sin explicar qué hay del otro lado no se abre.
 *
 * Sin markdown ni viñetas raras a propósito: esto se pega tal cual en WhatsApp
 * o en un correo, donde los asteriscos salen como asteriscos.
 */
function manualInvite(to: string, appUrl: string, telegramLink: string): string {
  return [
    "Te invité a Sydney: una lista de tareas a la que le escribes como a una persona.",
    'Le dices "pagar la luz el viernes" y la anota con la fecha puesta.',
    "",
    "Son dos lados de la misma cuenta, y puedes empezar por cualquiera:",
    "",
    `1) La web, para ver y ordenar tus tareas. Entra con ${to}:`,
    `   ${appUrl}`,
    "",
    "2) Telegram, que es donde Sydney te habla a ti: te manda un resumen en la",
    "   mañana y otro en la noche, y le escribes —o le mandas un audio— desde el",
    "   teléfono, sin abrir nada. Este enlace abre el chat y te deja dentro:",
    `   ${telegramLink}`,
    "",
    "El enlace de Telegram sirve 30 días. Si no tienes la app, te lleva a instalarla."
  ].join("\n");
}

export default function AdminPage() {
  const [viewer, setViewer] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "signed_out">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ id: number; typed: string } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [invite, setInvite] = useState<
    {
      to: string;
      appUrl?: string;
      telegramLink?: string;
      reason?: "not_configured" | "unverified_domain" | "failed";
      detail?: string;
    } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setViewer(me);
      if (!me) {
        setState("signed_out");
        return;
      }
      const { users: rows, integrations: found } = await listAdminUsers();
      setUsers(rows);
      setIntegrations(found);
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
        {/* Grande y con color de marca a propósito: es la única salida de esta
            pantalla, y un enlace gris de 13px pegado al borde es exactamente
            donde alguien se pierde. */}
        <Link
          href="/"
          className="rounded-field bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-card transition-opacity hover:opacity-90"
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

      {integrations && (
        <section className="mb-4 rounded-panel border border-line bg-surface p-4 shadow-card">
          <h2 className="mb-3 font-display text-[15px] font-semibold text-ink">Integraciones</h2>
          <div className="flex flex-wrap gap-2">
            <IntegrationChip
              on={integrations.voice}
              label="Notas de voz"
              hint={integrations.voice ? "OPENAI_API_KEY puesta" : "falta OPENAI_API_KEY en Vercel"}
            />
            <IntegrationChip
              on={integrations.mail}
              // Sin dominio propio, Resend solo entrega a la dirección dueña de
              // la cuenta. La llave está puesta y aun así nadie más recibe nada.
              limited={integrations.mail && integrations.mailFrom.includes("resend.dev")}
              label="Invitaciones por correo"
              hint={
                !integrations.mail
                  ? "falta RESEND_API_KEY en Vercel"
                  : integrations.mailFrom.includes("resend.dev")
                    ? "solo llegan a tu propia dirección — falta verificar un dominio"
                    : `enviando desde ${integrations.mailFrom}`
              }
            />
            <IntegrationChip on label={`Telegram: @${integrations.telegramBot}`} />
          </div>
          {integrations.misnamed.length > 0 && (
            <div className="mt-3 rounded-card border border-amber/30 bg-amber-soft p-3 text-[13px]">
              <b className="text-ink">El nombre no coincide.</b> Están estas variables, pero con un
              nombre que el código no busca:
              <ul className="mt-1.5 space-y-1">
                {integrations.misnamed.map((entry) => (
                  <li key={entry.found} className="num">
                    <code className="font-mono">{entry.found}</code> → debería llamarse{" "}
                    <code className="font-mono text-ink">{entry.shouldBe}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-ink-3">
            Una variable agregada en Vercel solo aplica en un build nuevo. Si acabas de ponerla y
            aquí sigue en rojo, falta el redeploy — o está en otro proyecto.
          </p>
        </section>
      )}

      {/* ── Agregar cuenta ────────────────────────────────────────────────
          Esto NO manda ningún correo: el dashboard no envía mail. Lo que hace
          es crear la fila, para que cuando esa persona entre con Google se
          enganche a ESTA cuenta en vez de crear una segunda. Pasarle el enlace
          sigue siendo un paso humano, y el texto lo dice para que nadie se
          quede esperando una invitación que no existe. */}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setAdding(true);
          setError(null);
          try {
            const invite = await createAdminUser(newEmail, newName);
            const to = newEmail.trim().toLowerCase();
            setInvite(
              invite.sent
                ? { to }
                : {
                    to,
                    appUrl: invite.appUrl,
                    telegramLink: invite.telegramLink,
                    reason: invite.reason,
                    detail: invite.detail
                  }
            );
            setNewEmail("");
            setNewName("");
            await load();
          } catch (addError) {
            setError(addError instanceof Error ? addError.message : "No se pudo crear.");
          } finally {
            setAdding(false);
          }
        }}
        className="mb-4 rounded-panel border border-line bg-surface p-4 shadow-card"
      >
        <h2 className="font-display text-[15px] font-semibold text-ink">Agregar una cuenta</h2>
        <p className="mb-3 mt-0.5 text-[12.5px] text-ink-2">
          No manda ningún correo. Crea la cuenta para que, al entrar con ese Google, caiga aquí en
          vez de crear una nueva.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
            className="min-w-0 flex-[2] rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
          />
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Nombre (opcional)"
            className="min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="rounded-field bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? "Creando…" : "Crear"}
          </button>
        </div>

        {invite && (
          <div className="mt-3 rounded-card border border-line bg-raised p-3 text-[13px]">
            {invite.appUrl ? (
              <>
                <p className="text-ink">
                  Cuenta creada para <b>{invite.to}</b>, pero{" "}
                  <b>
                    {invite.reason === "not_configured"
                      ? "no se envió correo"
                      : invite.reason === "unverified_domain"
                        ? "Resend no lo dejó salir"
                        : "el correo no se pudo enviar"}
                  </b>
                  . Mándale esto tú:
                </p>
                <textarea
                  readOnly
                  rows={12}
                  onFocus={(event) => event.currentTarget.select()}
                  value={manualInvite(invite.to, invite.appUrl, invite.telegramLink || "")}
                  className="mt-2 w-full resize-none rounded-field border border-line bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-ink-2 outline-none"
                />

                {/* Cada motivo tiene una acción distinta, así que cada uno la dice. */}
                {invite.reason === "not_configured" && (
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                    Para que salgan solas: crear una API key en resend.com y ponerla en Vercel como{" "}
                    <code className="font-mono">RESEND_API_KEY</code>.
                  </p>
                )}
                {invite.reason === "unverified_domain" && (
                  <div className="mt-2 rounded-card border border-amber/30 bg-amber-soft px-3 py-2.5 text-[12px] leading-relaxed text-amber-ink">
                    <b>Resend funciona; lo que falta es un dominio.</b> Sin uno verificado solo deja
                    enviar desde <code className="font-mono">onboarding@resend.dev</code>, y solo a
                    la dirección dueña de la cuenta de Resend. A cualquier otra persona la rechaza.
                    <br />
                    Se arregla una vez: verificar un dominio en resend.com → Domains, y poner{" "}
                    <code className="font-mono">INVITE_FROM</code> en Vercel con una dirección de
                    ese dominio. Desde ahí las invitaciones salen solas.
                  </div>
                )}
                {invite.reason === "failed" && invite.detail && (
                  <p className="mt-2 break-words font-mono text-[11.5px] leading-relaxed text-ink-3">
                    {invite.detail}
                  </p>
                )}
              </>
            ) : (
              <p className="text-ink">
                Invitación enviada a <b>{invite.to}</b>. Va a aparecer abajo con “nunca” en último
                acceso hasta que entre.
              </p>
            )}
          </div>
        )}
      </form>

      {/* Una fila por persona. Con diez cuentas, diez tarjetas grandes abiertas
          a la vez no son un panel: son un scroll. El detalle y las acciones
          aparecen cuando se piden. */}
      <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
        <div className="hidden items-center gap-3 border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3 sm:flex">
          <span className="min-w-0 flex-1">Persona</span>
          <span className="w-14 text-right">Tareas</span>
          <span className="w-20 text-right">Pendientes</span>
          <span className="w-16 text-right">Vencidas</span>
          <span className="w-24 text-right">Último acceso</span>
          <span className="w-24 text-right">Última tarea</span>
          <span className="w-5" />
        </div>

        {users.map((row) => {
          const isViewer = row.id === viewer?.id;
          const busy = busyId === row.id;
          const open = expandedId === row.id;
          const isConfirming = confirming?.id === row.id;

          return (
            <div key={row.id} className={cn("border-b border-line last:border-b-0", busy && "opacity-60")}>
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : row.id)}
                aria-expanded={open}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised",
                  open && "bg-raised"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-ink">
                      {row.name || row.email}
                    </span>
                    {isViewer && (
                      <span className="flex-none rounded-chip border border-brand/30 bg-brand-soft px-1.5 text-[10.5px] font-semibold text-brand">
                        tú
                      </span>
                    )}
                    {!row.onboardingCompleted && (
                      <span className="flex-none rounded-chip border border-amber/30 bg-amber-soft px-1.5 text-[10.5px] font-semibold text-amber-ink">
                        sin onboarding
                      </span>
                    )}
                    {!row.telegramLinked && (
                      <span className="flex-none rounded-chip border border-line bg-sunken px-1.5 text-[10.5px] font-semibold text-ink-3">
                        sin Telegram
                      </span>
                    )}
                    {/* El motivo real por el que una cuenta creada de antemano
                        sirve: así se ve a quién nunca le llegó la invitación. */}
                    {!row.lastSignInAt && row.taskCount === 0 && (
                      <span className="flex-none rounded-chip border border-brand/30 bg-brand-soft px-1.5 text-[10.5px] font-semibold text-brand">
                        invitado, no ha entrado
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">{row.email}</span>
                </span>

                <Cell>{row.taskCount}</Cell>
                <Cell width="w-20">{row.pendingCount}</Cell>
                <Cell width="w-16" tone={row.overdueCount > 0 ? "late" : undefined}>
                  {row.overdueCount}
                </Cell>
                <Cell width="w-24">{shortDate(row.lastSignInAt) || "nunca"}</Cell>
                <Cell width="w-24">{shortDate(row.lastTaskActivityAt) || "—"}</Cell>
                <span aria-hidden className="w-5 flex-none text-center text-ink-3">
                  {open ? "▾" : "▸"}
                </span>
              </button>

              {open && (
                <div className="border-t border-line bg-bg px-4 py-3">
                  <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
                    <Field label="Onboarding" value={row.onboardingCompleted ? "completado" : "pendiente"} />
                    <Field
                      label="Telegram"
                      value={row.telegramLinked ? `···${row.telegramChatIdTail}` : "sin conectar"}
                    />
                    <Field label="Categorías" value={row.categoryCount} />
                    <Field label="Prioridad" value={row.priorityCount} />
                    <Field label="Creada" value={shortDate(row.createdAt)} />
                  </dl>

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <RowAction
                      onClick={() => void act(row.id, "reset_onboarding")}
                      disabled={!row.onboardingCompleted}
                    >
                      Repetir onboarding
                    </RowAction>
                    <RowAction
                      onClick={() => void act(row.id, "unlink_telegram")}
                      disabled={!row.telegramLinked}
                    >
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
                          onChange={(event) => setConfirming({ id: row.id, typed: event.target.value })}
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
                </div>
              )}
            </div>
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
          <Wordmark href="/" />
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

/**
 * Tres estados, no dos.
 *
 * `limited` existe porque el correo estaba en verde mientras no podía entregarle
 * a nadie salvo al dueño de la cuenta de Resend: la llave estaba puesta, así que
 * el chip decía que sí. Una luz verde que miente es peor que no tener luz — es
 * la misma regla que el chequeo nocturno, donde no poder determinar la respuesta
 * se reporta como falla y nunca como aprobación.
 */
function IntegrationChip({
  on,
  limited = false,
  label,
  hint
}: {
  on: boolean;
  limited?: boolean;
  label: string;
  hint?: string;
}) {
  const tone = !on
    ? "border-late/30 bg-late-soft text-late"
    : limited
      ? "border-amber/30 bg-amber-soft text-amber-ink"
      : "border-ok/30 bg-ok-soft text-ok";
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border px-3 py-1 text-[12.5px] font-semibold",
        tone
      )}
    >
      {!on ? "✕" : limited ? "!" : "✓"} {label}
      {hint && <span className="font-normal opacity-70">— {hint}</span>}
    </span>
  );
}

/** Una celda numérica de la fila. Se esconde en el teléfono, donde no cabe. */
function Cell({
  children,
  width = "w-14",
  tone
}: {
  children: React.ReactNode;
  width?: string;
  tone?: "late";
}) {
  return (
    <span
      className={cn(
        "num hidden flex-none text-right text-[13px] sm:block",
        width,
        tone === "late" ? "font-semibold text-late" : "text-ink-2"
      )}
    >
      {children}
    </span>
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

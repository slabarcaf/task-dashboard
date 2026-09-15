import type { AppLanguage } from "@/lib/language";
import {
  AddTaskPayload,
  AddTaskResponse,
  AuthGoogleResponse,
  AuthMeResponse,
  AuthUser,
  ListTasksResponse,
  Task,
  TaskPatch,
  UserPreferences,
  UpdateTaskResponse
} from "@/lib/types";

/**
 * Lo que tira el cliente cuando una ruta dice que no.
 *
 * Lleva el **código**, no una frase: la frase la pone `apiErrorText` con el
 * catálogo del idioma vigente. El `message` queda con el código a propósito,
 * para que un log o un `console.error` siga siendo legible por una persona que
 * depura — pero nunca se le muestra a nadie.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 0) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("bad_response", response.status);
  }

  if (!response.ok) {
    const code =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error)
        : `http_${response.status}`;
    throw new ApiError(code, response.status);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    (payload as { ok?: boolean }).ok === false
  ) {
    const message =
      "error" in payload
        ? String((payload as { error?: string }).error || "operation_failed")
        : "operation_failed";
    throw new Error(message);
  }

  return payload as T;
}

export async function listTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks", {
    method: "GET",
    cache: "no-store"
  });

  const data = await parseJsonOrThrow<ListTasksResponse>(response);
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function addTask(payload: AddTaskPayload): Promise<AddTaskResponse> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<AddTaskResponse>(response);
}

export async function updateTask(rowId: number, patch: TaskPatch): Promise<UpdateTaskResponse> {
  const response = await fetch(`/api/tasks/${rowId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patch })
  });

  return parseJsonOrThrow<UpdateTaskResponse>(response);
}

export async function deleteTask(rowId: number): Promise<void> {
  const response = await fetch(`/api/tasks/${rowId}`, { method: "DELETE" });
  await parseJsonOrThrow<{ ok: boolean }>(response);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store"
  });

  if (response.status === 401) {
    return null;
  }

  const data = await parseJsonOrThrow<AuthMeResponse>(response);
  return data.user;
}

/**
 * Entrar. Puede fallar por no estar invitado, que no es un error técnico y no
 * debería leerse como uno: `parseJsonOrThrow` mostraría el código crudo
 * `not_invited` en pantalla. Se traduce aquí, donde está el idioma.
 */
export async function signInWithGoogle(credential: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ credential })
  });

  // Los dos estados que esta puerta trata distinto. El detalle del servidor se
  // ignora a propósito: viene en un idioma que el servidor eligió sin saber cuál
  // es el de quien mira.
  if (response.status === 403) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(payload?.error || "not_invited", 403);
  }
  if (response.status === 429) {
    throw new ApiError("too_many_signin", 429);
  }

  const data = await parseJsonOrThrow<AuthGoogleResponse>(response);
  return data.user;
}

export async function logoutUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST"
  });
  await parseJsonOrThrow<{ ok: boolean }>(response);
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const response = await fetch("/api/user/preferences", {
    method: "GET",
    cache: "no-store"
  });
  return parseJsonOrThrow<UserPreferences>(response);
}

export async function saveUserPreferences(tipoOptions: string[]): Promise<UserPreferences> {
  const response = await fetch("/api/user/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ tipoOptions })
  });
  return parseJsonOrThrow<UserPreferences>(response);
}

/* ─── Admin ───────────────────────────────────────────────────────────────
   Cookie-authenticated like the rest of the browser API. The server decides
   whether the caller is an admin; these helpers just ask. */

export type AdminUserRow = {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  onboardingCompleted: boolean;
  categoryCount: number;
  telegramLinked: boolean;
  telegramChatIdTail: string | null;
  taskCount: number;
  pendingCount: number;
  overdueCount: number;
  priorityCount: number;
  lastTaskActivityAt: string | null;
  lastSignInAt: string | null;
  /** Admin accounts are not deletable from this screen; the API refuses too. */
  isAdminAccount: boolean;
};

export type Integrations = {
  voice: boolean;
  mail: boolean;
  /** Variables presentes con un nombre parecido al que hace falta. */
  misnamed: Array<{ found: string; shouldBe: string }>;
  mailFrom: string;
  telegramBot: string;
};

export async function listAdminUsers(): Promise<{
  users: AdminUserRow[];
  viewerId: number;
  integrations: Integrations;
}> {
  const response = await fetch("/api/admin/users", { method: "GET", cache: "no-store" });
  return parseJsonOrThrow<{
    users: AdminUserRow[];
    viewerId: number;
    integrations: Integrations;
  }>(response);
}

export async function runAdminUserAction(
  userId: number,
  action: "reset_onboarding" | "unlink_telegram"
): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  await parseJsonOrThrow<{ ok: boolean }>(response);
}

export async function deleteAdminUser(userId: number, confirmEmail: string): Promise<number> {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmEmail })
  });
  const data = await parseJsonOrThrow<{ ok: boolean; taskCount: number }>(response);
  return data.taskCount;
}

/* ─── Ajustes ─────────────────────────────────────────────────────────────── */

export type TelegramLink = {
  code: string;
  deepLink: string;
  qrDataUrl: string;
  botUsername: string;
  expiresAt: string;
};

export async function createTelegramLink(): Promise<TelegramLink> {
  const response = await fetch("/api/telegram/link", { method: "POST" });
  return parseJsonOrThrow<TelegramLink>(response);
}

export async function disconnectTelegram(): Promise<void> {
  const response = await fetch("/api/telegram/link", { method: "DELETE" });
  await parseJsonOrThrow<{ ok: boolean }>(response);
}

export type PreferencePatch = {
  tipoOptions?: string[];
  language?: AppLanguage;
  timezone?: string;
  briefMorning?: string;
  briefEvening?: string;
};

export async function updatePreferences(patch: PreferencePatch): Promise<UserPreferences> {
  const response = await fetch("/api/user/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  return parseJsonOrThrow<UserPreferences>(response);
}

export type InviteOutcome =
  | { sent: true }
  | {
      sent: false;
      /** `unverified_domain`: Resend anda, pero sin dominio propio solo entrega
       *  a la dirección dueña de la cuenta. Parece una falla y no lo es. */
      reason: "not_configured" | "unverified_domain" | "failed";
      detail?: string;
      appUrl: string;
      telegramLink: string;
      /** Armado en el servidor, en el idioma de la invitación. */
      manualText: string;
    };

export async function createAdminUser(
  email: string,
  name: string,
  language: AppLanguage
): Promise<InviteOutcome> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, language })
  });
  const data = await parseJsonOrThrow<{ ok: boolean; invite: InviteOutcome }>(response);
  return data.invite;
}

/* ─── Deudas ──────────────────────────────────────────────────────────────── */

export type Debt = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  direction: "Debo yo" | "Me deben";
  reason: string;
  status: "Por pagar" | "Pagado";
  createdAt: string;
  statusChangedAt: string | null;
  /** Solo si lo guardado no era reconocible; lo usa el chequeo nocturno. */
  suspect?: { direction: string; status: string; amount: string };
};

export async function listDebts(): Promise<Debt[]> {
  const response = await fetch("/api/debts", { cache: "no-store" });
  const data = await parseJsonOrThrow<{ debts: Debt[] }>(response);
  return data.debts;
}

export async function addDebt(input: {
  name: string;
  amount: number;
  currency: string;
  direction: "Debo yo" | "Me deben";
  reason: string;
}): Promise<Debt> {
  const response = await fetch("/api/debts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return (await parseJsonOrThrow<{ debt: Debt }>(response)).debt;
}

export async function setDebtStatus(id: number, status: "Por pagar" | "Pagado"): Promise<Debt> {
  const response = await fetch(`/api/debts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  return (await parseJsonOrThrow<{ debt: Debt }>(response)).debt;
}

export async function removeDebt(id: number): Promise<void> {
  const response = await fetch(`/api/debts/${id}`, { method: "DELETE" });
  await parseJsonOrThrow<{ ok: boolean }>(response);
}

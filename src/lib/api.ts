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

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API error ${response.status}: Invalid JSON response`);
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error)
        : `API error ${response.status}`;
    throw new Error(message);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    (payload as { ok?: boolean }).ok === false
  ) {
    const message =
      "error" in payload
        ? String((payload as { error?: string }).error || "Operation failed")
        : "Operation failed";
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

export async function signInWithGoogle(credential: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ credential })
  });

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

export async function listAdminUsers(): Promise<{ users: AdminUserRow[]; viewerId: number }> {
  const response = await fetch("/api/admin/users", { method: "GET", cache: "no-store" });
  const data = await parseJsonOrThrow<{ users: AdminUserRow[]; viewerId: number }>(response);
  return { users: data.users, viewerId: data.viewerId };
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
  language?: "es" | "en";
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

export async function createAdminUser(email: string, name: string): Promise<void> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name })
  });
  await parseJsonOrThrow<{ ok: boolean }>(response);
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

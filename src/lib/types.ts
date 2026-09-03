export const STATUS_FINAL_OUTCOME_OPTIONS = [
  "To-do",
  "On-going",
  "Done",
  "On hold"
] as const;

export const TIPO_OPTIONS = [
  "Otros",
  "Recruiting",
  "S3",
  "Clases",
  "Finanzas",
  "Personal"
] as const;

/**
 * Retired 2026-09-02. This English list ran alongside the Spanish one the bot
 * uses, so the two doors offered different vocabularies and the database ended
 * up with stray "University" and "Job" rows. The single canonical set now lives
 * in `src/lib/categories.ts`; labels are translated for display only.
 */
export { CANONICAL_CATEGORIES, CANONICAL_CATEGORIES as ONBOARDING_SUGGESTED_TIPOS } from "@/lib/categories";

export type StatusFinalOutcome = (typeof STATUS_FINAL_OUTCOME_OPTIONS)[number];
export type Tipo = (typeof TIPO_OPTIONS)[number];

export type Task = {
  rowId: number;
  toDo: string;
  statusFinalOutcome: string;
  tipo: string;
  nextStep: string;
  dueDateNextStep: string;
  statusNextStep: string;
  recurrenceInterval: number | null;
  recurrenceUnit: "day" | "week" | "month" | null;
  /** The 🔴 flag. Lived in a JSON file on the bot's VM until 2026-09-01. */
  isPriority: boolean;
};

// isPriority is optional when creating: a task is not priority unless said so.
export type AddTaskPayload = Omit<Task, "rowId" | "isPriority"> & { isPriority?: boolean };

export type TaskPatch = Partial<Omit<Task, "rowId">>;

export type ListTasksResponse = {
  tasks: Task[];
};

export type AddTaskResponse = {
  ok: boolean;
  rowId: number;
};

export type UpdateTaskResponse = {
  ok: boolean;
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
};

export type AuthMeResponse = {
  ok: boolean;
  user: AuthUser | null;
};

export type AuthGoogleResponse = {
  ok: boolean;
  user: AuthUser;
};

export type UserPreferences = {
  onboardingCompleted: boolean;
  tipoOptions: string[];
};

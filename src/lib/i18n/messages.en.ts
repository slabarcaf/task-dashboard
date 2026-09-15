/**
 * The English catalogue. Its shape is `Messages`, defined by `messages.es.ts` —
 * a missing key, an extra key or a changed signature fails `tsc`, so a half-done
 * translation cannot reach production.
 *
 * What `tsc` cannot see is a value still written in Spanish. That is what
 * `tests/no-spanish-literals.test.mjs` checks here.
 */

import type { Messages } from "@/lib/i18n/messages.es";

export const en: Messages = {
  meta: {
    title: "Sydney",
    description: "Your tasks, on the web and on Telegram."
  },
  language: {
    label: "Language",
    es: "Español",
    en: "English"
  },
  nav: {
    viewGroup: "View",
    today: "Today",
    board: "Board",
    debts: "Debts",
    search: "Search",
    settings: "Settings",
    users: "Users",
    signOut: "Sign out",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    goToTasks: "Go to my tasks"
  },
  loading: {
    session: "Checking your session…",
    preferences: "Loading your preferences…",
    tasks: "Loading your tasks…"
  },
  sections: {
    overdue: "Overdue",
    today: "Today",
    tomorrow: "Tomorrow",
    thisWeek: "This week",
    later: "Later",
    noDate: "No date",
    done: "Done"
  },
  empty: {
    firstRunTitle: "Nothing here yet",
    firstRunHint:
      "Write your first task above. You can say the date in the same sentence: “pay the electricity bill friday”."
  },
  card: {
    markDone: "Mark as done",
    markPending: "Mark as not done",
    edit: "Edit",
    moveTomorrow: "Move to tomorrow",
    addPriority: "Set priority",
    removePriority: "Remove priority",
    delete: "Delete",
    priority: "Priority"
  },
  capture: {
    placeholder: "Write a task… try “pay the electricity bill friday”",
    taskLabel: "New task",
    categoryLabel: "Category",
    readCategory: (text: string) => `I read “${text}” in what you typed`,
    add: "Add"
  },
  filter: {
    group: "Filter by category",
    all: "All"
  },
  edit: {
    title: "Edit task",
    task: "Task",
    status: "Status",
    category: "Category",
    nextStep: "Next step",
    date: "Date",
    repeats: "Repeats",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    presets: {
      none: "Does not repeat",
      daily: "Every day",
      weekly: "Every week",
      monthly: "Every month",
      custom: "Custom"
    },
    units: {
      day: "days",
      week: "weeks",
      month: "months"
    }
  },
  palette: {
    dialogLabel: "Search and run",
    placeholder: "Search a task or type a command…",
    noMatches: "Nothing matches."
  },
  commands: {
    newTask: "New task",
    viewToday: "Go to Today",
    viewBoard: "Go to Board",
    viewDebts: "Go to Debts",
    settings: "Settings",
    connectTelegram: "Connect Telegram",
    reloadTasks: "Reload tasks"
  },
  signIn: {
    headlineBefore: "Your to-dos, and ",
    headlineAccent: "someone",
    headlineAfter: " who reminds you about them.",
    blurb:
      "Write them to Sydney the way you would tell a person — “pay the electricity bill friday” — or open them here and sort them with the mouse. She hands them back in order, without you having to go looking.",
    briefEyebrow: "And she writes to you twice a day",
    morningBrief: "☀ 7:00 · what is coming today",
    eveningBrief: "☾ 20:00 · closing the day",
    sameAccount: "Here or on Telegram, it makes no difference: same account, same list.",
    title: "Sign in to your account",
    privacy: "Your tasks are private. Nobody else sees them.",
    signingIn: "Signing in…",
    terms: "By continuing you agree that Sydney stores your tasks in order to show them to you. The session lasts 15 days.",
    missingClientIdBefore: "Missing ",
    missingClientIdAfter: ". Sign-in cannot work without that variable."
  },
  toast: {
    undo: "Undo",
    ready: "Done",
    taskAdded: "Added",
    taskDone: "Done",
    taskReopened: "Reopened",
    taskSaved: "Saved",
    taskDeleted: "Deleted",
    taskRestored: "Restored",
    movedToTomorrow: "Moved to tomorrow",
    dateRestored: "Date restored",
    priorityOn: "Priority set",
    priorityOff: "Priority removed",
    debtAdded: "Recorded",
    debtDeleted: "Deleted",
    debtPaid: "Marked as paid"
  },
  errors: {
    signIn: "Could not sign in.",
    noCredential: "Google did not return a credential.",
    googleScript: "Could not load Google sign-in.",
    preferences: "Could not load your preferences.",
    debtsLoad: "Could not load your debts.",
    taskAdd: "Could not add it.",
    taskAddShort: "Could not add it",
    debtAdd: "Could not record it.",
    debtAddShort: "Could not record it",
    update: "Could not update it",
    delete: "Could not delete it",
    restore: "Could not restore it",
    save: "Could not save.",
    pickCategory: "Pick at least one category."
  }
};

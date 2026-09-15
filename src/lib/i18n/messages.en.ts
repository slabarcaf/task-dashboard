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
  debts: {
    loading: "Loading your debts…",
    theyOwe: "Owed to you",
    youOwe: "You owe",
    settled: "Settled",
    owedTo: "You are owed",
    owing: "You owe",
    emptyTitle: "No debts recorded",
    emptyHint:
      "Keep track here of what you are owed and what you owe. You can also tell Sydney on Telegram.",
    markPaid: "Mark as paid",
    markPending: "Mark as unpaid",
    delete: "Delete",
    directionTheyOwe: "They owe me",
    directionIOwe: "I owe",
    whoPlaceholder: "Who?",
    whoLabel: "Name",
    whyPlaceholder: "What for? (optional)",
    whyLabel: "Reason",
    amountLabel: "Amount",
    currencyLabel: "Currency",
    add: "Record"
  },
  voice: {
    record: "Record a voice note",
    releaseAria: "Release to transcribe",
    holdTitle: "Hold to record",
    releaseTitle: "Release to transcribe",
    notConfigured: "Voice notes are not set up yet (OPENAI_API_KEY is missing).",
    failed: "Could not transcribe it.",
    nothingHeard: "Nothing came through. Try again, closer to the microphone.",
    micDenied:
      "The browser did not grant microphone access. Enable it for this site and try again.",
    micFailed: "Could not open the microphone."
  },
  telegram: {
    connected: "✓ Telegram connected",
    connectedHint: "You can write to her now. Your summaries start tomorrow.",
    connect: "Connect Telegram",
    generating: "Generating…",
    codeFailed: "Could not generate the code.",
    qrAlt: "QR code to open the Sydney chat on Telegram",
    openAndConnect: "Open Telegram and connect",
    onComputerBold: "On a computer?",
    onComputerRest: " Scan the code with your phone camera. That is where the chat will be useful.",
    cannotScanBefore: "Cannot scan? Write to ",
    cannotScanAfter: " on Telegram:",
    codeLifeBefore: "The code lasts 24 hours. ",
    codeLifeBold: "If you do not have Telegram",
    codeLifeAfter:
      ", the link takes you to install it — a phone number is required — and then you tap it again to finish.",
    nudgeTitle: "Telegram is not connected yet",
    nudgeBody:
      "That is where you write to Sydney and where your two daily messages arrive. Same account: the same tasks and the same debts on both sides.",
    nudgeConnect: "Connect",
    nudgeLater: "Not now",
    nudgeClose: "Close"
  },
  settings: {
    eyebrow: "settings",
    title: "Settings",
    backToTasks: "← My tasks",
    loading: "Loading…",
    signedOut: "You need to sign in.",
    goToSignIn: "Go to sign-in",
    saved: (what: string) => `${what} saved`,
    saveFailed: "Could not save.",
    telegramTitle: "Telegram",
    telegramHint:
      "This is where Sydney lives. The web is for looking and sorting; talking to her happens over there — and so do voice notes from your phone: the web microphone only shows up on a computer.",
    telegramConnected: "✓ Connected",
    openChat: "Open the chat",
    disconnect: "Disconnect",
    disconnected: "Telegram disconnected",
    disconnectFailed: "Could not disconnect.",
    telegramMissing:
      "You have not connected Telegram yet. Until you do you will not get the morning and evening briefs, and you cannot write to Sydney.",
    languageTitle: "Language",
    languageHint:
      "The language of the app, and the language Sydney answers in on the chat. It does not change the language of the Telegram app — that one is your phone's.",
    briefsTitle: "Your two messages a day",
    briefsHint:
      "They always arrive on Telegram. There is deliberately no web version: a summary you have to go looking for is not a summary.",
    briefsNeedTelegram: "Connect Telegram above for these times to mean anything.",
    briefMorning: "☀ In the morning",
    briefEvening: "☾ In the evening",
    briefsOffHint: "Leave one empty to turn it off.",
    timezoneTitle: "Time zone",
    timezoneHint: "Sets what real time the briefs arrive and which day counts as “today”.",
    timeNow: (time: string) => `it is ${time} there now`,
    categoriesTitle: "Categories",
    categoriesHint:
      "These group your tasks, here and on Telegram. They also appear on their own when you create a task with a new category.",
    removeCategory: (name: string) => `Remove ${name}`,
    lastCategory: "At least one has to stay",
    addCategoryPlaceholder: "Add a category",
    addCategory: "Add",
    categoriesFootnote:
      "Removing a category from this list does not delete the tasks that already have it; it just stops being offered when creating one."
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

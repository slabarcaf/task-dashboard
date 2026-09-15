/**
 * The English catalogue. Its shape is `Messages`, defined by `messages.es.ts` —
 * a missing key, an extra key or a changed signature fails `tsc`, so a half-done
 * translation cannot reach production.
 *
 * What `tsc` cannot see is a value still written in Spanish. That is what
 * `tests/no-spanish-literals.test.mjs` checks here.
 */

import type { Messages } from "@/lib/i18n/messages.es";

import { list, plural } from "@/lib/i18n/plural";

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
  onboarding: {
    heroTitle: "Five minutes, and Sydney knows you.",
    heroBlurb:
      "None of this is set in stone: all of it changes later in Settings. We ask now so that day one already works.",
    heroFooter: "Here or on Telegram, it makes no difference: same account, same list.",
    progress: "Progress",
    back: "← Back",
    next: "Continue",
    skip: "Skip",
    stepOf: (current: number, total: number) => `${current} of ${total}`,
    steps: {
      categories: { label: "Categories", eyebrow: "How your life is sorted" },
      briefs: { label: "Times", eyebrow: "When your summary arrives" },
      task: { label: "Your first task", eyebrow: "Write it the way you would say it" },
      debt: { label: "Your first debt", eyebrow: "Who owes you, who you owe" },
      done: { label: "Done", eyebrow: "What is left for this to work" }
    },
    categoriesTitle: "What parts does your life split into?",
    categoriesHint:
      "Pick the ones you actually use. They group your tasks, and you can change them whenever you want.",
    customPlaceholder: "Missing one? Write it here",
    customAdd: "Add",
    inventedTitle: "Yours",
    inventedRemove: "Remove",
    briefsTitle: "When should I send you the day's summary?",
    briefsHint:
      "Two messages on Telegram, no more: in the morning what is coming today, in the evening what is still open. You can turn either one off.",
    timezoneLabel: "Your time zone",
    timezoneNow: (time: string) => `It is ${time} there right now.`,
    morningLabel: "☀ Morning summary",
    morningHint: "What is due today and what is coming",
    eveningLabel: "☾ Evening summary",
    eveningHint: "What is still undone and what is due tomorrow",
    noBriefs:
      "With neither one, Sydney will not write to you on her own. You can continue and turn them on later in Settings.",
    taskTitle: "Write your first task",
    taskHint:
      "The way you would say it to a person. If you mention when it is or what it is about, it is understood on its own — try “pay the electricity bill friday” or “send the report, category work”.",
    taskPlaceholder: "pay the electricity bill friday",
    understood: "I understood:",
    categoryLabel: "Category:",
    previewTaskTitle: "This is how it will look — try it",
    previewTaskHintFull:
      "Hover over it: the buttons really work, and whatever you leave set is saved with the task.",
    previewTaskHintEmpty: "With no date in the sentence, it lands on today.",
    today: "today",
    tomorrow: "tomorrow",
    debtTitle: "Does anyone owe you anything?",
    debtHint:
      "Sydney also keeps track of money: what you are owed and what you owe, with whom and what for. If none comes to mind right now, skip it.",
    debtWhoOwesMe: "Who owes you?",
    debtWhoIOwe: "Who do you owe?",
    debtAmount: "How much?",
    debtReason: "What for? (optional)",
    previewDebtTitle: "This is how it will look",
    previewDebtHint: "You can mark it as paid later, here or by telling Sydney on Telegram.",
    doneTitle: "That is it. One thing left.",
    doneHint:
      "Your tasks and your debts already live in your account. What is missing is the half that comes looking for you.",
    telegramPitch: "✈ Connect Telegram, or Sydney stays mute.",
    telegramWhy: (briefs: "both" | "morning" | "evening" | "none") => {
      const which =
        briefs === "both"
          ? "the morning one and the evening one"
          : briefs === "morning"
            ? "the morning one"
            : briefs === "evening"
              ? "the evening one"
              : "the daily one";
      return `This page is where you look at your tasks when you remember to look. Telegram is where Sydney comes looking for you: she sends you the summary — ${which} — and you write to her from your phone, or send her a voice note, without opening anything.`;
    },
    telegramWithout: "Without that, this is one more list you have to remember to visit.",
    bulletSync:
      "What you write here shows up on Telegram, and what you tell Sydney on Telegram shows up here. Same account.",
    bulletVoice:
      "Send her a voice note on Telegram and she turns it into a task. On a computer, the microphone in the box above does the same.",
    bulletDebts:
      "Debts sit next to the tasks: who owes you, who you owe, and how it ended up.",
    summaryEmpty: "You will go in with an empty account. Everything is set up in Settings.",
    summary: (pieces: string[]) => `You will go in with ${list(pieces, "and")}.`,
    summaryCategories: (n: number) => `${n} ${plural(n, "category", "categories")}`,
    summaryTask: "your first task already written down",
    summaryDebt: "your first debt recorded",
    summaryBriefsBoth: "the morning and evening summaries ready",
    summaryBriefMorning: "the morning summary ready",
    summaryBriefEvening: "the evening summary ready",
    saving: "Saving…",
    enter: "Done — go in",
    laterInSettings: "Do not worry, I will do it later in Settings"
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

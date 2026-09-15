/**
 * El catálogo en español. **Este archivo define la forma**; `messages.en.ts` la
 * tiene que cumplir, y `tsc` lo obliga.
 *
 * ⚠️ **No le pongas `as const`.** Parece lo correcto y rompe justo lo que
 * queremos: con `as const` cada valor queda fijado a su literal, así que
 * `Messages` exige el texto español y el archivo inglés no compila nunca
 * (`Type '"Today"' is not assignable to type '"Hoy"'`). Un objeto literal normal
 * ensancha los strings a `string` y conserva las firmas de las funciones, que es
 * exactamente la paridad que se busca: falta una llave → TS2741, sobra una →
 * TS2353, cambia la aridad de una interpolación → error en la llamada.
 *
 * ⚠️ Los arreglos se ensanchan a `string[]`, o sea que el largo **no** se
 * verifica. Las listas de largo fijo (los doce meses) se quedan en `date.ts` y
 * no entran acá.
 *
 * Los valores con parámetros son funciones, no plantillas con marcadores. Es el
 * mismo patrón que `OB` en el bot (`melissa.js`), y la razón es que una función
 * puede ramificar —plural, singular, el caso de cero— y una plantilla no.
 *
 * Lo que se guarda en la base **no se traduce acá**: los identificadores de
 * categoría (`Otros`, `Finanzas`), `direction` y `status` de una deuda y
 * `statusFinalOutcome` son valores de cable. Su etiqueta se traduce; el valor
 * viaja intacto. Ver `src/lib/categories.ts`.
 */

import { list, plural } from "@/lib/i18n/plural";

export const es = {
  meta: {
    title: "Sydney",
    description: "Tus tareas, en la web y en Telegram."
  },
  language: {
    label: "Idioma",
    es: "Español",
    en: "English"
  },
  nav: {
    viewGroup: "Vista",
    today: "Hoy",
    board: "Tablero",
    debts: "Deudas",
    search: "Buscar",
    settings: "Ajustes",
    users: "Usuarios",
    signOut: "Salir",
    lightMode: "Modo claro",
    darkMode: "Modo oscuro",
    goToTasks: "Ir a mis tareas"
  },
  loading: {
    session: "Revisando tu sesión…",
    preferences: "Cargando tus preferencias…",
    tasks: "Cargando tus tareas…"
  },
  sections: {
    overdue: "Vencidas",
    today: "Hoy",
    tomorrow: "Mañana",
    thisWeek: "Esta semana",
    later: "Más adelante",
    noDate: "Sin fecha",
    done: "Ya está"
  },
  empty: {
    firstRunTitle: "Todavía no hay nada aquí",
    firstRunHint:
      "Escribe tu primera tarea arriba. Puedes decir la fecha en la misma frase: “pagar la luz el viernes”."
  },
  card: {
    markDone: "Marcar como hecha",
    markPending: "Marcar como pendiente",
    edit: "Editar",
    moveTomorrow: "Mover a mañana",
    addPriority: "Marcar prioridad",
    removePriority: "Quitar prioridad",
    delete: "Eliminar",
    priority: "Prioridad"
  },
  capture: {
    placeholder: "Escribe una tarea… prueba “pagar la luz el viernes”",
    taskLabel: "Nueva tarea",
    categoryLabel: "Categoría",
    readCategory: (text: string) => `Leí “${text}” en lo que escribiste`,
    add: "Agregar"
  },
  filter: {
    group: "Filtrar por categoría",
    all: "Todas"
  },
  edit: {
    title: "Editar tarea",
    task: "Tarea",
    status: "Estado",
    category: "Categoría",
    nextStep: "Siguiente paso",
    date: "Fecha",
    repeats: "Se repite",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    presets: {
      none: "No se repite",
      daily: "Cada día",
      weekly: "Cada semana",
      monthly: "Cada mes",
      custom: "Personalizado"
    },
    units: {
      day: "días",
      week: "semanas",
      month: "meses"
    }
  },
  palette: {
    dialogLabel: "Buscar y ejecutar",
    placeholder: "Buscar una tarea o escribir un comando…",
    noMatches: "Nada coincide."
  },
  commands: {
    newTask: "Nueva tarea",
    viewToday: "Ver Hoy",
    viewBoard: "Ver Tablero",
    viewDebts: "Ver Deudas",
    settings: "Ajustes",
    connectTelegram: "Conectar Telegram",
    reloadTasks: "Recargar tareas"
  },
  signIn: {
    // El titular lleva una palabra destacada en medio, así que va en tres
    // piezas. Partirlo así en vez de meter HTML en el catálogo mantiene el
    // texto legible para quien traduce y el marcado dentro del componente.
    headlineBefore: "Tus pendientes, y ",
    headlineAccent: "alguien",
    headlineAfter: " que te los recuerda.",
    blurb:
      "Anótalos escribiéndole a Sydney como le escribirías a una persona — “pagar la luz el viernes” — o ábrelos aquí y ordénalos con el mouse. Ella te los devuelve puestos en orden, sin que tengas que ir a buscarlos.",
    briefEyebrow: "Y te escribe dos veces al día",
    morningBrief: "☀ 7:00 · lo que viene hoy",
    eveningBrief: "☾ 20:00 · cierre del día",
    sameAccount: "Aquí o en Telegram, da igual: es la misma cuenta y la misma lista.",
    title: "Entra a tu cuenta",
    privacy: "Tus tareas son privadas. Nadie más las ve.",
    signingIn: "Entrando…",
    terms: "Al continuar aceptas que Sydney guarde tus tareas para mostrártelas. La sesión dura 15 días.",
    missingClientIdBefore: "Falta ",
    missingClientIdAfter: ". El acceso no puede funcionar sin esa variable."
  },
  toast: {
    undo: "Deshacer",
    ready: "Listo",
    // Una llave por sustantivo, nunca una genérica reusada. Hoy "Eliminada"
    // sirve para tarea y para deuda porque las dos son femeninas; separarlas
    // igual es lo que evita que el primer sustantivo masculino herede en
    // silencio la concordancia equivocada.
    taskAdded: "Agregada",
    taskDone: "Hecha",
    taskReopened: "Reabierta",
    taskSaved: "Guardada",
    taskDeleted: "Eliminada",
    taskRestored: "Recuperada",
    movedToTomorrow: "Movida a mañana",
    dateRestored: "Fecha restaurada",
    priorityOn: "Con prioridad",
    priorityOff: "Sin prioridad",
    debtAdded: "Anotada",
    debtDeleted: "Eliminada",
    debtPaid: "Marcada como pagada"
  },
  debts: {
    loading: "Cargando tus deudas…",
    theyOwe: "Te deben",
    youOwe: "Debes",
    settled: "Saldadas",
    owedTo: "Te deben",
    owing: "Debes",
    emptyTitle: "No hay deudas anotadas",
    emptyHint:
      "Anota aquí lo que te deben y lo que debes. También puedes decírselo a Sydney por Telegram.",
    markPaid: "Marcar como pagada",
    markPending: "Marcar como pendiente",
    delete: "Eliminar",
    // Rótulos de las dos direcciones. El valor guardado sigue siendo
    // "Me deben" / "Debo yo" — acá solo cambia lo que se lee.
    directionTheyOwe: "Me deben",
    directionIOwe: "Debo yo",
    whoPlaceholder: "¿Quién?",
    whoLabel: "Nombre",
    whyPlaceholder: "¿Por qué? (opcional)",
    whyLabel: "Motivo",
    amountLabel: "Monto",
    currencyLabel: "Moneda",
    add: "Anotar"
  },
  voice: {
    record: "Grabar una nota de voz",
    releaseAria: "Soltar para transcribir",
    holdTitle: "Mantén pulsado para grabar",
    releaseTitle: "Suelta para transcribir",
    notConfigured: "Las notas de voz no están configuradas todavía (falta OPENAI_API_KEY).",
    failed: "No se pudo transcribir.",
    nothingHeard: "No se entendió nada. Intenta de nuevo, más cerca del micrófono.",
    micDenied:
      "El navegador no dio permiso al micrófono. Habilítalo para este sitio y vuelve a intentar.",
    micFailed: "No se pudo abrir el micrófono."
  },
  telegram: {
    connected: "✓ Telegram conectado",
    connectedHint: "Ya puedes escribirle. Los resúmenes empiezan mañana.",
    connect: "Conectar Telegram",
    generating: "Generando…",
    codeFailed: "No se pudo generar el código.",
    qrAlt: "Código QR para abrir el chat de Sydney en Telegram",
    openAndConnect: "Abrir Telegram y conectar",
    onComputerBold: "¿Estás en el computador?",
    onComputerRest: " Escanea el código con la cámara del teléfono. Ahí es donde te va a servir el chat.",
    cannotScanBefore: "¿No puedes escanear? Escríbele a ",
    cannotScanAfter: " en Telegram:",
    codeLifeBefore: "El código sirve por 24 horas. ",
    codeLifeBold: "Si no tienes Telegram",
    codeLifeAfter:
      ", el enlace te lleva a instalarlo — hace falta un número de teléfono — y después vuelves a tocarlo para terminar.",
    nudgeTitle: "Te falta conectar Telegram",
    nudgeBody:
      "Ahí es donde le escribes a Sydney y donde llegan tus dos mensajes del día. Es la misma cuenta: las mismas tareas y las mismas deudas, en los dos lados.",
    nudgeConnect: "Conectar",
    nudgeLater: "Ahora no",
    nudgeClose: "Cerrar"
  },
  settings: {
    eyebrow: "ajustes",
    title: "Ajustes",
    backToTasks: "← Mis tareas",
    loading: "Cargando…",
    signedOut: "Necesitas iniciar sesión.",
    goToSignIn: "Ir al acceso",
    saved: (what: string) => `${what} guardado`,
    saveFailed: "No se pudo guardar.",
    telegramTitle: "Telegram",
    telegramHint:
      "Aquí es donde Sydney vive. La web es para mirar y ordenar; hablar con ella es allá — y desde el teléfono, las notas de voz también: el micrófono de la web solo aparece en el computador.",
    telegramConnected: "✓ Conectado",
    openChat: "Abrir el chat",
    disconnect: "Desconectar",
    disconnected: "Telegram desconectado",
    disconnectFailed: "No se pudo desconectar.",
    telegramMissing:
      "Todavía no has conectado Telegram. Mientras no lo hagas no recibirás los briefs de la mañana y la noche, y no puedes escribirle a Sydney.",
    languageTitle: "Idioma",
    languageHint:
      "El idioma de la app y el idioma en que Sydney te responde en el chat. No cambia el idioma de la app de Telegram — eso es de tu teléfono.",
    briefsTitle: "Tus dos mensajes del día",
    briefsHint:
      "Llegan por Telegram, siempre. No hay versión web de esto a propósito: un resumen que tienes que ir a buscar no es un resumen.",
    briefsNeedTelegram: "Conecta Telegram arriba para que estos horarios sirvan de algo.",
    briefMorning: "☀ En la mañana",
    briefEvening: "☾ En la noche",
    briefsOffHint: "Déjalo vacío para apagar uno de los dos.",
    timezoneTitle: "Zona horaria",
    timezoneHint: "Define a qué hora real llegan los briefs y qué día es “hoy”.",
    timeNow: (time: string) => `ahora son las ${time}`,
    categoriesTitle: "Categorías",
    categoriesHint:
      "Con estas se agrupan tus tareas, aquí y en Telegram. También aparecen solas cuando creas una tarea con una categoría nueva.",
    removeCategory: (name: string) => `Quitar ${name}`,
    lastCategory: "Tiene que quedar al menos una",
    addCategoryPlaceholder: "Agregar una categoría",
    addCategory: "Agregar",
    categoriesFootnote:
      "Quitar una categoría de esta lista no borra las tareas que ya la tienen; solo deja de ofrecerse al crear."
  },
  onboarding: {
    heroTitle: "Cinco minutos, y Sydney te conoce.",
    heroBlurb:
      "Nada de esto queda escrito en piedra: todo se cambia después en Ajustes. Lo preguntamos ahora para que el primer día ya sirva.",
    heroFooter: "Aquí o en Telegram, da igual: es la misma cuenta y la misma lista.",
    progress: "Progreso",
    back: "← Atrás",
    next: "Seguir",
    skip: "Saltar",
    stepOf: (current: number, total: number) => `${current} de ${total}`,
    steps: {
      categories: { label: "Categorías", eyebrow: "Cómo se ordena tu vida" },
      briefs: { label: "Horarios", eyebrow: "Cuándo te llega el resumen" },
      task: { label: "Tu primera tarea", eyebrow: "Escríbela como la dirías" },
      debt: { label: "Tu primera deuda", eyebrow: "Quién te debe, a quién le debes" },
      done: { label: "Listo", eyebrow: "Lo que falta para que funcione" }
    },
    categoriesTitle: "¿En qué partes se divide tu vida?",
    categoriesHint:
      "Elige las que uses de verdad. Sirven para agrupar tus tareas, y puedes cambiarlas cuando quieras.",
    customPlaceholder: "¿Falta alguna? Escríbela aquí",
    customAdd: "Agregar",
    inventedTitle: "Tuyas",
    inventedRemove: "Quitar",
    briefsTitle: "¿Cuándo te mando el resumen del día?",
    briefsHint:
      "Dos mensajes por Telegram, no más: en la mañana lo que viene hoy, en la noche lo que quedó pendiente. Puedes apagar cualquiera de los dos.",
    timezoneLabel: "Tu zona horaria",
    timezoneNow: (time: string) => `Ahí son las ${time} ahora mismo.`,
    morningLabel: "☀ Resumen de la mañana",
    morningHint: "Lo que vence hoy y lo que viene",
    eveningLabel: "☾ Resumen de la noche",
    eveningHint: "Lo que quedó sin hacer y lo de mañana",
    noBriefs:
      "Sin ninguno de los dos, Sydney no te va a escribir sola. Puedes seguir y encenderlos después en Ajustes.",
    taskTitle: "Escribe tu primera tarea",
    taskHint:
      "Como se la dirías a una persona. Si mencionas cuándo o de qué es, se entiende solo — prueba con “pagar la luz el viernes” o “mandar el informe, categoría trabajo”.",
    taskPlaceholder: "pagar la luz el viernes",
    understood: "Entendí:",
    categoryLabel: "Categoría:",
    previewTaskTitle: "Así se va a ver — pruébala",
    previewTaskHintFull:
      "Pasa el mouse por encima: los botones funcionan de verdad, y lo que dejes marcado se guarda con la tarea.",
    previewTaskHintEmpty: "Sin fecha en la frase, queda para hoy.",
    today: "hoy",
    tomorrow: "mañana",
    debtTitle: "¿Alguien te debe algo?",
    debtHint:
      "Sydney también lleva la cuenta de las platas: lo que te deben y lo que debes, con quién y por qué. Si no se te ocurre ninguna ahora, sáltala.",
    debtWhoOwesMe: "¿Quién te debe?",
    debtWhoIOwe: "¿A quién le debes?",
    debtAmount: "¿Cuánto?",
    debtReason: "¿Por qué? (opcional)",
    previewDebtTitle: "Así se va a ver",
    previewDebtHint:
      "Después puedes marcarla como pagada, aquí o diciéndoselo a Sydney por Telegram.",
    doneTitle: "Ya está. Falta una cosa.",
    doneHint:
      "Tus tareas y tus deudas ya viven en tu cuenta. Lo que falta es la mitad que te busca a ti.",
    telegramPitch: "✈ Conecta Telegram, o Sydney se queda muda.",
    // Una función y no una plantilla con hueco: el trozo variable cambia de
    // número gramatical entre idiomas, y una plantilla no puede con eso.
    telegramWhy: (briefs: "both" | "morning" | "evening" | "none") => {
      const which =
        briefs === "both"
          ? "de la mañana y el de la noche"
          : briefs === "morning"
            ? "de la mañana"
            : briefs === "evening"
              ? "de la noche"
              : "del día";
      return `Esta página es donde miras tus tareas cuando te acuerdas de mirarlas. Telegram es donde Sydney te busca a ti: te manda el resumen ${which}, y le escribes desde el teléfono —o le mandas un audio— sin abrir nada.`;
    },
    telegramWithout: "Sin eso, esto es una lista más que hay que acordarse de visitar.",
    bulletSync:
      "Lo que anotes aquí aparece en Telegram, y lo que le digas a Sydney por Telegram aparece aquí. Es la misma cuenta.",
    bulletVoice:
      "Mándale un audio por Telegram y lo convierte en tarea. En el computador, el micrófono de la caja de arriba hace lo mismo.",
    bulletDebts:
      "Las deudas van al lado de las tareas: quién te debe, a quién le debes, y en qué quedó.",
    summaryEmpty: "Vas a entrar con la cuenta vacía. Todo se configura en Ajustes.",
    summary: (pieces: string[]) => `Vas a entrar con ${list(pieces, "y")}.`,
    summaryCategories: (n: number) => `${n} ${plural(n, "categoría", "categorías")}`,
    summaryTask: "tu primera tarea ya anotada",
    summaryDebt: "tu primera deuda registrada",
    summaryBriefsBoth: "los resúmenes de la mañana y la noche listos",
    summaryBriefMorning: "el resumen de la mañana listo",
    summaryBriefEvening: "el resumen de la noche listo",
    saving: "Guardando…",
    enter: "Listo — entrar",
    laterInSettings: "No te preocupes, lo hago más tarde en Ajustes"
  },
  errors: {
    signIn: "No se pudo entrar.",
    noCredential: "Google no devolvió una credencial.",
    googleScript: "No se pudo cargar el acceso con Google.",
    preferences: "No se pudieron cargar tus preferencias.",
    debtsLoad: "No se pudieron cargar las deudas.",
    taskAdd: "No se pudo agregar.",
    taskAddShort: "No se pudo agregar",
    debtAdd: "No se pudo anotar.",
    debtAddShort: "No se pudo anotar",
    update: "No se pudo actualizar",
    delete: "No se pudo eliminar",
    restore: "No se pudo recuperar",
    save: "No se pudo guardar.",
    pickCategory: "Elige al menos una categoría."
  }
};

export type Messages = typeof es;

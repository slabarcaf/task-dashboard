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

# DESIGN.md — el sistema visual de Sydney

Fuente de verdad de cómo se ve la app. Si un color, una fuente o un radio no está
aquí, no debería estar hardcodeado en un componente.

La referencia visual completa es `design-mockup.html`, en el repo `melissa-bot`.
Es una maqueta estática, sin React ni backend, con las cinco superficies del
rediseño y un conmutador claro/oscuro.

---

## La dirección: amanecer y anochecer

Índigo profundo de base, ámbar cálido para lo que pide atención.

No es una elección arbitraria de gusto. La estructura real del producto **es el
día**: el brief de las 7:00 y el de las 20:00. El color sigue esa estructura.

**Por qué índigo y no morado.** El azul es el color canónico de confianza y
calma — bancos, salud, seguros — porque es de baja activación. El morado
comunica "premium/creativo" antes que seguridad, y el degradado azul-morado es
hoy el look genérico de todo producto de IA. El índigo queda entre las dos
opciones que estaban sobre la mesa.

Los neutros llevan **sesgo azul a propósito**: un gris puro se lee como un gris
que nadie eligió.

---

## Tokens

Viven en `src/app/globals.css` como variables CSS y se exponen a Tailwind desde
`tailwind.config.ts`. **Un cambio de tema es un cambio de variable**: ningún
nombre de clase cambia.

| Rol | Variable | Claro | Oscuro |
|---|---|---|---|
| Fondo | `--bg` | `#F7F8FC` | `#0F1226` |
| Superficie | `--surface` | `#FFFFFF` | `#1A1E3D` |
| Superficie elevada | `--raised` | `#F1F3FA` | `#242A54` |
| Superficie hundida | `--sunken` | `#EAEDF7` | `#141830` |
| Texto | `--ink` | `#151A3A` | `#E8EAF6` |
| Texto secundario | `--ink-2` | `#5B6188` | `#A0A6C8` |
| Texto terciario | `--ink-3` | `#8A90B0` | `#767D9F` |
| Borde | `--line` | `#E2E5F0` | `#2E3563` |
| Borde marcado | `--line-2` | `#D3D8E8` | `#3A4276` |
| Marca | `--brand` | `#3D4BC7` | `#7B87F0` |
| Texto sobre marca | `--brand-ink` | `#FFFFFF` | `#0F1226` |
| Marca suave | `--brand-soft` | `#E8EBFB` | `#232A5C` |
| Atención / prioridad | `--amber` | `#E8912B` | `#F5A93F` |
| Listo | `--ok` | `#2E9E6B` | `#4ADE9B` |
| Vencido | `--late` | `#D95241` | `#FF6B5B` |

Cada color de estado tiene su variante `-soft` para fondos de chip.
`--night-1` / `--night-2` son los dos extremos del día y solo los usa el fondo de
la pantalla de acceso.

En Tailwind: `bg-surface`, `text-ink-2`, `border-line`, `bg-brand-soft`,
`text-late`, `shadow-card`, `shadow-float`.

### La rampa `brand-50…900` está retirada

Es la paleta vieja. Sigue en `tailwind.config.ts` **solo** porque las pantallas
que aún no se rediseñan la usan. Se borra con la última de ellas. Trabajo nuevo:
`brand`, `brand-soft`, `brand-ink`.

---

## Tipografía

Cargadas con `next/font/google` en `layout.tsx`, self-hosted en build: sin
petición a Google en runtime, sin salto de layout, sin nada que agregar al CSP.

- **Sora** — títulos, cifras grandes, etiquetas de sección. `font-display`.
- **Figtree** — interfaz y texto corrido. `font-sans`, y es la del `<body>`.
- **`.num`** (o `tabular-nums`) en fechas y contadores, para que las columnas no
  bailen dígito a dígito.

---

## Radios y sombras

Los radios van con **nombre propio** (`rounded-card`, `rounded-panel`…) y no
sobreescriben la escala de Tailwind. Si `rounded-lg` pasara de 8px a 18px,
cambiarían en silencio todas las esquinas de las pantallas que todavía no se
tocan.

| Nombre | Valor | Uso |
|---|---|---|
| `rounded-chip` | `999px` | chips, píldoras |
| `rounded-field` | `8px` | inputs, botones |
| `rounded-card` | `12px` | tarjetas de tarea |
| `rounded-panel` | `18px` | paneles, modales |
| `rounded-hero` | `26px` | la tarjeta de acceso |

Sombras: `shadow-card` para reposo, `shadow-float` para lo que flota (modal,
paleta de comandos, toast).

---

## Modo oscuro

Los dos temas se diseñaron juntos y ambos juegos de tokens ya están escritos.

El tema se elige con **un solo atributo**: `data-theme` en `<html>`, que pone
`useTheme` — desde la elección guardada si existe, y si no desde
`prefers-color-scheme`. Mantenerlo en un atributo en vez de repartirlo entre una
media query y un override es lo que hace que el conmutador gane en las dos
direcciones sin reglas que se peleen.

`localStorage` puede lanzar excepción en un navegador con el almacenamiento
bloqueado, así que cada lectura y escritura va con `try`/`catch`: fallar ahí
significa que el tema no se recuerda, nunca que la pantalla se rompe.

La variante `dark:` de Tailwind está atada al mismo atributo, para que un
`dark:` suelto no siga al sistema mientras los tokens siguen al atributo.

---

## Reglas de trabajo

**No se crean componentes nuevos en `components/ui/` sobre la marcha.** Las
features se componen de primitivos existentes. Un primitivo nuevo se propone
antes; si no, el kit se convierte en un basurero de variantes de un solo uso.

**`cn()` hace merge de verdad.** Usa `tailwind-merge`, así que un `className` del
llamador *reemplaza* la clase del componente en vez de sumarse. Si agregas un
radio nuevo a `tailwind.config.ts`, agrégalo también a la lista de
`extendTailwindMerge` en `src/lib/cn.ts` — los colores no lo necesitan, los
radios sí.

**Deshacer en vez de confirmar.** Ninguna acción destructiva pregunta antes. La
acción ocurre al instante y el toast ofrece "Deshacer". Confirmar castiga las
mil veces que el usuario sí quería, para proteger la vez que no.

**Teclado primero.** `⌘K` (o `/`) abre la paleta, `n` salta a la captura rápida,
`Escape` cierra cualquier diálogo, `⌘↵` guarda el editor. Las teclas sueltas se
ignoran mientras estás escribiendo — si no, la `n` de "renovar" te robaría el
foco a media palabra. Faltan `j`/`k` para navegar entre tarjetas y `x` para
completar: van cuando haya una noción de "tarjeta seleccionada".

**El chip de categoría tiene color, y el tono se calcula.** La versión anterior
de esta regla decía lo contrario —chip neutro, porque un color por categoría no
escala cuando el usuario las inventa— y estaba equivocada en el caso de todos los
días: una lista de ocho chips grises es una lista que hay que *leer*. Con color
se agrupan de un vistazo.

Escala porque nadie mantiene una tabla: el tono sale del nombre
(`src/lib/categoryColor.ts`), y la saturación y luminosidad son fijas en CSS, así
que el contraste es parejo y una categoría inventada recibe su color sola. Las
canónicas están fijadas para que no cambien entre despliegues ni entre cuentas.

⚠️ **La paleta evita la franja 0–45°** — rojos y ámbares. Esos tonos significan
*estado* (vencida, prioridad) y una categoría roja se leería como una tarea
atrasada.

---

## Trampas conocidas

**El botón de Google es lo más frágil de la app.** Su `useEffect` se corta si
`googleButtonRef.current` es `null`, y sus dependencias no cambian cuando el div
aparece más tarde. Si queda detrás de un condicional, una animación de entrada,
un `Suspense` o un componente que monta un tick después, **el efecto corre contra
un ref vacío y no vuelve a correr: el botón nunca aparece, sin ningún error en
consola**. El `useRef` y el efecto tienen que vivir en el mismo componente que
renderiza el div.

**Google inyecta un iframe: no se estiliza con Tailwind.** Solo se ajusta por las
opciones de `renderButton`, y `width` es un píxel fijo, no responsivo. El diseño
lo rodea, no lo pinta.

**`innerHTML = ""` borra lo que haya dentro del div del ref.** Spinners o textos
de respaldo van como hermanos, no como hijos.

**La limpieza de ese efecto puede lanzar `NotFoundError`** si la pantalla monta y
desmonta varias veces. Hoy está enmascarado; un rediseño que la meta y saque del
árbol lo destapa.

**No uses `requestAnimationFrame` para enfocar.** Un `rAF` no dispara en una
página que no está componiendo cuadros — una pestaña en segundo plano, un panel
oculto, una ventana minimizada. La paleta de comandos se abría sin foco por
exactamente eso: presionabas ⌘K, escribías, y las letras caían en el campo que
estaba enfocado antes. El nodo ya existe cuando corre el efecto: enfócalo
directo.

**El kit de `components/ui/` casi no existe.** Quedó solo `Toast`. `Badge`,
`Button`, `Input`, `Modal`, `Select` y `Tabs` se borraron cuando dejaron de
usarse: estaban pintados con la paleta retirada, así que reutilizarlos habría
reintroducido `brand-600` en silencio. `Modal` además no tenía focus trap, ni
cierre con Escape, ni portal. Los dos diálogos que existen —la paleta y el
editor— manejan su propio foco, que es poco: autofoco, Escape, clic en el fondo,
y devolver el foco a donde estaba. Si aparece un tercero, ahí sí conviene traer
un primitivo accesible de verdad.

---

## Decisiones registradas para después

**Si algún día se agrega orden manual (drag & drop):** va con claves
fraccionarias lexicográficas, columna con **collation binaria** (`BINARY`, nunca
`NOCASE`) y un job de rebalanceo. Con `dnd-kit`, no con `react-beautiful-dnd`.
Hoy la app **no tiene** reordenamiento manual — ordena por fecha — así que esto
sería funcionalidad nueva, no rediseño. Se escribe aquí porque el modelo de
datos es caro de arreglar tarde.

**TanStack Query, diferido.** La capa optimista actual funciona. Extraer
`useTasks()` es exactamente la costura que lo hará fácil después.

**Tailwind v4, aparte.** Hoy es 3.4.17. Actualizar durante un rediseño mueve dos
variables a la vez. Los tokens están escritos en CSS de forma compatible con v4.

**Zod en el borde, aparte.** Las rutas validan a mano con `String()`/`Number()`.
Es trabajo de backend, separable de esto.

---

## Captura rápida

Una línea, una tarea. `parseTaskInput` saca la fecha de la frase — "pagar la luz
el viernes" — y la muestra como chip **antes** de que confirmes, para que el
parser nunca adivine por ti sin decirlo.

Es deliberadamente chico: reconoce las formas que aparecen de verdad (hoy,
mañana, pasado mañana, un día de la semana, "en N días", una fecha suelta) y ante
la duda no toca el texto. **Un parser que adivina es peor que uno que se
abstiene:** una fecha equivocada es invisible hasta que el recordatorio suena el
día que no era.

Vive en `src/lib/parseTaskInput.ts` y tiene tests (`npm test`). El primero que
falló fue "pasado mañana": la regla de "mañana" calzaba adentro y dejaba un
"pasado" pegado al título. El orden de las reglas importa.


---

## Densidad de la lista

La tarjeta de la vista Hoy es **una sola fila**: título a la izquierda, y todo lo
demás —prioridad, categoría, fecha— a la derecha. Antes el meta iba *debajo* del
título y una tarjeta medía ~90px, así que con ocho tareas ya había que hacer
scroll. Ahora mide **41px** y caben doce en una pantalla.

**Solo desde `sm` hacia arriba.** En un teléfono de 375px esa misma fila aplasta
el título hasta "Mand…" o hasta nada: ahí el espacio escaso es el horizontal, y
el vertical es gratis porque igual haces scroll. Bajo `sm` se apila.

El bloque de meta reserva 124px a la derecha para que la capa de acciones del
hover nunca caiga encima de la fecha.

## Cuán vencida está

Cuatro escalones de rojo (`late-1`…`late-4` en `globals.css`), mezclados con
`color-mix` contra la superficie en vez de fijados como hex — así el mismo
escalón sirve en claro y en oscuro sin una segunda tabla que se desincronice.

Escalones y no un degradado continuo: a estas opacidades el ojo no distingue 9
días de 11, y los saltos hacen legible "esta lleva mucho más que esa".

**El tope es 14% a propósito.** El color aquí es un susurro, no una alarma: el
borde izquierdo ya dice "vencida", y una lista donde todo grita no prioriza nada.

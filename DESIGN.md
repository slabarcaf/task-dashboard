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

**Hoy el modo oscuro solo se alcanza con `<html data-theme="dark">`.** La regla
`prefers-color-scheme` se conecta en el último paso del rediseño, cuando todas
las pantallas lean tokens. Encenderla antes le entregaría una pantalla a medio
migrar — texto oscuro sobre fondo oscuro — a cualquiera que tenga el sistema en
oscuro.

Para probarlo mientras tanto: `document.documentElement.dataset.theme = "dark"`.

Cuando se conecte, va con las tres formas juntas, para que el conmutador gane en
ambas direcciones:

```css
:root { /* claro */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* oscuro */ } }
:root[data-theme="dark"] { /* oscuro */ }
```

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

**Teclado primero.** `j`/`k` navegar, `e` editar, `x` completar, `⌘K` paleta de
comandos. Es lo que más separa una app de tareas de un formulario.

**El chip de categoría es neutro.** Un color por categoría no escala: las
categorías son definidas por el usuario, y a la sexta el arcoíris deja de
comunicar. La jerarquía cromática se reserva para el estado (vencido, prioridad,
listo), que es lo que sí hay que ver de reojo.

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

**`Modal` no tiene focus trap, ni cierre con Escape, ni portal.** Es la carencia
concreta que justifica traer un primitivo accesible (Base UI / shadcn) para el
diálogo y la paleta de comandos — no una migración completa del kit a mitad del
rediseño.

**`Badge`, `Tabs` y `Toast` no aceptan `className`.** Cualquier ajuste puntual
obliga a editar el componente.

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

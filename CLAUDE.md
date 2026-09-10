# Sydney — dashboard web

La cara web de Sydney. Es también la API que usa el bot de Telegram
(`melissa-bot`), que se autentica con `OPENCLAW_API_SECRET`.

## Antes de tocar nada visual

**Lee [`DESIGN.md`](DESIGN.md).** Ahí están los tokens de color, la tipografía,
los radios, las reglas de trabajo y — sobre todo — las trampas conocidas. La más
cara: el botón de Google desaparece sin dar ningún error si su `useEffect` queda
detrás de un condicional o de un componente que monta un tick más tarde.

La referencia visual es `design-mockup.html`, en el repo `melissa-bot`.

## El resto del sistema

Este repo es la mitad web. La otra mitad — el bot, el onboarding, los briefs, los
servidores MCP — vive en `melissa-bot`, y su `CLAUDE.md` rutea al handoff más
reciente. Empieza por ahí si llegaste sin contexto.

## Despliegue

Vercel construye cada push a `main` (proyecto `task-dashboard-c7q2`, cuenta
`slabarcaf`). **El email del commit tiene que pertenecer a tu cuenta de GitHub o
el deploy queda `Blocked`** — el README explica por qué y cómo se arregla.

## Móvil y escritorio no son la misma pantalla

El corte está en `sm` (640px), y es una decisión, no un accidente:

- **La tarjeta de la lista** es una fila en escritorio (título izquierda, todo lo demás derecha, 41px) y se **apila** en el teléfono. Ahí el espacio escaso es el horizontal: la misma fila aplastaba los títulos hasta "Mand…".
- **El encabezado** muestra palabras en escritorio e **iconos** en el teléfono, y el logotipo pierde la palabra "Sydney". Con las tres palabras se partía en dos filas y se comía 104px de 812.
- **Las columnas del tablero** son 264px fijos en escritorio y **78vw** en el teléfono, para que se vea una entera y asome la siguiente.

Al tocar cualquiera de estas tres, mide las dos anchuras. 1180 y 375 son las que uso.

## Comprobaciones

```bash
npm run check     # tsc + lint + tests, sin tocar .next
```

⚠️ **Nunca corras `npm run build` con `npm run dev` levantado.** Comparten `.next`,
el build de producción pisa los chunks que el dev está sirviendo, y cada ruta
devuelve 500 con `Cannot find module './276.js'`. Se arregla con `rm -rf .next`.
Por eso existe `npm run check` (no toca `.next`) y `npm run build:safe` (lo borra
antes).

La que más importa después de tocar la pantalla de acceso: cargarla sin sesión en
el navegador y confirmar que el iframe de Google se renderiza de verdad.

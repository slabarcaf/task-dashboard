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

## Comprobaciones

```bash
npx tsc --noEmit && npm run lint && npm run build
```

La que más importa después de tocar la pantalla de acceso: cargarla sin sesión en
el navegador y confirmar que el iframe de Google se renderiza de verdad.

---
name: carruseles-funnels-labs
description: Crea carruseles (Instagram/LinkedIn, 1080×1350) con la marca Funnels Labs — tipografía Montserrat, fondo blanco y acentos lima #B5FF2B, lila y negro. Úsala cuando pidan un carrusel, slides para redes, un post deslizable o convertir un tema/artículo en carrusel de Funnels Labs. Incluye guía de marca, fórmulas de copy, plantilla HTML y script para exportar PNG.
---

# Carruseles Funnels Labs

Produce carruseles listos para publicar: copy + PNG por slide.

## Archivos de esta skill

| Archivo | Para qué |
|---|---|
| `references/marca.md` | Colores, tipografía, márgenes, reglas de contraste. **Léelo siempre antes de diseñar.** |
| `references/copy.md` | Estructuras de carrusel, fórmulas de hook y CTA, tono de voz. |
| `assets/plantilla.html` | **Estilo clásico**: 6 tipos de slide (portada, texto, lista, dato, cita, CTA). Para listas, pasos, errores, tips. |
| `assets/plantilla-trends.html` + `references/estilo-trends.md` | **Estilo trends/mockups**: pantallas de ejemplo + tarjetas explicativas sobre brillo lima/lila. Para trends, ideas de contenido, ejemplos, referentes. |
| `references/noticias.md` | Carruseles de noticias de último momento (marcas e IA): cómo investigar, verificar y citar. |
| `scripts/render.cjs` | Exporta cada `.slide` del HTML a PNG 1080×1350. |

## Flujo

1. **Brief**: tema, objetivo, audiencia, CTA. Si falta algo, asume lo más
   razonable para un negocio de LATAM y dilo en una línea.
2. **Estilo y estructura**: elige el estilo (clásico o trends — si el usuario
   manda un referente con pantallas/mockups, usa trends y lee
   `references/estilo-trends.md`) y una estructura de `references/copy.md`
   (5–10 slides; 7 es el punto dulce).
3. **Copy**: escribe slide por slide. Portada ≤ 10 palabras, resto ≤ 30.
   Marca con `<mark>` 1–3 palabras clave por slide (se pintan con lima).
4. **HTML**: copia la plantilla del estilo elegido a `carruseles/<slug>/carrusel.html`,
   borra los slides de ejemplo que no uses, duplica los que necesites y
   reemplaza el texto. No toques los tokens de `:root` salvo que el
   usuario lo pida. Actualiza el contador `01 / 07` de cada slide.
5. **Render**:
   ```bash
   node .claude/skills/carruseles-funnels-labs/scripts/render.cjs carruseles/<slug>/carrusel.html
   ```
   Genera `carruseles/<slug>/slide-01.png`, `slide-02.png`, …
6. **QA visual**: abre (Read) la portada, un slide intermedio y el CTA.
   Comprueba: nada cortado, texto no desborda, contraste correcto, el
   lima no se usa como color de texto sobre blanco. Corrige y re-renderiza.
7. **Entrega**: rutas de los PNG + caption (hook en la primera línea,
   2–4 líneas de valor, CTA, ≤ 5 hashtags).

## Si no hay Playwright

El script busca `playwright` local o global. Si no está:
`npm i -D playwright` (o `npx playwright install chromium` si falta el
navegador). Como alternativa, entrega el HTML: cada `.slide` mide
exactamente 1080×1350 y se puede capturar desde el navegador.

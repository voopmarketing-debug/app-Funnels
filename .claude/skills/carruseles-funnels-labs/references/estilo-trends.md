# Estilo "Trends / mockups"

Estilo editorial tipo "lo que está funcionando en Instagram": cada slide
presenta un formato o idea con **dos pantallas de ejemplo** (mockups) más
**dos tarjetas** que lo explican. Plantilla: `assets/plantilla-trends.html`.

Úsalo cuando pidan: trends, ideas de contenido, formatos, "lo que está
funcionando", ejemplos, referentes, comparativas de varios casos.

## Estructura (7 slides)

1. **Portada**: logo arriba, titular centrado de 3–4 líneas con la parte
   clave en *itálica 800* más grande, sobre un brillo lima + lila; pastilla
   con flecha.
2–6. **Un trend por slide**: `0N.` + título corto (≤ 4 palabras, debe
   caber en **una línea** a 62px) · tarjeta "nota" (qué es, ≤ 18 palabras)
   · 2 pantallas de ejemplo · tarjeta "Funciona para / Funciona porque"
   (2–3 viñetas de ≤ 5 palabras) · logo abajo al centro.
7. **Cierre**: pregunta en el mismo formato que la portada + caja negra con
   CTA ("Comenta el número", "Link en bio").

Alterna los layouts `A` y `B` (espejo) y los fondos `glow-lime` /
`glow-lilac` slide a slide.

## Piezas

- `.phone` — tarjeta blanca 460×600 con cabecera: `‹`, fecha + hora,
  tres puntos (negro, lila, lima). Ligeramente rotada (±1.5°).
- `.screen` — el contenido de la pantalla. Variantes: `s-black`,
  `s-lime`, `s-lilac`, `s-paper`, `s-dark`, `chat` (burbujas tipo
  WhatsApp: `.msg.in` blanca / `.msg.out` lima), `vs` (dos mitades
  comparadas), `tl` (lista con horarios).
- **Capturas reales**: pon `<img src="captura.png">` dentro de `.screen`
  y se ajusta sola (object-fit: cover). Prefiere capturas reales de
  clientes cuando las haya.
- **Fotos (humanizar)**: en cada slide, **una pantalla con foto y otra solo
  de texto**. Dos variantes: `.screen.photo` con `.band` (franja de texto
  arriba, tipo meme) + `.pic` con `<img>`; o `.screen.photo.overlay`
  (foto completa con el texto encima sobre degradado oscuro). Las fotos van
  en `carruseles/<slug>/img/NN.jpg`; si falta una, la pantalla muestra
  rayas y el nombre del archivo esperado (`data-foto`). Prioridad: fotos
  reales del equipo o clientes > mascotas/personas con expresión >
  stock genérico. Pide las fotos al usuario o descárgalas de
  Unsplash/Pexels (licencia libre) si la red lo permite.
- `.card.note` y `.card.why` — tarjetas blancas con sombra suave.

## Reglas extra sobre `marca.md`

- Fondo siempre blanco; el color entra como brillo radial suave, no como
  fondo plano.
- Se permite sombra suave en tarjetas y pantallas (es parte del estilo).
- **Permanent Marker** solo dentro de pantallas que imitan contenido
  "hecho a mano". Todo lo demás, Montserrat.
- Las fechas de las pantallas son decorativas: usa la semana de publicación.
- No copies textos ni imágenes del referente: replica la estructura, el
  contenido es propio de Funnels Labs.

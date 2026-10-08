# Marca Funnels Labs — versión carrusel (fondo blanco)

Fuente de verdad: `src/app/globals.css` y `src/app/layout.tsx` del repo.
La web es oscura por defecto; los carruseles usan la **variante clara**:
fondo blanco + los colores de marca como acento.

## Tipografía

- **Montserrat** (Google Fonts) para todo. Nada de segunda tipografía.
- Pesos: 800 titulares de portada · 700 títulos · 600 etiquetas ·
  500/400 cuerpo.
- Titulares con `letter-spacing: -0.02em` (tracking apretado, como el logo
  "Funnels Labs" en la web).
- Etiquetas/kicker: MAYÚSCULAS, 600, `letter-spacing: 0.14em`, tamaño pequeño.
- Números: `font-variant-numeric: tabular-nums`.

| Elemento | Tamaño (px en 1080×1350) |
|---|---|
| Titular portada | 96–120 |
| Título de slide | 64–76 |
| Cuerpo | 36–42 |
| Dato grande | 220–280 |
| Kicker / pie | 24–26 |

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#FFFFFF` | Fondo de todos los slides |
| `--surface` | `#F6F6F2` | Tarjetas, cajas de lista |
| `--border` | `#E2E2DB` | Bordes finos, cuadrícula de fondo |
| `--ink` | `#0A0A0A` | Texto principal, bloques negros |
| `--ink-muted` | `#3D3D35` | Texto secundario |
| `--ink-faint` | `#5C5C53` | Pies, contador |
| `--lime` | `#B5FF2B` | **Color firma.** Resaltados (`<mark>`), pastillas, bloques de relleno, flechas |
| `--lime-dark` | `#5C8A00` | Lima cuando tiene que ser **texto** sobre blanco |
| `--lilac` | `#C9A9FF` | Acento secundario: formas, subrayados, fondo de cita |
| `--violet` | `#7C3AED` | Lila cuando tiene que ser **texto** sobre blanco |

### Reglas de contraste (no negociables)

- `#B5FF2B` **nunca** como texto sobre blanco (es ilegible). Úsalo como
  fondo con texto `#0A0A0A` encima.
- Sobre bloques `#0A0A0A`, el texto puede ser blanco o lima `#B5FF2B`.
- `#C9A9FF` como fondo lleva texto `#0A0A0A`.
- Máximo 2 colores de acento por slide (lima + uno más). El lima aparece
  en todos los slides; el lila es secundario.

## Composición

- Lienzo 1080×1350 (4:5). Margen interior 96px.
- Arriba: kicker/marca "FUNNELS LABS" a la izquierda, contador `03 / 07`
  a la derecha.
- Abajo: pie con "@funnelslabs" (o el handle que indiquen) y flecha "→"
  en todos menos el último.
- Cuadrícula de fondo sutil (líneas `#E2E2DB` cada 54px, opacidad baja)
  opcional — es el guiño a la `fl-grid-bg` de la web.
- Esquinas redondeadas 28px en tarjetas, 999px en pastillas.
- Alinear a la izquierda. Centrado solo en portada-dato y CTA.
- Sin sombras pesadas, sin degradados, sin emojis, sin stock photos.

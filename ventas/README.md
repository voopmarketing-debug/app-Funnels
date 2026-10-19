# Ventas (interno)

El sistema para conseguir clientes de Funnels Labs sin anuncios. **No es
parte de la plataforma**: la app no lo usa y no se despliega.

| Qué | Dónde |
|---|---|
| Estrategia completa, cuotas, metas y plan de 30 días | [`PLAN.md`](./PLAN.md) |
| El agente vendedor | `.claude/agents/vendedor.md` |
| Skills: prospección, mensajes, seguimiento, reunión, métricas | `.claude/skills/ventas-*/` |
| Guiones de mensajes por canal | `.claude/skills/ventas-mensajes/references/guiones.md` |
| Tracker (leads + toques + métricas) | `scripts/ventas.mjs` |
| Datos (**no se suben al repo**) | `datos/` (local) + Google Drive |

## Cómo se usa (hablándole al agente)

En una sesión de Claude Code en este repo, por ejemplo:

- "Vendedor: arranquemos el día" → baja los datos de Drive, te muestra las
  respuestas, los seguimientos y los nuevos, y te prepara los mensajes.
- "Busca 40 odontólogos en Medellín con WhatsApp visible y cárgalos."
- "Importa este CSV de Hunter de abogados de Bogotá."
- "Me respondió L0012: '¿y cuánto cuesta?'. ¿Qué le digo?"
- "Ya envié los DMs de L0010 a L0030 con IG-A."
- "Prepárame la reunión de mañana con L0007."
- "¿Cómo vamos esta semana?" / "Haz la revisión del viernes."

## Comandos del tracker

```bash
node ventas/scripts/ventas.mjs ayuda
node ventas/scripts/ventas.mjs init
node ventas/scripts/ventas.mjs nuevo negocio="…" segmento=odontologia ciudad=Medellín instagram=@… gancho="…" prioridad=A
node ventas/scripts/ventas.mjs importar export.csv fuente=hunter
node ventas/scripts/ventas.mjs toque L0001 mensaje plantilla=IG-A
node ventas/scripts/ventas.mjs toque L0001 respuesta nota="pregunta precio"
node ventas/scripts/ventas.mjs hoy
node ventas/scripts/ventas.mjs metricas semana meta=60
```

Etapas: `nuevo → contactado → respondio → interesado → reunion → prueba →
cliente`, y los cierres `perdido`, `sin_respuesta` (se reactiva a los 90
días) y `no_contactar`.

## Dónde viven los datos

Este repositorio es **público** y los leads son personas reales, así que
`ventas/datos/` está en `.gitignore`. Los datos se guardan en Google Drive,
en la carpeta **"Funnels Labs — Ventas (interno)"**, como dos hojas:
`ventas-leads` y `ventas-actividad`. El agente las baja al empezar y las
sube al terminar (el paso a paso está en la skill `ventas-metricas`).
Puedes abrirlas desde el celular para ver cómo vamos o corregir algo, pero
no mientras el agente está trabajando.

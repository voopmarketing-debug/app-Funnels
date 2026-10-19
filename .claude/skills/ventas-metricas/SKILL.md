---
name: ventas-metricas
description: Lleva el tracker interno de prospección de Funnels Labs (leads + cada toque) y saca las métricas, como cuántos contactamos, respondieron, agendaron, probaron y compraron, por canal, segmento y plantilla; también hace la revisión semanal y sincroniza los datos con Google Drive. Úsala para registrar actividad, "¿cómo vamos?", "métricas de la semana", el reporte del viernes, o al empezar y terminar una sesión de ventas.
---

# Métricas y tracker

Todo pasa por `node ventas/scripts/ventas.mjs` (sin dependencias; `ayuda`
lista los comandos). Hay dos archivos en `ventas/datos/`:

- `leads.csv`: un lead por fila, con su etapa, número de toques, último
  toque y próximo toque.
- `actividad.csv`: un registro por cada toque (fecha, lead, canal, tipo,
  plantilla y nota). **Las métricas salen de aquí**, así que cada envío y
  cada respuesta se registra en el momento.

`ventas/datos/` **está ignorado por git**: el repo es público y estos son
datos de personas reales. Nunca copiarlos a otra carpeta del repo, ni a un
commit, ni a un issue o PR.

## Al empezar una sesión: bajar los datos de Drive

El contenedor es temporal, así que los datos viven en Google Drive, en la
carpeta **"Funnels Labs — Ventas (interno)"** (id de carpeta
`19jy4E4aDAQwI2igc1MzIFaTBsJ1oOIbB`), como dos hojas de cálculo:
`ventas-leads` y `ventas-actividad`. Sus ids cambian cada vez que se suben
(ver abajo), así que siempre se buscan por nombre dentro de la carpeta.

1. `mcp__Google_Drive__search_files` con
   `parentId = '19jy4E4aDAQwI2igc1MzIFaTBsJ1oOIbB'` (el conector no acepta
   `in parents` ni `trashed`; los archivos de la papelera no aparecen) y
   tomar los ids de `ventas-leads` y `ventas-actividad`.
2. `mcp__Google_Drive__download_file_content` con
   `exportMimeType: "text/csv"` → decodificar el base64 → escribir
   `ventas/datos/leads.csv` y `ventas/datos/actividad.csv`.
3. Si no existen todavía: `node ventas/scripts/ventas.mjs init`.

## Al terminar una sesión (o después de cambios grandes): subirlos

El conector de Drive no puede sobrescribir el contenido de un archivo, así
que se reemplaza:

1. `mcp__Google_Drive__create_file` con `title: "ventas-leads"`,
   `contentMimeType: "text/csv"`, `textContent:` el CSV completo y
   `parentId:` el id de la carpeta. Se convierte en una hoja de Google.
2. **Solo si se creó bien**, mandar la versión anterior a la papelera
   (`mcp__Google_Drive__trash_file` con el id viejo; queda 30 días en la
   papelera por si acaso).
3. Lo mismo con `ventas-actividad`.

Si la persona editó la hoja a mano en Drive, esos cambios se conservan
porque siempre se baja antes de trabajar. Lo que no se puede es editar en
Drive *mientras* el agente trabaja: se perdería al subir.

## Registrar

```bash
node ventas/scripts/ventas.mjs toque <id> <tipo> [canal=…] [plantilla=…] [nota=…] [fecha=AAAA-MM-DD] [proximo=AAAA-MM-DD]
```

| Tipo | Cuándo | Efecto |
|---|---|---|
| `calentar` | Like, comentario o respuesta a una historia antes del DM | Solo se registra |
| `conexion` / `conexion_aceptada` | LinkedIn | `conexion_aceptada` pone el próximo toque para hoy |
| `mensaje` | Primer mensaje | Etapa `contactado` y empieza la cadencia (+3 días) |
| `seguimiento` | Toques 2 a 5 | +4, +7 y +14 días; después del 5.º pasa a `sin_respuesta` (+90 días) |
| `respuesta` / `interesado` | Contestó | Sale de la cadencia y hay que responderle mañana como tarde |
| `reunion_agendada` / `reunion_hecha` / `no_asistio` | Reunión | Etapa `reunion` (`no_asistio` lo devuelve a `interesado`) |
| `prueba` / `cliente` | Inició la prueba o pagó | Etapa `prueba` o `cliente` |
| `perdido` / `no_contactar` / `rebote` | Cierres | `no_contactar` es para siempre |

El script nunca hace retroceder una etapa por error. Para corregir algo a
mano: `editar <id> etapa=… proximo_toque=…`.

## Ver cómo vamos

```bash
node ventas/scripts/ventas.mjs hoy              # agenda del día + mensajes enviados hoy
node ventas/scripts/ventas.mjs metricas semana meta=60
node ventas/scripts/ventas.mjs metricas desde=2026-10-01 hasta=2026-10-31 guardar
```

`metricas` muestra el embudo de los leads **contactados por primera vez en
el periodo** (contactados → respondieron → interesados → reunión → reunión
hecha → prueba → cliente) con la conversión de cada paso, y después lo
mismo por canal, segmento y plantilla, el pipeline actual y el volumen
diario frente a la meta. `guardar` deja el reporte en
`ventas/datos/reportes/`.

## Revisión semanal (viernes, 20 min)

Con `metricas semana` y `metricas mes`, responder por escrito:

1. **Volumen:** ¿cumplimos la cuota diaria (60 toques)? Si no, ese es el
   problema número 1 y no los mensajes.
2. **Respuesta por canal y plantilla:** ¿qué está por debajo del 5% con 50
   o más envíos? → reemplazarlo. ¿Qué está arriba del 15%? → darle más
   cuota.
3. **Respuesta → reunión:** si está por debajo del 25%, el problema está en
   cómo respondemos (skill `ventas-seguimiento`).
4. **Reunión → prueba:** si está por debajo del 40%, revisar la demo y el
   cierre (skill `ventas-reunion`).
5. **Motivos de pérdida** que se repiten (columna `notas`).
6. **Una sola decisión** para la semana que viene (ej. "más cuota a
   estética por IG, quitar EM-1B, probar IG-C2").

Entregar la revisión como un resumen corto con la tabla del embudo y la
decisión. Comparar siempre contra las metas de `ventas/PLAN.md` §7 y, a
partir de la semana 3, contra nuestro propio promedio.

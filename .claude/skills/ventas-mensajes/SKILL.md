---
name: ventas-mensajes
description: Redacta los mensajes de prospección de Funnels Labs (DM de Instagram, Messenger de Facebook, LinkedIn y correo en frío), personalizados con el gancho de cada lead y con su código de plantilla para medirlos. Úsala cuando haya que escribir el primer mensaje, un seguimiento, una variante A/B o una tanda de mensajes del día, o preparar borradores en Gmail.
---

# Escribir mensajes que se respondan

Plan completo: `ventas/PLAN.md`. Guiones base por canal: `references/guiones.md`.
**Para clínicas (odontología, estética, medicina) en Bogotá y Medellín, usar
el flujo completo de `references/flujo-clinicas.md`** (códigos `CL-…`):
primer mensaje con 5 variantes, seguimientos, respuestas, reunión, prueba,
cliente, correo y reactivación.

## Antes de escribir

1. Saca el lead del tracker (`node ventas/scripts/ventas.mjs ver <id>` o
   `hoy`). Sin un `gancho` real no se escribe: si falta, primero
   investígalo (skill `ventas-prospeccion`).
2. Escoge la plantilla según el canal, el número de toque y si hay Prueba
   del WhatsApp. Usa la que va ganando en `metricas`, salvo que estemos en
   un A/B.
3. Personaliza **la primera línea** con el gancho. El resto puede ser casi
   igual al guion.

## Reglas de redacción

- Corto: DM de 3 a 4 líneas, LinkedIn de 3 a 5, correo de 50 a 90
  palabras. Si no se lee en el celular sin hacer scroll, es largo.
- Español neutro latino, tuteando, como lo escribiría el dueño de Funnels
  Labs a mano. Nada de "Estimado/a", "solución innovadora", "potenciar",
  "llevar al siguiente nivel" ni emojis en exceso (máximo 1).
- **Una sola pregunta** al final, fácil de responder (sí/no o un dato).
- **Primer mensaje sin link ni precio.** Los links van desde el seguimiento
  2 o cuando el prospecto pregunta.
- Hablar de **su** problema (consultas sin responder, citas que se pierden,
  recepción saturada) y no de nuestras funciones.
- **Nunca inventar:** ni clientes, ni cifras, ni casos, ni "trabajamos con
  X clínicas". Lo único que se puede afirmar es lo que hace el producto
  (ver `src/lib/landingContent.ts`) y lo que observamos en *su* WhatsApp o
  perfil.
- No prometer lo que el plan no incluye. Datos de la oferta: Starter
  $97 USD/mes (COP 390.000) con 7 días gratis; Pro $297; Consultoría desde
  $597 + implementación. Nunca dar consejos médicos ni legales.
- Si el prospecto escribe de "usted", se le responde de "usted".

## Entregar los mensajes

- **Redes (IG, FB, LinkedIn):** entregar el texto listo para copiar y pegar,
  agrupado por lead con su id, canal, link al perfil y código de plantilla.
  **El agente no envía DMs**: los envía la persona a mano (los bots hacen
  que bloqueen la cuenta).
- **Correo:** crear **borradores en Gmail** con el conector
  (`mcp__Gmail__create_draft`): uno por lead, en texto simple. Nunca
  `send_message` sin un "envíalo" explícito de la persona para ese correo o
  esa tanda. Los seguimientos van como respuesta en el mismo hilo.
- Al final de la tanda, dar el comando para registrar cada envío **una vez
  que la persona confirme que salió**:
  `node ventas/scripts/ventas.mjs toque L0007 mensaje plantilla=IG-A canal=instagram`
  (`seguimiento` para los toques 2 a 5).

## A/B

- Cambiar **una sola variable** por prueba (gancho, pregunta o CTA) y darle
  un código nuevo (`IG-B2`).
- Repartir los envíos a partes iguales y no decidir antes de 40–50 envíos
  por versión.
- Guardar las variantes ganadoras en `references/guiones.md`, con la fecha
  y la tasa de respuesta.

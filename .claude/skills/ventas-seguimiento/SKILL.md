---
name: ventas-seguimiento
description: Responde a los prospectos de Funnels Labs que contestaron, maneja objeciones (precio, "ya tengo a alguien", "no confío en la IA", "mándame info", "no tengo tiempo") y los lleva a agendar una reunión o empezar la prueba gratis; también lleva la cadencia de seguimientos. Úsala cuando alguien respondió un DM o un correo, cuando hay que decidir qué contestar o cuando toca hacer los seguimientos del día.
---

# Seguimiento y respuestas: convertir la respuesta en reunión

Cadencia y reglas: `ventas/PLAN.md` §6. Guiones de seguimiento:
`../ventas-mensajes/references/guiones.md`.

## Prioridad absoluta: contestar rápido

Cuando alguien responde, se le contesta **antes que cualquier otra cosa**,
idealmente en menos de 2 horas. Lo primero es registrarlo:

```bash
node ventas/scripts/ventas.mjs toque L0012 respuesta nota="pregunta cuánto cuesta"
```

## Cómo responder

1. **Clasificar la respuesta** y registrar el tipo que corresponda:
   - Curiosidad o pregunta → `respuesta`
   - "Me interesa", "¿cómo funciona?" o pide precio → `interesado`
   - "No", "no me interesa" → `perdido` (con `nota=` del motivo)
   - "No me escribas" → `no_contactar` (nunca más se le escribe)
   - Correo rebotado → `rebote` (y se prueba otro canal)
2. **Contestar en 2 o 3 líneas** lo que preguntó **y** avanzar un paso con
   una pregunta. No mandar un testamento.
3. **Siempre proponer el siguiente paso concreto:** la reunión con el link
   de agenda u ofrecer 2 horarios ("¿te queda mejor mañana a las 10 o el
   jueves a las 4?"). Si prefiere hacerlo solo, el link de la prueba.
4. Si da su WhatsApp, pasar la conversación allá (es más rápido).

### Escalera para quien responde

| Responde… | Siguiente paso |
|---|---|
| "¿Qué es?" / "¿Cómo funciona?" | 2 líneas + video de 40 s + "¿te lo muestro con tu caso en 15 min?" |
| "¿Cuánto cuesta?" | Precio honesto + la prueba gratis + reunión (abajo) |
| "Sí, me interesa" | Agenda directa: link o 2 horarios |
| "Ahora no" | "¿Te escribo en {mes}?" → `toque … respuesta proximo=AAAA-MM-DD` |
| "Ya tengo a alguien que responde" | Objeción 2 |

## Objeciones

Responder **sin discutir**: primero validar, después una pregunta.

1. **"¿Cuánto cuesta?" o "Está caro"**
   > El plan Starter son $97 USD al mes (unos COP 390.000) y los primeros 7
   > días son gratis, así que lo pruebas con tus pacientes antes de pagar.
   > Para saber si te conviene, ¿cuánto vale un paciente nuevo para ustedes?
   > Si con eso se recupera 1 cita al mes que hoy se pierde, normalmente ya
   > se paga solo. ¿Lo vemos en 15 min con tus números?
   (Solo se usa el cálculo con **sus** números, nunca con cifras inventadas.)

2. **"Ya tengo una recepcionista / alguien que contesta"**
   > ¡Genial! Esto no la reemplaza: le quita lo repetitivo (precios,
   > horarios, ubicación) y atiende de noche y los fines de semana. Ella se
   > queda con los chats que necesitan a una persona. ¿Qué pasa hoy con los
   > mensajes que llegan después de las 6?

3. **"No confío en que una IA hable con mis clientes"**
   > Es lógico. Por eso tú ves todos los chats, pausas la IA en el que
   > quieras y respondes tú. Le dices qué no debe contestar y no da
   > consejos médicos ni legales: informa, agenda y toma datos. Y usa la
   > conexión oficial de WhatsApp de Meta. ¿Te muestro cómo se pausa?

4. **"Mándame información"**
   > ¡Claro! Te dejo la página: https://agente.funnelslabs.app/oferta. Para
   > no mandarte algo genérico: ¿lo que más te interesa es que conteste de
   > noche, que agende o tener todo ordenado en un CRM?
   (Y seguimiento en 2 días: `proximo=` con la fecha.)

5. **"No tengo tiempo" o "Estoy muy ocupado"**
   > Justo por eso existe 😅 Son 15 minutos y lo dejamos funcionando
   > nosotros (la conexión del número la hacemos contigo en una llamada).
   > ¿Te va mejor temprano o al final del día?

6. **"¿Y si mi número se bloquea?" / "Ya uso WhatsApp Business"**
   > Usamos la API oficial de Meta, que es la que usan las empresas grandes,
   > y te acompañamos a conectarla. ¿Hoy usan la app de WhatsApp Business en
   > un celular?
   (Los detalles técnicos se ven en la llamada; no prometer migraciones
   sin revisarlas antes.)

7. **"Ya lo intenté con un chatbot y fue malo"**
   > Te entiendo, los bots de menú con botones frustran a la gente. Este
   > conversa normal, con lo que tú le enseñas, y recuerda cada
   > conversación. ¿Quieres que te escriba como si fuera un paciente y lo
   > juzgas tú?

8. **"Tengo que hablarlo con mi socio"**
   > Perfecto. ¿Hacemos los 15 minutos con los dos así lo ven juntos?

## Seguimientos del día

1. `node ventas/scripts/ventas.mjs hoy` lista los que tocan, empezando por
   las etapas más avanzadas (prueba, reunión, interesado) y después los
   `contactado` según la cadencia.
2. Para cada uno, usar el seguimiento que corresponde al número de `toques`
   (S1 a S4, EM-2 a EM-5, LI-S1 y LI-S2). Desde el toque 3 se puede
   **cambiar de canal** (IG → correo → LinkedIn), y conviene hacerlo si
   tenemos el dato.
3. Registrar cada uno: `toque <id> seguimiento plantilla=S2 canal=email`.
4. Los que tienen `etapa=prueba`: escribirles en el día 2 ("¿pudiste
   cargar tus precios?"), en el día 5 (resolver dudas y agendar la
   conexión si falta) y en el día 6 (antes del cobro: que sepan qué
   cambia). Cuando paguen: `toque <id> cliente`.
5. Si en la reunión se dijo "lo pienso": seguimiento en 2 días con un
   resumen de lo que hablaron y una pregunta concreta.

Agendar o mover reuniones: si el conector de Google Calendar está
disponible, el agente puede mirar huecos libres (`suggest_time`) y crear el
evento con el link de la videollamada, **siempre con el OK de la persona**
antes de invitar al prospecto.

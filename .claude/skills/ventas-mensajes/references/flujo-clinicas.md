# Flujo de mensajes: clínicas en Bogotá y Medellín

Para odontología, estética y medicina privada. Cada mensaje tiene un
**código** (`CL-…`) que se registra en el tracker para saber cuál funciona:

```bash
node ventas/scripts/ventas.mjs toque L0007 mensaje plantilla=CL-1A canal=instagram
```

**Variables:** `{nombre}` (doctor/a o contacto), `{clinica}`, `{barrio}`
(El Poblado, Laureles, Envigado / Usaquén, Chapinero, Cedritos, Chicó…),
`{servicio}` (limpieza, diseño de sonrisa, botox, valoración…), `{dia}`,
`{hora}`.

**Reglas para todo el flujo**

- Primer mensaje: máximo 4 líneas, **sin link y sin precio**, una sola
  pregunta.
- **Tú o usted:** a la cuenta de la clínica, de "tú". Si le escribes al
  doctor o doctora por su nombre, o si te responden de "usted", pásate a
  "usted" (en Bogotá y Medellín es lo normal con profesionales de la salud).
- Nunca inventar clientes, cifras ni resultados.
- Los DMs los envías tú a mano y los correos van como borrador en Gmail.
- **No se vende en frío por WhatsApp ni por difusiones.** WhatsApp solo
  para la Prueba del WhatsApp (como paciente) o cuando el prospecto ya
  respondió.

---

## Mapa del flujo

```
Día -1  Prueba del WhatsApp (solo prioridad A)   ─┐
Día 0   Calentar: like + comentario               │
Día 1   1. PRIMER MENSAJE  (variante A, B, C, D o E)
Día 4   2. Seguimiento 1   (valor: video/captura)
Día 8   3. Seguimiento 2   (otro ángulo o cambio de canal → correo)
Día 15  4. Seguimiento 3   (invitación a reunión con link)
Día 29  5. Cierre          ("no te escribo más")
Día 119    Reactivación     (algo nuevo)

  ¿Respondió? → sale de la cadencia → RESPUESTAS (sección 3)
                → REUNIÓN (sección 4) → PRUEBA (sección 5) → CLIENTE (sección 6)
```

---

## 0. Calentar (día 0, Instagram o Facebook)

Seguir la cuenta, dar like a 2 publicaciones recientes y dejar **un**
comentario real. Nada de "¡qué bien!" ni de hablar de nosotros:

- **[CL-0A]** "Qué buen resultado 👏 ¿Cuánto tiempo toma un tratamiento así?"
- **[CL-0B]** (en una promo) "Buenísima la promo. ¿Aplica también para {otro servicio}?"
- **[CL-0C]** (en una publicación del equipo) "Se nota el buen ambiente del equipo 🙌"

Registrar: `toque <id> calentar canal=instagram`

---

## 1. Primer mensaje (día 1): 5 variantes para probar

Repartir para que la prueba sea justa: **una variante por tanda** de 40–50
envíos, o alternarlas por lead (L0001 → A, L0002 → B, L0003 → C…). Ver la
sección 9.

### [CL-1A] Prueba del WhatsApp: no respondieron o tardaron
*Solo si hicimos la prueba. Es la que más debería responder.*
> Hola {nombre}! Te confieso algo: el {dia} en la noche les escribí al
> WhatsApp preguntando por {servicio}, para ver cómo responden, y la
> respuesta llegó {al otro día a las 10 / todavía no ha llegado}.
> No es crítica, pasa en casi todas las clínicas que reviso 🙂
> ¿Te interesaría ver cómo se vería si eso se contestara solo, a cualquier hora?

### [CL-1A+] Prueba del WhatsApp: respondieron rápido
> Hola {nombre}! El {dia} les escribí al WhatsApp preguntando por {servicio}
> (te confieso que fue para ver cómo atienden) y me respondieron en {tiempo}.
> Muy bien, pocas clínicas lo logran 👏
> Pregunta honesta: ¿eso se mantiene cuando la recepción está llena o fuera de horario?

### [CL-1B] Noche y fin de semana
> Hola {nombre}! Vi {gancho} 👏
> Una pregunta rápida: cuando les escriben al WhatsApp de noche o el
> domingo preguntando precios, ¿alguien alcanza a responder o queda para
> el lunes?

### [CL-1C] Comentarios preguntando precio (Instagram)
*Solo si de verdad hay comentarios sin respuesta en sus publicaciones.*
> Hola {nombre}! Vi la publicación de {tema} y hay varias personas
> preguntando el precio en los comentarios. ¿Esas consultas les llegan
> después al WhatsApp o se quedan ahí?

### [CL-1D] Volumen (para clínicas grandes o con varias sedes)
> Hola {nombre}! Una pregunta de alguien que trabaja con clínicas en
> {ciudad}: más o menos, ¿cuántos mensajes de WhatsApp les llegan al día
> preguntando precios y citas? Te pregunto porque es donde más pacientes
> veo que se pierden.

### [CL-1E] Respuesta a una historia
*Se escribe como respuesta a una historia que acaban de subir.*
> (comentario real sobre la historia) 🙌
> Por cierto, ¿quién les maneja el WhatsApp? Con promos así me imagino que
> les llueven mensajes 😅

### Versión para Facebook / Messenger
Igual que la variante elegida, agregando al principio de dónde lo viste:
> "Hola {nombre}, vi la página de {clinica} en Facebook…"
Mismo código, con `canal=facebook`.

### Versión LinkedIn (para el director médico o el dueño)
- Solicitud de conexión **sin nota**.
- Cuando acepte, **[CL-1L]**:
> Gracias por conectar, Dr./Dra. {apellido}. Una pregunta, ya que trabajo
> con clínicas en {ciudad}: en {clinica}, ¿las consultas que llegan por
> WhatsApp las responde la recepción o alguien dedicado solo a eso? Es
> donde más pacientes veo que se pierden.

---

## 2. Seguimientos (si no respondió): 2 variantes por paso

### Seguimiento 1, día 4: dar valor
**[CL-S1A] Video**
> {nombre}, para que te hagas una idea, así responde el asistente cuando
> alguien pregunta "¿cuánto cuesta {servicio}?" a las 11 de la noche 👇
> [video de 40 s]
> ¿Algo así les serviría?

**[CL-S1B] La recepción**
> {nombre}, algo que siempre me dicen: "es que la recepcionista no da
> abasto". El asistente no la reemplaza: contesta lo repetitivo (precios,
> horarios, ubicación) y deja la cita pedida. Ella se queda con lo que
> necesita a una persona.
> ¿Les pasa eso en {clinica}?

### Seguimiento 2, día 8: otro ángulo (mejor si se cambia de canal)
**[CL-S2A] Por correo** (si tenemos el correo; ver la sección 7)

**[CL-S2B] Control**
> {nombre}, una duda que tienen muchos doctores: "¿y si la IA dice algo
> que no debe?". Ustedes ven todos los chats, la pausan en el que quieran y
> le dicen qué no responder. No da diagnósticos: informa, agenda y toma datos.
> ¿Eso les daría tranquilidad?

### Seguimiento 3, día 15: invitación directa
**[CL-S3A] Reunión**
> {nombre}, si quieres te lo muestro con el caso de {clinica} en 15
> minutos por videollamada, sin compromiso. Escoges la hora aquí:
> https://agenda.funnelslabs.app/agenda

**[CL-S3B] Prueba**
> {nombre}, por si prefieres probarlo sin llamadas: hay 7 días gratis y te
> ayudamos a conectar el número. https://agente.funnelslabs.app/register
> ¿Te lo dejo listo para que lo veas esta semana?

### Cierre, día 29
**[CL-S4A]**
> {nombre}, no te escribo más sobre esto para no molestar. Si algún día el
> WhatsApp se vuelve un dolor de cabeza, aquí estoy. ¡Éxitos con {clinica}! 🙌

**[CL-S4B]**
> {nombre}, ¿cierro el tema? Si no es prioridad ahora, lo entiendo
> perfecto, solo dime "ahora no" y te escribo en unos meses.

---

## 3. Cuando responden: qué contestar en cada caso

Contestar **el mismo día** (ideal: en menos de 2 horas), en 2 o 3 líneas,
siempre con un siguiente paso. Registrar `toque <id> respuesta` o
`interesado`.

| Si responden… | Código | Respuesta |
|---|---|---|
| "¿Qué es?" / "¿Cómo funciona?" | CL-R1 | "Es un asistente que contesta el WhatsApp de la clínica con lo que ustedes le enseñan: precios, horarios, ubicación, y deja la cita pedida. Ustedes ven todo y entran cuando quieran. ¿Te lo muestro con tu caso en 15 min? ¿Mañana a las 10 o el jueves a las 4?" |
| "¿Cuánto cuesta?" | CL-R2 | "El plan inicial son $97 USD al mes (unos COP 390.000) y los primeros 7 días son gratis. Para saber si les conviene: ¿cuánto vale un paciente nuevo para ustedes? Si se recupera 1 cita al mes que hoy se pierde, normalmente ya se paga solo. ¿Lo vemos en 15 min con sus números?" |
| "Sí, me interesa" | CL-R3 | "¡Genial! ¿Te queda mejor {opción 1} o {opción 2}? Son 15 minutos por videollamada. O si prefieres escoger tú: https://agenda.funnelslabs.app/agenda" |
| "Mándame información" | CL-R4 | "¡Claro! Aquí está: https://agente.funnelslabs.app/oferta. Para no mandarte algo genérico, ¿qué les interesa más: que conteste de noche, que agende solo o tener todo ordenado?" (y seguimiento en 2 días) |
| "Eso lo maneja {otra persona}" | CL-R5 | "¡Gracias! ¿Me compartes su contacto o le reenvías esto? Así no le escribo de la nada." (a la persona nueva se le escribe mencionando quién la recomendó) |
| "Ya tenemos recepcionista / alguien" | CL-R6 | "¡Qué bien! Esto no la reemplaza: le quita lo repetitivo y atiende de noche y en fin de semana. ¿Qué pasa hoy con los mensajes que llegan después de las 6?" |
| "No confío en la IA con pacientes" | CL-R7 | "Totalmente válido. Por eso ustedes ven todos los chats, la pausan en el que quieran y no da diagnósticos. ¿Quieres que te escriba como paciente y lo juzgas tú?" |
| "Ya probamos un chatbot y fue malo" | CL-R8 | "Te entiendo, los bots de menú con botones frustran. Este conversa normal y recuerda cada conversación. ¿Lo pruebas 2 minutos escribiéndole como paciente?" |
| "Ahora no / estamos muy ocupados" | CL-R9 | "Justo por eso existe 😅 ¿Te escribo en {mes}?" → `toque <id> respuesta proximo=AAAA-MM-DD` |
| "No me interesa" | CL-R10 | "Perfecto, gracias por responder. ¡Éxitos!" → `toque <id> perdido nota="motivo"` |
| "No me escribas más" | — | "Entendido, disculpa la molestia." → `toque <id> no_contactar` |

**Si la respuesta es la de la recepcionista o la community manager**
(pasa mucho en clínicas): trátala como aliada. "¿Te toca a ti responder
todo el WhatsApp? Esto es justo para quitarte lo repetitivo. ¿Con quién
lo puedo hablar para mostrárselo?"

---

## 4. Reunión agendada

Registrar `toque <id> reunion_agendada proximo=<fecha>`.

**[CL-M1] Confirmación (apenas agenda)**
> ¡Listo, {nombre}! Quedamos el {dia} a las {hora}. Te muestro el
> asistente con el caso de {clinica}. Si puedes, ten a mano tus 3 o 4
> preguntas más frecuentes de pacientes y lo armamos en vivo 🙌

**[CL-M2] Recordatorio un día antes**
> Hola {nombre}, te recuerdo que mañana a las {hora} tenemos los 15
> minutos. ¿Seguimos en pie?

**[CL-M3] Una hora antes**
> {nombre}, en una hora nos vemos. Aquí está el link: {link videollamada}

**[CL-M4] Si no se conectó (5 min después)**
> {nombre}, te estoy esperando en la llamada. Si se te complicó, no pasa
> nada: ¿la movemos para {opción 1} o {opción 2}?
→ `toque <id> no_asistio`

**[CL-M5] Después de la reunión: resumen (el mismo día)**
> Gracias por el tiempo, {nombre}. Resumen: hoy {lo que contó, en sus
> palabras}. Lo que vimos: {2 cosas}. Siguiente paso: {prueba / llamada de
> conexión el día X}. ¿Te parece?

**[CL-M6] "Lo voy a pensar" (2 días después)**
> Hola {nombre}, ¿pudiste pensarlo? Si te queda alguna duda (precio,
> conexión, cómo responde), dime cuál y te la resuelvo en un mensaje.

---

## 5. Prueba gratis (7 días)

Registrar `toque <id> prueba`.

| Día | Código | Mensaje |
|---|---|---|
| 0 | CL-P0 | "¡Bienvenida/o, {nombre}! Agendemos la llamada de 30 a 45 min para conectar el número oficial: ¿{opción 1} o {opción 2}?" |
| 2 | CL-P2 | "¿Cómo vas? ¿Pudiste cargar precios y horarios? Si quieres, me mandas la lista y te ayudo a dejarlo listo." |
| 4 | CL-P4 | "Ya que está respondiendo: ¿viste algún chat que te gustó o algo que quieras ajustar?" |
| 6 | CL-P6 | "Mañana termina la prueba. Desde el día 8 se cobra el plan de $97 USD/mes y cancelas cuando quieras. ¿Seguimos? ¿Alguna duda antes?" |

---

## 6. Cliente

Registrar `toque <id> cliente`.

- **[CL-C1] Bienvenida:** "¡Gracias por confiar en nosotros, {nombre}! Cualquier cosa, me escribes por aquí."
- **[CL-C2] Día 30, pedir referido:** "¿Conoces a otro doctor o clínica que viva pegado al WhatsApp? Si me presentas, le ayudo a configurarlo."
- **[CL-C3] Testimonio (solo si está contento):** "¿Me dejarías contar tu experiencia en una frase, con tu nombre o sin él?" (Solo se publica con su permiso explícito.)

---

## 7. Secuencia por correo (clínicas)

Texto simple, sin imágenes y **sin links en el primero**. Los seguimientos
van en el mismo hilo.

**[CL-E1A] Prueba del WhatsApp.** Asunto: `pregunta sobre {clinica}`
> Hola {nombre},
>
> El {dia} a las {hora} escribí al WhatsApp de {clinica} preguntando por
> {servicio}, para ver cómo responden, y la respuesta llegó {resultado}.
>
> No es crítica: pasa en casi todas las clínicas que reviso en {ciudad},
> porque la recepción no da abasto. Trabajo con un asistente de IA que
> contesta ese WhatsApp a cualquier hora, da precios y deja la cita pedida,
> y ustedes entran cuando quieren.
>
> ¿Te interesaría ver cómo quedaría con tu clínica?
>
> {firma}
> P. D.: Si no te interesa, dímelo y no te escribo más.

**[CL-E1B] Noche y fin de semana.** Asunto: `pacientes por whatsapp`
> Hola {nombre},
>
> Vi {gancho}. Una pregunta rápida: cuando les escriben al WhatsApp de
> noche o el fin de semana preguntando precios, ¿alguien alcanza a
> responder o queda para el día siguiente?
>
> Ayudo a clínicas en {ciudad} a que esas consultas se respondan solas y
> terminen en cita, sin sumar gente a la recepción. Si te sirve, te cuento
> cómo en 15 minutos.
>
> {firma}
> P. D.: Si no es para ti, me dices y no vuelvo a escribir.

**[CL-E2] Día 4 (mismo hilo)**
> Hola {nombre}, te dejo un video de 40 segundos de cómo responde el
> asistente a "¿cuánto cuesta {servicio}?" a las 11 de la noche:
> {link video}. ¿Les serviría algo así?

**[CL-E3] Día 8 (mismo hilo)**
> {nombre}, algo que preocupa mucho a los doctores: el asistente no da
> diagnósticos y no actúa a sus espaldas. Contesta lo repetitivo y agenda,
> ustedes ven todos los chats y lo pausan cuando quieran. Usa la conexión
> oficial de WhatsApp (API de Meta).
> Si quieres verlo con tu caso: https://agenda.funnelslabs.app/agenda

**[CL-E4] Día 15 (mismo hilo)**
> {nombre}, ¿lo vemos 15 minutos esta semana? Si prefieres probarlo solo,
> hay 7 días gratis: https://agente.funnelslabs.app/register

**[CL-E5] Día 29.** Asunto: `¿cierro el tema?`
> Hola {nombre}, como no he tenido respuesta, asumo que no es prioridad
> ahora y no te escribo más sobre esto. Si más adelante quieres que el
> WhatsApp de {clinica} conteste y agende solo, responde este correo y lo
> retomamos. Éxitos,
> {firma}

**Firma:** {tu nombre} · Funnels Labs · Asistentes de IA para el WhatsApp de clínicas

---

## 8. Reactivación (día 119, a los `sin_respuesta`)

**[CL-X1]**
> Hola {nombre}, hace unos meses te escribí sobre el WhatsApp de
> {clinica}. Desde entonces agregamos {novedad real del producto}. ¿Vale
> la pena que te lo muestre ahora?

(Solo con una novedad **real**. Si no hay ninguna, no se reactiva.)

---

## 9. Cómo probar las variantes (A/B)

1. **Semana 1:** primer mensaje CL-1B frente a CL-1D en los leads sin
   prueba, y CL-1A en los que sí la tienen.
2. **Semana 2:** la ganadora contra CL-1C o CL-1E. Los seguimientos
   S1A frente a S1B.
3. Mínimo 40–50 envíos por variante antes de decidir.
4. **Bogotá y Medellín se miden por separado** (`metricas` muestra la
   tabla por ciudad): puede ganar una variante distinta en cada ciudad.
5. Cada viernes: la variante con menos del 5% de respuestas después de 50
   envíos se reemplaza.

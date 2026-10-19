---
name: ventas-reunion
description: Prepara y guía la reunión de ventas de 15 a 20 minutos de Funnels Labs (diagnóstico + demo + cierre a la prueba gratis o a un plan), y hace el resumen y el seguimiento después. Úsala antes de una llamada agendada con un prospecto, para practicar el guion o para escribir el seguimiento posterior a la reunión.
---

# Reunión de ventas (15–20 min)

Objetivo: que salga con **la prueba de 7 días iniciada** (o con el plan
Pro/Consultoría acordado) y con la **llamada de conexión del número
agendada**.

## Antes (5 min de preparación)

`node ventas/scripts/ventas.mjs ver <id>` y una ficha de 5 líneas:

- Negocio, segmento, ciudad, quién viene a la llamada y si decide.
- Su gancho / la Prueba del WhatsApp (el dato más fuerte que tenemos).
- Lo que dijo en sus respuestas (dolor y objeciones).
- El plan probable: Starter (1 línea, hasta 400 clientes atendidos al
  mes), Pro (varias sedes, hasta 3 líneas, volumen alto o anuncios) o
  Consultoría (quiere que lo hagamos todo).
- La demo preparada con un ejemplo de su segmento (sus precios, si los
  publicó).

## Guion

**1. Abrir (1 min)**
> Gracias por el espacio, {nombre}. La idea es: te hago unas preguntas
> sobre cómo manejan hoy el WhatsApp, te muestro el asistente con tu caso y
> al final vemos si tiene sentido para ti. ¿Te parece?

**2. Diagnóstico (5–7 min): que hable el prospecto**
- ¿Cuántos mensajes les llegan al día por WhatsApp, más o menos?
- ¿Quién los responde? ¿Qué pasa de noche y en fin de semana?
- ¿Cuáles son las preguntas que más se repiten?
- ¿Qué porcentaje de esas conversaciones termina en cita?
- ¿Cuánto vale un paciente o cliente nuevo para ustedes?
- Si esto funciona perfecto, ¿qué cambiaría en tu día?

Anotar sus palabras exactas: se usan en el cierre y en el resumen.

**3. Demo con su caso (5 min)**
- Un chat en vivo con su pregunta más repetida → el asistente responde y
  agenda.
- El CRM por etapas: "¿ves a quién te falta responder hoy?".
- Pausar la IA y entrar a mano: esto responde al "no confío".
- Solo lo que le importa según el diagnóstico (difusiones, web, redes). No
  mostrar todo.

**4. Cierre (3–5 min)**
> Por lo que me contaste ({dolor en sus palabras}), creo que el plan
> {Starter/Pro} te sirve. Lo más fácil es que lo pruebes 7 días gratis: te
> registras, le cargas tus precios y horarios, y en una llamada de 30 a 45
> minutos conectamos tu número oficial. ¿Lo hacemos ahora mismo y
> agendamos la conexión para {día}?

- Si dice sí: compartir pantalla o enviarle
  https://agente.funnelslabs.app/register, quedarse mientras se registra y
  agendar la llamada de conexión antes de colgar.
- Pro o Consultoría: acordar los detalles por WhatsApp
  (https://wa.me/message/F2RWC3YUI7EYM1) o agendar una segunda llamada
  con la propuesta.
- Si duda: preguntar qué le falta para decidir y resolver **esa** objeción
  (ver la skill `ventas-seguimiento`). Nunca presionar ni inventar
  urgencia falsa (cupos o descuentos que no existen).

## Después (el mismo día)

1. Registrar el resultado:
   - `toque <id> reunion_hecha nota="..."`, y luego `prueba` o `cliente`
     si corresponde
   - `toque <id> no_asistio`, y reagendar con un mensaje amable ese mismo
     día
   - `toque <id> perdido nota="motivo"`
2. Enviar un resumen por WhatsApp o correo: lo que nos contó, lo que vimos,
   el siguiente paso y la fecha.
3. Si quedó en "lo pienso": seguimiento en 2 días (`proximo=`).
4. Un motivo de pérdida que se repite 3 veces = algo que hay que cambiar en
   el mensaje, la oferta o la demo. Anotarlo en la revisión semanal.

import { TRIAL_DAYS } from "@/lib/plans";

// The words of the offer landing (/oferta). Written the way the owner talks to
// a client: short sentences, concrete moments, nothing invented. No figures,
// reviews or results that the platform cannot back up.

export { AGENDA_CALL_URL } from "@/lib/constants";

export const AUDIENCE_LINE = ["Clínicas", "Odontólogos", "Estéticas", "Abogados", "Contadores", "Empresas de servicios"];

export const PAINS = [
  "Te preguntan el precio y, cuando por fin contestas, ya se fueron con otro.",
  "Escriben de noche o en fin de semana y nadie les responde hasta el lunes.",
  "Contestas las mismas diez preguntas todos los días y se te va la mañana.",
];

export const STEPS = [
  { n: "1", title: "Le cuentas tu negocio", text: "Escribes tus precios, tus horarios y las preguntas que más te hacen. Como si le explicaras todo a alguien nuevo en la recepción." },
  { n: "2", title: "Conectamos tu WhatsApp", text: "Te acompañamos en una llamada de unos 30 a 45 minutos para conectar tu número oficial. No tienes que pelear con Meta." },
  { n: "3", title: "Tú sigues mandando", text: "El asistente contesta y agenda. Tú ves todos los chats y, cuando quieras, lo pausas y respondes tú." },
];

export type Benefit = { title: string; text: string; example: string; image: string; alt: string; width: number; height: number };

export const BENEFITS: Benefit[] = [
  {
    title: "Contesta y agenda por ti",
    text: "Responde precios y horarios, manda fotos y deja la cita pedida. Si quieres meterte a un chat, entras tú.",
    example: "La clínica que contesta a las 10 de la noche.",
    image: "/landing/chat.jpg",
    width: 1800,
    height: 1125,
    alt: "Conversación abierta en el CRM, con el botón para pausar la IA",
  },
  {
    title: "Tu página web, lista en un minuto",
    text: "La IA arma una página con tu estilo y tú la cambias tocando los textos y las fotos, sin saber diseñar. Y agrega un calendario donde la gente reserva sola.",
    example: "Una página para tus tratamientos o servicios.",
    image: "/landing/web.jpg",
    width: 1800,
    height: 1125,
    alt: "Editor de páginas web con la vista previa",
  },
  {
    title: "Vuelve a hablarle a tus clientes",
    text: "Manda una promoción o un aviso a muchos contactos a la vez, con las plantillas que aprueba Meta.",
    example: "Avisar de una campaña de limpieza a todos tus pacientes.",
    image: "/landing/plantillas.jpg",
    width: 1800,
    height: 800,
    alt: "Lista de plantillas de WhatsApp con su estado de aprobación",
  },
  {
    title: "Todo ordenado en un CRM",
    text: "Cada conversación queda guardada y puesta en su etapa: nuevo, interesado, ganado. Ves de un vistazo quién espera respuesta.",
    example: "Saber a quién te falta llamar hoy.",
    image: "/landing/crm.jpg",
    width: 1800,
    height: 1012,
    alt: "Tablero del CRM con las conversaciones por etapas",
  },
  {
    title: "Tus redes en un solo lugar",
    text: "Los mensajes de Instagram y Messenger, los comentarios y las métricas de tus anuncios, sin saltar entre aplicaciones. La IA te dice además qué publicar.",
    example: "Contestar todo desde un mismo sitio.",
    image: "/landing/redes.jpg",
    width: 1800,
    height: 1125,
    alt: "Bandeja de mensajes de Instagram y Messenger",
  },
  {
    title: "Un asistente al que le pides las cosas",
    text: "Le escribes «crea una plantilla de bienvenida» o «muéstrame las métricas de la semana» y lo prepara. Tú apruebas antes de que cambie algo.",
    example: "Menos tiempo peleando con el panel.",
    image: "/landing/asistente.jpg",
    width: 1800,
    height: 1125,
    alt: "El asistente de Funnels abierto dentro del panel",
  },
];

export const SEGMENTS = [
  { title: "Clínicas y odontólogos", text: "Te preguntan el precio de la limpieza mientras tienes a un paciente en la silla. Cuando contestas, ya se fue. El asistente responde al momento y deja la valoración pedida." },
  { title: "Estéticas y spas", text: "Las clientas escriben de noche. El asistente contesta precios, manda fotos y deja la cita agendada." },
  { title: "Abogados", text: "Muchas consultas son las mismas. Filtra quién necesita un abogado de verdad, toma sus datos y agenda la primera cita." },
  { title: "Contadores", text: "En época de declaraciones te escriben cien personas con las mismas dudas. Responde requisitos y plazos y agenda las asesorías." },
  { title: "Empresas de servicios", text: "Cotizaciones y visitas técnicas por WhatsApp. Toma los datos, responde lo básico y agenda la visita." },
];

export const TRUST = [
  { title: "Es la conexión oficial de WhatsApp", text: "Usamos la API oficial de Meta, la misma que usan las empresas grandes." },
  { title: "Tú mandas", text: "Ves todos los chats, pausas la IA en el que quieras y respondes tú." },
  { title: "No da consejos médicos ni legales", text: "Informa, agenda y toma datos. Tú le dices qué no debe responder y puedes enseñarle a pasarte el chat cuando no sepa." },
];

export const STARTER_POINTS = [
  "Un asistente que contesta tu WhatsApp todo el día, con memoria de cada conversación",
  "Hasta 400 clientes atendidos por la IA al mes",
  "CRM por etapas, difusiones y plantillas de WhatsApp",
  "2.000 envíos masivos al mes",
  "Páginas web y agenda de citas creadas con IA",
  "Métricas de tu negocio y diagnóstico de ventas con IA",
  "1 línea de WhatsApp y hasta 3 personas en tu equipo",
  "Soporte por WhatsApp y acompañamiento para conectar tu número",
];

export const FAQ = [
  { q: "¿Cómo funciona la prueba gratis?", a: `Tienes ${TRIAL_DAYS} días con el plan Starter completo. Creas tu cuenta y registras tu tarjeta en Mercado Pago, pero no te cobramos nada hasta que termina la prueba. Si antes no te sirve, cancelas y listo.` },
  { q: "¿De verdad hay que hacer una llamada?", a: "Te acompañamos en una llamada de 30 a 45 minutos para conectar tu número a la API oficial de Meta. Es lo único un poco técnico y lo hacemos juntos." },
  { q: "¿Pierdo el control de lo que dice?", a: "No. Ves todos los chats, pausas la IA en el que quieras y respondes tú. El asistente nunca actúa a tus espaldas." },
  { q: "¿Puede dar consejos médicos o legales?", a: "No. Está hecho para informar, agendar y tomar datos. Tú le dices qué no debe responder y puedes enseñarle a pasarte el chat cuando no sepa algo." },
  { q: "¿Cuántos clientes puedo atender?", a: "El plan Starter atiende hasta 400 clientes distintos al mes, y a cada uno le responde todas las veces que haga falta. Tu CRM guarda tus contactos sin que tengas que contarlos (el uso justo es de 20.000 en Starter). Si te quedas corto, agregas un paquete desde tu panel." },
  { q: "¿Cuántos mensajes masivos puedo enviar?", a: "Starter incluye 2.000 envíos al mes y Pro 10.000, por línea de WhatsApp. Se renuevan el día 1 de cada mes y se mandan con plantillas que aprueba Meta." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Sigues con acceso hasta el final del periodo que ya pagaste, sin penalización." },
  { q: "¿Sirve para mi tipo de negocio?", a: "Si vives de citas y consultas (clínicas, odontólogos, estéticas, abogados, contadores, empresas de servicios), sí. Si tienes dudas, escríbenos y te decimos con honestidad si te conviene." },
];

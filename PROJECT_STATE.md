# PROJECT_STATE

## Qué es

SaaS multi-tenant: agentes de IA (Claude) que responden por WhatsApp a nombre
de cada negocio cliente. Un negocio = un `Business` (tenant) con su propio
número de WhatsApp (Meta Cloud API oficial) y su propio agente configurable.
Incluye un CRM simple por conversación (etapas tipo Kommo/GHL) y una landing
pública con planes de precio para vender el producto.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`, config en `prisma.config.ts`)
- NextAuth v5 (credentials + JWT) — `src/auth.ts`
- Meta Cloud API (WhatsApp) — `src/lib/whatsapp.ts`
- Anthropic SDK (Claude) — `src/lib/ai.ts`
- Vitest para unit tests
- Hosting: Vercel (app) + Neon (Postgres, vía integración de Vercel)

## Modelo de datos (`prisma/schema.prisma`)

`Business` (tenant, con `industry`) → `Membership` (usuario↔negocio) →
`AIAgent` (1:1, `systemPrompt`/`tone`/`replyLength`/`enabled`) →
`Conversation` (por número de cliente) → `Message` (con `sentByHuman` para
distinguir un mensaje mandado por la IA de uno mandado a mano desde el
dashboard).

`PipelineStage` es el CRM: cada `Business` tiene su propio set de etapas
(`name` + `position`), sembrado con 5 por defecto al crear el negocio
(Nuevo/En conversación/Interesado/Ganado/Perdido — ver
`DEFAULT_PIPELINE_STAGE_NAMES` en `src/lib/crmStages.ts`), pero cada negocio
puede agregar, renombrar, borrar o reordenar las suyas sin afectar a los
demás (`PipelineManager.tsx` + acciones `addPipelineStage` /
`renamePipelineStage` / `deletePipelineStage` / `movePipelineStage`).
`Conversation.stageId` apunta a una fila de `PipelineStage` de ese mismo
negocio — ya no es un enum fijo.

El `wabaAccessToken` de cada negocio se guarda cifrado (AES-256-GCM,
`src/lib/crypto.ts`) con `TOKEN_ENCRYPTION_KEY`.

## Flujo end-to-end

1. Meta envía cada mensaje entrante al webhook único `POST /api/webhooks/whatsapp`
   (una sola URL para todos los negocios; se identifica el `Business` por
   `phone_number_id` en el payload — no por tenant en la URL).
2. Se verifica la firma `X-Hub-Signature-256` con `META_APP_SECRET`.
3. `src/lib/agent.ts` resuelve el `Business`, carga historial, llama a Claude
   (`src/lib/ai.ts` arma el system prompt final combinando el prompt del
   negocio + tono + largo + rubro + si es el primer mensaje de la
   conversación), envía la respuesta por WhatsApp y persiste ambos mensajes.
   Cualquier error en la llamada a Claude o al envío de WhatsApp se escribe
   como un mensaje `[ERROR INTERNO - IA]` / `[ERROR INTERNO - WHATSAPP]`
   directamente en la conversación (más confiable que los logs de Vercel).
4. El dashboard (`/dashboard`) permite crear negocios, configurar el agente
   (prompt, tono, largo de respuesta, rubro), actualizar credenciales de
   WhatsApp cuando el token vence, ver conversaciones en un tablero CRM por
   etapa, abrir una conversación (bubbles estilo WhatsApp con avatar) y
   escribir manualmente en ella — todo protegido por `Membership`
   (`src/lib/authz.ts` — todo lector/escritor de un negocio específico debe
   pasar por `requireBusinessMembership`).
5. Cada negocio tiene su propia página de KPIs en
   `/dashboard/businesses/[id]/analytics` (link "Ver KPIs" desde la página del
   negocio). `src/lib/analytics.ts` calcula, con consultas a Prisma sobre los
   últimos 30 días: volumen de conversaciones nuevas por día, mensajes por día
   desglosados en Cliente/IA/Humano, tasa de automatización IA (mensajes de
   agente sin `sentByHuman` sobre el total), tasa de error IA (mensajes
   `[ERROR INTERNO ...]` sobre el total de intentos de respuesta), tiempo de
   respuesta promedio/mediana (desde el primer mensaje de una racha del
   cliente hasta la siguiente respuesta real, no de error), conversaciones
   "esperando respuesta" (la última entrada del hilo es del cliente) y
   distribución de conversaciones por etapa del pipeline (todo el histórico,
   no solo 30 días). Los gráficos (`analytics/*Chart.tsx`) son SVG a mano
   siguiendo el skill de dataviz del proyecto — sin librería externa —, con
   tooltip al pasar el mouse; la paleta de color se validó con
   `validate_palette.js` del skill contra la superficie oscura de la marca
   (`#161616`) antes de usarse. Cada KPI y cada gráfico tiene una descripción
   fija en lenguaje simple (pensada para el dueño del negocio, no técnica).
6. La misma página de KPIs incluye **"Diagnóstico de ventas (IA)"**
   (`SalesDiagnosisPanel.tsx` + `src/lib/diagnosis.ts` + acción
   `generateSalesDiagnosis` en `actions.ts`): un botón que manda hasta 20
   conversaciones reales recientes (sin mensajes `[ERROR INTERNO]`) a
   **Claude Opus 5** con salida estructurada (`messages.parse` + Zod, ver
   `@anthropic-ai/sdk/helpers/zod`) y devuelve resumen, puntuación 1-10,
   fortalezas, debilidades y recomendaciones concretas para vender más — se
   genera bajo demanda (no automático) y el último reporte se guarda en
   `AIAgent.diagnosisReport`/`diagnosisGeneratedAt`. Si el negocio tiene menos
   de 3 conversaciones o 12 mensajes útiles, no se llama a la API y se avisa
   que faltan datos. Usa Opus (no el `claude-sonnet-5` de las respuestas de
   WhatsApp) porque es una llamada puntual y poco frecuente, no por mensaje.

## Bugs reales ya resueltos (para no repetirlos)

- **`temperature` es rechazado por el modelo `claude-sonnet-5`** (error 400)
  — se dejó de enviar ese parámetro en `anthropic.messages.create()`. El
  campo (y el slider en el dashboard) se eliminaron por completo más
  adelante: quedó ahí sin hacer nada y confundía al cliente. No reintroducir
  un control de "temperatura" salvo que el modelo lo vuelva a soportar.
- **`ByteString` crash en cada mensaje entrante**: causado por
  `ANTHROPIC_API_KEY` con un carácter fuera de ASCII imprimible (p. ej. un
  "•" de una vista enmascarada de la clave), que terminaba metido en el
  header `Authorization`. Se sanea igual que el token de WhatsApp
  (`sanitizeAsciiToken`, sólo `\x21-\x7E`) antes de usarla.
- **Tokens temporales de WhatsApp vencen (~24h)**: no hay que borrar y
  recrear el negocio — se actualizan desde la sección "Credenciales de
  WhatsApp" del propio negocio en el dashboard.
- **El agente volvía a saludar en cada mensaje**: cada llamada a Claude es
  stateless, así que un prompt con "saluda al cliente" se ejecutaba siempre.
  Se le indica explícitamente si es el primer mensaje de la conversación o
  si ya hay historial.

## Decisión de infraestructura importante

**Next 16 + NextAuth v5 beta: el proxy de auth NO debe interceptar peticiones
POST.** Envolver `POST` (Server Actions) con el wrapper `auth()` de NextAuth
en `proxy.ts` rompe la resolución de la Server Action (Next.js no logra
invocar la función y responde con un redirect fantasma a la última
`callbackUrl`, sin lanzar error visible). Por eso `src/proxy.ts` solo actúa
sobre `GET`; la autorización real en POST/Server Actions ya la hace cada
acción (`src/lib/actions.ts`) y cada página (`auth()` + `requireBusinessMembership`).
Si se actualiza Next o next-auth a versiones estables, revisar si esto se
puede simplificar.

## Variables de entorno (ver `.env.example`)

`DATABASE_URL`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`.

Opcional pero recomendado con Neon: `DIRECT_URL` — la conexión directa (sin
pooler) que usa `prisma migrate deploy` durante el build. Explicación: las
migraciones toman un advisory lock de postgres que necesita una sesión
estable, y el connection string pooled de Neon (pgbouncer en modo
transacción) no la garantiza — cada statement puede caer en una conexión de
backend distinta, así que el lock nunca se resuelve como se espera y el
deploy falla con `Error P1002: Timed out trying to acquire a postgres
advisory lock` aunque la base de datos sí responda. `prisma.config.ts` ya
usa `DIRECT_URL` si existe (con `DATABASE_URL` como respaldo si no está
configurada), así que basta con agregar la variable en Vercel. Para
conseguir ese string en Neon: dashboard del proyecto > Connection Details >
apagar el toggle "Pooled connection", copiar esa conexión y ponerla como
`DIRECT_URL` en Vercel (Production y Preview). `DATABASE_URL` se queda igual
(pooled) — la app en producción la sigue usando tal cual.

Opcional: `AGENCY_ADMIN_EMAIL` — el correo de la cuenta de Funnels Labs (debe
coincidir exacto, sin importar mayúsculas, con el correo que usa esa cuenta
para iniciar sesión en la plataforma). Si está configurada, cada negocio que
se auto-registra en `/register` le da automáticamente una membresía ADMIN a
esa cuenta, así que la agencia ve todos los clientes desde su propio
`/dashboard` sin tocar la base de datos.

Esa asignación automática solo ocurre en el momento exacto del registro, y
solo si la cuenta de la agencia ya existía en ese momento — así que un
negocio creado antes de configurar la variable (o antes de que existiera la
cuenta de la agencia) se queda sin esa membresía. Para no depender de tener
el orden perfecto, `/dashboard/page.tsx` corre un "backfill" en cada carga:
si quien inició sesión es la cuenta de `AGENCY_ADMIN_EMAIL`, se asegura de
tener membresía ADMIN en absolutamente todos los negocios que existan en ese
momento (usa `createMany` con `skipDuplicates`, así que es barato y no
duplica nada). En la práctica esto significa: configura la variable con el
correo correcto de la agencia y, la próxima vez que esa cuenta entre a
`/dashboard`, va a ver todos los negocios — incluidos los que ya existían
antes de configurar la variable.

El botón "Soporte" que ve cada cliente en el header del dashboard
(`src/app/dashboard/layout.tsx`) apunta directo al link de WhatsApp
click-to-chat de la agencia (`https://wa.me/message/F2RWC3YUI7EYM1`) — es un
valor fijo en el código, no una variable de entorno, así que para cambiarlo
hay que editar ese archivo.

`GOOGLE_APPS_SCRIPT_WEBHOOK_URL` — una sola variable que conecta dos cosas
a un único Google Apps Script Web App:

1. Cada registro nuevo en `/register` (nombre, correo, teléfono, negocio,
   industria, fecha) cae como fila en un Google Sheet, para que la agencia
   arme audiencias de remarketing (subir correos/teléfonos a Meta/Google
   Ads, campañas de seguimiento) sin tocar la base de datos
   (`src/lib/remarketingSheet.ts`).
2. El correo de "recuperar contraseña" (`/forgot-password`) se envía desde
   ahí también (`src/lib/email.ts`).

Ambos hacen un POST best-effort a esta URL — si falla o la variable no está
configurada, nunca bloquean lo que el usuario está haciendo (el registro
sigue funcionando, y el formulario de recuperar contraseña sigue mostrando
su mensaje genérico de éxito, solo que no sale nada real).

**Por qué Apps Script y no Gmail SMTP con una "Contraseña de aplicación":**
se intentó primero con SMTP + App Password, pero Google bloquea la creación
de App Passwords en muchas cuentas personales sin avisar por qué ("la
opción de configuración que buscas no está disponible para tu cuenta"), sin
importar que la verificación en dos pasos esté bien activada — es una
restricción del lado de Google, no algo que dependa de esta app. Apps
Script evita el problema por completo: envía correo autorizado por OAuth
(el mismo consentimiento que ya diste al implementar el script), no por
contraseña, así que funciona sin importar esa restricción.

El Sheet ya existe: **Funnels Labs — Registros para Remarketing**, creado en
el Google Drive de `voopmarketing@gmail.com`
(https://docs.google.com/spreadsheets/d/1lnE-PFpV0ip20dnez0kmz3fYCO9RvTXG3dq9CNjTCNU/edit),
con la fila de encabezado (`Fecha de registro, Nombre, Correo, Teléfono,
Negocio, Industria`) ya puesta. Falta conectar el script — eso requiere un
paso manual en Google (Claude no tiene forma de desplegar un Apps Script por
API):

1. Abre ese Sheet → menú **Extensiones → Apps Script**.
2. Borra el contenido de `Code.gs` y pega esto:
   ```js
   function doPost(e) {
     var data = JSON.parse(e.postData.contents);

     if (data.type === "email") {
       MailApp.sendEmail({ to: data.to, subject: data.subject, htmlBody: data.html });
       return ContentService.createTextOutput(JSON.stringify({ ok: true }))
         .setMimeType(ContentService.MimeType.JSON);
     }

     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     sheet.appendRow([
       new Date(),
       data.nombre || "",
       data.correo || "",
       data.telefono || "",
       data.negocio || "",
       data.industria || "",
     ]);
     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. Guarda (ícono de disquete) → botón **Implementar → Nueva implementación**.
4. Tipo: **Aplicación web**. "Ejecutar como": **Yo (voopmarketing@gmail.com)**.
   "Quién tiene acceso": **Cualquier usuario**. Clic en **Implementar** y
   autoriza los permisos que pida Google (es tu propio script, es seguro —
   esta vez te va a pedir permiso también para enviar correo, dale que sí).
5. Copia la **URL de la aplicación web** que te muestra al final (empieza
   con `https://script.google.com/macros/s/.../exec`).
6. Pégala como `GOOGLE_APPS_SCRIPT_WEBHOOK_URL` en Vercel (Production) y haz
   Redeploy. Desde ese momento, cada `/register` nuevo agrega una fila al
   Sheet, y "recuperar contraseña" manda el correo real.

Si ya habías implementado una versión anterior de este script (solo con la
parte del Sheet, sin el `if (data.type === "email")`): edítalo con el código
de arriba y en **Implementar → Administrar implementaciones** → ícono de
lápiz sobre la implementación existente → **Nueva versión** → Implementar.
Así la URL no cambia y no hay que tocar la variable en Vercel de nuevo.

## Cómo levantar en local

```bash
npm install
npx prisma migrate dev
SEED_ADMIN_EMAIL=tu@email.com SEED_ADMIN_PASSWORD=algo npm run db:seed
npm run dev
```

## Negocio: precios y segmentos (recomendación, vive también en la landing `/`)

- **Starter**: $297/mes + $997 implementación única — 1 número, hasta 500
  contactos activos/mes.
- **Pro**: $497/mes + $1,497 implementación única — hasta 2,000 contactos
  activos/mes, dashboard de KPIs + diagnóstico de ventas con IA, ajuste de
  prompt mensual incluido, soporte prioritario.
- **Scale**: a medida — contactos ilimitados, varios números de WhatsApp,
  gerente de cuenta dedicado.
- Posicionamiento high-ticket, vendido por llamada/aplicación, no self-service
  a bajo costo (ver el plan de lanzamiento para la lógica completa de precio).
  Los límites de contactos ya se rastrean técnicamente (ver
  "Plan de negocio y límite de contactos" abajo), pero superar el límite
  todavía no bloquea al agente de responder — es solo una señal visual para
  que la agencia haga seguimiento comercial (upsell), a propósito, porque
  aún no hay cobro/billing automatizado con el que emparejar un bloqueo duro.
- Segmentos objetivo: clientes actuales de Funnels Labs (upsell), clínicas,
  coaches/consultores, ecommerce.
- Márgen: el costo real por negocio activo (Claude + WhatsApp Cloud API +
  Vercel/Neon en el tier gratis/hobby) es de pocos dólares al mes en volumen
  bajo-medio — los precios de arriba dejan margen amplio incluso en plan
  Starter. Vigilar cuando: (a) Neon pase del tier gratis por conexiones o
  almacenamiento, (b) Vercel pase del plan Hobby por funciones/ancho de
  banda, (c) el volumen de conversaciones de WhatsApp supere la ventana de
  servicio gratuita de Meta (24h por conversación iniciada por el cliente).

## Plan de negocio y límite de contactos

`Business.planTier` (`STARTER` / `PRO` / `SCALE`, enum de Prisma) guarda el
plan de cada negocio. `src/lib/plans.ts` define `PLAN_LIMITS` (espejo de los
límites de la landing: 500 / 2,000 / ilimitado) y `planUsageStatus()`, que
clasifica el uso en `good` / `warning` (≥80%) / `critical` (≥100%) /
`unlimited`. "Contacto activo" se calcula igual que en la landing:
`getActiveContactsThisMonth()` en `src/lib/analytics.ts` cuenta clientes
distintos que escribieron al menos un mensaje en lo que va del mes calendario
(UTC).

- En la página de cada negocio (`/dashboard/businesses/[id]`), `PlanUsageCard`
  muestra el plan actual, una barra de progreso con el color de severidad de
  la app (`#0ca30c`/`#fab219`/`#d03b3b`) y "usados / límite" en contactos.
  Solo la agencia (rol `ADMIN`) ve el `<select>` para cambiar de plan — se
  guarda con la server action `updateBusinessPlan`, que rechaza el cambio si
  quien lo pide no es `ADMIN`.
- En la lista de negocios de la agencia (`/dashboard`), cada tarjeta muestra
  una etiqueta ("Cerca del límite del plan" / "Superó el límite del plan")
  cuando ese negocio está en `warning` o `critical` — así Juan puede ver de
  un vistazo a quién contactar para un upsell, sin entrar a cada negocio.
- Sigue siendo solo informativo: no bloquea el envío/recepción de mensajes de
  WhatsApp al superar el límite (ver nota en la sección de precios arriba).

## Recuperar contraseña, perfil propio y módulo de Clientes

**Recuperar contraseña**: `/login` tiene un link "¿Olvidaste tu contraseña?"
→ `/forgot-password` (pide el correo, server action `requestPasswordReset`)
→ si el correo existe, genera un token aleatorio, guarda solo su hash SHA-256
en `User.resetTokenHash` (nunca el token real) con `resetTokenExpiresAt` a 1
hora, y manda un correo con el link `/reset-password?token=...` vía
`src/lib/email.ts` (vía el Google Apps Script, ver `GOOGLE_APPS_SCRIPT_WEBHOOK_URL`
arriba). La respuesta del formulario es siempre la misma exista o no el
correo, para no revelar qué correos están registrados. `/reset-password`
(server action `resetPassword`) valida el hash del token contra la base y
que no haya vencido, actualiza `passwordHash` y borra el token (de un solo
uso).

**Mi perfil** (`/dashboard/account`, cualquier usuario autenticado): formulario
simple para cambiar el `name` propio (server action `updateOwnProfile`). El
correo se muestra pero no se puede editar ahí — es el identificador de login
y, para la cuenta de la agencia, tiene que seguir coincidiendo con
`AGENCY_ADMIN_EMAIL`. Se entra haciendo clic en el correo propio en el header
del dashboard.

**Módulo Clientes** (`/dashboard/clients`, solo visible y accesible para
quien tenga alguna membresía `ADMIN` — la agencia): tabla con los datos
personales que cada cliente puso al registrarse (nombre, correo, teléfono,
negocio, plan, fecha de registro), con link directo a la página de cada
negocio. Pensado para que Juan tenga a mano el correo/teléfono de cada
cliente — para contactarlo, o para poder iniciar sesión con sus credenciales
si necesita reproducir un problema desde la cuenta real del cliente (dado que
la agencia ya tiene acceso completo a la configuración de cada negocio vía su
membresía ADMIN, esto no requiere una función de "iniciar sesión como" —
alcanza con entrar a `/dashboard/businesses/[id]` de ese negocio).
Un cliente sin membresía ADMIN en ningún negocio recibe 404 si intenta
entrar a esta URL directamente.

## Validado manualmente (Playwright, build de producción)

- Login / logout, registro público (`/register`), guard de `/dashboard`
  para anónimos.
- Crear negocio (cifra el token, crea membership + agente); registro
  self-service crea negocio sin credenciales de WhatsApp (se agregan
  después desde el dashboard).
- Editar prompt/tono/largo/rubro/temperatura/enabled del agente.
- Actualizar credenciales de WhatsApp sin perder el token si se deja vacío;
  el panel ahora queda abierto por defecto y deja explícito que el Phone
  Number ID y el token los entrega Meta (con la ruta exacta en WhatsApp
  Manager / Meta for Developers para encontrarlos), y que actualizar el
  token cuando Meta avisa que venció no es opcional.
- Barra de uso de plan (`PlanUsageCard`) en la página de negocio: probado
  como agencia (ve y puede cambiar el plan) y como dueño del negocio (ve la
  barra sin poder editar el plan); etiqueta de "límite superado" probada en
  la lista `/dashboard` de la agencia con un negocio sembrado por encima del
  límite Starter (520/500 contactos).
- Tablero CRM: mover una conversación de etapa vía `<select>`, se refleja
  al instante (`router.refresh()`).
- Enviar un mensaje manual desde el dashboard (marca `sentByHuman`, sale
  por la API real de WhatsApp).
- Webhook: verificación GET, firma HMAC en POST, resolución de negocio por
  `phone_number_id`, persistencia del mensaje del cliente, llamada real a la
  API de Claude, envío real por WhatsApp — confirmado funcionando de punta
  a punta en producción con el número de prueba de Meta.

## Pendiente / siguiente paso

- El rango de fechas de la página de KPIs es fijo (últimos 30 días); si se
  necesita comparar periodos o un rango custom, agregar un selector de fecha
  (el skill de dataviz ya documenta cómo debe verse ese control).
- Encolar el procesamiento del webhook (hoy es inline; a mayor volumen
  conviene una cola) para no bloquear la respuesta rápida que exige Meta.
- Multiimagen/multimedia en WhatsApp (hoy solo texto).
- Detección automática de intención "quiero hablar con un humano" para
  mover la conversación a una etapa/alerta especial.
- Indicador de "IA escribiendo..." y notificaciones en vivo en el dashboard
  (hoy hay que refrescar para ver mensajes nuevos).
- Checkout/cobro real (Stripe u otro) si se vende self-service sin pasar
  por una llamada de onboarding manual.
- Plan de marketing y calendario de contenidos por segmento (clínicas,
  coaches, ecommerce) — pendiente de definir canales y presupuesto de pauta.

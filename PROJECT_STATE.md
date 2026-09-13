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

Opcional: `AGENCY_ADMIN_EMAIL` — el correo de la cuenta de Funnels Labs. Si
está configurada, cada negocio que se auto-registra en `/register` le da
automáticamente una membresía ADMIN a esa cuenta, así que la agencia ve
todos los clientes desde su propio `/dashboard` sin tocar la base de datos.

## Cómo levantar en local

```bash
npm install
npx prisma migrate dev
SEED_ADMIN_EMAIL=tu@email.com SEED_ADMIN_PASSWORD=algo npm run db:seed
npm run dev
```

## Negocio: precios y segmentos (recomendación, vive también en la landing `/`)

- **Starter**: $49/mes + $97 implementación única — 1 número, ~500
  conversaciones/mes.
- **Pro**: $99/mes + $97 implementación única — conversaciones ilimitadas,
  ajuste de prompt mensual incluido, soporte prioritario.
- Segmentos objetivo: clientes actuales de Funnels Labs (upsell), clínicas,
  coaches/consultores, ecommerce.
- Márgen: el costo real por negocio activo (Claude + WhatsApp Cloud API +
  Vercel/Neon en el tier gratis/hobby) es de pocos dólares al mes en volumen
  bajo-medio — los precios de arriba dejan margen amplio incluso en plan
  Starter. Vigilar cuando: (a) Neon pase del tier gratis por conexiones o
  almacenamiento, (b) Vercel pase del plan Hobby por funciones/ancho de
  banda, (c) el volumen de conversaciones de WhatsApp supere la ventana de
  servicio gratuita de Meta (24h por conversación iniciada por el cliente).

## Validado manualmente (Playwright, build de producción)

- Login / logout, registro público (`/register`), guard de `/dashboard`
  para anónimos.
- Crear negocio (cifra el token, crea membership + agente); registro
  self-service crea negocio sin credenciales de WhatsApp (se agregan
  después desde el dashboard).
- Editar prompt/tono/largo/rubro/temperatura/enabled del agente.
- Actualizar credenciales de WhatsApp sin perder el token si se deja vacío.
- Tablero CRM: mover una conversación de etapa vía `<select>`, se refleja
  al instante (`router.refresh()`).
- Enviar un mensaje manual desde el dashboard (marca `sentByHuman`, sale
  por la API real de WhatsApp).
- Webhook: verificación GET, firma HMAC en POST, resolución de negocio por
  `phone_number_id`, persistencia del mensaje del cliente, llamada real a la
  API de Claude, envío real por WhatsApp — confirmado funcionando de punta
  a punta en producción con el número de prueba de Meta.

## Pendiente / siguiente paso

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

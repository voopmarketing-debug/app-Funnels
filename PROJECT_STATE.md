# PROJECT_STATE

## Qué es

SaaS multi-tenant: agentes de IA (Claude) que responden por WhatsApp a nombre
de cada negocio cliente. Un negocio = un `Business` (tenant) con su propio
número de WhatsApp (Meta Cloud API oficial) y su propio agente configurable.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`, config en `prisma.config.ts`)
- NextAuth v5 (credentials + JWT) — `src/auth.ts`
- Meta Cloud API (WhatsApp) — `src/lib/whatsapp.ts`
- Anthropic SDK (Claude) — `src/lib/ai.ts`
- Vitest para unit tests

## Modelo de datos (`prisma/schema.prisma`)

`Business` (tenant) → `Membership` (usuario↔negocio) → `AIAgent` (1:1, config
del agente) → `Conversation` (por número de cliente) → `Message`.

El `wabaAccessToken` de cada negocio se guarda cifrado (AES-256-GCM,
`src/lib/crypto.ts`) con `TOKEN_ENCRYPTION_KEY`.

## Flujo end-to-end

1. Meta envía cada mensaje entrante al webhook único `POST /api/webhooks/whatsapp`
   (una sola URL para todos los negocios; se identifica el `Business` por
   `phone_number_id` en el payload — no por tenant en la URL).
2. Se verifica la firma `X-Hub-Signature-256` con `META_APP_SECRET`.
3. `src/lib/agent.ts` resuelve el `Business`, carga historial, llama a Claude
   con el `systemPrompt` del `AIAgent`, envía la respuesta por WhatsApp y
   persiste ambos mensajes.
4. El dashboard (`/dashboard`) permite crear negocios, configurar el prompt
   del agente y ver conversaciones — todo protegido por `Membership`
   (`src/lib/authz.ts` — todo lector/escritor de un negocio específico debe
   pasar por `requireBusinessMembership`).

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

## Cómo levantar en local

```bash
npm install
npx prisma migrate dev
SEED_ADMIN_EMAIL=tu@email.com SEED_ADMIN_PASSWORD=algo npm run db:seed
npm run dev
```

## Validado manualmente (Playwright, build de producción)

- Login / logout, guard de `/dashboard` para anónimos.
- Crear negocio (cifra el token, crea membership + agente).
- Editar prompt/temperatura/enabled del agente (con refresco inmediato de UI).
- Webhook: verificación GET, firma HMAC en POST, resolución de negocio por
  `phone_number_id`, persistencia del mensaje del cliente, llamada real a la
  API de Claude (falla solo por credenciales de prueba, como se espera).

## Pendiente / siguiente paso

- UI de onboarding para que el propio negocio pegue sus credenciales de Meta
  (hoy solo lo hace el admin de la agencia).
- Encolar el procesamiento del webhook (hoy es inline; a mayor volumen conviene
  una cola) para no bloquear la respuesta rápida que exige Meta.
- Multiimagen/multimedia en WhatsApp (hoy solo texto).
- Página de registro de negocios self-service si se vende sin intervención manual.

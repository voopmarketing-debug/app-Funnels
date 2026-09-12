# App Funnels — Agentes de IA para WhatsApp

Plataforma multi-tenant: cada negocio cliente tiene su propio agente de IA
(Claude) respondiendo por su número de WhatsApp (Meta Cloud API oficial).

Ver [`PROJECT_STATE.md`](./PROJECT_STATE.md) para arquitectura, modelo de
datos y decisiones técnicas.

## Requisitos

- Node 20+
- PostgreSQL

## Setup local

```bash
npm install
cp .env.example .env   # completa DATABASE_URL, AUTH_SECRET, TOKEN_ENCRYPTION_KEY, etc.
npx prisma migrate dev
SEED_ADMIN_EMAIL=tu@email.com SEED_ADMIN_PASSWORD=algo-seguro npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` / `npm run start` — build y server de producción
- `npm test` — tests unitarios (Vitest)
- `npm run db:seed` — crea el usuario admin inicial

## Conectar un negocio a WhatsApp

1. Crea la app de Meta y el WhatsApp Business Account (Cloud API oficial).
2. Configura el webhook `https://tu-dominio.com/api/webhooks/whatsapp` con el
   mismo valor de `WHATSAPP_VERIFY_TOKEN` de tu `.env`.
3. En el dashboard, crea el negocio con su `Phone Number ID` y `Access Token`
   de Meta, y escribe el prompt del agente.

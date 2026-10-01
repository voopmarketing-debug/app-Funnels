CREATE TABLE "AccountAddon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceCop" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "mpPaymentId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAddon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountAddon_mpPaymentId_key" ON "AccountAddon"("mpPaymentId");
CREATE INDEX "AccountAddon_userId_status_expiresAt_idx" ON "AccountAddon"("userId", "status", "expiresAt");
ALTER TABLE "AccountAddon" ADD CONSTRAINT "AccountAddon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

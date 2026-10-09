-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT';

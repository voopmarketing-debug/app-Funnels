-- CreateEnum
CREATE TYPE "ConversationStage" AS ENUM ('NUEVO', 'EN_CONVERSACION', 'INTERESADO', 'GANADO', 'PERDIDO');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "stage" "ConversationStage" NOT NULL DEFAULT 'NUEVO';

-- Whether a salesperson (MEMBER) can create and edit conversation flows. The
-- owner switches it per person; everyone who is already on a team starts with
-- access. Additive: one column with a default, nothing is changed or removed.

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "canManageFlows" BOOLEAN NOT NULL DEFAULT true;

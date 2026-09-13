-- The `temperature` param is rejected by the current model (claude-sonnet-5)
-- and has never actually been sent to the Claude API since that was
-- discovered — this column only ever stored a value nothing read.
ALTER TABLE "AIAgent" DROP COLUMN "temperature";

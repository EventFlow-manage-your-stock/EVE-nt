-- EVENTFLOW_PRODUCT_POLISH_V11
-- Ikony statusów magazynowych i księgowych.
ALTER TABLE "statusy_magazynowe" ADD COLUMN IF NOT EXISTS "ikona" VARCHAR(20);
ALTER TABLE "statusy_ksiegowe" ADD COLUMN IF NOT EXISTS "ikona" VARCHAR(20);

-- EVENTFLOW_PRODUCT_POLISH_V8
-- Oferta może być przypisana bezpośrednio do wynajmu, dzięki czemu jeden wynajem ma wiele ofert roboczych/szablonów.
ALTER TABLE "oferty" ADD COLUMN IF NOT EXISTS "id_wynajmu" INTEGER;

CREATE INDEX IF NOT EXISTS "oferty_id_wynajmu_idx" ON "oferty"("id_wynajmu");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oferty_id_wynajmu_fkey'
  ) THEN
    ALTER TABLE "oferty"
      ADD CONSTRAINT "oferty_id_wynajmu_fkey"
      FOREIGN KEY ("id_wynajmu") REFERENCES "wynajmy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- EVENTFLOW_PRODUCT_POLISH_V3
-- Migracja pomocnicza dla zmian kalendarza i statusow.
-- Uruchom, jezeli uzywasz migracji Prisma. Jezeli robisz prisma db push, wystarczy zaktualizowany schema.prisma.

ALTER TABLE "statusy_wydarzen" ADD COLUMN IF NOT EXISTS "ikona" VARCHAR(20);

ALTER TABLE "wydarzenia" ADD COLUMN IF NOT EXISTS "miejsce_reczne" VARCHAR(255);
ALTER TABLE "wydarzenia" ADD COLUMN IF NOT EXISTS "adres_reczny" VARCHAR(255);
ALTER TABLE "wydarzenia" ADD COLUMN IF NOT EXISTS "link_google_maps" VARCHAR(500);
ALTER TABLE "wydarzenia" ADD COLUMN IF NOT EXISTS "szacowany_czas_dojazdu_min" INTEGER;

-- Domyslne ikony dla juz istniejacych statusow.
UPDATE "statusy_wydarzen" SET "ikona" = COALESCE("ikona", '●') WHERE "ikona" IS NULL;

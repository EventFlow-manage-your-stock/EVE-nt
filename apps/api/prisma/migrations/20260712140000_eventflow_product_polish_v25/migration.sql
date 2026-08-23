-- EVENTFLOW_PRODUCT_POLISH_V25
-- Zdjęcie modelu może być URL-em lub base64 data URL, dlatego zmieniamy pole z VARCHAR na TEXT.
ALTER TABLE "modele" ALTER COLUMN "zdjecie" TYPE TEXT;

-- EVENTFLOW_PRODUCT_POLISH_V34
-- Sprzęt ilościowy: plan/wydanie/PZ po modelu i ilości, bez egzemplarzy.
ALTER TABLE "modele" ADD COLUMN IF NOT EXISTS "tryb_ewidencji" VARCHAR(50) NOT NULL DEFAULT 'egzemplarze';
ALTER TABLE "modele" ADD COLUMN IF NOT EXISTS "ilosc_magazynowa" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE "modele" ADD COLUMN IF NOT EXISTS "jednostka" VARCHAR(20) NOT NULL DEFAULT 'szt.';

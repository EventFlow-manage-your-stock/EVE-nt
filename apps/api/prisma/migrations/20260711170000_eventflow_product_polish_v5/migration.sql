-- EVENTFLOW_PRODUCT_POLISH_V5
-- Poprawka bezpieczeństwa dla db push/migrate po dodaniu historii floty.
-- Modele SerwisPojazdu i PrzegladPojazdu są już w schema.prisma z V4; ta migracja
-- dodaje tylko tabele, jeżeli nie powstały wcześniej przez prisma db push.

CREATE TABLE IF NOT EXISTS "serwisy_pojazdow" (
  "id" SERIAL PRIMARY KEY,
  "id_organizacji" INTEGER NOT NULL,
  "id_pojazdu" INTEGER NOT NULL,
  "data_serwisu" DATE NOT NULL,
  "przebieg_km" INTEGER,
  "opis" TEXT,
  "koszt_netto" DECIMAL(12,2),
  "aktywny" BOOLEAN NOT NULL DEFAULT true,
  "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_aktualizacji" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_usuniecia" TIMESTAMP(3),
  CONSTRAINT "serwisy_pojazdow_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "serwisy_pojazdow_id_pojazdu_fkey" FOREIGN KEY ("id_pojazdu") REFERENCES "pojazdy"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "serwisy_pojazdow_id_pojazdu_idx" ON "serwisy_pojazdow"("id_pojazdu");

CREATE TABLE IF NOT EXISTS "przeglady_pojazdow" (
  "id" SERIAL PRIMARY KEY,
  "id_organizacji" INTEGER NOT NULL,
  "id_pojazdu" INTEGER NOT NULL,
  "typ" VARCHAR(50) NOT NULL DEFAULT 'techniczny',
  "data_przegladu" DATE NOT NULL,
  "data_nastepna" DATE,
  "przebieg_km" INTEGER,
  "opis" TEXT,
  "aktywny" BOOLEAN NOT NULL DEFAULT true,
  "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_aktualizacji" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_usuniecia" TIMESTAMP(3),
  CONSTRAINT "przeglady_pojazdow_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "przeglady_pojazdow_id_pojazdu_fkey" FOREIGN KEY ("id_pojazdu") REFERENCES "pojazdy"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "przeglady_pojazdow_id_pojazdu_idx" ON "przeglady_pojazdow"("id_pojazdu");

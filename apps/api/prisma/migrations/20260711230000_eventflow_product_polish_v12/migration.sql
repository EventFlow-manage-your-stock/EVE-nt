-- EVENTFLOW_PRODUCT_POLISH_V12
-- Wydania/przyjęcia magazynowe z podpisem i pozycjami sprzętu.

CREATE TABLE IF NOT EXISTS "wydania_magazynowe" (
  "id" SERIAL PRIMARY KEY,
  "id_organizacji" INTEGER NOT NULL,
  "id_wydarzenia" INTEGER NULL,
  "id_wynajmu" INTEGER NULL,
  "id_uzytkownika_utworzyl" INTEGER NULL,
  "typ" VARCHAR(30) NOT NULL DEFAULT 'wydanie',
  "numer" VARCHAR(100) NOT NULL,
  "data_operacji" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "osoba_odbierajaca" VARCHAR(200) NULL,
  "podpis_odbierajacego" TEXT NULL,
  "uwagi" TEXT NULL,
  "aktywny" BOOLEAN NOT NULL DEFAULT true,
  "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_aktualizacji" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_usuniecia" TIMESTAMP(3) NULL,
  CONSTRAINT "wydania_magazynowe_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wydania_magazynowe_id_wydarzenia_fkey" FOREIGN KEY ("id_wydarzenia") REFERENCES "wydarzenia"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "wydania_magazynowe_id_wynajmu_fkey" FOREIGN KEY ("id_wynajmu") REFERENCES "wynajmy"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "wydania_magazynowe_id_uzytkownika_utworzyl_fkey" FOREIGN KEY ("id_uzytkownika_utworzyl") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "wydania_magazynowe_id_wydarzenia_idx" ON "wydania_magazynowe"("id_wydarzenia");
CREATE INDEX IF NOT EXISTS "wydania_magazynowe_id_wynajmu_idx" ON "wydania_magazynowe"("id_wynajmu");
CREATE INDEX IF NOT EXISTS "wydania_magazynowe_typ_idx" ON "wydania_magazynowe"("typ");

CREATE TABLE IF NOT EXISTS "pozycje_wydan_magazynowych" (
  "id" SERIAL PRIMARY KEY,
  "id_organizacji" INTEGER NOT NULL,
  "id_wydania" INTEGER NOT NULL,
  "id_modelu" INTEGER NULL,
  "id_egzemplarza" INTEGER NULL,
  "nazwa" VARCHAR(255) NOT NULL,
  "ilosc" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  "status" VARCHAR(30) NOT NULL DEFAULT 'wydany',
  "uwagi" TEXT NULL,
  "aktywny" BOOLEAN NOT NULL DEFAULT true,
  "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_aktualizacji" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pozycje_wydan_magazynowych_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pozycje_wydan_magazynowych_id_wydania_fkey" FOREIGN KEY ("id_wydania") REFERENCES "wydania_magazynowe"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pozycje_wydan_magazynowych_id_modelu_fkey" FOREIGN KEY ("id_modelu") REFERENCES "modele"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "pozycje_wydan_magazynowych_id_egzemplarza_fkey" FOREIGN KEY ("id_egzemplarza") REFERENCES "egzemplarze"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pozycje_wydan_magazynowych_id_wydania_idx" ON "pozycje_wydan_magazynowych"("id_wydania");
CREATE INDEX IF NOT EXISTS "pozycje_wydan_magazynowych_id_modelu_idx" ON "pozycje_wydan_magazynowych"("id_modelu");
CREATE INDEX IF NOT EXISTS "pozycje_wydan_magazynowych_id_egzemplarza_idx" ON "pozycje_wydan_magazynowych"("id_egzemplarza");

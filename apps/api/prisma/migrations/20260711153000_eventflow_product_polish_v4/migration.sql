-- EVENTFLOW_PRODUCT_POLISH_V4
-- Nie usuwamy pól historycznych. Dodajemy pola potrzebne do dopracowania magazynu i floty.

ALTER TABLE modele ADD COLUMN IF NOT EXISTS wartosc_domyslna_egzemplarza DECIMAL(12,2);

ALTER TABLE egzemplarze ADD COLUMN IF NOT EXISTS numer_egzemplarza VARCHAR(100);
ALTER TABLE egzemplarze ADD COLUMN IF NOT EXISTS zewnetrzny_kod_kreskowy VARCHAR(150);
ALTER TABLE egzemplarze ADD COLUMN IF NOT EXISTS zewnetrzny_qr_kod VARCHAR(150);
ALTER TABLE egzemplarze ADD COLUMN IF NOT EXISTS rozroznij_kod_qr BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS marka VARCHAR(100);
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS rok_produkcji INTEGER;
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS vin VARCHAR(50);
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS przebieg_km INTEGER;
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS data_przegladu DATE;
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS data_oc DATE;
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS numer_polisy_oc VARCHAR(100);
ALTER TABLE pojazdy ADD COLUMN IF NOT EXISTS ubezpieczyciel VARCHAR(150);
CREATE INDEX IF NOT EXISTS pojazdy_vin_idx ON pojazdy(vin);

CREATE TABLE IF NOT EXISTS serwisy_pojazdow (
  id SERIAL PRIMARY KEY,
  id_organizacji INTEGER NOT NULL REFERENCES organizacje(id),
  id_pojazdu INTEGER NOT NULL REFERENCES pojazdy(id),
  data_serwisu DATE NOT NULL,
  przebieg_km INTEGER,
  opis TEXT,
  koszt_netto DECIMAL(12,2),
  aktywny BOOLEAN NOT NULL DEFAULT true,
  data_utworzenia TIMESTAMP NOT NULL DEFAULT NOW(),
  data_aktualizacji TIMESTAMP NOT NULL DEFAULT NOW(),
  data_usuniecia TIMESTAMP
);
CREATE INDEX IF NOT EXISTS serwisy_pojazdow_id_pojazdu_idx ON serwisy_pojazdow(id_pojazdu);

CREATE TABLE IF NOT EXISTS przeglady_pojazdow (
  id SERIAL PRIMARY KEY,
  id_organizacji INTEGER NOT NULL REFERENCES organizacje(id),
  id_pojazdu INTEGER NOT NULL REFERENCES pojazdy(id),
  typ VARCHAR(50) NOT NULL DEFAULT 'techniczny',
  data_przegladu DATE NOT NULL,
  data_nastepna DATE,
  przebieg_km INTEGER,
  opis TEXT,
  aktywny BOOLEAN NOT NULL DEFAULT true,
  data_utworzenia TIMESTAMP NOT NULL DEFAULT NOW(),
  data_aktualizacji TIMESTAMP NOT NULL DEFAULT NOW(),
  data_usuniecia TIMESTAMP
);
CREATE INDEX IF NOT EXISTS przeglady_pojazdow_id_pojazdu_idx ON przeglady_pojazdow(id_pojazdu);

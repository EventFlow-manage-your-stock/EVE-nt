/*
  Warnings:

  - You are about to drop the `Item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockLevel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tenant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Warehouse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "StockLevel" DROP CONSTRAINT "StockLevel_itemId_fkey";

-- DropForeignKey
ALTER TABLE "StockLevel" DROP CONSTRAINT "StockLevel_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_tenantId_fkey";

-- DropTable
DROP TABLE "Item";

-- DropTable
DROP TABLE "StockLevel";

-- DropTable
DROP TABLE "Tenant";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "Warehouse";

-- CreateTable
CREATE TABLE "organizacje" (
    "id" SERIAL NOT NULL,
    "nazwa" VARCHAR(255) NOT NULL,
    "subdomena" VARCHAR(100) NOT NULL,
    "nip" CHAR(10),
    "regon" CHAR(14),
    "krs" CHAR(10),
    "email" VARCHAR(150),
    "telefon" VARCHAR(30),
    "ulica" VARCHAR(150),
    "kod_pocztowy" VARCHAR(10),
    "miasto" VARCHAR(100),
    "kraj" VARCHAR(100) NOT NULL DEFAULT 'Polska',
    "status" VARCHAR(50) NOT NULL DEFAULT 'aktywna',
    "plan_abonamentu" VARCHAR(100),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "organizacje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(100) NOT NULL,
    "opis" TEXT,
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uzytkownicy" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "imie" VARCHAR(100) NOT NULL,
    "nazwisko" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "telefon" VARCHAR(30),
    "haslo" VARCHAR(255) NOT NULL,
    "avatar" VARCHAR(500),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_ostatniego_logowania" TIMESTAMP(3),
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "uzytkownicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uzytkownicy_role" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_uzytkownika" INTEGER NOT NULL,
    "id_roli" INTEGER NOT NULL,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "uzytkownicy_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontrahenci" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(255) NOT NULL,
    "nazwa_skrocona" VARCHAR(150),
    "nip" CHAR(10),
    "regon" CHAR(14),
    "krs" CHAR(10),
    "ulica" VARCHAR(150),
    "nr_budynku" VARCHAR(20),
    "nr_lokalu" VARCHAR(20),
    "kod_pocztowy" VARCHAR(10),
    "miasto" VARCHAR(100),
    "kraj" VARCHAR(100) NOT NULL DEFAULT 'Polska',
    "email" VARCHAR(150),
    "telefon" VARCHAR(30),
    "uwagi" TEXT,
    "zrodlo_danych" VARCHAR(50) NOT NULL DEFAULT 'recznie',
    "data_pobrania_gus" TIMESTAMP(3),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "kontrahenci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontakty_kontrahentow" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_kontrahenta" INTEGER NOT NULL,
    "imie" VARCHAR(100),
    "nazwisko" VARCHAR(100),
    "stanowisko" VARCHAR(100),
    "email" VARCHAR(150),
    "telefon" VARCHAR(30),
    "telefon_2" VARCHAR(30),
    "notatki_wewnetrzne" TEXT,
    "glowny" BOOLEAN NOT NULL DEFAULT false,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "kontakty_kontrahentow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miejsca" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(255) NOT NULL,
    "ulica" VARCHAR(150),
    "kod_pocztowy" VARCHAR(10),
    "miasto" VARCHAR(100),
    "kraj" VARCHAR(100) NOT NULL DEFAULT 'Polska',
    "opis" TEXT,
    "notatki_wewnetrzne" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "miejsca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazyny" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(100) NOT NULL,
    "opis" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "magazyny_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategorie" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_rodzica" INTEGER,
    "nazwa" VARCHAR(150) NOT NULL,
    "opis" TEXT,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "kategorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modele" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_kategorii" INTEGER,
    "nazwa" VARCHAR(200) NOT NULL,
    "producent" VARCHAR(100),
    "miejsce_w_mag" VARCHAR(200),
    "opis" TEXT,
    "notatki_wewnetrzne" TEXT,
    "widoczny_w_ofercie" BOOLEAN NOT NULL DEFAULT true,
    "widoczny_w_mag" BOOLEAN NOT NULL DEFAULT true,
    "szerokosc" DECIMAL(10,2),
    "wysokosc" DECIMAL(10,2),
    "glebokosc" DECIMAL(10,2),
    "objetosc" DECIMAL(10,2),
    "waga" DECIMAL(10,2),
    "wartosc" DECIMAL(12,2),
    "zdjecie" VARCHAR(500),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "modele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egzemplarze" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_modelu" INTEGER NOT NULL,
    "id_magazynu" INTEGER,
    "nazwa" VARCHAR(200),
    "sn" VARCHAR(200),
    "qr_kod" VARCHAR(255),
    "kod_kreskowy" VARCHAR(100),
    "miejsce_w_mag" VARCHAR(200),
    "id_case" INTEGER,
    "id_statusu_egzemplarza" INTEGER,
    "szerokosc" DECIMAL(10,2),
    "wysokosc" DECIMAL(10,2),
    "glebokosc" DECIMAL(10,2),
    "objetosc" DECIMAL(10,2),
    "waga" DECIMAL(10,2),
    "wartosc" DECIMAL(12,2),
    "notatki_wewnetrzne" TEXT,
    "zdjecie" VARCHAR(500),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "egzemplarze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cenniki" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "domyslny" BOOLEAN NOT NULL DEFAULT false,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "cenniki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceny_sprzetu" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_cennika" INTEGER NOT NULL,
    "id_modelu" INTEGER NOT NULL,
    "cena_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "vat" DECIMAL(5,2) NOT NULL DEFAULT 23.00,
    "procent_pierwszego_dnia" DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    "przelicznik_kolejnych_dni" DECIMAL(8,2) NOT NULL DEFAULT 1.00,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "ceny_sprzetu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typy_wydarzen" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "typy_wydarzen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statusy_wydarzen" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "statusy_wydarzen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wydarzenia" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_typu_wydarzenia" INTEGER,
    "id_statusu_wydarzenia" INTEGER,
    "id_kontrahenta" INTEGER,
    "id_kontaktu" INTEGER,
    "id_miejsca" INTEGER,
    "id_managera" INTEGER,
    "nazwa" VARCHAR(255) NOT NULL,
    "numer" VARCHAR(100),
    "opis" TEXT,
    "data_start" TIMESTAMP(3),
    "data_koniec" TIMESTAMP(3),
    "budzet_netto" DECIMAL(12,2),
    "budzet_brutto" DECIMAL(12,2),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "wydarzenia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typy_etapow" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "skrot" VARCHAR(20),
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "typy_etapow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapy_wydarzen" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wydarzenia" INTEGER NOT NULL,
    "id_typu_etapu" INTEGER,
    "nazwa" VARCHAR(150) NOT NULL,
    "data_start" TIMESTAMP(3) NOT NULL,
    "data_koniec" TIMESTAMP(3) NOT NULL,
    "opis" TEXT,
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "etapy_wydarzen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statusy_ofert" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "statusy_ofert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferty" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wydarzenia" INTEGER,
    "id_kontrahenta" INTEGER,
    "id_kontaktu" INTEGER,
    "id_managera" INTEGER,
    "id_cennika" INTEGER,
    "id_statusu_oferty" INTEGER,
    "numer" VARCHAR(100),
    "nazwa" VARCHAR(255) NOT NULL,
    "data_sporzadzenia" DATE,
    "termin_platnosci_dni" INTEGER NOT NULL DEFAULT 14,
    "budzet_netto" DECIMAL(12,2),
    "budzet_brutto" DECIMAL(12,2),
    "aktualna_wersja" INTEGER NOT NULL DEFAULT 1,
    "suma_przed_budzetem_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "rabat_budzetowy_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "rabat_budzetowy_proc" DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    "suma_sprzet_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_transport_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_obsluga_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_nocleg_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_inne_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_vat" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_brutto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "algorytm_budzetu" VARCHAR(50) NOT NULL DEFAULT 'brak',
    "blokada_cen" BOOLEAN NOT NULL DEFAULT false,
    "warunki_zamowienia" TEXT,
    "notatki_wewnetrzne" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "oferty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wersje_ofert" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_oferty" INTEGER NOT NULL,
    "numer_wersji" INTEGER NOT NULL,
    "nazwa" VARCHAR(255) NOT NULL,
    "powod_zmiany" TEXT,
    "suma_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_vat" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "suma_brutto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "id_uzytkownika_utworzyl" INTEGER,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "wersje_ofert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sekcje_oferty" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wersji_oferty" INTEGER NOT NULL,
    "nazwa" VARCHAR(255) NOT NULL,
    "opis" TEXT,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "budzet_netto" DECIMAL(12,2),
    "suma_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "widoczna_w_pdf" BOOLEAN NOT NULL DEFAULT true,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "sekcje_oferty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pozycje_oferty" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wersji_oferty" INTEGER NOT NULL,
    "id_sekcji" INTEGER,
    "id_kategorii" INTEGER,
    "id_modelu" INTEGER,
    "id_ceny_sprzetu" INTEGER,
    "typ_pozycji" VARCHAR(50) NOT NULL DEFAULT 'sprzet',
    "nazwa" VARCHAR(255) NOT NULL,
    "opis" TEXT,
    "uwagi" TEXT,
    "cena_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "ilosc" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "dni_pracy" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "procent_pierwszego_dnia" DECIMAL(6,2) NOT NULL DEFAULT 100.00,
    "przelicznik" DECIMAL(8,2) NOT NULL DEFAULT 1.00,
    "rabat_proc" DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    "rabat_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "cena_przed_budzetem_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "rabat_budzetowy_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "vat" DECIMAL(5,2) NOT NULL DEFAULT 23.00,
    "razem_netto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "razem_vat" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "razem_brutto" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "widoczna_w_pdf" BOOLEAN NOT NULL DEFAULT true,
    "zablokowana_przed_budzetem" BOOLEAN NOT NULL DEFAULT false,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "pozycje_oferty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statusy_wynajmow" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "statusy_wynajmow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wynajmy" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wydarzenia" INTEGER,
    "id_oferty" INTEGER,
    "id_kontrahenta" INTEGER,
    "id_statusu_wynajmu" INTEGER,
    "numer" VARCHAR(100),
    "data_wydania" TIMESTAMP(3),
    "data_zwrotu_planowana" TIMESTAMP(3),
    "data_zwrotu_rzeczywista" TIMESTAMP(3),
    "notatki_wewnetrzne" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "wynajmy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pozycje_wynajmu" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wynajmu" INTEGER NOT NULL,
    "id_modelu" INTEGER NOT NULL,
    "id_egzemplarza" INTEGER,
    "ilosc" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "notatki_wewnetrzne" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "pozycje_wynajmu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statusy_serwisu" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "kolor" VARCHAR(20),
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "statusy_serwisu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serwisy_sprzetu" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_egzemplarza" INTEGER NOT NULL,
    "id_statusu_serwisu" INTEGER NOT NULL,
    "id_uzytkownika_zglosil" INTEGER NOT NULL,
    "id_uzytkownika_rozwiazal" INTEGER,
    "tytul" VARCHAR(150) NOT NULL,
    "opis" TEXT,
    "rozwiazanie" TEXT,
    "data_zgloszenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_rozwiazania" TIMESTAMP(3),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "serwisy_sprzetu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zalaczniki" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "typ_obiektu" VARCHAR(100) NOT NULL,
    "id_obiektu" INTEGER NOT NULL,
    "nazwa" VARCHAR(255) NOT NULL,
    "nazwa_pliku" VARCHAR(255) NOT NULL,
    "sciezka" VARCHAR(500),
    "mime" VARCHAR(100),
    "rozmiar_bajtow" INTEGER,
    "id_uzytkownika_dodal" INTEGER,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "zalaczniki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logi_zmian" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_uzytkownika" INTEGER,
    "typ_obiektu" VARCHAR(100) NOT NULL,
    "id_obiektu" INTEGER,
    "akcja" VARCHAR(50) NOT NULL,
    "pole" VARCHAR(100),
    "stara_wartosc" TEXT,
    "nowa_wartosc" TEXT,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logi_zmian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wydarzenia_uzytkownicy" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wydarzenia" INTEGER NOT NULL,
    "id_uzytkownika" INTEGER NOT NULL,
    "rola_w_wydarzeniu" VARCHAR(100),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "wydarzenia_uzytkownicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pojazdy" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "nazwa" VARCHAR(150) NOT NULL,
    "nr_rejestracyjny" VARCHAR(50) NOT NULL,
    "ladownosc_kg" DECIMAL(10,2),
    "objetosc_m3" DECIMAL(10,2),
    "notatki" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "pojazdy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wydarzenia_pojazdy" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_wydarzenia" INTEGER NOT NULL,
    "id_pojazdu" INTEGER NOT NULL,
    "rola_pojazdu" VARCHAR(100),
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "wydarzenia_pojazdy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zadania" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_przypisanego" INTEGER,
    "tytul" VARCHAR(200) NOT NULL,
    "opis" TEXT,
    "termin" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'nowe',
    "powiazany_typ" VARCHAR(100),
    "powiazane_id" INTEGER,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "zadania_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nieobecnosci" (
    "id" SERIAL NOT NULL,
    "id_organizacji" INTEGER NOT NULL,
    "id_uzytkownika" INTEGER NOT NULL,
    "typ" VARCHAR(50) NOT NULL,
    "data_od" TIMESTAMP(3) NOT NULL,
    "data_do" TIMESTAMP(3) NOT NULL,
    "opis" TEXT,
    "aktywny" BOOLEAN NOT NULL DEFAULT true,
    "data_utworzenia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_aktualizacji" TIMESTAMP(3) NOT NULL,
    "data_usuniecia" TIMESTAMP(3),

    CONSTRAINT "nieobecnosci_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacje_subdomena_key" ON "organizacje"("subdomena");

-- CreateIndex
CREATE UNIQUE INDEX "organizacje_nip_key" ON "organizacje"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "role_id_organizacji_nazwa_key" ON "role"("id_organizacji", "nazwa");

-- CreateIndex
CREATE UNIQUE INDEX "uzytkownicy_id_organizacji_email_key" ON "uzytkownicy"("id_organizacji", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uzytkownicy_role_id_uzytkownika_id_roli_key" ON "uzytkownicy_role"("id_uzytkownika", "id_roli");

-- CreateIndex
CREATE INDEX "kontrahenci_nip_idx" ON "kontrahenci"("nip");

-- CreateIndex
CREATE INDEX "kontrahenci_nazwa_idx" ON "kontrahenci"("nazwa");

-- CreateIndex
CREATE INDEX "kontakty_kontrahentow_id_kontrahenta_idx" ON "kontakty_kontrahentow"("id_kontrahenta");

-- CreateIndex
CREATE UNIQUE INDEX "magazyny_id_organizacji_nazwa_key" ON "magazyny"("id_organizacji", "nazwa");

-- CreateIndex
CREATE INDEX "kategorie_id_rodzica_idx" ON "kategorie"("id_rodzica");

-- CreateIndex
CREATE INDEX "modele_id_kategorii_idx" ON "modele"("id_kategorii");

-- CreateIndex
CREATE INDEX "modele_nazwa_idx" ON "modele"("nazwa");

-- CreateIndex
CREATE INDEX "egzemplarze_id_modelu_idx" ON "egzemplarze"("id_modelu");

-- CreateIndex
CREATE INDEX "egzemplarze_sn_idx" ON "egzemplarze"("sn");

-- CreateIndex
CREATE INDEX "egzemplarze_qr_kod_idx" ON "egzemplarze"("qr_kod");

-- CreateIndex
CREATE INDEX "egzemplarze_kod_kreskowy_idx" ON "egzemplarze"("kod_kreskowy");

-- CreateIndex
CREATE UNIQUE INDEX "cenniki_id_organizacji_nazwa_key" ON "cenniki"("id_organizacji", "nazwa");

-- CreateIndex
CREATE UNIQUE INDEX "ceny_sprzetu_id_cennika_id_modelu_key" ON "ceny_sprzetu"("id_cennika", "id_modelu");

-- CreateIndex
CREATE INDEX "wydarzenia_data_start_data_koniec_idx" ON "wydarzenia"("data_start", "data_koniec");

-- CreateIndex
CREATE INDEX "etapy_wydarzen_id_wydarzenia_idx" ON "etapy_wydarzen"("id_wydarzenia");

-- CreateIndex
CREATE INDEX "oferty_id_wydarzenia_idx" ON "oferty"("id_wydarzenia");

-- CreateIndex
CREATE INDEX "oferty_numer_idx" ON "oferty"("numer");

-- CreateIndex
CREATE UNIQUE INDEX "wersje_ofert_id_oferty_numer_wersji_key" ON "wersje_ofert"("id_oferty", "numer_wersji");

-- CreateIndex
CREATE INDEX "sekcje_oferty_id_wersji_oferty_idx" ON "sekcje_oferty"("id_wersji_oferty");

-- CreateIndex
CREATE INDEX "pozycje_oferty_id_wersji_oferty_idx" ON "pozycje_oferty"("id_wersji_oferty");

-- CreateIndex
CREATE INDEX "pozycje_oferty_id_sekcji_idx" ON "pozycje_oferty"("id_sekcji");

-- CreateIndex
CREATE INDEX "zalaczniki_typ_obiektu_id_obiektu_idx" ON "zalaczniki"("typ_obiektu", "id_obiektu");

-- CreateIndex
CREATE INDEX "logi_zmian_typ_obiektu_id_obiektu_idx" ON "logi_zmian"("typ_obiektu", "id_obiektu");

-- CreateIndex
CREATE INDEX "logi_zmian_data_utworzenia_idx" ON "logi_zmian"("data_utworzenia");

-- CreateIndex
CREATE UNIQUE INDEX "wydarzenia_uzytkownicy_id_wydarzenia_id_uzytkownika_key" ON "wydarzenia_uzytkownicy"("id_wydarzenia", "id_uzytkownika");

-- CreateIndex
CREATE UNIQUE INDEX "pojazdy_id_organizacji_nr_rejestracyjny_key" ON "pojazdy"("id_organizacji", "nr_rejestracyjny");

-- CreateIndex
CREATE UNIQUE INDEX "wydarzenia_pojazdy_id_wydarzenia_id_pojazdu_key" ON "wydarzenia_pojazdy"("id_wydarzenia", "id_pojazdu");

-- CreateIndex
CREATE INDEX "zadania_powiazany_typ_powiazane_id_idx" ON "zadania"("powiazany_typ", "powiazane_id");

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uzytkownicy" ADD CONSTRAINT "uzytkownicy_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uzytkownicy_role" ADD CONSTRAINT "uzytkownicy_role_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uzytkownicy_role" ADD CONSTRAINT "uzytkownicy_role_id_uzytkownika_fkey" FOREIGN KEY ("id_uzytkownika") REFERENCES "uzytkownicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uzytkownicy_role" ADD CONSTRAINT "uzytkownicy_role_id_roli_fkey" FOREIGN KEY ("id_roli") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontrahenci" ADD CONSTRAINT "kontrahenci_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakty_kontrahentow" ADD CONSTRAINT "kontakty_kontrahentow_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakty_kontrahentow" ADD CONSTRAINT "kontakty_kontrahentow_id_kontrahenta_fkey" FOREIGN KEY ("id_kontrahenta") REFERENCES "kontrahenci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miejsca" ADD CONSTRAINT "miejsca_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazyny" ADD CONSTRAINT "magazyny_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategorie" ADD CONSTRAINT "kategorie_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategorie" ADD CONSTRAINT "kategorie_id_rodzica_fkey" FOREIGN KEY ("id_rodzica") REFERENCES "kategorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modele" ADD CONSTRAINT "modele_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modele" ADD CONSTRAINT "modele_id_kategorii_fkey" FOREIGN KEY ("id_kategorii") REFERENCES "kategorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egzemplarze" ADD CONSTRAINT "egzemplarze_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egzemplarze" ADD CONSTRAINT "egzemplarze_id_modelu_fkey" FOREIGN KEY ("id_modelu") REFERENCES "modele"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egzemplarze" ADD CONSTRAINT "egzemplarze_id_magazynu_fkey" FOREIGN KEY ("id_magazynu") REFERENCES "magazyny"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egzemplarze" ADD CONSTRAINT "egzemplarze_id_case_fkey" FOREIGN KEY ("id_case") REFERENCES "egzemplarze"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cenniki" ADD CONSTRAINT "cenniki_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceny_sprzetu" ADD CONSTRAINT "ceny_sprzetu_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceny_sprzetu" ADD CONSTRAINT "ceny_sprzetu_id_cennika_fkey" FOREIGN KEY ("id_cennika") REFERENCES "cenniki"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceny_sprzetu" ADD CONSTRAINT "ceny_sprzetu_id_modelu_fkey" FOREIGN KEY ("id_modelu") REFERENCES "modele"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typy_wydarzen" ADD CONSTRAINT "typy_wydarzen_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statusy_wydarzen" ADD CONSTRAINT "statusy_wydarzen_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_typu_wydarzenia_fkey" FOREIGN KEY ("id_typu_wydarzenia") REFERENCES "typy_wydarzen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_statusu_wydarzenia_fkey" FOREIGN KEY ("id_statusu_wydarzenia") REFERENCES "statusy_wydarzen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_kontrahenta_fkey" FOREIGN KEY ("id_kontrahenta") REFERENCES "kontrahenci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_kontaktu_fkey" FOREIGN KEY ("id_kontaktu") REFERENCES "kontakty_kontrahentow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_miejsca_fkey" FOREIGN KEY ("id_miejsca") REFERENCES "miejsca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia" ADD CONSTRAINT "wydarzenia_id_managera_fkey" FOREIGN KEY ("id_managera") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typy_etapow" ADD CONSTRAINT "typy_etapow_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapy_wydarzen" ADD CONSTRAINT "etapy_wydarzen_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapy_wydarzen" ADD CONSTRAINT "etapy_wydarzen_id_wydarzenia_fkey" FOREIGN KEY ("id_wydarzenia") REFERENCES "wydarzenia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapy_wydarzen" ADD CONSTRAINT "etapy_wydarzen_id_typu_etapu_fkey" FOREIGN KEY ("id_typu_etapu") REFERENCES "typy_etapow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statusy_ofert" ADD CONSTRAINT "statusy_ofert_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_wydarzenia_fkey" FOREIGN KEY ("id_wydarzenia") REFERENCES "wydarzenia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_kontrahenta_fkey" FOREIGN KEY ("id_kontrahenta") REFERENCES "kontrahenci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_kontaktu_fkey" FOREIGN KEY ("id_kontaktu") REFERENCES "kontakty_kontrahentow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_managera_fkey" FOREIGN KEY ("id_managera") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_cennika_fkey" FOREIGN KEY ("id_cennika") REFERENCES "cenniki"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferty" ADD CONSTRAINT "oferty_id_statusu_oferty_fkey" FOREIGN KEY ("id_statusu_oferty") REFERENCES "statusy_ofert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wersje_ofert" ADD CONSTRAINT "wersje_ofert_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wersje_ofert" ADD CONSTRAINT "wersje_ofert_id_oferty_fkey" FOREIGN KEY ("id_oferty") REFERENCES "oferty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wersje_ofert" ADD CONSTRAINT "wersje_ofert_id_uzytkownika_utworzyl_fkey" FOREIGN KEY ("id_uzytkownika_utworzyl") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sekcje_oferty" ADD CONSTRAINT "sekcje_oferty_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sekcje_oferty" ADD CONSTRAINT "sekcje_oferty_id_wersji_oferty_fkey" FOREIGN KEY ("id_wersji_oferty") REFERENCES "wersje_ofert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_oferty" ADD CONSTRAINT "pozycje_oferty_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_oferty" ADD CONSTRAINT "pozycje_oferty_id_wersji_oferty_fkey" FOREIGN KEY ("id_wersji_oferty") REFERENCES "wersje_ofert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_oferty" ADD CONSTRAINT "pozycje_oferty_id_sekcji_fkey" FOREIGN KEY ("id_sekcji") REFERENCES "sekcje_oferty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_oferty" ADD CONSTRAINT "pozycje_oferty_id_kategorii_fkey" FOREIGN KEY ("id_kategorii") REFERENCES "kategorie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_oferty" ADD CONSTRAINT "pozycje_oferty_id_modelu_fkey" FOREIGN KEY ("id_modelu") REFERENCES "modele"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_oferty" ADD CONSTRAINT "pozycje_oferty_id_ceny_sprzetu_fkey" FOREIGN KEY ("id_ceny_sprzetu") REFERENCES "ceny_sprzetu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statusy_wynajmow" ADD CONSTRAINT "statusy_wynajmow_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wynajmy" ADD CONSTRAINT "wynajmy_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wynajmy" ADD CONSTRAINT "wynajmy_id_wydarzenia_fkey" FOREIGN KEY ("id_wydarzenia") REFERENCES "wydarzenia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wynajmy" ADD CONSTRAINT "wynajmy_id_oferty_fkey" FOREIGN KEY ("id_oferty") REFERENCES "oferty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wynajmy" ADD CONSTRAINT "wynajmy_id_kontrahenta_fkey" FOREIGN KEY ("id_kontrahenta") REFERENCES "kontrahenci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wynajmy" ADD CONSTRAINT "wynajmy_id_statusu_wynajmu_fkey" FOREIGN KEY ("id_statusu_wynajmu") REFERENCES "statusy_wynajmow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_wynajmu" ADD CONSTRAINT "pozycje_wynajmu_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_wynajmu" ADD CONSTRAINT "pozycje_wynajmu_id_wynajmu_fkey" FOREIGN KEY ("id_wynajmu") REFERENCES "wynajmy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_wynajmu" ADD CONSTRAINT "pozycje_wynajmu_id_modelu_fkey" FOREIGN KEY ("id_modelu") REFERENCES "modele"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_wynajmu" ADD CONSTRAINT "pozycje_wynajmu_id_egzemplarza_fkey" FOREIGN KEY ("id_egzemplarza") REFERENCES "egzemplarze"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statusy_serwisu" ADD CONSTRAINT "statusy_serwisu_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy_sprzetu" ADD CONSTRAINT "serwisy_sprzetu_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy_sprzetu" ADD CONSTRAINT "serwisy_sprzetu_id_egzemplarza_fkey" FOREIGN KEY ("id_egzemplarza") REFERENCES "egzemplarze"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy_sprzetu" ADD CONSTRAINT "serwisy_sprzetu_id_statusu_serwisu_fkey" FOREIGN KEY ("id_statusu_serwisu") REFERENCES "statusy_serwisu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy_sprzetu" ADD CONSTRAINT "serwisy_sprzetu_id_uzytkownika_zglosil_fkey" FOREIGN KEY ("id_uzytkownika_zglosil") REFERENCES "uzytkownicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serwisy_sprzetu" ADD CONSTRAINT "serwisy_sprzetu_id_uzytkownika_rozwiazal_fkey" FOREIGN KEY ("id_uzytkownika_rozwiazal") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zalaczniki" ADD CONSTRAINT "zalaczniki_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zalaczniki" ADD CONSTRAINT "zalaczniki_id_uzytkownika_dodal_fkey" FOREIGN KEY ("id_uzytkownika_dodal") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logi_zmian" ADD CONSTRAINT "logi_zmian_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logi_zmian" ADD CONSTRAINT "logi_zmian_id_uzytkownika_fkey" FOREIGN KEY ("id_uzytkownika") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia_uzytkownicy" ADD CONSTRAINT "wydarzenia_uzytkownicy_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia_uzytkownicy" ADD CONSTRAINT "wydarzenia_uzytkownicy_id_wydarzenia_fkey" FOREIGN KEY ("id_wydarzenia") REFERENCES "wydarzenia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia_uzytkownicy" ADD CONSTRAINT "wydarzenia_uzytkownicy_id_uzytkownika_fkey" FOREIGN KEY ("id_uzytkownika") REFERENCES "uzytkownicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pojazdy" ADD CONSTRAINT "pojazdy_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia_pojazdy" ADD CONSTRAINT "wydarzenia_pojazdy_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia_pojazdy" ADD CONSTRAINT "wydarzenia_pojazdy_id_wydarzenia_fkey" FOREIGN KEY ("id_wydarzenia") REFERENCES "wydarzenia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wydarzenia_pojazdy" ADD CONSTRAINT "wydarzenia_pojazdy_id_pojazdu_fkey" FOREIGN KEY ("id_pojazdu") REFERENCES "pojazdy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zadania" ADD CONSTRAINT "zadania_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zadania" ADD CONSTRAINT "zadania_id_przypisanego_fkey" FOREIGN KEY ("id_przypisanego") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nieobecnosci" ADD CONSTRAINT "nieobecnosci_id_organizacji_fkey" FOREIGN KEY ("id_organizacji") REFERENCES "organizacje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nieobecnosci" ADD CONSTRAINT "nieobecnosci_id_uzytkownika_fkey" FOREIGN KEY ("id_uzytkownika") REFERENCES "uzytkownicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

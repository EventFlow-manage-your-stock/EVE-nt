-- EVENTFLOW_PRODUCT_POLISH_V28
-- Wynajmy są od tej wersji osobnymi bytami. Wydanie sprzętu do wydarzenia nie tworzy wynajmu.
-- Czyścimy stare powiązania, żeby kalendarz i panel wydarzenia nie dublowały informacji.
UPDATE wynajmy SET id_wydarzenia = NULL WHERE id_wydarzenia IS NOT NULL;

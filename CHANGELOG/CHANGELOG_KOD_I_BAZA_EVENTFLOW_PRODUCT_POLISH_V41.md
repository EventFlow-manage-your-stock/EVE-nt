# Changelog V41

## API

- `apps/api/src/magazyn/magazyn.service.ts`
  - poprawiono `getDokumentMagazynowyById`: usunięto błędny include `wynajem.wydarzenie`, który po rozdzieleniu wynajmów od wydarzeń powodował błąd runtime Prisma i 500 na stronie dokumentu,
  - dodano walidację osoby odbierającej przy wydaniu do wynajmu,
  - dokumenty wydarzeń nadal działają bez osoby odbierającej; podpis wydającego wynika z zalogowanego użytkownika.

## Web

- `apps/web/app/dashboard/warehouse/documents/[id]/page.tsx`
  - nowy ekran potwierdzenia WZ/PZ po zapisie dokumentu,
  - czytelna lista wydanego/przyjętego sprzętu,
  - przyciski PDF do druku/pobrania.

- `apps/web/app/dashboard/warehouse/documents/[id]/pdf/page.tsx`
  - PDF używa podpisu wystawiającego z konta użytkownika,
  - poprawiono opis wynajmu bez starej relacji `wynajem -> wydarzenie`.

- `apps/web/app/dashboard/events/[id]/page.tsx`
  - po wystawieniu WZ/PZ przejście na ekran potwierdzenia, zamiast bezpośrednio na PDF.

- `apps/web/app/dashboard/warehouse/receiving/page.tsx`
  - po zapisie dokumentu przejście na ekran potwierdzenia,
  - linki ostatnich dokumentów prowadzą do potwierdzenia.

- `apps/web/app/dashboard/layout.tsx`
  - sidebar używa logo do ciemnego tła.

## Brandpack

- `apps/web/public/eventflow-logo.svg`
- `apps/web/public/eventflow-logo-sidebar.svg`
- `apps/web/public/eventflow-mark.svg`
- `apps/web/public/favicon.ico`
- `apps/web/public/apple-touch-icon.png`
- `apps/web/public/android-chrome-192.png`
- `apps/web/public/android-chrome-512.png`

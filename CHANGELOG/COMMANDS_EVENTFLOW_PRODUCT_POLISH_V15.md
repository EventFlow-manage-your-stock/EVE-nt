# Komendy V15

Patch nakładaj tak jak poprzednie wersje: czysty clone z GitHuba, rozpakowanie ZIP do `/tmp`, `rsync`, `pnpm install`, `prisma db push`, `prisma generate`.

Jeżeli Prisma zapyta o reset bazy albo utratę danych, przerwij `CTRL+C` i podeślij komunikat.

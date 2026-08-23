# Komendy V28

Po standardowym `db push` i `generate` uruchom jednorazowo:

```bash
cd ~/Desktop/EventFlow
DATABASE_URL="postgresql://saas_admin:super_secret_password@localhost:5432/wms_event_db" pnpm fix:wynajmy-separate
```

To odłącza stare wynajmy od wydarzeń, żeby nie były traktowane jako część eventu.

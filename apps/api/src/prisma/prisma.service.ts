import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public extendedClient;

  constructor(private tenantContextService: TenantContextService) {
    // Inicjalizujemy standardowego klienta (bez adaptera pg, co eliminuje błąd typów)
    super();

    // Przywracamy Twoje rozszerzenie Prisma, zaktualizowane o nowe nazwy
    this.extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Zmieniono 'Tenant' na 'Organizacja'
            if (model === 'Organizacja') {
              return query(args);
            }

            // Pobieramy ID tenanta z izolowanego kontekstu żądania HTTP
            const id_organizacji = tenantContextService.getTenantId();

            if (id_organizacji) {
              // Rzutujemy na 'any', aby ominąć restrykcje TypeScriptu dla dynamicznych zapytań
              const queryArgs = args as any;

              // Zabezpieczamy odczyty i operacje masowe (używamy pola id_organizacji)
              if (['findMany', 'findFirst', 'count', 'updateMany', 'deleteMany'].includes(operation)) {
                queryArgs.where = queryArgs.where || {};
                queryArgs.where.id_organizacji = id_organizacji;
              }
              
              // Wstrzykujemy id_organizacji przy tworzeniu nowych rekordów
              if (operation === 'create') {
                queryArgs.data = queryArgs.data || {};
                queryArgs.data.id_organizacji = id_organizacji;
              }
            }

            return query(args);
          },
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('📦 Pomyślnie połączono z bazą danych PostgreSQL (Zaimplementowano izolację Organizacji)!');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
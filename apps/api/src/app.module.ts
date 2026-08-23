import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WydarzeniaModule } from './wydarzenia/wydarzenia.module';
import { TenantMiddleware } from './prisma/tenant.middleware';
import { SlownikiModule } from './slowniki/slowniki.module';
import { MagazynModule } from './magazyn/magazyn.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SerwisModule } from './serwis/serwis.module';
import { CrmModule } from './crm/crm.module';
import { ZadaniaModule } from './zadania/zadania.module';

// EVENTFLOW_PRODUCT_POLISH_V3:
// Nowe moduły dokładamy jako osobne moduły NestJS, żeby nie usuwać starego kodu
// i nie mieszać logiki nowych zakładek z istniejącymi kontrolerami.
import { KalendarzModule } from './kalendarz/kalendarz.module';
import { WynajmyModule } from './wynajmy/wynajmy.module';
import { UrlopyModule } from './urlopy/urlopy.module';
import { FlotaModule } from './flota/flota.module';
import { OfertyModule } from './oferty/oferty.module';
import { GusModule } from './gus/gus.module';
import { UstawieniaModule } from './ustawienia/ustawienia.module';
import { ZapytaniaModule } from './zapytania/zapytania.module';
import { UzytkownicyModule } from './uzytkownicy/uzytkownicy.module';
import { PakietyModule } from './pakiety/pakiety.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WydarzeniaModule,
    SlownikiModule,
    MagazynModule,
    DashboardModule,
    SerwisModule,
    CrmModule,
    ZadaniaModule,
    KalendarzModule,
    WynajmyModule,
    UrlopyModule,
    FlotaModule,
    OfertyModule,
    GusModule,
    UstawieniaModule,
    ZapytaniaModule,
    UzytkownicyModule,
    PakietyModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/auth/login', method: RequestMethod.POST },
        { path: 'api/auth/register', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}

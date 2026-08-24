import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContextService {
  // NAPRAWA: Zmiana z <string, string> na <string, number>, aby Prisma nie rzucała błędu walidacji
  private static storage = new AsyncLocalStorage<Map<string, number>>();

  run(tenantId: number, callback: () => void) {
    const store = new Map<string, number>();
    store.set('tenantId', tenantId);
    TenantContextService.storage.run(store, callback);
  }

  getTenantId(): number | undefined {
    const store = TenantContextService.storage.getStore();
    return store?.get('tenantId');
  }
}
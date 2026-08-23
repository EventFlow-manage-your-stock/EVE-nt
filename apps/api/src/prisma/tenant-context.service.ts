import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContextService {
  // Inicjalizacja natywnego kontenera dla asynchronicznego wątku żądania
  private static storage = new AsyncLocalStorage<Map<string, string>>();

  run(tenantId: string, callback: () => void) {
    const store = new Map<string, string>();
    store.set('tenantId', tenantId);
    TenantContextService.storage.run(store, callback);
  }

  getTenantId(): string | undefined {
    const store = TenantContextService.storage.getStore();
    return store?.get('tenantId');
  }
}
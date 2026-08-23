import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantContextService: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        // Dekodujemy token bez pełnej weryfikacji (weryfikacją zajmie się Guard),
        // potrzebujemy jedynie odczytać tenantId na wczesnym etapie żądania
        const decoded = jwt.decode(token) as any;
        
        if (decoded && decoded.tenantId) {
          // Uruchamiamy dalszy ciąg żądania wewnątrz zizolowanego kontekstu
          return this.tenantContextService.run(decoded.tenantId, () => {
            next();
          });
        }
      } catch (err) {
        // W razie błędu dekodowania pozwalamy przejść dalej - Guard rzuci 401
      }
    }
    
    next();
  }
}